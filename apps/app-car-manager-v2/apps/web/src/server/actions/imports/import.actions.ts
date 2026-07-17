'use server';

import { randomUUID } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { and, eq, isNull } from 'drizzle-orm';
import { db } from '@car-v2/db/client';
import { carImports, carVehicles } from '@car-v2/db/schema';
import { createTruckTrip, completeTruckTrip } from '@car-v2/core/truck';
import { CarError, type ActionResult } from '@car-v2/shared/errors';
import { importTruckTripsSchema } from '@car-v2/shared/zod';
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
 * "08:30", "8:00:00") into a local Date — same frame as the manual complete
 * flow — so the sheet's start/end time is kept instead of dropped. Returns null
 * when either part is missing/unparseable (trip then keeps no start / end=now). */
function combineDateTime(dateStr: string, time: string | undefined): Date | null {
  if (!time) return null;
  const d = /^(\d{4}-\d{2}-\d{2})/.exec(dateStr.trim());
  const t = /^(\d{1,2}):(\d{2})(?::(\d{2}))?/.exec(time.trim());
  if (!d?.[1] || !t?.[1] || !t?.[2]) return null;
  const dt = new Date(`${d[1]}T${t[1].padStart(2, '0')}:${t[2]}:${t[3] ?? '00'}`);
  return Number.isNaN(dt.getTime()) ? null : dt;
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
    const months = new Map<string, Date>(); // YYYY-MM → a date within it
    for (const row of dto.rows) {
      const d = new Date(row.date);
      if (Number.isNaN(d.getTime())) continue; // unparseable rows fail later, as before
      const key = d.toISOString().slice(0, 7);
      if (!months.has(key)) months.set(key, d);
    }
    for (const d of months.values()) {
      await assertTruckMonthOpen(actor.entId, d, vehicle.cvhRegion);
    }
    /* Latest month in the file — the post-import deep-link target ("rồi sao
     * nữa": land the user on the trip log filtered to what they just loaded). */
    const month = [...months.keys()].sort().pop();

    let created = 0;
    try {
      for (const row of dto.rows) {
        let trip;
        for (let attempt = 0; attempt < 3; attempt++) {
          const ref = await nextTripRef(actor.entId);
          try {
            trip = await createTruckTrip(actor, {
              ref,
              scheduledAt: new Date(row.date),
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
          startedAt: combineDateTime(row.date, row.start_time),
          finishedAt: combineDateTime(row.date, row.end_time),
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
