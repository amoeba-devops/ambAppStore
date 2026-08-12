'use server';

import { randomUUID } from 'node:crypto';
import { and, eq, isNull } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { db } from '@car-v2/db/client';
import {
  carDrivers,
  carExpenseAttachments,
  carExpenses,
  carTrips,
  carVehicles,
  type CarExpense,
} from '@car-v2/db/schema';
import { CarError, type ActionResult } from '@car-v2/shared/errors';
import { getCurrentUser } from '@/lib/auth/get-current-user';
import { logAudit } from '@/server/services/audit-log.service';
import {
  checkExpenseDeleteWarnings,
  type ExpenseDeleteWarning,
} from '@/server/services/expense-delete-check.service';
import { resolveOpenOilAlerts } from '@/server/services/maintenance-alert.service';
import { runAction } from '../_helpers';

/* Expense submission server action.
 *
 * Submission paths:
 *   - DRIVER:  must have a `car_drivers` row. `vehicle_id` derived from trip
 *              when `trip_id` is provided; otherwise required from the form
 *              (driver explicitly picks which company car the expense is for).
 *   - ADMIN / MANAGER: records on behalf of a vehicle. `vehicle_id` required;
 *              `driver_id` is optional — they may not know which driver was
 *              using the car when the expense occurred (gas-station receipt
 *              for monthly fleet refuel, scheduled inspection invoice, etc.).
 *
 * All submissions land directly in AUTO_APPROVED (PRD revision: approval
 * flow dropped). No admin queue, no notification fan-out, no review buttons.
 *
 * Lock window: `exp_locked_until` set to NOW + 7 days per PRD §6.2.3 — driver
 * can edit metadata (note, occurredAt, amount) within that window. */

/* Attachment cap aligned with `S3_MAX_UPLOAD_BYTES` (default 10MB) — the
 * presign route + client receipt input both gate at that ceiling. Previously
 * 5MB here, which meant a 6-9MB file would upload successfully to S3 then
 * fail Zod validation on the action, orphaning the S3 object and surfacing
 * `CAR-E0001` to the user mid-submit. Mime cap stays at 64 chars (typical
 * MIMEs are <30; the headroom accounts for parameterised types like
 * `image/svg+xml; charset=utf-8`). */
const attachmentSchema = z.object({
  s3_key: z.string().min(1),
  mime: z.string().min(1).max(64),
  size_bytes: z.number().int().min(1).max(10 * 1024 * 1024),
});

/* Schemas + type are NOT exported — Next.js 15 `'use server'` files can only
 * export async functions. Re-exporting a Zod object throws:
 *   `A "use server" file can only export async functions, found object.`
 * If a client component needs the input type, declare it inline at the call
 * site or move both to a separate non-server module. */
const submitExpenseInputSchema = z.object({
  type: z.enum(['FUEL', 'OIL', 'MEAL', 'REPAIR', 'PARKING', 'TOLL', 'ACCIDENT', 'INSPECTION']),
  amount: z.number().positive('amount must be > 0'),
  occurred_at: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'occurred_at must be YYYY-MM-DD'),
  note: z.string().max(2000).optional(),
  trip_id: z.string().uuid().optional(),
  vehicle_id: z.string().uuid().optional(),
  driver_id: z.string().uuid().optional(),
  attachments: z.array(attachmentSchema).max(5).default([]),
});

type SubmitExpenseInput = z.input<typeof submitExpenseInputSchema>;

