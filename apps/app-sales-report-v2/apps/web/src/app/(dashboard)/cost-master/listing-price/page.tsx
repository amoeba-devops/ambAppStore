import { getCurrentUser, requireRole } from '@/lib/auth/get-current-user';
import { listFlatVersionsAction } from '@/server/actions/prime-cost.actions';
import { PriceVersionPageClient } from '@/components/prime-cost/PriceVersionPageClient';

export default async function ListingPricePage() {
  const user = await getCurrentUser();
  requireRole(user.role, ['OPERATOR', 'ADMIN']);
  const res = await listFlatVersionsAction({ field: 'listing' });
  const initialVersions = res.success ? res.data.rows : [];
  return <PriceVersionPageClient field="listing" initialVersions={initialVersions} />;
}
