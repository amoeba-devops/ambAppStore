import 'server-only';
import type { ShopeeSaleRow } from './shopee-sales-parser.service';
import { aggregateAds, type ShopeeAdsRow } from './shopee-ads-parser.service';
import { aggregateBrandAds, type ShopeeBrandAdsRow } from './shopee-brand-ads-parser.service';
import {
  aggregateOffPlatformAds,
  type ShopeeOffPlatformAdsRow,
} from './shopee-off-platform-ads-parser.service';
import { aggregateTraffic, type ShopeeTrafficRow } from './shopee-traffic-parser.service';
import {
  aggregateAffiliate,
  type ShopeeAffiliateRow,
} from './shopee-affiliate-parser.service';

export type ExclusionReason = 'CANCELLED' | 'RETURNED' | 'FREE_GIFT_GIFT_PREFIX' | 'FREE_GIFT_NMV_FALLBACK';

/** Prime cost master keyed by SKU code — passed in from caller (DB lookup). */
export interface PrimeCostMaster {
  /** Per-unit prime cost in VND. */
  primeCost: number;
  /** Per-unit selling price in VND (for Shopee Net GMV). */
  sellingPrice: number;
  /** Per-unit listing price in VND (for TikTok GMV). */
  listingPrice: number;
  /** English product name (for Product Breakdown display). May be empty. */
  productNameEn: string;
}
export type PrimeCostMap = Map<string, PrimeCostMaster>;

export interface ShopeeMetricsResult {
  /** SUM(item_sold) for kept rows. */
  totalItemSold: number;
  /** SUM(original_price × item_sold) for kept rows. */
  totalGmv: number;
  /** SUM(selling_price × item_sold) for kept rows. */
  totalNetGmv: number;
  /** SUM(nmv col) for kept rows. */
  totalNmv: number;
  /** SUM(MAX(0, net_gmv_row − nmv_row)) for kept rows — per-row clamped. */
  totalSellerDiscount: number;
  /** SUM(prime_cost × item_sold) for kept rows + free gift rows. */
  totalPrimeCost: number;
  /** Split for reporting transparency. */
  primeCostKept: number;
  primeCostFreeGift: number;
  /** Sum of MAX(shopVoucher + shopCombo) per non-cancelled order. */
  totalSellerVouchers: number;
  /** Sum of MAX(fixedFee + serviceFee + paymentFee) per non-cancelled order. */
  totalPlatformFee: number;
  /** Sum of MAX(shopeeVoucher) per non-cancelled order — platform-funded discount, reference only. */
  totalPlatformDiscount: number;
  /** Distinct order counts for transparency. */
  orderCounts: { totalDistinct: number; cancelled: number; nonCancelled: number };
  /** Ads spending — only populated when Ads CSV is provided. */
  ads: {
    totalCost: number;
    totalRevenue: number;
    shopWideCost: number;
    shopGmvMaxCost: number;
    shopAdsCost: number;
    productSpecificCost: number;
    campaignCount: number;
    productSpecificCount: number;
    perProduct: Array<{ productId: string; campaignName: string; cost: number; sold: number; revenue: number }>;
  } | null;
  /** Brand Ads spending — only populated when Brand Ads CSV is provided. */
  brandAds: {
    totalCost: number;
    campaignCount: number;
    activeCampaignCount: number;
  } | null;
  /** Off-Platform Ads spending — only populated when Off-Platform Ads CSV is provided. */
  offPlatformAds: {
    totalCost: number;
    totalGmv: number;
    totalOrders: number;
    dayCount: number;
  } | null;
  /** Traffic metrics — only populated when Traffic xlsx is provided. */
  traffic: {
    totalPageViews: number;
    totalProductViews: number;
    totalVisitors: number;
    productCount: number;
  } | null;
  /** Affiliate commission — only populated when Affiliate CSV is provided. */
  affiliate: {
    totalCost: number;
    totalPureCommission: number;
    rowCount: number;
    orderCount: number;
    statusBreakdown: Record<string, number>;
  } | null;
  /** Counts. */
  rowsKept: number;
  rowsExcluded: { cancelled: number; returned: number; freeGift: number };
  /** Distinct product names detected as free gift. */
  freeGiftProducts: string[];
  /** Per-product GMV breakdown, sorted desc by gmv. */
  productBreakdown: Array<{
    productName: string;
    productNameEn: string;
    representativeSku: string;
    gmv: number;
    netGmv: number;
    nmv: number;
    sellerDiscount: number;
    primeCost: number;
    units: number;
    skuCount: number;
    /** Page views matched from Traffic xlsx by productName. 0 when no match. */
    pageViews: number;
  }>;
  /** Per-gift-product breakdown (revenue is 0; only Prime Cost + units accumulated). */
  giftBreakdown: Array<{
    productName: string;
    productNameEn: string;
    representativeSku: string;
    primeCost: number;
    units: number;
    skuCount: number;
    /** Page views matched from Traffic xlsx by productName. 0 when no match. */
    pageViews: number;
  }>;
  /** SKUs sold but missing from prime cost master — Net GMV / Prime Cost skip these. */
  missingFromMaster: Array<{ sku: string; productName: string; units: number; gmvContribution: number }>;
}

