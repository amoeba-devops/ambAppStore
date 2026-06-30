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
import { PageHeader } from '@/components/layout/page-header';
import { getCurrentUser } from '@/lib/auth/get-current-user';
import { listTruckTrips } from '@/server/queries/truck-trips.queries';
import { listVehicles } from '@/server/queries/vehicles.queries';
import { PeriodPicker } from './_components/period-picker';
import { isPeriodPreset, type PeriodPreset } from './_components/period-presets';

function bcp47(locale: string): string {
  if (locale === 'vi') return 'vi-VN';
  if (locale === 'ko') return 'ko-KR';
  return 'en-US';
}

const ym = (y: number, m: number): string =>
  new Date(Date.UTC(y, m, 1)).toISOString().slice(0, 7);

function lastNMonths(n: number): string[] {
  const now = new Date();
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth();
  const out: string[] = [];
  for (let i = n - 1; i >= 0; i--) out.push(ym(y, m - i));
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

const YMD = /^\d{4}-\d{2}-\d{2}$/;

/** All 'YYYY-MM' months a custom [from,to] date range spans (capped at 24). */
function monthsBetween(fromYmd: string, toYmd: string): string[] {
  let y = Number(fromYmd.slice(0, 4));
  let m = Number(fromYmd.slice(5, 7));
  const ty = Number(toYmd.slice(0, 4));
  const tm = Number(toYmd.slice(5, 7));
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
  searchParams: Promise<{ period?: string; from?: string; to?: string; region?: string }>;
}) {
  const user = await getCurrentUser();
  const sp = await searchParams;
  const region =
    sp.region && (TRUCK_REGIONS as readonly string[]).includes(sp.region) ? sp.region : undefined;
  const customFrom = sp.from && YMD.test(sp.from) ? sp.from : undefined;
  const customTo = sp.to && YMD.test(sp.to) ? sp.to : undefined;
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

  const kpiMonths = isCustom ? monthsBetween(customFrom!, customTo!) : monthsForPreset(preset!);
  const trendMonths = lastNMonths(6);
  const periodLabel = isCustom
    ? `${new Date(customFrom!).toLocaleDateString(loc)} – ${new Date(customTo!).toLocaleDateString(loc)}`
    : tPeriod(preset!);

  const [kpiRows, prevRows, trendRows, trucks, allTrips, regionRowsRaw] = await Promise.all([
    computeTruckPnl(user, { months: kpiMonths, region }),
    computeTruckPnl(user, { months: prevMonths(kpiMonths), region }),
    computeTruckPnl(user, { months: trendMonths, region }),
    listVehicles(user.entId, 'active', 'TRUCK'),
    listTruckTrips(user.entId),
    /* Per-region breakdown over the selected period (always all regions, even
     * when filtered — so the breakdown stays a comparison). */
    Promise.all(
      TRUCK_REGIONS.map(async (r) => {
        const rows = await computeTruckPnl(user, { months: kpiMonths, region: r });
        return rows.reduce(
          (a, x) => ({
            region: r,
            revenue: a.revenue + x.revenue,
            netProfit: a.netProfit + x.netProfit,
            tripCount: a.tripCount + x.tripCount,
          }),
          { region: r, revenue: 0, netProfit: 0, tripCount: 0 },
        );
      }),
    ),
  ]);
  const regionRows = regionRowsRaw;

  /* Sum the per-month rows across the selected period. */
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
    }),
    { revenue: 0, variableCost: 0, fixedCost: 0, netProfit: 0, tripCount: 0, fuelCost: 0, tollFee: 0, extraTotal: 0, salary: 0, depreciation: 0, insurance: 0 },
  );
  const totalCost = acc.variableCost + acc.fixedCost;
  const recent = allTrips.slice(0, 5);

  /* KPI delta vs the same number of months immediately before the selection. */
  const prevAcc = prevRows.reduce(
    (a, r) => ({ revenue: a.revenue + r.revenue, netProfit: a.netProfit + r.netProfit }),
    { revenue: 0, netProfit: 0 },
  );
  const billingDelta = pctDelta(acc.revenue, prevAcc.revenue);
  const profitDelta = pctDelta(acc.netProfit, prevAcc.netProfit);

  /* Cost split (variable vs fixed). driverSalary is folded into fixedCost by
   * the service (fleet-level); back it out for the breakdown row. */
  const driverSalary = acc.fixedCost - acc.salary - acc.depreciation - acc.insurance;
  const variablePct = totalCost > 0 ? Math.round((acc.variableCost / totalCost) * 100) : 0;
  const fixedPct = totalCost > 0 ? 100 - variablePct : 0;

  const vnd = (n: number) => n.toLocaleString(loc) + ' ₫';
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

  const donut = [
    { name: tPnl('fuel'), value: acc.fuelCost, color: 'hsl(var(--c1))' },
    { name: tPnl('toll'), value: acc.tollFee, color: 'hsl(var(--c7))' },
    { name: tPnl('other'), value: acc.extraTotal, color: 'hsl(var(--c3))' },
    { name: tPnl('salary'), value: acc.salary, color: 'hsl(var(--c2))' },
    { name: tPnl('depreciation'), value: acc.depreciation, color: 'hsl(var(--c4))' },
    { name: tPnl('insurance'), value: acc.insurance, color: 'hsl(var(--c6))' },
  ].filter((d) => d.value > 0);

  const statusOrder: CarVehicleStatus[] = ['AVAILABLE', 'IN_USE', 'MAINTENANCE', 'RETIRED'];
  const statusCounts = statusOrder.map((s) => ({ status: s, n: trucks.filter((v) => v.cvhStatus === s).length }));
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
    'rounded-full px-3 py-1 text-xs font-semibold border transition-colors ' +
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

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <Kpi label={t('kpiRevenue')} value={vnd(acc.revenue)} delta={billingDelta} vsPrev={t('vsPrev')} />
          <Kpi label={t('kpiCost')} value={vnd(totalCost)} subtitle={t('kpiCostSub')} />
          <Kpi
            label={t('kpiProfit')}
            value={vnd(acc.netProfit)}
            tone={acc.netProfit >= 0 ? 'success' : 'danger'}
            delta={profitDelta}
            vsPrev={t('vsPrev')}
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
              [tPnl('salary'), vnd(acc.salary)],
              [tPnl('depreciation'), vnd(acc.depreciation)],
              [tPnl('insurance'), vnd(acc.insurance)],
              [tPnl('driverSalary'), vnd(driverSalary)],
            ]}
          />
        </div>

        {/* Per-region breakdown (REQ-20260630) — comparison across all regions. */}
        <Card variant="outline">
          <div className="px-4 py-3 border-b border-border">
            <h2 className="text-sm font-semibold text-text">{t('byRegion')}</h2>
          </div>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('thRegionCol')}</TableHead>
                  <TableHead className="text-right">{tPnl('revenue')}</TableHead>
                  <TableHead className="text-right">{tPnl('netProfit')}</TableHead>
                  <TableHead className="text-right">{t('kpiTrips')}</TableHead>
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
              <Link href="/truck/trips" className="text-xs font-semibold text-accent hover:underline">
                {t('viewAll')}
              </Link>
            </div>
            {recent.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-text-muted">{tTrips('emptyTitle')}</div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{tTrips('thDate')}</TableHead>
                      <TableHead>{tTrips('thCustomer')}</TableHead>
                      <TableHead className="text-right">{tTrips('thRevenue')}</TableHead>
                      <TableHead className="text-right">{tTrips('thProfit')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {recent.map((trip) => (
                      <ClickableTableRow key={trip.trpId} href={`/truck/trips/${trip.trpId}`}>
                        <TableCell className="whitespace-nowrap">
                          <div className="text-text">{date(trip.scheduledAt)}</div>
                          <div className="text-xs text-text-faint font-mono">{trip.ref}</div>
                        </TableCell>
                        <TableCell className="text-text">{trip.customer ?? '—'}</TableCell>
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
                    ))}
                  </TableBody>
                </Table>
              </div>
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
  tone,
  subtitle,
  delta,
  vsPrev,
}: {
  label: string;
  value: string;
  tone?: 'success' | 'danger';
  subtitle?: string;
  delta?: number | null;
  vsPrev?: string;
}) {
  return (
    <Card className="px-4 py-3">
      <div className="text-xs font-medium uppercase tracking-wide text-text-muted mb-1.5">{label}</div>
      <div
        className={
          'text-xl md:text-2xl font-bold tabular leading-none ' +
          (tone === 'success' ? 'text-success' : tone === 'danger' ? 'text-danger' : 'text-text')
        }
      >
        {value}
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

