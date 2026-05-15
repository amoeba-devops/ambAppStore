/**
 * MOCK demo data for Weekly Report until real CM-calc pipeline ships.
 * Mirrors the per-product structure that sal_product_metrics will eventually serve.
 */

import { WEEKLY_DATA, channelMetric, type WeekPoint } from './trends-mock';

export type WeeklyChannel = 'ALL' | 'SHOPEE' | 'TIKTOK';

export interface ProductMetric {
  no: string;
  sku: string;
  nameVi: string;
  nameEn: string;
  platform: 'SHOPEE' | 'TIKTOK';
  pv: number;
  cvr: number; // 0..1
  items: number;
  gmv: number;
  netGmv: number;
  nmv: number;
  voucher: number;
  sellerDisc: number;
  freeGift: number;
  adSpend: number;
  brandAds: number;
  offPlatformAds: number;
  affComm: number;
  affBook: number;
  livestream: number;
  platformFee: number;
  primeCost: number;
  cm: number;
}

// Hardcoded 5 products (matches design) — same numbers regardless of week for demo.
// In real impl, products would be per-week from sal_product_metrics.
const SAMPLE_PRODUCTS: ProductMetric[] = [
  {
    no: '01',
    sku: 'FIRGI-S3-001',
    nameVi: 'Bộ 3 Dụng Cụ Ăn Dặm Si',
    nameEn: 'COMBO Firgi Set 3',
    platform: 'SHOPEE',
    pv: 630,
    cvr: 0.025,
    items: 16,
    gmv: 13_040_000,
    netGmv: 11_038_400,
    nmv: 11_018_400,
    voucher: 115_560,
    sellerDisc: 20_000,
    freeGift: 61_159,
    adSpend: 0,
    brandAds: 240_000,
    offPlatformAds: 86_000,
    affComm: 572_365,
    affBook: 285_160,
    livestream: 22_840,
    platformFee: 2_829_391,
    primeCost: 3_856_000,
    cm: 3_275_926,
  },
  {
    no: '02',
    sku: 'FIRGI-S5-002',
    nameVi: 'Bộ 5 Dụng Cụ Ăn Dặm Si',
    nameEn: 'COMBO Firgi Set 5',
    platform: 'SHOPEE',
    pv: 127,
    cvr: 0.024,
    items: 3,
    gmv: 4_995_000,
    netGmv: 4_229_700,
    nmv: 4_229_700,
    voucher: 44_361,
    sellerDisc: 0,
    freeGift: 23_477,
    adSpend: 0,
    brandAds: 92_000,
    offPlatformAds: 33_000,
    affComm: 219_717,
    affBook: 109_466,
    livestream: 8_768,
    platformFee: 1_086_135,
    primeCost: 1_518_000,
    cm: 1_219_776,
  },
  {
    no: '03',
    sku: 'FIRGI-WH-003',
    nameVi: 'Bát Ăn Dặm Pi Whale',
    nameEn: 'Whale Baby Food Bowl',
    platform: 'SHOPEE',
    pv: 596,
    cvr: 0.022,
    items: 13,
    gmv: 6_045_000,
    netGmv: 5_068_700,
    nmv: 5_028_700,
    voucher: 52_741,
    sellerDisc: 40_000,
    freeGift: 27_912,
    adSpend: 0,
    brandAds: 110_000,
    offPlatformAds: 39_000,
    affComm: 261_222,
    affBook: 130_145,
    livestream: 10_424,
    platformFee: 1_291_309,
    primeCost: 1_781_000,
    cm: 1_473_948,
  },
  {
    no: '04',
    sku: 'FIRGI-MW-004',
    nameVi: 'Bát Ăn Dặm Pi Meow',
    nameEn: 'Meow Suction Bowl',
    platform: 'TIKTOK',
    pv: 523,
    cvr: 0.017,
    items: 9,
    gmv: 4_095_000,
    netGmv: 3_419_100,
    nmv: 3_384_100,
    voucher: 35_492,
    sellerDisc: 35_000,
    freeGift: 18_784,
    adSpend: 0,
    brandAds: 0,
    offPlatformAds: 0,
    affComm: 175_791,
    affBook: 87_582,
    livestream: 7_015,
    platformFee: 868_996,
    primeCost: 1_053_000,
    cm: 1_137_441,
  },
  {
    no: '05',
    sku: 'FIRGI-AR-005',
    nameVi: 'Bát Ăn Dặm AttiRabbit',
    nameEn: 'AttiRabbit Baby Bowl',
    platform: 'SHOPEE',
    pv: 774,
    cvr: 0.018,
    items: 14,
    gmv: 3_850_000,
    netGmv: 3_218_600,
    nmv: 3_163_600,
    voucher: 33_180,
    sellerDisc: 55_000,
    freeGift: 17_560,
    adSpend: 0,
    brandAds: 78_000,
    offPlatformAds: 28_000,
    affComm: 164_337,
    affBook: 81_875,
    livestream: 6_558,
    platformFee: 812_374,
    primeCost: 960_000,
    cm: 1_087_717,
  },
];

