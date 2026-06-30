'use server';

import { randomUUID } from 'node:crypto';
import { and, eq, isNull } from 'drizzle-orm';
import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { db } from '@car-v2/db/client';
import { carTrips, carTripExtraCosts } from '@car-v2/db/schema';
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
import type { CarTrip } from '@car-v2/db/schema';
import { getCurrentUser, requireRole } from '@/lib/auth/get-current-user';
import { requireFleet } from '@/lib/auth/fleet-access';
import { getDriver, getDriverByUserId } from '@/server/queries/drivers.queries';
import type { StopoverInput } from '@car-v2/core/truck';
import { assertTruckMonthOpen } from '@/server/queries/truck-finance.queries';
import { nextTripRef } from '@/server/services/trip-ref.service';
import { logAudit } from '@/server/services/audit-log.service';
import { notifyUser } from '@/server/services/notification.service';
import { runAction } from '../_helpers';

/** Notify the assigned driver about a truck trip they must complete. */
async function notifyTruckDriverAssigned(entId: string, trip: CarTrip): Promise<void> {
  if (!trip.trpDriverId) return;
  const driver = await getDriver(entId, trip.trpDriverId);
  if (!driver) return;
  const route = `${trip.trpPickupAddress} → ${trip.trpDropoffAddress}`;
  await notifyUser({
    entId,
    userId: driver.drvUserId,
    event: 'TRUCK_TRIP.ASSIGNED',
    title: `Truck trip ${trip.trpRef}`,
    body: route,
    entityId: trip.trpId,
    entityRef: trip.trpRef,
    template: { ref: trip.trpRef, route, tripPath: `/trips/${trip.trpId}` },
  });
}

/** Notify the trip creator (manager) that a truck trip was completed. */
async function notifyTruckTripCompleted(entId: string, actorUserId: string, trip: CarTrip): Promise<void> {
  if (trip.trpCreatorId === actorUserId) return;
  const route = `${trip.trpPickupAddress} → ${trip.trpDropoffAddress}`;
  await notifyUser({
    entId,
    userId: trip.trpCreatorId,
    event: 'TRUCK_TRIP.COMPLETED',
    title: `${trip.trpRef} completed`,
    body: route,
    entityId: trip.trpId,
    entityRef: trip.trpRef,
    template: { ref: trip.trpRef, route, tripPath: `/trips/${trip.trpId}` },
  });
}

/** Postgres unique_violation — used to retry trip-ref generation on collision. */
function isUniqueViolation(err: unknown): boolean {
  return typeof err === 'object' && err !== null && (err as { code?: string }).code === '23505';
}

/**
 * Create a truck trip-log entry.
 *
 * - ADMIN/MANAGER: full access, can assign any driver + set revenue.
 * - DRIVER: allowed (REQ-20260623); driver_id is enforced to self; revenue is
 *   stripped (manager fills it later for month close).
 *
 * A manager may log a finished trip in one step (mark_completed=true with
 * metrics). Drivers create an open trip (CONFIRMED) and complete it separately.
 */
