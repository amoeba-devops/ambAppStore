import 'server-only';
import { randomUUID } from 'node:crypto';
import { and, eq, gte, isNull, sql } from 'drizzle-orm';
import {
  type AcknowledgeAlertInput,
  type ResetOilChangeInput,
} from '@car-v2/shared/zod';
import { CarError } from '@car-v2/shared/errors';
import { db } from '@car-v2/db/client';
import {
  carMaintenanceAlerts,
  carUsers,
  carVehicles,
  type CarMaintenanceAlert,
  type CarMaintenanceAlertType,
  type CarMaintenanceAlertSeverity,
  type CarVehicle,
} from '@car-v2/db/schema';
import type { AuthContext } from '@/lib/auth/get-current-user';
import { logAudit } from './audit-log.service';
import { notifyUser } from './notification.service';

/**
 * Maintenance Alert service — REQ-20260519 §3.7 + BR-10.
 *
 * Evaluator runs daily via /api/v1/cron/maintenance-alert. For each active
 * vehicle per tenant, derives oil + inspection status from vehicle columns
 * and creates alert rows IF no equivalent unresolved alert exists in the
 * last 24h (idempotency).
 *
 * Acknowledge: admin/manager dismisses the visual nudge (alert row stays for
 *   audit trace, but UI shows as "acknowledged" / de-emphasized).
 *
 * Resolve: happens automatically when an OIL expense is filed (see
 *   expense.actions.ts → submitExpenseAction, which calls resolveOpenOilAlerts
 *   below) or manually via resetOilChange. NOTE: this docstring previously
 *   pointed at a non-existent `expense.service.ts`, and the hook itself was
 *   never written — alerts could not close at all until 2026-07-28.
 */

const MS_PER_DAY = 86_400_000;
const INSPECTION_DUE_SOON_DAYS = 7;
const OIL_DUE_SOON_RATIO = 0.95;
const IDEMPOTENCY_WINDOW_MS = 24 * 60 * 60 * 1000;

interface AlertCandidate {
  type: CarMaintenanceAlertType;
  severity: CarMaintenanceAlertSeverity;
  dueAt: Date | null;
  dueKm: number | null;
}

/* ─── Evaluator (cron-callable) ───────────────────────────────────────── */

export interface EvaluatorResult {
  vehiclesScanned: number;
  alertsCreated: number;
  notificationsFanout: number;
}

export async function evaluateAllTenants(): Promise<EvaluatorResult> {
  /* Fetch all live vehicles globally; group by ent_id in memory. Cheap for
   * the expected scale (≤ a few hundred vehicles across all tenants).
   *
   * CAR only. Maintenance Alert is a car-workspace module (PRD Module 2 — oil
   * interval + đăng kiểm), and its notification deep-links to /vehicles/{id},
   * which now redirects trucks away. Trucks carry their own cost model under
   * /truck and are not serviced from this screen, so scanning them produced
   * alerts nobody owned. `vehiclesScanned` therefore counts cars only. */
  const vehicles = await db
    .select()
    .from(carVehicles)
    .where(
      and(
        eq(carVehicles.cvhType, 'CAR'),
        isNull(carVehicles.cvhDeletedAt),
        sql`${carVehicles.cvhStatus} <> 'RETIRED'`,
      ),
    );

  let alertsCreated = 0;
  let notificationsFanout = 0;
  const now = new Date();

  /* Group by tenant so we can do a single recipient fetch per ent. */
  const byTenant = new Map<string, CarVehicle[]>();
  for (const v of vehicles) {
    const list = byTenant.get(v.entId) ?? [];
    list.push(v);
    byTenant.set(v.entId, list);
  }

  for (const [entId, vehicleList] of byTenant) {
    const recipientUserIds = await loadAlertRecipients(entId);
    for (const vehicle of vehicleList) {
      const candidates = deriveAlertCandidates(vehicle, now);
      for (const cand of candidates) {
        const hasRecent = await hasRecentUnresolvedAlert(entId, vehicle.cvhId, cand.type, now);
        if (hasRecent) continue;
        const created = await insertAlert(entId, vehicle, cand);
        alertsCreated += 1;
        notificationsFanout += await fanoutAlertNotification(
          entId,
          recipientUserIds,
          vehicle,
          created,
        );
      }
    }
  }

  return { vehiclesScanned: vehicles.length, alertsCreated, notificationsFanout };
}

