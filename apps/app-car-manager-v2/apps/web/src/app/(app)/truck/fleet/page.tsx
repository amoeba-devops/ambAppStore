import { getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { Fuel, Gauge, Plus, Truck, Weight } from 'lucide-react';
import { Badge, Button, Card, EmptyState } from '@car-v2/ui';
import type { CarVehicleStatus } from '@car-v2/db/schema';
import { PageHeader } from '@/components/layout/page-header';
import { getCurrentUser } from '@/lib/auth/get-current-user';
import { listVehicles } from '@/server/queries/vehicles.queries';

const STATUS_TONE: Record<CarVehicleStatus, 'success' | 'info' | 'warning' | 'neutral'> = {
  AVAILABLE: 'success',
  IN_USE: 'info',
  MAINTENANCE: 'warning',
  RETIRED: 'neutral',
};

export default async function TruckFleetPage() {
  const user = await getCurrentUser();
  const t = await getTranslations('screens.truckFleet');
  const tA = await getTranslations('actions');
  const tNav = await getTranslations('nav');
  const tCo = await getTranslations('company');
  const tStatus = await getTranslations('vehicles.status');

  const trucks = await listVehicles(user.entId, 'active', 'TRUCK');

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
            {trucks.map((v) => (
              <Card key={v.cvhId} className="p-5">
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
              </Card>
            ))}
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
