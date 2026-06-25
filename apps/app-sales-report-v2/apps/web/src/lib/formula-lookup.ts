/**
 * Map a dashboard metric label to its Formula Config entry. Used to attach
 * formula text as a tooltip (`title` attribute) on dashboard rows.
 *
 * Most labels map to a Shopee + TikTok pair. When channel = ALL, the tooltip
 * concatenates both. When channel = SHOPEE / TIKTOK, only that platform's
 * formula is shown. Labels without a Formula Config entry (composite/derived
 * rows like "Total Discount Costs") get a static formula text below.
 */

import { FORMULA_SECTIONS } from './formula-config-data';
import type { WeeklyChannel } from './weekly-report-mock';

/** Dashboard label → Formula Config metric names (per platform). */
const LABEL_TO_METRIC: Record<string, { shopee?: string; tiktok?: string }> = {
  // Overview top-line
  'Net GMV': { shopee: 'Total Net GMV — Shopee', tiktok: 'Total Net GMV — TikTok' },
  'Prime Cost': { shopee: 'Total Prime Cost — Shopee', tiktok: 'Total Prime Cost — TikTok' },
  'Platform Fee': { shopee: 'Total Platform Fee — Shopee', tiktok: 'Total Platform Fee — TikTok' },
  'Total Contribution Margin': {
    shopee: 'Total Contribution Margin — Shopee',
    tiktok: 'Total Contribution Margin — TikTok',
  },
  'CM %': {
    shopee: 'Total Contribution Margin % — Shopee',
    tiktok: 'Total Contribution Margin % — TikTok',
  },
  // KPI card labels
  'Total CM': {
    shopee: 'Total Contribution Margin — Shopee',
    tiktok: 'Total Contribution Margin — TikTok',
  },
  // Discount Breakdown
  'Total Seller Voucher': { shopee: 'Total Seller Vouchers — Shopee' },
  'Total Seller Discount': {
    shopee: 'Total Seller Discount — Shopee',
    tiktok: 'Total Seller Discount — TikTok',
  },
  'Total Free Gift': {
    shopee: 'Total Free Gift — Shopee',
    tiktok: 'Total Free Gift — TikTok',
  },
  'Total Platform Discount (Ref)': {
    shopee: 'Total Platform Discount (Ref) — Shopee',
    tiktok: 'Total Platform Discount (Ref) — TikTok',
  },
  // Promotional Breakdown
  'Total AD Spend': {
    shopee: 'Total Ad Spending — Shopee',
    tiktok: 'Total Ad Spending — TikTok',
  },
  'Total Brand Ads': { shopee: 'Total Brand Ads — Shopee' },
  'Total Off-Platform Ads': { shopee: 'Total Off-Platform Ads Fee — Shopee' },
  'Total Affiliate Commission': {
    shopee: 'Total Affiliate Commission — Shopee',
    tiktok: 'Total Affiliate Commission — TikTok',
  },
  'Total Affiliate Booking Fee': {
    shopee: 'Total Affiliate Booking Fee — Shopee',
    tiktok: 'Total Affiliate Booking Fee — TikTok',
  },
  'Total Livestream Fee': {
    shopee: 'Total Livestream Fee — Shopee',
    tiktok: 'Total Livestream Fee — TikTok',
  },
  // Traffic and Ads
  'Total Page Views': {
    shopee: 'Total Page Views — Shopee',
    tiktok: 'Total Page Views — TikTok',
  },
  'Conversion Rate': {
    shopee: 'Conversion Rate — Shopee',
    tiktok: 'Conversion Rate — TikTok',
  },
  'AD GMV': { shopee: 'AD GMV — Shopee' },
  'AD ROAS': { shopee: 'AD ROAS — Shopee' },
  // Sales
  'Total Item Sold': {
    shopee: 'Total Item Sold — Shopee',
    tiktok: 'Total Item Sold — TikTok',
  },
  'Total Orders': { shopee: 'Total Orders — Shopee', tiktok: 'Total Orders — TikTok' },
  AOV: { shopee: 'AOV — Shopee', tiktok: 'AOV — TikTok' },
};

/** Composite labels with static formula text (derived rows not in Formula Config). */
const STATIC_FORMULA: Record<string, string> = {
  'Total Discount Costs':
    '{Total Seller Voucher} + {Total Seller Discount} + {Total Free Gift}',
  'Total Promotional Costs':
    '{Total AD Spend} + {Total Brand Ads} + {Total Off-Platform Ads} + {Total Affiliate Commission} + {Total Affiliate Booking Fee} + {Total Livestream Fee}',
};

/** Flat lookup of metric name → formula text from FORMULA_SECTIONS. */
let _metricFormulaCache: Map<string, string> | null = null;
function getMetricFormulaMap(): Map<string, string> {
  if (_metricFormulaCache) return _metricFormulaCache;
  const m = new Map<string, string>();
  for (const sec of FORMULA_SECTIONS) {
    for (const item of sec.items) m.set(item.metric, item.formula);
  }
  _metricFormulaCache = m;
  return m;
}

/**
 * Resolve formula text for a dashboard label. Returns undefined if no formula
 * is mapped — caller should skip the tooltip in that case.
 */
export function getMetricFormula(
  label: string,
  channel: WeeklyChannel,
): string | undefined {
  if (STATIC_FORMULA[label]) return STATIC_FORMULA[label];
  const ref = LABEL_TO_METRIC[label];
  if (!ref) return undefined;
  const map = getMetricFormulaMap();
  const shopeeFormula = ref.shopee ? map.get(ref.shopee) : undefined;
  const tiktokFormula = ref.tiktok ? map.get(ref.tiktok) : undefined;
  if (channel === 'SHOPEE') return shopeeFormula;
  if (channel === 'TIKTOK') return tiktokFormula;
  // ALL — concatenate available
  const parts: string[] = [];
  if (shopeeFormula) parts.push(`Shopee: ${shopeeFormula}`);
  if (tiktokFormula) parts.push(`TikTok: ${tiktokFormula}`);
  return parts.length > 0 ? parts.join('\n') : undefined;
}
