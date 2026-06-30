import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { PageHeader } from '@/components/layout/page-header';
import { getCurrentUser } from '@/lib/auth/get-current-user';
import { getVehicle } from '@/server/queries/vehicles.queries';
import { TruckVehicleForm } from '../../_components/truck-vehicle-form';

export default async function EditTruckVehiclePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  const v = await getVehicle(user.entId, id);
  if (!v || v.cvhType !== 'TRUCK') notFound();

  const t = await getTranslations('screens.truckFleet');
  const initial = {
    plate: v.cvhPlateNumber,
    model: v.cvhModel,
    make: v.cvhMake ?? '',
    year: v.cvhYear != null ? String(v.cvhYear) : '',
    tonnage: v.cvhTonnage ?? '',
    fuelQuota: v.cvhFuelQuota ?? '',
    fuelType: v.cvhFuelType,
    region: v.cvhRegion ?? '',
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
      <div className="px-4 md:px-7 py-4 md:py-6 max-w-2xl mx-auto md:mx-0 w-full">
        <TruckVehicleForm vehicleId={v.cvhId} initial={initial} />
      </div>
    </>
  );
}
