'use server';

import 'server-only';
import { and, eq } from 'drizzle-orm';
import { db, schema, withEnt } from '@v2/db';
import { SalError, type ActionResult } from '@v2/shared/errors';
import { getCurrentUser } from '@/lib/auth/get-current-user';
import { loadPrimeCostMaster } from '@/server/services/prime-cost-master.service';
import {
  parseShopeeSales,
  ShopeeSalesParseError,
} from '@/server/services/shopee-sales-parser.service';
import {
  parseShopeeAds,
  ShopeeAdsParseError,
} from '@/server/services/shopee-ads-parser.service';
import {
  parseShopeeBrandAds,
  ShopeeBrandAdsParseError,
} from '@/server/services/shopee-brand-ads-parser.service';
import {
  parseShopeeOffPlatformAds,
  ShopeeOffPlatformAdsParseError,
} from '@/server/services/shopee-off-platform-ads-parser.service';
import {
  parseShopeeTraffic,
  ShopeeTrafficParseError,
} from '@/server/services/shopee-traffic-parser.service';
import {
  parseShopeeAffiliate,
  ShopeeAffiliateParseError,
} from '@/server/services/shopee-affiliate-parser.service';
import {
  parseTikTokSales,
  TikTokSalesParseError,
} from '@/server/services/tiktok-sales-parser.service';
import {
  parseTikTokTraffic,
  TikTokTrafficParseError,
} from '@/server/services/tiktok-traffic-parser.service';
import {
  parseTikTokAffiliate,
  TikTokAffiliateParseError,
} from '@/server/services/tiktok-affiliate-parser.service';
import { computeShopeeMetrics } from '@/server/services/gmv-calculator.service';
import { computeTikTokMetrics } from '@/server/services/tiktok-metrics-calculator.service';
import {
  savePeriodSnapshot,
  loadPeriodSnapshot,
  listAllPeriodSnapshots,
  type PeriodSnapshotMetrics,
  type PeriodSnapshotRow,
} from '@/server/services/period-snapshot.service';
import {
  archiveFile,
  loadActiveArchiveBuffer,
  type ArchiveChannel,
  type ArchiveFileType,
} from '@/server/services/archive-files.service';

export interface CommitIngestResult {
  pspId: string;
  isNew: boolean;
  metrics: PeriodSnapshotMetrics;
}

/**
 * Commit ingest — parses all uploaded files, computes metrics, persists
 * a period snapshot. Called from Step 6 (Confirm ingest).
 *
 * FormData contract:
 *   - granularity: 'WEEKLY' | 'MONTHLY'
 *   - weekNum / monthIdx, year, periodStart, periodEnd (ISO date strings)
 *   - 9 file slots (any subset, but `shopee_sales` is required for Shopee compute):
 *     shopee_sales, shopee_ads, shopee_brand_ads, shopee_off_platform_ads,
 *     shopee_traffic, shopee_affiliate
 *     tiktok_sales, tiktok_traffic, tiktok_affiliate
 *   - Manual input numeric fields:
 *     affiliateBookingFees, shopeeLivestreamFees, tiktokLivestreamFees, tiktokAdsSpending
 *   - Constants:
 *     tiktokPlatformFeeRatePct
 */
