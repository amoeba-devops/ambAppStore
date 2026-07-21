import { getLocale, getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { Plus } from 'lucide-react';
import {
  Card,
  DonutChart,
  StackedBarChart,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@car-v2/ui';
import { computeTruckPnl } from '@car-v2/core/truck';
import type { CarVehicleStatus } from '@car-v2/db/schema';
import { TRUCK_REGIONS } from '@car-v2/shared/zod';
import { ClickableTableRow } from '@/components/clickable-table-row';
import { ParamSelect } from '@/components/inputs/param-select';
import { PageHeader } from '@/components/layout/page-header';
import { ReportStatusBadge } from '@/components/truck/report-status-badge';
import { getCurrentUser } from '@/lib/auth/get-current-user';
import { getTruckReportStatus, type TruckReportStatus } from '@/server/queries/truck-report.queries';
import { listTruckTrips } from '@/server/queries/truck-trips.queries';
import { listVehicles } from '@/server/queries/vehicles.queries';
import { Info } from 'lucide-react';
import { PeriodPicker } from './_components/period-picker';
import { isPeriodPreset, type PeriodPreset } from './_components/period-presets';

function bcp47(locale: string): string {
  if (locale === 'vi') return 'vi-VN';
  if (locale === 'ko') return 'ko-KR';
  return 'en-US';
}

const ym = (y: number, m: number): string =>
  new Date(Date.UTC(y, m, 1)).toISOString().slice(0, 7);

/** First instant of the month AFTER `month` ('YYYY-MM') — exclusive range end. */
function monthEndExclusive(month: string): Date {
  const start = new Date(`${month}-01T00:00:00Z`);
  return new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 1));
}

function lastNMonths(n: number): string[] {
  const now = new Date();
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth();
  const out: string[] = [];
  for (let i = n - 1; i >= 0; i--) out.push(ym(y, m - i));
  return out;
}

/** N months ending at `endYm` inclusive (oldest first). */
function monthsEnding(n: number, endYm: string): string[] {
  const d = new Date(`${endYm}-01T00:00:00Z`);
  const out: string[] = [];
  for (let i = n - 1; i >= 0; i--) out.push(ym(d.getUTCFullYear(), d.getUTCMonth() - i));
  return out;
}

/** Month list for a period preset (newest last). */
function monthsForPreset(p: PeriodPreset): string[] {
  const now = new Date();
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth();
  switch (p) {
    case 'last3':
      return lastNMonths(3);
    case 'last6':
      return lastNMonths(6);
    case 'ytd': {
      const out: string[] = [];
      for (let i = 0; i <= m; i++) out.push(ym(y, i));
      return out;
    }
    case 'all':
      return lastNMonths(12);
    default:
      return [ym(y, m)]; // thisMonth
  }
}


const YM = /^\d{4}-\d{2}$/;

/** All 'YYYY-MM' months a custom [from,to] month range spans (capped at 24). */
function monthsBetween(fromYm: string, toYm: string): string[] {
  let y = Number(fromYm.slice(0, 4));
  let m = Number(fromYm.slice(5, 7));
  const ty = Number(toYm.slice(0, 4));
  const tm = Number(toYm.slice(5, 7));
  const out: string[] = [];
  while ((y < ty || (y === ty && m <= tm)) && out.length < 24) {
    out.push(`${y}-${String(m).padStart(2, '0')}`);
    m += 1;
    if (m > 12) { m = 1; y += 1; }
  }
  return out;
}

/** The same number of months immediately before `months` — basis for the
 * KPI delta ("so kỳ trước"). */
function prevMonths(months: string[]): string[] {
  if (months.length === 0) return [];
  const first = months[0]!;
  const d = new Date(`${first}-01T00:00:00Z`);
  const out: string[] = [];
  for (let i = months.length; i >= 1; i--) out.push(ym(d.getUTCFullYear(), d.getUTCMonth() - i));
  return out;
}

/** % change vs previous period; null when previous ≤ 0 (delta meaningless). */
function pctDelta(curr: number, prev: number): number | null {
  if (prev <= 0) return null;
  return Math.round(((curr - prev) / prev) * 100);
}

