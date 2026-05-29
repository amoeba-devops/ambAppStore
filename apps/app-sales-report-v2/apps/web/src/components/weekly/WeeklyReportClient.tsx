'use client';

import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Download, Banknote, TrendingUp, Percent, Database, Cloud } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { cn } from '@v2/ui';
import {
  getAvailableWeeks,
  findCurrentWeekNum,
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
import { WeekPicker } from '@/components/shared/WeekPicker';
import { WeeklyOverviewTable } from './WeeklyOverviewTable';
import { WeeklyProductBreakdownTable } from './WeeklyProductBreakdownTable';
import { KpiCard } from './KpiCard';
import { BreakdownCard } from './BreakdownCard';
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

interface WeeklyReportClientProps {
  /** Reserved for future use (passed for parity with Monthly). Picker still shows all 53 weeks. */
  realWeekKeys?: Array<{ weekNum: number; year: number }>;
}

export function WeeklyReportClient({ realWeekKeys = [] }: WeeklyReportClientProps = {}) {
  const t = useTranslations('weeklyReport');
  const searchParams = useSearchParams();
  // Latest DB-backed week — used as the default so the user lands on a
  // populated week instead of the current calendar week (often empty).
  const latestRealWeek = useMemo(() => {
    if (realWeekKeys.length === 0) return null;
    return realWeekKeys.reduce((a, b) =>
      b.year > a.year || (b.year === a.year && b.weekNum > a.weekNum) ? b : a,
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [realWeekKeys.map((k) => `${k.year}::${k.weekNum}`).join(',')]);
  // Initial year selection — prefer ?year=N from URL, then latest real week's
  // year, finally current calendar year.
  const [year, setYear] = useState(() => {
    const fromUrl = Number(searchParams?.get('year'));
    if (Number.isFinite(fromUrl) && fromUrl > 2000 && fromUrl < 2100) return fromUrl;
    if (latestRealWeek) return latestRealWeek.year;
    return new Date().getFullYear();
  });
  // Weeks regenerate when year changes.
  const weeks = useMemo(() => getAvailableWeeks(year), [year]);
  // Year-aware status overrides: only labels of weeks whose snapshot belongs to
  // the currently-displayed year. Without the year filter, an override on
  // W20/2026 would bleed into W20/2027 (both have label "W20").
  const realLabels = useMemo(
    () => realWeekKeys.filter((k) => k.year === year).map((k) => `W${k.weekNum}`),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [year, realWeekKeys.map((k) => `${k.year}::${k.weekNum}`).join(',')],
  );
  const statusByLabel = useArchiveStatusByLabel(realLabels);
  // Initial week selection — prefer ?weekNum=N from URL (deep-link after ingest),
  // then the most recent week with data IF year matches, finally the current
  // calendar week within the displayed year.
  const [weekNum, setWeekNum] = useState(() => {
    const fromUrl = Number(searchParams?.get('weekNum'));
    if (Number.isFinite(fromUrl) && fromUrl > 0 && fromUrl <= 53) return fromUrl;
    if (latestRealWeek && latestRealWeek.year === year) return latestRealWeek.weekNum;
    return findCurrentWeekNum(weeks);
  });
  // When year changes via picker, clamp weekNum to a valid value in new year.
  useEffect(() => {
    if (!weeks.some((w) => w.weekNum === weekNum)) {
      setWeekNum(weeks[0]?.weekNum ?? 1);
    }
  }, [weeks, weekNum]);
  const [channel, setChannel] = useState<WeeklyChannel>('ALL');
  // FX rate — synced with RFR Data pages via localStorage override.
  // Canonical magnitude (SRD §5.5): VND per 1 KRW = 17.543.
  const { rate: krwRate, override: krwOverride, setOverride: setKrwOverride } =
    useFxRateOverride(DEFAULT_VND_PER_KRW);

  // Try loading a real-data snapshot for the selected week + the previous
  // week (for WoW deltas). Fall back to mock if current snapshot missing.
  const [snapshotMetrics, setSnapshotMetrics] = useState<PeriodSnapshotMetrics | null>(null);
  const [prevSnapshotMetrics, setPrevSnapshotMetrics] = useState<PeriodSnapshotMetrics | null>(null);
  const [snapshotLoading, setSnapshotLoading] = useState(false);
  const selectedWeek = weeks.find((w) => w.weekNum === weekNum);
  const prevWeek = useMemo(() => {
    if (!selectedWeek) return null;
    // Same-year prev week first; if weekNum === 1, generate prev year's weeks
    // and pick its last entry (year boundary — current `weeks` only covers
    // the displayed year so we can't filter from it).
    const sameYear = weeks.find(
      (w) => w.year === selectedWeek.year && w.weekNum === selectedWeek.weekNum - 1,
    );
    if (sameYear) return sameYear;
    const prevYearWeeks = getAvailableWeeks(selectedWeek.year - 1);
    return prevYearWeeks[prevYearWeeks.length - 1] ?? null;
  }, [selectedWeek, weeks]);

  useEffect(() => {
    if (!selectedWeek) {
      setSnapshotMetrics(null);
      setPrevSnapshotMetrics(null);
      return;
    }
    let cancelled = false;
    setSnapshotLoading(true);
    Promise.all([
      loadSnapshotAction({
        granularity: 'WEEKLY',
        weekNum: selectedWeek.weekNum,
        year: selectedWeek.year,
      }),
      prevWeek
        ? loadSnapshotAction({
            granularity: 'WEEKLY',
            weekNum: prevWeek.weekNum,
            year: prevWeek.year,
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
  }, [selectedWeek, prevWeek]);

  const snapshotReport: WeeklyReportData | null = useMemo(
    () =>
      snapshotMetrics
        ? snapshotToWeeklyReport(
            snapshotMetrics,
            channel,
            prevSnapshotMetrics,
            prevWeek ? `W${prevWeek.weekNum}` : undefined,
          )
        : null,
    [snapshotMetrics, prevSnapshotMetrics, channel, prevWeek],
  );
  // Placeholder report when no snapshot — same metric structure with "—" values.
  // Mock weekly data removed per user spec.
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

  const currentWeekLabel = `W${weekNum}`;

  const onDownload = async () => {
    const channelLabel =
      channel === 'ALL' ? 'Total Platform' : channel === 'SHOPEE' ? 'Shopee' : 'TikTok';
    await downloadReportXlsx({
      reportTitle: 'Weekly Report',
      currentLabel: currentWeekLabel,
      prevLabel: report.prevWeekLabel,
      deltaLabel: 'WoW%',
      channel,
      channelLabel,
      krwRate,
      report,
      // Product Breakdown only renders in the UI for SHOPEE / TIKTOK — pass
      // the same list to the xlsx so Total Platform skips the 2nd sheet too.
      products: channel === 'ALL' ? [] : products,
    });

    appendActionLog({
      username: 'dev@amoeba.group',
      userRole: 'OPERATOR',
      category: 'EXPORT',
      verb: 'EXPORT',
      targetType: 'weekly-report',
      targetLabel: `Weekly Report ${currentWeekLabel}`,
      summary: `Exported Weekly Report ${currentWeekLabel} (${channelLabel}) as xlsx`,
      metadata: {
        week: currentWeekLabel,
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
              <Cloud className="h-3 w-3 animate-pulse" /> {t('badge.loading')}
            </>
          ) : isRealData ? (
            <>
              <Database className="h-3 w-3" /> {t('badge.realData')}
            </>
          ) : (
            <>
              <Cloud className="h-3 w-3" /> {t('badge.noData')}
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
              {t(`channel.${opt.labelKey}`)}
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
            {t('export')}
          </button>
        </div>
      </div>

      <div>
        <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-neutral-500">
          {t('pickWeek')}
        </div>
        <WeekPicker
          weeks={weeks}
          selectedWeekNum={weekNum}
          statusByLabel={statusByLabel}
          allowClickLocked
          year={year}
          onYearChange={setYear}
          onPickWeek={(w) => setWeekNum(w.weekNum)}
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
          currentWeekLabel={currentWeekLabel}
          krwRate={krwRate}
          channel={channel}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <BreakdownCard title={t('section.discount')} accent="indigo" items={report.discounts} krwRate={krwRate} channel={channel} />
        <BreakdownCard title={t('section.promotional')} accent="orange" items={report.promo} krwRate={krwRate} channel={channel} />
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <BreakdownCard
          title={channel === 'TIKTOK' ? t('section.traffic') : t('section.trafficAndAds')}
          accent="pink"
          items={report.traffic}
          krwRate={krwRate}
          channel={channel}
        />
        <BreakdownCard title={t('section.sales')} accent="green" items={report.sales} krwRate={krwRate} channel={channel} />
      </div>

      {channel !== 'ALL' && (
        <WeeklyProductBreakdownTable products={products} krwRate={krwRate} />
      )}
    </div>
  );
}

