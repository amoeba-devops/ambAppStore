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
  carUsers,
  type CarExpense,
} from '@car-v2/db/schema';
import { CarError, type ActionResult } from '@car-v2/shared/errors';
import { getCurrentUser } from '@/lib/auth/get-current-user';
import { logAudit } from '@/server/services/audit-log.service';
import { decideInitialStatus } from '@/server/services/expense-approval.service';
import { notifyMany } from '@/server/services/notification.service';
import { runAction } from '../_helpers';

/* Real expense submission server action.
 *
 * Flow:
 *   1. Validate input (Zod)
 *   2. Resolve driver row from current user (drivers don't submit on behalf
 *      of others)
 *   3. Apply approval policy → decide initial status (AUTO_APPROVED vs PENDING)
 *   4. INSERT expense row + attachment rows (atomic via a single transaction)
 *   5. Audit log + notify entity admins if status === PENDING
 *
 * Lock window: `exp_locked_until` set to NOW + 7 days per PRD §6.2.3 — driver
 * can edit metadata (note, occurredAt, amount) within that window. Edit
 * action is a separate REQ. */

const attachmentSchema = z.object({
  s3_key: z.string().min(1),
  mime: z.string().min(1).max(64),
  size_bytes: z.number().int().min(1).max(5 * 1024 * 1024),
});

export const submitExpenseInputSchema = z.object({
  type: z.enum(['FUEL', 'OIL', 'MEAL', 'REPAIR', 'PARKING', 'TOLL', 'ACCIDENT', 'INSPECTION']),
  amount: z.number().positive('amount must be > 0'),
  occurred_at: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'occurred_at must be YYYY-MM-DD'),
  note: z.string().max(2000).optional(),
  trip_id: z.string().uuid().optional(),
  attachments: z.array(attachmentSchema).max(5).default([]),
});

export type SubmitExpenseInput = z.input<typeof submitExpenseInputSchema>;

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

    const { status } = await decideInitialStatus(actor.entId, parsed.type, parsed.amount);
    const now = new Date();
    const lockUntil = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const expId = randomUUID();

    await db.transaction(async (tx) => {
      await tx.insert(carExpenses).values({
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
        await tx.insert(carExpenseAttachments).values(
          parsed.attachments.map((a) => ({
            eatId: randomUUID(),
            entId: actor.entId,
            eatExpenseId: expId,
            eatS3Key: a.s3_key,
            eatMime: a.mime,
            eatSizeBytes: a.size_bytes,
          })),
        );
      }
    });

    /* Audit log + admin notification. Best-effort — these failing shouldn't
     * unwind the expense (the user-visible "submitted" must mean what it
     * says). The services themselves swallow errors. */
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

    if (status === 'PENDING') {
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
      if (admins.length > 0) {
        await notifyMany(admins.map((a) => a.id), {
          entId: actor.entId,
          event: 'EXPENSE.SUBMITTED',
          title: `Chi phí mới chờ duyệt`,
          body: `${parsed.type} · ${parsed.amount.toLocaleString('vi-VN')}₫`,
          entityId: expId,
        });
      }
    }

    revalidatePath('/expenses');
    revalidatePath('/costs');

    return { id: expId, status };
  });
}
