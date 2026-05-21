'use server';
import { randomUUID } from 'node:crypto';
import { and, eq, isNull } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { db } from '@car-v2/db/client';
import {
  carDrivers,
  carTrips,
  carTripStopovers,
  carUsers,
  type CarTrip,
} from '@car-v2/db/schema';
import { CarError, type ActionResult } from '@car-v2/shared/errors';
import {
  assignTripSchema,
  cancelTripSchema,
  createTripSchema,
  endTripSchema,
  rejectTripSchema,
  startTripSchema,
  updateTripSchema,
} from '@car-v2/shared/zod';
import { getCurrentUser, requireRole, type AuthContext } from '@/lib/auth/get-current-user';
import { logAudit } from '@/server/services/audit-log.service';
import { buildGoogleMapsUrl } from '@/server/services/google-maps-url.service';
import { notifyUser } from '@/server/services/notification.service';
import { nextTripRef } from '@/server/services/trip-ref.service';
import { transitionTrip, type TransitionPayload } from '@/server/services/trip-state-machine.service';
import { runAction } from '../_helpers';

/* ─── Create ───────────────────────────────────────────────────────────── */

export async function createTripAction(input: unknown): Promise<ActionResult<CarTrip>> {
  return runAction(async () => {
    const actor = await getCurrentUser();
    requireRole(actor.role, ['ADMIN', 'MANAGER']);
    const data = createTripSchema.parse(input);

    const scheduledAt = new Date(data.scheduled_at);
    if (Number.isNaN(scheduledAt.getTime())) {
      throw new CarError('CAR-E0001', 400, 'Invalid scheduled_at');
    }
    // Managers cannot schedule in the past (Admin override OK).
    if (actor.role === 'MANAGER' && scheduledAt.getTime() < Date.now() - 60_000) {
      throw new CarError('CAR-E0001', 400, 'Cannot schedule a trip in the past');
    }

    if (data.driver_id && !data.vehicle_id) {
      throw new CarError('CAR-E0001', 400, 'Provide both driver and vehicle, or neither');
    }
    if (!data.driver_id && data.vehicle_id) {
      throw new CarError('CAR-E0001', 400, 'Provide both driver and vehicle, or neither');
    }

    const ref = await nextTripRef(actor.entId);
    const tripId = randomUUID();
    const stopovers = data.stopovers ?? [];
    const gmapsUrl = buildGoogleMapsUrl({
      pickup: data.pickup_address,
      dropoff: data.dropoff_address,
      stopovers,
    });

    const initialStatus =
      data.driver_id && data.vehicle_id ? 'PENDING_DRIVER_CONFIRMATION' : 'PENDING_ASSIGNMENT';

    const [created] = await db
      .insert(carTrips)
      .values({
        trpId: tripId,
        entId: actor.entId,
        trpRef: ref,
        trpCreatorId: actor.userId,
        trpPassengerId: data.passenger_id ?? actor.userId,
        trpDriverId: data.driver_id ?? null,
        trpVehicleId: data.vehicle_id ?? null,
        trpStatus: initialStatus,
        trpPickupAddress: data.pickup_address,
        trpDropoffAddress: data.dropoff_address,
        trpScheduledAt: scheduledAt,
        trpDurationMinutes: data.duration_minutes ?? null,
        trpPurpose: data.purpose ?? null,
        trpNotes: data.notes ?? null,
        trpGoogleMapsUrl: gmapsUrl,
      })
      .returning();
    if (!created) throw new CarError('CAR-E0500', 500, 'Insert returned no row');

    /* Insert stopovers (max 3 enforced by Zod). */
    if (stopovers.length > 0) {
      await db.insert(carTripStopovers).values(
        stopovers.map((address, i) => ({
          tstId: randomUUID(),
          entId: actor.entId,
          tstTripId: tripId,
          tstAddress: address,
          tstOrder: i,
        })),
      );
    }

    await logAudit({
      entId: actor.entId,
      userId: actor.userId,
      action: 'TRIP.CREATE',
      entity: 'Trip',
      entityId: created.trpId,
      entityRef: created.trpRef,
      after: {
        status: created.trpStatus,
        pickup: created.trpPickupAddress,
        dropoff: created.trpDropoffAddress,
      },
    });

    /* PRD R-10 + §13.1: */
    if (created.trpDriverId) {
      /* Pre-assigned → notify driver directly. */
      const driver = await db.query.carDrivers.findFirst({
        where: eq(carDrivers.drvId, created.trpDriverId),
      });
      if (driver) {
        await notifyUser({
          entId: actor.entId,
          userId: driver.drvUserId,
          event: 'TRIP.ASSIGNED',
          title: `New trip ${created.trpRef}`,
          body: `${created.trpPickupAddress} → ${created.trpDropoffAddress}`,
          entityId: created.trpId,
          entityRef: created.trpRef,
        });
      }
    } else {
      /* No driver yet → notify all Admins so someone can assign. */
      const admins = await db
        .select({ id: carUsers.usrId })
        .from(carUsers)
        .where(
          and(
            eq(carUsers.entId, actor.entId),
            eq(carUsers.usrLocalRole, 'ADMIN'),
            isNull(carUsers.usrDeletedAt),
          ),
        );
      await Promise.all(
        admins
          .filter((a) => a.id !== actor.userId) // don't notify yourself
          .map((a) =>
            notifyUser({
              entId: actor.entId,
              userId: a.id,
              event: 'TRIP.NEEDS_ASSIGNMENT',
              title: `${created.trpRef} needs a driver`,
              body: `${created.trpPickupAddress} → ${created.trpDropoffAddress}`,
              entityId: created.trpId,
              entityRef: created.trpRef,
            }),
          ),
      );
    }

    revalidatePath('/trips');
    revalidatePath('/today');
    return created;
  });
}

