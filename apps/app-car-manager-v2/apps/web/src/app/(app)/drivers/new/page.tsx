import { getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ChevronLeft } from 'lucide-react';
import { Button } from '@car-v2/ui';
import { PageHeader } from '@/components/layout/page-header';
import { getCurrentUser } from '@/lib/auth/get-current-user';
import { listDriverCandidates } from '@/server/queries/drivers.queries';
import { DriverForm } from '../_components/driver-form';
import { InlineDriverForm } from '../_components/inline-driver-form';

interface PageProps {
  searchParams: Promise<{ mode?: string }>;
}

/**
 * Trang tạo tài xế — 2 modes:
 *   - mode=inline (default): tạo tài xế + user account trong 1 form
 *   - mode=existing: chọn user có sẵn rồi gắn license
 */
export default async function NewDriverPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const tA   = await getTranslations('actions');
  const tNav = await getTranslations('nav');
  const tCo  = await getTranslations('company');
  const tScr = await getTranslations('screens.newDriver');
  const user = await getCurrentUser();
  if (user.role !== 'ADMIN') redirect('/drivers');

  const mode = sp.mode === 'existing' ? 'existing' : 'inline';
  const candidates = mode === 'existing' ? await listDriverCandidates(user.entId) : [];

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
        {/* Mode toggle — 2 tab segmented control */}
        <div className="max-w-[720px] mx-auto mb-5">
          <div className="inline-flex items-center gap-1 rounded-md bg-surface-2 p-1 w-full sm:w-auto">
            <Link
              href="/drivers/new"
              className={
                'inline-flex items-center justify-center h-9 px-4 rounded text-sm font-medium transition-colors flex-1 sm:flex-initial ' +
                (mode === 'inline'
                  ? 'bg-surface text-text shadow-xs'
                  : 'text-text-muted hover:text-text')
              }
            >
              + Tạo tài xế mới
            </Link>
            <Link
              href="/drivers/new?mode=existing"
              className={
                'inline-flex items-center justify-center h-9 px-4 rounded text-sm font-medium transition-colors flex-1 sm:flex-initial ' +
                (mode === 'existing'
                  ? 'bg-surface text-text shadow-xs'
                  : 'text-text-muted hover:text-text')
              }
            >
              Chọn user có sẵn
            </Link>
          </div>
          <p className="mt-2 text-xs text-text-muted leading-relaxed">
            {mode === 'inline'
              ? '✓ Tạo tài khoản đăng nhập + license trong 1 form. Hệ thống tự tạo user AMA backing tài xế.'
              : 'Chọn 1 user đã có trong công ty và gắn thông tin bằng lái. Phù hợp khi user vừa làm admin/manager vừa lái xe.'}
          </p>
        </div>

        {mode === 'inline' ? (
          <InlineDriverForm />
        ) : (
          <DriverForm userCandidates={candidates} />
        )}
      </div>
    </>
  );
}
