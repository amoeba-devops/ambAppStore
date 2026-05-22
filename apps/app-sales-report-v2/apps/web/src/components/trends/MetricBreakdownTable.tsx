'use client';

import { useState } from 'react';
import { ArrowUp, ArrowDown, Minus } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { cn } from '@v2/ui';
import { vndToKrw } from '@/lib/format';
import {
  channelMetric,
  getMetricDef,
  getPeriodHeaderLabel,
  type Channel,
  type Metric,
  type WeekPoint,
} from '@/lib/trends-mock';

type CurrencyMode = 'VND' | 'KRW';

type RowKind = 'regular' | 'subtotal' | 'child' | 'highlight';

interface MetricRow {
  metric: Metric;
  label: string;
  kind: RowKind;
  /** Tags like "(Traffic)" shown before label */
  prefix?: string;
  /** For RATIO section: divide by Net GMV to get %. Ignored in AMOUNT. */
  ratioOf?: 'NET_GMV';
}

const AMOUNT_ROWS: MetricRow[] = [
  { metric: 'NET_GMV', label: 'Net GMV', kind: 'highlight' },
  { metric: 'CM', label: 'Total Contribution Margin', kind: 'highlight' },
  { metric: 'PRIME_COST', label: 'Prime Cost', kind: 'regular' },
  { metric: 'PLATFORM_FEE', label: 'Platform Fee', kind: 'regular' },
  { metric: 'TOTAL_DISCOUNT_COSTS', label: 'Total Discount Costs', kind: 'subtotal' },
  { metric: 'SELLER_VOUCHER', label: 'Total Seller Voucher', kind: 'child' },
  { metric: 'SELLER_DISCOUNT', label: 'Total Seller Discount', kind: 'child' },
  { metric: 'FREE_GIFT', label: 'Total Free Gift', kind: 'child' },
  { metric: 'PLATFORM_DISCOUNT_RFR', label: 'Total Platform Discount (Rfr)', kind: 'child' },
  { metric: 'TOTAL_PROMOTIONAL_COST', label: 'Total Promotional Cost', kind: 'subtotal' },
  { metric: 'AD_SPEND', label: 'Total AD Spend', kind: 'child' },
  { metric: 'BRAND_ADS', label: 'Total Brand Ads (Shopee)', kind: 'child' },
  { metric: 'OFF_PLATFORM_ADS', label: 'Total Off-platform Ads', kind: 'child' },
  { metric: 'AFFILIATE_COMMISSION', label: 'Total Affiliate Commission', kind: 'child' },
  { metric: 'AFFILIATE_BOOKING_FEE', label: 'Total Affiliate Booking Fee', kind: 'child' },
  { metric: 'LIVESTREAM_FEE', label: 'Total Livestream Fee', kind: 'child' },
];

const TRAFFIC_ROWS: MetricRow[] = [
  { metric: 'PAGE_VIEW', label: 'Total Page View', kind: 'regular' },
  { metric: 'CONVERSION_RATE', label: 'Conversion Rate', kind: 'regular' },
];

