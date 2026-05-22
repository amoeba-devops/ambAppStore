'use client';

import { ArrowUp, ArrowDown, type LucideIcon } from 'lucide-react';
import { cn } from '@v2/ui';

interface KpiCardProps {
  label: string;
  value: number;
  kind: 'money' | 'ratio';
  delta: number | null;
  krwSub?: number;
  highlight?: boolean;
  isRatioDelta?: boolean;
  icon?: LucideIcon;
  iconColor?: string;
  className?: string;
  /** Formula text shown on hover tooltip. */
  formula?: string;
}

export function KpiCard({
  label,
  value,
  kind,
  delta,
  krwSub,
  highlight,
  isRatioDelta,
  icon: Icon,
  iconColor,
  className,
  formula,
}: KpiCardProps) {
  const displayValue =
    kind === 'ratio'
      ? (value * 100).toFixed(2) + '%'
      : new Intl.NumberFormat('en-US').format(Math.round(value));
  const positive = delta != null && delta > 0;
  const DeltaIcon = delta == null ? null : positive ? ArrowUp : ArrowDown;
  const deltaColor =
    delta == null
      ? 'text-neutral-400'
      : positive
        ? 'text-success-500'
        : delta < 0
          ? 'text-error-500'
          : 'text-neutral-500';
  const sign = delta != null && delta > 0 ? '+' : '';
  const deltaText = delta == null ? '—' : `${sign}${(delta * 100).toFixed(1)}%`;

  return (
    <div
      title={formula}
      className={cn(
        'flex flex-col rounded-lg border bg-white px-5 py-3',
        highlight ? 'border-success-500/40 bg-success-50/30' : 'border-neutral-200',
        className,
      )}
    >
      <div className="flex items-start justify-between">
        <div className="text-[11px] font-medium uppercase tracking-wider text-neutral-500">{label}</div>
        {Icon && iconColor && (
          <span className={cn('inline-flex h-7 w-7 items-center justify-center rounded-md', iconColor)}>
            <Icon className="h-3.5 w-3.5" />
          </span>
        )}
      </div>
      <div className="mt-0.5 font-mono text-2xl font-semibold text-neutral-900 tabular-nums">{displayValue}</div>
      <div className="mt-1 flex items-center justify-between gap-2 text-xs">
        {DeltaIcon ? (
          <span className={cn('inline-flex items-center gap-0.5 font-medium', deltaColor)}>
            <DeltaIcon className="h-3 w-3" />
            {(Math.abs(delta as number) * 100).toFixed(1)}%
          </span>
        ) : (
          <span className="text-neutral-300">—</span>
        )}
        {krwSub != null && (
          <span className="text-neutral-400 tabular-nums">
            {new Intl.NumberFormat('en-US').format(Math.round(krwSub))} KRW
          </span>
        )}
      </div>
      <span className="hidden">{isRatioDelta ? '' : deltaText}</span>
    </div>
  );
}
