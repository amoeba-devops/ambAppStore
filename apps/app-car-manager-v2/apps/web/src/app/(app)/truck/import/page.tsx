import { getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { Truck } from 'lucide-react';
import { PageHeader } from '@/components/layout/page-header';
import { getCurrentUser } from '@/lib/auth/get-current-user';
import { driverIdentity } from '@/lib/format-person-option';
import { listVehicles } from '@/server/queries/vehicles.queries';
import { listFleetDrivers } from '@/server/queries/drivers.queries';
import { TruckImportPanel } from './_components/truck-import-panel';

export default async function TruckImportPage() {
  const user = await getCurrentUser();
  const t = await getTranslations('screens.truckImport');
  const tNav = await getTranslations('nav');
  const tCo = await getTranslations('company');

  const [vehicles, drivers] = await Promise.all([
    listVehicles(user.entId, 'active', 'TRUCK'),
    listFleetDrivers(user.entId, 'TRUCK'),
  ]);
  const vehicleOptions = vehicles.map((v) => ({ id: v.cvhId, label: `${v.cvhPlateNumber} · ${v.cvhModel}` }));
  const driverOptions = drivers.map((d) => ({ id: d.drvId, label: driverIdentity(d) }));

  return (
    <>
      <PageHeader
        title={t('title')}
        subtitle={t('subtitle')}
        breadcrumbs={[{ label: tCo('tenant') }, { label: tNav('truckImport') }]}
      />
      <div className="flex-1 overflow-auto px-4 md:px-7 py-4 md:py-6 max-w-3xl mx-auto md:mx-0 w-full">
        {vehicleOptions.length === 0 ? (
          <div className="rounded-lg border border-border bg-surface p-8 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-accent-soft text-accent">
              <Truck className="h-6 w-6" />
            </div>
            <div className="mt-4 text-sm font-semibold text-text">{t('emptyVehiclesTitle')}</div>
            <p className="mx-auto mt-1 max-w-sm text-sm text-text-muted">{t('emptyVehiclesDesc')}</p>
            <Link
              href="/truck/fleet"
              className="mt-5 inline-flex items-center gap-2 rounded-md bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent/90"
            >
              <Truck className="h-4 w-4" />
              {t('emptyVehiclesCta')}
            </Link>
          </div>
        ) : (
          <TruckImportPanel vehicles={vehicleOptions} drivers={driverOptions} />
        )}
      </div>
    </>
  );
}