export async function commitIngestAction(
  formData: FormData,
): Promise<ActionResult<CommitIngestResult>> {
  try {
    const user = await getCurrentUser();

    const granularity = (formData.get('granularity') as 'WEEKLY' | 'MONTHLY') ?? 'WEEKLY';
    const weekNum = numFromForm(formData, 'weekNum');
    const monthIdx = numFromForm(formData, 'monthIdx');
    const year = numFromForm(formData, 'year') ?? new Date().getUTCFullYear();
    const periodStartIso = formData.get('periodStart') as string | null;
    const periodEndIso = formData.get('periodEnd') as string | null;
    if (!periodStartIso || !periodEndIso) {
      return {
        success: false,
        error: { code: 'SAL-E0400', message: 'periodStart and periodEnd required' },
      };
    }

    const manualInputs = {
      affiliateBookingFees: numFromForm(formData, 'affiliateBookingFees') ?? 0,
      shopeeLivestreamFees: numFromForm(formData, 'shopeeLivestreamFees') ?? 0,
      tiktokLivestreamFees: numFromForm(formData, 'tiktokLivestreamFees') ?? 0,
      tiktokAdsSpending: numFromForm(formData, 'tiktokAdsSpending') ?? 0,
    };
    // TikTok platform fee rate: 24% until 2026-05-07, then 26% from 2026-05-08
    // onwards (per TikTok Shop policy update communicated by client).
    // Use periodStart as the cutoff — boundary aligns with weekly Mon-Sun, so
    // weeks fall cleanly on one rate or the other. Caller can still override
    // via formData if needed.
    const defaultTiktokRate = periodStartIso >= '2026-05-08' ? 26 : 24;
    const tiktokPlatformFeeRatePct =
      numFromForm(formData, 'tiktokPlatformFeeRatePct') ?? defaultTiktokRate;

    // Re-ingest support: when a slot is empty in the form payload, fall back
    // to the most-recent archived file for the same (period, channel, type).
    // This lets the Operator upload only the *new* report in Step 2 and have
    // the existing files merged automatically. See [[archive-files.service]].
    const slotOrArchive = async (
      formField: string,
      channel: ArchiveChannel,
      fileType: ArchiveFileType,
    ): Promise<UploadedFile | null> => {
      const fromForm = await bufferFromForm(formData, formField);
      if (fromForm) return fromForm;
      return loadActiveArchiveBuffer({
        entId: user.entId,
        granularity,
        weekNum: weekNum ?? null,
        monthIdx: monthIdx ?? null,
        year,
        channel,
        fileType,
      });
    };

    // Parse Shopee files in parallel
    const [
      shopeeSalesFile,
      shopeeAdsFile,
      shopeeBrandAdsFile,
      shopeeOffPlatformAdsFile,
      shopeeTrafficFile,
      shopeeAffiliateFile,
      tiktokSalesFile,
      tiktokTrafficFile,
      tiktokAffiliateFile,
      master,
    ] = await Promise.all([
      slotOrArchive('shopee_sales', 'SHOPEE', 'SALES'),
      slotOrArchive('shopee_ads', 'SHOPEE', 'ADS'),
      slotOrArchive('shopee_brand_ads', 'SHOPEE', 'BRAND_ADS'),
      slotOrArchive('shopee_off_platform_ads', 'SHOPEE', 'OFF_PLATFORM_ADS'),
      slotOrArchive('shopee_traffic', 'SHOPEE', 'TRAFFIC'),
      slotOrArchive('shopee_affiliate', 'SHOPEE', 'AFFILIATE'),
      slotOrArchive('tiktok_sales', 'TIKTOK', 'SALES'),
      slotOrArchive('tiktok_traffic', 'TIKTOK', 'TRAFFIC'),
      slotOrArchive('tiktok_affiliate', 'TIKTOK', 'AFFILIATE'),
      loadPrimeCostMaster(user.entId),
    ]);

    // Row counts captured during parsing so each archived file can record how
    // many rows it contributed. Keyed by `${channel}/${fileType}`.
    const rowCounts = new Map<string, number>();

    // Shopee compute (requires sales)
    let shopee: PeriodSnapshotMetrics['shopee'] | null = null;
    if (shopeeSalesFile) {
      const [salesRows, adsRows, brandRows, offPlatformRows, trafficRows, affiliateRows] =
        await Promise.all([
          parseWithContext('Shopee Sales', shopeeSalesFile, parseShopeeSales),
          shopeeAdsFile
            ? parseWithContext('Shopee Ads', shopeeAdsFile, parseShopeeAds)
            : Promise.resolve(null),
          shopeeBrandAdsFile
            ? parseWithContext('Shopee Brand Ads', shopeeBrandAdsFile, parseShopeeBrandAds)
            : Promise.resolve(null),
          shopeeOffPlatformAdsFile
            ? parseWithContext(
                'Shopee Off-Platform Ads',
                shopeeOffPlatformAdsFile,
                parseShopeeOffPlatformAds,
              )
            : Promise.resolve(null),
          shopeeTrafficFile
            ? parseWithContext('Shopee Traffic', shopeeTrafficFile, parseShopeeTraffic)
            : Promise.resolve(null),
          shopeeAffiliateFile
            ? parseWithContext('Shopee Affiliate', shopeeAffiliateFile, parseShopeeAffiliate)
            : Promise.resolve(null),
        ]);
      rowCounts.set('SHOPEE/SALES', salesRows.length);
      if (adsRows) rowCounts.set('SHOPEE/ADS', adsRows.length);
      if (brandRows) rowCounts.set('SHOPEE/BRAND_ADS', brandRows.length);
      if (offPlatformRows) rowCounts.set('SHOPEE/OFF_PLATFORM_ADS', offPlatformRows.length);
      if (trafficRows) rowCounts.set('SHOPEE/TRAFFIC', trafficRows.length);
      if (affiliateRows) rowCounts.set('SHOPEE/AFFILIATE', affiliateRows.length);
      const r = computeShopeeMetrics(
        salesRows,
        master,
        adsRows ?? undefined,
        brandRows ?? undefined,
        offPlatformRows ?? undefined,
        trafficRows ?? undefined,
        affiliateRows ?? undefined,
      );
      shopee = {
        totalItemSold: r.totalItemSold,
        totalGmv: r.totalGmv,
        totalNetGmv: r.totalNetGmv,
        totalNmv: r.totalNmv,
        totalSellerDiscount: r.totalSellerDiscount,
        totalPrimeCost: r.totalPrimeCost,
        primeCostKept: r.primeCostKept,
        primeCostFreeGift: r.primeCostFreeGift,
        totalSellerVouchers: r.totalSellerVouchers,
        totalPlatformFee: r.totalPlatformFee,
        totalPlatformDiscount: r.totalPlatformDiscount,
        rowsKept: r.rowsKept,
        rowsExcluded: r.rowsExcluded,
        orderCounts: r.orderCounts,
        productBreakdown: r.productBreakdown,
        giftBreakdown: r.giftBreakdown,
        totalAdSpending: r.ads?.totalCost ?? 0,
        totalAdRevenue: r.ads?.totalRevenue ?? 0,
        shopGmvMaxCost: r.ads?.shopGmvMaxCost ?? 0,
        shopAdsCost: r.ads?.shopAdsCost ?? 0,
        totalBrandAds: r.brandAds?.totalCost ?? 0,
        totalOffPlatformAds: r.offPlatformAds?.totalCost ?? 0,
        totalPageViews: r.traffic?.totalPageViews ?? 0,
        totalAffiliateCommission: r.affiliate?.totalCost ?? 0,
      };
    }

    // TikTok compute (requires sales)
    let tiktok: PeriodSnapshotMetrics['tiktok'] | null = null;
    if (tiktokSalesFile) {
      const [salesRows, trafficRows, affiliateRows] = await Promise.all([
        parseWithContext('TikTok Sales', tiktokSalesFile, parseTikTokSales),
        tiktokTrafficFile
          ? parseWithContext('TikTok Traffic', tiktokTrafficFile, parseTikTokTraffic)
          : Promise.resolve(null),
        tiktokAffiliateFile
          ? parseWithContext('TikTok Affiliate', tiktokAffiliateFile, parseTikTokAffiliate)
          : Promise.resolve(null),
      ]);
      rowCounts.set('TIKTOK/SALES', salesRows.length);
      if (trafficRows) rowCounts.set('TIKTOK/TRAFFIC', trafficRows.length);
      if (affiliateRows) rowCounts.set('TIKTOK/AFFILIATE', affiliateRows.length);
      const r = computeTikTokMetrics(
        salesRows,
        master,
        trafficRows ?? undefined,
        affiliateRows ?? undefined,
        tiktokPlatformFeeRatePct,
      );
      tiktok = {
        totalItemSold: r.totalItemSold,
        totalGmv: r.totalGmv,
        totalNetGmv: r.totalNetGmv,
        totalNmv: r.totalNmv,
        totalSellerDiscount: r.totalSellerDiscount,
        totalPlatformDiscount: r.totalPlatformDiscount,
        totalPlatformFee: r.totalPlatformFee,
        totalPrimeCost: r.totalPrimeCost,
        primeCostKept: r.primeCostKept,
        primeCostFreeGift: r.primeCostFreeGift,
        rowsKept: r.rowsKept,
        rowsExcluded: r.rowsExcluded,
        orderCounts: r.orderCounts,
        productBreakdown: r.productBreakdown,
        giftBreakdown: r.giftBreakdown,
        totalPageViews: r.traffic?.totalPageViews ?? 0,
        totalAffiliateCommission: r.affiliate?.totalCommission ?? 0,
      };
    }

    const periodStart = new Date(periodStartIso);
    const periodEnd = new Date(periodEndIso);

    // No files uploaded → "manual-input-only" re-ingest path. Load the
    // existing snapshot, swap in the new manualInputs + tiktokPlatformFeeRatePct,
    // and save. Used when an Operator re-opens an Active period just to fix
    // Manual Input values without re-uploading raw files.
    if (!shopee && !tiktok) {
      const existing = await loadPeriodSnapshot({
        entId: user.entId,
        granularity,
        weekNum,
        monthIdx,
        year,
      });
      if (!existing) {
        return {
          success: false,
          error: {
            code: 'SAL-E0410',
            message:
              'At least one platform Sales file is required (no existing snapshot to update)',
          },
        };
      }
      const updated: PeriodSnapshotMetrics = {
        ...existing,
        manualInputs,
        constants: { tiktokPlatformFeeRatePct },
        computedAt: new Date().toISOString(),
      };
      const { pspId, isNew } = await savePeriodSnapshot({
        entId: user.entId,
        userId: user.userId,
        periodStart,
        periodEnd,
        granularity,
        weekNum,
        monthIdx,
        year,
        metrics: updated,
      });
      return { success: true, data: { pspId, isNew, metrics: updated } };
    }

    const metrics: PeriodSnapshotMetrics = {
      version: 1,
      shopee: shopee ?? emptyShopeeMetrics(),
      tiktok: tiktok ?? emptyTikTokMetrics(),
      manualInputs,
      constants: { tiktokPlatformFeeRatePct },
      computedAt: new Date().toISOString(),
    };

    const { pspId, isNew } = await savePeriodSnapshot({
      entId: user.entId,
      userId: user.userId,
      periodStart,
      periodEnd,
      granularity,
      weekNum,
      monthIdx,
      year,
      metrics,
    });

    // Archive raw files — persists file metadata (and S3 upload when
    // credentials configured). Best-effort: errors are logged but don't
    // fail the ingest, since snapshot is already saved.
    const archivePlan: Array<{
      file: UploadedFile | null;
      channel: ArchiveChannel;
      fileType: ArchiveFileType;
    }> = [
      { file: shopeeSalesFile, channel: 'SHOPEE', fileType: 'SALES' },
      { file: shopeeAdsFile, channel: 'SHOPEE', fileType: 'ADS' },
      { file: shopeeBrandAdsFile, channel: 'SHOPEE', fileType: 'BRAND_ADS' },
      { file: shopeeOffPlatformAdsFile, channel: 'SHOPEE', fileType: 'OFF_PLATFORM_ADS' },
      { file: shopeeTrafficFile, channel: 'SHOPEE', fileType: 'TRAFFIC' },
      { file: shopeeAffiliateFile, channel: 'SHOPEE', fileType: 'AFFILIATE' },
      { file: tiktokSalesFile, channel: 'TIKTOK', fileType: 'SALES' },
      { file: tiktokTrafficFile, channel: 'TIKTOK', fileType: 'TRAFFIC' },
      { file: tiktokAffiliateFile, channel: 'TIKTOK', fileType: 'AFFILIATE' },
    ];
    for (const item of archivePlan) {
      if (!item.file) continue;
      try {
        await archiveFile({
          entId: user.entId,
          uploadedBy: user.userId,
          periodStart,
          periodEnd,
          granularity,
          weekNum: weekNum ?? null,
          monthIdx: monthIdx ?? null,
          year,
          channel: item.channel,
          fileType: item.fileType,
          filename: item.file.filename,
          buffer: item.file.buffer,
          rowCount: rowCounts.get(`${item.channel}/${item.fileType}`) ?? null,
        });
      } catch (err) {
        console.error(
          `[archive-files] failed to archive ${item.channel}/${item.fileType}:`,
          err instanceof Error ? err.message : err,
        );
      }
    }

    return { success: true, data: { pspId, isNew, metrics } };
  } catch (err) {
    if (
      err instanceof ShopeeSalesParseError ||
      err instanceof ShopeeAdsParseError ||
      err instanceof ShopeeBrandAdsParseError ||
      err instanceof ShopeeOffPlatformAdsParseError ||
      err instanceof ShopeeTrafficParseError ||
      err instanceof ShopeeAffiliateParseError ||
      err instanceof TikTokSalesParseError ||
      err instanceof TikTokTrafficParseError ||
      err instanceof TikTokAffiliateParseError
    ) {
      return { success: false, error: { code: 'SAL-PARSE', message: err.message } };
    }
    if (err instanceof SalError) {
      return { success: false, error: { code: err.code, message: err.message } };
    }
    console.error('[commit-ingest] unexpected', err);
    return {
      success: false,
      error: { code: 'SAL-E0500', message: err instanceof Error ? err.message : 'Unknown error' },
    };
  }
}