/**
 * Formula descriptors (Cách A — text-based engine).
 * Exposed to UI for "view formula" + Admin edit screens.
 * Reference: cm-calculator skill §3 + §2.4.
 */
export const SHOPEE_METRIC_SPECS = {
  TOTAL_GMV_SHOPEE: {
    id: 'TOTAL_GMV_SHOPEE',
    name: 'Total GMV — Shopee',
    expression: 'SUM(original_price × item_sold) WHERE NOT excluded',
  },
  TOTAL_NET_GMV_SHOPEE: {
    id: 'TOTAL_NET_GMV_SHOPEE',
    name: 'Total Net GMV — Shopee',
    expression: 'SUM(selling_price × item_sold) WHERE NOT excluded',
    requires: ['prime_costs.selling_price'],
  },
  TOTAL_NMV_SHOPEE: {
    id: 'TOTAL_NMV_SHOPEE',
    name: 'Total NMV — Shopee',
    expression: 'SUM(nmv col) WHERE NOT excluded',
  },
  TOTAL_SELLER_DISCOUNT_SHOPEE: {
    id: 'TOTAL_SELLER_DISCOUNT_SHOPEE',
    name: 'Total Seller Discount — Shopee',
    expression: 'SUM( MAX(0, net_gmv_row − nmv_row) ) WHERE NOT excluded',
    note: 'Per-row clamped to 0 (negative rows zeroed before summing). Not the same as Total Net GMV − Total NMV.',
  },
  TOTAL_PRIME_COST_SHOPEE: {
    id: 'TOTAL_PRIME_COST_SHOPEE',
    name: 'Total Prime Cost — Shopee',
    expression: 'SUM(prime_cost × item_sold) over kept + free_gift rows',
    requires: ['prime_costs.prime_cost'],
    note: 'Free Gift prime cost IS included — allocated to non-gift SKUs by NMV contribution downstream (skill §2.4).',
  },
  TOTAL_SELLER_VOUCHERS_SHOPEE: {
    id: 'TOTAL_SELLER_VOUCHERS_SHOPEE',
    name: 'Total Seller Vouchers — Shopee',
    expression: 'SUM_PER_ORDER( MAX({Mã giảm giá của Shop} + {Giảm giá từ Combo của Shop}) ) WHERE {Trạng Thái Đơn Hàng} != "Đã hủy"',
    note: 'Per-order values duplicated across SKU lines — dedupe by Order ID with MAX, then sum. Returned-only orders STILL count (Shopee charges fees on delivered+returned).',
  },
  TOTAL_PLATFORM_FEE_SHOPEE: {
    id: 'TOTAL_PLATFORM_FEE_SHOPEE',
    name: 'Total Platform Fee — Shopee',
    expression: 'SUM_PER_ORDER( MAX({Phí cố định} + {Phí Dịch Vụ} + {Phí thanh toán}) ) WHERE {Trạng Thái Đơn Hàng} != "Đã hủy"',
    note: 'Same per-order MAX dedupe rule as Seller Vouchers. Components: fixed fee + service fee + payment fee.',
  },
  TOTAL_AD_SPENDING_SHOPEE: {
    id: 'TOTAL_AD_SPENDING_SHOPEE',
    name: 'Total Ad Spending — Shopee',
    expression: 'SUM({Chi phí}) over all campaigns in Shopee Ads CSV',
    requires: ['shopee_ads_csv'],
    note: 'Includes both shop-wide (Shop GMV Max) and product-specific campaigns. Per-product allocation TBD.',
  },
  TOTAL_BRAND_ADS_SHOPEE: {
    id: 'TOTAL_BRAND_ADS_SHOPEE',
    name: 'Total Brand Ads — Shopee',
    expression: 'SUM({Chi phí}) over all campaigns in Shopee Brand Consideration Ads CSV',
    requires: ['shopee_brand_ads_csv'],
    note: 'Platform-level total. Per-product allocation by NMV contribution (skill §6).',
  },
  TOTAL_OFF_PLATFORM_ADS_SHOPEE: {
    id: 'TOTAL_OFF_PLATFORM_ADS_SHOPEE',
    name: 'Total Off-Platform Ads — Shopee',
    expression: 'SUM({Chi phí(VND)}) over daily rows in Shopee Off-Platform Ads CSV',
    requires: ['shopee_off_platform_ads_csv'],
    note: 'Daily-aggregated file (1 row per day). Platform-level total. Per-product allocation by NMV contribution.',
  },
  TOTAL_PAGE_VIEWS_SHOPEE: {
    id: 'TOTAL_PAGE_VIEWS_SHOPEE',
    name: 'Total Page Views — Shopee',
    expression: 'SUM({Lượt xem trang sản phẩm}) at product-level rows (where {SKU phân loại} = "-")',
    requires: ['shopee_traffic_xlsx'],
    note: 'Traffic file (parentskudetail) — only product-level rows have traffic metrics; variation rows are sales-only.',
  },
  TOTAL_AFFILIATE_COMMISSION_SHOPEE: {
    id: 'TOTAL_AFFILIATE_COMMISSION_SHOPEE',
    name: 'Total Affiliate Commission — Shopee',
    expression: 'SUM({Chi phí(₫)}) over all rows in Shopee Affiliate (Seller Conversion) CSV',
    requires: ['shopee_affiliate_csv'],
    note: 'Includes pure commission + Shopee 8% processing fee. All statuses (pending/completed/cancelled) included.',
  },
  TOTAL_PLATFORM_DISCOUNT_SHOPEE: {
    id: 'TOTAL_PLATFORM_DISCOUNT_SHOPEE',
    name: 'Total Platform Discount — Shopee',
    expression:
      'SUM_PER_ORDER( MAX({Mã giảm giá của Shopee}) ) WHERE {Trạng Thái Đơn Hàng} != "Đã hủy"',
    note: 'Shopee-funded discount (reference-only display). Not deducted from CM since cost is borne by Shopee, not seller.',
  },
  EXCLUSIONS: {
    id: 'SHOPEE_EXCLUSIONS',
    rules: [
      { code: 'CANCELLED', expression: 'order_status == "Đã hủy"' },
      { code: 'RETURNED', expression: 'gmv == 0  // item_sold == 0 because quantity_returned == quantity' },
      { code: 'FREE_GIFT', expression: 'product_name STARTS_WITH "[GIFT]"  OR  (nmv == 0 AND original_price > 0)' },
    ],
  },
  DERIVED: {
    item_sold: 'quantity − quantity_returned',
    gmv: 'original_price × item_sold',
    net_gmv: 'selling_price × item_sold  // selling_price from prime_costs master',
  },
} as const;

