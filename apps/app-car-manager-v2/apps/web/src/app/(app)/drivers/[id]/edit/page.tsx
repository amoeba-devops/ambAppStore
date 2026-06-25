import { getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { ChevronLeft } from 'lucide-react';
import { Button } from '@car-v2/ui';
import { PageHeader } from '@/components/layout/page-header';
import { getCurrentUser } from '@/lib/auth/get-current-user';
import { getDriver } from '@/server/queries/drivers.queries';
import { DriverForm } from '../../_components/driver-form';

export default async function EditDriverPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const tA   = await getTranslations('actions');
  const tNav = await getTranslations('nav');
  const tCo  = await getTranslations('company');
  const user = await getCurrentUser();
  if (user.role !== 'ADMIN' && user.role !== 'MANAGER') redirect(`/drivers/${id}`);

  const driver = await getDriver(user.entId, id);
  if (!driver) notFound();

  return (
    <>
      <PageHeader
        title={`Edit ${driver.user.usrName ?? 'driver'}`}
        subtitle={`${driver.drvLicenseNumber} · Class ${driver.drvLicenseClass}`}
        breadcrumbs={[
          { label: tCo('tenant') },
          { label: tNav('drivers'), href: '/drivers' },
          { label: driver.user.usrName ?? id, href: `/drivers/${id}` },
          { label: 'Edit' },
        ]}
        back={`/drivers/${id}`}
        actions={
          <Button variant="ghost" size="md" asChild>
            <Link href={`/drivers/${id}`}><ChevronLeft />{tA('back')}</Link>
          </Button>
        }
      />

      <div className="flex-1 overflow-auto px-4 md:px-7 py-4 md:py-6">
        <DriverForm driver={driver} />
      </div>
    </>
  );
}
