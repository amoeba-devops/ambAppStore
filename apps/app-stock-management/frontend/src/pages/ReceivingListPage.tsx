import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { receivingApi } from '@/services/api';
import { PageHeader } from '@/components/common/PageHeader';
import { DataTable, type Column } from '@/components/common/DataTable';
import { StatusBadge } from '@/components/common/StatusBadge';

export function ReceivingListPage() {
  const { t } = useTranslation('stock');
  const { data, isLoading } = useQuery({ queryKey: ['receiving', 'list'], queryFn: receivingApi.getAll });
  const schedules: Record<string, unknown>[] = data?.data || [];

  const columns: Column<Record<string, unknown>>[] = [
    { key: 'rcvExpectedDate', label: 'Expected Date' },
    { key: 'rcvExpectedQty', label: 'Expected Qty' },
    { key: 'rcvReceivedQty', label: 'Received Qty' },
    { key: 'rcvSupplier', label: 'Supplier' },
    { key: 'rcvStatus', label: t('common.status'), render: (r) => <StatusBadge status={String(r.rcvStatus)} /> },
  ];

  return (
    <div>
      <PageHeader title={t('nav.receivingSchedules')} breadcrumb={['stock-management', 'receiving']} />
      <DataTable columns={columns} data={schedules} isLoading={isLoading} />
    </div>
  );
}
