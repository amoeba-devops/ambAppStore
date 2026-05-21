import 'server-only';
import type { TikTokSaleRow } from './tiktok-sales-parser.service';
import type { PrimeCostMap } from './gmv-calculator.service';
import {
  aggregateTikTokTraffic,
  type TikTokTrafficRow,
} from './tiktok-traffic-parser.service';
import {
  aggregateTikTokAffiliate,
  type TikTokAffiliateRow,
} from './tiktok-affiliate-parser.service';

export interface TikTokMetricsResult {
  /** SUM(item_sold) for kept rows. */
  totalItemSold: number;
  /** SUM(listing_price × item_sold) for kept rows — TikTok uses LISTING (not original). */
  totalGmv: number;
  /** SUM(original_price × item_sold) for kept rows — TikTok Net GMV uses ORIGINAL. */
  totalNetGmv: number;
  /** SUM(net_gmv − seller_discount) for kept rows. */
  totalNmv: number;
  /** SUM(per-row clamped SUM(MAX(0, SKU Seller Discount − (GMV − Net GMV)))). */
  totalSellerDiscount: number;
  /** SUM({SKU Platform Discount}) for kept rows — reference-only, not deducted from CM. */
  totalPlatformDiscount: number;
  /** SUM((gmv − seller_discount) × rate) for kept rows — TikTok platform fee. */
  totalPlatformFee: number;
  /** Platform fee rate used for computation (percent). */
  platformFeeRatePct: number;
  /** SUM(prime_cost × item_sold) for kept + free gift rows. */
  totalPrimeCost: number;
  primeCostKept: number;
  primeCostFreeGift: number;
  rowsKept: number;
  rowsExcluded: { cancelled: number; returned: number; freeGift: number };
  /** Distinct order counts (by Order ID). */
  orderCounts: { totalDistinct: number; cancelled: number; nonCancelled: number };
  freeGiftProducts: string[];
  missingFromMaster: Array<{ sku: string; productName: string; units: number; gmvContribution: number }>;
  /** Traffic metrics — only when Traffic xlsx provided. */
  traffic: {
    totalPageViews: number;
    pvShopTab: number;
    pvLive: number;
    pvVideo: number;
    pvProductCard: number;
    productCount: number;
  } | null;
  /** Affiliate metrics — only when Affiliate xlsx provided. */
  affiliate: {
    totalCommission: number;
    totalFixedFee: number;
    totalGmv: number;
    totalItemsSold: number;
    creatorCount: number;
    activeCreatorCount: number;
  } | null;
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
}

/**
 * Formula descriptors for TikTok metrics (Cách A — text-based engine).
 * Differs from Shopee: uses listing_price for GMV, original_price for Net GMV,
 * full-or-nothing item_sold (no partial returns), AND+substatus for cancelled.
 * Reference: cm-calculator skill §4.
 */
