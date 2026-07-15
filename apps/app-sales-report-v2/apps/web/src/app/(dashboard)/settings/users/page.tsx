import { getTranslations } from 'next-intl/server';
import { getCurrentUser, requireRole } from '@/lib/auth/get-current-user';
import { listUsersAction } from '@/server/actions/user.actions';
import { UserAccountsCard } from '@/components/users/UserAccountsCard';
import { RolePermissionMatrix } from '@/components/users/RolePermissionMatrix';
import { getAmaMockMembers } from '@/lib/users-mock';

export default async function UserManagementPage() {
  const user = await getCurrentUser();
  requireRole(user.role, ['ADMIN']);

  const res = await listUsersAction({});
  const realRows = res.success ? res.data.rows : [];
  // Demo roster only — real tenants see solely their own ent_id-scoped
  // sal_users (auto-provisioned at login + "Sync from AMA"). Injecting the
  // fixed mock list for a real tenant would leak cross-tenant data.
  const mockSeeds = process.env.DEMO_AUTO_LOGIN === 'true' ? getAmaMockMembers() : [];
  const t = await getTranslations('usersPage');

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold text-neutral-900">{t('title')}</h1>
        <p className="mt-1 text-sm text-neutral-500">{t('subtitle')}</p>
      </div>

      <UserAccountsCard
        initialRealRows={realRows}
        mockSeeds={mockSeeds}
        currentUserId={user.userId}
      />

      <RolePermissionMatrix />
    </div>
  );
}
