import { getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ChevronLeft, UserPlus } from 'lucide-react';
import { Button, Card, CardContent } from '@car-v2/ui';
import { PageHeader } from '@/components/layout/page-header';
import { getCurrentUser } from '@/lib/auth/get-current-user';
import { listDriverCandidates } from '@/server/queries/drivers.queries';
import { DriverForm } from '../_components/driver-form';

/**
 * Tạo tài xế — chọn user có sẵn trong entity rồi gắn license.
 *
 * User mới phải được tạo qua /users/new (sync AMA) — trang này KHÔNG tạo user inline.
 * REQ-20260526 §3.4.
 */
export default async function NewDriverPage() {
  const tA   = await getTranslations('actions');
  const tNav = await getTranslations('nav');
  const tCo  = await getTranslations('company');
  const tScr = await getTranslations('screens.newDriver');
  const user = await getCurrentUser();
  if (user.role !== 'ADMIN' && user.role !== 'MANAGER') redirect('/drivers');

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
        {candidates.length === 0 ? (
          <Card variant="outline" className="max-w-[720px] mx-auto">
            <CardContent className="text-center py-10 space-y-4">
              <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-accent-soft text-accent">
                <UserPlus className="h-5 w-5" />
              </div>
              <div>
                <div className="text-md font-semibold text-text">
                  {tScr('emptyHeading')}
                </div>
                <p className="mt-1 text-sm text-text-muted max-w-md mx-auto">
                  {tScr('emptyDesc')}
                </p>
              </div>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-2 pt-2">
                <Button variant="accent" size="md" asChild>
                  <Link href="/users/new">{tScr('createUserCta')}</Link>
                </Button>
                <Button variant="ghost" size="md" asChild>
                  <Link href="/drivers">{tA('back')}</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <DriverForm userCandidates={candidates} />
        )}
      </div>
    </>
  );
}