export function getProductMetrics(_weekNum: number, channel: WeeklyChannel): ProductMetric[] {
  // Mock: products don't actually change per week. Real impl will query sal_product_metrics.
  if (channel === 'ALL') return SAMPLE_PRODUCTS;
  return SAMPLE_PRODUCTS.filter((p) => p.platform === channel);
}

// ============================================================================
// Top KPI / overview / breakdown — derived from WEEKLY_DATA per channel
// ============================================================================

export interface OverviewRow {
  metric: string;
  vnd: number;
  pctGmv: number; // 0..1 (computed against Net GMV)
  wowPct: number | null;
  highlight?: 'cm' | 'cmPct';
  /** When true, metric is itself a ratio so no KRW/% Net GMV cells. */
  isRatio?: boolean;
  /** vs prev direction where positive = bad. */
  invertDelta?: boolean;
}

export interface BreakdownItem {
  label: string;
  vnd?: number;
  raw?: number; // for non-money items (counts, ratios)
  pctGmv?: number;
  rawDisplay?: string;
  /** Week-over-week delta vs previous week (0..1 fractional). Null if no prev or prev=0. */
  wowPct?: number | null;
  /** When true, larger value is "bad" (cost growing) — invert color of WoW pill. */
  invertWow?: boolean;
  /** When true, render row as a subtotal/total (bold, top border, highlighted bg). */
  summary?: boolean;
  /** Reference-only row — not counted in totals, rendered with dimmed/italic style. */
  reference?: boolean;
}

export interface WeeklyReportData {
  netGmv: number;
  cm: number;
  cmPct: number;
  netGmvWow: number | null;
  cmWow: number | null;
  cmPctWow: number | null;
  overview: OverviewRow[];
  discounts: BreakdownItem[];
  promo: BreakdownItem[];
  traffic: BreakdownItem[];
  sales: BreakdownItem[];
  ads: BreakdownItem[];
  prevWeekLabel: string;
}

const CHANNEL_TO_TREND: Record<WeeklyChannel, 'TOTAL' | 'SHOPEE' | 'TIKTOK'> = {
  ALL: 'TOTAL',
  SHOPEE: 'SHOPEE',
  TIKTOK: 'TIKTOK',
};

function findWeek(weekNum: number): WeekPoint | null {
  return WEEKLY_DATA.find((w) => w.weekNum === weekNum) ?? null;
}

function wowPct(cur: number, prev: number | null | undefined): number | null {
  if (prev == null || prev === 0) return null;
  return (cur - prev) / Math.abs(prev);
}

export function getWeeklyReport(weekNum: number, channel: WeeklyChannel): WeeklyReportData {
  const cur = findWeek(weekNum);
  const prev = findWeek(weekNum - 1);
  if (!cur) return emptyReport();
  return buildReportFromPoints(cur, prev, channel, prev ? `W${prev.weekNum}` : 'previous');
}

