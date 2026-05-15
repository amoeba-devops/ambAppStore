'use client';

import { ArrowUp, ArrowDown, Minus } from 'lucide-react';
import { cn } from '@v2/ui';
import type { BreakdownItem } from '@/lib/weekly-report-mock';

export type BreakdownAccent = 'indigo' | 'orange' | 'pink' | 'green' | 'neutral';

interface BreakdownCardProps {
  title: string;
  accent: BreakdownAccent;
  items: BreakdownItem[];
  krwRate: number;
  /** Column header for the WoW/MoM delta column. */
  deltaLabel?: string;
}

const ACCENT_STYLES: Record<BreakdownAccent, { bar: string; pct: string }> = {
  indigo: { bar: 'bg-info-500', pct: 'bg-info-50 text-info-500' },
  orange: { bar: 'bg-warning-500', pct: 'bg-warning-50 text-warning-500' },
  pink: { bar: 'bg-accent-700', pct: 'bg-accent-50 text-accent-700' },
  green: { bar: 'bg-success-500', pct: 'bg-success-50 text-success-500' },
  neutral: { bar: 'bg-neutral-700', pct: 'bg-neutral-100 text-neutral-700' },
};

export function BreakdownCard({ title, accent, items, krwRate, deltaLabel = 'WoW' }: BreakdownCardProps) {
  const safeRate = krwRate > 0 ? krwRate : 1;
  const styles = ACCENT_STYLES[accent];
  const hasMoney = items.some((it) => it.vnd != null && it.rawDisplay == null);

  return (
    <div className="rounded-lg border border-neutral-200 bg-white overflow-hidden">
      <div className="flex items-center gap-2 border-b border-neutral-100 px-5 py-3">
        <span className={cn('h-3 w-1 rounded-full', styles.bar)} />
        <h3 className="text-sm font-semibold text-neutral-900">{title}</h3>
      </div>

      <div
        className={cn(
          'grid items-center gap-3 bg-neutral-50 px-5 py-2 text-[10px] font-medium uppercase tracking-wider text-neutral-500',
          hasMoney ? 'grid-cols-[1fr_auto_auto_auto_auto]' : 'grid-cols-[1fr_auto_auto_auto]',
        )}
      >
        <span>Metric</span>
        <span className="w-28 text-right">VND</span>
        {hasMoney && <span className="w-20 text-right">KRW</span>}
        <span className="w-14 text-right">% Net GMV</span>
        <span className="w-16 text-right">{deltaLabel}</span>
      </div>

      <ul className="divide-y divide-neutral-100">
        {items.map((it) => {
          const isMoney = it.vnd != null && it.rawDisplay == null;
          const vndDisplay = it.rawDisplay
            ?? (it.vnd != null ? new Intl.NumberFormat('en-US').format(Math.round(it.vnd)) : '—');
          const krwDisplay = isMoney
            ? new Intl.NumberFormat('en-US').format(Math.round((it.vnd as number) / safeRate))
            : '—';

          return (
            <li
              key={it.label}
              className={cn(
                'grid items-center gap-3 px-5 py-3 text-sm',
                hasMoney ? 'grid-cols-[1fr_auto_auto_auto_auto]' : 'grid-cols-[1fr_auto_auto_auto]',
                it.summary && 'bg-neutral-50 font-semibold border-t-2 border-neutral-200',
                it.reference && 'italic',
              )}
            >
              <span
                className={cn(
                  it.summary
                    ? 'text-neutral-900'
                    : it.reference
                      ? 'text-neutral-400'
                      : 'text-neutral-700',
                )}
              >
                {it.label}
                {it.reference && (
                  <span className="ml-1.5 text-[10px] not-italic text-neutral-400">(reference)</span>
                )}
              </span>
              <span
                className={cn(
                  'w-28 text-right font-mono tabular-nums',
                  it.summary
                    ? 'font-bold text-neutral-900'
                    : it.reference
                      ? 'text-neutral-400'
                      : 'font-semibold text-neutral-900',
                )}
              >
                {vndDisplay}
              </span>
              {hasMoney && (
                <span
                  className={cn(
                    'w-20 text-right font-mono tabular-nums',
                    it.summary
                      ? 'font-semibold text-neutral-900'
                      : it.reference
                        ? 'text-neutral-300'
                        : 'text-neutral-500',
                  )}
                >
                  {krwDisplay}
                </span>
              )}
              <span className="w-14 text-right">
                {it.pctGmv != null && it.rawDisplay == null ? (
                  <span
                    className={cn(
                      'inline-flex items-center justify-end rounded-full px-2 py-0.5 text-[10px] font-medium tabular-nums',
                      styles.pct,
                    )}
                  >
                    {(it.pctGmv * 100).toFixed(2)}%
                  </span>
                ) : (
                  <span className="text-neutral-300">—</span>
                )}
              </span>
              <span className="w-16 text-right">
                <PeriodDelta value={it.wowPct ?? null} invert={it.invertWow} />
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function PeriodDelta({ value, invert }: { value: number | null; invert?: boolean }) {
  if (value == null) {
    return (
      <span className="text-neutral-300 inline-flex items-center justify-end">
        <Minus className="h-3 w-3" />
      </span>
    );
  }
  const positive = value > 0;
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
      {(value * 100).toFixed(1)}%
    </span>
  );
}
