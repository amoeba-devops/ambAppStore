'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Badge, Button, Card, cn } from '@car-v2/ui';
import { ReportStepper } from './report-stepper';

/**
 * Lập báo cáo · Bước 1 — pick a month from a year grid (each cell flags
 * Open / Đã xuất), then "Tiếp tục" to the Bước-2 review at `?month=YYYY-MM`.
 * Mirrors the design's 2-step stepper (select → continue).
 */
export function ReportMonthStep({
  exportedMonths,
  monthCounts,
}: {
  exportedMonths: string[];
  /** YYYY-MM → completed-trip count. A month with 0 can't advance. */
  monthCounts: Record<string, number>;
}) {
  const t = useTranslations('screens.truckReports');
  const tA = useTranslations('actions');
  const router = useRouter();
  const [year, setYear] = useState(() => new Date().getUTCFullYear());
  const [selected, setSelected] = useState<string | null>(null);
  const exported = new Set(exportedMonths);
  const selectedCount = selected ? (monthCounts[selected] ?? 0) : 0;
  const canContinue = !!selected && selectedCount > 0;

  const cont = () => {
    if (canContinue) router.push(`/truck/reports/new?month=${selected}`);
  };

  return (
    <div className="space-y-5">
      <ReportStepper step={1} />

      <Card variant="outline" className="space-y-4 p-5">
        <div>
          <div className="text-sm font-semibold text-text">{t('step1Title')}</div>
          <div className="text-xs text-text-muted">{t('step1Hint')}</div>
        </div>

        <div className="flex items-center justify-center gap-4">
          <button
            type="button"
            onClick={() => setYear((y) => y - 1)}
            aria-label="prev year"
            className="inline-flex items-center justify-center h-11 w-11 md:h-9 md:w-9 rounded-md border border-border text-text-muted hover:border-accent hover:text-accent"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="text-base font-bold tabular text-text">{year}</span>
          <button
            type="button"
            onClick={() => setYear((y) => y + 1)}
            aria-label="next year"
            className="inline-flex items-center justify-center h-11 w-11 md:h-9 md:w-9 rounded-md border border-border text-text-muted hover:border-accent hover:text-accent"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
          {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => {
            const mm = String(m).padStart(2, '0');
            const key = `${year}-${mm}`;
            const last = new Date(year, m, 0).getDate();
            const isExported = exported.has(key);
            const isSelected = selected === key;
            const count = monthCounts[key] ?? 0;
            const hasData = count > 0;
            return (
              <button
                key={key}
                type="button"
                onClick={() => setSelected(key)}
                onDoubleClick={() => {
                  if (hasData) router.push(`/truck/reports/new?month=${key}`);
                }}
                aria-pressed={isSelected}
                className={cn(
                  'rounded-lg border p-3 text-left transition-colors',
                  isSelected ? 'border-accent ring-1 ring-accent bg-accent-soft' : 'border-border hover:border-accent',
                  !hasData && !isSelected && 'opacity-60',
                )}
              >
                <div className="text-sm font-semibold text-text">
                  {t('monthN', { n: m })}/{year}
                </div>
                <div className="text-[11px] text-text-faint tabular">
                  01/{mm} – {last}/{mm}/{year}
                </div>
                <div className="mt-1.5 flex items-center gap-1.5">
                  <Badge tone={isExported ? 'success' : 'neutral'} size="sm">
                    {isExported ? t('exported') : t('open')}
                  </Badge>
                  <span className={cn('text-[11px] tabular', hasData ? 'text-text-muted' : 'text-text-faint')}>
                    {hasData ? t('nTrips', { n: count }) : t('noTrips')}
                  </span>
                </div>
              </button>
            );
          })}
        </div>

        {selected && selectedCount === 0 && (
          <p className="text-xs font-medium text-danger">{t('noDataMonth')}</p>
        )}
        <div className="flex justify-end">
          <Button variant="accent" size="md" onClick={cont} disabled={!canContinue}>
            {tA('continue')}
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </Card>
    </div>
  );
}
