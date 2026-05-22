'use server';

import 'server-only';
import { SalError, type ActionResult } from '@v2/shared/errors';
import { getCurrentUser } from '@/lib/auth/get-current-user';
import {
  parseShopeeSales,
  ShopeeSalesParseError,
} from '../services/shopee-sales-parser.service';
import {
  parseShopeeAds,
  ShopeeAdsParseError,
  type ShopeeAdsRow,
} from '../services/shopee-ads-parser.service';
import {
  parseShopeeBrandAds,
  ShopeeBrandAdsParseError,
  type ShopeeBrandAdsRow,
} from '../services/shopee-brand-ads-parser.service';
import {
  parseShopeeOffPlatformAds,
  ShopeeOffPlatformAdsParseError,
  type ShopeeOffPlatformAdsRow,
} from '../services/shopee-off-platform-ads-parser.service';
import {
  parseShopeeTraffic,
  ShopeeTrafficParseError,
  type ShopeeTrafficRow,
} from '../services/shopee-traffic-parser.service';
import {
  parseShopeeAffiliate,
  ShopeeAffiliateParseError,
  type ShopeeAffiliateRow,
} from '../services/shopee-affiliate-parser.service';
import {
  parseTikTokSales,
  TikTokSalesParseError,
} from '../services/tiktok-sales-parser.service';
import {
  parseTikTokTraffic,
  TikTokTrafficParseError,
  type TikTokTrafficRow,
} from '../services/tiktok-traffic-parser.service';
import {
  parseTikTokAffiliate,
  TikTokAffiliateParseError,
  type TikTokAffiliateRow,
} from '../services/tiktok-affiliate-parser.service';
import {
  computeTikTokMetrics,
  TIKTOK_METRIC_SPECS,
  type TikTokMetricsResult,
} from '../services/tiktok-metrics-calculator.service';
import {
  computeShopeeMetrics,
  SHOPEE_METRIC_SPECS,
  type ShopeeMetricsResult,
} from '../services/gmv-calculator.service';
import { loadPrimeCostMaster } from '../services/prime-cost-master.service';

export interface ShopeeMetricsPreview {
  result: ShopeeMetricsResult;
  specs: typeof SHOPEE_METRIC_SPECS;
  master: { skuCount: number };
}

export interface TikTokMetricsPreview {
  result: TikTokMetricsResult;
  specs: typeof TIKTOK_METRIC_SPECS;
  master: { skuCount: number };
}

/**
 * Compute a quick-preview Shopee metrics set. Accepts:
 *   - `sales` (required): Shopee Sales `.xlsx` (Order.all export)
 *   - `ads` (optional): Shopee Ads CSV (CPC Display Service export)
 * Loads `sal_prime_costs` for the current ent to enable Net GMV + Prime Cost.
 * No DB writes.
 */
export async function previewShopeeMetricsAction(
  formData: FormData,
): Promise<ActionResult<ShopeeMetricsPreview>> {
  const salesFile = formData.get('sales');
  const adsFile = formData.get('ads');
  const brandAdsFile = formData.get('brandAds');
  const offPlatformAdsFile = formData.get('offPlatformAds');
  const trafficFile = formData.get('traffic');
  const affiliateFile = formData.get('affiliate');
  if (!(salesFile instanceof File)) {
    return {
      success: false,
      error: { code: 'SAL-E0001', message: 'Sales file is required' },
    };
  }

  try {
    const user = await getCurrentUser();
    const [salesBuffer, master, adsRows, brandAdsRows, offPlatformAdsRows, trafficRows, affiliateRows] =
      await Promise.all([
        salesFile.arrayBuffer(),
        loadPrimeCostMaster(user.entId),
        adsFile instanceof File ? parseAdsBuffer(adsFile) : Promise.resolve<ShopeeAdsRow[] | null>(null),
        brandAdsFile instanceof File
          ? parseBrandAdsBuffer(brandAdsFile)
          : Promise.resolve<ShopeeBrandAdsRow[] | null>(null),
        offPlatformAdsFile instanceof File
          ? parseOffPlatformAdsBuffer(offPlatformAdsFile)
          : Promise.resolve<ShopeeOffPlatformAdsRow[] | null>(null),
        trafficFile instanceof File
          ? parseTrafficBuffer(trafficFile)
          : Promise.resolve<ShopeeTrafficRow[] | null>(null),
        affiliateFile instanceof File
          ? parseAffiliateBuffer(affiliateFile)
          : Promise.resolve<ShopeeAffiliateRow[] | null>(null),
      ]);
    const rows = await parseShopeeSales(salesBuffer);
    const result = computeShopeeMetrics(
      rows,
      master,
      adsRows ?? undefined,
      brandAdsRows ?? undefined,
      offPlatformAdsRows ?? undefined,
      trafficRows ?? undefined,
      affiliateRows ?? undefined,
    );
    return {
      success: true,
      data: {
        result,
        specs: SHOPEE_METRIC_SPECS,
        master: { skuCount: master.size },
      },
    };
  } catch (err) {
    if (err instanceof ShopeeSalesParseError) {
      return { success: false, error: { code: `SAL-PARSE-${err.code}`, message: `Sales: ${err.message}` } };
    }
    if (err instanceof ShopeeAdsParseError) {
      return { success: false, error: { code: `SAL-ADS-${err.code}`, message: `Ads: ${err.message}` } };
    }
    if (err instanceof ShopeeBrandAdsParseError) {
      return { success: false, error: { code: `SAL-BRAND-${err.code}`, message: `Brand Ads: ${err.message}` } };
    }
    if (err instanceof ShopeeOffPlatformAdsParseError) {
      return { success: false, error: { code: `SAL-OFFP-${err.code}`, message: `Off-Platform Ads: ${err.message}` } };
    }
    if (err instanceof ShopeeTrafficParseError) {
      return { success: false, error: { code: `SAL-TRAFFIC-${err.code}`, message: `Traffic: ${err.message}` } };
    }
    if (err instanceof ShopeeAffiliateParseError) {
      return { success: false, error: { code: `SAL-AFF-${err.code}`, message: `Affiliate: ${err.message}` } };
    }
    if (err instanceof SalError) {
      return { success: false, error: { code: err.code, message: err.message } };
    }
    console.error('[preview-calc] unexpected', err);
    return {
      success: false,
      error: {
        code: 'SAL-E0500',
        message: err instanceof Error ? err.message : 'Unknown error',
      },
    };
  }
}