/* ─── Update (pre-confirm fields) ──────────────────────────────────────── */

export async function updateTripAction(id: string, input: unknown): Promise<ActionResult<CarTrip>> {
  return runAction(async () => {
    const actor = await getCurrentUser();
    const data = updateTripSchema.parse(input);

    const existing = await db.query.carTrips.findFirst({
      where: and(
        eq(carTrips.trpId, id),
        eq(carTrips.entId, actor.entId),
        isNull(carTrips.trpDeletedAt),
      ),
    });
    if (!existing) throw new CarError('CAR-E1004', 404, 'Trip not found');

    /* Manager may edit only own trip pre-confirm. Admin may edit if not COMPLETED. */
    if (actor.role === 'MANAGER') {
      if (existing.trpCreatorId !== actor.userId) {
        throw new CarError('CAR-E1005', 403, 'Not your trip');
      }
      if (
        existing.trpStatus !== 'PENDING_ASSIGNMENT' &&
        existing.trpStatus !== 'PENDING_DRIVER_CONFIRMATION'
      ) {
        throw new CarError('CAR-E1006', 409, 'Trip already confirmed — only Admin can edit now');
      }
    } else if (actor.role === 'ADMIN') {
      if (existing.trpStatus === 'COMPLETED') {
        throw new CarError('CAR-E1006', 409, 'Completed trip cannot be edited');
      }
    } else {
      throw new CarError('CAR-E1005', 403, 'Driver cannot edit trip details');
    }

    const patch: Partial<typeof carTrips.$inferInsert> = { trpUpdatedAt: new Date() };
    /* PRD FR-1.3: Manager cannot change passenger after creation. Admin may. */
    if (data.passenger_id !== undefined) {
      if (actor.role === 'MANAGER' && data.passenger_id !== existing.trpPassengerId) {
        throw new CarError('CAR-E1005', 403, 'Manager cannot change passenger after creation');
      }
      patch.trpPassengerId = data.passenger_id;
    }
    if (data.pickup_address !== undefined) patch.trpPickupAddress = data.pickup_address;
    if (data.dropoff_address !== undefined) patch.trpDropoffAddress = data.dropoff_address;
    if (data.scheduled_at !== undefined) patch.trpScheduledAt = new Date(data.scheduled_at);
    if (data.duration_minutes !== undefined) patch.trpDurationMinutes = data.duration_minutes;
    if (data.purpose !== undefined) patch.trpPurpose = data.purpose;
    if (data.notes !== undefined) patch.trpNotes = data.notes;

    /* If pickup/dropoff changed, rebuild gmaps URL. */
    if (data.pickup_address !== undefined || data.dropoff_address !== undefined) {
      patch.trpGoogleMapsUrl = buildGoogleMapsUrl({
        pickup: data.pickup_address ?? existing.trpPickupAddress,
        dropoff: data.dropoff_address ?? existing.trpDropoffAddress,
      });
    }

    const [updated] = await db
      .update(carTrips)
      .set(patch)
      .where(and(eq(carTrips.trpId, id), eq(carTrips.entId, actor.entId)))
      .returning();
    if (!updated) throw new CarError('CAR-E0500', 500, 'Update returned no row');

    await logAudit({
      entId: actor.entId,
      userId: actor.userId,
      action: 'TRIP.UPDATE',
      entity: 'Trip',
      entityId: updated.trpId,
      entityRef: updated.trpRef,
      after: { fields: Object.keys(patch).filter((k) => k !== 'trpUpdatedAt') },
    });

    revalidatePath('/trips');
    revalidatePath(`/trips/${id}`);
    return updated;
  });
}

