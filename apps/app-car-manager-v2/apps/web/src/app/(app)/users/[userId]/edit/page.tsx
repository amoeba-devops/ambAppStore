import { redirect, notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { and, eq } from 'drizzle-orm';
import { db } from '@car-v2/db/client';
import { carUsers } from '@car-v2/db/schema';
import { getCurrentUser } from '@/lib/auth/get-current-user';
import { PageHeader } from '@/components/layout/page-header';
import { getUserDepts } from '@/server/queries/users.queries';
import { EditMemberForm } from './_components/edit-member-form';

/**
 * Admin edit existing member — local-only fields (Option 1b).
 *
 * Reads from `car_users`. To change AMA-side fields (email, name, AMA role,
 * department, jobTitle) the admin must open the AMA UI directly — car-v2 only
 * owns the LOCAL projection: app role override + block-from-car-v2 flag +
 * preferred locale.
 *
 * Access: ADMIN only.
 */
export default async function EditUserPage({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  const actor = await getCurrentUser();
  if (actor.role !== 'ADMIN') {
    redirect(actor.role === 'DRIVER' ? '/today' : '/users');
  }

  const { userId } = await params;

  const row = await db.query.carUsers.findFirst({
    where: and(eq(carUsers.usrId, userId), eq(carUsers.entId, actor.entId)),
  });
  if (!row) {
    notFound();
  }

  const t = await getTranslations('screens.editUser');
  /* Departments are the ONLY place the two apps diverge for a user (the app role
   * itself is a single global value), so they belong on this form — until now the
   * only way to set them was /settings/fleet-access, which is hidden from the menu. */
  const depts = await getUserDepts(actor.entId, row.usrId);

  return (
    <>
      <PageHeader
        title={t('title')}
        subtitle={row.usrName ?? row.usrEmail ?? userId}
        breadcrumbs={[
          { label: t('breadcrumbParent'), href: '/users' },
          { label: t('breadcrumbCurrent') },
        ]}
      />
      <div className="px-4 md:px-7 py-4 md:py-6 max-w-2xl mx-auto md:mx-0 w-full">
        <EditMemberForm
          userId={row.usrId}
          name={row.usrName}
          email={row.usrEmail}
          amaRoleSnapshot={row.usrAmaRoleSnapshot}
          localRole={row.usrLocalRole}
          depts={depts}
          blocked={row.usrDeletedAt !== null}
          isSelf={row.usrId === actor.userId}
        />
      </div>
    </>
  );
}
