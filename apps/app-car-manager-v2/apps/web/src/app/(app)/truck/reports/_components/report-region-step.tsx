'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Check, ChevronLeft, ChevronRight, Layers, MapPin } from 'lucide-react';
import { Button, Card, cn } from '@car-v2/ui';
import { TRUCK_REGIONS } from '@car-v2/shared/zod';
import { ReportStepper } from './report-stepper';

/**
 * Lập báo cáo · Bước 2 — choose the report scope. Two mutually-exclusive modes:
 *   - "Tất cả khu vực" (all regions) → ONE consolidated report over every region
 *     → Continue with `?regions=ALL`.
 *   - one or more individual regions → one report PER region → `?regions=A,B`.
 * Each region shows its completed-trip count; a region with 0 trips is disabled.
 */
export function ReportRegionStep({
  month,
  regionCounts,
  regionOptions = TRUCK_REGIONS,
  allowAllScope = true,
}: {
  month: string;
  /** total = all completed trips; byRegion per region code. */
  regionCounts: { total: number; byRegion: Record<string, number> };
  /** Regions the viewer may report on (region ACL, REQ-20260813). */
  regionOptions?: readonly string[];
  /** False for a narrowed user — the consolidated report spans every region. */
  allowAllScope?: boolean;
}) {
  const t = useTranslations('screens.truckReports');
  const tA = useTranslations('actions');
  const tRegion = useTranslations('region');
  const router = useRouter();
  const [selected, setSelected] = useState<string[]>([]);
  /* Consolidated scope: "Tất cả khu vực" = ONE report over all regions
   * (region=null server-side), mutually exclusive with per-region multi-select. */
  const [allMode, setAllMode] = useState(false);

  const regions = regionOptions.map((r) => ({
    value: r,
    label: tRegion(r),
    count: regionCounts.byRegion[r] ?? 0,
  }));
  const dataRegions = regions.filter((r) => r.count > 0).map((r) => r.value);
  const noData = dataRegions.length === 0;

  /* Picking a region turns OFF consolidated mode and vice-versa. */
  const toggle = (value: string) => {
    setAllMode(false);
    setSelected((s) => (s.includes(value) ? s.filter((v) => v !== value) : [...s, value]));
  };
  const pickAll = () => {
    setSelected([]);
    setAllMode((v) => !v);
  };

  /* Canonical order so the review sections match the picker order. */
  const chosen = dataRegions.filter((r) => selected.includes(r));
  const canContinue = allMode || chosen.length > 0;
  /* `ALL` = one consolidated report; a comma list = one report per region. */
  const go = (query: string) =>
    router.push(`/truck/reports/new?month=${month}&regions=${query}`);
  const cont = () => {
    if (allMode) go('ALL');
    else if (chosen.length > 0) go(chosen.join(','));
  };

  return (
    <div className="space-y-5">
      <ReportStepper step={2} />

      <Card variant="outline" className="space-y-4 p-5">
        <div>
          <div className="text-sm font-semibold text-text">{t('regionStepTitle')}</div>
          <div className="text-xs text-text-muted">{t('regionStepHint')}</div>
        </div>

        {/* Consolidated "all regions" toggle — one combined report; mutually
            exclusive with the per-region picks below. Hidden for a user narrowed
            to a subset of regions, since it would span regions they can't see. */}
        {allowAllScope && (
          <button
            type="button"
            onClick={pickAll}
            disabled={noData}
            aria-pressed={allMode}
            className={cn(
              'flex w-full items-center gap-3 rounded-lg border p-4 text-left transition-colors',
              allMode ? 'border-accent bg-accent-soft ring-1 ring-accent' : 'border-border hover:border-accent',
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
            <CheckBox on={allMode} disabled={noData} />
          </button>
        )}

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
                  if (hasData) go(o.value);
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
