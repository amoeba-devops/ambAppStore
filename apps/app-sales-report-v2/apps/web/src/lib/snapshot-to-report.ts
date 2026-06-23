/**
 * Convert a persisted PeriodSnapshotMetrics blob to the WeeklyReportData
 * shape consumed by the Weekly Report dashboard.
 *
 * MVP scope:
 *   - Fills top-line: netGmv, cm (estimate), cmPct
 *   - Fills overview rows from platform totals
 *   - WoW deltas: null (no prev-period query yet)
 *   - Per-product breakdowns: empty (need per-product calc in calculator first)
 *   - Discount/promo/traffic/sales/ads sections: partial fill from totals
 */
import type {
  WeeklyReportData,
  OverviewRow,
  BreakdownItem,
  WeeklyChannel,
  ProductMetric,
} from './weekly-report-mock';
import type { PeriodSnapshotMetrics } from '@/server/services/period-snapshot.service';
import { getMetricFormula } from './formula-lookup';

export function snapshotToWeeklyReport(
  snap: PeriodSnapshotMetrics,
  channel: WeeklyChannel,
  prevSnap?: PeriodSnapshotMetrics | null,
  prevLabel?: string,
): WeeklyReportData {
  const { shopee, tiktok, manualInputs, constants } = snap;

  // Allocate Total Affiliate Booking Fee across platforms by GMV share
  const totalGmvBoth = shopee.totalGmv + tiktok.totalGmv;
  const shopeeAffBookingFee =
    totalGmvBoth > 0
      ? (manualInputs.affiliateBookingFees * shopee.totalGmv) / totalGmvBoth
      : 0;
  const tiktokAffBookingFee =
    totalGmvBoth > 0
      ? (manualInputs.affiliateBookingFees * tiktok.totalGmv) / totalGmvBoth
      : 0;

  // TikTok Platform Fee = Sum of per-row (GMV − Seller Discount) × Rate.
  // Computed in calculator and persisted in snapshot. Falls back to legacy
  // formula for snapshots saved before this field was added.
  const tiktokPlatformFee =
    tiktok.totalPlatformFee ??
    (tiktok.totalGmv - tiktok.totalSellerDiscount) *
      ((constants?.tiktokPlatformFeeRatePct ?? 24) / 100);

  // Per-platform CM (per Formula Config — Free Gift is a separate line in addition
  // to Total Prime Cost, matching FINAL REPORT structure).
  // Shopee subtracts Seller Discount, TikTok does NOT — user spec.
  const shopeeCm =
    shopee.totalNetGmv -
    shopee.totalSellerDiscount -
    shopee.totalPrimeCost - // kept rows only (free gift subtracted separately below)
    shopee.totalAdSpending -
    shopee.totalBrandAds -
    shopee.totalPlatformFee -
    shopee.totalSellerVouchers -
    manualInputs.shopeeLivestreamFees -
    shopee.totalOffPlatformAds -
    shopee.primeCostFreeGift - // Total Free Gift — separate line per Formula Config
    shopeeAffBookingFee -
    shopee.totalAffiliateCommission;

  // Per user spec: TikTok CM = Net GMV − Ad Spending − Platform Fee − Prime Cost
  // − Free Gift − Livestream − Affiliate Commission − Booking Fee (no Seller Discount)
  const tiktokCm =
    tiktok.totalNetGmv -
    manualInputs.tiktokAdsSpending -
    tiktokPlatformFee -
    tiktok.totalPrimeCost -
    tiktok.primeCostFreeGift - // Total Free Gift — separate line
    manualInputs.tiktokLivestreamFees -
    tiktok.totalAffiliateCommission -
    tiktokAffBookingFee;

  // Channel-scoped values
  const useShopee = channel === 'ALL' || channel === 'SHOPEE';
  const useTiktok = channel === 'ALL' || channel === 'TIKTOK';

  const netGmv =
    (useShopee ? shopee.totalNetGmv : 0) + (useTiktok ? tiktok.totalNetGmv : 0);
  const gmv = (useShopee ? shopee.totalGmv : 0) + (useTiktok ? tiktok.totalGmv : 0);
  const nmv = (useShopee ? shopee.totalNmv : 0) + (useTiktok ? tiktok.totalNmv : 0);
  const sellerDiscount =
    (useShopee ? shopee.totalSellerDiscount : 0) +
    (useTiktok ? tiktok.totalSellerDiscount : 0);
  const primeCost =
    (useShopee ? shopee.totalPrimeCost : 0) + (useTiktok ? tiktok.totalPrimeCost : 0);
  const adSpending =
    (useShopee ? shopee.totalAdSpending : 0) +
    (useTiktok ? manualInputs.tiktokAdsSpending : 0);
  const brandAds = useShopee ? shopee.totalBrandAds : 0;
  const offPlatformAds = useShopee ? shopee.totalOffPlatformAds : 0;
  const platformFee =
    (useShopee ? shopee.totalPlatformFee : 0) + (useTiktok ? tiktokPlatformFee : 0);
  const sellerVouchers = useShopee ? shopee.totalSellerVouchers : 0;
  const affiliateCommission =
    (useShopee ? shopee.totalAffiliateCommission : 0) +
    (useTiktok ? tiktok.totalAffiliateCommission : 0);
  const livestreamFee =
    (useShopee ? manualInputs.shopeeLivestreamFees : 0) +
    (useTiktok ? manualInputs.tiktokLivestreamFees : 0);
  const affiliateBookingFee =
    (useShopee ? shopeeAffBookingFee : 0) + (useTiktok ? tiktokAffBookingFee : 0);
  const pageViews =
    (useShopee ? shopee.totalPageViews : 0) + (useTiktok ? tiktok.totalPageViews : 0);
  const itemSold =
    (useShopee ? shopee.totalItemSold ?? 0 : 0) + (useTiktok ? tiktok.totalItemSold ?? 0 : 0);
  const conversionRate = pageViews > 0 ? itemSold / pageViews : 0;

  // CM by channel
  const cm =
    channel === 'SHOPEE'
      ? shopeeCm
      : channel === 'TIKTOK'
        ? tiktokCm
        : shopeeCm + tiktokCm;

  const cmPct = netGmv > 0 ? cm / netGmv : 0;
  const pct = (v: number) => (netGmv > 0 ? v / netGmv : 0);

  // Free Gift PC per platform — display under Discount Costs group
  const freeGift =
    (useShopee ? shopee.primeCostFreeGift : 0) +
    (useTiktok ? tiktok.primeCostFreeGift : 0);

  // Group subtotals (display values, mirror FINAL REPORT structure)
  const totalDiscountCosts = sellerDiscount + sellerVouchers + freeGift;
  const totalPromotionalCosts =
    adSpending + brandAds + offPlatformAds + affiliateCommission + affiliateBookingFee + livestreamFee;

  // Simplified Overview — 6 top-line summary rows only
  const overview: OverviewRow[] = [
    { metric: 'Net GMV', vnd: netGmv, pctGmv: 1, wowPct: null },
    { metric: 'Total Discount Costs', vnd: totalDiscountCosts, pctGmv: pct(totalDiscountCosts), wowPct: null, invertDelta: true },
    { metric: 'Total Promotional Costs', vnd: totalPromotionalCosts, pctGmv: pct(totalPromotionalCosts), wowPct: null, invertDelta: true },
    { metric: 'Prime Cost', vnd: primeCost, pctGmv: pct(primeCost), wowPct: null, invertDelta: true },
    { metric: 'Platform Fee', vnd: platformFee, pctGmv: pct(platformFee), wowPct: null, invertDelta: true },
    { metric: 'Total Contribution Margin', vnd: cm, pctGmv: pct(cm), wowPct: null, highlight: 'cm' },
    { metric: 'CM %', vnd: cmPct, pctGmv: cmPct, wowPct: null, highlight: 'cmPct', isRatio: true },
  ];

  const platformDiscount =
    (useShopee ? shopee.totalPlatformDiscount : 0) +
    (useTiktok ? tiktok.totalPlatformDiscount ?? 0 : 0);
  const discounts: BreakdownItem[] = [
    ...(useShopee
      ? [{ label: 'Total Seller Voucher', vnd: sellerVouchers, pctGmv: pct(sellerVouchers), wowPct: null, invertWow: true }]
      : []),
    { label: 'Total Seller Discount', vnd: sellerDiscount, pctGmv: pct(sellerDiscount), wowPct: null, invertWow: true },
    { label: 'Total Free Gift', vnd: freeGift, pctGmv: pct(freeGift), wowPct: null, invertWow: true },
    { label: 'Total Platform Discount (Ref)', vnd: platformDiscount, pctGmv: pct(platformDiscount), wowPct: null, reference: true },
  ];

  const promo: BreakdownItem[] = [
    { label: 'Total AD Spend', vnd: adSpending, pctGmv: pct(adSpending), wowPct: null, invertWow: true },
    ...(useShopee
      ? [
          { label: 'Total Brand Ads', vnd: brandAds, pctGmv: pct(brandAds), wowPct: null, invertWow: true } as BreakdownItem,
          { label: 'Total Off-Platform Ads', vnd: offPlatformAds, pctGmv: pct(offPlatformAds), wowPct: null, invertWow: true } as BreakdownItem,
        ]
      : []),
    { label: 'Total Affiliate Commission', vnd: affiliateCommission, pctGmv: pct(affiliateCommission), wowPct: null, invertWow: true },
    { label: 'Total Affiliate Booking Fee', vnd: affiliateBookingFee, pctGmv: pct(affiliateBookingFee), wowPct: null, invertWow: true },
    { label: 'Total Livestream Fee', vnd: livestreamFee, pctGmv: pct(livestreamFee), wowPct: null, invertWow: true },
  ];

  // AD GMV / ROAS — Shopee only (TikTok export does not expose per-campaign GMV)
  const shopeeAdRevenue = useShopee ? shopee.totalAdRevenue ?? 0 : 0;
  const shopeeAdCost = useShopee ? shopee.totalAdSpending : 0;
  const adRoas = shopeeAdCost > 0 ? shopeeAdRevenue / shopeeAdCost : 0;
  const traffic: BreakdownItem[] = [
    { label: 'Total Page Views', raw: pageViews, rawDisplay: pageViews.toLocaleString('en-US'), wowPct: null },
    {
      label: 'Conversion Rate',
      raw: conversionRate,
      rawDisplay: pageViews > 0 ? (conversionRate * 100).toFixed(2) + '%' : '—',
      wowPct: null,
    },
    ...(useShopee
      ? ([
          {
            label: 'AD GMV',
            vnd: shopeeAdRevenue,
            pctGmv: pct(shopeeAdRevenue),
            wowPct: null,
          },
          {
            label: 'AD ROAS',
            raw: adRoas,
            rawDisplay: shopeeAdCost > 0 ? adRoas.toFixed(2) + 'x' : '—',
            wowPct: null,
          },
        ] as BreakdownItem[])
      : []),
  ];

  const totalItemSold =
    (useShopee ? shopee.totalItemSold ?? 0 : 0) +
    (useTiktok ? tiktok.totalItemSold ?? 0 : 0);
  const totalOrders =
    (useShopee ? shopee.orderCounts?.nonCancelled ?? 0 : 0) +
    (useTiktok ? tiktok.orderCounts?.nonCancelled ?? 0 : 0);
  const aov = totalOrders > 0 ? gmv / totalOrders : 0;
  const sales: BreakdownItem[] = [
    {
      label: 'Total Item Sold',
      raw: totalItemSold,
      rawDisplay: totalItemSold.toLocaleString('en-US'),
      wowPct: null,
    },
    {
      label: 'Total Orders',
      raw: totalOrders,
      rawDisplay: totalOrders.toLocaleString('en-US'),
      wowPct: null,
    },
    { label: 'AOV', vnd: aov, pctGmv: pct(aov), wowPct: null },
  ];

  const ads: BreakdownItem[] = [
    { label: 'Ad Spending', vnd: adSpending, pctGmv: pct(adSpending), wowPct: null, invertWow: true },
    ...(useShopee
      ? [
          { label: 'Brand Ads (Shopee)', vnd: brandAds, pctGmv: pct(brandAds), wowPct: null, invertWow: true },
          { label: 'Off-Platform Ads (Shopee)', vnd: offPlatformAds, pctGmv: pct(offPlatformAds), wowPct: null, invertWow: true },
        ]
      : []),
  ];

  const withFormulaOverview = (rows: OverviewRow[]): OverviewRow[] =>
    rows.map((r) => ({ ...r, formula: getMetricFormula(r.metric, channel) }));
  const withFormulaBreakdown = (items: BreakdownItem[]): BreakdownItem[] =>
    items.map((i) => ({ ...i, formula: getMetricFormula(i.label, channel) }));

  const currentReport: WeeklyReportData = {
    netGmv,
    cm,
    cmPct,
    netGmvWow: null,
    cmWow: null,
    cmPctWow: null,
    overview: withFormulaOverview(overview),
    discounts: withFormulaBreakdown(discounts),
    promo: withFormulaBreakdown(promo),
    traffic: withFormulaBreakdown(traffic),
    sales: withFormulaBreakdown(sales),
    ads: withFormulaBreakdown(ads),
    prevWeekLabel: prevLabel ?? '—',
  };

  // No prev snapshot → return without WoW deltas
  if (!prevSnap) return currentReport;

  // Build the same shape from the prev snapshot, then merge wowPct fields.
  const prev = snapshotToWeeklyReport(prevSnap, channel);

  const wowPct = (c: number, p: number): number | null => {
    if (p === 0) return null;
    return (c - p) / Math.abs(p);
  };

  // OverviewRow: ratio rows get absolute pct-point delta; money rows get %-change.
  const overviewWithWow = currentReport.overview.map((row) => {
    const prevRow = prev.overview.find((x) => x.metric === row.metric);
    if (!prevRow) return row;
    if (row.isRatio) {
      return { ...row, wowPct: prevRow.vnd === 0 && row.vnd === 0 ? null : row.vnd - prevRow.vnd };
    }
    return { ...row, wowPct: wowPct(row.vnd, prevRow.vnd) };
  });

  // BreakdownItem: prefer `vnd` then `raw` for the delta source.
  const mergeBreakdown = (cur: BreakdownItem[], prv: BreakdownItem[]) =>
    cur.map((it) => {
      const p = prv.find((x) => x.label === it.label);
      if (!p) return it;
      if (it.vnd != null && p.vnd != null) return { ...it, wowPct: wowPct(it.vnd, p.vnd) };
      if (it.raw != null && p.raw != null) return { ...it, wowPct: wowPct(it.raw, p.raw) };
      return it;
    });

  return {
    ...currentReport,
    netGmvWow: wowPct(netGmv, prev.netGmv),
    cmWow: wowPct(cm, prev.cm),
    cmPctWow: prev.cmPct === 0 && cmPct === 0 ? null : cmPct - prev.cmPct,
    overview: overviewWithWow,
    discounts: mergeBreakdown(currentReport.discounts, prev.discounts),
    promo: mergeBreakdown(currentReport.promo, prev.promo),
    traffic: mergeBreakdown(currentReport.traffic, prev.traffic),
    sales: mergeBreakdown(currentReport.sales, prev.sales),
    ads: mergeBreakdown(currentReport.ads, prev.ads),
  };
}