function buildReportFromPoints(
  cur: WeekPoint,
  prev: WeekPoint | null,
  channel: WeeklyChannel,
  prevLabel: string,
): WeeklyReportData {
  const ch = CHANNEL_TO_TREND[channel];
  const m = (w: WeekPoint, k: Parameters<typeof channelMetric>[2]) => channelMetric(w, ch, k);

  const netGmv = m(cur, 'NET_GMV');
  const cm = m(cur, 'CM');
  const cmPct = netGmv === 0 ? 0 : cm / netGmv;
  const totalDiscount = m(cur, 'TOTAL_DISCOUNT_COSTS');
  const totalPromo = m(cur, 'TOTAL_PROMOTIONAL_COST');
  const primeCost = m(cur, 'PRIME_COST');
  const platformFee = m(cur, 'PLATFORM_FEE');

  const prevNetGmv = prev ? m(prev, 'NET_GMV') : null;
  const prevCm = prev ? m(prev, 'CM') : null;
  const prevCmPct = prev && prevNetGmv ? prevCm! / prevNetGmv : null;

  const overview: OverviewRow[] = [
    {
      metric: 'Net GMV',
      vnd: netGmv,
      pctGmv: 1,
      wowPct: wowPct(netGmv, prevNetGmv),
    },
    {
      metric: 'Total Discount Costs',
      vnd: totalDiscount,
      pctGmv: netGmv === 0 ? 0 : totalDiscount / netGmv,
      wowPct: wowPct(totalDiscount, prev ? m(prev, 'TOTAL_DISCOUNT_COSTS') : null),
      invertDelta: true,
    },
    {
      metric: 'Total Promotional Costs',
      vnd: totalPromo,
      pctGmv: netGmv === 0 ? 0 : totalPromo / netGmv,
      wowPct: wowPct(totalPromo, prev ? m(prev, 'TOTAL_PROMOTIONAL_COST') : null),
      invertDelta: true,
    },
    {
      metric: 'Prime Cost',
      vnd: primeCost,
      pctGmv: netGmv === 0 ? 0 : primeCost / netGmv,
      wowPct: wowPct(primeCost, prev ? m(prev, 'PRIME_COST') : null),
      invertDelta: true,
    },
    {
      metric: 'Platform Fee',
      vnd: platformFee,
      pctGmv: netGmv === 0 ? 0 : platformFee / netGmv,
      wowPct: wowPct(platformFee, prev ? m(prev, 'PLATFORM_FEE') : null),
      invertDelta: true,
    },
    {
      metric: 'Total Contribution Margin',
      vnd: cm,
      pctGmv: cmPct,
      wowPct: wowPct(cm, prevCm),
      highlight: 'cm',
    },
  ];

  // Helper: build a money-breakdown item with WoW vs prev week
  const mkItem = (
    label: string,
    metric: Parameters<typeof channelMetric>[2],
    invertWow = true, // costs: bigger = bad
  ): BreakdownItem => {
    const v = m(cur, metric);
    return {
      label,
      vnd: v,
      pctGmv: netGmv === 0 ? 0 : v / netGmv,
      wowPct: wowPct(v, prev ? m(prev, metric) : null),
      invertWow,
    };
  };

  const discounts: BreakdownItem[] = [
    mkItem('Total Seller Voucher', 'SELLER_VOUCHER'),
    mkItem('Total Seller Discount', 'SELLER_DISCOUNT'),
    mkItem('Total Free Gift', 'FREE_GIFT'),
    { ...mkItem('Total Platform Discount (Rfr)', 'PLATFORM_DISCOUNT_RFR'), reference: true },
    { ...mkItem('Total Discount Costs', 'TOTAL_DISCOUNT_COSTS'), summary: true },
  ];

  const promo: BreakdownItem[] = [
    mkItem('Total AD Spend', 'AD_SPEND'),
    mkItem('Total Brand Ads', 'BRAND_ADS'),
    mkItem('Total Off-Platform Ads', 'OFF_PLATFORM_ADS'),
    mkItem('Total Affiliate Commission', 'AFFILIATE_COMMISSION'),
    mkItem('Total Affiliate Booking', 'AFFILIATE_BOOKING_FEE'),
    mkItem('Total Livestream Fee', 'LIVESTREAM_FEE'),
    { ...mkItem('Total Promotional Costs', 'TOTAL_PROMOTIONAL_COST'), summary: true },
  ];

  const pageView = m(cur, 'PAGE_VIEW');
  const conv = m(cur, 'CONVERSION_RATE');
  const orders = m(cur, 'ORDERS');
  const adSpend = m(cur, 'AD_SPEND');
  const adGmv = Math.round(adSpend * 6.4);
  const itemsSold = Math.round(orders * 1.17);
  const aov = orders === 0 ? 0 : netGmv / orders;

  // Prev-week traffic values for WoW deltas
  const prevPageView = prev ? m(prev, 'PAGE_VIEW') : null;
  const prevConv = prev ? m(prev, 'CONVERSION_RATE') : null;
  const prevOrders = prev ? m(prev, 'ORDERS') : null;
  const prevAdSpend = prev ? m(prev, 'AD_SPEND') : null;
  const prevAdGmv = prevAdSpend != null ? Math.round(prevAdSpend * 6.4) : null;
  const prevItemsSold = prevOrders != null ? Math.round(prevOrders * 1.17) : null;
  const prevAov = prevOrders && prev ? m(prev, 'NET_GMV') / prevOrders : null;
  const prevRoas = prevAdSpend && prevAdGmv != null ? prevAdGmv / prevAdSpend : null;

  const traffic: BreakdownItem[] = [
    {
      label: 'Page Views',
      raw: pageView,
      rawDisplay: pageView.toLocaleString('en-US'),
      wowPct: wowPct(pageView, prevPageView),
    },
    {
      label: 'CVR %',
      rawDisplay: (conv * 100).toFixed(2) + '%',
      wowPct: prevConv != null && prevConv !== 0 ? (conv - prevConv) / Math.abs(prevConv) : null,
    },
  ];

  const sales: BreakdownItem[] = [
    { label: 'Orders', raw: orders, rawDisplay: orders.toLocaleString('en-US'), wowPct: wowPct(orders, prevOrders) },
    { label: 'Items Sold', raw: itemsSold, rawDisplay: itemsSold.toLocaleString('en-US'), wowPct: wowPct(itemsSold, prevItemsSold) },
    { label: 'AOV', vnd: aov, wowPct: wowPct(aov, prevAov) },
  ];

  const ads: BreakdownItem[] = [
    {
      label: 'AD GMV',
      vnd: adGmv,
      pctGmv: netGmv === 0 ? 0 : adGmv / netGmv,
      wowPct: wowPct(adGmv, prevAdGmv),
    },
    {
      label: 'AD ROAS',
      rawDisplay: adSpend === 0 ? '—' : (adGmv / adSpend).toFixed(2),
      wowPct: prevRoas != null && prevRoas !== 0 ? (adGmv / adSpend - prevRoas) / Math.abs(prevRoas) : null,
    },
  ];

  return {
    netGmv,
    cm,
    cmPct,
    netGmvWow: wowPct(netGmv, prevNetGmv),
    cmWow: wowPct(cm, prevCm),
    cmPctWow: prevCmPct != null ? cmPct - prevCmPct : null,
    overview,
    discounts,
    promo,
    traffic,
    sales,
    ads,
    prevWeekLabel: prevLabel,
  };
}