export const TIKTOK_METRIC_SPECS = {
  TOTAL_GMV_TIKTOK: {
    id: 'TOTAL_GMV_TIKTOK',
    name: 'Total GMV — TikTok',
    expression:
      'SUM(listing_price × item_sold) WHERE NOT excluded.  item_sold = IF({Quantity} = {Sku Quantity of return}, 0, {Quantity}). listing_price from prime_cost master.',
    requires: ['prime_costs.listing_price'],
    note: 'TikTok GMV uses LISTING price (not original — opposite of Shopee).',
  },
  TOTAL_NET_GMV_TIKTOK: {
    id: 'TOTAL_NET_GMV_TIKTOK',
    name: 'Total Net GMV — TikTok',
    expression: 'SUM({SKU Subtotal Before Discount} − {SKU Seller Discount}) per kept row',
    note: 'Per-row: Net GMV = revenue at original price minus the seller-funded discount.',
  },
  TOTAL_NMV_TIKTOK: {
    id: 'TOTAL_NMV_TIKTOK',
    name: 'Total NMV — TikTok',
    expression: 'SUM(net_gmv_row − seller_discount_row) per kept row',
  },
  TOTAL_SELLER_DISCOUNT_TIKTOK: {
    id: 'TOTAL_SELLER_DISCOUNT_TIKTOK',
    name: 'Total Seller Discount — TikTok',
    expression: 'SUM({SKU Seller Discount}) per kept row (raw, no clamping)',
  },
  TOTAL_PLATFORM_DISCOUNT_TIKTOK: {
    id: 'TOTAL_PLATFORM_DISCOUNT_TIKTOK',
    name: 'Total Platform Discount — TikTok',
    expression: 'SUM({SKU Platform Discount}) per kept row',
    note: 'TikTok platform-funded discount (reference-only display). Not deducted from CM since cost is borne by TikTok, not seller.',
  },
  TOTAL_PRIME_COST_TIKTOK: {
    id: 'TOTAL_PRIME_COST_TIKTOK',
    name: 'Total Prime Cost — TikTok',
    expression: 'SUM(prime_cost × item_sold) over kept + free_gift rows',
    requires: ['prime_costs.prime_cost'],
  },
  TOTAL_PAGE_VIEWS_TIKTOK: {
    id: 'TOTAL_PAGE_VIEWS_TIKTOK',
    name: 'Total Page Views — TikTok',
    expression:
      'SUM_per_product( {Lượt xem trang từ tab Cửa hàng} + {Lượt xem trang từ LIVE} + {Lượt xem trang từ video} + {Lượt xem trang từ thẻ sản phẩm} )',
    requires: ['tiktok_traffic_xlsx'],
    note: 'TikTok page_view = sum of 4 sources per skill §4. Data row per product.',
  },
  TOTAL_AFFILIATE_COMMISSION_TIKTOK: {
    id: 'TOTAL_AFFILIATE_COMMISSION_TIKTOK',
    name: 'Total Affiliate Commission — TikTok',
    expression: 'SUM({Hoa hồng ước tính}) over all creators in Creator_List xlsx',
    requires: ['tiktok_affiliate_xlsx'],
    note: 'Per-creator estimated commission. Fixed fee column often "--" (= 0).',
  },
  TOTAL_PLATFORM_FEE_TIKTOK: {
    id: 'TOTAL_PLATFORM_FEE_TIKTOK',
    name: 'Total Platform Fee — TikTok',
    expression:
      'SUM_PER_ROW( (gmv − sku_seller_discount) × platform_fee_rate_pct / 100 ) over kept rows',
    note: 'Per-row platform fee derived from listing-based GMV minus seller discount, times configurable rate (default 24%).',
  },
  EXCLUSIONS_TIKTOK: {
    rules: [
      { code: 'CANCELLED', expression: '{Order Status} = "Đã hủy" AND {Order Substatus} = "Đã hủy"' },
      { code: 'RETURNED', expression: 'net_gmv == 0 AND NOT is_free_gift' },
      { code: 'FREE_GIFT', expression: '{Product Name} STARTS_WITH "[GIFT]"  OR  (net_gmv == 0 AND original_price == 0)' },
    ],
  },
} as const;

