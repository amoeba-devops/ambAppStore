import { getLocale, getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { ClipboardList, Plus } from 'lucide-react';
import { Badge, Card, DonutChart, StackedBarChart } from '@car-v2/ui';
import { computeTruckPnl } from '@car-v2/core/truck';
import type { CarVehicleStatus } from '@car-v2/db/schema';
import { PageHeader } from '@/components/layout/page-header';
import { getCurrentUser } from '@/lib/auth/get-current-user';
import { listTruckTrips } from '@/server/queries/truck-trips.queries';
import { listVehicles } from '@/server/queries/vehicles.queries';

function bcp47(locale: string): string {
  if (locale === 'vi') return 'vi-VN';
  if (locale === 'ko') return 'ko-KR';
  return 'en-US';
}

function lastNMonths(n: number): string[] {
  const out: string[] = [];
  const now = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const dt = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    out.push(dt.toISOString().slice(0, 7));
  }
  return out;
}

export default async function TruckDashboardPage() {
  const user = await getCurrentUser();
  const t = await getTranslations('screens.truckDashboard');
  const tPnl = await getTranslations('screens.truckPnl');
  const tTrips = await getTranslations('screens.truckTrips');
  const tNav = await getTranslations('nav');
  const tCo = await getTranslations('company');
  const tStatus = await getTranslations('vehicles.status');
  const locale = await getLocale();
  const loc = bcp47(locale);

  const months = lastNMonths(6);
  const [pnlRows, trucks, allTrips] = await Promise.all([
    computeTruckPnl(user, { months }),
    listVehicles(user.entId, 'active', 'TRUCK'),
    listTruckTrips(user.entId),
  ]);
  const cur = pnlRows[pnlRows.length - 1];
  const revenue = cur?.revenue ?? 0;
  const totalCost = (cur?.variableCost ?? 0) + (cur?.fixedCost ?? 0);
  const netProfit = cur?.netProfit ?? 0;
  const tripCount = cur?.tripCount ?? 0;
  const recent = allTrips.slice(0, 5);

  const vnd = (n: number) => n.toLocaleString(loc) + ' ₫';
  const date = (d: Date) => new Date(d).toLocaleDateString(loc);
  const monthShort = (m: string) =>
    new Date(`${m}-01T00:00:00Z`).toLocaleDateString(loc, { month: 'short' });

  /* Net profit per month (single series — stacking revenue+profit would be
   * misleading). Scaled to millions for a readable Y-axis. */
  const barData = pnlRows.map((r) => ({ month: monthShort(r.month), profit: Math.round((r.netProfit / 1e6) * 10) / 10 }));
  const barSeries = [{ key: 'profit', name: tPnl('netProfit'), color: 'hsl(var(--c7))' }];

  const donut = cur
    ? [
        { name: tPnl('fuel'), value: cur.fuelCost, color: 'hsl(var(--c1))' },
        { name: tPnl('toll'), value: cur.tollFee, color: 'hsl(var(--c7))' },
        { name: tPnl('other'), value: cur.extraTotal, color: 'hsl(var(--c3))' },
        { name: tPnl('salary'), value: cur.salary, color: 'hsl(var(--c2))' },
        { name: tPnl('depreciation'), value: cur.depreciation, color: 'hsl(var(--c4))' },
        { name: tPnl('insurance'), value: cur.insurance, color: 'hsl(var(--c6))' },
      ].filter((d) => d.value > 0)
    : [];

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
        subtitle={t('subtitle', { month: new Date(`${months[months.length - 1]}-01T00:00:00Z`).toLocaleDateString(loc, { month: 'long', year: 'numeric' }) })}
        breadcrumbs={[{ label: tCo('tenant') }, { label: tNav('truckDashboard') }]}
        actions={
          <Link
            href="/truck/trips/new"
            className="inline-flex items-center gap-1.5 rounded-md bg-accent text-accent-fg px-3 py-2 text-sm font-semibold hover:opacity-90"
          >
            <Plus className="h-4 w-4" />
            {tTrips('addTrip')}
          </Link>
        }
      />

      <div className="flex-1 overflow-auto px-4 md:px-7 py-4 md:py-6 space-y-5">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <Kpi label={t('kpiRevenue')} value={vnd(revenue)} />
          <Kpi label={t('kpiCost')} value={vnd(totalCost)} />
          <Kpi label={t('kpiProfit')} value={vnd(netProfit)} tone={netProfit >= 0 ? 'success' : 'danger'} />
          <Kpi label={t('kpiTrips')} value={tripCount.toLocaleString(loc)} />
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
