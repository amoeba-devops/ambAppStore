/**
 * Convert persisted period snapshots → the `WeekPoint[]` shape consumed by the
 * Trends page. CM is computed using the same per-channel formulas as
 * snapshot-to-report.ts (Free Gift is a separate line on top of Total Prime
 * Cost, TikTok CM does NOT subtract Seller Discount, Affiliate Booking Fee is
 * split across platforms by GMV share).
 */
import type { WeekPoint } from './trends-mock';
import type { PeriodSnapshotRow } from '@/server/services/period-snapshot.service';

const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTH_LONG = [
  'JANUARY', 'FEBRUARY', 'MARCH', 'APRIL', 'MAY', 'JUNE',
  'JULY', 'AUGUST', 'SEPTEMBER', 'OCTOBER', 'NOVEMBER', 'DECEMBER',
];

function fmtFriThuRange(start: Date, end: Date): string {
  const sameMonth =
    start.getUTCMonth() === end.getUTCMonth() && start.getUTCFullYear() === end.getUTCFullYear();
  if (sameMonth) {
    return `${start.getUTCDate()} - ${end.getUTCDate()} ${MONTH_SHORT[end.getUTCMonth()]}`;
  }
  return `${start.getUTCDate()} ${MONTH_SHORT[start.getUTCMonth()]} - ${end.getUTCDate()} ${MONTH_SHORT[end.getUTCMonth()]}`;
}

export function snapshotsToWeekPoints(rows: PeriodSnapshotRow[]): WeekPoint[] {
  return rows.map((row) => {
    const { metrics, granularity, weekNum, monthIdx, year, periodStart, periodEnd } = row;
    const { shopee, tiktok, manualInputs, constants } = metrics;

    // Allocate Affiliate Booking Fee across platforms by GMV share (matches snapshot-to-report)
    const totalGmvBoth = shopee.totalGmv + tiktok.totalGmv;
    const shopeeAffBookingFee =
      totalGmvBoth > 0 ? (manualInputs.affiliateBookingFees * shopee.totalGmv) / totalGmvBoth : 0;
    const tiktokAffBookingFee =
      totalGmvBoth > 0 ? (manualInputs.affiliateBookingFees * tiktok.totalGmv) / totalGmvBoth : 0;

    // TikTok Platform Fee — prefer the generic formula-config snapshot block
    // (FR-23); fall back to the legacy `tiktokPlatformFeeRatePct` field for
    // snapshots written before that rollout.
    const cfgRateRaw = constants?.formulaConfig?.['tiktok_platform_fee_rate_pct']?.value;
    const cfgRate = cfgRateRaw != null ? Number(cfgRateRaw) : undefined;
    const ratePctTrends = Number.isFinite(cfgRate)
      ? (cfgRate as number)
      : (constants?.tiktokPlatformFeeRatePct ?? 24);
    const tiktokPlatformFee =
      tiktok.totalPlatformFee ??
      (tiktok.totalGmv - tiktok.totalSellerDiscount) * (ratePctTrends / 100);

    // Per-channel CM (mirrors snapshot-to-report.ts)
    const shopeeCm =
      shopee.totalNetGmv -
      shopee.totalSellerDiscount -
      shopee.totalPrimeCost -
      shopee.totalAdSpending -
      shopee.totalBrandAds -
      shopee.totalPlatformFee -
      shopee.totalSellerVouchers -
      manualInputs.shopeeLivestreamFees -
      shopee.totalOffPlatformAds -
      shopee.primeCostFreeGift -
      shopeeAffBookingFee -
      shopee.totalAffiliateCommission;

    const tiktokCm =
      tiktok.totalNetGmv -
      manualInputs.tiktokAdsSpending -
      tiktokPlatformFee -
      tiktok.totalPrimeCost -
      tiktok.primeCostFreeGift -
      manualInputs.tiktokLivestreamFees -
      tiktok.totalAffiliateCommission -
      tiktokAffBookingFee;

    // Conversion rate fallback when totalItemSold missing on legacy snapshots
    const shopeeItemSold = shopee.totalItemSold ?? 0;
    const tiktokItemSold = tiktok.totalItemSold ?? 0;
    const shopeeConv = shopee.totalPageViews > 0 ? shopeeItemSold / shopee.totalPageViews : 0;
    const tiktokConv = tiktok.totalPageViews > 0 ? tiktokItemSold / tiktok.totalPageViews : 0;

    // Sticky labels for display
    const displayLabel =
      granularity === 'WEEKLY'
        ? undefined
        : MONTH_LONG[monthIdx ?? 0];
    const periodLabel =
      granularity === 'WEEKLY'
        ? fmtFriThuRange(periodStart, periodEnd)
        : `${MONTH_SHORT[monthIdx ?? 0]} 01 - ${periodEnd.getUTCDate().toString().padStart(2, '0')}`;

    // For monthly rows weekNum is null → use monthIdx (1-based) so the existing
    // `getPeriodHeaderLabel` doesn't fall back to "W00".
    const labelNum =
      granularity === 'WEEKLY'
        ? (weekNum ?? 0)
        : (monthIdx ?? 0) + 1;

    return {
      weekNum: labelNum,
      year,
      startDate: periodStart,
      endDate: periodEnd,
      displayLabel,
      periodLabel,
      shopee: {
        gmv: shopee.totalGmv,
        netGmv: shopee.totalNetGmv,
        cm: shopeeCm,
        orders: shopee.orderCounts?.nonCancelled ?? 0,
        primeCost: shopee.totalPrimeCost,
        platformFee: shopee.totalPlatformFee,
        sellerVoucher: shopee.totalSellerVouchers,
        sellerDiscount: shopee.totalSellerDiscount,
        freeGift: shopee.primeCostFreeGift,
        platformDiscount: shopee.totalPlatformDiscount,
        adSpend: shopee.totalAdSpending,
        brandAds: shopee.totalBrandAds,
        offPlatformAds: shopee.totalOffPlatformAds,
        affiliateCommission: shopee.totalAffiliateCommission,
        affiliateBooking: shopeeAffBookingFee,
        livestreamFee: manualInputs.shopeeLivestreamFees,
        pageView: shopee.totalPageViews,
        conversionRate: shopeeConv,
      },
      tiktok: {
        gmv: tiktok.totalGmv,
        netGmv: tiktok.totalNetGmv,
        cm: tiktokCm,
        orders: tiktok.orderCounts?.nonCancelled ?? 0,
        primeCost: tiktok.totalPrimeCost,
        platformFee: tiktokPlatformFee,
        sellerVoucher: 0,
        sellerDiscount: tiktok.totalSellerDiscount,
        freeGift: tiktok.primeCostFreeGift,
        platformDiscount: tiktok.totalPlatformDiscount ?? 0,
        adSpend: manualInputs.tiktokAdsSpending,
        brandAds: 0,
        offPlatformAds: 0,
        affiliateCommission: tiktok.totalAffiliateCommission,
        affiliateBooking: tiktokAffBookingFee,
        livestreamFee: manualInputs.tiktokLivestreamFees,
        pageView: tiktok.totalPageViews,
        conversionRate: tiktokConv,
      },
    };
  });
}
