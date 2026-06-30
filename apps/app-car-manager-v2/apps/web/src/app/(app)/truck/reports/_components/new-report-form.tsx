'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { ChevronLeft, ChevronRight, FileSpreadsheet, Loader2 } from 'lucide-react';
import { Badge, Button, Card, cn, toast } from '@car-v2/ui';
import { generateTruckReportAction } from '@/server/actions/truck-report.actions';
import { formatActionError } from '@/lib/format-action-error';

const TYPES = ['PNL', 'TRIP_LOG', 'VEHICLE'] as const;
type ReportType = (typeof TYPES)[number];

/**
 * Lập báo cáo — 2-step stepper (design IA): pick a month from a year grid
 * (each cell flags Open / Đã xuất), then choose report type(s) and generate.
 */
export function NewReportForm({ exportedMonths }: { exportedMonths: string[] }) {
  const t = useTranslations('screens.truckReports');
  const tErr = useTranslations();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [year, setYear] = useState(() => new Date().getUTCFullYear());
  const [step, setStep] = useState<1 | 2>(1);
  const [month, setMonth] = useState<string | null>(null);
  const [types, setTypes] = useState<Record<ReportType, boolean>>({ PNL: true, TRIP_LOG: true, VEHICLE: true });

  const exported = new Set(exportedMonths);
  const selected = TYPES.filter((k) => types[k]);

  const generate = () =>
    start(async () => {
      if (!month || selected.length === 0) return;
      let ok = 0;
      for (const type of selected) {
        const res = await generateTruckReportAction({ month, type });
        if (!res.success) {
          toast.error(formatActionError(res.error, tErr));
          return;
        }
        ok += 1;
      }
      toast.success(t('generatedToast', { count: ok }));
      router.push('/truck/reports');
      router.refresh();
    });

  /* Step 1 — year grid */
  if (step === 1) {
    return (
      <Card variant="outline" className="max-w-3xl space-y-4 p-5">
        <div>
          <div className="text-sm font-semibold text-text">{t('step1Title')}</div>
          <div className="text-xs text-text-muted">{t('step1Hint')}</div>
        </div>

        <div className="flex items-center justify-center gap-4">
          <button
            type="button"
            onClick={() => setYear((y) => y - 1)}
            aria-label="prev year"
            className="rounded-md border border-border p-1.5 text-text-muted hover:border-accent hover:text-accent"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="text-base font-bold tabular text-text">{year}</span>
          <button
            type="button"
            onClick={() => setYear((y) => y + 1)}
            aria-label="next year"
            className="rounded-md border border-border p-1.5 text-text-muted hover:border-accent hover:text-accent"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => {
            const mm = String(m).padStart(2, '0');
            const key = `${year}-${mm}`;
            const last = new Date(year, m, 0).getDate();
            const isExported = exported.has(key);
            return (
              <button
                key={key}
                type="button"
                onClick={() => {
                  setMonth(key);
                  setStep(2);
                }}
                className="rounded-lg border border-border p-3 text-left transition-colors hover:border-accent"
              >
                <div className="text-sm font-semibold text-text">{t('monthN', { n: m })}/{year}</div>
                <div className="text-[11px] text-text-faint tabular">01/{mm} – {last}/{mm}/{year}</div>
                <Badge tone={isExported ? 'success' : 'neutral'} size="sm" className="mt-1.5">
                  {isExported ? t('exported') : t('open')}
                </Badge>
              </button>
            );
          })}
        </div>
      </Card>
    );
  }

  /* Step 2 — type selection */
  const selMonthLabel = month ? `${t('monthN', { n: Number(month.slice(5)) })}/${month.slice(0, 4)}` : '';
  return (
    <Card variant="outline" className="max-w-xl space-y-5 p-5">
      <button
        type="button"
        onClick={() => setStep(1)}
        className="inline-flex items-center gap-1 text-sm font-medium text-text-muted hover:text-text"
      >
        <ChevronLeft className="h-4 w-4" />
        {t('step1Title')}
      </button>

      <div>
        <div className="text-sm font-semibold text-text">{t('step2Title')}</div>
        <div className="text-xs text-text-muted">{selMonthLabel}</div>
      </div>

      <div className="space-y-2">
        <div className="text-sm font-medium text-text">{t('selectTypes')}</div>
        <div className="space-y-1.5">
          {TYPES.map((k) => (
            <label
              key={k}
              className={cn(
                'flex cursor-pointer items-center gap-2.5 rounded-md border px-3 py-2 transition-colors',
                types[k] ? 'border-accent bg-accent-soft' : 'border-border hover:border-accent/50',
              )}
            >
              <input
                type="checkbox"
                checked={types[k]}
                onChange={() => setTypes((s) => ({ ...s, [k]: !s[k] }))}
                className="accent-accent"
              />
              <span className="text-sm text-text">{t(`type_${k}`)}</span>
            </label>
          ))}
        </div>
      </div>

      <p className="text-xs text-text-faint">{t('createHint')}</p>

      <Button
        variant="accent"
        disabled={pending || !month || selected.length === 0}
        onClick={generate}
        iconLeft={pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileSpreadsheet className="h-4 w-4" />}
      >
        {t('generateBtn')}
      </Button>
    </Card>
  );
}
