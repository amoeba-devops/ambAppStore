'use client';

import { ArrowUp, ArrowDown } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { cn } from '@v2/ui';
import { fmtCompact, vndToKrw } from '@/lib/format';
import { MiniLineChart } from './MiniLineChart';
import { getMetricDef, type Channel, type ChannelSummary, type Metric } from '@/lib/trends-mock';

type ChannelStyle = {
  badge: string;
  badgeClass: string;
  stroke: string;
  fill: string;
  dot: string;
  i18nKey: 'shopee' | 'tiktok' | 'total';
};

const CHANNEL_STYLE: Record<Channel, ChannelStyle> = {
  SHOPEE: {
    badge: 'S',
    badgeClass: 'bg-shopee text-white',
    stroke: 'stroke-shopee',
    fill: 'fill-shopee/10',
    dot: 'fill-shopee',
    i18nKey: 'shopee',
  },
  TIKTOK: {
    badge: 'T',
    badgeClass: 'bg-neutral-900 text-white',
    stroke: 'stroke-neutral-900',
    fill: 'fill-neutral-900/5',
    dot: 'fill-neutral-900',
    i18nKey: 'tiktok',
  },
  TOTAL: {
    badge: 'Σ',
    badgeClass: 'bg-info-500 text-white',
    stroke: 'stroke-info-500',
    fill: 'fill-info-500/10',
    dot: 'fill-info-500',
    i18nKey: 'total',
  },
};

type CurrencyMode = 'VND' | 'KRW';

interface Props {
  channel: Channel;
  metric: Metric;
  summary: ChannelSummary;
  chartData: { label: string; value: number }[];
  granularity?: 'WEEK' | 'MONTH';
  currency?: CurrencyMode;
}

/** Convert a money value (always stored in VND) into the active display currency. */
function applyCurrency(value: number, currency: CurrencyMode): number {
  return currency === 'KRW' ? vndToKrw(value) : value;
}

function fmtMetricValue(value: number, metric: Metric, currency: CurrencyMode): React.ReactNode {
  const def = getMetricDef(metric);
  if (def.kind === 'count') {
    return new Intl.NumberFormat('en-US').format(Math.round(value));
  }
  if (def.kind === 'ratio') {
    return (value * 100).toFixed(2) + '%';
  }
  const display = applyCurrency(value, currency);
  return (
    <>
      {fmtCompact(display, 2)}
      <sub className="ml-0.5 text-xs text-neutral-400 font-normal align-baseline">
        {currency === 'KRW' ? '₩' : '₫'}
      </sub>
    </>
  );
}

/**
 * Format a chart tooltip value. Money values are passed in ALREADY-converted
 * form (chartData is pre-converted upstream so Y-axis ticks reflect the active
 * currency) — we only attach locale + symbol here, no further conversion.
 */
function fmtTooltipValue(value: number, metric: Metric, currency: CurrencyMode): string {
  const def = getMetricDef(metric);
  if (def.kind === 'count') {
    return new Intl.NumberFormat('en-US').format(Math.round(value));
  }
  if (def.kind === 'ratio') {
    return (value * 100).toFixed(2) + '%';
  }
  const locale = currency === 'KRW' ? 'ko-KR' : 'vi-VN';
  const symbol = currency === 'KRW' ? ' ₩' : ' ₫';
  return new Intl.NumberFormat(locale).format(Math.round(value)) + symbol;
}

function fmtPctLabel(pct: number | null): { text: string; positive: boolean | null } {
  if (pct == null) return { text: '—', positive: null };
  const sign = pct > 0 ? '+' : '';
  return { text: `${sign}${(pct * 100).toFixed(1)}%`, positive: pct > 0 ? true : pct < 0 ? false : null };
}

export function ChannelTrendCard({
  channel,
  metric,
  summary,
  chartData,
  granularity = 'WEEK',
  currency = 'VND',
}: Props) {
  const t = useTranslations('trendingReport');
  const style = CHANNEL_STYLE[channel];
  const channelName = t(`channel.${style.i18nKey}`);
  const def = getMetricDef(metric);
  const wow = fmtPctLabel(summary.wowPct);
  const mom = fmtPctLabel(summary.momPct);
  const currentLabel = granularity === 'WEEK' ? t('card.thisWeek') : t('card.thisMonth');
  const avgLabel = granularity === 'WEEK' ? t('card.fourWeekAvg') : t('card.fourMonthAvg');
  const primaryDeltaSuffix = granularity === 'WEEK' ? t('card.wowSuffix') : t('card.momSuffix');
  // Primary uses the appropriate value: WoW when weekly, MoM when monthly
  const primaryDelta = granularity === 'WEEK' ? wow : mom;

  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-5">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-2">
          <span
            className={cn(
              'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium',
              style.badgeClass,
            )}
          >
            <span className="font-mono">{style.badge}</span>
            {channelName}
          </span>
          <span className="text-xs text-neutral-500">· {def.label}</span>
        </div>
        <DeltaPill text={primaryDelta.text} positive={primaryDelta.positive} suffix={primaryDeltaSuffix} />
      </div>

      <div className="flex items-end gap-6 mb-4">
        <div>
          <div className="text-[11px] font-medium uppercase tracking-wider text-neutral-500">{currentLabel}</div>
          <div className="mt-1 font-mono text-3xl font-semibold text-neutral-900 tabular-nums">
            {fmtMetricValue(summary.current, metric, currency)}
          </div>
        </div>
        <div>
          <div className="text-[11px] font-medium uppercase tracking-wider text-neutral-500">{avgLabel}</div>
          <div className="mt-1 font-mono text-lg text-neutral-500 tabular-nums">
            {fmtMetricValue(summary.fourWeekAvg, metric, currency)}
          </div>
        </div>
      </div>

      <MiniLineChart
        data={chartData.map((d) =>
          def.kind === 'money' ? { ...d, value: applyCurrency(d.value, currency) } : d,
        )}
        stroke={style.stroke}
        fill={style.fill}
        dot={style.dot}
        formatValue={(v) => fmtTooltipValue(v, metric, currency)}
      />
    </div>
  );
}

function DeltaPill({ text, positive, suffix }: { text: string; positive: boolean | null; suffix?: string }) {
  const colorBg =
    positive === true
      ? 'bg-success-50 text-success-500'
      : positive === false
        ? 'bg-error-50 text-error-500'
        : 'bg-neutral-100 text-neutral-500';
  const Icon = positive === true ? ArrowUp : positive === false ? ArrowDown : null;
  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        className={cn(
          'inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[10px] font-medium tabular-nums',
          colorBg,
        )}
      >
        {Icon && <Icon className="h-2.5 w-2.5" />}
        {text}
      </span>
      {suffix && <span className="text-[10px] font-normal text-neutral-400">{suffix}</span>}
    </span>
  );
}
