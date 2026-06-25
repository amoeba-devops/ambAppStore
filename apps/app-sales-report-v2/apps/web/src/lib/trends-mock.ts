/**
 * MOCK demo data for Trends page until raw-sales parsing + CM calc pipeline ships.
 * Replace with real query against sal_weekly_metrics / sal_monthly_metrics when ready.
 */

export type Channel = 'SHOPEE' | 'TIKTOK' | 'TOTAL';
export type Granularity = 'WEEK' | 'MONTH';

export type Metric =
  // Volume
  | 'GMV'
  | 'NET_GMV'
  | 'CM'
  | 'ORDERS'
  | 'PRIME_COST'
  | 'PLATFORM_FEE'
  // Discount costs
  | 'TOTAL_DISCOUNT_COSTS'
  | 'SELLER_VOUCHER'
  | 'SELLER_DISCOUNT'
  | 'FREE_GIFT'
  | 'PLATFORM_DISCOUNT_RFR'
  // Promotional costs
  | 'TOTAL_PROMOTIONAL_COST'
  | 'AD_SPEND'
  | 'BRAND_ADS'
  | 'OFF_PLATFORM_ADS'
  | 'AFFILIATE_COMMISSION'
  | 'AFFILIATE_BOOKING_FEE'
  | 'LIVESTREAM_FEE'
  // Traffic
  | 'PAGE_VIEW'
  | 'CONVERSION_RATE';

export type MetricKind = 'money' | 'count' | 'ratio';

export interface MetricDef {
  key: Metric;
  label: string;
  kind: MetricKind;
  group: 'volume' | 'discount' | 'promo' | 'traffic' | 'margin';
}

export const METRICS: MetricDef[] = [
  { key: 'GMV', label: 'GMV', kind: 'money', group: 'volume' },
  { key: 'NET_GMV', label: 'Net GMV', kind: 'money', group: 'volume' },
  { key: 'CM', label: 'Contribution Margin', kind: 'money', group: 'margin' },
  { key: 'ORDERS', label: 'Orders', kind: 'count', group: 'volume' },
  { key: 'PRIME_COST', label: 'Prime Cost', kind: 'money', group: 'volume' },
  { key: 'PLATFORM_FEE', label: 'Platform Fee', kind: 'money', group: 'volume' },

  { key: 'TOTAL_DISCOUNT_COSTS', label: 'Total Discount Costs', kind: 'money', group: 'discount' },
  { key: 'SELLER_VOUCHER', label: 'Seller Voucher', kind: 'money', group: 'discount' },
  { key: 'SELLER_DISCOUNT', label: 'Seller Discount', kind: 'money', group: 'discount' },
  { key: 'FREE_GIFT', label: 'Free Gift', kind: 'money', group: 'discount' },
  { key: 'PLATFORM_DISCOUNT_RFR', label: 'Platform Discount (Rfr)', kind: 'money', group: 'discount' },

  { key: 'TOTAL_PROMOTIONAL_COST', label: 'Total Promotional Cost', kind: 'money', group: 'promo' },
  { key: 'AD_SPEND', label: 'AD Spend', kind: 'money', group: 'promo' },
  { key: 'BRAND_ADS', label: 'Brand Ads (Shopee)', kind: 'money', group: 'promo' },
  { key: 'OFF_PLATFORM_ADS', label: 'Off-platform Ads', kind: 'money', group: 'promo' },
  { key: 'AFFILIATE_COMMISSION', label: 'Affiliate Commission', kind: 'money', group: 'promo' },
  { key: 'AFFILIATE_BOOKING_FEE', label: 'Affiliate Booking Fee', kind: 'money', group: 'promo' },
  { key: 'LIVESTREAM_FEE', label: 'Livestream Fee', kind: 'money', group: 'promo' },

  { key: 'PAGE_VIEW', label: 'Total Page View', kind: 'count', group: 'traffic' },
  { key: 'CONVERSION_RATE', label: 'Conversion Rate', kind: 'ratio', group: 'traffic' },
];