/**
 * Update only the `manualInputs` block of an existing snapshot — used by the
 * Raw Archive Manual Input edit modal. Reports will pick up the new values on
 * next load. Returns updated metrics so the caller can update local cache.
 */
export async function updateSnapshotManualInputsAction(input: {
  granularity: 'WEEKLY' | 'MONTHLY';
  weekNum?: number;
  monthIdx?: number;
  year: number;
  manualInputs: Record<string, number>;
}): Promise<ActionResult<{ updated: boolean }>> {
  try {
    const user = await getCurrentUser();
    const existing = await loadPeriodSnapshot({
      entId: user.entId,
      granularity: input.granularity,
      weekNum: input.weekNum,
      monthIdx: input.monthIdx,
      year: input.year,
    });
    if (!existing) {
      return {
        success: false,
        error: { code: 'SAL-E0404', message: 'Snapshot not found for this period' },
      };
    }
    // Coerce manualInput values to numbers, then merge over existing
    const numericInputs: Record<string, number> = {};
    for (const [k, v] of Object.entries(input.manualInputs)) {
      const n = Number(v);
      if (Number.isFinite(n)) numericInputs[k] = n;
    }
    const next: PeriodSnapshotMetrics = {
      ...existing,
      manualInputs: { ...existing.manualInputs, ...numericInputs },
      computedAt: new Date().toISOString(),
    };
    // Reuse savePeriodSnapshot to upsert by period key
    const periodStart = new Date();
    const periodEnd = new Date();
    // We need periodStart/End — query the existing snapshot's row to get them
    const row = await db
      .select({
        periodStart: schema.salPeriodSnapshots.pspPeriodStart,
        periodEnd: schema.salPeriodSnapshots.pspPeriodEnd,
        pspId: schema.salPeriodSnapshots.pspId,
      })
      .from(schema.salPeriodSnapshots)
      .where(
        and(
          withEnt(schema.salPeriodSnapshots.entId, user.entId),
          eq(schema.salPeriodSnapshots.pspGranularity, input.granularity),
          eq(schema.salPeriodSnapshots.pspYear, input.year),
          input.granularity === 'WEEKLY' && input.weekNum != null
            ? eq(schema.salPeriodSnapshots.pspWeekNum, input.weekNum)
            : input.monthIdx != null
              ? eq(schema.salPeriodSnapshots.pspMonthIdx, input.monthIdx)
              : undefined,
        ),
      )
      .limit(1);
    if (!row[0]) {
      return {
        success: false,
        error: { code: 'SAL-E0404', message: 'Snapshot row not found' },
      };
    }
    await db
      .update(schema.salPeriodSnapshots)
      .set({ pspMetrics: next, pspUpdatedAt: new Date() })
      .where(eq(schema.salPeriodSnapshots.pspId, row[0].pspId));
    void periodStart;
    void periodEnd;
    return { success: true, data: { updated: true } };
  } catch (err) {
    if (err instanceof SalError) {
      return { success: false, error: { code: err.code, message: err.message } };
    }
    console.error('[updateSnapshotManualInputs]', err);
    return {
      success: false,
      error: { code: 'SAL-E0500', message: err instanceof Error ? err.message : 'Unknown error' },
    };
  }
}

