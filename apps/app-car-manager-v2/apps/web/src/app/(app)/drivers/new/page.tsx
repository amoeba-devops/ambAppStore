import { getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ChevronLeft } from 'lucide-react';
import { Button } from '@car-v2/ui';
import { PageHeader } from '@/components/layout/page-header';
import { getCurrentUser } from '@/lib/auth/get-current-user';
import { listDriverCandidates } from '@/server/queries/drivers.queries';
import { DriverForm } from '../_components/driver-form';

export default async function NewDriverPage() {
  const tA   = await getTranslations('actions');
  const tNav = await getTranslations('nav');
  const tCo  = await getTranslations('company');
  const tScr = await getTranslations('screens.newDriver');
  const user = await getCurrentUser();
  if (user.role !== 'ADMIN') redirect('/drivers');

  const candidates = await listDriverCandidates(user.entId);

  return (
    <>
      <PageHeader
        title={tScr('title')}
        subtitle={tScr('subtitle')}
        breadcrumbs={[
          { label: tCo('tenant') },
          { label: tNav('drivers'), href: '/drivers' },
          { label: tA('new') },
        ]}
        back="/drivers"
        actions={
          <Button variant="ghost" size="md" asChild>
            <Link href="/drivers"><ChevronLeft />{tA('back')}</Link>
          </Button>
        }
      />

      <div className="flex-1 overflow-auto px-4 md:px-7 py-4 md:py-6">
        <DriverForm userCandidates={candidates} />
      </div>
    </>
  );
}
