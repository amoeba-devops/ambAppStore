import { getTranslations } from 'next-intl/server';
import { PageHeader } from '@/components/layout/page-header';
import { TruckVehicleForm } from '../_components/truck-vehicle-form';

export default async function NewTruckPage() {
  const t = await getTranslations('screens.truckFleet');

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
      <div className="px-4 md:px-7 py-4 md:py-6 max-w-2xl mx-auto md:mx-0 w-full">
        <TruckVehicleForm />
      </div>
    </>
  );
}
