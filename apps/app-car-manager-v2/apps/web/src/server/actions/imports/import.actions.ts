'use server';

import { randomUUID } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { and, eq, isNull } from 'drizzle-orm';
import { db } from '@car-v2/db/client';
import { carImports, carVehicles } from '@car-v2/db/schema';
import { createTruckTrip, completeTruckTrip } from '@car-v2/core/truck';
import { CarError, type ActionResult } from '@car-v2/shared/errors';
import { importTruckTripsSchema, parseImportDate, parseWallClockUtc } from '@car-v2/shared/zod';
import { getCurrentUser, requireRole } from '@/lib/auth/get-current-user';
import { requireFleet } from '@/lib/auth/fleet-access';
import { assertTruckMonthOpen } from '@/server/queries/truck-finance.queries';
import { nextTripRef } from '@/server/services/trip-ref.service';
import { logAudit } from '@/server/services/audit-log.service';
import { runAction } from '../_helpers';

function isUniqueViolation(err: unknown): boolean {
  return typeof err === 'object' && err !== null && (err as { code?: string }).code === '23505';
}

/* Combine the row's date with a "Giờ bắt đầu/kết thúc" time-of-day ("8:00",
 * "08:30", "8:00:00") into a UTC Date — same frame as the manual complete
 * flow — so the sheet's start/end time is kept instead of dropped. Returns null
 * when either part is missing/unparseable (trip then keeps no start / end=now). */
function combineDateTime(dateStr: string, time: string | undefined): Date | null {
  if (!time) return null;
  const d = /^(\d{4}-\d{2}-\d{2})/.exec(dateStr.trim());
  const t = /^(\d{1,2}):(\d{2})(?::(\d{2}))?/.exec(time.trim());
  if (!d?.[1] || !t?.[1] || !t?.[2]) return null;
  /* Wall clock -> UTC, the same frame every reader uses (parseWallClockUtc). */
  return parseWallClockUtc(`${d[1]}T${t[1].padStart(2, '0')}:${t[2]}:${t[3] ?? '00'}`);
}

/**
 * Bulk-import a truck's monthly trip log from a parsed Excel sheet. One file =
 * one truck + driver (chosen in the UI); each row becomes a COMPLETED LOG trip
 * with computed cost/profit. Records the run in car_imports (history + audit).
 *
 * neon-http has no multi-statement transaction, so this is a best-effort loop:
 * on failure we record a FAILED car_imports row with the count created so far,
 * then surface the error.
 */
