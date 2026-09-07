import { getTranslations } from 'next-intl/server';
import { getCurrentUser, requireRole } from '@/lib/auth/get-current-user';
import { requireFleet } from '@/lib/auth/fleet-access';
import { listDispatchableTrucks } from '@/server/queries/truck-vehicles.queries';
import { getTenantSettings } from '@/server/queries/tenant-settings.queries';
import { listVehicleMaintenanceWindows } from '@car-v2/core/truck';
import { PageHeader } from '@/components/layout/page-header';
import { TruckTripForm } from '@/app/(app)/truck/trips/_components/truck-trip-form';

/** Driver self-service trip creation (REQ-20260623).
 *
 * Lives under /today (the driver workspace) NOT /truck/* — the truck layout
 * redirects every DRIVER to /today, so the manager create surface at
 * /truck/trips/new is unreachable for them. This route reuses TruckTripForm in
 * DRIVER mode: revenue hidden, driver locked to self, costs operational-only.
 */
export default async function DriverTruckNewTripPage() {
  const user = await getCurrentUser();
  requireRole(user.role, ['DRIVER']);
  await requireFleet(user, 'TRUCK');

  const [vehicles, settings, maintenanceWindows] = await Promise.all([
    /* Retired trucks are not offered (REQ-20260907 BR-5). */
    listDispatchableTrucks(user.entId),
    getTenantSettings(user.entId),
    /* Maintenance windows (REQ-20260904) — the same hard stop the manager sees. */
    listVehicleMaintenanceWindows(user.entId),
  ]);

  const vehicleOptions = vehicles.map((v) => ({
    id: v.cvhId,
    label: `${v.cvhPlateNumber} · ${v.cvhModel}`,
  }));

  const t = await getTranslations('screens.truckTrips');
  const tToday = await getTranslations('today.truck');

  return (
    <>
      <PageHeader
        title={t('newTitle')}
        subtitle={t('newSubtitle')}
        breadcrumbs={[{ label: tToday('title'), href: '/today' }, { label: t('newCrumb') }]}
        /* Default 'breadcrumb' variant — a form needs the back chevron that
         * the 'brand' home-route header does not render. */
        back="/today"
      />
      <div className="px-4 md:px-7 py-4 md:py-6 max-w-7xl mx-auto w-full">
        {/* drivers=[] — DRIVER mode locks the trip to the caller, so no list. */}
        <TruckTripForm
          vehicles={vehicleOptions}
          drivers={[]}
          role={user.role}
          depotAddress={settings?.tnsDepotAddress}
          maintenanceWindows={maintenanceWindows}
        />
      </div>
    </>
  );
}
