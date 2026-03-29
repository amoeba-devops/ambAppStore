import { useTranslation } from 'react-i18next';
import { useOrderBatches, useApproveBatch, useConfirmBatch } from '@/hooks/useOrderBatches';
import { PageHeader } from '@/components/common/PageHeader';
import { DataTable, type Column } from '@/components/common/DataTable';
import { StatusBadge } from '@/components/common/StatusBadge';
import { useToastStore } from '@/stores/toast.store';

export function OrderBatchListPage() {
  const { t } = useTranslation('stock');
  const { data, isLoading } = useOrderBatches();
  const approve = useApproveBatch();
  const confirmBatch = useConfirmBatch();
  const { showToast } = useToastStore();
  const batches: Record<string, unknown>[] = data?.data || [];

  const columns: Column<Record<string, unknown>>[] = [
    { key: 'obtBatchNo', label: t('orderBatch.batchNo') },
    { key: 'obtProposedQty', label: t('orderBatch.proposedQty') },
    { key: 'obtAdjustedQty', label: t('orderBatch.adjustedQty') },
    { key: 'obtFinalQty', label: t('orderBatch.finalQty') },
    { key: 'obtUrgency', label: t('orderBatch.urgency'), render: (r) => <StatusBadge status={String(r.obtUrgency)} /> },
    { key: 'obtStatus', label: t('common.status'), render: (r) => <StatusBadge status={String(r.obtStatus)} /> },
    {
      key: 'actions', label: t('common.actions'), render: (r) => {
        const s = String(r.obtStatus);
        return (
          <div className="flex gap-1">
            {(s === 'PROPOSED' || s === 'ADJUSTED') && <button onClick={() => { approve.mutateAsync(String(r.obtId)).then(() => showToast('Approved', 'success')); }} className="rounded bg-green-500 px-2 py-0.5 text-xs text-white">Approve</button>}
            {s === 'APPROVED' && <button onClick={() => { confirmBatch.mutateAsync(String(r.obtId)).then(() => showToast('Confirmed', 'success')); }} className="rounded bg-blue-500 px-2 py-0.5 text-xs text-white">Confirm</button>}
          </div>
        );
      },
    },
  ];

  return (
    <div>
      <PageHeader title={t('orderBatch.title')} breadcrumb={['stock-management', 'order-batches']} />
      <DataTable columns={columns} data={batches} isLoading={isLoading} />
    </div>
  );
}