export function getMetricDef(key: Metric): MetricDef {
  return METRICS.find((m) => m.key === key) ?? METRICS[0]!;
}

// ============================================================================
// Mock per-week data
// ============================================================================

interface ChannelWeek {
  gmv: number;
  netGmv: number;
  cm: number;
  orders: number;
  primeCost: number;
  platformFee: number;
  sellerVoucher: number;
  sellerDiscount: number;
  freeGift: number;
  platformDiscount: number;
  adSpend: number;
  brandAds: number;
  offPlatformAds: number;
  affiliateCommission: number;
  affiliateBooking: number;
  livestreamFee: number;
  pageView: number;
  conversionRate: number; // 0..1
}

export interface WeekPoint {
  weekNum: number;
  year: number;
  periodLabel: string;
  /** Friday-to-Thursday week start (UTC). */
  startDate?: Date;
  /** Friday-to-Thursday week end (UTC). */
  endDate?: Date;
  /** Column-header display label override (e.g., "MARCH" for monthly aggregates). Defaults to W{NN}. */
  displayLabel?: string;
  shopee: ChannelWeek;
  tiktok: ChannelWeek;
}

export function getPeriodHeaderLabel(p: WeekPoint): string {
  return p.displayLabel ?? `W${p.weekNum.toString().padStart(2, '0')}`;
}

// Realistic-looking mock — values trend up week-over-week with some noise.
// Brand Ads + Off-platform Ads are Shopee-only (TikTok = 0 per FR-03).
function makeShopee(week: number): ChannelWeek {
  const growth = 1 + (week - 11) * 0.04; // ~4% weekly growth
  const noise = 1 + ((week * 17) % 7) / 100; // pseudo-random +0..+6%
  const netGmv = Math.round(1_700_000_000 * growth * noise);
  const gmv = Math.round(netGmv * 1.11);
  const primeCost = Math.round(netGmv * 0.36);
  const platformFee = Math.round(netGmv * 0.13);
  const sellerVoucher = Math.round(netGmv * 0.012);
  const sellerDiscount = Math.round(netGmv * 0.054);
  const freeGift = Math.round(netGmv * 0.007);
  const platformDiscount = Math.round(netGmv * 0.027);
  const adSpend = Math.round(netGmv * 0.09);
  const brandAds = Math.round(netGmv * 0.022);
  const offPlatformAds = Math.round(netGmv * 0.008);
  const affiliateCommission = Math.round(netGmv * 0.024);
  const affiliateBooking = Math.round(netGmv * 0.013);
  const livestreamFee = Math.round(netGmv * 0.003);
  const cm =
    netGmv -
    sellerDiscount -
    primeCost -
    adSpend -
    brandAds -
    platformFee -
    sellerVoucher -
    livestreamFee -
    offPlatformAds -
    freeGift -
    affiliateBooking -
    affiliateCommission;
  return {
    gmv,
    netGmv,
    cm,
    orders: Math.round(netGmv / 290_000),
    primeCost,
    platformFee,
    sellerVoucher,
    sellerDiscount,
    freeGift,
    platformDiscount,
    adSpend,
    brandAds,
    offPlatformAds,
    affiliateCommission,
    affiliateBooking,
    livestreamFee,
    pageView: Math.round(netGmv / 28_000),
    conversionRate: 0.017 + ((week * 13) % 9) / 1000,
  };
}

