'use client';

import { useState, useMemo } from 'react';
import { Download } from 'lucide-react';
import { cn } from '@v2/ui';
import {
  WEEKLY_DATA,
  MONTHLY_DATA,
  buildWowSummary,
  computeChannelSummary,
  getChartSeries,
  type Metric,
  type Granularity,
  type WeekPoint,
} from '@/lib/trends-mock';
import { ChannelTrendCard } from './ChannelTrendCard';
import { MetricBreakdownTable } from './MetricBreakdownTable';
import { MultiMetricSelect } from './MultiMetricSelect';
import { buildCsv } from '@/lib/csv';
import { appendActionLog } from '@/lib/action-log-mock';

export function TrendsClient() {
  const [selectedMetrics, setSelectedMetrics] = useState<Metric[]>(['GMV']);
  const [granularity, setGranularity] = useState<Granularity>('WEEK');

  const data = granularity === 'WEEK' ? WEEKLY_DATA : MONTHLY_DATA;

  const wowRows = useMemo(() => buildWowSummary(data), [data]);

  const onExport = () => {
    const header = ['Week', 'Period', 'GMV', 'GMV WoW %', 'Net GMV', 'Net GMV WoW %', 'CM', 'CM WoW %', 'Orders', 'Orders WoW %'];
    const csvRows = wowRows.map((r) => [
      r.weekLabel,
      r.periodLabel,
      Math.round(r.gmv),
      r.gmvWow != null ? (r.gmvWow * 100).toFixed(2) : '',
      Math.round(r.netGmv),
      r.netGmvWow != null ? (r.netGmvWow * 100).toFixed(2) : '',
      Math.round(r.cm),
      r.cmWow != null ? (r.cmWow * 100).toFixed(2) : '',
      Math.round(r.orders),
      r.ordersWow != null ? (r.ordersWow * 100).toFixed(2) : '',
    ]);
    const csv = buildCsv(header, csvRows);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const filename = `trends_${granularity.toLowerCase()}_${new Date().toISOString().slice(0, 10)}.csv`;
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
      targetType: 'trending-report',
      targetLabel: `Trending Report (${granularity === 'WEEK' ? 'WoW' : 'MoM'})`,
      summary: `Exported ${csvRows.length} ${granularity === 'WEEK' ? 'weeks' : 'months'} of trend data as CSV`,
      metadata: { granularity, filename, rowCount: csvRows.length },
    });
  };

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold text-neutral-900">Trends</h1>
          <p className="mt-1 text-sm text-neutral-500">
            Compare growth across weeks and months. Reports are computed against locked Master Data snapshots.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="inline-flex rounded-md border border-neutral-300 bg-white p-0.5 text-sm">
            <button
              type="button"
              onClick={() => setGranularity('WEEK')}
              className={cn(
                'rounded px-3 py-1.5 font-medium',
                granularity === 'WEEK' ? 'bg-neutral-900 text-white' : 'text-neutral-700 hover:bg-neutral-50',
              )}
            >
              Week over Week
            </button>
            <button
              type="button"
              onClick={() => setGranularity('MONTH')}
              className={cn(
                'rounded px-3 py-1.5 font-medium',
                granularity === 'MONTH' ? 'bg-neutral-900 text-white' : 'text-neutral-700 hover:bg-neutral-50',
              )}
            >
              Month over Month
            </button>
          </div>
          <button
            type="button"
            onClick={onExport}
            className="inline-flex items-center gap-1.5 rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
          >
            <Download className="h-4 w-4" />
            Export
          </button>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <span className="text-[11px] font-medium uppercase tracking-wider text-neutral-500">Metric</span>
        <MultiMetricSelect value={selectedMetrics} onChange={setSelectedMetrics} max={5} />
      </div>

      <div className="space-y-4">
        {selectedMetrics.map((m) => (
          <MetricRow key={m} metric={m} weeks={data} granularity={granularity} />
        ))}
      </div>

      <MetricBreakdownTable weeks={data} granularity={granularity} />
    </div>
  );
}

function MetricRow({ metric, weeks, granularity }: { metric: Metric; weeks: WeekPoint[]; granularity: Granularity }) {
  const totalSummary = useMemo(() => computeChannelSummary(weeks, 'TOTAL', metric), [weeks, metric]);
  const shopeeSummary = useMemo(() => computeChannelSummary(weeks, 'SHOPEE', metric), [weeks, metric]);
  const tiktokSummary = useMemo(() => computeChannelSummary(weeks, 'TIKTOK', metric), [weeks, metric]);
  const totalChart = useMemo(() => getChartSeries(weeks, 'TOTAL', metric), [weeks, metric]);
  const shopeeChart = useMemo(() => getChartSeries(weeks, 'SHOPEE', metric), [weeks, metric]);
  const tiktokChart = useMemo(() => getChartSeries(weeks, 'TIKTOK', metric), [weeks, metric]);

  return (
    <div className="grid grid-cols-3 gap-4">
      <ChannelTrendCard channel="TOTAL" metric={metric} summary={totalSummary} chartData={totalChart} granularity={granularity} />
      <ChannelTrendCard channel="SHOPEE" metric={metric} summary={shopeeSummary} chartData={shopeeChart} granularity={granularity} />
      <ChannelTrendCard channel="TIKTOK" metric={metric} summary={tiktokSummary} chartData={tiktokChart} granularity={granularity} />
    </div>
  );
}
