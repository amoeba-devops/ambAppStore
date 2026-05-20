'use client';

import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Download, Banknote, TrendingUp, Percent, Database, Cloud } from 'lucide-react';
import { cn } from '@v2/ui';
import {
  getMonthlyReport,
  getProductMetricsForMonth,
  generateMonthsForYear,
  buildPlaceholderOverview,
  buildPlaceholderBreakdowns,
  type WeeklyChannel,
  type WeeklyReportData,
  type ProductMetric,
} from '@/lib/weekly-report-mock';
import { snapshotToWeeklyReport, snapshotToProducts } from '@/lib/snapshot-to-report';
import { getMetricFormula } from '@/lib/formula-lookup';
import type { PeriodSnapshotMetrics } from '@/server/services/period-snapshot.service';
import { loadSnapshotAction } from '@/server/actions/ingest.actions';
import { useArchiveStatusByLabel } from '@/lib/raw-archive-state';
import { MonthPicker } from '@/components/shared/MonthPicker';
import { WeeklyOverviewTable } from '@/components/weekly/WeeklyOverviewTable';
import { WeeklyProductBreakdownTable } from '@/components/weekly/WeeklyProductBreakdownTable';
import { KpiCard } from '@/components/weekly/KpiCard';
import { BreakdownCard } from '@/components/weekly/BreakdownCard';
import { buildCsv } from '@/lib/csv';
import { appendActionLog } from '@/lib/action-log-mock';

const CHANNEL_OPTS: { key: WeeklyChannel; label: string }[] = [
  { key: 'ALL', label: 'Total Platform' },
  { key: 'SHOPEE', label: 'Shopee' },
  { key: 'TIKTOK', label: 'TikTok' },
];

const DEFAULT_KRW_RATE = 17543;
const DEFAULT_YEAR = 2026;

