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
import {
  collectConflictIds,
  findTripConflicts,
  hasAnyConflict,
  type ConflictResult,
} from '@/server/services/trip-conflict.service';
import { transitionTrip, type TransitionPayload } from '@/server/services/trip-state-machine.service';
import { runAction } from '../_helpers';

/**
 * Soft-warning conflict logging (PRD R-1, R-2 — R3 mode).
 * Caller phát hiện conflict server-side rồi audit log riêng. Không block save.
 * `acknowledged` = trpIds mà UI đã gửi qua (admin đã thấy banner). Detected
 * mismatch (server thấy thêm) vẫn được ghi để truy vết.
 */
async function auditConflictOverrideIfAny(
  actor: AuthContext,
  trip: { trpId: string; trpRef: string },
  conflicts: ConflictResult,
  acknowledged: string[] | undefined,
  context: 'CREATE' | 'UPDATE' | 'ASSIGN',
): Promise<void> {
  if (!hasAnyConflict(conflicts)) return;
  const detected = collectConflictIds(conflicts);
  await logAudit({
    entId: actor.entId,
    userId: actor.userId,
    action: 'TRIP.CONFLICT_OVERRIDDEN',
    entity: 'Trip',
    entityId: trip.trpId,
    entityRef: trip.trpRef,
    after: {
      context,
      detectedConflicts: detected,
      acknowledgedConflicts: acknowledged ?? [],
      vehicleConflicts: conflicts.vehicle.map((c) => c.trpId),
      driverConflicts: conflicts.driver.map((c) => c.trpId),
    },
  });
}

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

    const tripId = randomUUID();
    const stopovers = data.stopovers ?? [];
    const gmapsUrl = buildGoogleMapsUrl({
      pickup: data.pickup_address,
      dropoff: data.dropoff_address,
      stopovers,
    });

    const initialStatus =
      data.driver_id && data.vehicle_id ? 'PENDING_DRIVER_CONFIRMATION' : 'PENDING_ASSIGNMENT';

    /* PRD R-1/R-2 R3: soft-warning. Detect conflicts trước khi insert; nếu
     * có và admin/manager đã ack qua UI → save anyway, audit log riêng. */
    const conflicts = await findTripConflicts({
      entId: actor.entId,
      vehicleId: data.vehicle_id ?? null,
      driverId: data.driver_id ?? null,
      scheduledAt,
      durationMinutes: data.duration_minutes ?? null,
    });

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

    await auditConflictOverrideIfAny(actor, created, conflicts, data.acknowledged_conflicts, 'CREATE');

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

    /* PRD R-1/R-2 R3: re-check conflicts khi đổi time hoặc duration. Exclude
     * chính trip này khỏi candidate set. Driver/Vehicle giữ nguyên (update
     * không cho đổi 2 field này — phải qua assignTripAction). */
    const timeChanged =
      data.scheduled_at !== undefined || data.duration_minutes !== undefined;
    const updateConflicts =
      timeChanged && existing.trpDriverId && existing.trpVehicleId
        ? await findTripConflicts({
            entId: actor.entId,
            vehicleId: existing.trpVehicleId,
            driverId: existing.trpDriverId,
            scheduledAt: patch.trpScheduledAt ?? existing.trpScheduledAt,
            durationMinutes:
              patch.trpDurationMinutes !== undefined
                ? patch.trpDurationMinutes
                : existing.trpDurationMinutes,
            excludeTripId: id,
          })
        : null;

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

    if (updateConflicts) {
      await auditConflictOverrideIfAny(
        actor,
        updated,
        updateConflicts,
        data.acknowledged_conflicts,
        'UPDATE',
      );
    }

    revalidatePath('/trips');
    revalidatePath(`/trips/${id}`);
    return updated;
  });
}

/* ─── State transitions (thin wrappers around transitionTrip) ──────────── */

export async function assignTripAction(id: string, input: unknown): Promise<ActionResult<CarTrip>> {
  return runAction(async () => {
    const actor = await getCurrentUser();
    /* Admin-only at entry — state machine also gates, but explicit check
     * keeps the API contract obvious and gives a clear 403 error. */
    requireRole(actor.role, ['ADMIN']);
    const data = assignTripSchema.parse(input);
    const trip = await loadTrip(id, actor);

    /* PRD R-1/R-2 R3: re-check conflicts ngay trước assign (driver/vehicle
     * mới) — admin có thể đã thấy banner ở dialog, nhưng state có thể đổi
     * giữa thời gian fetch và submit. Audit log mọi override. */
    const conflicts = await findTripConflicts({
      entId: actor.entId,
      vehicleId: data.vehicle_id,
      driverId: data.driver_id,
      scheduledAt: trip.trpScheduledAt,
      durationMinutes: trip.trpDurationMinutes,
      excludeTripId: id,
    });

    const transition = trip.trpStatus === 'REJECTED_BY_DRIVER' ? 'reassign' : 'assign';
    const updated = await transitionTrip(id, transition, actor, {
      kind: transition,
      driverId: data.driver_id,
      vehicleId: data.vehicle_id,
    } as TransitionPayload);

    await auditConflictOverrideIfAny(actor, updated, conflicts, data.acknowledged_conflicts, 'ASSIGN');

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
