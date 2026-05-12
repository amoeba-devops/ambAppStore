import type { ReactNode } from 'react';
import { cn } from '@car-v2/ui/cn';

type DeltaKind = 'up' | 'down' | 'neutral';

type Props = {
  label: string;
  value: string;
  delta?: string;
  deltaKind?: DeltaKind;
  spark?: ReactNode;
  hint?: string;
  accent?: string;
};

const deltaColorCls: Record<DeltaKind, string> = {
  up: 'text-success-600',
  down: 'text-danger-500',
  neutral: 'text-neutral-400',
};

const deltaArrow: Record<DeltaKind, string> = { up: '↑', down: '↓', neutral: '' };

export function KPI({ label, value, delta, deltaKind = 'neutral', spark, hint, accent }: Props) {
  return (
    <div className="bg-white border border-neutral-100 rounded-xl px-5 py-[18px] relative overflow-hidden">
      {accent && (
        <div
          className="absolute left-0 top-3.5 bottom-3.5 w-[3px] rounded-[2px]"
          style={{ background: accent }}
        />
      )}
      <div className="text-[12px] font-semibold text-neutral-500 tracking-[0.02em]">{label}</div>
      <div className="flex items-baseline gap-2.5 mt-2">
        <div className="text-[26px] font-extrabold text-neutral-900 tracking-[-0.025em] tabular">
          {value}
        </div>
        {delta && (
          <div className={cn('text-[12px] font-bold flex items-center gap-0.5', deltaColorCls[deltaKind])}>
            {deltaArrow[deltaKind]} {delta}
          </div>
        )}
      </div>
      {hint && <div className="text-[11.5px] text-neutral-400 mt-1.5">{hint}</div>}
      {spark && <div className="mt-2.5 h-9">{spark}</div>}
    </div>
  );
}
