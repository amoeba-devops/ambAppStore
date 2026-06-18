'use server';

import { and, eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { db } from '@car-v2/db/client';
import { carTrips } from '@car-v2/db/schema';
import {
  createTruckTrip,
  assignTruckTrip,
  completeTruckTrip,
  updateTruckTrip,
  deleteTruckTrip,
} from '@car-v2/core/truck';
import { CarError, type ActionResult } from '@car-v2/shared/errors';
import {
  createTruckTripSchema,
  assignTruckTripSchema,
  completeTruckTripSchema,
  updateTruckTripSchema,
  deleteTruckTripSchema,
} from '@car-v2/shared/zod';
import { getCurrentUser, requireRole } from '@/lib/auth/get-current-user';
import { requireFleet } from '@/lib/auth/fleet-access';
import { getDriverByUserId } from '@/server/queries/drivers.queries';
import { nextTripRef } from '@/server/services/trip-ref.service';
import { logAudit } from '@/server/services/audit-log.service';
import { runAction } from '../_helpers';

/** Postgres unique_violation — used to retry trip-ref generation on collision. */
function isUniqueViolation(err: unknown): boolean {
  return typeof err === 'object' && err !== null && (err as { code?: string }).code === '23505';
}

/**
 * Create a truck trip-log entry. A manager usually logs an already-finished
 * trip (mark_completed=true with metrics) — the action creates it (auto-CONFIRMED
 * when driver+vehicle are set) then completes it in one flow. Unassigned entries
 * can be created and assigned/completed later.
 */
export async function createTruckTripAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    const actor = await getCurrentUser();
    requireRole(actor.role, ['ADMIN', 'MANAGER']);
    await requireFleet(actor, 'TRUCK');
    const dto = createTruckTripSchema.parse(input);

    let trip;
    for (let attempt = 0; attempt < 3; attempt++) {
      const ref = await nextTripRef(actor.entId);
      try {
        trip = await createTruckTrip(actor, {
          ref,
          scheduledAt: new Date(dto.scheduled_at),
          vehicleId: dto.vehicle_id ?? null,
          driverId: dto.driver_id ?? null,
          customer: dto.customer ?? null,
          pickupAddress: dto.pickup_address,
          dropoffAddress: dto.dropoff_address,
          bol: dto.bol ?? null,
          cdf: dto.cdf ?? null,
          fuelPrice: dto.fuel_price ?? null,
          revenue: dto.revenue ?? null,
          startOdometer: dto.start_odometer ?? null,
          notes: dto.notes ?? null,
        });
        break;
      } catch (err) {
        if (isUniqueViolation(err) && attempt < 2) continue;
        throw err;
      }
    }
    if (!trip) throw new CarError('CAR-E0500', 500, 'Failed to create truck trip');

    /* Log a finished trip in one step when the manager supplied metrics. */
    if (dto.mark_completed && trip.trpDriverId && trip.trpVehicleId) {
      const extraCosts =
        dto.other_amount && dto.other_amount > 0
          ? [{ name: dto.other_note?.trim() || 'Other', amount: dto.other_amount }]
          : [];
      const res = await completeTruckTrip(actor, trip.trpId, {
        endOdometer: dto.end_odometer ?? null,
        fuelLiters: dto.fuel_liters ?? null,
        tollFee: dto.toll_fee ?? null,
        extraCosts,
      });
      trip = res.trip;
    }

    await logAudit({
      entId: actor.entId,
      userId: actor.userId,
      action: 'TRUCK_TRIP.CREATE',
      entity: 'Trip',
      entityId: trip.trpId,
      entityRef: trip.trpRef,
      after: { customer: trip.trpCustomer, status: trip.trpStatus },
    });

    revalidatePath('/truck/trips');
    return { id: trip.trpId };
  });
}

export async function assignTruckTripAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    const actor = await getCurrentUser();
    requireRole(actor.role, ['ADMIN', 'MANAGER']);
    await requireFleet(actor, 'TRUCK');
    const dto = assignTruckTripSchema.parse(input);

    const trip = await assignTruckTrip(actor, dto.trip_id, {
      driverId: dto.driver_id,
      vehicleId: dto.vehicle_id,
    });

    await logAudit({
      entId: actor.entId,
      userId: actor.userId,
      action: 'TRUCK_TRIP.ASSIGN',
      entity: 'Trip',
      entityId: trip.trpId,
      entityRef: trip.trpRef,
      after: { driverId: dto.driver_id, vehicleId: dto.vehicle_id },
    });

    revalidatePath('/truck/trips');
    revalidatePath(`/truck/trips/${trip.trpId}`);
    return { id: trip.trpId };
  });
}

/**
 * Complete / edit metrics of a truck trip. STAFF for now (manager corrections);
 * driver self-completion is wired in P-E with ownership enforcement.
 */