export default async function TruckDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string; from?: string; to?: string; region?: string; vehicle?: string }>;
}) {
  const user = await getCurrentUser();
  const sp = await searchParams;
  const region =
    sp.region && (TRUCK_REGIONS as readonly string[]).includes(sp.region) ? sp.region : undefined;
  /* Custom month/year range (?from=&to= in YYYY-MM) takes precedence over a
   * preset; falls back to `thisMonth` when neither is a valid range. */
  const customFrom = sp.from && YM.test(sp.from) ? sp.from : undefined;
  const customTo = sp.to && YM.test(sp.to) ? sp.to : undefined;
  const isCustom = !!(customFrom && customTo && customFrom <= customTo);
  const preset: PeriodPreset | null = isCustom
    ? null
    : isPeriodPreset(sp.period)
      ? sp.period
      : 'thisMonth';

  const t = await getTranslations('screens.truckDashboard');
  const tPeriod = await getTranslations('screens.truckDashboard.period');
  const tPnl = await getTranslations('screens.truckPnl');
  const tTrips = await getTranslations('screens.truckTrips');
  const tNav = await getTranslations('nav');
  const tCo = await getTranslations('company');
  const tStatus = await getTranslations('vehicles.status');
  const tRegion = await getTranslations('region');
  const locale = await getLocale();
  const loc = bcp47(locale);

  const monthYear = (m: string) =>
    new Date(`${m}-01T00:00:00Z`).toLocaleDateString(loc, { month: 'short', year: 'numeric' });
  const kpiMonths = isCustom ? monthsBetween(customFrom!, customTo!) : monthsForPreset(preset!);
  /* Trend chart shows the SELECTED period's months (it used to be pinned to
   * the last 6 months from today, so YTD / a past custom range changed the
   * KPIs but not the chart). A single-month selection would render one lonely
   * bar, so it widens to the 6 months ENDING at that month — still anchored
   * to the selection, never to "today". */
  const trendMonths =
    kpiMonths.length >= 2 ? kpiMonths : monthsEnding(6, kpiMonths[kpiMonths.length - 1]!);
  const periodLabel = isCustom
    ? `${monthYear(customFrom!)} – ${monthYear(customTo!)}`
    : tPeriod(preset!);

  const trucks = await listVehicles(user.entId, 'active', 'TRUCK');
  /* Vehicle is a step-2 filter under region (Sheet-2 D1): the dropdown lists
   * only the chosen region's trucks, and the filter is honoured only when a
   * region is active and the vehicle belongs to it. */
  const regionTrucks = region ? trucks.filter((v) => v.cvhRegion === region) : [];
  const vehicleId =
    region && sp.vehicle && regionTrucks.some((v) => v.cvhId === sp.vehicle) ? sp.vehicle : undefined;

  /* KPI comparison basis: YTD compares with the SAME months of last year
   * ("so cùng kỳ năm trước" — comparing Jan..Jul against last Jun..Dec is
   * meaningless); every other selection compares with the equal-length
   * window immediately before it. */
  const isYoy = preset === 'ytd';
  const prevPeriodMonths = isYoy
    ? kpiMonths.map((m) => `${Number(m.slice(0, 4)) - 1}${m.slice(4)}`)
    : prevMonths(kpiMonths);

  const [kpiRows, prevRows, trendRows, allTrips, regionRowsRaw] = await Promise.all([
    computeTruckPnl(user, { months: kpiMonths, region, vehicleId }),
    computeTruckPnl(user, { months: prevPeriodMonths, region, vehicleId }),
    computeTruckPnl(user, { months: trendMonths, region, vehicleId }),
    listTruckTrips(user.entId, { region, vehicleId }),
    /* Per-region breakdown over the selected period (always all regions, even
     * when filtered — so the breakdown stays a comparison). Report status is
     * only meaningful for a single-month period (a range can't map to one
     * generation event), so it's only fetched then. */
    Promise.all(
      TRUCK_REGIONS.map(async (r) => {
        const [rows, status] = await Promise.all([
          computeTruckPnl(user, { months: kpiMonths, region: r }),
          kpiMonths.length === 1 ? getTruckReportStatus(user.entId, kpiMonths[0]!, r) : Promise.resolve(null),
        ]);
        const acc = rows.reduce(
          (a, x) => ({
            revenue: a.revenue + x.revenue,
            netProfit: a.netProfit + x.netProfit,
            tripCount: a.tripCount + x.tripCount,
          }),
          { revenue: 0, netProfit: 0, tripCount: 0 },
        );
        return { region: r, ...acc, status: status as TruckReportStatus | null };
      }),
    ),
  ]);
  const regionRows = regionRowsRaw;
  const showReportStatus = kpiMonths.length === 1;

  /* Sum the per-month rows across the selected period. driverSalary is part of
   * fixedCost, so it must be carried too — otherwise the fixed-cost breakdown
   * (CostSplit rows / donut slices) wouldn't add up to the totals shown. */
  const acc = kpiRows.reduce(
    (a, r) => ({
      revenue: a.revenue + r.revenue,
      variableCost: a.variableCost + r.variableCost,
      fixedCost: a.fixedCost + r.fixedCost,
      netProfit: a.netProfit + r.netProfit,
      tripCount: a.tripCount + r.tripCount,
      fuelCost: a.fuelCost + r.fuelCost,
      tollFee: a.tollFee + r.tollFee,
      extraTotal: a.extraTotal + r.extraTotal,
      salary: a.salary + r.salary,
      depreciation: a.depreciation + r.depreciation,
      insurance: a.insurance + r.insurance,
      driverSalary: a.driverSalary + r.driverSalary,
    }),
    { revenue: 0, variableCost: 0, fixedCost: 0, netProfit: 0, tripCount: 0, fuelCost: 0, tollFee: 0, extraTotal: 0, salary: 0, depreciation: 0, insurance: 0, driverSalary: 0 },
  );
  const totalCost = acc.variableCost + acc.fixedCost;
  /* Recent trips honour the same period window as the KPIs (kpiMonths is
   * contiguous, so its first/last months bound the range); region/vehicle are
   * already applied by the query. */
  const recentStart = new Date(`${kpiMonths[0]}-01T00:00:00Z`);
  const recentEnd = monthEndExclusive(kpiMonths[kpiMonths.length - 1]!);
  const recent = allTrips
    .filter((tr) => tr.scheduledAt >= recentStart && tr.scheduledAt < recentEnd)
    .slice(0, 5);

  /* KPI delta vs the same number of months immediately before the selection. */
  const prevAcc = prevRows.reduce(
    (a, r) => ({ revenue: a.revenue + r.revenue, netProfit: a.netProfit + r.netProfit }),
    { revenue: 0, netProfit: 0 },
  );
  const billingDelta = pctDelta(acc.revenue, prevAcc.revenue);
  const profitDelta = pctDelta(acc.netProfit, prevAcc.netProfit);

  const variablePct = totalCost > 0 ? Math.round((acc.variableCost / totalCost) * 100) : 0;
  const fixedPct = totalCost > 0 ? 100 - variablePct : 0;

  const vnd = (n: number) => n.toLocaleString(loc) + ' ₫';
  /* Compact money for narrow mobile cells/cards — a full "150.000.000 ₫"
   * overflows a 2-col KPI card (~132px) at the desktop font size, so on mobile
   * we render "150 tr" / "1,2 tỷ" instead. Desktop keeps the exact figure. */
  const vndCompact = (n: number) => {
    const a = Math.abs(n);
    if (a >= 1e9) return (n / 1e9).toLocaleString(loc, { maximumFractionDigits: 1 }) + ' tỷ';
    if (a >= 1e6) return (n / 1e6).toLocaleString(loc, { maximumFractionDigits: 0 }) + ' tr';
    return n.toLocaleString(loc) + ' ₫';
  };
  const date = (d: Date) => new Date(d).toLocaleDateString(loc);
  const monthShort = (m: string) =>
    new Date(`${m}-01T00:00:00Z`).toLocaleDateString(loc, { month: 'short' });

  const barData = trendRows.map((r) => ({
    month: monthShort(r.month),
    revenue: Math.round((r.revenue / 1e6) * 10) / 10,
    profit: Math.round((r.netProfit / 1e6) * 10) / 10,
  }));
  const barSeries = [
    { key: 'revenue', name: tPnl('revenue'), color: 'hsl(var(--c1))' },
    { key: 'profit', name: tPnl('netProfit'), color: 'hsl(var(--c7))' },
  ];

  /* Every component of totalCost must appear as a slice — the donut's center
   * shows totalCost, so a missing slice (driverSalary was absent before) makes
   * the center disagree with the visible parts. */
  const donut = [
    { name: tPnl('fuel'), value: acc.fuelCost, color: 'hsl(var(--c1))' },
    { name: tPnl('toll'), value: acc.tollFee, color: 'hsl(var(--c7))' },
    { name: tPnl('other'), value: acc.extraTotal, color: 'hsl(var(--c3))' },
    { name: tPnl('salary'), value: acc.salary, color: 'hsl(var(--c2))' },
    { name: tPnl('depreciation'), value: acc.depreciation, color: 'hsl(var(--c4))' },
    { name: tPnl('insurance'), value: acc.insurance, color: 'hsl(var(--c6))' },
    { name: tPnl('driverSalary'), value: acc.driverSalary, color: 'hsl(var(--c5))' },
  ].filter((d) => d.value > 0);

  const statusOrder: CarVehicleStatus[] = ['AVAILABLE', 'IN_USE', 'MAINTENANCE', 'RETIRED'];
  /* Fleet status follows the region filter (the whole page is region-scoped
   * when one is active); the vehicle filter is intentionally NOT applied —
   * a one-truck status list carries no information. */
  const statusTrucks = region ? regionTrucks : trucks;
  const statusCounts = statusOrder.map((s) => ({ status: s, n: statusTrucks.filter((v) => v.cvhStatus === s).length }));
  const statusTone: Record<CarVehicleStatus, string> = {
    AVAILABLE: 'bg-success',
    IN_USE: 'bg-info',
    MAINTENANCE: 'bg-warning',
    RETIRED: 'bg-text-faint',
  };

  /* Region filter links — preserve the active period, toggle the region param. */
  const regionHref = (r?: string) => {
    const p = new URLSearchParams();
    if (isCustom) {
      p.set('from', customFrom!);
      p.set('to', customTo!);
    } else if (preset && preset !== 'thisMonth') {
      p.set('period', preset);
    }
    if (r) p.set('region', r);
    const qs = p.toString();
    return `/truck/dashboard${qs ? `?${qs}` : ''}`;
  };
  const pillCls = (active: boolean) =>
    'inline-flex items-center min-h-[44px] md:min-h-0 rounded-full px-3 py-1 text-xs font-semibold border transition-colors ' +
    (active
      ? 'bg-accent text-accent-fg border-accent'
      : 'border-border text-text-muted hover:border-accent hover:text-accent');

  return (
    <>
      <PageHeader
        title={t('title')}
        subtitle={periodLabel}
        breadcrumbs={[{ label: tCo('tenant') }, { label: tNav('truckDashboard') }]}
        actions={
          <div className="flex items-center gap-2">
            <div className="hidden sm:block">
              <PeriodPicker label={periodLabel} currentPreset={preset} from={customFrom} to={customTo} />
            </div>
            <Link
              href="/truck/trips/new"
              className="inline-flex items-center gap-1.5 rounded-md bg-accent text-accent-fg px-3 py-2 text-sm font-semibold hover:opacity-90"
            >
              <Plus className="h-4 w-4" />
              {tTrips('addTrip')}
            </Link>
          </div>
        }
      />

      <div className="flex-1 overflow-auto px-4 md:px-7 py-4 md:py-6 space-y-5">
        {/* Period selector — own row on mobile (hidden in header there). */}
        <div className="sm:hidden">
          <PeriodPicker label={periodLabel} currentPreset={preset} from={customFrom} to={customTo} />
        </div>

        {/* Region filter (REQ-20260630) — preserves the active period. */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="mr-1 text-xs font-medium uppercase tracking-wide text-text-faint">{t('byRegion')}</span>
          <Link href={regionHref()} className={pillCls(!region)}>
            {t('regionAll')}
          </Link>
          {TRUCK_REGIONS.map((r) => (
            <Link key={r} href={regionHref(r)} className={pillCls(region === r)}>
              {tRegion(r)}
            </Link>
          ))}
        </div>

        {/* Vehicle filter — step 2 after a region is chosen (Sheet-2 D1);
         * lists only that region's trucks. */}
        {region && regionTrucks.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="mr-1 text-xs font-medium uppercase tracking-wide text-text-faint">{t('byVehicle')}</span>
            <ParamSelect
              param="vehicle"
              value={vehicleId}
              allLabel={t('allVehicles')}
              options={regionTrucks.map((v) => ({ value: v.cvhId, label: v.cvhPlateNumber }))}
            />
          </div>
        )}

        {/* Disclaimer note (QA P2 item 4) */}
        <div className="flex items-start gap-2 rounded-md border border-border bg-surface-2/50 px-3 py-2.5">
          <Info className="h-4 w-4 shrink-0 text-text-faint mt-0.5" />
          <p className="text-xs text-text-muted leading-relaxed">{t('disclaimer')}</p>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <Kpi label={t('kpiRevenue')} value={vnd(acc.revenue)} valueMobile={vndCompact(acc.revenue)} delta={billingDelta} vsPrev={t(isYoy ? 'vsPrevYoy' : 'vsPrev')} tooltip={t('tooltipRevenue')} />
          <Kpi label={t('kpiCost')} value={vnd(totalCost)} valueMobile={vndCompact(totalCost)} subtitle={t('kpiCostSub')} tooltip={t('tooltipCost')} />
          <Kpi
            label={t('kpiProfit')}
            value={vnd(acc.netProfit)}
            valueMobile={vndCompact(acc.netProfit)}
            tone={acc.netProfit >= 0 ? 'success' : 'danger'}
            delta={profitDelta}
            vsPrev={t(isYoy ? 'vsPrevYoy' : 'vsPrev')}
            tooltip={t('tooltipProfit')}
          />
          <Kpi label={t('kpiTrips')} value={acc.tripCount.toLocaleString(loc)} subtitle={t('kpiTripsSub')} />
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-[1.4fr_1fr] gap-4">
          <Card className="p-4">
            <h2 className="text-sm font-semibold text-text mb-3">{t('chartProfit')}</h2>
            <StackedBarChart data={barData} xKey="month" series={barSeries} height={220} valueSuffix="M" valuePrecision={1} stacked={false} />
          </Card>
          <Card className="p-4">
            <h2 className="text-sm font-semibold text-text mb-3">{t('costStructure')}</h2>
            {donut.length === 0 ? (
              <div className="h-[180px] flex items-center justify-center text-sm text-text-muted">{t('noData')}</div>
            ) : (
              <div className="flex items-center gap-4">
                <DonutChart data={donut} centerValue={vnd(totalCost)} />
                <ul className="flex-1 space-y-1.5 text-xs">
                  {donut.map((d) => (
                    <li key={d.name} className="flex items-center justify-between gap-2">
                      <span className="inline-flex items-center gap-1.5 text-text-muted">
                        <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: d.color }} />
                        {d.name}
                      </span>
                      <span className="tabular text-text">{vnd(d.value)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </Card>
        </div>

        {/* Cost split — variable (per trip) vs fixed (per month), design IA */}
        <div className="grid gap-3 sm:grid-cols-2">
          <CostSplit
            tone="variable"
            title={tPnl('variable')}
            sub={`${variablePct}% · ${t('perTrip')}`}
            total={vnd(acc.variableCost)}
            rows={[
              [tPnl('fuel'), vnd(acc.fuelCost)],
              [tPnl('toll'), vnd(acc.tollFee)],
              [tPnl('other'), vnd(acc.extraTotal)],
            ]}
          />
          <CostSplit
            tone="fixed"
            title={tPnl('fixed')}
            sub={`${fixedPct}% · ${t('perMonth')}`}
            total={vnd(acc.fixedCost)}
            rows={[
              /* All four components of fixedCost, so the rows sum to the total
               * (salary + driverSalary were missing before — the card looked
               * like it showed a bigger total than its parts). */
              [tPnl('salary'), vnd(acc.salary)],
              [tPnl('depreciation'), vnd(acc.depreciation)],
              [tPnl('insurance'), vnd(acc.insurance)],
              [tPnl('driverSalary'), vnd(acc.driverSalary)],
            ]}
          />
        </div>

        {/* Per-region breakdown (REQ-20260630) — comparison across all regions. */}
        <Card variant="outline">
          <div className="px-4 py-3 border-b border-border">
            <h2 className="text-sm font-semibold text-text">{t('byRegion')}</h2>
          </div>
          {/* Mobile: compact per-region cards. Full VND across 4 columns would
           * force a horizontal scroll on a phone, so money is abbreviated. */}
          <ul className="md:hidden divide-y divide-border">
            {regionRows.map((rr) => (
              <li key={rr.region} className={'px-4 py-3 ' + (region === rr.region ? 'bg-accent-soft/40' : '')}>
                <div className="font-medium text-text">{tRegion(rr.region)}</div>
                <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-text-muted">
                  <span>{tPnl('revenue')}: <span className="tabular text-text">{vndCompact(rr.revenue)}</span></span>
                  <span>{t('kpiTrips')}: <span className="tabular text-text">{rr.tripCount.toLocaleString(loc)}</span></span>
                  <span className={'tabular font-semibold ' + (rr.netProfit >= 0 ? 'text-success' : 'text-danger')}>
                    {tPnl('netProfit')}: {vndCompact(rr.netProfit)}
                  </span>
                </div>
                {rr.status && (
                  <div className="mt-1.5">
                    <ReportStatusBadge reportedAt={rr.status.reportedAt} stale={rr.status.stale} locale={locale} />
                  </div>
                )}
              </li>
            ))}
          </ul>
          <div className="hidden md:block overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('thRegionCol')}</TableHead>
                  <TableHead className="text-right">{tPnl('revenue')}</TableHead>
                  <TableHead className="text-right">{tPnl('netProfit')}</TableHead>
                  <TableHead className="text-right">{t('kpiTrips')}</TableHead>
                  {showReportStatus && <TableHead>{t('thReportStatus')}</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {regionRows.map((rr) => (
                  <TableRow key={rr.region} className={region === rr.region ? 'bg-accent-soft/40' : undefined}>
                    <TableCell className="font-medium text-text">{tRegion(rr.region)}</TableCell>
                    <TableCell className="text-right tabular text-text-muted">{vnd(rr.revenue)}</TableCell>
                    <TableCell
                      className={'text-right tabular font-semibold ' + (rr.netProfit >= 0 ? 'text-success' : 'text-danger')}
                    >
                      {vnd(rr.netProfit)}
                    </TableCell>
                    <TableCell className="text-right tabular">{rr.tripCount.toLocaleString(loc)}</TableCell>
                    {showReportStatus && (
                      <TableCell>
                        {rr.status && (
                          <ReportStatusBadge reportedAt={rr.status.reportedAt} stale={rr.status.stale} locale={locale} />
                        )}
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </Card>

        {/* Fleet status + recent */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.4fr] gap-4">
          <Card className="p-4">
            <h2 className="text-sm font-semibold text-text mb-3">{t('fleetStatus')}</h2>
            <ul className="space-y-2">
              {statusCounts.map((s) => (
                <li key={s.status} className="flex items-center justify-between text-sm">
                  <span className="inline-flex items-center gap-2 text-text-muted">
                    <span className={'h-2.5 w-2.5 rounded-full ' + statusTone[s.status]} />
                    {tStatus(s.status)}
                  </span>
                  <span className="tabular font-semibold text-text">{s.n}</span>
                </li>
              ))}
            </ul>
          </Card>

          <Card variant="outline">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
              <h2 className="text-sm font-semibold text-text">{t('recentTitle')}</h2>
              <Link
                href="/truck/trips"
                className="inline-flex items-center min-h-[44px] -my-2 -mr-2 px-2 rounded text-xs font-semibold text-accent active:bg-accent-soft md:min-h-0 md:my-0 md:mr-0 md:px-0 md:hover:underline"
              >
                {t('viewAll')}
              </Link>
            </div>
            {recent.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-text-muted">{tTrips('emptyTitle')}</div>
            ) : (
              <>
              {/* Mobile: compact trip rows instead of a 4-column table. */}
              <ul className="md:hidden divide-y divide-border">
                {recent.map((trip) => (
                  <li key={trip.trpId}>
                    <Link
                      href={`/truck/trips/${trip.trpId}`}
                      className="flex items-center justify-between gap-3 px-4 py-3 active:bg-surface-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
                    >
                      <div className="min-w-0">
                        <div className="text-sm text-text truncate">{trip.customer ?? '—'}</div>
                        <div className="text-xs text-text-faint tabular">
                          {date(trip.scheduledAt)} · <span className="font-mono">{trip.ref}</span>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="text-sm tabular text-text">{vndCompact(trip.breakdown.revenue)}</div>
                        <div className="text-xs tabular text-text-faint">
                          {vndCompact(trip.breakdown.fuelCost + trip.breakdown.tollFee + trip.breakdown.extraTotal)}
                        </div>
                        <div className={'text-xs tabular font-semibold ' + (trip.breakdown.profit >= 0 ? 'text-success' : 'text-danger')}>
                          {vndCompact(trip.breakdown.profit)}
                        </div>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
              <div className="hidden md:block overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{tTrips('thDate')}</TableHead>
                      <TableHead>{tTrips('thCustomer')}</TableHead>
                      <TableHead className="text-right">{t('thCost')}</TableHead>
                      <TableHead className="text-right">{tTrips('thRevenue')}</TableHead>
                      <TableHead className="text-right">{tTrips('thProfit')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {recent.map((trip) => {
                      const tripCost = trip.breakdown.fuelCost + trip.breakdown.tollFee + trip.breakdown.extraTotal;
                      return (
                      <ClickableTableRow key={trip.trpId} href={`/truck/trips/${trip.trpId}`}>
                        <TableCell className="whitespace-nowrap">
                          <div className="text-text">{date(trip.scheduledAt)}</div>
                          <div className="text-xs text-text-faint font-mono">{trip.ref}</div>
                        </TableCell>
                        <TableCell className="text-text">{trip.customer ?? '—'}</TableCell>
                        <TableCell className="text-right tabular text-text-muted">{vnd(tripCost)}</TableCell>
                        <TableCell className="text-right tabular">{vnd(trip.breakdown.revenue)}</TableCell>
                        <TableCell
                          className={
                            'text-right tabular font-semibold ' +
                            (trip.breakdown.profit >= 0 ? 'text-success' : 'text-danger')
                          }
                        >
                          {vnd(trip.breakdown.profit)}
                        </TableCell>
                      </ClickableTableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
              </>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}

function Kpi({
  label,
  value,
  valueMobile,
  tone,
  subtitle,
  delta,
  vsPrev,
  tooltip,
}: {
  label: string;
  value: string;
  valueMobile?: string;
  tone?: 'success' | 'danger';
  subtitle?: string;
  delta?: number | null;
  vsPrev?: string;
  tooltip?: string;
}) {
  return (
    <Card className="px-4 py-3">
      <div className="flex items-center gap-1 text-xs font-medium uppercase tracking-wide text-text-muted mb-1.5">
        {label}
        {tooltip && (
          <span className="relative group cursor-help">
            <Info className="h-3.5 w-3.5 text-text-faint" />
            <span className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 w-60 rounded-md border border-border bg-surface px-3 py-2 text-xs font-normal normal-case tracking-normal text-text shadow-lg opacity-0 group-hover:opacity-100 transition-opacity z-40 whitespace-pre-line">
              {tooltip}
            </span>
          </span>
        )}
      </div>
      <div
        className={
          'text-xl md:text-2xl font-bold tabular leading-none whitespace-nowrap ' +
          (tone === 'success' ? 'text-success' : tone === 'danger' ? 'text-danger' : 'text-text')
        }
      >
        {valueMobile ? (
          <>
            <span className="sm:hidden">{valueMobile}</span>
            <span className="hidden sm:inline">{value}</span>
          </>
        ) : (
          value
        )}
      </div>
      {delta != null && (
        <div className={'mt-1 text-xs font-semibold tabular ' + (delta >= 0 ? 'text-success' : 'text-danger')}>
          {delta >= 0 ? '▲' : '▼'} {Math.abs(delta)}%{' '}
          {vsPrev && <span className="font-normal text-text-faint">{vsPrev}</span>}
        </div>
      )}
      {subtitle && <div className="mt-1 text-[11px] leading-tight text-text-faint">{subtitle}</div>}
    </Card>
  );
}

function CostSplit({
  tone,
  title,
  sub,
  total,
  rows,
}: {
  tone: 'variable' | 'fixed';
  title: string;
  sub: string;
  total: string;
  rows: [string, string][];
}) {
  return (
    <Card className="p-4 space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className={'h-2.5 w-2.5 rounded-sm ' + (tone === 'variable' ? 'bg-accent' : 'bg-text-muted')} />
          <span className="text-sm font-semibold text-text">{title}</span>
        </div>
        <span className="text-xs text-text-faint">{sub}</span>
      </div>
      <div className="text-lg font-bold tabular text-text">{total}</div>
      <ul className="space-y-1 border-t border-border pt-2">
        {rows.map(([k, v]) => (
          <li key={k} className="flex justify-between text-sm">
            <span className="text-text-muted">{k}</span>
            <span className="tabular text-text">{v}</span>
          </li>
        ))}
      </ul>
    </Card>
  );
}

