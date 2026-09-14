import { getTranslations } from 'next-intl/server';
import { PageHeader } from '@/components/layout/page-header';
import { getCurrentUser } from '@/lib/auth/get-current-user';
import { driverIdentity } from '@/lib/format-person-option';
import { listDispatchableTrucks } from '@/server/queries/truck-vehicles.queries';
import { listFleetDrivers } from '@/server/queries/drivers.queries';
import { getTenantSettings } from '@/server/queries/tenant-settings.queries';
import { listVehicleMaintenanceWindows } from '@car-v2/core/truck';
import { TruckTripForm } from '../_components/truck-trip-form';

export default async function NewTruckTripPage() {
  const user = await getCurrentUser();
  const t = await getTranslations('screens.truckTrips');

  const [vehicles, drivers, settings, maintenanceWindows] = await Promise.all([
    /* Retired trucks are not offered (REQ-20260907 BR-5). */
    listDispatchableTrucks(user.entId),
    /* Managers pick from TRUCK-fleet drivers only — consistent with the truck
     * roster (/truck/drivers). Drivers self-create (form locks to self). */
    user.role !== 'DRIVER' ? listFleetDrivers(user.entId, 'TRUCK') : Promise.resolve([]),
    getTenantSettings(user.entId),
    /* Maintenance windows (REQ-20260904) — greys out booked trucks per date. */
    listVehicleMaintenanceWindows(user.entId),
  ]);

  const vehicleOptions = vehicles.map((v) => ({
    id: v.cvhId,
    label: `${v.cvhPlateNumber} · ${v.cvhModel}`,
    defaultDriverId: v.cvhDefaultDriverId ?? undefined,
  }));
  const driverOptions = drivers.map((d) => {
    const name = driverIdentity(d);
    return { id: d.drvId, label: d.drvPhone ? `${name} · ${d.drvPhone}` : name };
  });

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
      <div className="px-4 md:px-7 py-4 md:py-6 max-w-7xl mx-auto md:mx-0 w-full">
        <TruckTripForm
          vehicles={vehicleOptions}
          drivers={driverOptions}
          role={user.role}
          depotAddress={settings?.tnsDepotAddress}
          maintenanceWindows={maintenanceWindows}
        />
      </div>
    </>
  );
}
