'use client';

import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Download, Banknote, TrendingUp, Percent, Database, Cloud } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { cn } from '@v2/ui';
import {
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
import { downloadReportXlsx } from '@/lib/weekly-report-xlsx';
import { appendActionLog } from '@/lib/action-log-mock';
import { DEFAULT_VND_PER_KRW } from '@/lib/format';
import { useFxRateOverride } from '@/lib/fx-rate-override';
import { FxRateEditor } from '@/components/shared/FxRateEditor';

type ChannelOpt = { key: WeeklyChannel; labelKey: 'all' | 'shopee' | 'tiktok' };
const CHANNEL_OPTS: ChannelOpt[] = [
  { key: 'ALL', labelKey: 'all' },
  { key: 'SHOPEE', labelKey: 'shopee' },
  { key: 'TIKTOK', labelKey: 'tiktok' },
];

const DEFAULT_YEAR = 2026;

interface MonthlyReportClientProps {
  /** Reserved for future use; MonthPicker still shows all 12 months. */
  realMonthKeys?: Array<{ monthIdx: number; year: number }>;
}

export function MonthlyReportClient({ realMonthKeys = [] }: MonthlyReportClientProps = {}) {
  const t = useTranslations('monthlyReport');
  const tW = useTranslations('weeklyReport');
  const searchParams = useSearchParams();
  const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const realLabels = useMemo(
    () => realMonthKeys.map((k) => `${MONTH_NAMES[k.monthIdx]} ${k.year}`),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [realMonthKeys.map((k) => `${k.year}::${k.monthIdx}`).join(',')],
  );
  // Deep-link from upload wizard: ?monthIdx=N&year=Y selects that month directly.
  // Important: check for null before Number() — `Number(null) === 0` would
  // otherwise make the default jump to January (monthIdx 0) instead of falling
  // through to `latestRealForYear`.
  const urlMonthIdx = (() => {
    const raw = searchParams?.get('monthIdx');
    if (raw == null) return null;
    const n = Number(raw);
    return Number.isFinite(n) && n >= 0 && n <= 11 ? n : null;
  })();
  const urlYear = (() => {
    const raw = searchParams?.get('year');
    if (raw == null) return null;
    const y = Number(raw);
    return Number.isFinite(y) && y > 2000 ? y : null;
  })();
  // Latest real (DB-backed) month for the URL year — used as the default
  // selection so the user lands on a populated month, not the empty "Open"
  // tail of the calendar.
  const latestRealForYear = useMemo(() => {
    const targetYear = urlYear ?? DEFAULT_YEAR;
    const sameYear = realMonthKeys.filter((k) => k.year === targetYear);
    if (sameYear.length === 0) return null;
    return sameYear.reduce((a, b) => (b.monthIdx > a.monthIdx ? b : a));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [realMonthKeys.map((k) => `${k.year}::${k.monthIdx}`).join(','), urlYear]);

  const [year, setYear] = useState(urlYear ?? latestRealForYear?.year ?? DEFAULT_YEAR);
  const months = useMemo(() => generateMonthsForYear(year), [year]);
  const statusByLabel = useArchiveStatusByLabel(realLabels);
  const [monthIdx, setMonthIdx] = useState(
    urlMonthIdx ??
      latestRealForYear?.monthIdx ??
      months[months.length - 2]?.monthIdx ??
      months[months.length - 1]!.monthIdx,
  );
  const [channel, setChannel] = useState<WeeklyChannel>('ALL');
  // FX rate — synced with RFR Data pages via localStorage override.
  // Canonical magnitude (SRD §5.5): VND per 1 KRW = 17.543.
  const { rate: krwRate, override: krwOverride, setOverride: setKrwOverride } =
    useFxRateOverride(DEFAULT_VND_PER_KRW);

  // Try loading a real-data snapshot for the selected month + previous month
  // (for MoM deltas). Fall back to mock if current snapshot missing.
  const [snapshotMetrics, setSnapshotMetrics] = useState<PeriodSnapshotMetrics | null>(null);
  const [prevSnapshotMetrics, setPrevSnapshotMetrics] = useState<PeriodSnapshotMetrics | null>(null);
  const [snapshotLoading, setSnapshotLoading] = useState(false);
  const selectedMonth = months.find((m) => m.monthIdx === monthIdx);
  const prevMonth = useMemo(() => {
    if (!selectedMonth) return null;
    if (selectedMonth.monthIdx > 0) {
      // Same year — pick from `months` (regenerated for selected year)
      return months.find((m) => m.monthIdx === selectedMonth.monthIdx - 1) ?? null;
    }
    // Jan → Dec of prev year — generate that month entry
    const prevYearMonths = generateMonthsForYear(selectedMonth.year - 1);
    return prevYearMonths[11] ?? null;
  }, [selectedMonth, months]);

  useEffect(() => {
    if (!selectedMonth) {
      setSnapshotMetrics(null);
      setPrevSnapshotMetrics(null);
      return;
    }
    let cancelled = false;
    setSnapshotLoading(true);
    Promise.all([
      loadSnapshotAction({
        granularity: 'MONTHLY',
        monthIdx: selectedMonth.monthIdx,
        year: selectedMonth.year,
      }),
      prevMonth
        ? loadSnapshotAction({
            granularity: 'MONTHLY',
            monthIdx: prevMonth.monthIdx,
            year: prevMonth.year,
          })
        : Promise.resolve({ success: true as const, data: { metrics: null } }),
    ]).then(([cur, prv]) => {
      if (cancelled) return;
      setSnapshotLoading(false);
      setSnapshotMetrics(cur.success ? cur.data.metrics : null);
      setPrevSnapshotMetrics(prv.success ? prv.data.metrics : null);
    });
    return () => {
      cancelled = true;
    };
  }, [selectedMonth, prevMonth]);

  const snapshotReport: WeeklyReportData | null = useMemo(
    () =>
      snapshotMetrics
        ? snapshotToWeeklyReport(
            snapshotMetrics,
            channel,
            prevSnapshotMetrics,
            prevMonth?.label,
          )
        : null,
    [snapshotMetrics, prevSnapshotMetrics, channel, prevMonth],
  );
  // Placeholder when no snapshot — same metric structure with "—" values.
  // Mock monthly data removed per user spec.
  const placeholderReport: WeeklyReportData = useMemo(() => {
    const b = buildPlaceholderBreakdowns(channel);
    return {
      netGmv: 0,
      cm: 0,
      cmPct: 0,
      netGmvWow: null,
      cmWow: null,
      cmPctWow: null,
      overview: buildPlaceholderOverview(),
      discounts: b.discounts,
      promo: b.promo,
      traffic: b.traffic,
      sales: b.sales,
      ads: [],
      prevWeekLabel: '—',
    };
  }, [channel]);
  const report = snapshotReport ?? placeholderReport;
  const isRealData = snapshotReport != null;
  const products = useMemo<ProductMetric[]>(
    () => (snapshotMetrics ? snapshotToProducts(snapshotMetrics, channel) : []),
    [snapshotMetrics, channel],
  );

  const currentMonth = months.find((m) => m.monthIdx === monthIdx);
  const currentMonthLabel = currentMonth?.label ?? 'M' + monthIdx;

  const onDownload = async () => {
    const channelLabel =
      channel === 'ALL' ? 'Total Platform' : channel === 'SHOPEE' ? 'Shopee' : 'TikTok';
    await downloadReportXlsx({
      reportTitle: 'Monthly Report',
      currentLabel: currentMonthLabel,
      prevLabel: report.prevWeekLabel,
      deltaLabel: 'MoM%',
      channel,
      channelLabel,
      krwRate,
      report,
      products: channel === 'ALL' ? [] : products,
    });

    appendActionLog({
      username: 'dev@amoeba.group',
      userRole: 'OPERATOR',
      category: 'EXPORT',
      verb: 'EXPORT',
      targetType: 'monthly-report',
      targetLabel: `Monthly Report ${currentMonthLabel}`,
      summary: `Exported Monthly Report ${currentMonthLabel} (${channelLabel}) as xlsx`,
      metadata: {
        month: currentMonthLabel,
        channel,
        overviewRows: report.overview.length,
        productRows: channel === 'ALL' ? 0 : products.length,
      },
    });
  };

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-neutral-900">{t('title')}</h1>
          <p className="mt-1 text-sm text-neutral-500">{t('subtitle')}</p>
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
          title={isRealData ? t('badge.realDataTooltip') : t('badge.noDataTooltip')}
        >
          {snapshotLoading ? (
            <>
              <Cloud className="h-3 w-3 animate-pulse" /> {tW('badge.loading')}
            </>
          ) : isRealData ? (
            <>
              <Database className="h-3 w-3" /> {tW('badge.realData')}
            </>
          ) : (
            <>
              <Cloud className="h-3 w-3" /> {tW('badge.noData')}
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
              {tW(`channel.${opt.labelKey}`)}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <FxRateEditor rate={krwRate} override={krwOverride} onSet={setKrwOverride} />
          <button
            type="button"
            onClick={onDownload}
            className="inline-flex items-center gap-1.5 rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
          >
            <Download className="h-4 w-4" />
            {tW('export')}
          </button>
        </div>
      </div>

      <div>
        <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-neutral-500">
          {t('pickMonth')}
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
          deltaLabel={tW('table.mom')}
          channel={channel}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <BreakdownCard
          title={tW('section.discount')}
          accent="indigo"
          items={report.discounts}
          krwRate={krwRate}
          deltaLabel={tW('table.mom')}
          channel={channel}
        />
        <BreakdownCard
          title={tW('section.promotional')}
          accent="orange"
          items={report.promo}
          krwRate={krwRate}
          deltaLabel={tW('table.mom')}
          channel={channel}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <BreakdownCard
          title={channel === 'TIKTOK' ? tW('section.traffic') : tW('section.trafficAndAds')}
          accent="pink"
          items={report.traffic}
          krwRate={krwRate}
          deltaLabel={tW('table.mom')}
          channel={channel}
        />
        <BreakdownCard
          title={tW('section.sales')}
          accent="green"
          items={report.sales}
          krwRate={krwRate}
          deltaLabel={tW('table.mom')}
          channel={channel}
        />
      </div>

      {channel !== 'ALL' && (
        <WeeklyProductBreakdownTable products={products} krwRate={krwRate} />
      )}
    </div>
  );
}
