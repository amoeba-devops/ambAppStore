'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  CalendarRange,
  CalendarDays,
  Check,
  Lock,
  Lightbulb,
  ChevronLeft,
  ChevronRight,
  ChevronsUpDown,
} from 'lucide-react';
import { cn } from '@v2/ui';
import { getAvailableWeeks, getAvailableMonths } from '@/lib/weekly-report-mock';
import { useArchiveStatusByLabel } from '@/lib/raw-archive-state';
import type { PeriodStatus } from '@/lib/raw-archive-mock';

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
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-neutral-900">Step 1 · Select period</h2>
          <p className="mt-1 text-sm text-neutral-500">
            Choose the granularity, then pick the period this upload belongs to.
          </p>
        </div>
        <PeriodStatusTipsButton />
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

const VISIBLE_WEEKS = 5;

function WeekPicker({
  selected,
  onChange,
}: {
  selected: SelectedPeriod | null;
  onChange: (p: SelectedPeriod) => void;
}) {
  const weeks = useMemo(() => getAvailableWeeks(), []);
  const statusByLabel = useArchiveStatusByLabel();

  // Figure out which week index is "current" based on today
  const currentIdx = useMemo(() => {
    const today = new Date();
    const todayStart = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
    // periodLabel is human-only; use index based on week start, which we can
    // reconstruct via firstFridayAnchor logic here. Easier: scan weeks for the
    // one whose Thursday >= today (the in-progress / latest finished week).
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    // Try to parse `periodLabel` like "8 – 14 May" or "27 Nov – 3 Dec" to a Thursday date in `weeks[i].year`.
    let idx = weeks.findIndex((w) => {
      const m = w.periodLabel.match(/(\d+)\s+(\w+)\s+–\s+(\d+)\s+(\w+)/) || w.periodLabel.match(/(\d+)\s+–\s+(\d+)\s+(\w+)/);
      if (!m) return false;
      let endDay: number;
      let endMonthName: string;
      if (m.length === 5) {
        endDay = Number(m[3]);
        endMonthName = m[4] ?? '';
      } else {
        endDay = Number(m[2]);
        endMonthName = m[3] ?? '';
      }
      const endMonth = months.indexOf(endMonthName);
      if (endMonth === -1) return false;
      const endMs = Date.UTC(w.year, endMonth, endDay);
      return endMs >= todayStart;
    });
    if (idx === -1) idx = weeks.length - 1;
    return idx;
  }, [weeks]);

  // Viewport: which slice of weeks is visible. Centered on selected if any,
  // otherwise on current week.
  const initialCenter = currentIdx;
  const [center, setCenter] = useState(initialCenter);
  const [expanded, setExpanded] = useState(false);
  // If user picks a period via external action (e.g. URL), re-center
  useEffect(() => {
    if (!selected || selected.granularity !== 'WEEK') return;
    const idx = weeks.findIndex((w) => w.weekNum === selected.periodId);
    if (idx >= 0) setCenter(idx);
  }, [selected, weeks]);

  const halfWindow = Math.floor(VISIBLE_WEEKS / 2);
  // Clamp window so we don't run off either end
  const clampedCenter = Math.max(halfWindow, Math.min(weeks.length - 1 - halfWindow, center));
  const start = Math.max(0, clampedCenter - halfWindow);
  const end = Math.min(weeks.length, start + VISIBLE_WEEKS);
  const visible = weeks.slice(start, end);

  const canPrev = start > 0;
  const canNext = end < weeks.length;

  const goPrev = () => setCenter((c) => Math.max(0, c - 1));
  const goNext = () => setCenter((c) => Math.min(weeks.length - 1, c + 1));

  const handlePick = (w: (typeof weeks)[number]) => {
    onChange({
      granularity: 'WEEK',
      periodId: w.weekNum,
      label: w.label,
      rangeLabel: w.periodLabel,
    });
    // Snap carousel center on the picked week so collapsing re-centers there
    const idx = weeks.findIndex((x) => x.weekNum === w.weekNum);
    if (idx >= 0) setCenter(idx);
  };

  return (
    <div className="space-y-2">
      {expanded ? (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7">
          {weeks.map((w) => {
            const active = selected?.granularity === 'WEEK' && selected.periodId === w.weekNum;
            const status = statusByLabel.get(w.label);
            const isLocked = status === 'Locked';
            return (
              <PeriodPill
                key={w.weekNum}
                label={w.label}
                rangeLabel={w.periodLabel}
                active={active}
                status={status}
                isLocked={isLocked}
                onClick={() => handlePick(w)}
              />
            );
          })}
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={goPrev}
            disabled={!canPrev}
            aria-label="Previous week"
            className={cn(
              'inline-flex h-9 w-9 items-center justify-center rounded-full border transition-colors shrink-0',
              canPrev
                ? 'border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-50'
                : 'border-neutral-200 bg-neutral-50 text-neutral-300 cursor-not-allowed',
            )}
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <div className="grid flex-1 grid-cols-5 gap-2">
            {visible.map((w) => {
              const active = selected?.granularity === 'WEEK' && selected.periodId === w.weekNum;
              const status = statusByLabel.get(w.label);
              const isLocked = status === 'Locked';
              return (
                <PeriodPill
                  key={w.weekNum}
                  label={w.label}
                  rangeLabel={w.periodLabel}
                  active={active}
                  status={status}
                  isLocked={isLocked}
                  onClick={() => handlePick(w)}
                />
              );
            })}
          </div>
          <button
            type="button"
            onClick={goNext}
            disabled={!canNext}
            aria-label="Next week"
            className={cn(
              'inline-flex h-9 w-9 items-center justify-center rounded-full border transition-colors shrink-0',
              canNext
                ? 'border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-50'
                : 'border-neutral-200 bg-neutral-50 text-neutral-300 cursor-not-allowed',
            )}
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      )}
      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className={cn(
            'inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium transition-colors',
            expanded
              ? 'border-info-500 bg-info-50 text-info-500'
              : 'border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-50',
          )}
        >
          <ChevronsUpDown className="h-3.5 w-3.5" />
          {expanded ? 'Collapse' : `Show all ${weeks.length} weeks`}
        </button>
      </div>
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
  const statusByLabel = useArchiveStatusByLabel();
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-4 xl:grid-cols-8">
      {months.map((m) => {
        const active = selected?.granularity === 'MONTH' && selected.periodId === m.monthIdx;
        const displayLabel = m.label.charAt(0) + m.label.slice(1).toLowerCase();
        const status =
          statusByLabel.get(displayLabel) ?? statusByLabel.get(m.label);
        const isLocked = status === 'Locked';
        return (
          <PeriodPill
            key={m.monthIdx}
            label={displayLabel}
            rangeLabel={m.periodLabel}
            active={active}
            status={status}
            isLocked={isLocked}
            onClick={() =>
              onChange({
                granularity: 'MONTH',
                periodId: m.monthIdx,
                label: displayLabel,
                rangeLabel: m.periodLabel,
              })
            }
          />
        );
      })}
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

function PeriodStatusTipsButton() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', handler);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Period status tips"
        title="Period status tips"
        className={cn(
          'inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-medium transition-colors',
          open
            ? 'border-warning-500 bg-warning-500/10 text-warning-500'
            : 'border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-50',
        )}
      >
        <Lightbulb className="h-3.5 w-3.5" />
        Tips
      </button>
      {open && (
        <div className="absolute right-0 top-full z-30 mt-2 w-80 rounded-md border border-neutral-200 bg-white p-3 shadow-lg">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-neutral-500 mb-2">
            Period status guide
          </div>
          <ul className="grid grid-cols-[80px_1fr] gap-x-3 gap-y-2 text-[11px] text-neutral-600">
            <span className="mt-0.5 inline-flex items-center justify-center gap-1 rounded-full border border-neutral-300 bg-white px-2 py-0.5 text-[10px] font-medium text-neutral-500">
              Open
            </span>
            <span className="leading-relaxed">
              Never ingested — ready for the first upload.
            </span>

            <span className="mt-0.5 inline-flex items-center justify-center gap-1 rounded-full bg-success-500/10 px-2 py-0.5 text-[10px] font-medium text-success-500">
              Active
            </span>
            <span className="leading-relaxed">
              Just ingested, awaiting Manager approval — can still re-upload / edit.
            </span>

            <span className="mt-0.5 inline-flex items-center justify-center gap-1 rounded-full bg-info-500/10 px-2 py-0.5 text-[10px] font-medium text-info-500">
              Finalized
            </span>
            <span className="leading-relaxed">
              Approved by Manager — report data is locked. Must unfinalize before editing.
            </span>

            <span className="mt-0.5 inline-flex items-center justify-center gap-1 rounded-full bg-neutral-200 px-2 py-0.5 text-[10px] font-medium text-neutral-500">
              <Lock className="h-2.5 w-2.5" /> Locked
            </span>
            <span className="leading-relaxed">
              Locked manually by Manager — re-upload / edit no longer allowed.
            </span>
          </ul>
        </div>
      )}
    </div>
  );
}

type DisplayStatus = PeriodStatus | 'Open';

function StatusBadge({ status }: { status: DisplayStatus }) {
  const map: Record<DisplayStatus, { label: string; cls: string; icon?: React.ReactNode }> = {
    Open: {
      label: 'Open',
      cls: 'border border-neutral-300 bg-white text-neutral-500',
    },
    Draft: {
      label: 'Active',
      cls: 'bg-success-500/10 text-success-500',
    },
    Finalized: {
      label: 'Finalized',
      cls: 'bg-info-500/10 text-info-500',
    },
    Locked: {
      label: 'Locked',
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
