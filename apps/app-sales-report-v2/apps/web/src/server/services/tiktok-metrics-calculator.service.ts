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
  /** SUM(listing_price × item_sold) for kept rows — TikTok uses LISTING (not original). */
  totalGmv: number;
  /** SUM(original_price × item_sold) for kept rows — TikTok Net GMV uses ORIGINAL. */
  totalNetGmv: number;
  /** SUM(net_gmv − seller_discount) for kept rows. */
  totalNmv: number;
  /** SUM(per-row clamped SUM(MAX(0, SKU Seller Discount − (GMV − Net GMV)))). */
  totalSellerDiscount: number;
  /** SUM(prime_cost × item_sold) for kept + free gift rows. */
  totalPrimeCost: number;
  primeCostKept: number;
  primeCostFreeGift: number;
  rowsKept: number;
  rowsExcluded: { cancelled: number; returned: number; freeGift: number };
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
    gmv: number;
    netGmv: number;
    nmv: number;
    sellerDiscount: number;
    primeCost: number;
    units: number;
    skuCount: number;
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
): TikTokMetricsResult {
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
    { gmv: number; netGmv: number; nmv: number; sellerDiscount: number; primeCost: number; units: number; skus: Set<string> }
  >();

  for (const row of rows) {
    // TikTok cancelled: status AND substatus BOTH "Đã hủy"
    if (row.orderStatus === 'Đã hủy' && row.orderSubstatus === 'Đã hủy') {
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
      primeCostFreeGift += primeCost * itemSold;
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

    totalGmv += gmv;
    totalNetGmv += netGmv;
    totalNmv += nmvRow;
    totalSellerDiscount += sellerDiscountRow;
    primeCostKept += primeCostLine;
    kept++;

    let agg = productAgg.get(row.productName);
    if (!agg) {
      agg = { gmv: 0, netGmv: 0, nmv: 0, sellerDiscount: 0, primeCost: 0, units: 0, skus: new Set() };
      productAgg.set(row.productName, agg);
    }
    agg.gmv += gmv;
    agg.netGmv += netGmv;
    agg.nmv += nmvRow;
    agg.sellerDiscount += sellerDiscountRow;
    agg.primeCost += primeCostLine;
    agg.units += itemSold;
    agg.skus.add(row.sellerSku);
  }

  const productBreakdown = [...productAgg.entries()]
    .map(([productName, agg]) => ({
      productName,
      gmv: agg.gmv,
      netGmv: agg.netGmv,
      nmv: agg.nmv,
      sellerDiscount: agg.sellerDiscount,
      primeCost: agg.primeCost,
      units: agg.units,
      skuCount: agg.skus.size,
    }))
    .sort((a, b) => b.gmv - a.gmv);

  return {
    totalGmv,
    totalNetGmv,
    totalNmv,
    totalSellerDiscount,
    totalPrimeCost: primeCostKept + primeCostFreeGift,
    primeCostKept,
    primeCostFreeGift,
    rowsKept: kept,
    rowsExcluded: { cancelled, returned, freeGift },
    freeGiftProducts: [...freeGiftProducts],
    missingFromMaster: [...missingByProduct.values()].sort((a, b) => b.gmvContribution - a.gmvContribution),
    traffic: trafficRows ? aggregateTikTokTraffic(trafficRows) : null,
    affiliate: affiliateRows ? aggregateTikTokAffiliate(affiliateRows) : null,
    productBreakdown,
  };
}