/* ─── State transitions (thin wrappers around transitionTrip) ──────────── */

export async function assignTripAction(id: string, input: unknown): Promise<ActionResult<CarTrip>> {
  return runAction(async () => {
    const actor = await getCurrentUser();
    const data = assignTripSchema.parse(input);
    const trip = await loadTrip(id, actor);
    const transition = trip.trpStatus === 'REJECTED_BY_DRIVER' ? 'reassign' : 'assign';
    const updated = await transitionTrip(id, transition, actor, {
      kind: transition,
      driverId: data.driver_id,
      vehicleId: data.vehicle_id,
    } as TransitionPayload);
    revalidatePathsForTrip(id);
    return updated;
  });
}

export async function acceptTripAction(id: string): Promise<ActionResult<CarTrip>> {
  return runAction(async () => {
    const actor = await getCurrentUser();
    await assertActorIsAssignedDriver(id, actor);
    const updated = await transitionTrip(id, 'accept', actor, { kind: 'accept' });
    revalidatePathsForTrip(id);
    return updated;
  });
}

export async function rejectTripAction(id: string, input: unknown): Promise<ActionResult<CarTrip>> {
  return runAction(async () => {
    const actor = await getCurrentUser();
    await assertActorIsAssignedDriver(id, actor);
    const data = rejectTripSchema.parse(input);
    const updated = await transitionTrip(id, 'reject', actor, { kind: 'reject', reason: data.reason });
    revalidatePathsForTrip(id);
    return updated;
  });
}

export async function startTripAction(id: string, input: unknown): Promise<ActionResult<CarTrip>> {
  return runAction(async () => {
    const actor = await getCurrentUser();
    /* Driver must own the trip; Admin may override (PRD §12). */
    if (actor.role === 'DRIVER') await assertActorIsAssignedDriver(id, actor);
    const data = startTripSchema.parse(input ?? {});
    const updated = await transitionTrip(id, 'start', actor, {
      kind: 'start',
      startOdometer: data.start_odometer,
    });
    revalidatePathsForTrip(id);
    return updated;
  });
}

export async function endTripAction(id: string, input: unknown): Promise<ActionResult<CarTrip>> {
  return runAction(async () => {
    const actor = await getCurrentUser();
    if (actor.role === 'DRIVER') await assertActorIsAssignedDriver(id, actor);
    const data = endTripSchema.parse(input ?? {});
    const updated = await transitionTrip(id, 'end', actor, {
      kind: 'end',
      endOdometer: data.end_odometer,
    });
    revalidatePathsForTrip(id);
    return updated;
  });
}

export async function cancelTripAction(id: string, input: unknown): Promise<ActionResult<CarTrip>> {
  return runAction(async () => {
    const actor = await getCurrentUser();
    const data = cancelTripSchema.parse(input ?? {});
    const updated = await transitionTrip(id, 'cancel', actor, {
      kind: 'cancel',
      reason: data.reason,
    });
    revalidatePathsForTrip(id);
    return updated;
  });
}

/* ─── Helpers ──────────────────────────────────────────────────────────── */

async function loadTrip(id: string, actor: AuthContext): Promise<CarTrip> {
  const trip = await db.query.carTrips.findFirst({
    where: and(
      eq(carTrips.trpId, id),
      eq(carTrips.entId, actor.entId),
      isNull(carTrips.trpDeletedAt),
    ),
  });
  if (!trip) throw new CarError('CAR-E1004', 404, 'Trip not found');
  return trip;
}

/**
 * For driver-initiated transitions, the actor must be the assigned driver.
 * The state machine already ensures role === DRIVER; this adds the ownership check.
 */
async function assertActorIsAssignedDriver(id: string, actor: AuthContext): Promise<void> {
  if (actor.role !== 'DRIVER') {
    throw new CarError('CAR-E1005', 403, 'Only the assigned driver can do this');
  }
  const trip = await loadTrip(id, actor);
  if (!trip.trpDriverId) {
    throw new CarError('CAR-E1005', 403, 'Trip has no assigned driver');
  }
  const driver = await db.query.carDrivers.findFirst({
    where: eq(carDrivers.drvId, trip.trpDriverId),
  });
  if (!driver || driver.drvUserId !== actor.userId) {
    throw new CarError('CAR-E1005', 403, 'You are not the assigned driver');
  }
}

function revalidatePathsForTrip(id: string) {
  revalidatePath('/trips');
  revalidatePath(`/trips/${id}`);
  revalidatePath('/today');
  revalidatePath('/');
}
