'use client';

import { useState } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { FileSpreadsheet, FileText } from 'lucide-react';

type ReportKind = 'costs' | 'trips' | 'accidents' | 'repairs';

const REPORTS: Array<{ key: ReportKind; titleKey: string; descKey: string }> = [
  { key: 'costs', titleKey: 'reports.costs.title', descKey: 'reports.costs.desc' },
  { key: 'trips', titleKey: 'reports.trips.title', descKey: 'reports.trips.desc' },
  { key: 'accidents', titleKey: 'reports.accidents.title', descKey: 'reports.accidents.desc' },
  { key: 'repairs', titleKey: 'reports.repairs.title', descKey: 'reports.repairs.desc' },
];

function defaultRange() {
  const to = new Date();
  const from = new Date(to.getTime() - 30 * 24 * 60 * 60 * 1000);
  return { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) };
}

export default function ReportsPage() {
  const t = useTranslations();
  const locale = useLocale();
  const [range, setRange] = useState(defaultRange());

  function downloadUrl(kind: ReportKind, format: 'excel' | 'pdf'): string {
    const params = new URLSearchParams({
      from: range.from,
      to: range.to,
      format,
      lang: locale,
    });
    return `/api/reports/export/${kind}?${params}`;
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <header>
        <h1 className="text-2xl font-semibold">{t('nav.reports')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Choose a date range and download Excel or PDF.
        </p>
      </header>

      <div className="rounded-2xl border border-border bg-background p-5">
        <h2 className="mb-3 text-sm font-medium">Period</h2>
        <div className="flex items-center gap-2 text-sm">
          <input
            type="date"
            value={range.from}
            onChange={(e) => setRange((r) => ({ ...r, from: e.target.value }))}
            className="rounded-lg border border-border bg-background px-3 py-2"
          />
          <span className="text-muted-foreground">→</span>
          <input
            type="date"
            value={range.to}
            onChange={(e) => setRange((r) => ({ ...r, to: e.target.value }))}
            className="rounded-lg border border-border bg-background px-3 py-2"
          />
        </div>
      </div>

      <ul className="space-y-3">
        {REPORTS.map((r) => (
          <li
            key={r.key}
            className="flex flex-col gap-3 rounded-2xl border border-border bg-background p-5 sm:flex-row sm:items-center sm:justify-between"
          >
            <div>
              <h3 className="text-base font-medium">{t(r.titleKey)}</h3>
              <p className="text-sm text-muted-foreground">{t(r.descKey)}</p>
            </div>
            <div className="flex shrink-0 gap-2">
              <a
                href={downloadUrl(r.key, 'excel')}
                className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-1.5 text-sm hover:bg-muted"
              >
                <FileSpreadsheet className="h-4 w-4 text-emerald-600" /> Excel
              </a>
              <a
                href={downloadUrl(r.key, 'pdf')}
                className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-1.5 text-sm hover:bg-muted"
              >
                <FileText className="h-4 w-4 text-red-600" /> PDF
              </a>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
