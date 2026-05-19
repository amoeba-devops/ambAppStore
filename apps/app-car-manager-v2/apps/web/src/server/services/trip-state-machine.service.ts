import 'server-only';
import { and, eq, isNull } from 'drizzle-orm';
import { CarError } from '@car-v2/shared/errors';
import { db } from '@car-v2/db/client';
import {
  carDrivers,
  carTrips,
  carVehicles,
  type CarTrip,
  type CarTripStatus,
} from '@car-v2/db/schema';
import type { AuthContext } from '@/lib/auth/get-current-user';
import { logAudit } from './audit-log.service';
import { notifyUser } from './notification.service';

export type TripTransition =
  | 'assign'
  | 'accept'
  | 'reject'
  | 'reassign'
  | 'start'
  | 'end'
  | 'cancel';

export type TransitionPayload =
  | { kind: 'assign'; driverId: string; vehicleId: string }
  | { kind: 'reassign'; driverId: string; vehicleId: string }
  | { kind: 'accept' }
  | { kind: 'reject'; reason: string }
  | { kind: 'start'; startOdometer?: number }
  | { kind: 'end'; endOdometer?: number }
  | { kind: 'cancel'; reason?: string };

/* Allowed transitions per PRD §9.1.
 *
 *  PENDING_ASSIGNMENT          → PENDING_DRIVER_CONFIRMATION (assign)
 *                              → CANCELLED                  (cancel)
 *  PENDING_DRIVER_CONFIRMATION → CONFIRMED                  (accept)
 *                              → REJECTED_BY_DRIVER         (reject)
 *                              → CANCELLED                  (cancel by manager/admin)
 *  REJECTED_BY_DRIVER          → PENDING_DRIVER_CONFIRMATION (reassign)
 *                              → CANCELLED                  (cancel)
 *  CONFIRMED                   → IN_PROGRESS                (start)
 *                              → CANCELLED                  (cancel by admin)
 *  IN_PROGRESS                 → COMPLETED                  (end)
 *  COMPLETED                   → ✗ terminal
 *  CANCELLED                   → ✗ terminal
 */
const ALLOWED: Record<CarTripStatus, Partial<Record<TripTransition, CarTripStatus>>> = {
  PENDING_ASSIGNMENT:          { assign: 'PENDING_DRIVER_CONFIRMATION', cancel: 'CANCELLED' },
  PENDING_DRIVER_CONFIRMATION: { accept: 'CONFIRMED', reject: 'REJECTED_BY_DRIVER', cancel: 'CANCELLED' },
  REJECTED_BY_DRIVER:          { reassign: 'PENDING_DRIVER_CONFIRMATION', cancel: 'CANCELLED' },
  CONFIRMED:                   { start: 'IN_PROGRESS', cancel: 'CANCELLED' },
  IN_PROGRESS:                 { end: 'COMPLETED' },
  COMPLETED:                   {},
  CANCELLED:                   {},
};

/**
 * Transition a trip's state. THE ONLY way to change `trp_status`.
 *
 * Validates the transition is allowed for the current status, enforces role
 * + ownership permissions, applies the mutation, then writes audit + notify
 * side effects.
 *
 * @throws CarError CAR-E1004 trip not found
 * @throws CarError CAR-E1001 invalid transition
 * @throws CarError CAR-E1005 forbidden by role/ownership
 */
