import 'server-only';
import { randomUUID } from 'node:crypto';
import { and, eq, isNull } from 'drizzle-orm';
import { db, schema, withEnt } from '@v2/db';
import type { ShopeeMetricsResult } from './gmv-calculator.service';
import type { TikTokMetricsResult } from './tiktok-metrics-calculator.service';

/**
 * Period snapshot JSON shape — what gets stored in `psp_metrics` JSONB.
 *
 * MVP: store the raw platform-level metric results from Shopee + TikTok
 * calculators verbatim. Dashboard derives Weekly Report display data from
 * this. WoW deltas come from comparing this snapshot to the previous period's
 * snapshot at read time (not stored).
 */
export interface PeriodSnapshotMetrics {
  version: 1;
  shopee: Pick<
    ShopeeMetricsResult,
    | 'totalGmv'
    | 'totalNetGmv'
    | 'totalNmv'
    | 'totalSellerDiscount'
    | 'totalPrimeCost'
    | 'primeCostKept'
    | 'primeCostFreeGift'
    | 'totalSellerVouchers'
    | 'totalPlatformFee'
    | 'totalPlatformDiscount'
    | 'rowsKept'
    | 'rowsExcluded'
    | 'orderCounts'
  > & {
    totalAdSpending: number;
    totalBrandAds: number;
    totalOffPlatformAds: number;
    totalPageViews: number;
    totalAffiliateCommission: number;
  };
  tiktok: Pick<
    TikTokMetricsResult,
    | 'totalGmv'
    | 'totalNetGmv'
    | 'totalNmv'
    | 'totalSellerDiscount'
    | 'totalPrimeCost'
    | 'primeCostKept'
    | 'primeCostFreeGift'
    | 'rowsKept'
    | 'rowsExcluded'
  > & {
    totalPageViews: number;
    totalAffiliateCommission: number;
  };
  manualInputs: {
    affiliateBookingFees: number;
    shopeeLivestreamFees: number;
    tiktokLivestreamFees: number;
    tiktokAdsSpending: number;
  };
  /** Constants captured at ingest time. */
  constants: {
    tiktokPlatformFeeRatePct: number;
  };
  computedAt: string;
}

export interface SavePeriodSnapshotInput {
  entId: string;
  userId: string;
  periodStart: Date;
  periodEnd: Date;
  granularity: 'WEEKLY' | 'MONTHLY';
  weekNum?: number | null;
  monthIdx?: number | null;
  year: number;
  metrics: PeriodSnapshotMetrics;
}

/**
 * Upsert a period snapshot. If a snapshot already exists for the same
 * (ent, period_start, period_end, granularity), replace the metrics blob.
 */
export async function savePeriodSnapshot(input: SavePeriodSnapshotInput): Promise<{ pspId: string; isNew: boolean }> {
  const existing = await db
    .select({ pspId: schema.salPeriodSnapshots.pspId })
    .from(schema.salPeriodSnapshots)
    .where(
      and(
        withEnt(schema.salPeriodSnapshots.entId, input.entId),
        eq(schema.salPeriodSnapshots.pspPeriodStart, input.periodStart),
        eq(schema.salPeriodSnapshots.pspPeriodEnd, input.periodEnd),
        eq(schema.salPeriodSnapshots.pspGranularity, input.granularity),
      ),
    )
    .limit(1);

  if (existing[0]) {
    await db
      .update(schema.salPeriodSnapshots)
      .set({
        pspMetrics: input.metrics,
        pspUpdatedAt: new Date(),
      })
      .where(eq(schema.salPeriodSnapshots.pspId, existing[0].pspId));
    return { pspId: existing[0].pspId, isNew: false };
  }

  const pspId = randomUUID();
  await db.insert(schema.salPeriodSnapshots).values({
    pspId,
    entId: input.entId,
    pspPeriodStart: input.periodStart,
    pspPeriodEnd: input.periodEnd,
    pspGranularity: input.granularity,
    pspWeekNum: input.weekNum ?? null,
    pspMonthIdx: input.monthIdx ?? null,
    pspYear: input.year,
    pspCreatedBy: input.userId,
    pspMetrics: input.metrics,
  });
  return { pspId, isNew: true };
}

export interface LoadPeriodSnapshotInput {
  entId: string;
  granularity: 'WEEKLY' | 'MONTHLY';
  weekNum?: number;
  monthIdx?: number;
  year: number;
}

/**
 * Fetch the snapshot for a specific week/month. Returns null if not found.
 */
export async function loadPeriodSnapshot(
  input: LoadPeriodSnapshotInput,
): Promise<PeriodSnapshotMetrics | null> {
  const conditions = [
    withEnt(schema.salPeriodSnapshots.entId, input.entId),
    eq(schema.salPeriodSnapshots.pspGranularity, input.granularity),
    eq(schema.salPeriodSnapshots.pspYear, input.year),
  ];
  if (input.granularity === 'WEEKLY' && input.weekNum != null) {
    conditions.push(eq(schema.salPeriodSnapshots.pspWeekNum, input.weekNum));
  } else if (input.granularity === 'MONTHLY' && input.monthIdx != null) {
    conditions.push(eq(schema.salPeriodSnapshots.pspMonthIdx, input.monthIdx));
  }

  const rows = await db
    .select({ pspMetrics: schema.salPeriodSnapshots.pspMetrics })
    .from(schema.salPeriodSnapshots)
    .where(and(...conditions))
    .limit(1);
  if (!rows[0]) return null;
  return rows[0].pspMetrics as PeriodSnapshotMetrics;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
void isNull;
