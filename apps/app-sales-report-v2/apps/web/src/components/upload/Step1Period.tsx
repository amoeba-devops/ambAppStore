'use client';

import { CalendarRange, CalendarDays, Check } from 'lucide-react';
import { cn } from '@v2/ui';
import { getAvailableWeeks, getAvailableMonths } from '@/lib/weekly-report-mock';

export type Granularity = 'WEEK' | 'MONTH';

export interface SelectedPeriod {
  granularity: Granularity;
  periodId: number; // weekNum or monthIdx
  label: string;
  rangeLabel: string;
}

interface Props {
  granularity: Granularity | null;
  selected: SelectedPeriod | null;
  onChangeGranularity: (g: Granularity) => void;
  onChangePeriod: (p: SelectedPeriod) => void;
}

export function Step1Period({ granularity, selected, onChangeGranularity, onChangePeriod }: Props) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-base font-semibold text-neutral-900">Step 1 · Select period</h2>
        <p className="mt-1 text-sm text-neutral-500">
          Choose the granularity, then pick the period this upload belongs to.
        </p>
      </div>

      {/* Granularity selection */}
      <div>
        <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-neutral-500">
          1. Granularity
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <GranularityCard
            value="WEEK"
            label="Weekly report"
            description="Friday → Thursday (e.g. 27 Mar – 2 Apr)"
            icon={CalendarRange}
            active={granularity === 'WEEK'}
            onClick={() => onChangeGranularity('WEEK')}
          />
          <GranularityCard
            value="MONTH"
            label="Monthly report"
            description="Full calendar month (e.g. 01-31 Mar)"
            icon={CalendarDays}
            active={granularity === 'MONTH'}
            onClick={() => onChangeGranularity('MONTH')}
          />
        </div>
      </div>

      {/* Period selection — only after granularity */}
      {granularity && (
        <div>
          <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-neutral-500">
            2. {granularity === 'WEEK' ? 'Pick the week' : 'Pick the month'}
          </div>
          {granularity === 'WEEK' ? (
            <WeekPicker selected={selected} onChange={onChangePeriod} />
          ) : (
            <MonthPicker selected={selected} onChange={onChangePeriod} />
          )}
        </div>
      )}

      {/* Summary */}
      {selected && (
        <div className="rounded-md border border-info-500/30 bg-info-50/40 px-4 py-3 text-sm">
          <div className="font-medium text-info-500">Selected period</div>
          <div className="mt-1 font-mono text-neutral-900">
            {selected.label} <span className="text-neutral-500">({selected.rangeLabel})</span>
          </div>
        </div>
      )}
    </div>
  );
}

interface GranularityCardProps {
  value: Granularity;
  label: string;
  description: string;
  icon: typeof CalendarRange;
  active: boolean;
  onClick: () => void;
}

function GranularityCard({ label, description, icon: Icon, active, onClick }: GranularityCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex items-start gap-3 rounded-lg border p-4 text-left transition-colors',
        active
          ? 'border-info-500 bg-info-50/40 ring-1 ring-info-500'
          : 'border-neutral-200 bg-white hover:border-neutral-300',
      )}
    >
      <span
        className={cn(
          'flex h-9 w-9 shrink-0 items-center justify-center rounded-md',
          active ? 'bg-info-500 text-white' : 'bg-neutral-100 text-neutral-500',
        )}
      >
        <Icon className="h-4 w-4" />
      </span>
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-neutral-900">{label}</span>
          {active && <Check className="h-3.5 w-3.5 text-info-500" />}
        </div>
        <p className="mt-0.5 text-xs text-neutral-500">{description}</p>
      </div>
    </button>
  );
}

function WeekPicker({
  selected,
  onChange,
}: {
  selected: SelectedPeriod | null;
  onChange: (p: SelectedPeriod) => void;
}) {
  const weeks = getAvailableWeeks();
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-8">
      {weeks.map((w) => {
        const active = selected?.granularity === 'WEEK' && selected.periodId === w.weekNum;
        return (
          <button
            key={w.weekNum}
            type="button"
            onClick={() =>
              onChange({
                granularity: 'WEEK',
                periodId: w.weekNum,
                label: w.label,
                rangeLabel: w.periodLabel,
              })
            }
            className={cn(
              'flex flex-col items-center rounded-xl border px-3 py-2 text-sm font-medium transition-colors leading-tight',
              active
                ? 'border-info-500 bg-info-50 text-info-500'
                : 'border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-50',
            )}
          >
            <span>{w.label}</span>
            <span
              className={cn(
                'text-[10px] font-normal',
                active ? 'text-info-500/80' : 'text-neutral-500',
              )}
            >
              ({w.periodLabel})
            </span>
          </button>
        );
      })}
    </div>
  );
}

function MonthPicker({
  selected,
  onChange,
}: {
  selected: SelectedPeriod | null;
  onChange: (p: SelectedPeriod) => void;
}) {
  const months = getAvailableMonths();
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-4 xl:grid-cols-8">
      {months.map((m) => {
        const active = selected?.granularity === 'MONTH' && selected.periodId === m.monthIdx;
        const displayLabel = m.label.charAt(0) + m.label.slice(1).toLowerCase();
        return (
          <button
            key={m.monthIdx}
            type="button"
            onClick={() =>
              onChange({
                granularity: 'MONTH',
                periodId: m.monthIdx,
                label: displayLabel,
                rangeLabel: m.periodLabel,
              })
            }
            className={cn(
              'flex flex-col items-center rounded-xl border px-3 py-2 text-sm font-medium transition-colors leading-tight',
              active
                ? 'border-info-500 bg-info-50 text-info-500'
                : 'border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-50',
            )}
          >
            <span>{displayLabel}</span>
            <span
              className={cn(
                'text-[10px] font-normal',
                active ? 'text-info-500/80' : 'text-neutral-500',
              )}
            >
              ({m.periodLabel})
            </span>
          </button>
        );
      })}
    </div>
  );
}
