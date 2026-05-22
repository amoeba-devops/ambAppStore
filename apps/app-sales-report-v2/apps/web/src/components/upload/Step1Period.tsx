'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  CalendarRange,
  CalendarDays,
  Check,
  Lock,
  Lightbulb,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import { cn } from '@v2/ui';
import { getAvailableWeeks, getAvailableMonths } from '@/lib/weekly-report-mock';
import { useArchiveStatusByLabel } from '@/lib/raw-archive-state';
import type { PeriodStatus } from '@/lib/raw-archive-mock';
import { WeekPicker } from '@/components/shared/WeekPicker';

export type Granularity = 'WEEK' | 'MONTH';

export interface SelectedPeriod {
  granularity: Granularity;
  periodId: number; // weekNum or monthIdx
  label: string;
  rangeLabel: string;
  /** UTC start-of-period ISO date (YYYY-MM-DD). */
  periodStartIso: string;
  /** UTC end-of-period ISO date (YYYY-MM-DD). */
  periodEndIso: string;
  /** Calendar year the period belongs to (Thursday's year for weekly). */
  year: number;
}

interface Props {
  granularity: Granularity | null;
  selected: SelectedPeriod | null;
  onChangeGranularity: (g: Granularity) => void;
  onChangePeriod: (p: SelectedPeriod) => void;
  /** Real DB-backed period keys (e.g. ["W19", "W20"]) — used to filter stale overrides. */
  realPeriodKeys?: string[];
}

export function Step1Period({
  granularity,
  selected,
  onChangeGranularity,
  onChangePeriod,
  realPeriodKeys = [],
}: Props) {
  const t = useTranslations('uploadWizard.step1');
  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-neutral-900">{t('title')}</h2>
          <p className="mt-1 text-sm text-neutral-500">{t('subtitle')}</p>
        </div>
        <PeriodStatusTipsButton />
      </div>

      {/* Granularity selection */}
      <div>
        <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-neutral-500">
          {t('label1')}
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <GranularityCard
            value="WEEK"
            label={t('card.weekly')}
            description={t('card.weeklyDesc')}
            icon={CalendarRange}
            active={granularity === 'WEEK'}
            onClick={() => onChangeGranularity('WEEK')}
          />
          <GranularityCard
            value="MONTH"
            label={t('card.monthly')}
            description={t('card.monthlyDesc')}
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
            {granularity === 'WEEK' ? t('label2Week') : t('label2Month')}
          </div>
          {granularity === 'WEEK' ? (
            <WeekPickerForUpload
              selected={selected}
              onChange={onChangePeriod}
              realPeriodKeys={realPeriodKeys}
            />
          ) : (
            <MonthPicker
              selected={selected}
              onChange={onChangePeriod}
              realPeriodKeys={realPeriodKeys}
            />
          )}
        </div>
      )}

      {/* Summary + status-aware banner */}
      {selected && (() => {
        const status = effectiveStatus(selected.label, realPeriodKeys);
        if (status === 'Finalized') {
          return (
            <div className="rounded-md border border-warning-500/40 bg-warning-500/10 px-4 py-3 text-sm">
              <div className="flex items-start gap-2 font-medium text-warning-500">
                <span>⚠️</span>
                <span>{t('banner.finalizedTitle', { label: selected.label })}</span>
              </div>
              <div className="mt-1 text-neutral-700">{t('banner.finalizedBody')}</div>
            </div>
          );
        }
        if (status === 'Active') {
          return (
            <div className="rounded-md border border-info-500/30 bg-info-50/40 px-4 py-3 text-sm">
              <div className="font-medium text-info-500">
                {t('banner.activeTitle', { label: selected.label })}
              </div>
              <div className="mt-1 text-neutral-700">{t('banner.activeBody')}</div>
            </div>
          );
        }
        return (
          <div className="rounded-md border border-info-500/30 bg-info-50/40 px-4 py-3 text-sm">
            <div className="font-medium text-info-500">{t('banner.selectedTitle')}</div>
            <div className="mt-1 font-mono text-neutral-900">
              {selected.label} <span className="text-neutral-500">({selected.rangeLabel})</span>
            </div>
          </div>
        );
      })()}
    </div>
  );
}

