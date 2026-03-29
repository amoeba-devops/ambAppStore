import { useTranslation } from 'react-i18next';
import { useInventories } from '@/hooks/useInventories';
import { PageHeader } from '@/components/common/PageHeader';
import { DataTable, type Column } from '@/components/common/DataTable';

export function InventoryListPage() {
  const { t } = useTranslation('stock');
  const { data, isLoading } = useInventories();
  const inventories: Record<string, unknown>[] = data?.data || [];

  const columns: Column<Record<string, unknown>>[] = [
    { key: 'skuId', label: 'SKU', render: (r) => String(r.skuId).slice(0, 8) },
    { key: 'invCurrentQty', label: t('inventory.currentQty') },
    { key: 'invPendingShipmentQty', label: t('inventory.pendingQty') },
    { key: 'availableToSell', label: t('inventory.ats'), render: (r) => <span className="font-semibold text-emerald-700">{String(r.availableToSell)}</span> },
  ];

  return (
    <div>
      <PageHeader title={t('inventory.title')} breadcrumb={['stock-management', 'inventories']} />
      <DataTable columns={columns} data={inventories} isLoading={isLoading} />
    </div>
  );
}
