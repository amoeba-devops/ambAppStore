'use client';

import { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, ChevronsUpDown, Lock } from 'lucide-react';
import { cn } from '@v2/ui';
import { findCurrentWeekIdx, type WeekEntry } from '@/lib/weekly-report-mock';
import type { PeriodStatus } from '@/lib/raw-archive-mock';

const VISIBLE_WEEKS = 5;

interface WeekPickerProps {
  weeks: WeekEntry[];
  selectedWeekNum: number | null;
  onPickWeek: (week: WeekEntry) => void;
  /** Optional status map per week label (e.g. "W19" → "Draft"). Missing entries render as "Open". */
  statusByLabel?: Map<string, PeriodStatus>;
  /** When true, Locked weeks remain clickable (e.g. read-only report viewers). Defaults to false. */
  allowClickLocked?: boolean;
}

export function WeekPicker({
  weeks,
  selectedWeekNum,
  onPickWeek,
  statusByLabel,
  allowClickLocked = false,
}: WeekPickerProps) {
  const [center, setCenter] = useState(() => {
    if (selectedWeekNum != null) {
      const idx = weeks.findIndex((w) => w.weekNum === selectedWeekNum);
      if (idx >= 0) return idx;
    }
    const currentIdx = findCurrentWeekIdx(weeks);
    return currentIdx >= 0 ? currentIdx : weeks.length - 1;
  });
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (selectedWeekNum == null) return;
    const idx = weeks.findIndex((w) => w.weekNum === selectedWeekNum);
    if (idx >= 0) setCenter(idx);
  }, [selectedWeekNum, weeks]);

  const halfWindow = Math.floor(VISIBLE_WEEKS / 2);
  const clampedCenter = Math.max(halfWindow, Math.min(weeks.length - 1 - halfWindow, center));
  const start = Math.max(0, clampedCenter - halfWindow);
  const end = Math.min(weeks.length, start + VISIBLE_WEEKS);
  const visible = weeks.slice(start, end);

  const canPrev = start > 0;
  const canNext = end < weeks.length;

  const goPrev = () => setCenter((c) => Math.max(0, c - 1));
  const goNext = () => setCenter((c) => Math.min(weeks.length - 1, c + 1));

  const handlePick = (w: WeekEntry) => {
    onPickWeek(w);
    const idx = weeks.findIndex((x) => x.weekNum === w.weekNum);
    if (idx >= 0) setCenter(idx);
  };

  const renderPill = (w: WeekEntry) => {
    const active = selectedWeekNum === w.weekNum;
    const status = statusByLabel?.get(w.label);
    const isLocked = !allowClickLocked && status === 'Locked';
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
  };

  return (
    <div className="space-y-2">
      {expanded ? (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7">
          {weeks.map(renderPill)}
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
          <div className="grid flex-1 grid-cols-5 gap-2">{visible.map(renderPill)}</div>
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
