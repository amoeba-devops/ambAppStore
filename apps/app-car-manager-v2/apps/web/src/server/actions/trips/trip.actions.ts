'use server';
import { randomUUID } from 'node:crypto';
import { and, eq, inArray, isNull } from 'drizzle-orm';
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
  fetchCalendarRangeSchema,
  rejectTripSchema,
  startTripSchema,
  updateTripSchema,
} from '@car-v2/shared/zod';
import { getCurrentUser, requireRole, type AuthContext } from '@/lib/auth/get-current-user';
import { listTripsForCalendar, type TripListItem } from '@/server/queries/trips.queries';
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

    if (data.driver_id && !data.vehicle_id) {
      throw new CarError('CAR-E0001', 400, 'Provide both driver and vehicle, or neither');
    }
    if (!data.driver_id && data.vehicle_id) {
      throw new CarError('CAR-E0001', 400, 'Provide both driver and vehicle, or neither');
    }

    const tripId = randomUUID();
    const stopovers = data.stopovers ?? [];
    const gmapsUrl = buildGoogleMapsUrl({
      pickup: data.pickup_address,
      dropoff: data.dropoff_address,
      stopovers,
    });

    const initialStatus =
      data.driver_id && data.vehicle_id ? 'PENDING_DRIVER_CONFIRMATION' : 'PENDING_ASSIGNMENT';

    /* Retry-on-conflict — `nextTripRef` uses non-atomic MAX read so two parallel
     * creators can race to the same TR-NNNN. Postgres unique constraint catches
     * the collision (23505); we regenerate + retry up to 3 times. After 3
     * attempts the contention is probably structural and we surface as 500. */
    let created: CarTrip | undefined;
    let ref = '';
    for (let attempt = 0; attempt < 3; attempt++) {
      ref = await nextTripRef(actor.entId);
      try {
        const inserted = await db
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
        created = inserted[0];
        break;
      } catch (err) {
        const pgCode = (err as { code?: string }).code;
        const constraint = (err as { constraint?: string }).constraint;
        /* 23505 = unique_violation. Only retry if it's specifically the trp_ref
         * race — any other unique collision is a real bug to surface. */
        if (pgCode === '23505' && constraint === 'uniq_car_trips_ent_ref' && attempt < 2) {
          continue;
        }
        throw err;
      }
    }
    if (!created) throw new CarError('CAR-E0500', 500, 'Insert returned no row after retries');

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
    const tripRoute = `${created.trpPickupAddress} → ${created.trpDropoffAddress}`;
    const tripPath = `/trips/${created.trpId}`;
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
          body: tripRoute,
          entityId: created.trpId,
          entityRef: created.trpRef,
          template: { ref: created.trpRef, route: tripRoute, tripPath },
        });
      }
    } else {
      /* No driver yet → notify ADMIN + MANAGER (same entity) so someone can assign.
       * Pattern aligned with maintenance-alert.service which already fan-outs
       * both roles. Self-notify excluded. */
      const recipients = await db
        .select({ id: carUsers.usrId })
        .from(carUsers)
        .where(
          and(
            eq(carUsers.entId, actor.entId),
            inArray(carUsers.usrLocalRole, ['ADMIN', 'MANAGER']),
            isNull(carUsers.usrDeletedAt),
          ),
        );
      await Promise.all(
        recipients
          .filter((a) => a.id !== actor.userId) // don't notify yourself
          .map((a) =>
            notifyUser({
              entId: actor.entId,
              userId: a.id,
              event: 'TRIP.NEEDS_ASSIGNMENT',
              title: `${created.trpRef} needs a driver`,
              body: tripRoute,
              entityId: created.trpId,
              entityRef: created.trpRef,
              template: { ref: created.trpRef, route: tripRoute, tripPath },
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

    /* Staff (Admin/Manager) may edit any trip not yet completed. */
    if (actor.role !== 'ADMIN' && actor.role !== 'MANAGER') {
      throw new CarError('CAR-E1005', 403, 'Driver cannot edit trip details');
    }
    if (existing.trpStatus === 'COMPLETED') {
      throw new CarError('CAR-E1006', 409, 'Completed trip cannot be edited');
    }

    const patch: Partial<typeof carTrips.$inferInsert> = { trpUpdatedAt: new Date() };
    if (data.passenger_id !== undefined) {
      patch.trpPassengerId = data.passenger_id;
    }
    if (data.pickup_address !== undefined) patch.trpPickupAddress = data.pickup_address;
    if (data.dropoff_address !== undefined) patch.trpDropoffAddress = data.dropoff_address;
    if (data.scheduled_at !== undefined) patch.trpScheduledAt = new Date(data.scheduled_at);
    if (data.duration_minutes !== undefined) patch.trpDurationMinutes = data.duration_minutes;
    if (data.purpose !== undefined) patch.trpPurpose = data.purpose;
    if (data.notes !== undefined) patch.trpNotes = data.notes;

    /* If pickup/dropoff/stopovers changed, rebuild gmaps URL.
     * Need to fetch existing stopovers if not provided in update. */
    const stopoversChanged = data.stopovers !== undefined;
    const routeChanged = data.pickup_address !== undefined || data.dropoff_address !== undefined || stopoversChanged;

    let newStopovers: string[] | undefined;
    if (routeChanged) {
      if (stopoversChanged) {
        newStopovers = data.stopovers!.filter((s) => s.trim());
      } else {
        /* Fetch existing stopovers to preserve them in gmaps URL. */
        const existingStopovers = await db.query.carTripStopovers.findMany({
          where: eq(carTripStopovers.tstTripId, id),
          orderBy: (t, { asc }) => asc(t.tstOrder),
        });
        newStopovers = existingStopovers.map((s) => s.tstAddress);
      }
      patch.trpGoogleMapsUrl = buildGoogleMapsUrl({
        pickup: data.pickup_address ?? existing.trpPickupAddress,
        dropoff: data.dropoff_address ?? existing.trpDropoffAddress,
        stopovers: newStopovers,
      });
    }

    const [updated] = await db
      .update(carTrips)
      .set(patch)
      .where(and(eq(carTrips.trpId, id), eq(carTrips.entId, actor.entId)))
      .returning();
    if (!updated) throw new CarError('CAR-E0500', 500, 'Update returned no row');

    /* Handle stopovers CRUD — delete all existing and re-insert new ones.
     * This is simpler than diffing and handles reordering cleanly. */
    if (stopoversChanged) {
      await db.delete(carTripStopovers).where(eq(carTripStopovers.tstTripId, id));
      const trimmedStopovers = data.stopovers!.filter((s) => s.trim());
      if (trimmedStopovers.length > 0) {
        await db.insert(carTripStopovers).values(
          trimmedStopovers.map((address, i) => ({
            tstId: randomUUID(),
            entId: actor.entId,
            tstTripId: id,
            tstAddress: address.trim(),
            tstOrder: i,
          })),
        );
      }
    }

    const auditFields = Object.keys(patch).filter((k) => k !== 'trpUpdatedAt');
    if (stopoversChanged) auditFields.push('stopovers');

    await logAudit({
      entId: actor.entId,
      userId: actor.userId,
      action: 'TRIP.UPDATE',
      entity: 'Trip',
      entityId: updated.trpId,
      entityRef: updated.trpRef,
      after: { fields: auditFields },
    });

    revalidatePath('/trips');
    revalidatePath(`/trips/${id}`);
    return updated;
  });
}

/* ─── Calendar fetch ───────────────────────────────────────────────────── */

/**
 * Read-only fetch for the dashboard calendar (REQ-20260522). Wraps
 * `listTripsForCalendar` with authentication + Zod validation so the Client
 * Component orchestrator can re-fetch when the user navigates anchor/view
 * without going through a route handler.
 *
 * Gated to ADMIN/MANAGER — DRIVER doesn't have a /dashboard surface and the
 * query's role-based visibility filter would only return their own trips
 * anyway. Explicit `requireRole` here surfaces a clear 403 instead of leaking
 * an empty result.
 */
export async function fetchTripsForCalendarAction(
  input: unknown,
): Promise<ActionResult<TripListItem[]>> {
  return runAction(async () => {
    const actor = await getCurrentUser();
    requireRole(actor.role, ['ADMIN', 'MANAGER']);
    const data = fetchCalendarRangeSchema.parse(input);
    return listTripsForCalendar({
      entId: actor.entId,
      role: actor.role,
      userId: actor.userId,
      rangeStart: new Date(data.range_start),
      rangeEnd: new Date(data.range_end),
    });
  });
}

/* ─── State transitions (thin wrappers around transitionTrip) ──────────── */

export async function assignTripAction(id: string, input: unknown): Promise<ActionResult<CarTrip>> {
  return runAction(async () => {
    const actor = await getCurrentUser();
    requireRole(actor.role, ['ADMIN', 'MANAGER']);
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
    /* Manager may cancel own trip; Admin may cancel any. State machine
     * enforces ownership for MANAGER role — this just blocks DRIVER. */
    requireRole(actor.role, ['ADMIN', 'MANAGER']);
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
