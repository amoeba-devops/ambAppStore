import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { getCurrentUser } from '@/lib/auth/get-current-user';
import { PageHeader } from '@/components/layout/page-header';
import { AddMemberForm } from './_components/add-member-form';

/**
 * Wave 3 — Admin/Manager tạo member bằng email.
 *
 * Access:
 *   - ADMIN (local): tạo MASTER/MANAGER/MEMBER/VIEWER
 *   - MANAGER (local): chỉ tạo MEMBER/VIEWER — UI filter trong AddMemberForm
 *   - DRIVER: redirect /today
 *
 * AMA-side dependency: POST /entity-settings/members/email-add. Xem
 * docs/integration/AMA-DEPENDENCIES.md §2.3.
 */
export default async function NewUserPage() {
  const actor = await getCurrentUser();
  if (actor.role === 'DRIVER') redirect('/today');

  const t = await getTranslations('screens.newUser');

  return (
    <>
      <PageHeader
        title={t('title')}
        subtitle={t('subtitle')}
        breadcrumbs={[
          { label: t('breadcrumbParent'), href: '/users' },
          { label: t('breadcrumbCurrent') },
        ]}
      />
      <div className="mt-6 max-w-2xl">
        <AddMemberForm actorRole={actor.role} />
      </div>
    </>
  );
}