export async function createTruckTripAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    const actor = await getCurrentUser();
    requireRole(actor.role, ['ADMIN', 'MANAGER', 'DRIVER']);
    await requireFleet(actor, 'TRUCK');
    const dto = createTruckTripSchema.parse(input);
    await assertTruckMonthOpen(actor.entId, new Date(dto.scheduled_at));

    /* DRIVER self-assign enforcement: driver_id must be the caller's own record. */
    let enforcedDriverId = dto.driver_id ?? null;
    if (actor.role === 'DRIVER') {
      const driverRecord = await getDriverByUserId(actor.entId, actor.userId);
      if (!driverRecord) throw new CarError('CAR-E0403', 403, 'No driver record found');
      if (dto.driver_id && dto.driver_id !== driverRecord.drvId) {
        throw new CarError('CAR-E0403', 403, 'Driver may only create trips for themselves');
      }
      enforcedDriverId = driverRecord.drvId;
    }

    /* Build stopover list from DTO (REQ-20260623). */
    const stopovers: StopoverInput[] | undefined = dto.stopovers?.map((s) => ({
      type: s.type,
      address: s.address,
      km: s.km ?? null,
      arrivedAt: s.arrived_at ? new Date(s.arrived_at) : null,
      notes: s.notes ?? null,
    }));

    let trip;
    for (let attempt = 0; attempt < 3; attempt++) {
      const ref = await nextTripRef(actor.entId);
      try {
        trip = await createTruckTrip(actor, {
          ref,
          scheduledAt: new Date(dto.scheduled_at),
          vehicleId: dto.vehicle_id ?? null,
          driverId: enforcedDriverId,
          customer: dto.customer ?? null,
          pickupAddress: dto.pickup_address,
          dropoffAddress: dto.dropoff_address,
          bol: dto.bol ?? null,
          cdf: dto.cdf ?? null,
          fuelPrice: dto.fuel_price ?? null,
          /* DRIVER: strip revenue — manager fills later. */
          revenue: actor.role === 'DRIVER' ? null : (dto.revenue ?? null),
          startOdometer: dto.start_odometer ?? null,
          notes: dto.notes ?? null,
          stopovers,
        });
        break;
      } catch (err) {
        if (isUniqueViolation(err) && attempt < 2) continue;
        throw err;
      }
    }
    if (!trip) throw new CarError('CAR-E0500', 500, 'Failed to create truck trip');

    /* Log a finished trip in one step when the manager supplied metrics. */
    if (actor.role !== 'DRIVER' && dto.mark_completed && trip.trpDriverId && trip.trpVehicleId) {
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
      after: { customer: trip.trpCustomer, status: trip.trpStatus, createdByRole: actor.role },
    });

    /* Notify driver if assigned by manager (driver creating own trip: skip self-notify). */
    if (trip.trpStatus === 'CONFIRMED' && trip.trpDriverId && actor.role !== 'DRIVER') {
      await notifyTruckDriverAssigned(actor.entId, trip);
    }

    revalidatePath('/truck/trips');
    revalidatePath('/today');
    return { id: trip.trpId };
  });
}

export async function assignTruckTripAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    const actor = await getCurrentUser();
    requireRole(actor.role, ['ADMIN', 'MANAGER']);
    await requireFleet(actor, 'TRUCK');
    const dto = assignTruckTripSchema.parse(input);
    const asgTrip = await db.query.carTrips.findFirst({
      where: and(eq(carTrips.trpId, dto.trip_id), eq(carTrips.entId, actor.entId)),
      columns: { trpScheduledAt: true },
    });
    if (asgTrip) await assertTruckMonthOpen(actor.entId, asgTrip.trpScheduledAt);

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

    await notifyTruckDriverAssigned(actor.entId, trip);

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
    const finTrip = await db.query.carTrips.findFirst({
      where: and(eq(carTrips.trpId, dto.trip_id), eq(carTrips.entId, actor.entId)),
      columns: { trpScheduledAt: true },
    });
    if (finTrip) await assertTruckMonthOpen(actor.entId, finTrip.trpScheduledAt);

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

    await notifyTruckTripCompleted(actor.entId, actor.userId, res.trip);

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
    await assertTruckMonthOpen(actor.entId, trip.trpScheduledAt);

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

    await notifyTruckTripCompleted(actor.entId, actor.userId, res.trip);

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
    /* Both the trip's current month and the target month must be open — block
     * editing a trip out of (or into) a closed period. */
    const curTrip = await db.query.carTrips.findFirst({
      where: and(eq(carTrips.trpId, dto.trip_id), eq(carTrips.entId, actor.entId)),
      columns: { trpScheduledAt: true },
    });
    if (curTrip) await assertTruckMonthOpen(actor.entId, curTrip.trpScheduledAt);
    await assertTruckMonthOpen(actor.entId, new Date(dto.scheduled_at));

    const extraCosts =
      dto.other_amount && dto.other_amount > 0
        ? [{ name: dto.other_note?.trim() || 'Other', amount: dto.other_amount }]
        : [];
    const stopovers: StopoverInput[] | undefined = dto.stopovers?.map((s) => ({
      type: s.type,
      address: s.address,
      km: s.km ?? null,
      arrivedAt: s.arrived_at ? new Date(s.arrived_at) : null,
      notes: s.notes ?? null,
    }));
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
      stopovers,
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

