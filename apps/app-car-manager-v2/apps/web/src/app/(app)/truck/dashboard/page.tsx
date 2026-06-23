import { getLocale, getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { ClipboardList, Plus } from 'lucide-react';
import { Badge, Card, DonutChart, StackedBarChart } from '@car-v2/ui';
import { computeTruckPnl } from '@car-v2/core/truck';
import type { CarVehicleStatus } from '@car-v2/db/schema';
import { PageHeader } from '@/components/layout/page-header';
import { getCurrentUser } from '@/lib/auth/get-current-user';
import { listTruckTrips, getTruckLeaderboard, type TruckLeaderRow } from '@/server/queries/truck-trips.queries';
import { listVehicles } from '@/server/queries/vehicles.queries';
import { PeriodSelect } from './_components/period-select';
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

/** [from, to) for the selected months. */
function rangeOf(months: string[]): { from: Date; to: Date } {
  const first = months[0]!;
  const last = months[months.length - 1]!;
  const from = new Date(`${first}-01T00:00:00.000Z`);
  const ld = new Date(`${last}-01T00:00:00.000Z`);
  const to = new Date(Date.UTC(ld.getUTCFullYear(), ld.getUTCMonth() + 1, 1));
  return { from, to };
}

export default async function TruckDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string }>;
}) {
  const user = await getCurrentUser();
  const sp = await searchParams;
  const preset: PeriodPreset = isPeriodPreset(sp.period) ? sp.period : 'thisMonth';

  const t = await getTranslations('screens.truckDashboard');
  const tPeriod = await getTranslations('screens.truckDashboard.period');
  const tPnl = await getTranslations('screens.truckPnl');
  const tTrips = await getTranslations('screens.truckTrips');
  const tNav = await getTranslations('nav');
  const tCo = await getTranslations('company');
  const tStatus = await getTranslations('vehicles.status');
  const locale = await getLocale();
  const loc = bcp47(locale);

  const kpiMonths = monthsForPreset(preset);
  const trendMonths = lastNMonths(6);
  const { from, to } = rangeOf(kpiMonths);

  const [kpiRows, trendRows, trucks, allTrips, board] = await Promise.all([
    computeTruckPnl(user, { months: kpiMonths }),
    computeTruckPnl(user, { months: trendMonths }),
    listVehicles(user.entId, 'active', 'TRUCK'),
    listTruckTrips(user.entId),
    getTruckLeaderboard(user.entId, from, to),
  ]);

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

  const vnd = (n: number) => n.toLocaleString(loc) + ' ₫';
  const date = (d: Date) => new Date(d).toLocaleDateString(loc);
  const monthShort = (m: string) =>
    new Date(`${m}-01T00:00:00Z`).toLocaleDateString(loc, { month: 'short' });

  const barData = trendRows.map((r) => ({ month: monthShort(r.month), profit: Math.round((r.netProfit / 1e6) * 10) / 10 }));
  const barSeries = [{ key: 'profit', name: tPnl('netProfit'), color: 'hsl(var(--c7))' }];

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

  return (
    <>
      <PageHeader
        title={t('title')}
        subtitle={tPeriod(preset)}
        breadcrumbs={[{ label: tCo('tenant') }, { label: tNav('truckDashboard') }]}
        actions={
          <div className="flex items-center gap-2">
            <div className="hidden sm:block">
              <PeriodSelect current={preset} />
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
          <PeriodSelect current={preset} />
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <Kpi label={t('kpiRevenue')} value={vnd(acc.revenue)} />
          <Kpi label={t('kpiCost')} value={vnd(totalCost)} />
          <Kpi label={t('kpiProfit')} value={vnd(acc.netProfit)} tone={acc.netProfit >= 0 ? 'success' : 'danger'} />
          <Kpi label={t('kpiTrips')} value={acc.tripCount.toLocaleString(loc)} />
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-[1.4fr_1fr] gap-4">
          <Card className="p-4">
            <h2 className="text-sm font-semibold text-text mb-3">{t('chartProfit')}</h2>
            <StackedBarChart data={barData} xKey="month" series={barSeries} height={220} valueSuffix="M" valuePrecision={1} />
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

        {/* TOP trucks + drivers (by revenue over the period) */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <TopCard title={t('topTrucks')} rows={board.trucks} vnd={vnd} loc={loc} empty={t('noData')} tripsWord={t('tripsShort')} />
          <TopCard title={t('topDrivers')} rows={board.drivers} vnd={vnd} loc={loc} empty={t('noData')} tripsWord={t('tripsShort')} />
        </div>

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
              <ul className="divide-y divide-border">
                {recent.map((trip) => (
                  <li key={trip.trpId}>
                    <Link
                      href={`/truck/trips/${trip.trpId}`}
                      className="flex items-center gap-3 px-4 py-3 hover:bg-surface-2/60 transition-colors"
                    >
                      <ClipboardList className="h-4 w-4 text-text-faint shrink-0" />
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium text-text truncate">{trip.customer ?? trip.ref}</div>
                        <div className="text-xs text-text-faint">{date(trip.scheduledAt)}</div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="text-sm tabular text-text">{vnd(trip.breakdown.revenue)}</div>
                        <div className={'text-xs tabular font-semibold ' + (trip.breakdown.profit >= 0 ? 'text-success' : 'text-danger')}>
                          {vnd(trip.breakdown.profit)}
                        </div>
                      </div>
                      <Badge tone={trip.status === 'COMPLETED' ? 'success' : 'neutral'} size="sm">
                        {trip.status === 'COMPLETED' ? tTrips('statusDone') : tTrips('statusOpen')}
                      </Badge>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}

function Kpi({ label, value, tone }: { label: string; value: string; tone?: 'success' | 'danger' }) {
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
    </Card>
  );
}

function TopCard({
  title,
  rows,
  vnd,
  loc,
  empty,
  tripsWord,
}: {
  title: string;
  rows: TruckLeaderRow[];
  vnd: (n: number) => string;
  loc: string;
  empty: string;
  tripsWord: string;
}) {
  const max = Math.max(1, ...rows.map((r) => r.revenue));
  return (
    <Card className="p-4">
      <h2 className="text-sm font-semibold text-text mb-3">{title}</h2>
      {rows.length === 0 ? (
        <div className="h-[120px] flex items-center justify-center text-sm text-text-muted">{empty}</div>
      ) : (
        <ul className="space-y-2.5">
          {rows.map((r, i) => (
            <li key={r.id} className="space-y-1">
              <div className="flex items-center justify-between gap-2 text-sm">
                <span className="inline-flex items-center gap-2 min-w-0">
                  <span className="text-text-faint tabular w-4 text-right">{i + 1}</span>
                  <span className="font-medium text-text truncate">{r.label}</span>
                  {r.sub && <span className="text-xs text-text-faint truncate hidden sm:inline">{r.sub}</span>}
                </span>
                <span className="shrink-0 text-right">
                  <span className="tabular text-text">{vnd(r.revenue)}</span>
                  <span className="ml-1.5 text-xs text-text-faint">{r.trips.toLocaleString(loc)} {tripsWord}</span>
                </span>
              </div>
              <div className="h-1.5 rounded-full bg-surface-2 overflow-hidden">
                <div className="h-full bg-accent" style={{ width: `${Math.round((r.revenue / max) * 100)}%` }} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
