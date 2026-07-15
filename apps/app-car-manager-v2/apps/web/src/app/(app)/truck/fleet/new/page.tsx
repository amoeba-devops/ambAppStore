import { getTranslations } from 'next-intl/server';
import { PageHeader } from '@/components/layout/page-header';
import { getCurrentUser } from '@/lib/auth/get-current-user';
import { listFleetDrivers } from '@/server/queries/drivers.queries';
import { TruckVehicleForm } from '../_components/truck-vehicle-form';

export default async function NewTruckPage() {
  const t = await getTranslations('screens.truckFleet');
  const user = await getCurrentUser();
  const drivers = (await listFleetDrivers(user.entId, 'TRUCK')).map((d) => ({
    id: d.drvId,
    name: d.user.usrName ?? d.user.usrEmail ?? d.drvId,
  }));

  return (
    <>
      <PageHeader
        title={t('newTitle')}
        subtitle={t('newSubtitle')}
        breadcrumbs={[
          { label: t('title'), href: '/truck/fleet' },
          { label: t('newCrumb') },
        ]}
      />
      {/* Form canh giữa màn hình (QA P2 R21). */}
      <div className="px-4 md:px-7 py-4 md:py-6 max-w-2xl mx-auto w-full">
        <TruckVehicleForm drivers={drivers} />
      </div>
    </>
  );
}