function emptyReport(): WeeklyReportData {
  return {
    netGmv: 0,
    cm: 0,
    cmPct: 0,
    netGmvWow: null,
    cmWow: null,
    cmPctWow: null,
    overview: [],
    discounts: [],
    promo: [],
    traffic: [],
    sales: [],
    ads: [],
    prevWeekLabel: 'previous',
  };
}

export function getAvailableWeeks(): { weekNum: number; year: number; label: string; periodLabel: string }[] {
  // Generate every weekly period in the current year so Operators can upload
  // for any week — not just the ones the trends mock pre-baked.
  return generateWeeksForYear(2026);
}

const MS_PER_DAY = 86_400_000;

/** Friday on/before Jan 1 of `year` — anchor for W1. */
function firstFridayAnchor(year: number): number {
  const jan1 = Date.UTC(year, 0, 1);
  const dow = new Date(jan1).getUTCDay(); // 0=Sun, …, 5=Fri, 6=Sat
  const offsetDays = (dow - 5 + 7) % 7; // days back to Friday
  return jan1 - offsetDays * MS_PER_DAY;
}

function fmtFriThu(startMs: number, endMs: number): string {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const s = new Date(startMs);
  const e = new Date(endMs);
  const sm = months[s.getUTCMonth()];
  const em = months[e.getUTCMonth()];
  if (sm === em) {
    return `${s.getUTCDate()} – ${e.getUTCDate()} ${em}`;
  }
  return `${s.getUTCDate()} ${sm} – ${e.getUTCDate()} ${em}`;
}

/** All Fri→Thu weeks whose Thursday falls within `year`, numbered W1..W53. */
function generateWeeksForYear(year: number): { weekNum: number; year: number; label: string; periodLabel: string }[] {
  const anchor = firstFridayAnchor(year);
  const out: { weekNum: number; year: number; label: string; periodLabel: string }[] = [];
  for (let i = 0; i < 55; i++) {
    const startMs = anchor + i * 7 * MS_PER_DAY;
    const endMs = startMs + 6 * MS_PER_DAY;
    const end = new Date(endMs);
    if (end.getUTCFullYear() < year) continue;
    if (end.getUTCFullYear() > year) break;
    const weekNum = i + 1;
    out.push({
      weekNum,
      year,
      label: `W${weekNum}`,
      periodLabel: fmtFriThu(startMs, endMs),
    });
  }
  return out;
}