export function computeTikTokMetrics(
  rows: TikTokSaleRow[],
  primeCosts: PrimeCostMap,
  trafficRows?: TikTokTrafficRow[] | null,
  affiliateRows?: TikTokAffiliateRow[] | null,
  platformFeeRatePct: number = 24,
): TikTokMetricsResult {
  let totalItemSold = 0;
  let totalGmv = 0;
  let totalNetGmv = 0;
  let totalNmv = 0;
  let totalSellerDiscount = 0;
  let totalPlatformDiscount = 0;
  let totalPlatformFee = 0;
  const feeRate = platformFeeRatePct / 100;
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
  // Track distinct orders — orderId → allCancelled flag (mirrors Shopee).
  const orderAgg = new Map<string, { allCancelled: boolean }>();
  // Per-order Net GMV total (sum of kept rows). Orders with total = 0 are
  // excluded from Total Orders count even if individual rows had netGmv > 0
  // that cancelled out across rows.
  const orderNetGmvSum = new Map<string, number>();

  for (const row of rows) {
    // Track order — register before any exclusion + flip allCancelled when a
    // non-fully-cancelled row appears.
    const rowAllCancelled =
      row.orderStatus === 'Đã hủy' && row.orderSubstatus === 'Đã hủy';
    let oAgg = orderAgg.get(row.orderId);
    if (!oAgg) {
      oAgg = { allCancelled: rowAllCancelled };
      orderAgg.set(row.orderId, oAgg);
    } else if (!rowAllCancelled) {
      oAgg.allCancelled = false;
    }

    // TikTok cancelled: status AND substatus BOTH "Đã hủy"
    if (rowAllCancelled) {
      cancelled++;
      continue;
    }

    // Full return → exclude
    const isFullReturn = row.quantity === row.quantityReturn;
    if (isFullReturn) {
      returned++;
      continue;
    }
    const itemSold = row.quantity;

    // Free Gift detection — [GIFT] prefix in product name
    const isGift = row.productName.startsWith('[GIFT]');

    const master = primeCosts.get(row.sellerSku);
    const listingPrice = master?.listingPrice ?? 0;
    const primeCost = master?.primeCost ?? 0;
    const gmv = listingPrice * itemSold;

    if (isGift) {
      freeGift++;
      freeGiftProducts.add(row.productName);
      const giftPc = primeCost * itemSold;
      primeCostFreeGift += giftPc;
      let gAgg = giftAgg.get(row.productName);
      if (!gAgg) {
        gAgg = { primeCost: 0, units: 0, skus: new Set(), nameEn: master?.productNameEn ?? '' };
        giftAgg.set(row.productName, gAgg);
      } else if (!gAgg.nameEn && master?.productNameEn) {
        gAgg.nameEn = master.productNameEn;
      }
      gAgg.primeCost += giftPc;
      gAgg.units += itemSold;
      gAgg.skus.add(row.sellerSku);
      continue;
    }

    // Net GMV per row (new formula: SBD − SSD). If 0 (full seller discount, etc.)
    // and not a tagged gift, treat as returned/zero-revenue → exclude.
    const netGmvRow = row.skuSubtotalBeforeDiscount - row.skuSellerDiscount;
    if (netGmvRow === 0) {
      returned++;
      continue;
    }

    if (!master) {
      const prev = missingByProduct.get(row.sellerSku) ?? {
        sku: row.sellerSku,
        productName: row.productName,
        units: 0,
        gmvContribution: 0,
      };
      prev.units += itemSold;
      prev.gmvContribution += gmv;
      missingByProduct.set(row.sellerSku, prev);
    }

    // Per Formula Config (new chain):
    //   Net GMV     = {SKU Subtotal Before Discount} − {SKU Seller Discount}  (already computed above)
    //   Seller Disc = {SKU Seller Discount}
    //   NMV         = Net GMV − Seller Discount
    const sellerDiscountRow = row.skuSellerDiscount;
    const netGmv = netGmvRow;
    const nmvRow = netGmv - sellerDiscountRow;
    const primeCostLine = primeCost * itemSold;
    // Per Formula Config: Platform Fee — TikTok = (GMV − Seller Discount) × Platform Fee Rate
    const platformFeeRow = (gmv - sellerDiscountRow) * feeRate;

    totalItemSold += itemSold;
    totalGmv += gmv;
    totalNetGmv += netGmv;
    totalNmv += nmvRow;
    totalSellerDiscount += sellerDiscountRow;
    totalPlatformDiscount += row.skuPlatformDiscount;
    totalPlatformFee += platformFeeRow;
    primeCostKept += primeCostLine;
    orderNetGmvSum.set(row.orderId, (orderNetGmvSum.get(row.orderId) ?? 0) + netGmv);
    kept++;

    let agg = productAgg.get(row.productName);
    if (!agg) {
      agg = { gmv: 0, netGmv: 0, nmv: 0, sellerDiscount: 0, primeCost: 0, units: 0, skus: new Set(), nameEn: master?.productNameEn ?? '' };
      productAgg.set(row.productName, agg);
    } else if (!agg.nameEn && master?.productNameEn) {
      agg.nameEn = master.productNameEn;
    }
    agg.gmv += gmv;
    agg.netGmv += netGmv;
    agg.nmv += nmvRow;
    agg.sellerDiscount += sellerDiscountRow;
    agg.primeCost += primeCostLine;
    agg.units += itemSold;
    agg.skus.add(row.sellerSku);
  }

  // Per-product page views from TikTok Traffic xlsx (match by productName, NFC-normalized)
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

  return {
    totalItemSold,
    totalGmv,
    totalNetGmv,
    totalNmv,
    totalSellerDiscount,
    totalPlatformDiscount,
    totalPlatformFee,
    platformFeeRatePct,
    totalPrimeCost: primeCostKept + primeCostFreeGift,
    primeCostKept,
    primeCostFreeGift,
    rowsKept: kept,
    rowsExcluded: { cancelled, returned, freeGift },
    orderCounts: (() => {
      let cancelledOrders = 0;
      for (const o of orderAgg.values()) {
        if (o.allCancelled) cancelledOrders++;
      }
      // nonCancelled = orders whose TOTAL Net GMV across kept rows is > 0.
      // Excludes orders that were: fully cancelled, fully returned, free-gift
      // only, or had per-row netGmv cancelling out to 0 at order level.
      let validOrders = 0;
      for (const sum of orderNetGmvSum.values()) {
        if (sum > 0) validOrders++;
      }
      return {
        totalDistinct: orderAgg.size,
        cancelled: cancelledOrders,
        nonCancelled: validOrders,
      };
    })(),
    freeGiftProducts: [...freeGiftProducts],
    missingFromMaster: [...missingByProduct.values()].sort((a, b) => b.gmvContribution - a.gmvContribution),
    traffic: trafficRows ? aggregateTikTokTraffic(trafficRows) : null,
    affiliate: affiliateRows ? aggregateTikTokAffiliate(affiliateRows) : null,
    productBreakdown,
    giftBreakdown,
  };
}
