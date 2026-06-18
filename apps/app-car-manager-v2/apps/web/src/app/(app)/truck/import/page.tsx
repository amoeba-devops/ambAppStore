import { getTranslations } from 'next-intl/server';
import { PageHeader } from '@/components/layout/page-header';
import { getCurrentUser } from '@/lib/auth/get-current-user';
import { listVehicles } from '@/server/queries/vehicles.queries';
import { listDrivers } from '@/server/queries/drivers.queries';
import { TruckImportPanel } from './_components/truck-import-panel';

export default async function TruckImportPage() {
  const user = await getCurrentUser();
  const t = await getTranslations('screens.truckImport');
  const tNav = await getTranslations('nav');
  const tCo = await getTranslations('company');

  const [vehicles, drivers] = await Promise.all([
    listVehicles(user.entId, 'active', 'TRUCK'),
    listDrivers(user.entId),
  ]);
  const vehicleOptions = vehicles.map((v) => ({ id: v.cvhId, label: `${v.cvhPlateNumber} · ${v.cvhModel}` }));
  const driverOptions = drivers.map((d) => ({ id: d.drvId, label: d.user.usrName ?? d.user.usrEmail ?? d.drvId }));

  return (
    <>
      <PageHeader
        title={t('title')}
        subtitle={t('subtitle')}
        breadcrumbs={[{ label: tCo('tenant') }, { label: tNav('truckImport') }]}
      />
      <div className="flex-1 overflow-auto px-4 md:px-7 py-4 md:py-6 max-w-3xl mx-auto md:mx-0 w-full">
        <TruckImportPanel vehicles={vehicleOptions} drivers={driverOptions} />
      </div>
    </>
  );
}