function makeTikTok(week: number): ChannelWeek {
  const growth = 1 + (week - 11) * 0.05;
  const noise = 1 + ((week * 23) % 6) / 100;
  const netGmv = Math.round(960_000_000 * growth * noise);
  const gmv = Math.round(netGmv * 1.11);
  const primeCost = Math.round(netGmv * 0.32);
  const platformFee = Math.round(netGmv * 0.16);
  const sellerVoucher = 0;
  const sellerDiscount = Math.round(netGmv * 0.06);
  const freeGift = Math.round(netGmv * 0.008);
  const platformDiscount = Math.round(netGmv * 0.03);
  const adSpend = Math.round(netGmv * 0.085);
  const brandAds = 0; // TikTok has no brand ads per FR-03
  const offPlatformAds = 0;
  const affiliateCommission = Math.round(netGmv * 0.03);
  const affiliateBooking = Math.round(netGmv * 0.015);
  const livestreamFee = Math.round(netGmv * 0.005);
  const cm =
    netGmv -
    sellerDiscount -
    primeCost -
    adSpend -
    platformFee -
    livestreamFee -
    freeGift -
    affiliateBooking -
    affiliateCommission;
  return {
    gmv,
    netGmv,
    cm,
    orders: Math.round(netGmv / 290_000),
    primeCost,
    platformFee,
    sellerVoucher,
    sellerDiscount,
    freeGift,
    platformDiscount,
    adSpend,
    brandAds,
    offPlatformAds,
    affiliateCommission,
    affiliateBooking,
    livestreamFee,
    pageView: Math.round(netGmv / 22_000),
    conversionRate: 0.022 + ((week * 11) % 8) / 1000,
  };
}

// Weeks are Friday → Thursday (client convention, not ISO Mon–Sun).
// W11 starts Fri Mar 6, 2026.
const FIRST_WEEK_START_2026 = Date.UTC(2026, 2, 6); // Mar 6, 2026 (Friday)
const MS_PER_DAY = 86_400_000;

const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function fmtFriThuRange(start: Date, end: Date): string {
  const sameMonth =
    start.getUTCMonth() === end.getUTCMonth() && start.getUTCFullYear() === end.getUTCFullYear();
  if (sameMonth) {
    return `${start.getUTCDate()} - ${end.getUTCDate()} ${MONTH_SHORT[end.getUTCMonth()]}`;
  }
  return `${start.getUTCDate()} ${MONTH_SHORT[start.getUTCMonth()]} - ${end.getUTCDate()} ${MONTH_SHORT[end.getUTCMonth()]}`;
}

export const WEEKLY_DATA: WeekPoint[] = Array.from({ length: 8 }, (_, i) => {
  const week = 11 + i;
  const startMs = FIRST_WEEK_START_2026 + i * 7 * MS_PER_DAY;
  const start = new Date(startMs);
  const end = new Date(startMs + 6 * MS_PER_DAY);
  return {
    weekNum: week,
    year: 2026,
    startDate: start,
    endDate: end,
    periodLabel: fmtFriThuRange(start, end),
    shopee: makeShopee(week),
    tiktok: makeTikTok(week),
  };
});

// ============================================================================
// Accessors
// ============================================================================

function channelValue(c: ChannelWeek, metric: Metric): number {
  switch (metric) {
    case 'GMV':
      return c.gmv;
    case 'NET_GMV':
      return c.netGmv;
    case 'CM':
      return c.cm;
    case 'ORDERS':
      return c.orders;
    case 'PRIME_COST':
      return c.primeCost;
    case 'PLATFORM_FEE':
      return c.platformFee;
    case 'SELLER_VOUCHER':
      return c.sellerVoucher;
    case 'SELLER_DISCOUNT':
      return c.sellerDiscount;
    case 'FREE_GIFT':
      return c.freeGift;
    case 'PLATFORM_DISCOUNT_RFR':
      return c.platformDiscount;
    case 'TOTAL_DISCOUNT_COSTS':
      // Platform Discount (Rfr) is reference-only — not summed into total per business rule
      return c.sellerVoucher + c.sellerDiscount + c.freeGift;
    case 'AD_SPEND':
      return c.adSpend;
    case 'BRAND_ADS':
      return c.brandAds;
    case 'OFF_PLATFORM_ADS':
      return c.offPlatformAds;
    case 'AFFILIATE_COMMISSION':
      return c.affiliateCommission;
    case 'AFFILIATE_BOOKING_FEE':
      return c.affiliateBooking;
    case 'LIVESTREAM_FEE':
      return c.livestreamFee;
    case 'TOTAL_PROMOTIONAL_COST':
      return (
        c.adSpend +
        c.brandAds +
        c.offPlatformAds +
        c.affiliateCommission +
        c.affiliateBooking +
        c.livestreamFee
      );
    case 'PAGE_VIEW':
      return c.pageView;
    case 'CONVERSION_RATE':
      return c.conversionRate;
  }
}

