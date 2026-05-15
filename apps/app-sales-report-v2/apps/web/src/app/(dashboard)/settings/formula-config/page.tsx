import { getCurrentUser, requireRole } from '@/lib/auth/get-current-user';
import { FormulaConfigClient } from '@/components/formula-config/FormulaConfigClient';

export default async function FormulaConfigPage() {
  const user = await getCurrentUser();
  requireRole(user.role, ['ADMIN']);
  return <FormulaConfigClient />;
}
