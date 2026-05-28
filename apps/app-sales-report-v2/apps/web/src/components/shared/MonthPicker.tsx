'use client';

import { ChevronLeft, ChevronRight, Lock } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { cn } from '@v2/ui';
import type { MonthEntry } from '@/lib/weekly-report-mock';
import type { PeriodStatus } from '@/lib/raw-archive-mock';

interface MonthPickerProps {
  months: MonthEntry[];
  selectedMonthIdx: number | null;
  onPickMonth: (month: MonthEntry) => void;
  /** Optional status map per month label (e.g. "Apr 2026" → "Finalized"). Missing → "Open". */
  statusByLabel?: Map<string, PeriodStatus>;
  /** When true, Locked months remain clickable (e.g. read-only report viewers). */
  allowClickLocked?: boolean;
  /** Year currently shown by the grid. Required when `onYearChange` is supplied. */
  year?: number;
  /** When provided, renders year nav arrows around the year label. */
  onYearChange?: (nextYear: number) => void;
}

export function MonthPicker({
  months,
  selectedMonthIdx,
  onPickMonth,
  statusByLabel,
  allowClickLocked = false,
  year,
  onYearChange,
}: MonthPickerProps) {
  const hasYearNav = year != null && !!onYearChange;
  return (
    <div className="flex items-center gap-2">
      {hasYearNav && (
        <button
          type="button"
          onClick={() => onYearChange!(year! - 1)}
          aria-label="Previous year"
          title={`Go to ${year! - 1}`}
          className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-neutral-300 bg-white text-neutral-700 transition-colors hover:bg-neutral-50"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
      )}
      <div className="grid flex-1 grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-6">
        {months.map((m) => {
          const status = statusByLabel?.get(m.label);
          const isLocked = !allowClickLocked && status === 'Locked';
          return (
            <PeriodPill
              key={m.monthIdx}
              label={m.label}
              rangeLabel={m.periodLabel}
              active={selectedMonthIdx === m.monthIdx}
              status={status}
              isLocked={isLocked}
              onClick={() => onPickMonth(m)}
            />
          );
        })}
      </div>
      {hasYearNav && (
        <button
          type="button"
          onClick={() => onYearChange!(year! + 1)}
          aria-label="Next year"
          title={`Go to ${year! + 1}`}
          className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-neutral-300 bg-white text-neutral-700 transition-colors hover:bg-neutral-50"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}

interface PeriodPillProps {
  label: string;
  rangeLabel: string;
  active: boolean;
  status: PeriodStatus | undefined;
  isLocked: boolean;
  onClick: () => void;
}

function PeriodPill({ label, rangeLabel, active, status, isLocked, onClick }: PeriodPillProps) {
  const lockedTitle = `${label} is Locked — period closed, no re-uploads allowed.`;
  return (
    <button
      type="button"
      onClick={isLocked ? undefined : onClick}
      disabled={isLocked}
      title={isLocked ? lockedTitle : undefined}
      aria-disabled={isLocked}
      className={cn(
        'flex flex-col items-center gap-0.5 rounded-xl border px-3 py-2 text-sm font-medium transition-colors leading-tight',
        isLocked
          ? 'border-neutral-200 bg-neutral-50 text-neutral-400 cursor-not-allowed'
          : active
            ? 'border-info-500 bg-info-50 text-info-500'
            : 'border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-50',
      )}
    >
      <span>{label}</span>
      <span
        className={cn(
          'text-[10px] font-normal',
          isLocked ? 'text-neutral-400' : active ? 'text-info-500/80' : 'text-neutral-500',
        )}
      >
        ({rangeLabel})
      </span>
      <StatusBadge status={status ?? 'Open'} />
    </button>
  );
}

type DisplayStatus = PeriodStatus | 'Open';

function StatusBadge({ status }: { status: DisplayStatus }) {
  const tStatus = useTranslations('periodStatus');
  const map: Record<DisplayStatus, { label: string; cls: string; icon?: React.ReactNode }> = {
    Open: {
      label: tStatus('open'),
      cls: 'border border-neutral-300 bg-white text-neutral-500',
    },
    Draft: {
      label: tStatus('active'),
      cls: 'bg-success-500/10 text-success-500',
    },
    Finalized: {
      label: tStatus('finalized'),
      cls: 'bg-info-500/10 text-info-500',
    },
    Locked: {
      label: tStatus('locked'),
      cls: 'bg-neutral-200 text-neutral-500',
      icon: <Lock className="h-2.5 w-2.5" />,
    },
  };
  const { label, cls, icon } = map[status];
  return (
    <span
      className={cn(
        'mt-1 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium whitespace-nowrap',
        cls,
      )}
    >
      {icon}
      {label}
    </span>
  );
}
