import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { useSalesOrders, useConfirmSalesOrder, useShipSalesOrder, useCancelSalesOrder } from '@/hooks/useSalesOrders';
import { PageHeader } from '@/components/common/PageHeader';
import { DataTable, type Column } from '@/components/common/DataTable';
import { StatusBadge } from '@/components/common/StatusBadge';
import { useToastStore } from '@/stores/toast.store';

export function SalesOrderListPage() {
  const { t } = useTranslation('stock');
  const navigate = useNavigate();
  const { data, isLoading } = useSalesOrders();
  const confirm = useConfirmSalesOrder();
  const ship = useShipSalesOrder();
  const cancel = useCancelSalesOrder();
  const { showToast } = useToastStore();
  const orders: Record<string, unknown>[] = data?.data || [];

  const handleAction = async (id: string, action: 'confirm' | 'ship' | 'cancel') => {
    try {
      if (action === 'confirm') await confirm.mutateAsync(id);
      else if (action === 'ship') await ship.mutateAsync(id);
      else await cancel.mutateAsync(id);
      showToast(`${action} success`, 'success');
    } catch { showToast('Error', 'error'); }
  };

  const columns: Column<Record<string, unknown>>[] = [
    { key: 'sodOrderNo', label: t('salesOrder.orderNo') },
    { key: 'sodCustomer', label: t('salesOrder.customer') },
    { key: 'sodQty', label: t('salesOrder.qty') },
    { key: 'sodOrderDate', label: t('salesOrder.orderDate') },
    { key: 'sodStatus', label: t('salesOrder.status'), render: (r) => <StatusBadge status={String(r.sodStatus)} /> },
    {
      key: 'actions', label: t('common.actions'), render: (r) => {
        const s = String(r.sodStatus);
        return (
          <div className="flex gap-1">
            {s === 'DRAFT' && <button onClick={(e) => { e.stopPropagation(); handleAction(String(r.sodId), 'confirm'); }} className="rounded bg-blue-500 px-2 py-0.5 text-xs text-white">Confirm</button>}
            {s === 'CONFIRMED' && <button onClick={(e) => { e.stopPropagation(); handleAction(String(r.sodId), 'ship'); }} className="rounded bg-indigo-500 px-2 py-0.5 text-xs text-white">Ship</button>}
            {(s === 'DRAFT' || s === 'CONFIRMED') && <button onClick={(e) => { e.stopPropagation(); handleAction(String(r.sodId), 'cancel'); }} className="rounded bg-red-500 px-2 py-0.5 text-xs text-white">Cancel</button>}
          </div>
        );
      },
    },
  ];

  return (
    <div>
      <PageHeader
        title={t('salesOrder.title')}
        breadcrumb={['stock-management', 'sales-orders']}
        actions={<button onClick={() => navigate('/sales-orders/new')} className="flex items-center gap-1.5 rounded-md bg-emerald-600 px-3 py-1.5 text-[13px] font-medium text-white hover:bg-emerald-500"><Plus className="h-3.5 w-3.5" /> {t('salesOrder.addOrder')}</button>}
      />
      <DataTable columns={columns} data={orders} isLoading={isLoading} />
    </div>
  );
}