export function channelMetric(p: WeekPoint, channel: Channel, metric: Metric): number {
  if (channel === 'TOTAL') return combinedMetric(p, metric);
  const c = channel === 'SHOPEE' ? p.shopee : p.tiktok;
  return channelValue(c, metric);
}

export function combinedMetric(p: WeekPoint, metric: Metric): number {
  if (metric === 'CONVERSION_RATE') {
    // Weighted average by page view (proxy for impressions)
    const sPv = p.shopee.pageView;
    const tPv = p.tiktok.pageView;
    const total = sPv + tPv;
    if (total === 0) return 0;
    return (p.shopee.conversionRate * sPv + p.tiktok.conversionRate * tPv) / total;
  }
  return channelValue(p.shopee, metric) + channelValue(p.tiktok, metric);
}

export interface ChannelSummary {
  current: number;
  fourWeekAvg: number;
  wowPct: number | null;
  momPct: number | null;
}

export function computeChannelSummary(
  data: WeekPoint[],
  channel: Channel,
  metric: Metric,
): ChannelSummary {
  if (data.length === 0) return { current: 0, fourWeekAvg: 0, wowPct: null, momPct: null };
  const values = data.map((p) => channelMetric(p, channel, metric));
  const current = values[values.length - 1]!;
  const prev = values.length >= 2 ? values[values.length - 2]! : null;
  const wowPct = prev != null && prev !== 0 ? (current - prev) / Math.abs(prev) : null;

  const last4 = values.slice(-4);
  const fourWeekAvg = last4.reduce((a, b) => a + b, 0) / last4.length;

  const prev4 = values.slice(-8, -4);
  let momPct: number | null = null;
  if (prev4.length === 4) {
    const prev4Avg = prev4.reduce((a, b) => a + b, 0) / 4;
    if (prev4Avg !== 0) momPct = (fourWeekAvg - prev4Avg) / Math.abs(prev4Avg);
  }

  return { current, fourWeekAvg, wowPct, momPct };
}

// ============================================================================
// Combined WoW summary table (primary 4 metrics)
// ============================================================================

export interface WowSummaryRow {
  weekLabel: string;
  periodLabel: string;
  gmv: number;
  netGmv: number;
  cm: number;
  orders: number;
  gmvWow: number | null;
  netGmvWow: number | null;
  cmWow: number | null;
  ordersWow: number | null;
}

export function buildWowSummary(data: WeekPoint[]): WowSummaryRow[] {
  return data.map((p, idx) => {
    const gmv = combinedMetric(p, 'GMV');
    const netGmv = combinedMetric(p, 'NET_GMV');
    const cm = combinedMetric(p, 'CM');
    const orders = combinedMetric(p, 'ORDERS');

    const prev = idx > 0 ? data[idx - 1]! : null;
    const wow = (cur: number, prevVal: number | null) =>
      prevVal == null || prevVal === 0 ? null : (cur - prevVal) / Math.abs(prevVal);

    return {
      weekLabel: `W${p.weekNum.toString().padStart(2, '0')}`,
      periodLabel: p.periodLabel,
      gmv,
      netGmv,
      cm,
      orders,
      gmvWow: wow(gmv, prev ? combinedMetric(prev, 'GMV') : null),
      netGmvWow: wow(netGmv, prev ? combinedMetric(prev, 'NET_GMV') : null),
      cmWow: wow(cm, prev ? combinedMetric(prev, 'CM') : null),
      ordersWow: wow(orders, prev ? combinedMetric(prev, 'ORDERS') : null),
    };
  });
}

export function getChartSeries(data: WeekPoint[], channel: Channel, metric: Metric) {
  return data.map((p) => ({
    label: getPeriodHeaderLabel(p),
    value: channelMetric(p, channel, metric),
  }));
}

// ============================================================================
// Monthly aggregation (sum sub-period values; conversion rate = page-view weighted)
// ============================================================================

