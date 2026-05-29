import { getCurrentUser, requireRole } from '@/lib/auth/get-current-user';
import { listPrimeCostsAction } from '@/server/actions/prime-cost.actions';
import { getCurrentFxRate } from '@/server/services/fx-rate.service';
import { ProductListPageClient } from '@/components/prime-cost/ProductListPageClient';

export default async function ProductListPage() {
  const user = await getCurrentUser();
  requireRole(user.role, ['OPERATOR', 'ADMIN']);
  const [res, vndPerKrw] = await Promise.all([
    listPrimeCostsAction({ search: '', limit: 500 }),
    getCurrentFxRate(user.entId),
  ]);
  const initialRows = res.success ? res.data.rows : [];
  return <ProductListPageClient initialRows={initialRows} vndPerKrw={vndPerKrw} />;
}
