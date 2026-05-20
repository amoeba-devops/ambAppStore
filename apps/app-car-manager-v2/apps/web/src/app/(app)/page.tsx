import { getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import {
  ArrowRight,
  Car,
  ChevronRight,
  Clock,
  Download,
  Plus,
} from 'lucide-react';
import {
  Avatar,
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardHeaderText,
  CardTitle,
  chartColors,
  DonutChart,
  KpiCard,
  Sparkline,
  StackedBarChart,
} from '@car-v2/ui';
import type { CarTripStatus, CarVehicle, CarVehicleStatus } from '@car-v2/db/schema';
import { PageHeader } from '@/components/layout/page-header';
import { getCurrentUser } from '@/lib/auth/get-current-user';
import { listAudit } from '@/server/queries/audit.queries';
import { listTrips, listTodayTrips } from '@/server/queries/trips.queries';
import { listVehicles } from '@/server/queries/vehicles.queries';

const STACKED = Array.from({ length: 8 }, (_, i) => ({
  week: `W${i + 1}`,
  Fuel:   1.2 + Math.sin(i / 1.4) * 0.6 + i * 0.18,
  Repair: 0.4 + Math.cos(i / 2.1) * 0.4 + i * 0.10,
  Meal:   0.3 + Math.sin(i / 0.9) * 0.2 + i * 0.05,
  Oil:    0.15 + (i % 3) * 0.18,
}));

const VEHICLE_STATUS_TONE: Record<CarVehicleStatus, 'success' | 'info' | 'warning' | 'neutral'> = {
  AVAILABLE: 'success',
  IN_USE: 'info',
  MAINTENANCE: 'warning',
  RETIRED: 'neutral',
};

const TRIP_STATUS_TONE: Record<CarTripStatus, 'accent' | 'warning' | 'success' | 'info' | 'neutral' | 'danger'> = {
  PENDING_ASSIGNMENT:          'accent',
  PENDING_DRIVER_CONFIRMATION: 'warning',
  CONFIRMED:                   'success',
  IN_PROGRESS:                 'info',
  COMPLETED:                   'neutral',
  REJECTED_BY_DRIVER:          'danger',
  CANCELLED:                   'danger',
};

const TIME_FMT = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit' });

export default async function DashboardPage() {
  const t        = await getTranslations('screens.dashboardA');
  const tNav     = await getTranslations('nav');
  const tCo      = await getTranslations('company');
  const tAct     = await getTranslations('actions');
  const tD       = await getTranslations('dashboard');
  const tVStatus = await getTranslations('vehicles.status');
  const tTStatus = await getTranslations('trips.status');
  const tCat     = await getTranslations('reports.categories');
  const user = await getCurrentUser();

  /* This page is the Admin/Manager KPI dashboard. Driver should never see it
   * — their landing is `/today`. Middleware already redirects driver hitting
   * `/`, but this defense-in-depth guards against:
   *   - someone disabling middleware locally during dev
   *   - prefetches reaching this RSC before the redirect resolves
   *   - the page being imported (and its queries run) from a server component
   *     before the middleware ran (paranoia, not a real Next.js case today) */
  if (user.role === 'DRIVER') redirect('/today');

  const [vehicles, todayTrips, allTrips, recentAudit] = await Promise.all([
    listVehicles(user.entId),
    listTodayTrips(user.entId),
    listTrips({ entId: user.entId, role: user.role, userId: user.userId, status: 'all' }),
    listAudit(user.entId, { limit: 5 }),
  ]);

  const pending = allTrips.items.filter((t) =>
    ['PENDING_ASSIGNMENT', 'PENDING_DRIVER_CONFIRMATION'].includes(t.trpStatus),
  ).length;
  const inUseVehicles = vehicles.filter((v) => v.cvhStatus === 'IN_USE').length;
  const utilizationPct = vehicles.length === 0
    ? 0
    : Math.round((inUseVehicles / vehicles.length) * 100);

  const SPEND_MIX = [
    { key: 'Fuel',     name: tCat('Fuel'),     amount: '6.2M₫', pct: 42, color: chartColors[0] },
    { key: 'Repair',   name: tCat('Repair'),   amount: '4.1M₫', pct: 28, color: chartColors[1] },
    { key: 'Meal',     name: tCat('Meal'),     amount: '2.1M₫', pct: 14, color: chartColors[2] },
    { key: 'Oil',      name: tCat('Oil'),      amount: '1.3M₫', pct:  9, color: chartColors[3] },
    { key: 'Accident', name: tCat('Accident'), amount: '1.0M₫', pct:  7, color: chartColors[4] },
  ];

  return (
    <>
      <PageHeader
        title={t('title')}
        subtitle={t('subtitle')}
        breadcrumbs={[{ label: tCo('tenant') }, { label: tNav('dashboard') }]}
        actions={
          <>
            <Button variant="ghost" size="md" iconLeft={<Download />}>{tAct('export')}</Button>
            <Button variant="accent" size="md" asChild>
              <Link href="/trips/new"><Plus />{t('newTrip')}</Link>
            </Button>
          </>
        }
      />

      <div className="flex-1 overflow-auto px-4 md:px-7 py-4 md:py-6 space-y-4">
        {/* KPI row — live values where possible */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <KpiCard
            label={t('kTrips')}
            value={String(todayTrips.length)}
            delta={`${allTrips.total} all-time`}
            deltaKind="flat"
            trailing={<div className="w-24"><Sparkline data={[3, 5, 4, 6, 5, 7, 8, 4, 6, todayTrips.length]} /></div>}
          />
          <KpiCard
            label={tD('pendingReview')}
            value={String(pending)}
            delta={pending === 0 ? tD('noBacklog') : tD('actionNeeded')}
            deltaKind={pending === 0 ? 'flat' : 'down'}
            trailing={<div className="w-24"><Sparkline data={[1, 2, 1, 3, 2, 2, 4, 3, 4, pending]} color={chartColors[2]} /></div>}
          />
          <KpiCard
            label={tD('vehiclesInUse')}
            value={`${inUseVehicles} / ${vehicles.length}`}
            delta={`${vehicles.length - inUseVehicles - vehicles.filter((v) => v.cvhStatus === 'MAINTENANCE').length} ${tD('available')}`}
            deltaKind="flat"
            trailing={<div className="w-24"><Sparkline data={[1, 1, 2, 2, 1, 2, 3, 2, 1, inUseVehicles]} color={chartColors[1]} /></div>}
          />
          <KpiCard
            label={t('kUtil')}
            value={`${utilizationPct}%`}
            delta={tD('live')}
            deltaKind="up"
            trailing={<div className="w-24"><Sparkline data={[40, 55, 52, 60, 68, 65, 72, 70, 73, utilizationPct]} color="hsl(var(--success))" /></div>}
          />
        </div>

        {/* Fleet status + Spend mix (sample) */}
        <div className="grid grid-cols-1 lg:grid-cols-[1.4fr_1fr] gap-3">
          <Card>
            <CardHeader>
              <CardHeaderText>
                <CardTitle>{t('fleetTitle')}</CardTitle>
                <CardDescription>{t('fleetSubtitle')}</CardDescription>
              </CardHeaderText>
              <Button variant="ghost" size="sm" iconRight={<ArrowRight />} asChild>
                <Link href="/vehicles">{t('viewAll')}</Link>
              </Button>
            </CardHeader>
            <CardContent>
              {vehicles.length === 0 ? (
                <p className="text-sm text-text-muted">{tD('noVehicles')}</p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {vehicles.slice(0, 3).map((v) => <FleetCard key={v.cvhId} v={v} statusLabel={tVStatus(v.cvhStatus)} noBaseLabel={tD('noBase')} />)}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardHeaderText>
                <CardTitle>{t('spendTitle')}</CardTitle>
                <CardDescription>{tD('spendSampleNote')}</CardDescription>
              </CardHeaderText>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-5">
                <DonutChart
                  data={SPEND_MIX.map((s) => ({ name: s.name, value: s.pct, color: s.color }))}
                  size={160}
                  thickness={18}
                  centerValue="14.8M₫"
                  centerLabel={t('spendTitle')}
                />
                <ul className="flex-1 space-y-1.5 text-sm">
                  {SPEND_MIX.map((s) => (
                    <li key={s.key} className="flex items-center gap-2.5">
                      <span className="h-2 w-2 rounded-full" style={{ background: s.color }} aria-hidden />
                      <span className="flex-1 text-text font-medium">{s.name}</span>
                      <span className="text-text-muted tabular">{s.amount}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Today's schedule + activity feed */}
        <div className="grid grid-cols-1 lg:grid-cols-[1.6fr_1fr] gap-3">
          <Card>
            <CardHeader>
              <CardHeaderText>
                <CardTitle>{tD('todaySchedule')}</CardTitle>
                <CardDescription>{tD('tripsToday', { count: todayTrips.length })}</CardDescription>
              </CardHeaderText>
              <Button variant="ghost" size="sm" iconRight={<ArrowRight />} asChild>
                <Link href="/trips">{t('viewAll')}</Link>
              </Button>
            </CardHeader>
            <CardContent padded={false}>
              {todayTrips.length === 0 ? (
                <div className="p-6 text-center text-sm text-text-muted">{tD('noTripsToday')}</div>
              ) : (
                <ul className="divide-y divide-border">
                  {todayTrips.slice(0, 5).map((trip) => (
                    <li key={trip.trpId}>
                      <Link href={`/trips/${trip.trpId}`} className="flex items-center gap-3 px-5 py-3 hover:bg-surface-2/60 transition-colors">
                        <Avatar name={trip.passengerName ?? '?'} size="sm" />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-xs text-text-faint tabular">{trip.trpRef}</span>
                            <Badge tone={TRIP_STATUS_TONE[trip.trpStatus]} size="sm">
                              {tTStatus(trip.trpStatus)}
                            </Badge>
                          </div>
                          <div className="text-sm text-text font-medium truncate">{trip.passengerName ?? '—'}</div>
                          <div className="text-xs text-text-muted truncate">{trip.trpPickupAddress} → {trip.trpDropoffAddress}</div>
                        </div>
                        <div className="text-right shrink-0">
                          <div className="text-sm font-medium text-text tabular">{TIME_FMT.format(new Date(trip.trpScheduledAt))}</div>
                          {trip.driverName && <div className="text-xs text-text-faint truncate max-w-[120px]">{trip.driverName}</div>}
                        </div>
                        <ChevronRight className="h-4 w-4 text-text-faint shrink-0" />
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardHeaderText>
                <CardTitle>{tD('recentActivity')}</CardTitle>
                <CardDescription>{tD('lastEvents', { count: recentAudit.length })}</CardDescription>
              </CardHeaderText>
            </CardHeader>
            <CardContent padded={false}>
              {recentAudit.length === 0 ? (
                <div className="p-6 text-center text-sm text-text-muted">{tD('noActivity')}</div>
              ) : (
                <ul className="divide-y divide-border">
                  {recentAudit.map((row) => (
                    <li key={row.audId} className="px-5 py-3">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-[10.5px] uppercase tracking-wide text-text-muted">
                          {row.audAction}
                        </span>
                        <span className="font-mono text-xs text-text tabular ml-auto">{row.audEntityRef ?? '—'}</span>
                      </div>
                      <div className="mt-0.5 text-xs text-text-faint">
                        {row.actorName ?? <span className="italic">system</span>} ·{' '}
                        <span className="tabular">{new Date(row.audCreatedAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Sample chart row — kept until P2/P3 wire real data */}
        <Card>
          <CardHeader>
            <CardHeaderText>
              <CardTitle>{tD('spendByCategory')}</CardTitle>
              <CardDescription>{tD('spendSampleNote')}</CardDescription>
            </CardHeaderText>
          </CardHeader>
          <CardContent>
            <StackedBarChart
              data={STACKED}
              xKey="week"
              series={[
                { key: 'Fuel',   name: tCat('Fuel'),   color: chartColors[0] },
                { key: 'Repair', name: tCat('Repair'), color: chartColors[1] },
                { key: 'Meal',   name: tCat('Meal'),   color: chartColors[2] },
                { key: 'Oil',    name: tCat('Oil'),    color: chartColors[3] },
              ]}
              height={220}
              valueSuffix="M"
              valuePrecision={1}
            />
          </CardContent>
        </Card>
      </div>
    </>
  );
}

function FleetCard({ v, statusLabel, noBaseLabel }: { v: CarVehicle; statusLabel: string; noBaseLabel: string }) {
  return (
    <Link
      href={`/vehicles/${v.cvhId}`}
      className="rounded-md border border-border bg-surface p-3.5 hover:border-border-strong transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
    >
      <div className="flex items-center justify-between gap-2">
        <div className="inline-flex items-center gap-2 text-xs font-medium text-text-muted">
          <Car className="h-3.5 w-3.5" />
          <span className="font-mono text-[12px] text-text font-semibold tracking-tight">{v.cvhPlateNumber}</span>
        </div>
        <Badge tone={VEHICLE_STATUS_TONE[v.cvhStatus]} size="sm">
          {statusLabel}
        </Badge>
      </div>
      <div className="mt-2 text-sm font-semibold text-text leading-tight truncate">{v.cvhModel}</div>
      <div className="mt-0.5 text-xs text-text-muted">{[v.cvhColor, `${v.cvhOdometerKm.toLocaleString()} km`].filter(Boolean).join(' · ')}</div>
      <div className="mt-3 flex items-center gap-2 text-xs text-text-muted border-t border-border pt-2.5">
        <Clock className="h-3.5 w-3.5 shrink-0" />
        <span className="truncate">
          {v.cvhHomeBase ?? noBaseLabel}
        </span>
      </div>
    </Link>
  );
}
