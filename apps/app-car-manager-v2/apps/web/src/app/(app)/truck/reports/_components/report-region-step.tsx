'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Check, ChevronLeft, ChevronRight, Layers, MapPin } from 'lucide-react';
import { Button, Card, cn } from '@car-v2/ui';
import { TRUCK_REGIONS } from '@car-v2/shared/zod';
import { ReportStepper } from './report-stepper';

/**
 * Lập báo cáo · Bước 2 — multi-select the operating regions the report covers.
 * Each region shows its completed-trip count for the month; a region with 0 trips
 * is disabled. "Tất cả khu vực" is a select-all toggle over the regions that have
 * data. Continue fans out to Bước 3 with `?regions=A,B` — one review section (and
 * one generated report) per selected region.
 */
export function ReportRegionStep({
  month,
  regionCounts,
}: {
  month: string;
  /** total = all completed trips; byRegion per region code. */
  regionCounts: { total: number; byRegion: Record<string, number> };
}) {
  const t = useTranslations('screens.truckReports');
  const tA = useTranslations('actions');
  const tRegion = useTranslations('region');
  const router = useRouter();
  const [selected, setSelected] = useState<string[]>([]);

  const regions = TRUCK_REGIONS.map((r) => ({
    value: r as string,
    label: tRegion(r),
    count: regionCounts.byRegion[r] ?? 0,
  }));
  const dataRegions = regions.filter((r) => r.count > 0).map((r) => r.value);
  const noData = dataRegions.length === 0;
  const allSelected = !noData && dataRegions.every((r) => selected.includes(r));

  const toggle = (value: string) =>
    setSelected((s) => (s.includes(value) ? s.filter((v) => v !== value) : [...s, value]));
  const toggleAll = () => setSelected(allSelected ? [] : dataRegions);

  /* Canonical order so the review sections match the picker order. */
  const chosen = dataRegions.filter((r) => selected.includes(r));
  const canContinue = chosen.length > 0;
  const go = (list: string[]) =>
    router.push(`/truck/reports/new?month=${month}&regions=${list.join(',')}`);
  const cont = () => {
    if (canContinue) go(chosen);
  };

  return (
    <div className="space-y-5">
      <ReportStepper step={2} />

      <Card variant="outline" className="space-y-4 p-5">
        <div>
          <div className="text-sm font-semibold text-text">{t('regionStepTitle')}</div>
          <div className="text-xs text-text-muted">{t('regionStepHint')}</div>
        </div>

        {/* Select-all master toggle — lights up when every region-with-data is on. */}
        <button
          type="button"
          onClick={toggleAll}
          disabled={noData}
          aria-pressed={allSelected}
          className={cn(
            'flex w-full items-center gap-3 rounded-lg border p-4 text-left transition-colors',
            allSelected ? 'border-accent bg-accent-soft ring-1 ring-accent' : 'border-border hover:border-accent',
            noData && 'cursor-not-allowed opacity-60',
          )}
        >
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent/10 text-accent">
            <Layers className="h-4 w-4" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-semibold text-text">{t('regionAll')}</div>
            <div className="text-xs text-text-muted">{t('regionAllHint')}</div>
          </div>
          <CheckBox on={allSelected} disabled={noData} />
        </button>

        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {regions.map((o) => {
            const isSel = selected.includes(o.value);
            const hasData = o.count > 0;
            return (
              <button
                key={o.value}
                type="button"
                disabled={!hasData}
                onClick={() => toggle(o.value)}
                onDoubleClick={() => {
                  if (hasData) go([o.value]);
                }}
                aria-pressed={isSel}
                className={cn(
                  'flex items-center gap-3 rounded-lg border p-4 text-left transition-colors',
                  isSel ? 'border-accent bg-accent-soft ring-1 ring-accent' : 'border-border hover:border-accent',
                  !hasData && 'cursor-not-allowed opacity-60',
                )}
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-surface-2 text-text-muted">
                  <MapPin className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold text-text">{o.label}</div>
                  <div className={cn('text-xs tabular', hasData ? 'text-text-muted' : 'text-text-faint')}>
                    {hasData ? t('nTrips', { n: o.count }) : t('noTrips')}
                  </div>
                </div>
                <CheckBox on={isSel} disabled={!hasData} />
              </button>
            );
          })}
        </div>

        {noData && <p className="text-xs font-medium text-danger">{t('noRegionsData')}</p>}

        <div className="flex items-center justify-between">
          <Button variant="ghost" size="md" onClick={() => router.push('/truck/reports/new')}>
            <ChevronLeft className="h-4 w-4" />
            {tA('back')}
          </Button>
          <Button variant="accent" size="md" onClick={cont} disabled={!canContinue}>
            {chosen.length > 1 ? t('continueRegions', { n: chosen.length }) : tA('continue')}
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </Card>
    </div>
  );
}

/** Square check indicator for a multi-select row. */
function CheckBox({ on, disabled }: { on: boolean; disabled?: boolean }) {
  return (
    <span
      className={cn(
        'flex h-5 w-5 shrink-0 items-center justify-center rounded border',
        on ? 'border-accent bg-accent text-white' : 'border-border bg-surface',
        disabled && 'opacity-50',
      )}
    >
      {on && <Check className="h-3.5 w-3.5" />}
    </span>
  );
}