export async function completeTruckTripAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    const actor = await getCurrentUser();
    requireRole(actor.role, ['ADMIN', 'MANAGER']);
    await requireFleet(actor, 'TRUCK');
    const dto = completeTruckTripSchema.parse(input);

    const res = await completeTruckTrip(actor, dto.trip_id, {
      startedAt: dto.start_time ? new Date(dto.start_time) : null,
      finishedAt: dto.end_time ? new Date(dto.end_time) : null,
      endOdometer: dto.end_odometer ?? null,
      fuelLiters: dto.fuel_liters ?? null,
      tollFee: dto.toll_fee ?? null,
      extraCosts: dto.extra_costs ?? [],
    });

    await logAudit({
      entId: actor.entId,
      userId: actor.userId,
      action: 'TRUCK_TRIP.COMPLETE',
      entity: 'Trip',
      entityId: res.trip.trpId,
      entityRef: res.trip.trpRef,
      after: { profit: res.breakdown.profit, totalCost: res.breakdown.totalCost },
    });

    revalidatePath('/truck/trips');
    revalidatePath(`/truck/trips/${res.trip.trpId}`);
    return { id: res.trip.trpId };
  });
}

/**
 * Driver self-completion of their assigned truck trip (P-E). Ownership: the
 * trip's driver must be the caller's driver record. Reuses core completeTruckTrip.
 */
export async function driverCompleteTruckTripAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    const actor = await getCurrentUser();
    requireRole(actor.role, ['DRIVER']);
    await requireFleet(actor, 'TRUCK');
    const dto = completeTruckTripSchema.parse(input);

    const driver = await getDriverByUserId(actor.entId, actor.userId);
    if (!driver) throw new CarError('CAR-E0403', 403, 'Not a driver');
    const trip = await db.query.carTrips.findFirst({
      where: and(eq(carTrips.trpId, dto.trip_id), eq(carTrips.entId, actor.entId)),
    });
    if (!trip || trip.trpDriverId !== driver.drvId) {
      throw new CarError('CAR-E0403', 403, 'Not your trip');
    }

    const res = await completeTruckTrip(actor, dto.trip_id, {
      startedAt: dto.start_time ? new Date(dto.start_time) : null,
      finishedAt: dto.end_time ? new Date(dto.end_time) : null,
      endOdometer: dto.end_odometer ?? null,
      fuelLiters: dto.fuel_liters ?? null,
      tollFee: dto.toll_fee ?? null,
      extraCosts: dto.extra_costs ?? [],
    });

    await logAudit({
      entId: actor.entId,
      userId: actor.userId,
      action: 'TRUCK_TRIP.DRIVER_COMPLETE',
      entity: 'Trip',
      entityId: res.trip.trpId,
      entityRef: res.trip.trpRef,
      after: { profit: res.breakdown.profit },
    });

    revalidatePath('/today');
    revalidatePath('/trips');
    revalidatePath(`/trips/${res.trip.trpId}`);
    return { id: res.trip.trpId };
  });
}

/** Edit a truck trip-log (manager correction). */
export async function updateTruckTripAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    const actor = await getCurrentUser();
    requireRole(actor.role, ['ADMIN', 'MANAGER']);
    await requireFleet(actor, 'TRUCK');
    const dto = updateTruckTripSchema.parse(input);

    const extraCosts =
      dto.other_amount && dto.other_amount > 0
        ? [{ name: dto.other_note?.trim() || 'Other', amount: dto.other_amount }]
        : [];
    const res = await updateTruckTrip(actor, dto.trip_id, {
      scheduledAt: new Date(dto.scheduled_at),
      vehicleId: dto.vehicle_id ?? null,
      driverId: dto.driver_id ?? null,
      customer: dto.customer ?? null,
      pickupAddress: dto.pickup_address,
      dropoffAddress: dto.dropoff_address,
      bol: dto.bol ?? null,
      cdf: dto.cdf ?? null,
      fuelPrice: dto.fuel_price ?? null,
      revenue: dto.revenue ?? null,
      startOdometer: dto.start_odometer ?? null,
      endOdometer: dto.end_odometer ?? null,
      fuelLiters: dto.fuel_liters ?? null,
      tollFee: dto.toll_fee ?? null,
      extraCosts,
    });

    await logAudit({
      entId: actor.entId,
      userId: actor.userId,
      action: 'TRUCK_TRIP.UPDATE',
      entity: 'Trip',
      entityId: res.trip.trpId,
      entityRef: res.trip.trpRef,
      after: { profit: res.breakdown.profit },
    });

    revalidatePath('/truck/trips');
    revalidatePath(`/truck/trips/${res.trip.trpId}`);
    return { id: res.trip.trpId };
  });
}

/** Soft-delete a truck trip-log. */
export async function deleteTruckTripAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    const actor = await getCurrentUser();
    requireRole(actor.role, ['ADMIN', 'MANAGER']);
    await requireFleet(actor, 'TRUCK');
    const dto = deleteTruckTripSchema.parse(input);
    await deleteTruckTrip(actor, dto.trip_id);
    await logAudit({
      entId: actor.entId,
      userId: actor.userId,
      action: 'TRUCK_TRIP.DELETE',
      entity: 'Trip',
      entityId: dto.trip_id,
    });
    revalidatePath('/truck/trips');
    return { id: dto.trip_id };
  });
}
