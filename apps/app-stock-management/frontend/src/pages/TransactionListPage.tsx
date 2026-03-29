import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus } from 'lucide-react';
import { useTransactions, useCreateTransaction } from '@/hooks/useTransactions';
import { PageHeader } from '@/components/common/PageHeader';
import { DataTable, type Column } from '@/components/common/DataTable';
import { StatusBadge } from '@/components/common/StatusBadge';
import { useToastStore } from '@/stores/toast.store';

export function TransactionListPage() {
  const { t } = useTranslation('stock');
  const { data, isLoading } = useTransactions();
  const createTxn = useCreateTransaction();
  const { showToast } = useToastStore();
  const txns: Record<string, unknown>[] = data?.data || [];
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ sku_id: '', type: 'IN', reason: 'PURCHASE', qty: 0, date: new Date().toISOString().slice(0, 10), reference: '', note: '' });

  const columns: Column<Record<string, unknown>>[] = [
    { key: 'txnDate', label: t('transaction.date') },
    { key: 'txnType', label: t('transaction.type'), render: (r) => <StatusBadge status={String(r.txnType)} label={String(r.txnType) === 'IN' ? t('transaction.typeIn') : t('transaction.typeOut')} /> },
    { key: 'txnReason', label: t('transaction.reason') },
    { key: 'txnQty', label: t('transaction.qty') },
    { key: 'txnReference', label: t('transaction.reference') },
  ];

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await createTxn.mutateAsync(form);
      showToast('Created', 'success');
      setShowForm(false);
    } catch { showToast('Error', 'error'); }
  };

  return (
    <div>
      <PageHeader
        title={t('transaction.title')}
        breadcrumb={['stock-management', 'transactions']}
        actions={<button onClick={() => setShowForm(!showForm)} className="flex items-center gap-1.5 rounded-md bg-emerald-600 px-3 py-1.5 text-[13px] font-medium text-white hover:bg-emerald-500"><Plus className="h-3.5 w-3.5" /> {t('transaction.addTransaction')}</button>}
      />
      {showForm && (
        <form onSubmit={handleCreate} className="mb-4 flex flex-wrap gap-3 rounded-xl border border-[#e2e5eb] bg-white p-4">
          <input type="text" placeholder="SKU ID" value={form.sku_id} onChange={(e) => setForm(p => ({ ...p, sku_id: e.target.value }))} className="rounded border px-2 py-1 text-sm" />
          <select value={form.type} onChange={(e) => setForm(p => ({ ...p, type: e.target.value }))} className="rounded border px-2 py-1 text-sm">
            <option value="IN">IN</option><option value="OUT">OUT</option>
          </select>
          <input type="number" placeholder="Qty" value={form.qty || ''} onChange={(e) => setForm(p => ({ ...p, qty: Number(e.target.value) }))} className="w-20 rounded border px-2 py-1 text-sm" />
          <input type="date" value={form.date} onChange={(e) => setForm(p => ({ ...p, date: e.target.value }))} className="rounded border px-2 py-1 text-sm" />
          <button type="submit" className="rounded bg-emerald-600 px-3 py-1 text-sm text-white">{t('common.save')}</button>
        </form>
      )}
      <DataTable columns={columns} data={txns} isLoading={isLoading} />
    </div>
  );
}
