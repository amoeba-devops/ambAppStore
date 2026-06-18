import { getTranslations } from 'next-intl/server';
import { Truck } from 'lucide-react';
import { Card, EmptyState } from '@car-v2/ui';
import { PageHeader } from '@/components/layout/page-header';
import { MonthPicker } from '@/components/inputs/month-picker';
import { getCurrentUser } from '@/lib/auth/get-current-user';
import { listVehicles } from '@/server/queries/vehicles.queries';
import { getTruckFixedCostsByMonth } from '@/server/queries/truck-fixed-cost.queries';
import { TruckFixedCostRow } from './_components/truck-fixed-cost-row';

function currentMonth(): string {
  return new Date().toISOString().slice(0, 7);
}

export default async function TruckSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const user = await getCurrentUser();
  const sp = await searchParams;
  const month = /^\d{4}-\d{2}$/.test(sp.month ?? '') ? (sp.month as string) : currentMonth();

  const t = await getTranslations('screens.truckSettings');
  const tNav = await getTranslations('nav');
  const tCo = await getTranslations('company');

  const [trucks, fixedMap] = await Promise.all([
    listVehicles(user.entId, 'active', 'TRUCK'),
    getTruckFixedCostsByMonth(user.entId, month),
  ]);

  return (
    <>
      <PageHeader
        title={t('title')}
        subtitle={t('subtitle')}
        breadcrumbs={[{ label: tCo('tenant') }, { label: tNav('truckSettings') }]}
      />
      <div className="flex-1 overflow-auto px-4 md:px-7 py-4 md:py-6 space-y-4 max-w-3xl w-full">
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium text-text-muted">{t('monthLabel')}</span>
          <MonthPicker value={month} />
        </div>

        {trucks.length === 0 ? (
          <Card>
            <EmptyState icon={<Truck />} title={t('emptyTitle')} description={t('emptyDesc')} />
          </Card>
        ) : (
          <div className="space-y-3">
            {trucks.map((v) => (
              <TruckFixedCostRow
                key={v.cvhId}
                vehicleId={v.cvhId}
                plate={v.cvhPlateNumber}
                model={v.cvhModel}
                month={month}
                initial={fixedMap.get(v.cvhId) ?? { salary: 0, depreciation: 0, insurance: 0 }}
              />
            ))}
          </div>
        )}
      </div>
    </>
  );
}