const RATIO_ROWS: MetricRow[] = [
  { metric: 'PRIME_COST', label: 'Prime Cost', kind: 'regular', ratioOf: 'NET_GMV' },
  { metric: 'PLATFORM_FEE', label: 'Platform Fee', kind: 'regular', ratioOf: 'NET_GMV' },
  { metric: 'CM', label: 'Total Contribution Margin', kind: 'highlight', ratioOf: 'NET_GMV' },
  { metric: 'TOTAL_DISCOUNT_COSTS', label: 'Total Discount Costs', kind: 'subtotal', ratioOf: 'NET_GMV' },
  { metric: 'SELLER_VOUCHER', label: 'Total Seller Voucher', kind: 'child', ratioOf: 'NET_GMV' },
  { metric: 'SELLER_DISCOUNT', label: 'Total Seller Discount', kind: 'child', ratioOf: 'NET_GMV' },
  { metric: 'FREE_GIFT', label: 'Total Free Gift', kind: 'child', ratioOf: 'NET_GMV' },
  { metric: 'PLATFORM_DISCOUNT_RFR', label: 'Total Platform Discount (Rfr)', kind: 'child', ratioOf: 'NET_GMV' },
  { metric: 'TOTAL_PROMOTIONAL_COST', label: 'Total Promotional Cost', kind: 'subtotal', ratioOf: 'NET_GMV' },
  { metric: 'AD_SPEND', label: 'Total AD Spend', kind: 'child', ratioOf: 'NET_GMV' },
  { metric: 'BRAND_ADS', label: 'Total Brand Ads', kind: 'child', ratioOf: 'NET_GMV' },
  { metric: 'OFF_PLATFORM_ADS', label: 'Total Off-platform Ads', kind: 'child', ratioOf: 'NET_GMV' },
  { metric: 'AFFILIATE_COMMISSION', label: 'Total Affiliate Commission', kind: 'child', ratioOf: 'NET_GMV' },
  { metric: 'AFFILIATE_BOOKING_FEE', label: 'Total Affiliate Booking Fee', kind: 'child', ratioOf: 'NET_GMV' },
  { metric: 'LIVESTREAM_FEE', label: 'Total Livestream Fee', kind: 'child', ratioOf: 'NET_GMV' },
];

interface Props {
  weeks: WeekPoint[];
  granularity?: 'WEEK' | 'MONTH';
  currency?: CurrencyMode;
}

type ChannelOpt = { key: Channel; i18nKey: 'total' | 'shopee' | 'tiktok' };
const CHANNEL_OPTIONS: ChannelOpt[] = [
  { key: 'TOTAL', i18nKey: 'total' },
  { key: 'SHOPEE', i18nKey: 'shopee' },
  { key: 'TIKTOK', i18nKey: 'tiktok' },
];

// Shared className for the sticky left "Metric" column.
// - `sticky left-0` keeps it in view on horizontal scroll
// - `z-20` sits above body cells (z-0) and section row backgrounds (z-10)
// - fixed width prevents the column from shrinking when more weeks are added
// - right border + subtle shadow give a visual seam when content scrolls under
const STICKY_COL_BASE =
  'sticky left-0 z-20 w-[260px] min-w-[260px] max-w-[260px] border-r border-neutral-200 ' +
  'shadow-[2px_0_0_-1px_rgba(0,0,0,0.04)]';