/**
 * Compute all 5 Shopee metrics from parsed sales rows + prime cost master.
 * Pure function — no IO, deterministic.
 */
export function computeShopeeMetrics(
  rows: ShopeeSaleRow[],
  primeCosts: PrimeCostMap,
  adsRows?: ShopeeAdsRow[] | null,
  brandAdsRows?: ShopeeBrandAdsRow[] | null,
  offPlatformAdsRows?: ShopeeOffPlatformAdsRow[] | null,
  trafficRows?: ShopeeTrafficRow[] | null,
  affiliateRows?: ShopeeAffiliateRow[] | null,
): ShopeeMetricsResult {
  let totalItemSold = 0;
  let totalGmv = 0;
  let totalNetGmv = 0;
  let totalNmv = 0;
  let totalSellerDiscount = 0;
  let primeCostKept = 0;
  let primeCostFreeGift = 0;
  let cancelled = 0;
  let returned = 0;
  let freeGift = 0;
  let kept = 0;
  const freeGiftProducts = new Set<string>();
  const missingByProduct = new Map<string, { sku: string; productName: string; units: number; gmvContribution: number }>();
  const productAgg = new Map<
    string,
    { gmv: number; netGmv: number; nmv: number; sellerDiscount: number; primeCost: number; units: number; skus: Set<string>; nameEn: string }
  >();
  const giftAgg = new Map<
    string,
    { primeCost: number; units: number; skus: Set<string>; nameEn: string }
  >();
  // Per-order accumulator (MAX dedupe) — see [[per-order-vs-per-row-metrics]]
  const orderMaxes = new Map<
    string,
    {
      allCancelled: boolean;
      shopVoucher: number;
      shopCombo: number;
      fixedFee: number;
      serviceFee: number;
      paymentFee: number;
      shopeeVoucher: number;
      shopeeCombo: number;
    }
  >();

  for (const row of rows) {
    // Track per-order maxes for ALL rows — cancelled rows have 0 fees so they
    // don't affect the MAX; what matters is whether the order has ANY non-cancelled row.
    let orderAgg = orderMaxes.get(row.orderId);
    if (!orderAgg) {
      orderAgg = {
        allCancelled: true,
        shopVoucher: 0,
        shopCombo: 0,
        fixedFee: 0,
        serviceFee: 0,
        paymentFee: 0,
        shopeeVoucher: 0,
        shopeeCombo: 0,
      };
      orderMaxes.set(row.orderId, orderAgg);
    }
    if (row.orderStatus !== 'Đã hủy') orderAgg.allCancelled = false;
    orderAgg.shopVoucher = Math.max(orderAgg.shopVoucher, row.shopVoucher);
    orderAgg.shopCombo = Math.max(orderAgg.shopCombo, row.shopCombo);
    orderAgg.fixedFee = Math.max(orderAgg.fixedFee, row.fixedFee);
    orderAgg.serviceFee = Math.max(orderAgg.serviceFee, row.serviceFee);
    orderAgg.paymentFee = Math.max(orderAgg.paymentFee, row.paymentFee);
    orderAgg.shopeeVoucher = Math.max(orderAgg.shopeeVoucher, row.shopeeVoucher);
    orderAgg.shopeeCombo = Math.max(orderAgg.shopeeCombo, row.shopeeCombo);

    if (row.orderStatus === 'Đã hủy') {
      cancelled++;
      continue;
    }
    const itemSold = row.quantity - row.quantityReturned;
    const gmv = row.originalPrice * itemSold;
    if (gmv === 0) {
      returned++;
      continue;
    }
    const isGiftPrefix = row.productName.startsWith('[GIFT]');
    const isNmvFallback = row.nmv === 0 && row.originalPrice > 0;
    const master = primeCosts.get(row.varSku);

    if (isGiftPrefix || isNmvFallback) {
      freeGift++;
      freeGiftProducts.add(row.productName);
      const giftPc = master ? master.primeCost * itemSold : 0;
      if (master) primeCostFreeGift += giftPc;
      let gAgg = giftAgg.get(row.productName);
      if (!gAgg) {
        gAgg = { primeCost: 0, units: 0, skus: new Set(), nameEn: master?.productNameEn ?? '' };
        giftAgg.set(row.productName, gAgg);
      } else if (!gAgg.nameEn && master?.productNameEn) {
        gAgg.nameEn = master.productNameEn;
      }
      gAgg.primeCost += giftPc;
      gAgg.units += itemSold;
      gAgg.skus.add(row.varSku);
      continue;
    }

    // Track SKU missing from master (Net GMV / Prime Cost can't be computed)
    if (!master) {
      const key = row.varSku;
      const prev = missingByProduct.get(key) ?? {
        sku: row.varSku,
        productName: row.productName,
        units: 0,
        gmvContribution: 0,
      };
      prev.units += itemSold;
      prev.gmvContribution += gmv;
      missingByProduct.set(key, prev);
    }

    const sellingPrice = master?.sellingPrice ?? 0;
    const primeCost = master?.primeCost ?? 0;
    const netGmvRow = sellingPrice * itemSold;
    const primeCostRow = primeCost * itemSold;
    const sellerDiscountRow = Math.max(0, netGmvRow - row.nmv);

    totalItemSold += itemSold;
    totalGmv += gmv;
    totalNmv += row.nmv;
    totalNetGmv += netGmvRow;
    totalSellerDiscount += sellerDiscountRow;
    primeCostKept += primeCostRow;
    kept++;

    let agg = productAgg.get(row.productName);
    if (!agg) {
      agg = { gmv: 0, netGmv: 0, nmv: 0, sellerDiscount: 0, primeCost: 0, units: 0, skus: new Set(), nameEn: master?.productNameEn ?? '' };
      productAgg.set(row.productName, agg);
    } else if (!agg.nameEn && master?.productNameEn) {
      agg.nameEn = master.productNameEn;
    }
    agg.gmv += gmv;
    agg.netGmv += netGmvRow;
    agg.nmv += row.nmv;
    agg.sellerDiscount += sellerDiscountRow;
    agg.primeCost += primeCostRow;
    agg.units += itemSold;
    agg.skus.add(row.varSku);
  }

  // Per-product page views from Traffic xlsx (match by productName, NFC-normalized)
  const pvByProduct = new Map<string, number>();
  if (trafficRows) {
    for (const t of trafficRows) {
      const key = t.productName.normalize('NFC').trim();
      pvByProduct.set(key, (pvByProduct.get(key) ?? 0) + t.pageViews);
    }
  }

  const productBreakdown = [...productAgg.entries()]
    .map(([productName, agg]) => ({
      productName,
      productNameEn: agg.nameEn,
      representativeSku: [...agg.skus][0] ?? '',
      gmv: agg.gmv,
      netGmv: agg.netGmv,
      nmv: agg.nmv,
      sellerDiscount: agg.sellerDiscount,
      primeCost: agg.primeCost,
      units: agg.units,
      skuCount: agg.skus.size,
      pageViews: pvByProduct.get(productName.normalize('NFC').trim()) ?? 0,
    }))
    .sort((a, b) => b.gmv - a.gmv);

  const giftBreakdown = [...giftAgg.entries()]
    .map(([productName, agg]) => ({
      productName,
      productNameEn: agg.nameEn,
      representativeSku: [...agg.skus][0] ?? '',
      primeCost: agg.primeCost,
      units: agg.units,
      skuCount: agg.skus.size,
      pageViews: pvByProduct.get(productName.normalize('NFC').trim()) ?? 0,
    }))
    .sort((a, b) => b.primeCost - a.primeCost);

  // Per-order metrics: sum MAX values across non-cancelled orders only
  let totalSellerVouchers = 0;
  let totalPlatformFee = 0;
  let totalPlatformDiscount = 0;
  let cancelledOrders = 0;
  let nonCancelledOrders = 0;
  for (const o of orderMaxes.values()) {
    if (o.allCancelled) {
      cancelledOrders++;
      continue;
    }
    nonCancelledOrders++;
    totalSellerVouchers += o.shopVoucher + o.shopCombo;
    totalPlatformFee += o.fixedFee + o.serviceFee + o.paymentFee;
    totalPlatformDiscount += o.shopeeVoucher;
  }

  return {
    totalItemSold,
    totalGmv,
    totalNetGmv,
    totalNmv,
    totalSellerDiscount,
    totalPrimeCost: primeCostKept + primeCostFreeGift,
    primeCostKept,
    primeCostFreeGift,
    totalSellerVouchers,
    totalPlatformFee,
    totalPlatformDiscount,
    orderCounts: { totalDistinct: orderMaxes.size, cancelled: cancelledOrders, nonCancelled: nonCancelledOrders },
    ads: adsRows && adsRows.length > 0 ? aggregateAds(adsRows) : null,
    brandAds: brandAdsRows ? aggregateBrandAds(brandAdsRows) : null,
    offPlatformAds: offPlatformAdsRows ? aggregateOffPlatformAds(offPlatformAdsRows) : null,
    traffic: trafficRows ? aggregateTraffic(trafficRows) : null,
    affiliate: affiliateRows ? aggregateAffiliate(affiliateRows) : null,
    rowsKept: kept,
    rowsExcluded: { cancelled, returned, freeGift },
    freeGiftProducts: [...freeGiftProducts],
    productBreakdown,
    giftBreakdown,
    missingFromMaster: [...missingByProduct.values()].sort((a, b) => b.gmvContribution - a.gmvContribution),
  };
}