/**
 * Load snapshot for a specific week/month — used by Weekly/Monthly Report
 * dashboards. Returns null if no snapshot exists (caller should fallback to mock).
 */
export async function loadSnapshotAction(input: {
  granularity: 'WEEKLY' | 'MONTHLY';
  weekNum?: number;
  monthIdx?: number;
  year: number;
}): Promise<ActionResult<{ metrics: PeriodSnapshotMetrics | null }>> {
  try {
    const user = await getCurrentUser();
    const metrics = await loadPeriodSnapshot({
      entId: user.entId,
      granularity: input.granularity,
      weekNum: input.weekNum,
      monthIdx: input.monthIdx,
      year: input.year,
    });
    return { success: true, data: { metrics } };
  } catch (err) {
    if (err instanceof SalError) {
      return { success: false, error: { code: err.code, message: err.message } };
    }
    console.error('[load-snapshot] unexpected', err);
    return {
      success: false,
      error: { code: 'SAL-E0500', message: err instanceof Error ? err.message : 'Unknown error' },
    };
  }
}

/**
 * Load every snapshot for an entity at a chosen granularity — used by the
 * Trends page to build a time-series.
 */
export async function listSnapshotsAction(input: {
  granularity: 'WEEKLY' | 'MONTHLY';
}): Promise<ActionResult<{ rows: PeriodSnapshotRow[] }>> {
  try {
    const user = await getCurrentUser();
    const rows = await listAllPeriodSnapshots(user.entId, input.granularity);
    return { success: true, data: { rows } };
  } catch (err) {
    if (err instanceof SalError) {
      return { success: false, error: { code: err.code, message: err.message } };
    }
    console.error('[list-snapshots] unexpected', err);
    return {
      success: false,
      error: { code: 'SAL-E0500', message: err instanceof Error ? err.message : 'Unknown error' },
    };
  }
}