async function parseAdsBuffer(file: File): Promise<ShopeeAdsRow[]> {
  const buf = await file.arrayBuffer();
  return parseShopeeAds(buf);
}

async function parseBrandAdsBuffer(file: File): Promise<ShopeeBrandAdsRow[]> {
  const buf = await file.arrayBuffer();
  return parseShopeeBrandAds(buf);
}

async function parseOffPlatformAdsBuffer(file: File): Promise<ShopeeOffPlatformAdsRow[]> {
  const buf = await file.arrayBuffer();
  return parseShopeeOffPlatformAds(buf);
}

async function parseTrafficBuffer(file: File): Promise<ShopeeTrafficRow[]> {
  const buf = await file.arrayBuffer();
  return parseShopeeTraffic(buf);
}

async function parseAffiliateBuffer(file: File): Promise<ShopeeAffiliateRow[]> {
  const buf = await file.arrayBuffer();
  return parseShopeeAffiliate(buf);
}

/**
 * Compute TikTok metrics from a freshly-uploaded TikTok Sales `.xlsx` (OrderSKUList).
 * Joins with `sal_prime_costs` master for Net GMV (uses original_price) + Prime Cost.
 * Note: TikTok GMV uses LISTING price (not selling — opposite of Shopee).
 */
export async function previewTikTokMetricsAction(
  formData: FormData,
): Promise<ActionResult<TikTokMetricsPreview>> {
  const salesFile = formData.get('sales');
  const trafficFile = formData.get('traffic');
  const affiliateFile = formData.get('affiliate');
  if (!(salesFile instanceof File)) {
    return {
      success: false,
      error: { code: 'SAL-E0001', message: 'TikTok Sales file is required' },
    };
  }
  try {
    const user = await getCurrentUser();
    const [buffer, master, trafficRows, affiliateRows] = await Promise.all([
      salesFile.arrayBuffer(),
      loadPrimeCostMaster(user.entId),
      trafficFile instanceof File
        ? parseTikTokTrafficBuffer(trafficFile)
        : Promise.resolve<TikTokTrafficRow[] | null>(null),
      affiliateFile instanceof File
        ? parseTikTokAffiliateBuffer(affiliateFile)
        : Promise.resolve<TikTokAffiliateRow[] | null>(null),
    ]);
    const rows = await parseTikTokSales(buffer);
    const result = computeTikTokMetrics(
      rows,
      master,
      trafficRows ?? undefined,
      affiliateRows ?? undefined,
    );
    return {
      success: true,
      data: { result, specs: TIKTOK_METRIC_SPECS, master: { skuCount: master.size } },
    };
  } catch (err) {
    if (err instanceof TikTokSalesParseError) {
      return { success: false, error: { code: `SAL-TT-${err.code}`, message: `TikTok Sales: ${err.message}` } };
    }
    if (err instanceof TikTokTrafficParseError) {
      return { success: false, error: { code: `SAL-TT-TRAFFIC-${err.code}`, message: `TikTok Traffic: ${err.message}` } };
    }
    if (err instanceof TikTokAffiliateParseError) {
      return { success: false, error: { code: `SAL-TT-AFF-${err.code}`, message: `TikTok Affiliate: ${err.message}` } };
    }
    if (err instanceof SalError) {
      return { success: false, error: { code: err.code, message: err.message } };
    }
    console.error('[tiktok-preview] unexpected', err);
    return {
      success: false,
      error: { code: 'SAL-E0500', message: err instanceof Error ? err.message : 'Unknown error' },
    };
  }
}

async function parseTikTokTrafficBuffer(file: File): Promise<TikTokTrafficRow[]> {
  const buf = await file.arrayBuffer();
  return parseTikTokTraffic(buf);
}

async function parseTikTokAffiliateBuffer(file: File): Promise<TikTokAffiliateRow[]> {
  const buf = await file.arrayBuffer();
  return parseTikTokAffiliate(buf);
}