export async function submitExpenseAction(
  input: SubmitExpenseInput,
): Promise<ActionResult<{ id: string; status: CarExpense['expStatus'] }>> {
  return runAction(async () => {
    const actor = await getCurrentUser();
    const parsed = submitExpenseInputSchema.parse(input);

    /* Resolve driver + vehicle FKs per role.
     *
     * DRIVER path: must have a `car_drivers` row (the model constraint —
     *   anyone with role DRIVER must be a registered driver). Vehicle is
     *   taken from the linked trip when present; otherwise we accept the
     *   form's `vehicle_id` so a driver can submit a non-trip expense
     *   (monthly toll prepay, parking on a personal errand routed through
     *   a company car, etc.).
     *
     * ADMIN / MANAGER path: skip the driver lookup. `vehicle_id` is required
     *   from the form (or derived from a linked trip). `driver_id` is
     *   optional from the form — they may not know which driver was using
     *   the car at the time. */
    const isDriverRole = actor.role === 'DRIVER';

    let driverId: string | null = null;
    if (isDriverRole) {
      const driver = await db
        .select({ drvId: carDrivers.drvId })
        .from(carDrivers)
        .where(
          and(
            eq(carDrivers.drvUserId, actor.userId),
            eq(carDrivers.entId, actor.entId),
            isNull(carDrivers.drvDeletedAt),
          ),
        )
        .limit(1)
        .then((rows) => rows[0]);
      if (!driver) {
        throw new CarError('CAR-E0103', 403, 'Driver record not found for this user.');
      }
      driverId = driver.drvId;
    } else if (parsed.driver_id) {
      /* Admin/Manager passed an explicit driver — verify it belongs to the
       * tenant before trusting the FK (otherwise a crafted UUID lets them
       * write a row tagged with a foreign driver). */
      const driver = await db
        .select({ drvId: carDrivers.drvId })
        .from(carDrivers)
        .where(
          and(
            eq(carDrivers.drvId, parsed.driver_id),
            eq(carDrivers.entId, actor.entId),
            isNull(carDrivers.drvDeletedAt),
          ),
        )
        .limit(1)
        .then((rows) => rows[0]);
      if (!driver) {
        throw new CarError('CAR-E0404', 404, 'Driver not found in this tenant.');
      }
      driverId = driver.drvId;
    }

    let vehicleId: string | null = parsed.vehicle_id ?? null;
    /* Trip-linked expense: pull vehicle from the trip so the form doesn't
     * have to repeat what the trip already records. Verify trip belongs to
     * the tenant in the same query. */
    if (parsed.trip_id) {
      const trip = await db
        .select({ vehicleId: carTrips.trpVehicleId })
        .from(carTrips)
        .where(
          and(
            eq(carTrips.trpId, parsed.trip_id),
            eq(carTrips.entId, actor.entId),
            isNull(carTrips.trpDeletedAt),
          ),
        )
        .limit(1)
        .then((rows) => rows[0]);
      if (!trip) {
        throw new CarError('CAR-E0404', 404, 'Trip not found in this tenant.');
      }
      vehicleId = vehicleId ?? trip.vehicleId;
    } else if (vehicleId) {
      /* Standalone vehicle expense: verify vehicle belongs to the tenant. */
      const vehicle = await db
        .select({ id: carVehicles.cvhId })
        .from(carVehicles)
        .where(
          and(
            eq(carVehicles.cvhId, vehicleId),
            eq(carVehicles.entId, actor.entId),
            isNull(carVehicles.cvhDeletedAt),
          ),
        )
        .limit(1)
        .then((rows) => rows[0]);
      if (!vehicle) {
        throw new CarError('CAR-E0404', 404, 'Vehicle not found in this tenant.');
      }
    }

    /* Admin/Manager submitting outside a trip MUST identify which vehicle
     * the expense is for — that's the whole point of "ghi nhận theo từng
     * xe" (PRD §2.4). Drivers without a trip link also need it for the
     * same reason. */
    if (!vehicleId) {
      throw new CarError('CAR-E0001', 400, 'vehicle_id is required when no trip is linked');
    }

    /* Approval flow dropped — every expense lands AUTO_APPROVED. The status
     * field is kept on the row for historical compatibility and to let
     * downstream charts/exports filter on "non-deleted, non-rejected". */
    const status: CarExpense['expStatus'] = 'AUTO_APPROVED';
    const now = new Date();
    const lockUntil = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const expId = randomUUID();

    /* neon-http driver does NOT support `db.transaction()` (HTTP can't hold a
     * connection across roundtrips). Use `db.batch()` instead — Neon's HTTP
     * API runs the array as an atomic server-side batch (BEGIN/COMMIT under
     * the hood), so partial writes don't leak. */
    const expenseInsert = db.insert(carExpenses).values({
      expId,
      entId: actor.entId,
      expType: parsed.type,
      expAmount: parsed.amount.toFixed(2),
      expCurrency: 'VND',
      expOccurredAt: parsed.occurred_at,
      expNote: parsed.note ?? null,
      expStatus: status,
      expTripId: parsed.trip_id ?? null,
      expVehicleId: vehicleId,
      expDriverId: driverId,
      expSubmittedBy: actor.userId,
      expSubmittedAt: now,
      expLockedUntil: lockUntil,
    });

    if (parsed.attachments.length > 0) {
      const attachmentInsert = db.insert(carExpenseAttachments).values(
        parsed.attachments.map((a) => ({
          eatId: randomUUID(),
          entId: actor.entId,
          eatExpenseId: expId,
          eatS3Key: a.s3_key,
          eatMime: a.mime,
          eatSizeBytes: a.size_bytes,
        })),
      );
      await db.batch([expenseInsert, attachmentInsert]);
    } else {
      await expenseInsert;
    }

    /* Audit log only — admin approval flow removed, no notification fan-out
     * needed for AUTO_APPROVED expenses. Best-effort: a failed audit insert
     * must not unwind the expense (the user-visible "submitted" must mean
     * what it says). The service itself swallows errors. */
    await logAudit({
      entId: actor.entId,
      userId: actor.userId,
      action: 'EXPENSE.SUBMITTED',
      entity: 'Expense',
      entityId: expId,
      after: {
        type: parsed.type,
        amount: parsed.amount,
        status,
        attachmentCount: parsed.attachments.length,
      },
    });

    /* R-8: an OIL expense IS the oil change, so close the vehicle's open OIL
     * alerts and restart its oil clock. Runs after the insert so a failure
     * here can't unwind a recorded expense (the helper swallows its own
     * errors). Only OIL — the other 7 types say nothing about maintenance. */
    if (parsed.type === 'OIL') {
      await resolveOpenOilAlerts(actor.entId, vehicleId, new Date(parsed.occurred_at));
      revalidatePath('/maintenance');
      revalidatePath('/vehicles');
    }

    revalidatePath('/expenses');
    revalidatePath('/costs');

    return { id: expId, status };
  });
}

