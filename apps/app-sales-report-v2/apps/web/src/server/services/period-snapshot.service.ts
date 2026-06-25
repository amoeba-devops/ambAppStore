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
    | 'totalItemSold'
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
    | 'productBreakdown'
    | 'giftBreakdown'
  > & {
    totalAdSpending: number;
    totalAdRevenue: number;
    shopGmvMaxCost: number;
    shopAdsCost: number;
    totalBrandAds: number;
    totalOffPlatformAds: number;
    totalPageViews: number;
    totalAffiliateCommission: number;
    /** Per-product-name affiliate cost (Chi phí) from the Affiliate file.
     *  Key = normalized product name; value = SUM(chiPhi) for that product.
     *  Used to attribute exact affComm per breakdown row + an "Others" bucket
     *  for product names that don't match any Sales breakdown entry. */
    affiliateCostByProductName: Record<string, number>;
  };
  tiktok: Pick<
    TikTokMetricsResult,
    | 'totalItemSold'
    | 'totalGmv'
    | 'totalNetGmv'
    | 'totalNmv'
    | 'totalSellerDiscount'
    | 'totalPlatformDiscount'
    | 'totalPlatformFee'
    | 'totalPrimeCost'
    | 'primeCostKept'
    | 'primeCostFreeGift'
    | 'rowsKept'
    | 'rowsExcluded'
    | 'orderCounts'
    | 'productBreakdown'
    | 'giftBreakdown'
  > & {
    totalPageViews: number;
    totalAffiliateCommission: number;
    /** Per-product (`Tên sản phẩm` normalized) affiliate cost merged across the
     *  3 TikTok affiliate exports (Creator / Partner / Non-collaboration). Used
     *  for exact per-SKU attribution downstream + an "Others" bucket for product
     *  names not present in the Sales breakdown. */
    affiliateCostByProductName: Record<string, number>;
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

void isNull;

export interface PeriodSnapshotRow {
  granularity: 'WEEKLY' | 'MONTHLY';
  weekNum: number | null;
  monthIdx: number | null;
  year: number;
  periodStart: Date;
  periodEnd: Date;
  metrics: PeriodSnapshotMetrics;
}

/**
 * Fetch every saved snapshot for an entity, ordered chronologically. Used by
 * the Trends page to build a time-series across all weeks/months that have
 * been ingested so far. No paging — Trends UI only loads a handful per request.
 */
export async function listAllPeriodSnapshots(
  entId: string,
  granularity: 'WEEKLY' | 'MONTHLY',
): Promise<PeriodSnapshotRow[]> {
  const rows = await db
    .select({
      pspGranularity: schema.salPeriodSnapshots.pspGranularity,
      pspWeekNum: schema.salPeriodSnapshots.pspWeekNum,
      pspMonthIdx: schema.salPeriodSnapshots.pspMonthIdx,
      pspYear: schema.salPeriodSnapshots.pspYear,
      pspPeriodStart: schema.salPeriodSnapshots.pspPeriodStart,
      pspPeriodEnd: schema.salPeriodSnapshots.pspPeriodEnd,
      pspMetrics: schema.salPeriodSnapshots.pspMetrics,
    })
    .from(schema.salPeriodSnapshots)
    .where(
      and(
        withEnt(schema.salPeriodSnapshots.entId, entId),
        eq(schema.salPeriodSnapshots.pspGranularity, granularity),
      ),
    );
  return rows
    .map((r) => ({
      granularity: r.pspGranularity as 'WEEKLY' | 'MONTHLY',
      weekNum: r.pspWeekNum,
      monthIdx: r.pspMonthIdx,
      year: r.pspYear,
      periodStart: r.pspPeriodStart instanceof Date ? r.pspPeriodStart : new Date(r.pspPeriodStart),
      periodEnd: r.pspPeriodEnd instanceof Date ? r.pspPeriodEnd : new Date(r.pspPeriodEnd),
      metrics: r.pspMetrics as PeriodSnapshotMetrics,
    }))
    .sort((a, b) => a.periodStart.getTime() - b.periodStart.getTime());
}
