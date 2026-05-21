import { getTranslations } from 'next-intl/server';
import { getCurrentUser, requireRole } from '@/lib/auth/get-current-user';
import { listPrimeCostsAction } from '@/server/actions/prime-cost.actions';
import { PrimeCostTable } from '@/components/prime-cost/PrimeCostTable';

export default async function PrimeCostPage() {
  const user = await getCurrentUser();
  requireRole(user.role, ['OPERATOR', 'ADMIN']);

  const res = await listPrimeCostsAction({});
  const initialRows = res.success ? res.data.rows : [];
  const initialTotal = res.success ? res.data.total : 0;
  const t = await getTranslations('primeCost');

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold text-neutral-900">{t('pageTitle')}</h1>
        <p className="mt-1 text-sm text-neutral-500">{t('pageSubtitle')}</p>
      </div>

      <PrimeCostTable initialRows={initialRows} initialTotal={initialTotal} />
    </div>
  );
}
