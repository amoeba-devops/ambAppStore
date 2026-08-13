import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { PageHeader } from '@/components/layout/page-header';
import { getCurrentUser } from '@/lib/auth/get-current-user';
import { allowedRegions, requireRegion } from '@/lib/auth/region-access';
import { driverIdentity } from '@/lib/format-person-option';
import { getVehicle } from '@/server/queries/vehicles.queries';
import { listFleetDrivers, getDriverAnyStatus } from '@/server/queries/drivers.queries';
import { TruckVehicleForm } from '../../_components/truck-vehicle-form';

export default async function EditTruckVehiclePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  const v = await getVehicle(user.entId, id);
  if (!v || v.cvhType !== 'TRUCK') notFound();
  /* Region ACL (REQ-20260813) — editing a truck requires access to its region. */
  if (v.cvhRegion) await requireRegion(user, v.cvhRegion);
  const regionOptions = await allowedRegions(user);

  const activeDrivers = await listFleetDrivers(user.entId, 'TRUCK');
  const drivers: { id: string; name: string; stale?: boolean }[] = activeDrivers.map((d) => ({
    id: d.drvId,
    name: driverIdentity(d),
  }));
  /* The saved default driver may have since been removed or lost TRUCK access —
   * surface it as a disabled option instead of letting the Select render blank
   * with no indication a stale reference is still stored (edge-case audit). */
  if (v.cvhDefaultDriverId && !activeDrivers.some((d) => d.drvId === v.cvhDefaultDriverId)) {
    const stale = await getDriverAnyStatus(user.entId, v.cvhDefaultDriverId);
    if (stale) {
      drivers.push({
        id: stale.drvId,
        name: driverIdentity(stale),
        stale: true,
      });
    }
  }
  const t = await getTranslations('screens.truckFleet');
  const initial = {
    plate: v.cvhPlateNumber,
    model: v.cvhModel,
    make: v.cvhMake ?? '',
    year: v.cvhYear != null ? String(v.cvhYear) : '',
    tonnage: v.cvhTonnage ?? '',
    fuelQuota: v.cvhFuelQuota ?? '',
    fuelPrice: v.cvhFuelPrice ?? '',
    fuelType: v.cvhFuelType,
    region: v.cvhRegion ?? '',
    defaultDriverId: v.cvhDefaultDriverId ?? '',
    depreciation: v.cvhDepreciation ?? '',
    odometer: String(v.cvhOdometerKm),
    oilIntervalKm: v.cvhOilIntervalKm != null ? String(v.cvhOilIntervalKm) : '',
    lastOilChangeKm: v.cvhLastOilChangeKm != null ? String(v.cvhLastOilChangeKm) : '',
    homeBase: v.cvhHomeBase ?? '',
    notes: v.cvhNotes ?? '',
  };

  return (
    <>
      <PageHeader
        title={t('editTitle')}
        subtitle={v.cvhPlateNumber}
        breadcrumbs={[
          { label: t('title'), href: '/truck/fleet' },
          { label: t('editCrumb') },
        ]}
        back="/truck/fleet"
      />
      {/* Form canh giữa màn hình (QA P2 R21). */}
      <div className="px-4 md:px-7 py-4 md:py-6 max-w-2xl mx-auto w-full">
        <TruckVehicleForm vehicleId={v.cvhId} initial={initial} drivers={drivers} regionOptions={regionOptions} />
      </div>
    </>
  );
}
