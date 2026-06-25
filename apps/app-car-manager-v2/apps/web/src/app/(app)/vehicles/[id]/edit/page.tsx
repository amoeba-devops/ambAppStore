import { getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { ChevronLeft } from 'lucide-react';
import { Button } from '@car-v2/ui';
import { PageHeader } from '@/components/layout/page-header';
import { getCurrentUser } from '@/lib/auth/get-current-user';
import { getVehicle } from '@/server/queries/vehicles.queries';
import { VehicleForm } from '../../_components/vehicle-form';

export default async function EditVehiclePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const tA   = await getTranslations('actions');
  const tNav = await getTranslations('nav');
  const tCo  = await getTranslations('company');
  const user = await getCurrentUser();
  if (user.role !== 'ADMIN' && user.role !== 'MANAGER') redirect(`/vehicles/${id}`);

  const vehicle = await getVehicle(user.entId, id);
  if (!vehicle) notFound();

  return (
    <>
      <PageHeader
        title={`Edit ${vehicle.cvhPlateNumber}`}
        subtitle={vehicle.cvhModel}
        breadcrumbs={[
          { label: tCo('tenant') },
          { label: tNav('vehicles'), href: '/vehicles' },
          { label: vehicle.cvhPlateNumber, href: `/vehicles/${id}` },
          { label: 'Edit' },
        ]}
        back={`/vehicles/${id}`}
        actions={
          <Button variant="ghost" size="md" asChild>
            <Link href={`/vehicles/${id}`}><ChevronLeft />{tA('back')}</Link>
          </Button>
        }
      />

      <div className="flex-1 overflow-auto px-4 md:px-7 py-4 md:py-6">
        <VehicleForm vehicle={vehicle} />
      </div>
    </>
  );
}
