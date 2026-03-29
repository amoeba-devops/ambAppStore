import { useTranslation } from 'react-i18next';
import { useSafetyStocks } from '@/hooks/useSafetyStocks';
import { PageHeader } from '@/components/common/PageHeader';
import { DataTable, type Column } from '@/components/common/DataTable';

export function SafetyStockListPage() {
  const { t } = useTranslation('stock');
  const { data, isLoading } = useSafetyStocks();
  const stocks: Record<string, unknown>[] = data?.data || [];

  const columns: Column<Record<string, unknown>>[] = [
    { key: 'skuId', label: 'SKU', render: (r) => String(r.skuId).slice(0, 8) },
    { key: 'sfsSafetyQty', label: t('safetyStock.safetyQty') },
    { key: 'sfsTargetQty', label: t('safetyStock.targetQty') },
    { key: 'sfsSigma', label: 'σ' },
  ];

  return (
    <div>
      <PageHeader title={t('safetyStock.title')} breadcrumb={['stock-management', 'safety-stocks']} />
      <DataTable columns={columns} data={stocks} isLoading={isLoading} />
    </div>
  );
}
