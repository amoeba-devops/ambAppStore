import { getTranslations } from 'next-intl/server';
import { PageHeader } from '@/components/layout/page-header';
import { getCurrentUser } from '@/lib/auth/get-current-user';
import { resolveVehicleScope } from '@/lib/auth/region-access';
import { TruckMaintenanceForm } from '../_components/truck-maintenance-form';

/** New maintenance job (REQ-20260904). Trucks offered = the viewer's region scope. */
export default async function NewTruckMaintenancePage() {
  const user = await getCurrentUser();
  const t = await getTranslations('screens.truckMaintenance');
  const { trucks } = await resolveVehicleScope(user, undefined);

  return (
    <>
      <PageHeader
        title={t('newTitle')}
        subtitle={t('newSubtitle')}
        breadcrumbs={[
          { label: t('title'), href: '/truck/maintenance' },
          { label: t('newCrumb') },
        ]}
        back="/truck/maintenance"
      />
      <div className="px-4 md:px-7 py-4 md:py-6 max-w-2xl mx-auto w-full">
        <TruckMaintenanceForm
          /* A retired truck cannot be booked for maintenance (REQ-20260907 BR-4). */
          vehicles={trucks.filter((v) => v.cvhStatus !== 'RETIRED').map((v) => ({
            id: v.cvhId,
            plate: v.cvhPlateNumber,
            label: `${v.cvhPlateNumber} · ${v.cvhModel}`,
          }))}
        />
      </div>
    </>
  );
}