export function MetricBreakdownTable({ weeks, granularity = 'WEEK', currency = 'VND' }: Props) {
  const t = useTranslations('trendingReport');
  const [channel, setChannel] = useState<Channel>('TOTAL');
  const deltaLabel = granularity === 'WEEK' ? t('card.wowSuffix') : t('card.momSuffix');
  const title = granularity === 'WEEK' ? t('breakdown.titleWeekly') : t('breakdown.titleMonthly');

  return (
    <div className="rounded-lg border border-neutral-200 bg-white">
      <div className="flex items-center justify-between border-b border-neutral-100 px-5 py-4">
        <h2 className="text-base font-semibold text-neutral-900">{title}</h2>
        <div className="inline-flex rounded-md border border-neutral-300 bg-white p-0.5 text-sm">
          {CHANNEL_OPTIONS.map((opt) => (
            <button
              key={opt.key}
              type="button"
              onClick={() => setChannel(opt.key)}
              className={cn(
                'rounded px-3 py-1.5 font-medium transition-colors',
                channel === opt.key
                  ? 'bg-neutral-900 text-white'
                  : 'text-neutral-700 hover:bg-neutral-50',
              )}
            >
              {t(`channel.${opt.i18nKey}`)}
            </button>
          ))}
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1100px] text-sm">
          <thead className="bg-neutral-50 text-[11px] uppercase tracking-wider text-neutral-500">
            <tr>
              <th className={cn(STICKY_COL_BASE, 'bg-neutral-50 px-4 py-2.5 text-left font-medium')}>
                {t('breakdown.col.metric')}
              </th>
              {weeks.map((w, i) => (
                <th key={`${w.year}-${w.weekNum}-${i}`} className="px-3 py-2.5 text-right font-medium" colSpan={2}>
                  <div>{getPeriodHeaderLabel(w)}</div>
                  <div className="text-xs font-medium normal-case text-neutral-700 mt-0.5">
                    {w.periodLabel}
                  </div>
                </th>
              ))}
            </tr>
            <tr className="border-b border-neutral-200">
              <th className={cn(STICKY_COL_BASE, 'bg-neutral-50')}></th>
              {weeks.map((w, i) => (
                <ColPair key={`${w.year}-${w.weekNum}-${i}-sub`} deltaLabel={deltaLabel} />
              ))}
            </tr>
          </thead>
          <tbody>
            <SectionHeader label={t('breakdown.section.amount')} spanCols={weeks.length * 2} />
            {AMOUNT_ROWS.map((row) => (
              <Row key={`amount-${row.metric}-${row.label}`} row={row} weeks={weeks} mode="amount" channel={channel} currency={currency} />
            ))}
            <SectionHeader label={t('breakdown.section.ratio')} spanCols={weeks.length * 2} />
            {RATIO_ROWS.map((row) => (
              <Row key={`ratio-${row.metric}-${row.label}`} row={row} weeks={weeks} mode="ratio" channel={channel} currency={currency} />
            ))}
            <SectionHeader label={t('breakdown.section.traffic')} spanCols={weeks.length * 2} />
            {TRAFFIC_ROWS.map((row) => (
              <Row key={`traffic-${row.metric}-${row.label}`} row={row} weeks={weeks} mode="amount" channel={channel} currency={currency} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ColPair({ deltaLabel }: { deltaLabel: string }) {
  const t = useTranslations('trendingReport.breakdown.col');
  return (
    <>
      <th className="px-3 py-1 text-right text-[10px] font-medium text-neutral-400 normal-case">
        {t('value')}
      </th>
      <th className="px-3 py-1 text-right text-[10px] font-medium text-neutral-400 normal-case">
        {deltaLabel}
      </th>
    </>
  );
}

function SectionHeader({ label, spanCols }: { label: string; spanCols: number }) {
  return (
    <tr className="bg-neutral-100">
      <td
        className={cn(
          STICKY_COL_BASE,
          'bg-neutral-100 px-4 py-2 text-[11px] font-semibold uppercase tracking-wider text-neutral-600',
        )}
        colSpan={1}
      >
        {label}
      </td>
      <td className="border-b border-neutral-200" colSpan={spanCols} />
    </tr>
  );
}

function Row({
  row,
  weeks,
  mode,
  channel,
  currency,
}: {
  row: MetricRow;
  weeks: WeekPoint[];
  mode: 'amount' | 'ratio';
  channel: Channel;
  currency: CurrencyMode;
}) {
  const rowBg =
    row.kind === 'highlight'
      ? 'bg-accent-50/40'
      : row.kind === 'subtotal'
        ? 'bg-neutral-50/60'
        : '';
  // Solid background for the sticky metric cell — transparency in `rowBg`
  // would let scrolled content bleed through behind it.
  const stickyBg =
    row.kind === 'highlight'
      ? 'bg-accent-50'
      : row.kind === 'subtotal'
        ? 'bg-neutral-50'
        : 'bg-white';
  const labelClass =
    row.kind === 'subtotal'
      ? 'font-semibold text-neutral-900'
      : row.kind === 'highlight'
        ? 'font-semibold text-neutral-900'
        : row.kind === 'child'
          ? 'pl-8 text-neutral-600'
          : 'text-neutral-700';
  const valueClass =
    row.kind === 'subtotal' || row.kind === 'highlight'
      ? 'font-semibold text-neutral-900'
      : 'text-neutral-700';

  const def = getMetricDef(row.metric);

  // Compute value per week (raw amount or ratio) — scoped to the selected channel.
  // Amount cells convert VND→KRW when currency is KRW. Ratio cells are
  // currency-agnostic (it cancels: KRW/KRW == VND/VND).
  const values = weeks.map((w) => {
    const raw = channelMetric(w, channel, row.metric);
    if (mode === 'amount') {
      if (def.kind !== 'money') return raw;
      return currency === 'KRW' ? vndToKrw(raw) : raw;
    }
    const denom = channelMetric(w, channel, 'NET_GMV');
    return denom === 0 ? null : raw / denom;
  });

  return (
    <tr className={cn('border-b border-neutral-100 hover:bg-neutral-50/40', rowBg)}>
      <td
        className={cn(
          STICKY_COL_BASE,
          'px-4 py-2.5 whitespace-nowrap',
          stickyBg,
          labelClass,
        )}
      >
        {row.prefix && <span className="text-xs text-neutral-400 mr-1.5">{row.prefix}</span>}
        {row.label}
      </td>
      {values.map((val, i) => {
        const prev = i > 0 ? values[i - 1] : null;
        const wow = computeWow(val, prev ?? null);
        return (
          <ValueCell
            key={`${row.metric}-${i}`}
            value={val}
            wow={wow}
            isFirst={i === 0}
            metricKind={mode === 'ratio' ? 'ratio' : def.kind}
            valueClass={valueClass}
            invertColors={row.metric === 'CM' && mode === 'amount'}
          />
        );
      })}
    </tr>
  );
}

function computeWow(cur: number | null, prev: number | null): number | null {
  if (cur == null || prev == null) return null;
  if (prev === 0) return null;
  return (cur - prev) / Math.abs(prev);
}

interface ValueCellProps {
  value: number | null;
  wow: number | null;
  isFirst: boolean;
  metricKind: 'money' | 'count' | 'ratio';
  valueClass: string;
  invertColors?: boolean;
}

function ValueCell({ value, wow, isFirst, metricKind, valueClass, invertColors }: ValueCellProps) {
  return (
    <>
      <td className={cn('px-3 py-2.5 text-right font-mono tabular-nums whitespace-nowrap', valueClass)}>
        {fmtCellValue(value, metricKind)}
      </td>
      <td className="px-3 py-2.5 text-right whitespace-nowrap">
        {isFirst ? (
          <span className="text-neutral-300">—</span>
        ) : (
          <DeltaInline value={wow} invert={invertColors} />
        )}
      </td>
    </>
  );
}

function fmtCellValue(value: number | null, kind: 'money' | 'count' | 'ratio'): string {
  if (value == null) return '—';
  if (kind === 'ratio') return (value * 100).toFixed(2) + '%';
  if (kind === 'count') return new Intl.NumberFormat('en-US').format(Math.round(value));
  // money: raw VND with comma thousand separators
  return new Intl.NumberFormat('en-US').format(Math.round(value));
}

function DeltaInline({ value, invert }: { value: number | null; invert?: boolean }) {
  if (value == null) {
    return <span className="text-neutral-300 inline-flex items-center"><Minus className="h-3 w-3" /></span>;
  }
  const positive = value > 0;
  // For metrics where "more is bad" (CM showing as negative loss getting larger),
  // flip color meaning. Otherwise positive=green, negative=red.
  const isGood = invert ? !positive : positive;
  const colorBg =
    value === 0
      ? 'bg-neutral-100 text-neutral-500'
      : isGood
        ? 'bg-success-50 text-success-500'
        : 'bg-error-50 text-error-500';
  const Icon = value === 0 ? Minus : positive ? ArrowUp : ArrowDown;
  const sign = value > 0 ? '+' : '';
  return (
    <span
      className={cn(
        'inline-flex items-center justify-end gap-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-medium tabular-nums',
        colorBg,
      )}
    >
      <Icon className="h-2.5 w-2.5" />
      {sign}
      {(value * 100).toFixed(2)}%
    </span>
  );
}
