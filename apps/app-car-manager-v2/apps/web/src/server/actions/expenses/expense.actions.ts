'use server';

import { randomUUID } from 'node:crypto';
import { and, eq, inArray, isNull } from 'drizzle-orm';
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
import { getCurrentUser, requireRole } from '@/lib/auth/get-current-user';
import { logAudit } from '@/server/services/audit-log.service';
import { decideInitialStatus } from '@/server/services/expense-approval.service';
import { notifyMany, notifyUser } from '@/server/services/notification.service';
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

    const { status } = await decideInitialStatus(actor.entId, parsed.type, parsed.amount);
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
      /* Fan-out tới cả ADMIN + MANAGER trong cùng entity. Admin là approver
       * chính (PRD §6.2.2), Manager nhận để theo dõi chi phí team mình. */
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
      if (recipients.length > 0) {
        await notifyMany(recipients.map((a) => a.id), {
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

/* ─── Approve / Reject ─────────────────────────────────────────────────── */

const reviewInputSchema = z.object({
  expense_id: z.string().uuid(),
  note: z.string().max(2000).optional(),
});

type ReviewInput = z.infer<typeof reviewInputSchema>;

/** Load expense theo (entId, expId), ép đúng trạng thái cho phép review. */
async function loadReviewableExpense(actorEntId: string, expenseId: string) {
  const row = await db.query.carExpenses.findFirst({
    where: and(
      eq(carExpenses.expId, expenseId),
      eq(carExpenses.entId, actorEntId),
      isNull(carExpenses.expDeletedAt),
    ),
  });
  if (!row) throw new CarError('CAR-E2002', 404, 'Expense không tồn tại');
  if (row.expStatus !== 'PENDING') {
    throw new CarError('CAR-E2003', 409, 'Expense đã được xử lý');
  }
  return row;
}

export async function approveExpenseAction(
  input: ReviewInput,
): Promise<ActionResult<{ id: string; status: 'APPROVED' }>> {
  return runAction(async () => {
    const actor = await getCurrentUser();
    /* PRD §6.2.2: Admin là approver chính. Manager có thể được mở rộng sau. */
    requireRole(actor.role, ['ADMIN']);
    const dto = reviewInputSchema.parse(input);
    const expense = await loadReviewableExpense(actor.entId, dto.expense_id);

    const now = new Date();
    await db
      .update(carExpenses)
      .set({
        expStatus: 'APPROVED',
        expReviewedBy: actor.userId,
        expReviewedAt: now,
        expReviewNote: dto.note ?? null,
        expUpdatedAt: now,
      })
      .where(and(eq(carExpenses.expId, expense.expId), eq(carExpenses.entId, actor.entId)));

    await logAudit({
      entId: actor.entId,
      userId: actor.userId,
      action: 'EXPENSE.APPROVED',
      entity: 'Expense',
      entityId: expense.expId,
      after: { status: 'APPROVED', amount: expense.expAmount, type: expense.expType },
    });

    /* Notify driver who submitted. */
    await notifyUser({
      entId: actor.entId,
      userId: expense.expSubmittedBy,
      event: 'EXPENSE.APPROVED',
      title: 'Chi phí đã được duyệt',
      body: `${expense.expType} · ${Number(expense.expAmount).toLocaleString('vi-VN')}₫`,
      entityId: expense.expId,
    });

    revalidatePath('/costs');
    revalidatePath('/expenses');
    return { id: expense.expId, status: 'APPROVED' as const };
  });
}

export async function rejectExpenseAction(
  input: ReviewInput,
): Promise<ActionResult<{ id: string; status: 'REJECTED' }>> {
  return runAction(async () => {
    const actor = await getCurrentUser();
    requireRole(actor.role, ['ADMIN']);
    const dto = reviewInputSchema.parse(input);
    if (!dto.note || dto.note.trim().length < 3) {
      throw new CarError('CAR-E0001', 400, 'Vui lòng nhập lý do từ chối (ít nhất 3 ký tự)');
    }
    const expense = await loadReviewableExpense(actor.entId, dto.expense_id);

    const now = new Date();
    await db
      .update(carExpenses)
      .set({
        expStatus: 'REJECTED',
        expReviewedBy: actor.userId,
        expReviewedAt: now,
        expReviewNote: dto.note,
        expUpdatedAt: now,
      })
      .where(and(eq(carExpenses.expId, expense.expId), eq(carExpenses.entId, actor.entId)));

    await logAudit({
      entId: actor.entId,
      userId: actor.userId,
      action: 'EXPENSE.REJECTED',
      entity: 'Expense',
      entityId: expense.expId,
      after: { status: 'REJECTED', reason: dto.note, amount: expense.expAmount, type: expense.expType },
    });

    await notifyUser({
      entId: actor.entId,
      userId: expense.expSubmittedBy,
      event: 'EXPENSE.REJECTED',
      title: 'Chi phí bị từ chối',
      body: dto.note,
      entityId: expense.expId,
    });

    revalidatePath('/costs');
    revalidatePath('/expenses');
    return { id: expense.expId, status: 'REJECTED' as const };
  });
}