function deriveAlertCandidates(vehicle: CarVehicle, now: Date): AlertCandidate[] {
  const out: AlertCandidate[] = [];

  /* ── OIL ── */
  if (vehicle.cvhLastOilChangeKm != null && vehicle.cvhLastOilChangeAt) {
    const kmSince = vehicle.cvhOdometerKm - vehicle.cvhLastOilChangeKm;
    const monthsSince =
      (now.getTime() - vehicle.cvhLastOilChangeAt.getTime()) / (MS_PER_DAY * 30);
    const oilKmInt = vehicle.cvhOilIntervalKm;
    const oilMonthInt = vehicle.cvhOilIntervalMonths;

    const overdueByKm = kmSince >= oilKmInt;
    const overdueByMonth = monthsSince >= oilMonthInt;
    const dueSoonByKm = kmSince >= oilKmInt * OIL_DUE_SOON_RATIO;
    const dueSoonByMonth = monthsSince >= oilMonthInt - 0.25;

    if (overdueByKm || overdueByMonth) {
      out.push({
        type: 'OIL_OVERDUE',
        severity: 'CRITICAL',
        dueAt: null,
        dueKm: vehicle.cvhLastOilChangeKm + oilKmInt,
      });
    } else if (dueSoonByKm || dueSoonByMonth) {
      out.push({
        type: 'OIL_DUE_SOON',
        severity: 'WARNING',
        dueAt: null,
        dueKm: vehicle.cvhLastOilChangeKm + oilKmInt,
      });
    }
  }

  /* ── INSPECTION ── */
  if (vehicle.cvhNextInspectionAt) {
    const daysUntil = (vehicle.cvhNextInspectionAt.getTime() - now.getTime()) / MS_PER_DAY;
    if (daysUntil < 0) {
      out.push({
        type: 'INSPECTION_OVERDUE',
        severity: 'CRITICAL',
        dueAt: vehicle.cvhNextInspectionAt,
        dueKm: null,
      });
    } else if (daysUntil <= INSPECTION_DUE_SOON_DAYS) {
      out.push({
        type: 'INSPECTION_DUE_SOON',
        severity: 'WARNING',
        dueAt: vehicle.cvhNextInspectionAt,
        dueKm: null,
      });
    }
  }

  return out;
}

async function hasRecentUnresolvedAlert(
  entId: string,
  vehicleId: string,
  type: CarMaintenanceAlertType,
  now: Date,
): Promise<boolean> {
  const since = new Date(now.getTime() - IDEMPOTENCY_WINDOW_MS);
  const rows = await db
    .select({ id: carMaintenanceAlerts.malId })
    .from(carMaintenanceAlerts)
    .where(
      and(
        eq(carMaintenanceAlerts.entId, entId),
        eq(carMaintenanceAlerts.malVehicleId, vehicleId),
        eq(carMaintenanceAlerts.malType, type),
        isNull(carMaintenanceAlerts.malResolvedAt),
        gte(carMaintenanceAlerts.malCreatedAt, since),
      ),
    )
    .limit(1);
  return rows.length > 0;
}

async function insertAlert(
  entId: string,
  vehicle: CarVehicle,
  cand: AlertCandidate,
): Promise<CarMaintenanceAlert> {
  const [row] = await db
    .insert(carMaintenanceAlerts)
    .values({
      malId: randomUUID(),
      entId,
      malVehicleId: vehicle.cvhId,
      malType: cand.type,
      malSeverity: cand.severity,
      malDueAt: cand.dueAt,
      malDueKm: cand.dueKm,
      malCurrentOdometerKm: vehicle.cvhOdometerKm,
    })
    .returning();
  if (!row) {
    throw new CarError('CAR-E2010', 500, 'Failed to insert maintenance alert');
  }
  return row;
}

/**
 * Staff who should hear about a CAR vehicle's maintenance alert.
 *
 * CAR access is part of the condition, not just the role. These alerts only ever
 * concern CAR vehicles (`evaluateAllTenants` filters on cvh_type) and the
 * notification deep-links to `/vehicles/{id}`, which middleware bounces a
 * TRUCK-only manager away from — so without the department check we were filling
 * their inbox with dead ends. Staging had already sent 4 such notifications to
 * Lê Hoàng (MANAGER, TRUCK only), all 4 still unread.
 *
 * This is the same leak the sticky banner had; fixing the banner alone left the
 * inbox / email / push channel untouched.
 *
 * ADMIN needs no membership row — resolveFleetAccess grants them both fleets
 * implicitly, so requiring a CAR row would silence the very people who own the
 * fleet.
 */