/**
 * Convert a PeriodSnapshotMetrics blob to the per-product ProductMetric rows
 * consumed by the Product Breakdown table. Includes both kept products (with
 * sales) and gift products (revenue 0, only Prime Cost). Per-product
 * voucher/ads/livestream allocations are not yet computed → those columns are
 * left at 0 for now.
 *
 * @param channel filter rows by platform (ALL keeps both)
 */
export function snapshotToProducts(
  snap: PeriodSnapshotMetrics,
  channel: WeeklyChannel,
): ProductMetric[] {
  const { shopee, tiktok, manualInputs, constants } = snap;
  const useShopee = channel === 'ALL' || channel === 'SHOPEE';
  const useTiktok = channel === 'ALL' || channel === 'TIKTOK';

  // Cross-platform Affiliate Booking Fee — split by GMV, then allocate per
  // product within each platform by NMV share (matches dashboard total logic).
  const totalGmvBoth = shopee.totalGmv + tiktok.totalGmv;
  const shopeeAffBookingFee =
    totalGmvBoth > 0
      ? (manualInputs.affiliateBookingFees * shopee.totalGmv) / totalGmvBoth
      : 0;
  const tiktokAffBookingFee =
    totalGmvBoth > 0
      ? (manualInputs.affiliateBookingFees * tiktok.totalGmv) / totalGmvBoth
      : 0;

  // TikTok Platform Fee — use persisted per-row sum; fallback for legacy snapshots
  const tiktokPlatformFee =
    tiktok.totalPlatformFee ??
    (tiktok.totalGmv - tiktok.totalSellerDiscount) *
      ((constants?.tiktokPlatformFeeRatePct ?? 24) / 100);

  // Platform totals for NMV-based allocation
  const shopeeNmvSum = (shopee.productBreakdown ?? []).reduce((a, p) => a + p.nmv, 0);
  const tiktokNmvSum = (tiktok.productBreakdown ?? []).reduce((a, p) => a + p.nmv, 0);

  const out: ProductMetric[] = [];

  if (useShopee) {
    const total = shopeeNmvSum;
    const breakdown = shopee.productBreakdown ?? [];

    // Per-product affiliate cost lookup straight from the file. Each breakdown
    // row receives the full {Chi phí(₫)} for its product name — no NMV split,
    // no allocation. Keys are already normalized by the affiliate parser; we
    // mirror the normalization here. NOTE: for products with multi-variation
    // breakdown rows (combo + regular, or multiple colours/sizes), each row
    // will show the same product-level chiPhi; the Promotional Breakdown
    // Total card stays accurate because it reads `totalAffiliateCommission`
    // from the file (sum of unique product entries), not the sum of per-SKU
    // rows in the table.
    const affCostByName = shopee.affiliateCostByProductName ?? {};
    const normalizeName = (s: string) => s.normalize('NFC').replace(/\s+/g, ' ').trim();
    const matchedAffNames = new Set<string>();

    for (const p of breakdown) {
      const share = total > 0 ? p.nmv / total : 0;
      const voucher = shopee.totalSellerVouchers * share;
      const freeGift = shopee.primeCostFreeGift * share;
      const adSpend = shopee.totalAdSpending * share;
      const brandAds = shopee.totalBrandAds * share;
      const offPlatformAds = shopee.totalOffPlatformAds * share;
      const nameKey = normalizeName(p.productName);
      const productAffCost = affCostByName[nameKey] ?? 0;
      const affComm = productAffCost;
      if (productAffCost > 0) matchedAffNames.add(nameKey);
      const affBook = shopeeAffBookingFee * share;
      const livestream = manualInputs.shopeeLivestreamFees * share;
      const platformFee = shopee.totalPlatformFee * share;
      const cm =
        p.netGmv -
        p.sellerDiscount -
        p.primeCost -
        freeGift -
        voucher -
        adSpend -
        brandAds -
        offPlatformAds -
        affComm -
        affBook -
        livestream -
        platformFee;
      const pv = p.pageViews ?? 0;
      out.push({
        no: '',
        sku: p.representativeSku,
        nameVi: p.productName,
        nameEn: p.productNameEn || p.productName,
        variationName: p.variationName ?? '',
        platform: 'SHOPEE',
        pv,
        cvr: pv > 0 ? p.units / pv : 0,
        items: p.units,
        gmv: p.gmv,
        netGmv: p.netGmv,
        nmv: p.nmv,
        voucher,
        sellerDisc: p.sellerDiscount,
        freeGift,
        adSpend,
        brandAds,
        offPlatformAds,
        affComm,
        affBook,
        livestream,
        platformFee,
        primeCost: p.primeCost,
        cm,
        isCombo: p.isCombo ?? false,
      });
    }
    // Affiliate cost for product names not present in the Sales breakdown
    // (including names whose breakdown rows all had NMV=0) → bucket into an
    // "Others" pseudo-row so the platform total stays exact.
    let othersAffCost = 0;
    for (const [name, cost] of Object.entries(affCostByName)) {
      if (!matchedAffNames.has(name)) othersAffCost += cost;
    }
    if (othersAffCost > 0) {
      out.push({
        no: '',
        sku: '—',
        nameVi: 'Others',
        nameEn: 'Others',
        platform: 'SHOPEE',
        pv: 0,
        cvr: 0,
        items: 0,
        gmv: 0,
        netGmv: 0,
        nmv: 0,
        voucher: 0,
        sellerDisc: 0,
        freeGift: 0,
        adSpend: 0,
        brandAds: 0,
        offPlatformAds: 0,
        affComm: othersAffCost,
        affBook: 0,
        livestream: 0,
        platformFee: 0,
        primeCost: 0,
        cm: -othersAffCost,
        isOthers: true,
      });
    }

    for (const g of shopee.giftBreakdown ?? []) {
      out.push({
        no: '',
        sku: g.representativeSku,
        nameVi: g.productName,
        nameEn: g.productNameEn || g.productName,
        platform: 'SHOPEE',
        pv: g.pageViews ?? 0,
        cvr: 0,
        items: g.units,
        gmv: 0,
        netGmv: 0,
        nmv: 0,
        voucher: 0,
        sellerDisc: 0,
        freeGift: g.primeCost,
        adSpend: 0,
        brandAds: 0,
        offPlatformAds: 0,
        affComm: 0,
        affBook: 0,
        livestream: 0,
        platformFee: 0,
        primeCost: g.primeCost,
        cm: -g.primeCost,
        isGift: true,
      });
    }
  }

  if (useTiktok) {
    const total = tiktokNmvSum;
    const ratePct = constants?.tiktokPlatformFeeRatePct ?? 24;
    const tiktokBreakdown = tiktok.productBreakdown ?? [];

    // Mirror Shopee — exact per-SKU affiliate attribution by product name,
    // NMV-split among same-name variations, "Others" bucket for unmatched.
    const tiktokAffCostByName = tiktok.affiliateCostByProductName ?? {};
    const normalizeName = (s: string) => s.normalize('NFC').replace(/\s+/g, ' ').trim();
    const tiktokNmvByName = new Map<string, number>();
    for (const p of tiktokBreakdown) {
      const k = normalizeName(p.productName);
      tiktokNmvByName.set(k, (tiktokNmvByName.get(k) ?? 0) + p.nmv);
    }
    const matchedTiktokAffNames = new Set<string>();

    for (const p of tiktokBreakdown) {
      const share = total > 0 ? p.nmv / total : 0;
      const freeGift = tiktok.primeCostFreeGift * share;
      const adSpend = manualInputs.tiktokAdsSpending * share;
      const nameKey = normalizeName(p.productName);
      const productAffCost = tiktokAffCostByName[nameKey] ?? 0;
      const productNmvSum = tiktokNmvByName.get(nameKey) ?? 0;
      const affComm = productNmvSum > 0 && productAffCost > 0
        ? productAffCost * (p.nmv / productNmvSum)
        : 0;
      if (productAffCost > 0 && productNmvSum > 0) matchedTiktokAffNames.add(nameKey);
      const affBook = tiktokAffBookingFee * share;
      const livestream = manualInputs.tiktokLivestreamFees * share;
      // Per user spec: Platform Fee per row = (GMV − Seller Discount) × Rate.
      // Per-product = sum across rows = (productGmv − productSellerDiscount) × Rate.
      // Direct formula, not NMV-share allocation.
      const platformFee = (p.gmv - p.sellerDiscount) * (ratePct / 100);
      // Per user spec: TikTok per-product CM does NOT subtract Seller Discount
      const cm =
        p.netGmv -
        adSpend -
        platformFee -
        p.primeCost -
        freeGift -
        livestream -
        affComm -
        affBook;
      const pv = p.pageViews ?? 0;
      out.push({
        no: '',
        sku: p.representativeSku,
        nameVi: p.productName,
        nameEn: p.productNameEn || p.productName,
        variationName: p.variationName ?? '',
        platform: 'TIKTOK',
        pv,
        cvr: pv > 0 ? p.units / pv : 0,
        ctr: (p as { ctr?: number }).ctr ?? 0,
        items: p.units,
        gmv: p.gmv,
        netGmv: p.netGmv,
        nmv: p.nmv,
        voucher: 0,
        sellerDisc: p.sellerDiscount,
        freeGift,
        adSpend,
        brandAds: 0,
        offPlatformAds: 0,
        affComm,
        affBook,
        livestream,
        platformFee,
        primeCost: p.primeCost,
        cm,
        isCombo: p.isCombo ?? false,
      });
    }
    // Affiliate cost for product names not present in TikTok Sales breakdown
    // (or whose breakdown rows had NMV=0) → "Others" pseudo-row.
    let othersTiktokAffCost = 0;
    for (const [name, cost] of Object.entries(tiktokAffCostByName)) {
      if (!matchedTiktokAffNames.has(name)) othersTiktokAffCost += cost;
    }
    if (othersTiktokAffCost > 0) {
      out.push({
        no: '',
        sku: '—',
        nameVi: 'Others',
        nameEn: 'Others',
        platform: 'TIKTOK',
        pv: 0,
        cvr: 0,
        items: 0,
        gmv: 0,
        netGmv: 0,
        nmv: 0,
        voucher: 0,
        sellerDisc: 0,
        freeGift: 0,
        adSpend: 0,
        brandAds: 0,
        offPlatformAds: 0,
        affComm: othersTiktokAffCost,
        affBook: 0,
        livestream: 0,
        platformFee: 0,
        primeCost: 0,
        cm: -othersTiktokAffCost,
        isOthers: true,
      });
    }

    for (const g of tiktok.giftBreakdown ?? []) {
      out.push({
        no: '',
        sku: g.representativeSku,
        nameVi: g.productName,
        nameEn: g.productNameEn || g.productName,
        platform: 'TIKTOK',
        pv: g.pageViews ?? 0,
        cvr: 0,
        items: g.units,
        gmv: 0,
        netGmv: 0,
        nmv: 0,
        voucher: 0,
        sellerDisc: 0,
        freeGift: g.primeCost,
        adSpend: 0,
        brandAds: 0,
        offPlatformAds: 0,
        affComm: 0,
        affBook: 0,
        livestream: 0,
        platformFee: 0,
        primeCost: g.primeCost,
        cm: -g.primeCost,
        isGift: true,
      });
    }
  }

  // Sort order:
  //   1. Regular products first; gifts grouped at the bottom (yellow band)
  //   2. Within each group: product name ASC
  //   3. Within same product: by "primary SKU" — for combos like
  //      `A_B`, primary = `A` (component before the first underscore). This
  //      places each combo right next to its base SKU.
  //   4. Within same primary: regular first, combo after, then GMV DESC.
  //   5. ShopWideAd + Others appended after this sort.
  const primarySku = (sku: string): string => {
    const idx = sku.indexOf('_');
    return idx >= 0 ? sku.slice(0, idx) : sku;
  };
  out.sort((a, b) => {
    const aIsGift = a.isGift ? 1 : 0;
    const bIsGift = b.isGift ? 1 : 0;
    if (aIsGift !== bIsGift) return aIsGift - bIsGift;
    const nameCmp = a.nameVi.localeCompare(b.nameVi, 'vi');
    if (nameCmp !== 0) return nameCmp;
    const primaryCmp = primarySku(a.sku).localeCompare(primarySku(b.sku));
    if (primaryCmp !== 0) return primaryCmp;
    const aCombo = a.isCombo ? 1 : 0;
    const bCombo = b.isCombo ? 1 : 0;
    if (aCombo !== bCombo) return aCombo - bCombo;
    return b.gmv - a.gmv;
  });

  // PV is reported per product listing (not per SKU variation). After
  // splitting SKUs into separate rows, PV would be duplicated across rows of
  // the same product. Keep PV only on the first (highest-GMV) row of each
  // product group; zero out PV + CVR on the rest. CVR on the owner row uses
  // total items across all variations of the product (so it reflects the
  // product's overall conversion, not just the top variation's).
  {
    const itemsByProduct = new Map<string, number>();
    for (const p of out) {
      if (p.isGift || p.isShopWideAd || p.isOthers) continue;
      itemsByProduct.set(p.nameVi, (itemsByProduct.get(p.nameVi) ?? 0) + p.items);
    }
    const seenPv = new Set<string>();
    for (const p of out) {
      if (p.isGift || p.isShopWideAd || p.isOthers) continue;
      if (seenPv.has(p.nameVi)) {
        p.pv = 0;
        p.cvr = 0;
      } else {
        seenPv.add(p.nameVi);
        const totalItems = itemsByProduct.get(p.nameVi) ?? p.items;
        p.cvr = p.pv > 0 ? totalItems / p.pv : 0;
      }
    }
  }

  // Shop-wide ad campaigns (Shopee only) — added as standalone rows after the
  // per-product list. Only AD Spend column is populated; everything else dashed
  // because these costs aren't tied to a specific product.
  if (useShopee) {
    const mkShopAdRow = (label: string, adSpend: number): ProductMetric => ({
      no: '',
      sku: '—',
      nameVi: label,
      nameEn: label,
      platform: 'SHOPEE',
      pv: 0,
      cvr: 0,
      items: 0,
      gmv: 0,
      netGmv: 0,
      nmv: 0,
      voucher: 0,
      sellerDisc: 0,
      freeGift: 0,
      adSpend,
      brandAds: 0,
      offPlatformAds: 0,
      affComm: 0,
      affBook: 0,
      livestream: 0,
      platformFee: 0,
      primeCost: 0,
      cm: 0,
      isShopWideAd: true,
    });
    if (shopee.shopAdsCost > 0) out.push(mkShopAdRow('Shop Ads', shopee.shopAdsCost));
    if (shopee.shopGmvMaxCost > 0) out.push(mkShopAdRow('Shop GMV Max', shopee.shopGmvMaxCost));
  }

  // "Others" bucket — products that had Page Views (and/or ad spend) but no
  // kept sales. Derived by subtracting per-product PV that matched kept rows
  // from the platform's totalPageViews. Per-product ad spend isn't persisted
  // in the snapshot yet, so AD Spend in Others stays 0 for now.
  const shopeeKeptPv = useShopee
    ? (shopee.productBreakdown ?? []).reduce((a, p) => a + (p.pageViews ?? 0), 0) +
      (shopee.giftBreakdown ?? []).reduce((a, g) => a + (g.pageViews ?? 0), 0)
    : 0;
  const tiktokKeptPv = useTiktok
    ? (tiktok.productBreakdown ?? []).reduce((a, p) => a + (p.pageViews ?? 0), 0) +
      (tiktok.giftBreakdown ?? []).reduce((a, g) => a + (g.pageViews ?? 0), 0)
    : 0;
  const shopeeTotalPv = useShopee ? shopee.totalPageViews : 0;
  const tiktokTotalPv = useTiktok ? tiktok.totalPageViews : 0;
  const othersPv = Math.max(0, shopeeTotalPv - shopeeKeptPv) + Math.max(0, tiktokTotalPv - tiktokKeptPv);
  if (othersPv > 0) {
    out.push({
      no: '',
      sku: '—',
      nameVi: 'Others',
      nameEn: 'Products with views/ads but no sales',
      // Platform pill: pick whichever single channel is active; for ALL use SHOPEE as default
      platform: channel === 'TIKTOK' ? 'TIKTOK' : 'SHOPEE',
      pv: othersPv,
      cvr: 0,
      items: 0,
      gmv: 0,
      netGmv: 0,
      nmv: 0,
      voucher: 0,
      sellerDisc: 0,
      freeGift: 0,
      adSpend: 0,
      brandAds: 0,
      offPlatformAds: 0,
      affComm: 0,
      affBook: 0,
      livestream: 0,
      platformFee: 0,
      primeCost: 0,
      cm: 0,
      isOthers: true,
    });
  }

  return out.map((p, i) => ({ ...p, no: String(i + 1).padStart(2, '0') }));
}
