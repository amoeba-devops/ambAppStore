'use server';

import { and, eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { db } from '@car-v2/db/client';
import { carTrips, carTripStopovers } from '@car-v2/db/schema';
import { updateStopoverSchema } from '@car-v2/shared/zod';
import { CarError, type ActionResult } from '@car-v2/shared/errors';
import { getCurrentUser, requireRole } from '@/lib/auth/get-current-user';
import { requireFleet } from '@/lib/auth/fleet-access';
import { getDriverByUserId } from '@/server/queries/drivers.queries';
import { runAction } from '../_helpers';

/**
 * Driver real-time stopover update (REQ-20260623).
 * Only the driver assigned to the trip may update its stopovers.
 * Updates km + arrived_at + notes only — address/type are immutable after create.
 */
export async function updateStopoverAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    const actor = await getCurrentUser();
    requireRole(actor.role, ['DRIVER', 'ADMIN', 'MANAGER']);
    await requireFleet(actor, 'TRUCK');

    const dto = updateStopoverSchema.parse(input);

    /* Load the trip and verify ownership when caller is a DRIVER. */
    const trip = await db.query.carTrips.findFirst({
      where: and(eq(carTrips.trpId, dto.trip_id), eq(carTrips.entId, actor.entId)),
      columns: { trpDriverId: true, trpStatus: true, trpKind: true },
    });
    if (!trip || trip.trpKind !== 'LOG') {
      throw new CarError('CAR-E1004', 404, 'Trip not found');
    }

    if (actor.role === 'DRIVER') {
      const driver = await getDriverByUserId(actor.entId, actor.userId);
      if (!driver || trip.trpDriverId !== driver.drvId) {
        throw new CarError('CAR-E0403', 403, 'Not your trip');
      }
    }

    /* Verify the stopover belongs to the trip. */
    const stopover = await db.query.carTripStopovers.findFirst({
      where: and(
        eq(carTripStopovers.tstId, dto.stopover_id),
        eq(carTripStopovers.tstTripId, dto.trip_id),
        eq(carTripStopovers.entId, actor.entId),
      ),
      columns: { tstId: true },
    });
    if (!stopover) throw new CarError('CAR-E1004', 404, 'Stopover not found');

    await db
      .update(carTripStopovers)
      .set({
        tstKm: dto.km ?? null,
        tstArrivedAt: dto.arrived_at ? new Date(dto.arrived_at) : null,
        tstNotes: dto.notes ?? null,
      })
      .where(
        and(
          eq(carTripStopovers.tstId, dto.stopover_id),
          eq(carTripStopovers.entId, actor.entId),
        ),
      );

    revalidatePath(`/today/truck/${dto.trip_id}`);
    revalidatePath(`/truck/trips/${dto.trip_id}`);
    revalidatePath(`/trips/${dto.trip_id}`);

    return { id: dto.stopover_id };
  });
}
