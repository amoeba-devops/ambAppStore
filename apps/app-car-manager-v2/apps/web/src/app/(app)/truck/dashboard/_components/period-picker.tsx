'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { Calendar, ChevronDown } from 'lucide-react';
import { Button, cn } from '@car-v2/ui';
import { PERIOD_PRESETS, type PeriodPreset } from './period-presets';

const MONTHS = Array.from({ length: 12 }, (_, i) => i + 1);
const CURRENT_YEAR = new Date().getFullYear();
/** Selectable years — current year back through 5 prior years (newest first). */
const YEARS = Array.from({ length: 6 }, (_, i) => CURRENT_YEAR - i);

/** Split a 'YYYY-MM' value into its year/month parts (empty when unset). */
function splitYm(v?: string): { y: string; m: string } {
  if (v && /^\d{4}-\d{2}$/.test(v)) return { y: v.slice(0, 4), m: v.slice(5, 7) };
  return { y: '', m: '' };
}

/**
 * Dashboard period picker (design IA): a trigger showing the current period
 * label, opening a panel with "Truy cập nhanh" (preset chips) + "Khoảng tùy
 * chọn" (custom month/year range). Presets drive `?period=`; a custom range
 * drives `?from=&to=` in `YYYY-MM` (server reads either, re-aggregates by the
 * months spanned). Range picks month + year via dropdowns only — no day picker
 * (QA: dashboard aggregates by whole months).
 */
export function PeriodPicker({
  label,
  currentPreset,
  from,
  to,
}: {
  label: string;
  currentPreset: PeriodPreset | null;
  from?: string;
  to?: string;
}) {
  const t = useTranslations('screens.truckDashboard.period');
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname() ?? '/truck/dashboard';
  const sp = useSearchParams();
  const [open, setOpen] = useState(false);
  const initFrom = splitYm(from);
  const initTo = splitYm(to);
  const [fromY, setFromY] = useState(initFrom.y);
  const [fromM, setFromM] = useState(initFrom.m);
  const [toY, setToY] = useState(initTo.y);
  const [toM, setToM] = useState(initTo.m);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  const monthLabel = (m: number) =>
    new Intl.DateTimeFormat(locale, { month: 'short' }).format(new Date(2000, m - 1, 1));

  const pickPreset = (p: PeriodPreset) => {
    const params = new URLSearchParams(sp?.toString());
    params.set('period', p);
    params.delete('from');
    params.delete('to');
    router.push(`${pathname}?${params.toString()}`);
    setOpen(false);
  };

  const draftFrom = fromY && fromM ? `${fromY}-${fromM}` : '';
  const draftTo = toY && toM ? `${toY}-${toM}` : '';
  /* Both endpoints chosen; 'YYYY-MM' string compare is chronological so `<=`
   * validates the range order. */
  const bothChosen = draftFrom !== '' && draftTo !== '';
  const customValid = bothChosen && draftFrom <= draftTo;
  const applyCustom = () => {
    if (!customValid) return;
    const params = new URLSearchParams(sp?.toString());
    params.set('from', draftFrom);
    params.set('to', draftTo);
    params.delete('period');
    router.push(`${pathname}?${params.toString()}`);
    setOpen(false);
  };

  const selectCls =
    'h-11 md:h-9 rounded-md border border-border bg-surface px-2 text-sm text-text focus-visible:outline-none focus-visible:border-accent';

  /* One "From"/"To" row: a month dropdown + a year dropdown. */
  const MonthYearRow = ({
    labelText,
    y,
    m,
    onYear,
    onMonth,
  }: {
    labelText: string;
    y: string;
    m: string;
    onYear: (v: string) => void;
    onMonth: (v: string) => void;
  }) => (
    <div className="flex items-center gap-2">
      <span className="w-8 shrink-0 text-xs font-medium text-text-muted">{labelText}</span>
      <select value={m} onChange={(e) => onMonth(e.target.value)} className={cn(selectCls, 'flex-1')}>
        <option value="">{t('monthPh')}</option>
        {MONTHS.map((mm) => (
          <option key={mm} value={String(mm).padStart(2, '0')}>
            {monthLabel(mm)}
          </option>
        ))}
      </select>
      <select value={y} onChange={(e) => onYear(e.target.value)} className={cn(selectCls, 'w-24')}>
        <option value="">{t('yearPh')}</option>
        {YEARS.map((yy) => (
          <option key={yy} value={String(yy)}>
            {yy}
          </option>
        ))}
      </select>
    </div>
  );

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="inline-flex items-center gap-2 rounded-md border border-border bg-surface px-3 py-1.5 text-sm font-semibold text-text min-h-[44px] md:min-h-0 hover:border-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <Calendar className="h-4 w-4 text-text-muted" />
        {label}
        <ChevronDown className="h-3.5 w-3.5 text-text-muted" />
      </button>
      {open && (
        <div className="absolute right-0 z-30 mt-1.5 w-80 space-y-3 rounded-lg border border-border bg-surface p-3 shadow-lg">
          <div>
            <div className="mb-1.5 text-xs font-semibold text-text-muted">{t('quickAccess')}</div>
            <div className="flex flex-wrap gap-1.5">
              {PERIOD_PRESETS.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => pickPreset(p)}
                  className={cn(
                    'inline-flex items-center min-h-[44px] md:min-h-0 rounded-full border px-2.5 py-1 text-xs font-semibold transition-colors',
                    currentPreset === p
                      ? 'border-accent bg-accent text-accent-fg'
                      : 'border-border bg-surface text-text-muted hover:border-accent hover:text-accent',
                  )}
                >
                  {t(p)}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <div className="text-xs font-semibold text-text-muted">{t('customRange')}</div>
            {/* Month + year dropdowns only — no day picker. */}
            <MonthYearRow labelText={t('rangeFrom')} y={fromY} m={fromM} onYear={setFromY} onMonth={setFromM} />
            <MonthYearRow labelText={t('rangeTo')} y={toY} m={toM} onYear={setToY} onMonth={setToM} />
            {bothChosen && !customValid && (
              <p className="text-xs text-danger">{t('rangeError')}</p>
            )}
            <Button variant="accent" size="sm" className="mt-1 w-full h-11 md:h-9" disabled={!customValid} onClick={applyCustom}>
              {t('apply')}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