export async function importTruckTripsAction(
  input: unknown,
): Promise<ActionResult<{ count: number; month?: string }>> {
  return runAction(async () => {
    const actor = await getCurrentUser();
    requireRole(actor.role, ['ADMIN', 'MANAGER']);
    await requireFleet(actor, 'TRUCK');
    const dto = importTruckTripsSchema.parse(input);

    /* Financial period lock (QA 2026-07). Imports previously bypassed the
     * month-close guard every other trip mutation enforces — rows could land in
     * a closed (month × region) and silently change finalized P&L. Resolve the
     * vehicle's region (ent-scoped; also validates ownership) and check each
     * distinct month of the file BEFORE inserting anything. */
    const vehicle = await db.query.carVehicles.findFirst({
      where: and(
        eq(carVehicles.cvhId, dto.vehicle_id),
        eq(carVehicles.entId, actor.entId),
        isNull(carVehicles.cvhDeletedAt),
      ),
      columns: { cvhRegion: true },
    });
    if (!vehicle) throw new CarError('CAR-E0404', 404, 'Vehicle not found');
    /* Normalise every date up front (BUG-260824). The UI already sends
     * `YYYY-MM-DD`, but a row that slips through unparseable used to reach
     * `new Date(...)` and blow up as CAR-E0500 ("Invalid time value") halfway
     * into the loop — after some trips had been created. Reject the whole file
     * with a message naming the row instead; nothing is written. */
    const dates: string[] = dto.rows.map((row, i) => {
      const parsed = parseImportDate(row.date);
      if (!parsed) {
        throw new CarError(
          'CAR-E0001',
          400,
          `Row ${i + 2}: unreadable date "${String(row.date)}" — use dd/MM/yyyy or YYYY-MM-DD`,
        );
      }
      return parsed;
    });

    const months = new Map<string, Date>(); // YYYY-MM → a date within it
    for (const iso of dates) {
      const key = iso.slice(0, 7);
      if (!months.has(key)) months.set(key, new Date(`${iso}T00:00:00.000Z`));
    }
    for (const d of months.values()) {
      await assertTruckMonthOpen(actor.entId, d, vehicle.cvhRegion);
    }
    /* Latest month in the file — the post-import deep-link target ("rồi sao
     * nữa": land the user on the trip log filtered to what they just loaded). */
    const month = [...months.keys()].sort().pop();

    let created = 0;
    try {
      for (const [i, row] of dto.rows.entries()) {
        /* Normalised above — never the raw cell text. */
        const isoDate = dates[i]!;
        /* "Điểm ghé" (waypoint) → give the trip a proper PICKUP → WAYPOINT →
         * DELIVERY route (matching the manual trip form) so the stop isn't
         * dropped. Only when present; rows without it keep the flat
         * pickup/dropoff addresses only, exactly as before. */
        const stopovers = row.stopover?.trim()
          ? [
              { type: 'PICKUP' as const, address: row.pickup?.trim() || '-' },
              { type: 'WAYPOINT' as const, address: row.stopover.trim() },
              { type: 'DELIVERY' as const, address: row.dropoff?.trim() || '-' },
            ]
          : undefined;
        let trip;
        for (let attempt = 0; attempt < 3; attempt++) {
          const ref = await nextTripRef(actor.entId);
          try {
            trip = await createTruckTrip(actor, {
              ref,
              scheduledAt: new Date(`${isoDate}T00:00:00.000Z`),
              vehicleId: dto.vehicle_id,
              driverId: dto.driver_id,
              customer: row.customer ?? null,
              pickupAddress: row.pickup?.trim() || '-',
              dropoffAddress: row.dropoff?.trim() || '-',
              bol: row.bol ?? null,
              cdf: row.cdf ?? null,
              fuelPrice: row.fuel_price ?? null,
              revenue: row.revenue ?? null,
              startOdometer: row.odo_start ?? null,
              stopovers,
            });
            break;
          } catch (err) {
            if (isUniqueViolation(err) && attempt < 2) continue;
            throw err;
          }
        }
        if (!trip) throw new CarError('CAR-E0500', 500, 'Import: trip create failed');

        const extraCosts =
          row.other_amount && row.other_amount > 0
            ? [{ name: row.other_note?.trim() || 'Other', amount: row.other_amount }]
            : [];
        await completeTruckTrip(actor, trip.trpId, {
          /* Keep the sheet's Giờ bắt đầu / Giờ kết thúc as the trip's actual
           * start/end (trpStartedAt/trpEndedAt), matching the manual complete
           * flow — previously dropped (end defaulted to import time). */
          startedAt: combineDateTime(isoDate, row.start_time),
          finishedAt: combineDateTime(isoDate, row.end_time),
          endOdometer: row.odo_end ?? null,
          fuelLiters: row.fuel_liters ?? null,
          tollFee: row.toll ?? null,
          extraCosts,
        });
        created += 1;
      }
    } catch (err) {
      await db.insert(carImports).values({
        impId: randomUUID(),
        entId: actor.entId,
        impFileName: dto.file_name,
        impVehicleId: dto.vehicle_id,
        impRowCount: created,
        impStatus: 'FAILED',
        impError: err instanceof Error ? err.message : 'import error',
        impCreatedBy: actor.userId,
      });
      throw err;
    }

    await db.insert(carImports).values({
      impId: randomUUID(),
      entId: actor.entId,
      impFileName: dto.file_name,
      impVehicleId: dto.vehicle_id,
      impRowCount: created,
      impStatus: 'COMPLETED',
      impCreatedBy: actor.userId,
    });

    await logAudit({
      entId: actor.entId,
      userId: actor.userId,
      action: 'TRUCK_IMPORT.RUN',
      entity: 'Vehicle',
      entityId: dto.vehicle_id,
      after: { fileName: dto.file_name, count: created },
    });

    revalidatePath('/truck/trips');
    revalidatePath('/truck/import');
    return { count: created, month };
  });
}