function sumChannelWeeks(parts: ChannelWeek[]): ChannelWeek {
  const sum = (k: keyof ChannelWeek) => parts.reduce((a, b) => a + (b[k] as number), 0);
  const totalPV = sum('pageView');
  const weightedConv =
    totalPV === 0 ? 0 : parts.reduce((a, b) => a + b.conversionRate * b.pageView, 0) / totalPV;
  return {
    gmv: sum('gmv'),
    netGmv: sum('netGmv'),
    cm: sum('cm'),
    orders: sum('orders'),
    primeCost: sum('primeCost'),
    platformFee: sum('platformFee'),
    sellerVoucher: sum('sellerVoucher'),
    sellerDiscount: sum('sellerDiscount'),
    freeGift: sum('freeGift'),
    platformDiscount: sum('platformDiscount'),
    adSpend: sum('adSpend'),
    brandAds: sum('brandAds'),
    offPlatformAds: sum('offPlatformAds'),
    affiliateCommission: sum('affiliateCommission'),
    affiliateBooking: sum('affiliateBooking'),
    livestreamFee: sum('livestreamFee'),
    pageView: totalPV,
    conversionRate: weightedConv,
  };
}

const MONTH_NAMES = [
  'JAN',
  'FEB',
  'MAR',
  'APR',
  'MAY',
  'JUN',
  'JUL',
  'AUG',
  'SEP',
  'OCT',
  'NOV',
  'DEC',
] as const;

const MONTH_LONG = [
  'JANUARY',
  'FEBRUARY',
  'MARCH',
  'APRIL',
  'MAY',
  'JUNE',
  'JULY',
  'AUGUST',
  'SEPTEMBER',
  'OCTOBER',
  'NOVEMBER',
  'DECEMBER',
] as const;

function daysInMonth(year: number, monthIdx: number): number {
  return new Date(year, monthIdx + 1, 0).getDate();
}

/**
 * Group weeks by the calendar month of the week's *start* date.
 * Returns one virtual "monthly point" per (year, month) covered.
 * Mock-friendly: in real impl we'd query monthly metrics from DB directly.
 */
export function buildMonthlyData(weeks: WeekPoint[]): WeekPoint[] {
  if (weeks.length === 0) return [];
  // Group by the week's END (Thursday) — reporting convention.
  const groups = new Map<string, WeekPoint[]>();
  for (const w of weeks) {
    let mIdx: number;
    let year: number;
    if (w.endDate) {
      mIdx = w.endDate.getUTCMonth();
      year = w.endDate.getUTCFullYear();
    } else {
      // Fallback: parse from periodLabel
      const tail = w.periodLabel.split(' ').slice(-1)[0]?.slice(0, 3).toUpperCase() ?? '';
      mIdx = MONTH_NAMES.indexOf(tail as (typeof MONTH_NAMES)[number]);
      year = w.year;
      if (mIdx < 0) continue;
    }
    const key = `${year}-${mIdx}`;
    const arr = groups.get(key) ?? [];
    arr.push(w);
    groups.set(key, arr);
  }

  const result: WeekPoint[] = [];
  for (const [key, arr] of Array.from(groups.entries()).sort()) {
    const [yearStr, mIdxStr] = key.split('-');
    const year = Number(yearStr);
    const mIdx = Number(mIdxStr);
    const monthShort = MONTH_NAMES[mIdx]!.charAt(0) + MONTH_NAMES[mIdx]!.slice(1).toLowerCase();
    result.push({
      weekNum: mIdx + 1, // 1-based month for sorting
      year,
      periodLabel: `${monthShort} 01 - ${daysInMonth(year, mIdx).toString().padStart(2, '0')}`,
      displayLabel: MONTH_LONG[mIdx],
      shopee: sumChannelWeeks(arr.map((w) => w.shopee)),
      tiktok: sumChannelWeeks(arr.map((w) => w.tiktok)),
    });
  }
  return result;
}

export const MONTHLY_DATA: WeekPoint[] = buildMonthlyData(WEEKLY_DATA);
