import { getCurrentUser, requireRole } from '@/lib/auth/get-current-user';
import { listFlatVersionsAction } from '@/server/actions/prime-cost.actions';
import { getCurrentFxRate } from '@/server/services/fx-rate.service';
import { PriceVersionPageClient } from '@/components/prime-cost/PriceVersionPageClient';

export default async function PrimeCostPage() {
  const user = await getCurrentUser();
  requireRole(user.role, ['OPERATOR', 'ADMIN']);
  const [res, vndPerKrw] = await Promise.all([
    listFlatVersionsAction({ field: 'prime' }),
    getCurrentFxRate(user.entId),
  ]);
  const initialVersions = res.success ? res.data.rows : [];
  return (
    <PriceVersionPageClient field="prime" initialVersions={initialVersions} vndPerKrw={vndPerKrw} />
  );
}
