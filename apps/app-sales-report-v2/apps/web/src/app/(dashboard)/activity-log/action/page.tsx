import { PlaceholderPage } from '@/components/layout/PlaceholderPage';
import { getCurrentUser, requireRole } from '@/lib/auth/get-current-user';

export default async function ActionHistoryPage() {
  const user = await getCurrentUser();
  requireRole(user.role, ['MANAGER', 'ADMIN']);

  return (
    <PlaceholderPage
      title="Action History"
      description="Immutable log of mutations per FR-20: upload | manual_input create/edit/delete | prime_cost edit | formula_config edit | fx_rate change. Columns: user | action | target | before | after | timestamp. Filter by type + date."
      fr="FR-20"
      taskId="F-5 (T-502)"
    />
  );
}
