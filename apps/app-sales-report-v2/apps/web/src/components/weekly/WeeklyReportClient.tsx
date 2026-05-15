'use client';

import { useEffect, useMemo, useState } from 'react';
import { Download, Banknote, TrendingUp, Percent, ChevronLeft, ChevronRight, Database, Cloud } from 'lucide-react';
import { cn } from '@v2/ui';
import {
  getWeeklyReport,
  getProductMetrics,
  getAvailableWeeks,
  type WeeklyChannel,
  type WeeklyReportData,
} from '@/lib/weekly-report-mock';
import { snapshotToWeeklyReport } from '@/lib/snapshot-to-report';
import { loadSnapshotAction } from '@/server/actions/ingest.actions';
import { WeeklyOverviewTable } from './WeeklyOverviewTable';
import { WeeklyProductBreakdownTable } from './WeeklyProductBreakdownTable';
import { KpiCard } from './KpiCard';
import { BreakdownCard } from './BreakdownCard';
import { buildCsv } from '@/lib/csv';
import { appendActionLog } from '@/lib/action-log-mock';

const CHANNEL_OPTS: { key: WeeklyChannel; label: string }[] = [
  { key: 'ALL', label: 'Total Platform' },
  { key: 'SHOPEE', label: 'Shopee' },
  { key: 'TIKTOK', label: 'TikTok' },
];

const DEFAULT_KRW_RATE = 17543;

export function WeeklyReportClient() {
  const weeks = useMemo(() => getAvailableWeeks(), []);
  const [weekNum, setWeekNum] = useState(weeks[weeks.length - 2]?.weekNum ?? weeks[weeks.length - 1]!.weekNum);
  const [channel, setChannel] = useState<WeeklyChannel>('ALL');
  const [krwRate, setKrwRate] = useState(DEFAULT_KRW_RATE);

  // Try loading a real-data snapshot for the selected week; fall back to mock.
  const [snapshotReport, setSnapshotReport] = useState<WeeklyReportData | null>(null);
  const [snapshotLoading, setSnapshotLoading] = useState(false);
  const selectedWeek = weeks.find((w) => w.weekNum === weekNum);
  useEffect(() => {
    if (!selectedWeek) {
      setSnapshotReport(null);
      return;
    }
    let cancelled = false;
    setSnapshotLoading(true);
    loadSnapshotAction({
      granularity: 'WEEKLY',
      weekNum: selectedWeek.weekNum,
      year: selectedWeek.year,
    }).then((res) => {
      if (cancelled) return;
      setSnapshotLoading(false);
      if (res.success && res.data.metrics) {
        setSnapshotReport(snapshotToWeeklyReport(res.data.metrics, channel));
      } else {
        setSnapshotReport(null);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [selectedWeek, channel]);

  const mockReport = useMemo(() => getWeeklyReport(weekNum, channel), [weekNum, channel]);
  const report = snapshotReport ?? mockReport;
  const isRealData = snapshotReport != null;
  const products = useMemo(() => getProductMetrics(weekNum, channel), [weekNum, channel]);

  // Sliding 5-week window that keeps the selected week in view (centered when possible)
  const WINDOW = 5;
  const selectedIdx = weeks.findIndex((w) => w.weekNum === weekNum);
  const windowStart = Math.max(0, Math.min(weeks.length - WINDOW, selectedIdx - 2));
  const visibleWeeks = weeks.slice(windowStart, windowStart + WINDOW);

  const canGoPrev = selectedIdx > 0;
  const canGoNext = selectedIdx >= 0 && selectedIdx < weeks.length - 1;
  const goPrev = () => canGoPrev && setWeekNum(weeks[selectedIdx - 1]!.weekNum);
  const goNext = () => canGoNext && setWeekNum(weeks[selectedIdx + 1]!.weekNum);

  const currentWeekLabel = `W${weekNum}`;

  const onDownload = () => {
    const header = ['Metric', 'VND', 'KRW', '% Net GMV', 'WoW%'];
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
    const filename = `weekly-report_${currentWeekLabel}_${new Date().toISOString().slice(0, 10)}.csv`;
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
      targetType: 'weekly-report',
      targetLabel: `Weekly Report ${currentWeekLabel}`,
      summary: `Exported ${rows.length} overview rows for ${channel} channel as CSV`,
      metadata: { week: currentWeekLabel, channel, filename, rowCount: rows.length },
    });
  };

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-neutral-900">Weekly Report</h1>
          <p className="mt-1 text-sm text-neutral-500">Week-over-week performance</p>
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

      <div className="inline-flex rounded-md border border-neutral-300 bg-white p-0.5 text-sm self-start">
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

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={goPrev}
            disabled={!canGoPrev}
            aria-label="Previous week"
            className={cn(
              'inline-flex h-12 w-9 items-center justify-center rounded-xl border transition-colors',
              canGoPrev
                ? 'border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-50'
                : 'border-neutral-200 bg-neutral-50 text-neutral-300 cursor-not-allowed',
            )}
          >
            <ChevronLeft className="h-4 w-4" />
          </button>

          {visibleWeeks.map((w) => {
            const active = w.weekNum === weekNum;
            return (
              <button
                key={w.weekNum}
                type="button"
                onClick={() => setWeekNum(w.weekNum)}
                className={cn(
                  'flex w-32 flex-col items-center rounded-xl border px-3 py-1.5 text-sm font-medium transition-colors leading-tight',
                  active
                    ? 'border-info-500 bg-info-50 text-info-500'
                    : 'border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-50',
                )}
              >
                <span>{w.label}</span>
                <span className={cn('text-[10px] font-normal', active ? 'text-info-500/80' : 'text-neutral-500')}>
                  ({w.periodLabel})
                </span>
              </button>
            );
          })}

          <button
            type="button"
            onClick={goNext}
            disabled={!canGoNext}
            aria-label="Next week"
            className={cn(
              'inline-flex h-12 w-9 items-center justify-center rounded-xl border transition-colors',
              canGoNext
                ? 'border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-50'
                : 'border-neutral-200 bg-neutral-50 text-neutral-300 cursor-not-allowed',
            )}
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>

        <div className="flex items-center gap-3">
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
          />
        </div>

        <WeeklyOverviewTable
          rows={report.overview}
          prevWeekLabel={report.prevWeekLabel}
          currentWeekLabel={currentWeekLabel}
          krwRate={krwRate}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <BreakdownCard title="Discount Breakdown" accent="indigo" items={report.discounts} krwRate={krwRate} />
        <BreakdownCard title="Promotional Breakdown" accent="orange" items={report.promo} krwRate={krwRate} />
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <BreakdownCard title="Traffic" accent="pink" items={report.traffic} krwRate={krwRate} />
        <BreakdownCard title="Sales" accent="green" items={report.sales} krwRate={krwRate} />
        <BreakdownCard title="Ads" accent="neutral" items={report.ads} krwRate={krwRate} />
      </div>

      <WeeklyProductBreakdownTable products={products} krwRate={krwRate} />
    </div>
  );
}