export async function transitionTrip(
  tripId: string,
  transition: TripTransition,
  actor: AuthContext,
  payload?: TransitionPayload,
): Promise<CarTrip> {
  /* 1. Load current trip (ent-scoped, not soft-deleted) */
  const current = await db.query.carTrips.findFirst({
    where: and(
      eq(carTrips.trpId, tripId),
      eq(carTrips.entId, actor.entId),
      isNull(carTrips.trpDeletedAt),
    ),
  });
  if (!current) {
    throw new CarError('CAR-E1004', 404, 'Trip not found');
  }

  /* 2. Validate the transition is allowed for current status. */
  const nextStatus = ALLOWED[current.trpStatus][transition];
  if (!nextStatus) {
    throw new CarError(
      'CAR-E1001',
      409,
      `Invalid transition '${transition}' from status '${current.trpStatus}'`,
    );
  }

  /* 3. Permission check — see REQ §3.7 matrix. */
  assertCanPerform(transition, current, actor);

  /* 4. Build the UPDATE payload. */
  const update: Partial<typeof carTrips.$inferInsert> = {
    trpStatus: nextStatus,
    trpUpdatedAt: new Date(),
  };

  switch (transition) {
    case 'assign':
    case 'reassign': {
      if (payload?.kind !== 'assign' && payload?.kind !== 'reassign') {
        throw new CarError('CAR-E1001', 400, 'assign/reassign requires driverId + vehicleId');
      }
      // Verify the driver/vehicle exist and belong to this tenant + are not retired.
      const [driver, vehicle] = await Promise.all([
        db.query.carDrivers.findFirst({
          where: and(
            eq(carDrivers.drvId, payload.driverId),
            eq(carDrivers.entId, actor.entId),
            isNull(carDrivers.drvDeletedAt),
          ),
        }),
        db.query.carVehicles.findFirst({
          where: and(
            eq(carVehicles.cvhId, payload.vehicleId),
            eq(carVehicles.entId, actor.entId),
            isNull(carVehicles.cvhDeletedAt),
          ),
        }),
      ]);
      if (!driver) throw new CarError('CAR-E1003', 400, 'Driver not available');
      if (!vehicle) throw new CarError('CAR-E1002', 400, 'Vehicle not available');
      if (vehicle.cvhStatus === 'RETIRED') {
        throw new CarError('CAR-E1002', 400, 'Vehicle is retired');
      }
      update.trpDriverId = payload.driverId;
      update.trpVehicleId = payload.vehicleId;
      update.trpRejectReason = null; // clear previous rejection
      break;
    }
    case 'reject': {
      if (payload?.kind !== 'reject' || !payload.reason.trim()) {
        throw new CarError('CAR-E1001', 400, 'reject requires a reason');
      }
      update.trpRejectReason = payload.reason.trim();
      break;
    }
    case 'start': {
      const startOdometer = payload?.kind === 'start' ? payload.startOdometer : undefined;
      update.trpStartedAt = new Date();
      if (startOdometer != null) update.trpStartOdometer = startOdometer;
      break;
    }
    case 'end': {
      const endOdometer = payload?.kind === 'end' ? payload.endOdometer : undefined;
      update.trpEndedAt = new Date();
      if (endOdometer != null) update.trpEndOdometer = endOdometer;
      break;
    }
    case 'cancel': {
      const reason = payload?.kind === 'cancel' ? payload.reason : undefined;
      if (reason) update.trpCancelReason = reason;
      break;
    }
    default:
      // 'accept' has no extra payload
      break;
  }

  /* 5. Apply the UPDATE. */
  const [updated] = await db
    .update(carTrips)
    .set(update)
    .where(and(eq(carTrips.trpId, tripId), eq(carTrips.entId, actor.entId)))
    .returning();
  if (!updated) {
    throw new CarError('CAR-E1004', 404, 'Trip vanished mid-transition');
  }

  /* 6. Side effects on related entities (vehicle status, driver status). */
  if (current.trpVehicleId || updated.trpVehicleId) {
    await syncVehicleStatusForTrip(updated, actor);
  }
  if (current.trpDriverId || updated.trpDriverId) {
    await syncDriverStatusForTrip(updated, actor);
  }

  /* 7. Audit log. */
  await logAudit({
    entId: actor.entId,
    userId: actor.userId,
    action: actionForTransition(transition),
    entity: 'Trip',
    entityId: updated.trpId,
    entityRef: updated.trpRef,
    before: { status: current.trpStatus },
    after: { status: updated.trpStatus, transition },
  });

  /* 8. Notifications (best-effort). */
  await notifyForTransition(transition, current, updated, actor);

  return updated;
}