// ============================================================================
// Monthly mock data — 8 months (Sep 2025 → Apr 2026)
// ============================================================================

const MONTH_LONG = [
  'SEPTEMBER',
  'OCTOBER',
  'NOVEMBER',
  'DECEMBER',
  'JANUARY',
  'FEBRUARY',
  'MARCH',
  'APRIL',
];
const MONTH_SHORT = ['Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar', 'Apr'];
const MONTH_DAYS = [30, 31, 30, 31, 31, 28, 31, 30];
const MONTH_YEARS = [2025, 2025, 2025, 2025, 2026, 2026, 2026, 2026];
const MONTH_INDICES = [8, 9, 10, 11, 0, 1, 2, 3]; // 0-based JS month

function genMonthShopee(idx: number) {
  const growth = 1 + idx * 0.05;
  const noise = 1 + (((idx + 1) * 7) % 13) / 100;
  const netGmv = Math.round(8_500_000_000 * growth * noise);
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
    conversionRate: 0.017 + (((idx + 1) * 5) % 9) / 1000,
  };
}

function genMonthTikTok(idx: number) {
  const growth = 1 + idx * 0.06;
  const noise = 1 + (((idx + 2) * 11) % 11) / 100;
  const netGmv = Math.round(4_300_000_000 * growth * noise);
  const gmv = Math.round(netGmv * 1.11);
  const primeCost = Math.round(netGmv * 0.32);
  const platformFee = Math.round(netGmv * 0.16);
  const sellerVoucher = 0;
  const sellerDiscount = Math.round(netGmv * 0.06);
  const freeGift = Math.round(netGmv * 0.008);
  const platformDiscount = Math.round(netGmv * 0.03);
  const adSpend = Math.round(netGmv * 0.085);
  const brandAds = 0;
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
    conversionRate: 0.022 + (((idx + 1) * 9) % 8) / 1000,
  };
}

export const MONTHLY_REPORT_DATA: WeekPoint[] = MONTH_LONG.map((label, i) => {
  const year = MONTH_YEARS[i]!;
  const mIdx = MONTH_INDICES[i]!;
  return {
    weekNum: i + 1, // sequence index 1..8
    year,
    displayLabel: label,
    periodLabel: `01-${MONTH_DAYS[i]!.toString().padStart(2, '0')} ${MONTH_SHORT[i]}`,
    startDate: new Date(Date.UTC(year, mIdx, 1)),
    endDate: new Date(Date.UTC(year, mIdx, MONTH_DAYS[i]!)),
    shopee: genMonthShopee(i),
    tiktok: genMonthTikTok(i),
  };
});

export function getMonthlyReport(monthIdx: number, channel: WeeklyChannel): WeeklyReportData {
  const cur = MONTHLY_REPORT_DATA.find((m) => m.weekNum === monthIdx);
  const prev = MONTHLY_REPORT_DATA.find((m) => m.weekNum === monthIdx - 1);
  if (!cur) return emptyReport();
  const prevLabel = prev
    ? (prev.displayLabel ?? `M${prev.weekNum}`)
    : 'previous';
  return buildReportFromPoints(cur, prev ?? null, channel, prevLabel);
}

export function getAvailableMonths(): {
  monthIdx: number;
  year: number;
  label: string;
  periodLabel: string;
}[] {
  // Generate all 12 calendar months of the current year so Operators can upload
  // for any month, not just the ones the trends mock pre-baked.
  return generateMonthsForYear(2026);
}

function generateMonthsForYear(year: number): {
  monthIdx: number;
  year: number;
  label: string;
  periodLabel: string;
}[] {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return months.map((m, i) => {
    const lastDay = new Date(Date.UTC(year, i + 1, 0)).getUTCDate();
    return {
      monthIdx: i + 1, // 1..12 for the year
      year,
      label: `${m} ${year}`,
      periodLabel: `1 – ${lastDay} ${m}`,
    };
  });
}

export function getProductMetricsForMonth(_monthIdx: number, channel: WeeklyChannel): ProductMetric[] {
  // Same product list, just filtered by channel
  return getProductMetrics(0, channel);
}
