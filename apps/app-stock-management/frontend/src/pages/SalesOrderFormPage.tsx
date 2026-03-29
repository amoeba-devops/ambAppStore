import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useCreateSalesOrder } from '@/hooks/useSalesOrders';
import { PageHeader } from '@/components/common/PageHeader';
import { useToastStore } from '@/stores/toast.store';

export function SalesOrderFormPage() {
  const { t } = useTranslation('stock');
  const navigate = useNavigate();
  const create = useCreateSalesOrder();
  const { showToast } = useToastStore();
  const [form, setForm] = useState({ sku_id: '', customer: '', qty: 0, unit_price: 0, order_date: new Date().toISOString().slice(0, 10), note: '' });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try { await create.mutateAsync(form); showToast('Created', 'success'); navigate('/sales-orders'); }
    catch { showToast('Error', 'error'); }
  };

  return (
    <div>
      <PageHeader title={t('salesOrder.addOrder')} breadcrumb={['stock-management', 'sales-orders', 'new']} />
      <form onSubmit={handleSubmit} className="max-w-lg space-y-4 rounded-xl border border-[#e2e5eb] bg-white p-6">
        <div><label className="mb-1 block text-sm font-medium text-gray-700">SKU ID</label><input type="text" value={form.sku_id} onChange={(e) => setForm(p => ({ ...p, sku_id: e.target.value }))} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" /></div>
        <div><label className="mb-1 block text-sm font-medium text-gray-700">{t('salesOrder.customer')}</label><input type="text" value={form.customer} onChange={(e) => setForm(p => ({ ...p, customer: e.target.value }))} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" /></div>
        <div><label className="mb-1 block text-sm font-medium text-gray-700">{t('salesOrder.qty')}</label><input type="number" value={form.qty || ''} onChange={(e) => setForm(p => ({ ...p, qty: Number(e.target.value) }))} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" /></div>
        <div><label className="mb-1 block text-sm font-medium text-gray-700">{t('salesOrder.unitPrice')}</label><input type="number" value={form.unit_price || ''} onChange={(e) => setForm(p => ({ ...p, unit_price: Number(e.target.value) }))} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" /></div>
        <div className="flex gap-3 pt-2">
          <button type="submit" className="rounded-md bg-emerald-600 px-4 py-2 text-sm text-white hover:bg-emerald-500">{t('common.save')}</button>
          <button type="button" onClick={() => navigate('/sales-orders')} className="rounded-md border px-4 py-2 text-sm text-gray-600 hover:bg-gray-50">{t('common.cancel')}</button>
        </div>
      </form>
    </div>
  );
}
