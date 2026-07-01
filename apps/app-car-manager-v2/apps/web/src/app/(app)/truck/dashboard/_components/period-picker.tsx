'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Calendar, ChevronDown } from 'lucide-react';
import { Button, cn } from '@car-v2/ui';
import { PERIOD_PRESETS, type PeriodPreset } from './period-presets';

/**
 * Dashboard period picker (design IA): a trigger showing the current period
 * label, opening a panel with "Truy cập nhanh" (preset chips) + "Khoảng tùy
 * chọn" (custom from/to date range). Presets drive `?period=`; a custom range
 * drives `?from=&to=` (server reads either, re-aggregates by the months spanned).
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
  const router = useRouter();
  const pathname = usePathname() ?? '/truck/dashboard';
  const sp = useSearchParams();
  const [open, setOpen] = useState(false);
  const [draftFrom, setDraftFrom] = useState(from ?? '');
  const [draftTo, setDraftTo] = useState(to ?? '');
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  const pickPreset = (p: PeriodPreset) => {
    const params = new URLSearchParams(sp?.toString());
    params.set('period', p);
    params.delete('from');
    params.delete('to');
    router.push(`${pathname}?${params.toString()}`);
    setOpen(false);
  };

  const customValid = draftFrom !== '' && draftTo !== '' && draftFrom <= draftTo;
  const applyCustom = () => {
    if (!customValid) return;
    const params = new URLSearchParams(sp?.toString());
    params.set('from', draftFrom);
    params.set('to', draftTo);
    params.delete('period');
    router.push(`${pathname}?${params.toString()}`);
    setOpen(false);
  };

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
        <div className="absolute right-0 z-30 mt-1.5 w-72 space-y-3 rounded-lg border border-border bg-surface p-3 shadow-lg">
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
          <div>
            <div className="mb-1.5 text-xs font-semibold text-text-muted">{t('customRange')}</div>
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={draftFrom}
                onChange={(e) => setDraftFrom(e.target.value)}
                className="h-11 md:h-9 flex-1 rounded-md border border-border bg-surface px-2 text-sm text-text focus-visible:outline-none focus-visible:border-accent"
              />
              <span className="text-text-muted">–</span>
              <input
                type="date"
                value={draftTo}
                onChange={(e) => setDraftTo(e.target.value)}
                className="h-11 md:h-9 flex-1 rounded-md border border-border bg-surface px-2 text-sm text-text focus-visible:outline-none focus-visible:border-accent"
              />
            </div>
            <Button variant="accent" size="sm" className="mt-2 w-full h-11 md:h-9" disabled={!customValid} onClick={applyCustom}>
              {t('apply')}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
