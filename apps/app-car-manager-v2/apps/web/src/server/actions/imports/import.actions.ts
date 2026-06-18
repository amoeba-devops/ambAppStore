'use server';

import { randomUUID } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { db } from '@car-v2/db/client';
import { carImports } from '@car-v2/db/schema';
import { createTruckTrip, completeTruckTrip } from '@car-v2/core/truck';
import { CarError, type ActionResult } from '@car-v2/shared/errors';
import { importTruckTripsSchema } from '@car-v2/shared/zod';
import { getCurrentUser, requireRole } from '@/lib/auth/get-current-user';
import { requireFleet } from '@/lib/auth/fleet-access';
import { nextTripRef } from '@/server/services/trip-ref.service';
import { logAudit } from '@/server/services/audit-log.service';
import { runAction } from '../_helpers';

function isUniqueViolation(err: unknown): boolean {
  return typeof err === 'object' && err !== null && (err as { code?: string }).code === '23505';
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
export async function importTruckTripsAction(input: unknown): Promise<ActionResult<{ count: number }>> {
  return runAction(async () => {
    const actor = await getCurrentUser();
    requireRole(actor.role, ['ADMIN', 'MANAGER']);
    await requireFleet(actor, 'TRUCK');
    const dto = importTruckTripsSchema.parse(input);

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
    return { count: created };
  });
}