/**
 * Cost patch for the report-review screen ("Lập báo cáo · Bước 2"). Adjusts the
 * four per-trip cost figures the design lets a manager tweak before generating
 * the report — toll, extra, fuel, revenue — on an OPEN month only. Mapping to
 * our normalized model:
 *   - toll    → trp_toll_fee (single column)
 *   - revenue → trp_revenue  (single column)
 *   - extra   → replaces the trip's car_trip_extra_costs line items with one
 *               "Phát sinh" row (the screen treats extra as a single number)
 *   - fuel    → back-computed to litres (cost ÷ unit price) so the open-month
 *               fuel = litres × price equals the entered value; needs a unit
 *               price, otherwise skipped. When the month later closes the fuel is
 *               re-derived from the month-end snapshot (km × consumption × avg).
 * Profit/cost carry no cached column (recomputed on read), so these writes stay
 * consistent across finance / P&L / dashboard / report.
 */
export async function patchTruckTripCostsAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    const actor = await getCurrentUser();
    requireRole(actor.role, ['ADMIN', 'MANAGER']);
    await requireFleet(actor, 'TRUCK');
    const dto = z
      .object({
        trip_id: z.string().uuid(),
        toll_fee: z.number().nonnegative().max(1_000_000_000).optional(),
        revenue: z.number().nonnegative().max(1_000_000_000).optional(),
        extra_amount: z.number().nonnegative().max(1_000_000_000).optional(),
        fuel_cost: z.number().nonnegative().max(1_000_000_000).optional(),
      })
      .parse(input);

    const trip = await db.query.carTrips.findFirst({
      where: and(
        eq(carTrips.trpId, dto.trip_id),
        eq(carTrips.entId, actor.entId),
        isNull(carTrips.trpDeletedAt),
      ),
      columns: { trpScheduledAt: true, trpRef: true, trpFuelPrice: true },
    });
    if (!trip) throw new CarError('CAR-E0404', 404, 'Trip not found');
    await assertTruckMonthOpen(actor.entId, trip.trpScheduledAt);

    const patch: Partial<{ trpTollFee: string; trpRevenue: string; trpFuelLiters: string }> = {};
    if (dto.toll_fee !== undefined) patch.trpTollFee = String(dto.toll_fee);
    if (dto.revenue !== undefined) patch.trpRevenue = String(dto.revenue);
    if (dto.fuel_cost !== undefined) {
      const price = Number(trip.trpFuelPrice ?? 0);
      if (price > 0) patch.trpFuelLiters = String(Math.round((dto.fuel_cost / price) * 100) / 100);
    }
    if (Object.keys(patch).length > 0) {
      await db
        .update(carTrips)
        .set(patch)
        .where(and(eq(carTrips.trpId, dto.trip_id), eq(carTrips.entId, actor.entId)));
    }

    /* Extra costs are line items — the review treats them as a single number, so
     * replace any existing rows with one "Phát sinh" line (or clear when 0). */
    if (dto.extra_amount !== undefined) {
      await db
        .delete(carTripExtraCosts)
        .where(and(eq(carTripExtraCosts.entId, actor.entId), eq(carTripExtraCosts.trpId, dto.trip_id)));
      if (dto.extra_amount > 0) {
        await db.insert(carTripExtraCosts).values({
          tecId: randomUUID(),
          entId: actor.entId,
          trpId: dto.trip_id,
          tecName: 'Phát sinh',
          tecAmount: String(dto.extra_amount),
        });
      }
    }

    await logAudit({
      entId: actor.entId,
      userId: actor.userId,
      action: 'TRUCK_TRIP.UPDATE',
      entity: 'Trip',
      entityId: dto.trip_id,
      entityRef: trip.trpRef,
      after: { tollFee: dto.toll_fee, revenue: dto.revenue, extra: dto.extra_amount, fuelCost: dto.fuel_cost },
    });
    revalidatePath('/truck/finance');
    revalidatePath('/truck/pnl');
    revalidatePath('/truck/trips');
    revalidatePath('/truck/dashboard');
    return { id: dto.trip_id };
  });
}

/** Soft-delete a truck trip-log. */
export async function deleteTruckTripAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    const actor = await getCurrentUser();
    requireRole(actor.role, ['ADMIN', 'MANAGER']);
    await requireFleet(actor, 'TRUCK');
    const dto = deleteTruckTripSchema.parse(input);
    const delTrip = await db.query.carTrips.findFirst({
      where: and(eq(carTrips.trpId, dto.trip_id), eq(carTrips.entId, actor.entId)),
      columns: { trpScheduledAt: true },
    });
    if (delTrip) await assertTruckMonthOpen(actor.entId, delTrip.trpScheduledAt);
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
