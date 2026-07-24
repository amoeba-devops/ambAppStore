import { getTranslations } from 'next-intl/server';
import { getCurrentUser, requireRole } from '@/lib/auth/get-current-user';
import { requireFleet } from '@/lib/auth/fleet-access';
import { listVehicles } from '@/server/queries/vehicles.queries';
import { getTenantSettings } from '@/server/queries/tenant-settings.queries';
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

  const [vehicles, settings] = await Promise.all([
    listVehicles(user.entId, 'active', 'TRUCK'),
    getTenantSettings(user.entId),
  ]);

  const vehicleOptions = vehicles.map((v) => ({
    id: v.cvhId,
    label: `${v.cvhPlateNumber} · ${v.cvhModel}`,
    fuelQuota: v.cvhFuelQuota != null ? Number(v.cvhFuelQuota) : null,
    fuelPrice: v.cvhFuelPrice != null ? Number(v.cvhFuelPrice) : null,
  }));

  const t = await getTranslations('screens.truckTrips');
  const tToday = await getTranslations('today.truck');

  return (
    <>
      <PageHeader
        title={t('newTitle')}
        subtitle={t('newSubtitle')}
        breadcrumbs={[{ label: tToday('title'), href: '/today' }, { label: t('newCrumb') }]}
        back="/today"
        mobileVariant="brand"
      />
      <div className="px-4 md:px-7 py-4 md:py-6 max-w-7xl mx-auto w-full">
        {/* drivers=[] — DRIVER mode locks the trip to the caller, so no list. */}
        <TruckTripForm
          vehicles={vehicleOptions}
          drivers={[]}
          role={user.role}
          depotAddress={settings?.tnsDepotAddress}
        />
      </div>
    </>
  );
}
