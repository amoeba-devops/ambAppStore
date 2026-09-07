'use server';

import { randomUUID } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { and, eq, isNull } from 'drizzle-orm';
import { db } from '@car-v2/db/client';
import { carTruckMaintenances, carVehicles } from '@car-v2/db/schema';
import { CarError, type ActionResult } from '@car-v2/shared/errors';
import {
  createTruckMaintenanceSchema,
  deleteTruckMaintenanceSchema,
  previewTruckMaintenanceConflictsSchema,
  updateTruckMaintenanceSchema,
} from '@car-v2/shared/zod';
import {
  assertNoTripsInMaintenanceWindow,
  listBusyVehiclesInWindow,
  listOverlappingMaintenances,
  type TripsInWindow,
} from '@car-v2/core/truck';
import { getCurrentUser, requireRole, type AuthContext } from '@/lib/auth/get-current-user';
import { requireFleet } from '@/lib/auth/fleet-access';
import { requireRegion, resolveVehicleScope } from '@/lib/auth/region-access';
import { isTruckMonthClosed } from '@/server/queries/truck-finance.queries';
import { logAudit } from '@/server/services/audit-log.service';
import { runAction } from '../_helpers';

/**
 * Truck maintenance CRUD (REQ-20260904). Rules enforced here, in order:
 *   1. STAFF (ADMIN/MANAGER) with TRUCK fleet access; region ACL on the truck.
 *   2. The truck exists, is a live TRUCK.
 *   3. Financial period lock: the accounting month (= start month) — and, on
 *      edit, the previous month too — must not be closed (legacy chốt sổ).
 *      Reports don't lock; the stale badge picks the change up (BR-11).
 *   4. No trip of the truck inside [start, end] (BR-8 hard block, CAR-E1014).
 * Neon HTTP has no transactions → one write statement per action, audit after.
 */

const REVALIDATE_PATHS = [
  '/truck/maintenance',
  /* Month totals (fixedCost) everywhere the P&L core is read. */
  '/truck/dashboard',
  '/truck/pnl',
  '/truck/finance',
  /* Trip forms grey out booked trucks from these windows. */
  '/truck/trips/new',
  '/today/truck/new',
];

function revalidateAll(): void {
  for (const p of REVALIDATE_PATHS) revalidatePath(p);
}

/** The truck a job hangs off — live TRUCK of this tenant, region-checked. */
async function loadTruck(actor: AuthContext, vehicleId: string) {
  const [v] = await db
    .select({
      id: carVehicles.cvhId,
      plate: carVehicles.cvhPlateNumber,
      region: carVehicles.cvhRegion,
      status: carVehicles.cvhStatus,
    })
    .from(carVehicles)
    .where(
      and(
        eq(carVehicles.entId, actor.entId),
        eq(carVehicles.cvhId, vehicleId),
        eq(carVehicles.cvhType, 'TRUCK'),
        isNull(carVehicles.cvhDeletedAt),
      ),
    )
    .limit(1);
  if (!v) throw new CarError('CAR-E0404', 404, 'Vehicle not found');
  if (v.region) await requireRegion(actor, v.region);
  /* A retired truck cannot be booked for maintenance (REQ-20260907 BR-4) —
   * the picker hides it; this is the server-side stop. */
  if (v.status === 'RETIRED') throw new CarError('CAR-E1002', 409, 'Vehicle is retired');
  return v;
}

/** Legacy month close — whole-fleet OR the truck's region (same pair
 * `upsertTruckFixedCostAction` checks). */
async function assertMonthOpen(entId: string, month: string, region: string | null): Promise<void> {
  const closed =
    (await isTruckMonthClosed(entId, month)) || (region != null && (await isTruckMonthClosed(entId, month, region)));
  if (closed) throw new CarError('CAR-E1002', 409, `Financial month ${month} is closed`);
}

async function loadExisting(actor: AuthContext, id: string) {
  const [row] = await db
    .select()
    .from(carTruckMaintenances)
    .where(
      and(
        eq(carTruckMaintenances.entId, actor.entId),
        eq(carTruckMaintenances.tmnId, id),
        isNull(carTruckMaintenances.tmnDeletedAt),
      ),
    )
    .limit(1);
  if (!row) throw new CarError('CAR-E0404', 404, 'Maintenance record not found');
  return row;
}

async function staffActor(): Promise<AuthContext> {
  const actor = await getCurrentUser();
  requireRole(actor.role, ['ADMIN', 'MANAGER']);
  await requireFleet(actor, 'TRUCK');
  return actor;
}

export async function createTruckMaintenanceAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    const actor = await staffActor();
    const dto = createTruckMaintenanceSchema.parse(input);
    const truck = await loadTruck(actor, dto.vehicle_id);
    const month = dto.start_date.slice(0, 7);
    await assertMonthOpen(actor.entId, month, truck.region);
    await assertNoTripsInMaintenanceWindow(actor.entId, truck.id, truck.plate, dto.start_date, dto.end_date);

    const id = randomUUID();
    await db.insert(carTruckMaintenances).values({
      tmnId: id,
      entId: actor.entId,
      cvhId: truck.id,
      tmnStartDate: dto.start_date,
      tmnEndDate: dto.end_date,
      tmnMonth: month,
      tmnCost: String(Math.round(dto.cost)),
      tmnCreatedBy: actor.userId,
    });

    await logAudit({
      entId: actor.entId,
      userId: actor.userId,
      action: 'TRUCK_MAINTENANCE.CREATE',
      entity: 'Vehicle',
      entityId: truck.id,
      entityRef: truck.plate,
      after: { maintenanceId: id, startDate: dto.start_date, endDate: dto.end_date, month, cost: Math.round(dto.cost) },
    });

    revalidateAll();
    return { id };
  });
}