interface UploadedFile {
  buffer: ArrayBuffer;
  filename: string;
  size: number;
}

async function bufferFromForm(formData: FormData, name: string): Promise<UploadedFile | null> {
  const f = formData.get(name);
  if (!(f instanceof File)) return null;
  const buffer = await f.arrayBuffer();
  if (buffer.byteLength === 0) return null;
  return { buffer, filename: f.name, size: buffer.byteLength };
}

/**
 * Wrap a parser call so any thrown error gets prefixed with the slot label +
 * filename. Makes "Failed to unzip xlsx" debuggable without server logs.
 */
async function parseWithContext<T>(
  slotLabel: string,
  file: UploadedFile,
  parser: (buf: ArrayBuffer) => Promise<T>,
): Promise<T> {
  try {
    return await parser(file.buffer);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const ctx = `[${slotLabel}: "${file.filename}", ${file.size}B] ${msg}`;
    if (err instanceof Error) {
      err.message = ctx;
      throw err;
    }
    throw new Error(ctx);
  }
}

function numFromForm(formData: FormData, name: string): number | undefined {
  const v = formData.get(name);
  if (v == null) return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

function emptyShopeeMetrics(): PeriodSnapshotMetrics['shopee'] {
  return {
    totalItemSold: 0,
    totalGmv: 0,
    totalNetGmv: 0,
    totalNmv: 0,
    totalSellerDiscount: 0,
    totalPrimeCost: 0,
    primeCostKept: 0,
    primeCostFreeGift: 0,
    totalSellerVouchers: 0,
    totalPlatformFee: 0,
    totalPlatformDiscount: 0,
    rowsKept: 0,
    rowsExcluded: { cancelled: 0, returned: 0, freeGift: 0 },
    orderCounts: { totalDistinct: 0, cancelled: 0, nonCancelled: 0 },
    productBreakdown: [],
    giftBreakdown: [],
    totalAdSpending: 0,
    totalAdRevenue: 0,
    shopGmvMaxCost: 0,
    shopAdsCost: 0,
    totalBrandAds: 0,
    totalOffPlatformAds: 0,
    totalPageViews: 0,
    totalAffiliateCommission: 0,
  };
}

function emptyTikTokMetrics(): PeriodSnapshotMetrics['tiktok'] {
  return {
    totalItemSold: 0,
    totalGmv: 0,
    totalNetGmv: 0,
    totalNmv: 0,
    totalSellerDiscount: 0,
    totalPlatformDiscount: 0,
    totalPlatformFee: 0,
    totalPrimeCost: 0,
    primeCostKept: 0,
    primeCostFreeGift: 0,
    rowsKept: 0,
    rowsExcluded: { cancelled: 0, returned: 0, freeGift: 0 },
    orderCounts: { totalDistinct: 0, cancelled: 0, nonCancelled: 0 },
    productBreakdown: [],
    giftBreakdown: [],
    totalPageViews: 0,
    totalAffiliateCommission: 0,
  };
}
