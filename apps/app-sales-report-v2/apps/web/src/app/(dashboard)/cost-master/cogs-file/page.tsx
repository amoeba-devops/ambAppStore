import { PlaceholderPage } from '@/components/layout/PlaceholderPage';
import { getCurrentUser, requireRole } from '@/lib/auth/get-current-user';

export default async function CogsFilePage() {
  const user = await getCurrentUser();
  requireRole(user.role, ['OPERATOR', 'ADMIN']);

  return (
    <PlaceholderPage
      title="COGS File"
      description="Cost of Goods Sold master file management. Upload + version COGS records per SKU/period. Deferred to Phase 2 per PLAN-20260512-ui-mvp.md."
      fr="FR-06"
      taskId="Phase 2 (deferred)"
    />
  );
}
