import { getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ChevronLeft, ExternalLink, UserPlus } from 'lucide-react';
import { Button, Card, CardContent } from '@car-v2/ui';
import { PageHeader } from '@/components/layout/page-header';
import { getCurrentUser } from '@/lib/auth/get-current-user';
import { listDriverCandidates } from '@/server/queries/drivers.queries';
import { DriverForm } from '@/app/(app)/drivers/_components/driver-form';

/**
 * Tạo tài xế xe tải. Mirror of /drivers/new but scoped to the TRUCK department:
 * the form passes dept="TRUCK" so createDriverAction also grants TRUCK fleet
 * access, making the new driver appear in the truck roster.
 *
 * Reachable only by ADMIN/MANAGER (the /truck layout already redirects drivers
 * and non-truck users); the redirect below is a belt-and-suspenders guard.
 */
const AMA_MEMBERS_URL = process.env.NEXT_PUBLIC_AMA_ORIGIN
  ? `${process.env.NEXT_PUBLIC_AMA_ORIGIN}/entity-settings/members`
  : null;

export default async function NewTruckDriverPage() {
  const user = await getCurrentUser();
  if (user.role !== 'ADMIN' && user.role !== 'MANAGER') redirect('/truck/drivers');

  const tA = await getTranslations('actions');
  const tNav = await getTranslations('nav');
  const tCo = await getTranslations('company');
  const tScr = await getTranslations('screens.newDriver');

  const candidates = await listDriverCandidates(user.entId);

  return (
    <>
      <PageHeader
        title={tScr('title')}
        subtitle={tScr('subtitle')}
        breadcrumbs={[
          { label: tCo('tenant') },
          { label: tNav('truckDrivers'), href: '/truck/drivers' },
          { label: tA('new') },
        ]}
        back="/truck/drivers"
        actions={
          <Button variant="ghost" size="md" asChild>
            <Link href="/truck/drivers"><ChevronLeft />{tA('back')}</Link>
          </Button>
        }
      />

      <div className="flex-1 overflow-auto px-4 md:px-7 py-4 md:py-6">
        {candidates.length === 0 ? (
          <Card variant="outline" className="max-w-[720px] mx-auto">
            <CardContent className="text-center py-10 space-y-4">
              <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-accent-soft text-accent">
                <UserPlus className="h-5 w-5" />
              </div>
              <div>
                <div className="text-md font-semibold text-text">{tScr('emptyHeading')}</div>
                <p className="mt-1 text-sm text-text-muted max-w-md mx-auto">{tScr('emptyDesc')}</p>
              </div>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-2 pt-2">
                {AMA_MEMBERS_URL && (
                  <Button variant="accent" size="md" iconLeft={<ExternalLink />} asChild>
                    <a href={AMA_MEMBERS_URL} target="_blank" rel="noreferrer">
                      {tScr('createUserCta')}
                    </a>
                  </Button>
                )}
                <Button variant="ghost" size="md" asChild>
                  <Link href="/truck/drivers">{tA('back')}</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <DriverForm userCandidates={candidates} dept="TRUCK" />
        )}
      </div>
    </>
  );
}
