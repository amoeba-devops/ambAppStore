import { getTranslations } from 'next-intl/server';
import { PageHeader } from '@/components/layout/page-header';
import { getCurrentUser } from '@/lib/auth/get-current-user';
import { listVehicles } from '@/server/queries/vehicles.queries';
import { listDrivers } from '@/server/queries/drivers.queries';
import { TruckTripForm } from '../_components/truck-trip-form';

export default async function NewTruckTripPage() {
  const user = await getCurrentUser();
  const t = await getTranslations('screens.truckTrips');

  const [vehicles, drivers] = await Promise.all([
    listVehicles(user.entId, 'active', 'TRUCK'),
    listDrivers(user.entId),
  ]);
  const vehicleOptions = vehicles.map((v) => ({
    id: v.cvhId,
    label: `${v.cvhPlateNumber} · ${v.cvhModel}`,
  }));
  const driverOptions = drivers.map((d) => ({
    id: d.drvId,
    label: d.user.usrName ?? d.user.usrEmail ?? d.drvId,
  }));

  return (
    <>
      <PageHeader
        title={t('newTitle')}
        subtitle={t('newSubtitle')}
        breadcrumbs={[
          { label: t('title'), href: '/truck/trips' },
          { label: t('newCrumb') },
        ]}
      />
      <div className="px-4 md:px-7 py-4 md:py-6 max-w-3xl mx-auto md:mx-0 w-full">
        <TruckTripForm vehicles={vehicleOptions} drivers={driverOptions} />
      </div>
    </>
  );
}
