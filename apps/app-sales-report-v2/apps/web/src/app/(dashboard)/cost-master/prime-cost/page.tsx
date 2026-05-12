import { PlaceholderPage } from '@/components/layout/PlaceholderPage';
import { getCurrentUser, requireRole } from '@/lib/auth/get-current-user';

export default async function PrimeCostPage() {
  const user = await getCurrentUser();
  requireRole(user.role, ['OPERATOR', 'ADMIN']);

  return (
    <PlaceholderPage
      title="Prime Cost Master"
      description="DataTable: Product ID | Variation | Name VI/EN | SKU | Prime Cost VND | Prime Cost KRW | Selling Price | Listing Price. Search debounce 300ms (FR-05 AC-02). Inline edit save on blur. Versioned via sal_prime_cost_versions — historical reports use snapshot."
      fr="FR-05"
      taskId="F-3 (T-301~309)"
    />
  );
}
