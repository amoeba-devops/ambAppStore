import { getLocale, getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { AlertTriangle, Fuel, Gauge, Plus, Truck, User, Weight } from 'lucide-react';
import { Badge, Button, Card, EmptyState } from '@car-v2/ui';
import { computeTruckPnl } from '@car-v2/core/truck';
import type { CarVehicleStatus } from '@car-v2/db/schema';
import { PageHeader } from '@/components/layout/page-header';
import { getCurrentUser } from '@/lib/auth/get-current-user';
import { listVehicles, type VehicleListItem } from '@/server/queries/vehicles.queries';
import { getLatestTruckDrivers } from '@/server/queries/truck-trips.queries';

const STATUS_TONE: Record<CarVehicleStatus, 'success' | 'info' | 'warning' | 'neutral'> = {
  AVAILABLE: 'success',
  IN_USE: 'info',
  MAINTENANCE: 'warning',
  RETIRED: 'neutral',
};

function bcp47(locale: string): string {
  if (locale === 'vi') return 'vi-VN';
  if (locale === 'ko') return 'ko-KR';
  return 'en-US';
}

/** Km remaining until next oil change (negative = overdue). */
function oilRemaining(v: VehicleListItem): number {
  if (v.cvhLastOilChangeKm == null) return v.cvhOilIntervalKm;
  return v.cvhLastOilChangeKm + v.cvhOilIntervalKm - v.cvhOdometerKm;
}

export default async function TruckFleetPage() {
  const user = await getCurrentUser();
  const t = await getTranslations('screens.truckFleet');
  const tNav = await getTranslations('nav');
  const tCo = await getTranslations('company');
  const tStatus = await getTranslations('vehicles.status');
  const locale = await getLocale();
  const vnd = (n: number) => n.toLocaleString(bcp47(locale)) + ' ₫';

  const trucks = await listVehicles(user.entId, 'active', 'TRUCK');
  const month = new Date().toISOString().slice(0, 7);
  const [drivers, profits] = await Promise.all([
    getLatestTruckDrivers(user.entId),
    Promise.all(
      trucks.map((v) =>
        computeTruckPnl(user, { vehicleId: v.cvhId, months: [month] }).then((r) => r[0]?.netProfit ?? 0),
      ),
    ),
  ]);
  const profitByVehicle = new Map(trucks.map((v, i) => [v.cvhId, profits[i] ?? 0]));

  return (
    <>
      <PageHeader
        title={t('title')}
        subtitle={t('subtitle', { count: trucks.length })}
        breadcrumbs={[{ label: tCo('tenant') }, { label: tNav('truckFleet') }]}
        actions={
          <Button variant="accent" size="md" asChild>
            <Link href="/truck/fleet/new">
              <Plus />
              {t('addTruck')}
            </Link>
          </Button>
        }
      />

      <div className="flex-1 overflow-auto px-4 md:px-7 py-4 md:py-6">
        {trucks.length === 0 ? (
          <Card>
            <EmptyState
              icon={<Truck />}
              title={t('emptyTitle')}
              description={t('emptyDesc')}
              action={
                <Button variant="accent" size="md" asChild>
                  <Link href="/truck/fleet/new">
                    <Plus />
                    {t('addTruck')}
                  </Link>
                </Button>
              }
            />
          </Card>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {trucks.map((v) => {
              const remaining = oilRemaining(v);
              const overdue = remaining < 0;
              const profit = profitByVehicle.get(v.cvhId) ?? 0;
              const driver = drivers.get(v.cvhId) ?? null;
              return (
              <Link
                key={v.cvhId}
                href={`/truck/fleet/${v.cvhId}/edit`}
                className="block rounded-md border border-border bg-surface p-5 hover:border-border-strong hover:shadow-sm transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="inline-flex items-center gap-2 text-text-muted">
                    <Truck className="h-4 w-4" />
                    <span className="font-mono font-semibold text-text">{v.cvhPlateNumber}</span>
                  </div>
                  <Badge tone={STATUS_TONE[v.cvhStatus]}>{tStatus(v.cvhStatus)}</Badge>
                </div>
                <div className="mt-3 text-lg font-semibold text-text leading-tight">{v.cvhModel}</div>
                <div className="text-sm text-text-muted">{[v.cvhMake, v.cvhYear].filter(Boolean).join(' · ') || '—'}</div>

                <div className="mt-4 grid grid-cols-3 gap-3 text-sm pt-4 border-t border-border">
                  <Stat icon={<Gauge />} label={t('statOdometer')} value={`${v.cvhOdometerKm.toLocaleString()} km`} />
                  <Stat icon={<Weight />} label={t('statTonnage')} value={v.cvhTonnage ? `${v.cvhTonnage} t` : '—'} />
                  <Stat icon={<Fuel />} label={t('statQuota')} value={v.cvhFuelQuota ? `${v.cvhFuelQuota} L/100km` : '—'} />
                </div>

                <div className="mt-3 pt-3 border-t border-border flex items-center justify-between gap-2 text-xs">
                  <span className="inline-flex items-center gap-1.5 text-text-muted min-w-0 truncate">
                    <User className="h-3.5 w-3.5 shrink-0" />
                    {driver ?? '—'}
                  </span>
                  <span className="text-text-muted shrink-0">
                    {t('statProfit')}:{' '}
                    <b className={profit >= 0 ? 'text-success' : 'text-danger'}>{vnd(profit)}</b>
                  </span>
                </div>
                {overdue && (
                  <div className="mt-2 inline-flex items-center gap-1.5 rounded bg-danger-soft text-danger text-xs px-2 py-1">
                    <AlertTriangle className="h-3 w-3 shrink-0" />
                    {t('oilOverdue', { km: Math.abs(remaining).toLocaleString() })}
                  </div>
                )}
              </Link>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div>
      <div className="inline-flex items-center gap-1 text-xs text-text-faint [&_svg]:h-3 [&_svg]:w-3">
        {icon} <span>{label}</span>
      </div>
      <div className="mt-0.5 text-sm font-medium tabular text-text">{value}</div>
    </div>
  );
}