export async function updateTruckMaintenanceAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    const actor = await staffActor();
    const dto = updateTruckMaintenanceSchema.parse(input);
    const existing = await loadExisting(actor, dto.maintenance_id);
    /* Region ACL on BOTH trucks when the job moves to another one. */
    const oldTruck = await loadTruck(actor, existing.cvhId);
    const truck = existing.cvhId === dto.vehicle_id ? oldTruck : await loadTruck(actor, dto.vehicle_id);
    const month = dto.start_date.slice(0, 7);
    /* Moving out of (or into) a closed month is refused either way. */
    await assertMonthOpen(actor.entId, existing.tmnMonth, oldTruck.region);
    if (month !== existing.tmnMonth || truck.region !== oldTruck.region) {
      await assertMonthOpen(actor.entId, month, truck.region);
    }
    await assertNoTripsInMaintenanceWindow(actor.entId, truck.id, truck.plate, dto.start_date, dto.end_date);

    await db
      .update(carTruckMaintenances)
      .set({
        cvhId: truck.id,
        tmnStartDate: dto.start_date,
        tmnEndDate: dto.end_date,
        tmnMonth: month,
        tmnCost: String(Math.round(dto.cost)),
        tmnUpdatedBy: actor.userId,
        tmnUpdatedAt: new Date(),
      })
      .where(and(eq(carTruckMaintenances.entId, actor.entId), eq(carTruckMaintenances.tmnId, existing.tmnId)));

    await logAudit({
      entId: actor.entId,
      userId: actor.userId,
      action: 'TRUCK_MAINTENANCE.UPDATE',
      entity: 'Vehicle',
      entityId: truck.id,
      entityRef: truck.plate,
      before: {
        maintenanceId: existing.tmnId,
        vehicleId: existing.cvhId,
        startDate: existing.tmnStartDate,
        endDate: existing.tmnEndDate,
        month: existing.tmnMonth,
        cost: Math.round(Number(existing.tmnCost)),
      },
      after: {
        maintenanceId: existing.tmnId,
        vehicleId: truck.id,
        startDate: dto.start_date,
        endDate: dto.end_date,
        month,
        cost: Math.round(dto.cost),
      },
    });

    revalidateAll();
    return { id: existing.tmnId };
  });
}

/** Soft delete (tmn_deleted_at) — the month total drops by the job's cost. */
export async function deleteTruckMaintenanceAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    const actor = await staffActor();
    const dto = deleteTruckMaintenanceSchema.parse(input);
    const existing = await loadExisting(actor, dto.maintenance_id);
    const truck = await loadTruck(actor, existing.cvhId);
    await assertMonthOpen(actor.entId, existing.tmnMonth, truck.region);

    await db
      .update(carTruckMaintenances)
      .set({ tmnDeletedAt: new Date(), tmnUpdatedBy: actor.userId })
      .where(and(eq(carTruckMaintenances.entId, actor.entId), eq(carTruckMaintenances.tmnId, existing.tmnId)));

    await logAudit({
      entId: actor.entId,
      userId: actor.userId,
      action: 'TRUCK_MAINTENANCE.DELETE',
      entity: 'Vehicle',
      entityId: truck.id,
      entityRef: truck.plate,
      before: {
        maintenanceId: existing.tmnId,
        startDate: existing.tmnStartDate,
        endDate: existing.tmnEndDate,
        month: existing.tmnMonth,
        cost: Math.round(Number(existing.tmnCost)),
      },
    });

    revalidateAll();
    return { id: existing.tmnId };
  });
}

export interface TruckMaintenanceConflictPreview {
  /** Per truck (of the viewer's scope): trips inside the window → the form
   * disables that truck and, for the picked one, lists the refs. */
  busy: Record<string, TripsInWindow>;
  /** Other live jobs of the picked truck intersecting the window (soft warning). */
  overlaps: { id: string; startDate: string; endDate: string }[];
}

/**
 * Read-only conflict preview the form runs while the user picks truck/dates
 * ("show the warning right away, block the choice" — user decision Q5). The
 * save actions re-check on the server regardless.
 */
export async function previewTruckMaintenanceConflictsAction(
  input: unknown,
): Promise<ActionResult<TruckMaintenanceConflictPreview>> {
  return runAction(async () => {
    const actor = await staffActor();
    const dto = previewTruckMaintenanceConflictsSchema.parse(input);
    const { trucks } = await resolveVehicleScope(actor, undefined);
    const [busyMap, overlaps] = await Promise.all([
      listBusyVehiclesInWindow(
        actor.entId,
        trucks.map((v) => v.cvhId),
        dto.start_date,
        dto.end_date,
      ),
      dto.vehicle_id
        ? listOverlappingMaintenances(actor.entId, dto.vehicle_id, dto.start_date, dto.end_date, dto.exclude_id)
        : Promise.resolve([]),
    ]);
    const busy: Record<string, TripsInWindow> = {};
    for (const [vehicleId, v] of busyMap) busy[vehicleId] = v;
    return { busy, overlaps };
  });
}