async function loadAlertRecipients(entId: string): Promise<string[]> {
  const rows = await db
    .select({ usrId: carUsers.usrId })
    .from(carUsers)
    .where(
      and(
        eq(carUsers.entId, entId),
        isNull(carUsers.usrDeletedAt),
        sql`${carUsers.usrLocalRole} IN ('ADMIN', 'MANAGER')`,
        sql`(${carUsers.usrLocalRole} = 'ADMIN' OR EXISTS (
          SELECT 1 FROM car_user_fleet_access f
          WHERE f.usr_id = ${carUsers.usrId}
            AND f.ent_id = ${entId}
            AND f.ufa_vehicle_type = 'CAR'
            AND f.ufa_deleted_at IS NULL
        ))`,
      ),
    );
  return rows.map((r) => r.usrId);
}

async function fanoutAlertNotification(
  entId: string,
  recipientUserIds: string[],
  vehicle: CarVehicle,
  alert: CarMaintenanceAlert,
): Promise<number> {
  if (recipientUserIds.length === 0) return 0;
  const event = `MAINTENANCE.${alert.malType}` as const;
  const tripPath = `/vehicles/${vehicle.cvhId}`;
  const title = `${vehicle.cvhPlateNumber} — ${friendlyAlertLabel(alert.malType)}`;
  const body = bodyForAlert(alert, vehicle);
  await Promise.all(
    recipientUserIds.map((userId) =>
      notifyUser({
        entId,
        userId,
        event,
        title,
        body,
        entityId: vehicle.cvhId,
        entityRef: vehicle.cvhPlateNumber,
        template: { ref: vehicle.cvhPlateNumber, tripPath },
      }),
    ),
  );
  return recipientUserIds.length;
}

function friendlyAlertLabel(type: CarMaintenanceAlertType): string {
  switch (type) {
    case 'OIL_OVERDUE':
      return 'Oil change overdue';
    case 'OIL_DUE_SOON':
      return 'Oil change due soon';
    case 'INSPECTION_OVERDUE':
      return 'Inspection overdue';
    case 'INSPECTION_DUE_SOON':
      return 'Inspection due soon';
  }
}

function bodyForAlert(alert: CarMaintenanceAlert, vehicle: CarVehicle): string {
  if (alert.malType.startsWith('OIL_')) {
    const since = vehicle.cvhLastOilChangeKm ?? 0;
    const span = vehicle.cvhOdometerKm - since;
    return `${span.toLocaleString()} km since last change (interval ${vehicle.cvhOilIntervalKm.toLocaleString()} km)`;
  }
  if (alert.malType.startsWith('INSPECTION_') && alert.malDueAt) {
    return `Due ${alert.malDueAt.toISOString().slice(0, 10)}`;
  }
  return '';
}

/* ─── Auto-resolve on OIL expense ─────────────────────────────────────── */

/**
 * Filing an OIL expense means the oil was actually changed, so the vehicle's
 * open OIL_* alerts close and its oil clock restarts.
 *
 * Resolving alone would be pointless: R-8 derives the alert from
 * `cvh_odometer_km - cvh_last_oil_change_km`, so leaving the baseline behind
 * would have the next evaluator run re-raise the very same alert within 24h.
 * We therefore also advance the baseline — the expense form has no odometer
 * field, so the vehicle's CURRENT odometer is the best available reading (the
 * same quantity `resetOilChange` takes explicitly), and `occurredAt` is the
 * date the driver says the change happened.
 *
 * Best-effort: a failure here must never unwind a submitted expense — the
 * user-visible "đã ghi nhận" has to mean what it says. Mirrors how logAudit
 * swallows its own errors in the same action.
 */
export async function resolveOpenOilAlerts(
  entId: string,
  vehicleId: string,
  occurredAt: Date,
): Promise<void> {
  try {
    await db
      .update(carMaintenanceAlerts)
      .set({ malResolvedAt: new Date() })
      .where(
        and(
          eq(carMaintenanceAlerts.entId, entId),
          eq(carMaintenanceAlerts.malVehicleId, vehicleId),
          isNull(carMaintenanceAlerts.malResolvedAt),
          sql`${carMaintenanceAlerts.malType} IN ('OIL_OVERDUE','OIL_DUE_SOON')`,
        ),
      );

    await db
      .update(carVehicles)
      .set({
        cvhLastOilChangeKm: sql`${carVehicles.cvhOdometerKm}`,
        cvhLastOilChangeAt: occurredAt,
        cvhUpdatedAt: new Date(),
      })
      .where(and(eq(carVehicles.cvhId, vehicleId), eq(carVehicles.entId, entId)));
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn('[resolveOpenOilAlerts] failed (expense still recorded):', (e as Error).message);
  }
}

