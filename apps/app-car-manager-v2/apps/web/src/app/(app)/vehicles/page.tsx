import { getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { AlertTriangle, Car, Fuel, Gauge, MapPin, Plus, Wrench } from 'lucide-react';
import { Badge, Button, Card, EmptyState } from '@car-v2/ui';
import { Fab } from '@/components/layout/fab';
import type { CarVehicle, CarVehicleStatus } from '@car-v2/db/schema';
import { PageHeader } from '@/components/layout/page-header';
import { getCurrentUser } from '@/lib/auth/get-current-user';
import { listVehicles } from '@/server/queries/vehicles.queries';

const STATUS_TONE: Record<CarVehicleStatus, 'success' | 'info' | 'warning' | 'neutral'> = {
  AVAILABLE: 'success',
  IN_USE: 'info',
  MAINTENANCE: 'warning',
  RETIRED: 'neutral',
};

function oilRemaining(v: CarVehicle): number {
  if (v.cvhLastOilChangeKm == null) return v.cvhOilIntervalKm;
  const interval = v.cvhOilIntervalKm;
  return v.cvhLastOilChangeKm + interval - v.cvhOdometerKm;
}

export default async function VehiclesPage() {
  const t       = await getTranslations('screens.vehicles');
  const tA      = await getTranslations('actions');
  const tNav    = await getTranslations('nav');
  const tCo     = await getTranslations('company');
  const tList   = await getTranslations('vehicles.list');
  const tStatus = await getTranslations('vehicles.status');
  const user = await getCurrentUser();
  const vehicles = await listVehicles(user.entId);

  const summary = {
    total: vehicles.length,
    available: vehicles.filter((v) => v.cvhStatus === 'AVAILABLE').length,
    inUse: vehicles.filter((v) => v.cvhStatus === 'IN_USE').length,
    maintenance: vehicles.filter((v) => v.cvhStatus === 'MAINTENANCE').length,
  };

  return (
    <>
      <PageHeader
        title={t('title')}
        subtitle={tList('subtitle', { count: summary.total, maint: summary.maintenance })}
        breadcrumbs={[{ label: tCo('tenant') }, { label: tNav('vehicles') }]}
        actions={
          <Button variant="accent" size="md" asChild>
            <Link href="/vehicles/new"><Plus />{tA('new')}</Link>
          </Button>
        }
      />

      <div className="flex-1 overflow-auto px-4 md:px-7 py-4 md:py-6 space-y-5">
        {/* Summary KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <SummaryCard label={tList('summaryTotal')} value={String(summary.total)} />
          <SummaryCard label={tList('summaryAvailable')} value={String(summary.available)} tone="success" />
          <SummaryCard label={tList('summaryInUse')} value={String(summary.inUse)} tone="info" />
          <SummaryCard label={tList('summaryMaintenance')} value={String(summary.maintenance)} tone="warning" />
        </div>

        {vehicles.length === 0 ? (
          <Card>
            <EmptyState
              icon={<Car />}
              title={tList('emptyTitle')}
              description={tList('emptyDesc')}
              action={
                <Button variant="accent" size="md" asChild>
                  <Link href="/vehicles/new"><Plus />{tList('addVehicle')}</Link>
                </Button>
              }
            />
          </Card>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {vehicles.map((v) => {
              const remainingOil = oilRemaining(v);
              const overdue = remainingOil < 0;
              return (
                <Link
                  key={v.cvhId}
                  href={`/vehicles/${v.cvhId}`}
                  className="group rounded-md border border-border bg-surface p-5 hover:border-border-strong hover:shadow-sm transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="inline-flex items-center gap-2 text-text-muted">
                      <Car className="h-4 w-4" />
                      <span className="font-mono font-semibold text-text">{v.cvhPlateNumber}</span>
                    </div>
                    <Badge tone={STATUS_TONE[v.cvhStatus]}>{tStatus(v.cvhStatus)}</Badge>
                  </div>
                  <div className="mt-3 text-lg font-semibold text-text leading-tight">{v.cvhModel}</div>
                  <div className="text-sm text-text-muted">
                    {[v.cvhColor, v.cvhYear].filter(Boolean).join(' · ') || '—'}
                  </div>

                  <div className="mt-4 grid grid-cols-3 gap-3 text-sm pt-4 border-t border-border">
                    <Stat icon={<Gauge />} label={tList('statOdometer')} value={`${v.cvhOdometerKm.toLocaleString()} km`} />
                    <Stat
                      icon={<Fuel />}
                      label={tList('statOilIn')}
                      value={overdue ? tList('kmOver', { km: Math.abs(remainingOil) }) : tList('kmRemaining', { km: remainingOil.toLocaleString() })}
                      tone={overdue ? 'danger' : undefined}
                    />
                    <Stat icon={<MapPin />} label={tList('statBase')} value={v.cvhHomeBase ?? '—'} />
                  </div>

                  {(overdue || v.cvhStatus === 'MAINTENANCE') && (
                    <div className={
                      'mt-3 flex items-start gap-2 rounded px-2.5 py-1.5 text-xs ' +
                      (overdue ? 'bg-danger-soft text-danger' : 'bg-warning-soft text-warning')
                    }>
                      {overdue ? <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" /> : <Wrench className="h-3.5 w-3.5 shrink-0 mt-0.5" />}
                      <span className="leading-snug">
                        {overdue ? tList('oilOverdue') : tList('inMaintenance')}
                      </span>
                    </div>
                  )}
                </Link>
              );
            })}
          </div>
        )}
      </div>

      <Fab href="/vehicles/new" label={tList('addVehicle')} icon={<Plus />} />
    </>
  );
}

function SummaryCard({ label, value, tone }: { label: string; value: string; tone?: 'success' | 'info' | 'warning' }) {
  return (
    <Card className="px-4 py-3">
      <div className={
        'text-xs font-medium uppercase tracking-wide mb-1.5 ' +
        (tone === 'success' ? 'text-success' :
         tone === 'info'    ? 'text-info'    :
         tone === 'warning' ? 'text-warning' :
                              'text-text-muted')
      }>{label}</div>
      <div className="text-2xl font-bold text-text tabular leading-none">{value}</div>
    </Card>
  );
}

function Stat({ icon, label, value, tone }: { icon: React.ReactNode; label: string; value: string; tone?: 'danger' }) {
  return (
    <div>
      <div className="inline-flex items-center gap-1 text-xs text-text-faint [&_svg]:h-3 [&_svg]:w-3">
        {icon} <span>{label}</span>
      </div>
      <div className={'mt-0.5 text-sm font-medium tabular ' + (tone === 'danger' ? 'text-danger' : 'text-text')}>
        {value}
      </div>
    </div>
  );
}
