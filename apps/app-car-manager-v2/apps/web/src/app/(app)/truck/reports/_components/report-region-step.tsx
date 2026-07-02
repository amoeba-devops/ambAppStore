'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { ChevronLeft, ChevronRight, Layers, MapPin } from 'lucide-react';
import { Button, Card, cn } from '@car-v2/ui';
import { TRUCK_REGIONS } from '@car-v2/shared/zod';
import { ReportStepper } from './report-stepper';

/**
 * Lập báo cáo · Bước 2 — pick the operating region the report is scoped to, or
 * "Tất cả khu vực" (all regions). Each option shows its completed-trip count for
 * the month; a region with 0 trips can't advance (Continue stays disabled + an
 * inline error), so the user is stopped here instead of hitting an empty review.
 */
export function ReportRegionStep({
  month,
  regionCounts,
}: {
  month: string;
  /** total = all completed trips (the "all regions" scope); byRegion per code. */
  regionCounts: { total: number; byRegion: Record<string, number> };
}) {
  const t = useTranslations('screens.truckReports');
  const tA = useTranslations('actions');
  const tRegion = useTranslations('region');
  const router = useRouter();
  const [selected, setSelected] = useState<string | null>(null);

  /* "all" first, then each operating region — each with its trip count. */
  const options = [
    { value: 'all', label: t('regionAll'), all: true, count: regionCounts.total },
    ...TRUCK_REGIONS.map((r) => ({
      value: r as string,
      label: tRegion(r),
      all: false,
      count: regionCounts.byRegion[r] ?? 0,
    })),
  ];
  const selectedCount = selected ? (options.find((o) => o.value === selected)?.count ?? 0) : 0;
  const canContinue = !!selected && selectedCount > 0;

  const go = (value: string) => router.push(`/truck/reports/new?month=${month}&region=${value}`);
  const cont = () => {
    if (canContinue && selected) go(selected);
  };

  return (
    <div className="space-y-5">
      <ReportStepper step={2} />

      <Card variant="outline" className="space-y-4 p-5">
        <div>
          <div className="text-sm font-semibold text-text">{t('regionStepTitle')}</div>
          <div className="text-xs text-text-muted">{t('regionStepHint')}</div>
        </div>

        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {options.map((o) => {
            const isSel = selected === o.value;
            const hasData = o.count > 0;
            return (
              <button
                key={o.value}
                type="button"
                onClick={() => setSelected(o.value)}
                onDoubleClick={() => {
                  if (hasData) go(o.value);
                }}
                aria-pressed={isSel}
                className={cn(
                  'flex items-center gap-3 rounded-lg border p-4 text-left transition-colors',
                  isSel ? 'border-accent bg-accent-soft ring-1 ring-accent' : 'border-border hover:border-accent',
                  !hasData && !isSel && 'opacity-60',
                )}
              >
                <span
                  className={cn(
                    'flex h-9 w-9 shrink-0 items-center justify-center rounded-full',
                    o.all ? 'bg-accent/10 text-accent' : 'bg-surface-2 text-text-muted',
                  )}
                >
                  {o.all ? <Layers className="h-4 w-4" /> : <MapPin className="h-4 w-4" />}
                </span>
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-text">{o.label}</div>
                  <div className={cn('text-xs tabular', hasData ? 'text-text-muted' : 'text-text-faint')}>
                    {hasData ? t('nTrips', { n: o.count }) : t('noTrips')}
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {selected && selectedCount === 0 && (
          <p className="text-xs font-medium text-danger">{t('noDataRegion')}</p>
        )}

        <div className="flex items-center justify-between">
          <Button variant="ghost" size="md" onClick={() => router.push('/truck/reports/new')}>
            <ChevronLeft className="h-4 w-4" />
            {tA('back')}
          </Button>
          <Button variant="accent" size="md" onClick={cont} disabled={!canContinue}>
            {tA('continue')}
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </Card>
    </div>
  );
}