/* ─── Acknowledge ─────────────────────────────────────────────────────── */

export async function acknowledgeAlert(
  input: AcknowledgeAlertInput,
  actor: AuthContext,
): Promise<CarMaintenanceAlert> {
  if (actor.role !== 'ADMIN' && actor.role !== 'MANAGER') {
    throw new CarError('CAR-E0102', 403, 'Only ADMIN/MANAGER can acknowledge');
  }
  const current = await db.query.carMaintenanceAlerts.findFirst({
    where: and(
      eq(carMaintenanceAlerts.malId, input.alert_id),
      eq(carMaintenanceAlerts.entId, actor.entId),
    ),
  });
  if (!current) {
    throw new CarError('CAR-E2011', 404, 'Maintenance alert not found');
  }
  if (current.malAcknowledgedAt) {
    return current; // idempotent
  }
  const [updated] = await db
    .update(carMaintenanceAlerts)
    .set({ malAcknowledgedAt: new Date(), malAcknowledgedBy: actor.userId })
    .where(
      and(
        eq(carMaintenanceAlerts.malId, input.alert_id),
        eq(carMaintenanceAlerts.entId, actor.entId),
      ),
    )
    .returning();
  if (!updated) {
    throw new CarError('CAR-E2011', 404, 'Alert vanished during ack');
  }
  await logAudit({
    entId: actor.entId,
    userId: actor.userId,
    action: 'MAINTENANCE.ACKNOWLEDGED',
    entity: 'System',
    entityId: updated.malId,
    after: { type: updated.malType, vehicleId: updated.malVehicleId },
  });
  return updated;
}

/* ─── Reset oil change (manual admin action) ──────────────────────────── */

export async function resetOilChange(
  input: ResetOilChangeInput,
  actor: AuthContext,
): Promise<CarVehicle> {
  if (actor.role !== 'ADMIN' && actor.role !== 'MANAGER') {
    throw new CarError('CAR-E0102', 403, 'Only Staff can reset oil change');
  }
  const vehicle = await db.query.carVehicles.findFirst({
    where: and(
      eq(carVehicles.cvhId, input.vehicle_id),
      eq(carVehicles.entId, actor.entId),
      isNull(carVehicles.cvhDeletedAt),
    ),
  });
  if (!vehicle) {
    throw new CarError('CAR-E1002', 404, 'Vehicle not found');
  }
  const changedAt = new Date(input.changed_at);
  const [updated] = await db
    .update(carVehicles)
    .set({
      cvhLastOilChangeKm: input.odometer_km,
      cvhLastOilChangeAt: changedAt,
      cvhOdometerKm: sql`GREATEST(${carVehicles.cvhOdometerKm}, ${input.odometer_km})`,
      cvhUpdatedAt: new Date(),
    })
    .where(
      and(eq(carVehicles.cvhId, input.vehicle_id), eq(carVehicles.entId, actor.entId)),
    )
    .returning();
  if (!updated) {
    throw new CarError('CAR-E1002', 404, 'Vehicle vanished during reset');
  }

  /* Resolve any open OIL_* alerts for this vehicle. */
  await db
    .update(carMaintenanceAlerts)
    .set({ malResolvedAt: new Date() })
    .where(
      and(
        eq(carMaintenanceAlerts.entId, actor.entId),
        eq(carMaintenanceAlerts.malVehicleId, input.vehicle_id),
        isNull(carMaintenanceAlerts.malResolvedAt),
        sql`${carMaintenanceAlerts.malType} IN ('OIL_OVERDUE','OIL_DUE_SOON')`,
      ),
    );

  await logAudit({
    entId: actor.entId,
    userId: actor.userId,
    action: 'VEHICLE.OIL_RESET',
    entity: 'Vehicle',
    entityId: updated.cvhId,
    entityRef: updated.cvhPlateNumber,
    before: {
      lastOilChangeKm: vehicle.cvhLastOilChangeKm,
      lastOilChangeAt: vehicle.cvhLastOilChangeAt?.toISOString() ?? null,
    },
    after: {
      lastOilChangeKm: input.odometer_km,
      lastOilChangeAt: changedAt.toISOString(),
      note: input.note,
    },
  });

  return updated;
}

/* ─── Internal helpers exported for tests ─────────────────────────────── */
export const _internals = {
  deriveAlertCandidates,
  hasRecentUnresolvedAlert,
};