export function MonthlyReportClient() {
  const searchParams = useSearchParams();
  // Deep-link from upload wizard: ?monthIdx=N&year=Y selects that month directly.
  const urlMonthIdx = (() => {
    const n = Number(searchParams?.get('monthIdx'));
    return Number.isFinite(n) && n >= 0 && n <= 11 ? n : null;
  })();
  const urlYear = (() => {
    const y = Number(searchParams?.get('year'));
    return Number.isFinite(y) && y > 2000 ? y : null;
  })();
  const [year, setYear] = useState(urlYear ?? DEFAULT_YEAR);
  const months = useMemo(() => generateMonthsForYear(year), [year]);
  const statusByLabel = useArchiveStatusByLabel();
  const [monthIdx, setMonthIdx] = useState(
    urlMonthIdx ?? months[months.length - 2]?.monthIdx ?? months[months.length - 1]!.monthIdx,
  );
  const [channel, setChannel] = useState<WeeklyChannel>('ALL');
  const [krwRate, setKrwRate] = useState(DEFAULT_KRW_RATE);

  // Try loading a real-data snapshot for the selected month; fall back to mock.
  const [snapshotMetrics, setSnapshotMetrics] = useState<PeriodSnapshotMetrics | null>(null);
  const [snapshotLoading, setSnapshotLoading] = useState(false);
  const selectedMonth = months.find((m) => m.monthIdx === monthIdx);
  useEffect(() => {
    if (!selectedMonth) {
      setSnapshotMetrics(null);
      return;
    }
    let cancelled = false;
    setSnapshotLoading(true);
    loadSnapshotAction({
      granularity: 'MONTHLY',
      monthIdx: selectedMonth.monthIdx,
      year: selectedMonth.year,
    }).then((res) => {
      if (cancelled) return;
      setSnapshotLoading(false);
      setSnapshotMetrics(res.success ? res.data.metrics : null);
    });
    return () => {
      cancelled = true;
    };
  }, [selectedMonth]);

  const snapshotReport: WeeklyReportData | null = useMemo(
    () => (snapshotMetrics ? snapshotToWeeklyReport(snapshotMetrics, channel) : null),
    [snapshotMetrics, channel],
  );
  // When there's no real monthly snapshot, render placeholder overview +
  // breakdown items (same metric labels as Weekly Report) with "—" values.
  // Don't fall back to mock data because mock uses different metric names
  // (e.g. "Page Views" vs "Total Page Views") that drift from the spec.
  const mockReport = useMemo(() => getMonthlyReport(monthIdx, channel), [monthIdx, channel]);
  const placeholderReport: WeeklyReportData = useMemo(() => {
    const b = buildPlaceholderBreakdowns(channel);
    return {
      ...mockReport,
      overview: buildPlaceholderOverview(),
      discounts: b.discounts,
      promo: b.promo,
      traffic: b.traffic,
      sales: b.sales,
    };
  }, [mockReport, channel]);
  const report = snapshotReport ?? placeholderReport;
  const isRealData = snapshotReport != null;
  const products = useMemo<ProductMetric[]>(
    () =>
      snapshotMetrics
        ? snapshotToProducts(snapshotMetrics, channel)
        : getProductMetricsForMonth(monthIdx, channel),
    [snapshotMetrics, monthIdx, channel],
  );

  const currentMonth = months.find((m) => m.monthIdx === monthIdx);
  const currentMonthLabel = currentMonth?.label ?? 'M' + monthIdx;

  const onDownload = () => {
    const header = ['Metric', 'VND', 'KRW', '% Net GMV', 'MoM%'];
    const rows = report.overview.map((r) => [
      r.metric,
      r.isRatio ? (r.vnd * 100).toFixed(2) + '%' : Math.round(r.vnd).toString(),
      r.isRatio ? '' : Math.round(r.vnd / (krwRate || 1)).toString(),
      (r.pctGmv * 100).toFixed(2) + '%',
      r.wowPct != null ? (r.wowPct * 100).toFixed(2) + '%' : '',
    ]);
    const csv = buildCsv(header, rows);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const filename = `monthly-report_${currentMonthLabel}_${new Date().toISOString().slice(0, 10)}.csv`;
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    appendActionLog({
      username: 'dev@amoeba.group',
      userRole: 'OPERATOR',
      category: 'EXPORT',
      verb: 'EXPORT',
      targetType: 'monthly-report',
      targetLabel: `Monthly Report ${currentMonthLabel}`,
      summary: `Exported ${rows.length} overview rows for ${channel} channel as CSV`,
      metadata: { month: currentMonthLabel, channel, filename, rowCount: rows.length },
    });
  };

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-neutral-900">Monthly Report</h1>
          <p className="mt-1 text-sm text-neutral-500">Month-over-month performance</p>
        </div>
        <span
          className={cn(
            'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-medium uppercase tracking-wider whitespace-nowrap shrink-0',
            snapshotLoading
              ? 'bg-neutral-100 text-neutral-500'
              : isRealData
                ? 'bg-success-500/10 text-success-500'
                : 'bg-neutral-100 text-neutral-500',
          )}
          title={
            isRealData
              ? 'Showing real ingested data from your uploaded files'
              : 'Showing mock data — ingest files via Upload wizard to see real numbers'
          }
        >
          {snapshotLoading ? (
            <>
              <Cloud className="h-3 w-3 animate-pulse" /> Loading…
            </>
          ) : isRealData ? (
            <>
              <Database className="h-3 w-3" /> Real data
            </>
          ) : (
            <>
              <Cloud className="h-3 w-3" /> Mock
            </>
          )}
        </span>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex rounded-md border border-neutral-300 bg-white p-0.5 text-sm">
          {CHANNEL_OPTS.map((opt) => (
            <button
              key={opt.key}
              type="button"
              onClick={() => setChannel(opt.key)}
              className={cn(
                'rounded px-3 py-1.5 font-medium transition-colors',
                channel === opt.key
                  ? 'bg-neutral-900 text-white'
                  : 'text-neutral-700 hover:bg-neutral-50',
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="inline-flex items-center gap-2 rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-sm">
            <span className="text-neutral-500">1 KRW =</span>
            <input
              type="number"
              value={krwRate}
              onChange={(e) => setKrwRate(Math.max(0, Number(e.target.value) || 0))}
              className="w-20 rounded border border-neutral-200 px-2 py-0.5 text-right font-mono tabular-nums text-neutral-900 focus:border-neutral-500 focus:outline-none"
              min="1"
              step="0.01"
            />
            <span className="text-neutral-500">VND</span>
          </div>
          <button
            type="button"
            onClick={onDownload}
            className="inline-flex items-center gap-1.5 rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
          >
            <Download className="h-4 w-4" />
            Export
          </button>
        </div>
      </div>

      <div>
        <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-neutral-500">
          Pick the month
        </div>
        <MonthPicker
          months={months}
          selectedMonthIdx={monthIdx}
          statusByLabel={statusByLabel}
          allowClickLocked
          year={year}
          onYearChange={setYear}
          onPickMonth={(m) => setMonthIdx(m.monthIdx)}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[380px_1fr] lg:items-stretch">
        <div className="flex flex-col gap-4">
          <KpiCard
            label="Net GMV"
            value={report.netGmv}
            kind="money"
            delta={report.netGmvWow}
            krwSub={report.netGmv / (krwRate || 1)}
            icon={Banknote}
            iconColor="text-info-500 bg-info-50"
            className="flex-1 justify-center"
            formula={getMetricFormula('Net GMV', channel)}
          />
          <KpiCard
            label="Total CM"
            value={report.cm}
            kind="money"
            delta={report.cmWow}
            krwSub={report.cm / (krwRate || 1)}
            highlight
            icon={TrendingUp}
            iconColor="text-success-500 bg-success-50"
            className="flex-1 justify-center"
            formula={getMetricFormula('Total CM', channel)}
          />
          <KpiCard
            label="CM %"
            value={report.cmPct}
            kind="ratio"
            delta={report.cmPctWow}
            highlight
            isRatioDelta
            icon={Percent}
            iconColor="text-success-500 bg-success-50"
            className="flex-1 justify-center"
            formula={getMetricFormula('CM %', channel)}
          />
        </div>

        <WeeklyOverviewTable
          rows={report.overview}
          prevWeekLabel={report.prevWeekLabel}
          currentWeekLabel={currentMonthLabel}
          krwRate={krwRate}
          deltaLabel="MoM"
          channel={channel}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <BreakdownCard
          title="Discount Breakdown"
          accent="indigo"
          items={report.discounts}
          krwRate={krwRate}
          deltaLabel="MoM"
          channel={channel}
        />
        <BreakdownCard
          title="Promotional Breakdown"
          accent="orange"
          items={report.promo}
          krwRate={krwRate}
          deltaLabel="MoM"
          channel={channel}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <BreakdownCard
          title={channel === 'TIKTOK' ? 'Traffic' : 'Traffic and Ads'}
          accent="pink"
          items={report.traffic}
          krwRate={krwRate}
          deltaLabel="MoM"
          channel={channel}
        />
        <BreakdownCard
          title="Sales"
          accent="green"
          items={report.sales}
          krwRate={krwRate}
          deltaLabel="MoM"
          channel={channel}
        />
      </div>

      {channel !== 'ALL' && (
        <WeeklyProductBreakdownTable products={products} krwRate={krwRate} />
      )}
    </div>
  );
}
