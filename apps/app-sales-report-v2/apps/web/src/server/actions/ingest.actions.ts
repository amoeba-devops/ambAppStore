'use server';

import 'server-only';
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
  type PeriodSnapshotMetrics,
} from '@/server/services/period-snapshot.service';

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
    const tiktokPlatformFeeRatePct = numFromForm(formData, 'tiktokPlatformFeeRatePct') ?? 24;

    // Parse Shopee files in parallel
    const [
      shopeeSalesBuffer,
      shopeeAdsBuffer,
      shopeeBrandAdsBuffer,
      shopeeOffPlatformAdsBuffer,
      shopeeTrafficBuffer,
      shopeeAffiliateBuffer,
      tiktokSalesBuffer,
      tiktokTrafficBuffer,
      tiktokAffiliateBuffer,
      master,
    ] = await Promise.all([
      bufferFromForm(formData, 'shopee_sales'),
      bufferFromForm(formData, 'shopee_ads'),
      bufferFromForm(formData, 'shopee_brand_ads'),
      bufferFromForm(formData, 'shopee_off_platform_ads'),
      bufferFromForm(formData, 'shopee_traffic'),
      bufferFromForm(formData, 'shopee_affiliate'),
      bufferFromForm(formData, 'tiktok_sales'),
      bufferFromForm(formData, 'tiktok_traffic'),
      bufferFromForm(formData, 'tiktok_affiliate'),
      loadPrimeCostMaster(user.entId),
    ]);

    // Shopee compute (requires sales)
    let shopee: PeriodSnapshotMetrics['shopee'] | null = null;
    if (shopeeSalesBuffer) {
      const [salesRows, adsRows, brandRows, offPlatformRows, trafficRows, affiliateRows] =
        await Promise.all([
          parseShopeeSales(shopeeSalesBuffer),
          shopeeAdsBuffer ? parseShopeeAds(shopeeAdsBuffer) : Promise.resolve(null),
          shopeeBrandAdsBuffer ? parseShopeeBrandAds(shopeeBrandAdsBuffer) : Promise.resolve(null),
          shopeeOffPlatformAdsBuffer
            ? parseShopeeOffPlatformAds(shopeeOffPlatformAdsBuffer)
            : Promise.resolve(null),
          shopeeTrafficBuffer ? parseShopeeTraffic(shopeeTrafficBuffer) : Promise.resolve(null),
          shopeeAffiliateBuffer ? parseShopeeAffiliate(shopeeAffiliateBuffer) : Promise.resolve(null),
        ]);
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
        totalAdSpending: r.ads?.totalCost ?? 0,
        totalBrandAds: r.brandAds?.totalCost ?? 0,
        totalOffPlatformAds: r.offPlatformAds?.totalCost ?? 0,
        totalPageViews: r.traffic?.totalPageViews ?? 0,
        totalAffiliateCommission: r.affiliate?.totalCost ?? 0,
      };
    }

    // TikTok compute (requires sales)
    let tiktok: PeriodSnapshotMetrics['tiktok'] | null = null;
    if (tiktokSalesBuffer) {
      const [salesRows, trafficRows, affiliateRows] = await Promise.all([
        parseTikTokSales(tiktokSalesBuffer),
        tiktokTrafficBuffer ? parseTikTokTraffic(tiktokTrafficBuffer) : Promise.resolve(null),
        tiktokAffiliateBuffer ? parseTikTokAffiliate(tiktokAffiliateBuffer) : Promise.resolve(null),
      ]);
      const r = computeTikTokMetrics(
        salesRows,
        master,
        trafficRows ?? undefined,
        affiliateRows ?? undefined,
      );
      tiktok = {
        totalGmv: r.totalGmv,
        totalNetGmv: r.totalNetGmv,
        totalNmv: r.totalNmv,
        totalSellerDiscount: r.totalSellerDiscount,
        totalPrimeCost: r.totalPrimeCost,
        primeCostKept: r.primeCostKept,
        primeCostFreeGift: r.primeCostFreeGift,
        rowsKept: r.rowsKept,
        rowsExcluded: r.rowsExcluded,
        totalPageViews: r.traffic?.totalPageViews ?? 0,
        totalAffiliateCommission: r.affiliate?.totalCommission ?? 0,
      };
    }

    if (!shopee && !tiktok) {
      return {
        success: false,
        error: {
          code: 'SAL-E0410',
          message: 'At least one platform Sales file is required (Shopee or TikTok)',
        },
      };
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
      periodStart: new Date(periodStartIso),
      periodEnd: new Date(periodEndIso),
      granularity,
      weekNum,
      monthIdx,
      year,
      metrics,
    });

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

async function bufferFromForm(formData: FormData, name: string): Promise<ArrayBuffer | null> {
  const f = formData.get(name);
  if (!(f instanceof File)) return null;
  return f.arrayBuffer();
}

function numFromForm(formData: FormData, name: string): number | undefined {
  const v = formData.get(name);
  if (v == null) return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

function emptyShopeeMetrics(): PeriodSnapshotMetrics['shopee'] {
  return {
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
    totalAdSpending: 0,
    totalBrandAds: 0,
    totalOffPlatformAds: 0,
    totalPageViews: 0,
    totalAffiliateCommission: 0,
  };
}

function emptyTikTokMetrics(): PeriodSnapshotMetrics['tiktok'] {
  return {
    totalGmv: 0,
    totalNetGmv: 0,
    totalNmv: 0,
    totalSellerDiscount: 0,
    totalPrimeCost: 0,
    primeCostKept: 0,
    primeCostFreeGift: 0,
    rowsKept: 0,
    rowsExcluded: { cancelled: 0, returned: 0, freeGift: 0 },
    totalPageViews: 0,
    totalAffiliateCommission: 0,
  };
}
