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
import type { WeeklyReportData, OverviewRow, BreakdownItem, WeeklyChannel } from './weekly-report-mock';
import type { PeriodSnapshotMetrics } from '@/server/services/period-snapshot.service';

export function snapshotToWeeklyReport(
  snap: PeriodSnapshotMetrics,
  channel: WeeklyChannel,
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

  // TikTok Platform Fee = Total Net GMV × Platform Fee Rate
  const tiktokPlatformFee =
    (tiktok.totalNetGmv * (constants?.tiktokPlatformFeeRatePct ?? 24)) / 100;

  // Per-platform CM (per Formula Config — Free Gift is a separate line in addition
  // to Total Prime Cost, matching FINAL REPORT structure).
  // Shopee subtracts Seller Discount, TikTok does NOT — user spec.
  const shopeeCm =
    shopee.totalNetGmv -
    shopee.totalSellerDiscount -
    shopee.totalPrimeCost - // (kept + free gift)
    shopee.totalAdSpending -
    shopee.totalBrandAds -
    shopee.totalPlatformFee -
    shopee.totalSellerVouchers -
    manualInputs.shopeeLivestreamFees -
    shopee.totalOffPlatformAds -
    shopee.primeCostFreeGift - // Total Free Gift — separate line per Formula Config
    shopeeAffBookingFee -
    shopee.totalAffiliateCommission;

  const tiktokCm =
    tiktok.totalNetGmv -
    tiktok.totalSellerDiscount -
    tiktok.totalPrimeCost -
    manualInputs.tiktokAdsSpending -
    tiktokPlatformFee -
    manualInputs.tiktokLivestreamFees -
    tiktok.primeCostFreeGift - // Total Free Gift — separate line
    tiktokAffBookingFee -
    tiktok.totalAffiliateCommission;

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

  const platformDiscount = useShopee ? shopee.totalPlatformDiscount : 0;
  const discounts: BreakdownItem[] = [
    ...(useShopee
      ? [{ label: 'Total Seller Voucher', vnd: sellerVouchers, pctGmv: pct(sellerVouchers), wowPct: null, invertWow: true }]
      : []),
    { label: 'Total Seller Discount', vnd: sellerDiscount, pctGmv: pct(sellerDiscount), wowPct: null, invertWow: true },
    { label: 'Total Free Gift', vnd: freeGift, pctGmv: pct(freeGift), wowPct: null, invertWow: true },
    ...(useShopee
      ? [{ label: 'Total Platform Discount (Ref)', vnd: platformDiscount, pctGmv: pct(platformDiscount), wowPct: null, reference: true } as BreakdownItem]
      : []),
  ];

  const promo: BreakdownItem[] = [
    { label: 'Affiliate Commission', vnd: affiliateCommission, pctGmv: pct(affiliateCommission), wowPct: null, invertWow: true },
    { label: 'Livestream Fee', vnd: livestreamFee, pctGmv: pct(livestreamFee), wowPct: null, invertWow: true },
    ...(channel === 'ALL'
      ? [{ label: 'Affiliate Booking Fee', vnd: affiliateBookingFee, pctGmv: pct(affiliateBookingFee), wowPct: null, invertWow: true }]
      : []),
  ];

  const traffic: BreakdownItem[] = [
    { label: 'Total Page Views', raw: pageViews, rawDisplay: pageViews.toLocaleString('en-US'), wowPct: null },
  ];

  const sales: BreakdownItem[] = [
    { label: 'GMV', vnd: gmv, pctGmv: pct(gmv), wowPct: null },
    { label: 'Net GMV', vnd: netGmv, pctGmv: 1, wowPct: null, summary: true },
    { label: 'NMV', vnd: nmv, pctGmv: pct(nmv), wowPct: null },
    { label: 'Prime Cost', vnd: primeCost, pctGmv: pct(primeCost), wowPct: null, invertWow: true },
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

  return {
    netGmv,
    cm,
    cmPct,
    netGmvWow: null,
    cmWow: null,
    cmPctWow: null,
    overview,
    discounts,
    promo,
    traffic,
    sales,
    ads,
    prevWeekLabel: '—',
  };
}
