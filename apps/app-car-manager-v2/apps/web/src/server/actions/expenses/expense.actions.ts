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
  type CarExpense,
} from '@car-v2/db/schema';
import { CarError, type ActionResult } from '@car-v2/shared/errors';
import { getCurrentUser } from '@/lib/auth/get-current-user';
import { logAudit } from '@/server/services/audit-log.service';
import { decideInitialStatus } from '@/server/services/expense-approval.service';
import { runAction } from '../_helpers';

/* Real expense submission server action.
 *
 * Flow:
 *   1. Validate input (Zod)
 *   2. Resolve driver row from current user
 *   3. INSERT expense row + attachment rows (atomic via a single transaction)
 *   4. Audit log
 *
 * Approval flow removed per user-flow §3.2 — every expense lands in
 * AUTO_APPROVED. No admin notification fires.
 *
 * Lock window: `exp_locked_until` set to NOW + 7 days per PRD §6.2.3 — driver
 * can edit metadata (note, occurredAt, amount) within that window. Edit
 * action is a separate REQ. */

const attachmentSchema = z.object({
  s3_key: z.string().min(1),
  mime: z.string().min(1).max(64),
  size_bytes: z.number().int().min(1).max(5 * 1024 * 1024),
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
  attachments: z.array(attachmentSchema).max(5).default([]),
});

type SubmitExpenseInput = z.input<typeof submitExpenseInputSchema>;

export async function submitExpenseAction(
  input: SubmitExpenseInput,
): Promise<ActionResult<{ id: string; status: CarExpense['expStatus'] }>> {
  return runAction(async () => {
    const actor = await getCurrentUser();
    const parsed = submitExpenseInputSchema.parse(input);

    /* Driver record lookup. Anyone with role DRIVER must have a row in
     * car_drivers — that's the model constraint. If not (e.g. mis-mapped role),
     * we fail with a clear code rather than silently inserting with a NULL
     * driver. Admin / Manager submitting on their own behalf would hit the
     * same path; PRD doesn't anticipate that case so 403 is fine. */
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
      throw new CarError('CAR-E0103', 403, 'Only drivers can submit expenses.');
    }

    const { status } = decideInitialStatus(actor.entId, parsed.type, parsed.amount);
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
      expDriverId: driver.drvId,
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

    revalidatePath('/expenses');

    return { id: expId, status };
  });
}
