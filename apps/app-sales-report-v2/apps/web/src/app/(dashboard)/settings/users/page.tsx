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
  // Merge with mock AMA members — real users (those already registered in this
  // app) override any mock seed sharing the same email.
  const realEmails = new Set(realRows.map((r) => r.email ?? '').filter(Boolean));
  const mockRows = getAmaMockMembers().filter((m) => !realEmails.has(m.email ?? ''));
  const initialRows = [...realRows, ...mockRows];

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold text-neutral-900">Settings</h1>
        <p className="mt-1 text-sm text-neutral-500">
          User management and formula configuration — Admin only
        </p>
      </div>

      <UserAccountsCard initialRows={initialRows} currentUserId={user.userId} />

      <RolePermissionMatrix />
    </div>
  );
}
