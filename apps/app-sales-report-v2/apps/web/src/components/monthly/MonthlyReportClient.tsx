'use client';

import { useMemo, useState } from 'react';
import { Download, Banknote, TrendingUp, Percent, ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@v2/ui';
import {
  getMonthlyReport,
  getProductMetricsForMonth,
  getAvailableMonths,
  type WeeklyChannel,
} from '@/lib/weekly-report-mock';
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

export function MonthlyReportClient() {
  const months = useMemo(() => getAvailableMonths(), []);
  const [monthIdx, setMonthIdx] = useState(
    months[months.length - 2]?.monthIdx ?? months[months.length - 1]!.monthIdx,
  );
  const [channel, setChannel] = useState<WeeklyChannel>('ALL');
  const [krwRate, setKrwRate] = useState(DEFAULT_KRW_RATE);

  const report = useMemo(() => getMonthlyReport(monthIdx, channel), [monthIdx, channel]);
  const products = useMemo(() => getProductMetricsForMonth(monthIdx, channel), [monthIdx, channel]);

  // Sliding 5-month window
  const WINDOW = 5;
  const selectedIdx = months.findIndex((m) => m.monthIdx === monthIdx);
  const windowStart = Math.max(0, Math.min(months.length - WINDOW, selectedIdx - 2));
  const visibleMonths = months.slice(windowStart, windowStart + WINDOW);

  const canGoPrev = selectedIdx > 0;
  const canGoNext = selectedIdx >= 0 && selectedIdx < months.length - 1;
  const goPrev = () => canGoPrev && setMonthIdx(months[selectedIdx - 1]!.monthIdx);
  const goNext = () => canGoNext && setMonthIdx(months[selectedIdx + 1]!.monthIdx);

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
      <div>
        <h1 className="text-xl font-semibold text-neutral-900">Monthly Report</h1>
        <p className="mt-1 text-sm text-neutral-500">Month-over-month performance</p>
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
            aria-label="Previous month"
            className={cn(
              'inline-flex h-12 w-9 items-center justify-center rounded-xl border transition-colors',
              canGoPrev
                ? 'border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-50'
                : 'border-neutral-200 bg-neutral-50 text-neutral-300 cursor-not-allowed',
            )}
          >
            <ChevronLeft className="h-4 w-4" />
          </button>

          {visibleMonths.map((m) => {
            const active = m.monthIdx === monthIdx;
            return (
              <button
                key={m.monthIdx}
                type="button"
                onClick={() => setMonthIdx(m.monthIdx)}
                className={cn(
                  'flex w-32 flex-col items-center rounded-xl border px-3 py-1.5 text-sm font-medium transition-colors leading-tight',
                  active
                    ? 'border-info-500 bg-info-50 text-info-500'
                    : 'border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-50',
                )}
              >
                <span>{m.label.charAt(0) + m.label.slice(1).toLowerCase()}</span>
                <span
                  className={cn(
                    'text-[10px] font-normal',
                    active ? 'text-info-500/80' : 'text-neutral-500',
                  )}
                >
                  ({m.periodLabel})
                </span>
              </button>
            );
          })}

          <button
            type="button"
            onClick={goNext}
            disabled={!canGoNext}
            aria-label="Next month"
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
          currentWeekLabel={currentMonthLabel}
          krwRate={krwRate}
          deltaLabel="MoM"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <BreakdownCard
          title="Discount Breakdown"
          accent="indigo"
          items={report.discounts}
          krwRate={krwRate}
          deltaLabel="MoM"
        />
        <BreakdownCard
          title="Promotional Breakdown"
          accent="orange"
          items={report.promo}
          krwRate={krwRate}
          deltaLabel="MoM"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <BreakdownCard title="Traffic" accent="pink" items={report.traffic} krwRate={krwRate} deltaLabel="MoM" />
        <BreakdownCard title="Sales" accent="green" items={report.sales} krwRate={krwRate} deltaLabel="MoM" />
        <BreakdownCard title="Ads" accent="neutral" items={report.ads} krwRate={krwRate} deltaLabel="MoM" />
      </div>

      <WeeklyProductBreakdownTable products={products} krwRate={krwRate} />
    </div>
  );
}