/** Resolve effective status for a selected period without reading from a hook. */
export function effectiveStatus(
  periodLabel: string,
  realPeriodKeys: string[],
): 'Open' | 'Active' | 'Finalized' | 'Locked' {
  const inReal = realPeriodKeys.includes(periodLabel);
  if (typeof window === 'undefined') return inReal ? 'Active' : 'Open';
  try {
    const raw = localStorage.getItem('raw-archive-state');
    if (raw) {
      const map = JSON.parse(raw);
      const ov = map?.[periodLabel];
      if (ov?.status === 'Finalized') return 'Finalized';
      if (ov?.status === 'Locked') return 'Locked';
    }
  } catch {
    // ignore parse errors
  }
  return inReal ? 'Active' : 'Open';
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

function WeekPickerForUpload({
  selected,
  onChange,
  realPeriodKeys,
}: {
  selected: SelectedPeriod | null;
  onChange: (p: SelectedPeriod) => void;
  realPeriodKeys: string[];
}) {
  const weeks = useMemo(() => getAvailableWeeks(), []);
  const statusByLabel = useArchiveStatusByLabel(realPeriodKeys);
  const selectedWeekNum = selected?.granularity === 'WEEK' ? selected.periodId : null;

  return (
    <WeekPicker
      weeks={weeks}
      selectedWeekNum={selectedWeekNum}
      statusByLabel={statusByLabel}
      onPickWeek={(w) =>
        onChange({
          granularity: 'WEEK',
          periodId: w.weekNum,
          label: w.label,
          rangeLabel: w.periodLabel,
          periodStartIso: new Date(w.startMs).toISOString().slice(0, 10),
          periodEndIso: new Date(w.endMs).toISOString().slice(0, 10),
          year: w.year,
        })
      }
    />
  );
}

function MonthPicker({
  selected,
  onChange,
  realPeriodKeys,
}: {
  selected: SelectedPeriod | null;
  onChange: (p: SelectedPeriod) => void;
  realPeriodKeys: string[];
}) {
  const months = getAvailableMonths();
  const statusByLabel = useArchiveStatusByLabel(realPeriodKeys);
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
                periodStartIso: new Date(m.startMs).toISOString().slice(0, 10),
                periodEndIso: new Date(m.endMs).toISOString().slice(0, 10),
                year: m.year,
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
  const t = useTranslations('uploadWizard.step1.pill');
  const lockedTitle = t('lockedTitle', { label });
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
  const t = useTranslations('uploadWizard.step1.tips');
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
        aria-label={t('title')}
        title={t('title')}
        className={cn(
          'inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-medium transition-colors',
          open
            ? 'border-warning-500 bg-warning-500/10 text-warning-500'
            : 'border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-50',
        )}
      >
        <Lightbulb className="h-3.5 w-3.5" />
        {t('button')}
      </button>
      {open && (
        <div className="absolute right-0 top-full z-30 mt-2 w-80 rounded-md border border-neutral-200 bg-white p-3 shadow-lg">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-neutral-500 mb-2">
            {t('title')}
          </div>
          <ul className="grid grid-cols-[80px_1fr] gap-x-3 gap-y-2 text-[11px] text-neutral-600">
            <span className="mt-0.5 inline-flex items-center justify-center gap-1 rounded-full border border-neutral-300 bg-white px-2 py-0.5 text-[10px] font-medium text-neutral-500">
              {t('open')}
            </span>
            <span className="leading-relaxed">{t('openDesc')}</span>

            <span className="mt-0.5 inline-flex items-center justify-center gap-1 rounded-full bg-success-500/10 px-2 py-0.5 text-[10px] font-medium text-success-500">
              {t('active')}
            </span>
            <span className="leading-relaxed">{t('activeDesc')}</span>

            <span className="mt-0.5 inline-flex items-center justify-center gap-1 rounded-full bg-info-500/10 px-2 py-0.5 text-[10px] font-medium text-info-500">
              {t('finalized')}
            </span>
            <span className="leading-relaxed">{t('finalizedDesc')}</span>

            <span className="mt-0.5 inline-flex items-center justify-center gap-1 rounded-full bg-neutral-200 px-2 py-0.5 text-[10px] font-medium text-neutral-500">
              <Lock className="h-2.5 w-2.5" /> {t('locked')}
            </span>
            <span className="leading-relaxed">{t('lockedDesc')}</span>
          </ul>
        </div>
      )}
    </div>
  );
}

type DisplayStatus = PeriodStatus | 'Open';

function StatusBadge({ status }: { status: DisplayStatus }) {
  const t = useTranslations('uploadWizard.step1.tips');
  const map: Record<DisplayStatus, { label: string; cls: string; icon?: React.ReactNode }> = {
    Open: {
      label: t('open'),
      cls: 'border border-neutral-300 bg-white text-neutral-500',
    },
    Draft: {
      label: t('active'),
      cls: 'bg-success-500/10 text-success-500',
    },
    Finalized: {
      label: t('finalized'),
      cls: 'bg-info-500/10 text-info-500',
    },
    Locked: {
      label: t('locked'),
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
