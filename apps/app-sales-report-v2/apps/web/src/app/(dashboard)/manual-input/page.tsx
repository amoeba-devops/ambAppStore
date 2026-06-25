import { PlaceholderPage } from '@/components/layout/PlaceholderPage';
import { getCurrentUser, requireRole } from '@/lib/auth/get-current-user';

export default async function ManualInputPage() {
  const user = await getCurrentUser();
  requireRole(user.role, ['OPERATOR', 'ADMIN']);

  return (
    <PlaceholderPage
      title="Manual Cost Input"
      description="Form 12 numeric fields (5 main + 7 TikTok platform subitems) + FX rate field. Upsert vào sal_manual_inputs by (entId, fieldCode, periodStart). FX rate default 17.543 VND per KRW (config qua formula). Save → trigger recalc."
      fr="FR-04"
      taskId="F-2 (T-201~206)"
    />
  );
}
