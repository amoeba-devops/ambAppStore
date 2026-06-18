import { getLocale, getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { ClipboardList, Plus } from 'lucide-react';
import { Badge, Button, Card } from '@car-v2/ui';
import { computeTruckPnl } from '@car-v2/core/truck';
import { PageHeader } from '@/components/layout/page-header';
import { getCurrentUser } from '@/lib/auth/get-current-user';
import { listTruckTrips } from '@/server/queries/truck-trips.queries';

function bcp47(locale: string): string {
  if (locale === 'vi') return 'vi-VN';
  if (locale === 'ko') return 'ko-KR';
  return 'en-US';
}

export default async function TruckDashboardPage() {
  const user = await getCurrentUser();
  const t = await getTranslations('screens.truckDashboard');
  const tTrips = await getTranslations('screens.truckTrips');
  const tNav = await getTranslations('nav');
  const tCo = await getTranslations('company');
  const locale = await getLocale();
  const loc = bcp47(locale);

  const month = new Date().toISOString().slice(0, 7);
  const [pnl, trips] = await Promise.all([
    computeTruckPnl(user, { months: [month] }),
    listTruckTrips(user.entId),
  ]);
  const row = pnl[0];
  const revenue = row?.revenue ?? 0;
  const totalCost = (row?.variableCost ?? 0) + (row?.fixedCost ?? 0);
  const netProfit = row?.netProfit ?? 0;
  const tripCount = row?.tripCount ?? 0;
  const recent = trips.slice(0, 5);

  const vnd = (n: number) => n.toLocaleString(loc) + ' ₫';
  const date = (d: Date) => new Date(d).toLocaleDateString(loc);

  return (
    <>
      <PageHeader
        title={t('title')}
        subtitle={t('subtitle', { month: new Date(`${month}-01T00:00:00Z`).toLocaleDateString(loc, { month: 'long', year: 'numeric' }) })}
        breadcrumbs={[{ label: tCo('tenant') }, { label: tNav('truckDashboard') }]}
        actions={
          <Button variant="accent" size="md" asChild>
            <Link href="/truck/trips/new">
              <Plus />
              {tTrips('addTrip')}
            </Link>
          </Button>
        }
      />

      <div className="flex-1 overflow-auto px-4 md:px-7 py-4 md:py-6 space-y-5">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <Kpi label={t('kpiRevenue')} value={vnd(revenue)} />
          <Kpi label={t('kpiCost')} value={vnd(totalCost)} />
          <Kpi label={t('kpiProfit')} value={vnd(netProfit)} tone={netProfit >= 0 ? 'success' : 'danger'} />
          <Kpi label={t('kpiTrips')} value={tripCount.toLocaleString(loc)} />
        </div>

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
                <li key={trip.trpId} className="flex items-center gap-3 px-4 py-3">
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
                </li>
              ))}
            </ul>
          )}
        </Card>
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
