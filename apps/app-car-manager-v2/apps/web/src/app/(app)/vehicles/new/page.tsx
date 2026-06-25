import { getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ChevronLeft } from 'lucide-react';
import { Button } from '@car-v2/ui';
import { PageHeader } from '@/components/layout/page-header';
import { getCurrentUser } from '@/lib/auth/get-current-user';
import { VehicleForm } from '../_components/vehicle-form';

export default async function NewVehiclePage() {
  const tA   = await getTranslations('actions');
  const tNav = await getTranslations('nav');
  const tCo  = await getTranslations('company');
  const tScr = await getTranslations('screens.newVehicle');
  const user = await getCurrentUser();
  if (user.role !== 'ADMIN' && user.role !== 'MANAGER') redirect('/vehicles');

  return (
    <>
      <PageHeader
        title={tScr('title')}
        subtitle={tScr('subtitle')}
        breadcrumbs={[
          { label: tCo('tenant') },
          { label: tNav('vehicles'), href: '/vehicles' },
          { label: tA('new') },
        ]}
        back="/vehicles"
        actions={
          <Button variant="ghost" size="md" asChild>
            <Link href="/vehicles"><ChevronLeft />{tA('back')}</Link>
          </Button>
        }
      />

      <div className="flex-1 overflow-auto px-4 md:px-7 py-4 md:py-6">
        <VehicleForm />
      </div>
    </>
  );
}