function assertCanPerform(transition: TripTransition, trip: CarTrip, actor: AuthContext): void {
  switch (transition) {
    case 'assign':
    case 'reassign':
      if (actor.role !== 'ADMIN') throw new CarError('CAR-E1005', 403, 'Only ADMIN can assign');
      return;
    case 'accept':
    case 'reject':
      /* Accept/Reject is Driver-only per FR-1.2. */
      if (actor.role !== 'DRIVER') {
        throw new CarError('CAR-E1005', 403, 'Only the assigned driver can do this');
      }
      return;
    case 'start':
    case 'end': {
      /* PRD §12: Driver is the primary actor; Admin may override (e.g. when
       * driver phone died or is unreachable). Manager cannot start/end. */
      if (actor.role === 'ADMIN' || actor.role === 'DRIVER') return;
      throw new CarError('CAR-E1005', 403, 'Only the assigned driver (or Admin) can do this');
    }
    case 'cancel': {
      if (actor.role === 'ADMIN') return;
      // Manager can cancel only own pre-confirm trip
      if (
        actor.role === 'MANAGER' &&
        trip.trpCreatorId === actor.userId &&
        (trip.trpStatus === 'PENDING_ASSIGNMENT' ||
          trip.trpStatus === 'PENDING_DRIVER_CONFIRMATION')
      ) {
        return;
      }
      throw new CarError('CAR-E1005', 403, 'Not allowed to cancel');
    }
  }
}

function actionForTransition(transition: TripTransition): string {
  switch (transition) {
    case 'assign':   return 'TRIP.ASSIGN';
    case 'reassign': return 'TRIP.REASSIGN';
    case 'accept':   return 'TRIP.ACCEPT';
    case 'reject':   return 'TRIP.REJECT';
    case 'start':    return 'TRIP.START';
    case 'end':      return 'TRIP.END';
    case 'cancel':   return 'TRIP.CANCEL';
  }
}

/**
 * Vehicle status follows trip status (auto):
 *   start  → IN_USE
 *   end    → AVAILABLE
 *   cancel of IN_PROGRESS → AVAILABLE
 */
async function syncVehicleStatusForTrip(trip: CarTrip, actor: AuthContext): Promise<void> {
  if (!trip.trpVehicleId) return;
  let newStatus: 'IN_USE' | 'AVAILABLE' | null = null;
  if (trip.trpStatus === 'IN_PROGRESS') newStatus = 'IN_USE';
  else if (trip.trpStatus === 'COMPLETED' || trip.trpStatus === 'CANCELLED') newStatus = 'AVAILABLE';
  if (!newStatus) return;

  await db
    .update(carVehicles)
    .set({ cvhStatus: newStatus, cvhUpdatedAt: new Date() })
    .where(and(eq(carVehicles.cvhId, trip.trpVehicleId), eq(carVehicles.entId, actor.entId)));
}

/**
 * Driver status mirrors trip lifecycle:
 *   start → ON_TRIP, end → AVAILABLE, cancel of IN_PROGRESS → AVAILABLE
 */
async function syncDriverStatusForTrip(trip: CarTrip, actor: AuthContext): Promise<void> {
  if (!trip.trpDriverId) return;
  let newStatus: 'ON_TRIP' | 'AVAILABLE' | null = null;
  if (trip.trpStatus === 'IN_PROGRESS') newStatus = 'ON_TRIP';
  else if (trip.trpStatus === 'COMPLETED' || trip.trpStatus === 'CANCELLED') newStatus = 'AVAILABLE';
  if (!newStatus) return;

  await db
    .update(carDrivers)
    .set({ drvStatus: newStatus, drvUpdatedAt: new Date() })
    .where(and(eq(carDrivers.drvId, trip.trpDriverId), eq(carDrivers.entId, actor.entId)));
}

