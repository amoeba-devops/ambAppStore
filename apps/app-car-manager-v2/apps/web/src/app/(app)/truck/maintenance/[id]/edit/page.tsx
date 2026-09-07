import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { PageHeader } from '@/components/layout/page-header';
import { getCurrentUser } from '@/lib/auth/get-current-user';
import { requireRegion, resolveVehicleScope } from '@/lib/auth/region-access';
import { getTruckMaintenance } from '@/server/queries/truck-maintenance.queries';
import { isTruckMonthClosed } from '@/server/queries/truck-finance.queries';
import { TruckMaintenanceForm } from '../../_components/truck-maintenance-form';

/** Edit one maintenance job (REQ-20260904). */
export default async function EditTruckMaintenancePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  const job = await getTruckMaintenance(user.entId, id);
  if (!job) notFound();
  /* Region ACL — editing a job requires access to its truck's region. */
  if (job.region) await requireRegion(user, job.region);

  const [{ trucks }, closedFleet, closedRegion] = await Promise.all([
    resolveVehicleScope(user, undefined),
    isTruckMonthClosed(user.entId, job.month),
    job.region ? isTruckMonthClosed(user.entId, job.month, job.region) : Promise.resolve(false),
  ]);
  const t = await getTranslations('screens.truckMaintenance');

  return (
    <>
      <PageHeader
        title={t('editTitle')}
        subtitle={job.plate}
        breadcrumbs={[
          { label: t('title'), href: '/truck/maintenance' },
          { label: t('editCrumb') },
        ]}
        back="/truck/maintenance"
      />
      <div className="px-4 md:px-7 py-4 md:py-6 max-w-2xl mx-auto w-full">
        <TruckMaintenanceForm
          maintenanceId={job.id}
          initial={{
            vehicleId: job.vehicleId,
            startDate: job.startDate,
            endDate: job.endDate,
            cost: job.cost ? String(job.cost) : '',
          }}
          /* Retired trucks are not offered, except the job's own (REQ-20260907 BR-4). */
          vehicles={trucks.filter((v) => v.cvhStatus !== 'RETIRED' || v.cvhId === job.vehicleId).map((v) => ({
            id: v.cvhId,
            plate: v.cvhPlateNumber,
            label: `${v.cvhPlateNumber} · ${v.cvhModel}`,
          }))}
          locked={closedFleet || closedRegion}
        />
      </div>
    </>
  );
}