/* ─── Approve / Reject (REMOVED) ────────────────────────────────────────────
 *
 * Per PRD revision the approval flow is gone — every expense lands in
 * AUTO_APPROVED. The approveExpenseAction / rejectExpenseAction helpers
 * have been removed along with their UI in /costs.
 *
 * If approvals come back later: bring back from git history rather than
 * re-deriving the schema interactions — the audit-log + notification fan-out
 * had subtleties (recipients query, EXPENSE.REJECTED requiring a reason)
 * that aren't worth re-discovering. */

/* ─── Delete Expense ─────────────────────────────────────────────────────────
 *
 * Soft delete an expense. Returns warnings about attachments / linked trips
 * but does NOT block (soft-warning approach per driver deletion pattern). */

/**
 * Get warnings before deleting an expense.
 * Returns warnings about attachments and linked trip.
 * Does NOT block deletion (soft-warning approach).
 */
export async function getExpenseDeleteWarningsAction(
  expenseId: string,
): Promise<ActionResult<{ warnings: ExpenseDeleteWarning[] }>> {
  return runAction(async () => {
    const actor = await getCurrentUser();
    // Any authenticated user can check warnings for their own expenses
    // (role check is done in deleteExpenseAction)

    const result = await checkExpenseDeleteWarnings(actor.entId, expenseId);
    return { warnings: result.warnings };
  });
}

export async function deleteExpenseAction(
  id: string,
): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    const actor = await getCurrentUser();

    // Fetch expense to check ownership
    const existing = await db
      .select({
        expId: carExpenses.expId,
        expType: carExpenses.expType,
        expAmount: carExpenses.expAmount,
        expStatus: carExpenses.expStatus,
        expSubmittedBy: carExpenses.expSubmittedBy,
        expDriverId: carExpenses.expDriverId,
      })
      .from(carExpenses)
      .where(
        and(
          eq(carExpenses.expId, id),
          eq(carExpenses.entId, actor.entId),
          isNull(carExpenses.expDeletedAt),
        ),
      )
      .limit(1)
      .then((rows) => rows[0]);

    if (!existing) throw new CarError('CAR-E0404', 404, 'Expense not found');

    // Permission check: ADMIN/MANAGER can delete any expense,
    // DRIVER can only delete their own submitted expenses
    if (actor.role === 'DRIVER') {
      if (existing.expSubmittedBy !== actor.userId) {
        throw new CarError('CAR-E0403', 403, 'You can only delete your own expenses');
      }
    }

    // Soft delete
    await db
      .update(carExpenses)
      .set({ expDeletedAt: new Date(), expUpdatedAt: new Date() })
      .where(and(eq(carExpenses.expId, id), eq(carExpenses.entId, actor.entId)));

    await logAudit({
      entId: actor.entId,
      userId: actor.userId,
      action: 'EXPENSE.DELETE',
      entity: 'Expense',
      entityId: id,
      before: {
        type: existing.expType,
        amount: existing.expAmount,
        status: existing.expStatus,
      },
    });

    revalidatePath('/expenses');
    revalidatePath('/costs');
    return { id };
  });
}

