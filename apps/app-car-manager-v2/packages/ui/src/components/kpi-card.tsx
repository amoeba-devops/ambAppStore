import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react';
import { type ReactNode } from 'react';
import { cn } from '../cn.js';

type DeltaKind = 'up' | 'down' | 'flat';

interface KpiCardProps {
  label: ReactNode;
  value: ReactNode;
  delta?: ReactNode;
  deltaKind?: DeltaKind;
  /* Optional trailing accent (e.g. sparkline). */
  trailing?: ReactNode;
  className?: string;
}

const deltaStyle: Record<DeltaKind, { color: string; Icon: typeof ArrowUpRight }> = {
  up:   { color: 'text-success', Icon: ArrowUpRight },
  down: { color: 'text-danger',  Icon: ArrowDownRight },
  flat: { color: 'text-text-muted', Icon: Minus },
};

export function KpiCard({ label, value, delta, deltaKind = 'flat', trailing, className }: KpiCardProps) {
  const { color, Icon } = deltaStyle[deltaKind];
  return (
    <div
      className={cn(
        'rounded-md border border-border bg-surface p-4 flex flex-col gap-2 min-h-[112px]',
        'hover:border-border-strong transition-colors',
        className,
      )}
    >
      <div className="text-xs font-medium text-text-muted uppercase tracking-wide">{label}</div>
      <div className="flex items-end justify-between gap-2">
        <div className="text-3xl font-bold tracking-tight text-text tabular leading-none">{value}</div>
        {trailing}
      </div>
      {delta && (
        <div className={cn('inline-flex items-center gap-1 text-xs font-medium', color)}>
          <Icon className="h-3.5 w-3.5" />
          <span>{delta}</span>
        </div>
      )}
    </div>
  );
}
