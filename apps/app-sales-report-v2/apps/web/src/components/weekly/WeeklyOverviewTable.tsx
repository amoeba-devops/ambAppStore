'use client';

import { ArrowUp, ArrowDown, Minus } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { cn } from '@v2/ui';
import type { OverviewRow, WeeklyChannel } from '@/lib/weekly-report-mock';
import { getMetricFormula } from '@/lib/formula-lookup';

interface Props {
  rows: OverviewRow[];
  prevWeekLabel: string;
  currentWeekLabel: string;
  krwRate: number;
  deltaLabel?: string; // "WoW" | "MoM"
  channel?: WeeklyChannel;
}

function fmtVnd(n: number): string {
  return new Intl.NumberFormat('en-US').format(Math.round(n));
}

function fmtKrw(vnd: number, rate: number): string {
  if (rate <= 0) return '—';
  return new Intl.NumberFormat('en-US').format(Math.round(vnd / rate));
}

function fmtPct(ratio: number): string {
  return (ratio * 100).toFixed(2) + '%';
}

export function WeeklyOverviewTable({ rows, prevWeekLabel, currentWeekLabel, krwRate, deltaLabel, channel = 'ALL' }: Props) {
  const t = useTranslations('weeklyReport');
  // Allow deltaLabel override (e.g. "MoM" from Monthly Report); default to "WoW" via i18n.
  const resolvedDelta = deltaLabel ?? t('table.wow');
  return (
    <div className="space-y-2">
      <div className="px-1">
        <h3 className="text-sm font-semibold text-neutral-900">
          {t('overview.title')}{' '}
          <span className="font-normal text-neutral-500">
            {t('overview.comparison', { current: currentWeekLabel, prev: prevWeekLabel })}
          </span>
        </h3>
      </div>
      <div className="overflow-hidden rounded-lg border border-neutral-200 bg-white">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-neutral-50 text-[11px] uppercase tracking-wider text-neutral-500">
              <tr>
                <th className="px-5 py-2.5 text-left font-medium">{t('table.metric')}</th>
                <th className="px-3 py-2.5 text-right font-medium">{t('table.vnd')}</th>
                <th className="px-3 py-2.5 text-right font-medium">{t('table.krw')}</th>
                <th className="px-3 py-2.5 text-right font-medium">{t('table.pctNetGmv')}</th>
                <th className="px-5 py-2.5 text-right font-medium">{resolvedDelta}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {rows.map((row, i) => {
                const prevGroup = i > 0 ? rows[i - 1]!.group : undefined;
                const isGroupStart = row.group != null && row.group !== prevGroup;
                const rowBg =
                  row.highlight === 'cm'
                    ? 'bg-success-50/60'
                    : row.highlight === 'cmPct'
                      ? 'bg-success-50/30'
                      : row.isGroupTotal
                        ? 'bg-neutral-50'
                        : '';
                const labelClass = row.highlight
                  ? 'font-semibold text-neutral-900'
                  : row.isGroupTotal
                    ? 'font-semibold text-neutral-900'
                    : row.isSubItem
                      ? 'pl-10 text-neutral-600'
                      : 'text-neutral-700';
                const borderClass = isGroupStart && i > 0 ? 'border-t-2 border-t-neutral-200' : '';
                const formula = row.formula ?? getMetricFormula(row.metric, channel);
                return (
                  <tr
                    key={row.metric}
                    className={cn('hover:bg-neutral-50/60', rowBg, borderClass)}
                    title={formula}
                  >
                    <td className={cn('py-3', labelClass, row.isSubItem ? 'pl-10' : 'px-5')}>{row.metric}</td>
                    <td className={cn('px-3 py-3 text-right font-mono tabular-nums', labelClass)}>
                      {row.placeholder ? '—' : row.isRatio ? fmtPct(row.vnd) : fmtVnd(row.vnd)}
                    </td>
                    <td className="px-3 py-3 text-right font-mono tabular-nums text-neutral-500">
                      {row.placeholder || row.isRatio ? '—' : fmtKrw(row.vnd, krwRate)}
                    </td>
                    <td className="px-3 py-3 text-right font-mono tabular-nums text-neutral-500">
                      {row.placeholder || row.isRatio ? '—' : fmtPct(row.pctGmv)}
                    </td>
                    <td className="px-5 py-3 text-right">
                      <Delta value={row.wowPct} invert={row.invertDelta} isRatio={row.isRatio} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function Delta({ value, isRatio }: { value: number | null; invert?: boolean; isRatio?: boolean }) {
  if (value == null) {
    return (
      <span className="text-neutral-300 inline-flex items-center">
        <Minus className="h-3 w-3" />
      </span>
    );
  }
  // Direction-based color (per user spec): increase = green, decrease = red.
  const positive = value > 0;
  const colorBg =
    value === 0
      ? 'bg-neutral-100 text-neutral-500'
      : positive
        ? 'bg-success-50 text-success-500'
        : 'bg-error-50 text-error-500';
  const Icon = value === 0 ? Minus : positive ? ArrowUp : ArrowDown;
  const sign = value > 0 ? '+' : '';
  // For ratio deltas (already in absolute pct points), show as e.g. "+3.0%". Otherwise WoW% from a value comparison.
  const text = isRatio ? `${sign}${(value * 100).toFixed(1)}%` : `${sign}${(value * 100).toFixed(1)}%`;
  return (
    <span className={cn('inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-xs font-medium tabular-nums', colorBg)}>
      <Icon className="h-3 w-3" />
      {text}
    </span>
  );
}
