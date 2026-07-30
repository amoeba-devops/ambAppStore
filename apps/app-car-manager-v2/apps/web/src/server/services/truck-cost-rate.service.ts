import 'server-only';
import { randomUUID } from 'node:crypto';
import { and, desc, eq, isNull } from 'drizzle-orm';
import { db } from '@car-v2/db/client';
import { carTruckCostRates } from '@car-v2/db/schema';

/**
 * Record a fixed-cost rate as effective FROM THIS MONTH (migration 0025).
 *
 * The vehicle/driver forms keep editing one current value; this stamps the
 * change onto the history so past months keep the rate they were reported with.
 * Called on create (first rate) and on update (only when the amount actually
 * moved — an unrelated edit must not create a no-op rate row).
 *
 * Same (ref, kind, month) → the row is REPLACED: two edits in one month are one
 * decision, and stacking them would make "the newest row <= M" order-dependent.
 * Nothing is deleted, so a wrong entry can still be traced through
 * `tcr_created_at`; only the amount of the current month's row changes.
 */
export async function recordTruckCostRate(input: {
  entId: string;
  userId: string;
  scope: 'VEHICLE' | 'DRIVER';
  refId: string;
  kind: 'DEPRECIATION' | 'SALARY';
  /** VND per month; null/undefined is treated as 0 (rate withdrawn). */
  amount: number | null | undefined;
  /** 'YYYY-MM'; defaults to the current month. */
  month?: string;
  note?: string;
}): Promise<void> {
  const month = input.month ?? new Date().toISOString().slice(0, 7);
  const amount = Math.round(input.amount ?? 0);

  const [current] = await db
    .select({ amount: carTruckCostRates.tcrAmount, month: carTruckCostRates.tcrMonth })
    .from(carTruckCostRates)
    .where(
      and(
        eq(carTruckCostRates.entId, input.entId),
        eq(carTruckCostRates.tcrScope, input.scope),
        eq(carTruckCostRates.tcrRefId, input.refId),
        eq(carTruckCostRates.tcrKind, input.kind),
        isNull(carTruckCostRates.tcrDeletedAt),
      ),
    )
    .orderBy(desc(carTruckCostRates.tcrMonth))
    .limit(1);

  /* Already the rate in force and no earlier row to supersede → nothing to say. */
  if (current && Math.round(Number(current.amount)) === amount && current.month <= month) return;

  await db
    .insert(carTruckCostRates)
    .values({
      tcrId: randomUUID(),
      entId: input.entId,
      tcrScope: input.scope,
      tcrRefId: input.refId,
      tcrKind: input.kind,
      tcrMonth: month,
      tcrAmount: String(amount),
      tcrNote: input.note ?? null,
      tcrCreatedBy: input.userId,
    })
    .onConflictDoUpdate({
      target: [
        carTruckCostRates.entId,
        carTruckCostRates.tcrScope,
        carTruckCostRates.tcrRefId,
        carTruckCostRates.tcrKind,
        carTruckCostRates.tcrMonth,
      ],
      set: { tcrAmount: String(amount), tcrNote: input.note ?? null, tcrCreatedBy: input.userId },
    });
}