async function notifyForTransition(
  transition: TripTransition,
  before: CarTrip,
  after: CarTrip,
  actor: AuthContext,
): Promise<void> {
  const route = `${after.trpPickupAddress} → ${after.trpDropoffAddress}`;
  const tripPath = `/trips/${after.trpId}`;
  const baseTemplate = { ref: after.trpRef, route, tripPath };

  switch (transition) {
    case 'assign':
    case 'reassign': {
      // Notify the (new) assigned driver's user account.
      if (!after.trpDriverId) return;
      const driver = await db.query.carDrivers.findFirst({
        where: eq(carDrivers.drvId, after.trpDriverId),
      });
      if (!driver) return;
      await notifyUser({
        entId: actor.entId,
        userId: driver.drvUserId,
        event: 'TRIP.ASSIGNED',
        title: `New trip ${after.trpRef}`,
        body: route,
        entityId: after.trpId,
        entityRef: after.trpRef,
        template: baseTemplate,
      });
      return;
    }
    case 'accept':
    case 'reject':
      /* Notify the creator (manager/admin). */
      await notifyUser({
        entId: actor.entId,
        userId: before.trpCreatorId,
        event: transition === 'accept' ? 'TRIP.ACCEPTED' : 'TRIP.REJECTED',
        title: `${after.trpRef} ${transition === 'accept' ? 'confirmed' : 'rejected'}`,
        body: transition === 'reject' ? after.trpRejectReason ?? '' : undefined,
        entityId: after.trpId,
        entityRef: after.trpRef,
        template:
          transition === 'reject'
            ? { ...baseTemplate, reason: after.trpRejectReason ?? undefined }
            : baseTemplate,
      });
      return;
    case 'end':
      /* PRD §13.1: "Trip hoàn thành" → notify Manager (creator). Skip if the
       * creator IS the driver (rare edge: Admin creating + driving own trip). */
      if (before.trpCreatorId !== actor.userId) {
        await notifyUser({
          entId: actor.entId,
          userId: before.trpCreatorId,
          event: 'TRIP.COMPLETED',
          title: `${after.trpRef} completed`,
          body: route,
          entityId: after.trpId,
          entityRef: after.trpRef,
          template: baseTemplate,
        });
      }
      return;
    case 'cancel': {
      const cancelTemplate = { ...baseTemplate, reason: after.trpCancelReason ?? undefined };
      /* PRD FR-1.3 + §13.1: notify driver if trip was already confirmed/in-progress.
       * Also notify creator if Admin (not the creator) cancelled. */
      if (
        before.trpDriverId &&
        (before.trpStatus === 'CONFIRMED' || before.trpStatus === 'IN_PROGRESS')
      ) {
        const driver = await db.query.carDrivers.findFirst({
          where: eq(carDrivers.drvId, before.trpDriverId),
        });
        if (driver && driver.drvUserId !== actor.userId) {
          await notifyUser({
            entId: actor.entId,
            userId: driver.drvUserId,
            event: 'TRIP.CANCELLED',
            title: `${after.trpRef} cancelled`,
            body: after.trpCancelReason ?? undefined,
            entityId: after.trpId,
            entityRef: after.trpRef,
            template: cancelTemplate,
          });
        }
      }
      /* Notify creator unless actor IS creator (they cancelled themselves). */
      if (before.trpCreatorId !== actor.userId) {
        await notifyUser({
          entId: actor.entId,
          userId: before.trpCreatorId,
          event: 'TRIP.CANCELLED',
          title: `${after.trpRef} cancelled`,
          body: after.trpCancelReason ?? undefined,
          entityId: after.trpId,
          entityRef: after.trpRef,
          template: cancelTemplate,
        });
      }
      return;
    }
    default:
      /* start: no notify in P1 (driver is the one acting, manager will see on completion). */
      return;
  }
}
