import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useSku, useCreateSku, useUpdateSku } from '@/hooks/useSkus';
import { useProducts } from '@/hooks/useProducts';
import { PageHeader } from '@/components/common/PageHeader';
import { useToastStore } from '@/stores/toast.store';

export function SkuFormPage() {
  const { t } = useTranslation('stock');
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const isEdit = !!id;
  const { data: existing } = useSku(id || '');
  const { data: prodData } = useProducts();
  const create = useCreateSku();
  const update = useUpdateSku();
  const { showToast } = useToastStore();
  const products: Record<string, unknown>[] = prodData?.data || [];

  const [form, setForm] = useState<Record<string, string | number>>({
    prd_id: '', sku_code: '', sku_name: '', sku_spec: '', sku_unit: 'EA', sku_moq: 1,
    sku_cost_price: '', sku_sell_price: '', sku_supplier: '', sku_note: '',
  });

  useEffect(() => {
    if (existing?.data) {
      const d = existing.data;
      setForm({
        prd_id: d.prdId || '', sku_code: d.skuCode || '', sku_name: d.skuName || '', sku_spec: d.skuSpec || '',
        sku_unit: d.skuUnit || 'EA', sku_moq: d.skuMoq || 1,
        sku_cost_price: d.skuCostPrice || '', sku_sell_price: d.skuSellPrice || '',
        sku_supplier: d.skuSupplier || '', sku_note: d.skuNote || '',
      });
    }
  }, [existing]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (isEdit) { await update.mutateAsync({ id: id!, data: form }); }
      else { await create.mutateAsync(form); }
      showToast(isEdit ? 'Updated' : 'Created', 'success');
      navigate('/skus');
    } catch { showToast('Error', 'error'); }
  };

  return (
    <div>
      <PageHeader title={isEdit ? t('common.edit') : t('sku.addSku')} breadcrumb={['stock-management', 'skus', isEdit ? 'edit' : 'new']} />
      <form onSubmit={handleSubmit} className="max-w-lg space-y-4 rounded-xl border border-[#e2e5eb] bg-white p-6">
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">{t('product.name')}</label>
          <select value={String(form.prd_id)} onChange={(e) => setForm(p => ({ ...p, prd_id: e.target.value }))} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none">
            <option value="">---</option>
            {products.map((p) => <option key={String(p.prdId)} value={String(p.prdId)}>{String(p.prdName)}</option>)}
          </select>
        </div>
        {['sku_code', 'sku_name', 'sku_spec', 'sku_unit', 'sku_supplier'].map((k) => (
          <div key={k}>
            <label className="mb-1 block text-sm font-medium text-gray-700">{k.replace('sku_', '').replace(/_/g, ' ')}</label>
            <input type="text" value={String(form[k] || '')} onChange={(e) => setForm(p => ({ ...p, [k]: e.target.value }))} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none" />
          </div>
        ))}
        {['sku_moq', 'sku_cost_price', 'sku_sell_price'].map((k) => (
          <div key={k}>
            <label className="mb-1 block text-sm font-medium text-gray-700">{k.replace('sku_', '').replace(/_/g, ' ')}</label>
            <input type="number" value={String(form[k] || '')} onChange={(e) => setForm(p => ({ ...p, [k]: e.target.value }))} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none" />
          </div>
        ))}
        <div className="flex gap-3 pt-2">
          <button type="submit" className="rounded-md bg-emerald-600 px-4 py-2 text-sm text-white hover:bg-emerald-500">{t('common.save')}</button>
          <button type="button" onClick={() => navigate('/skus')} className="rounded-md border px-4 py-2 text-sm text-gray-600 hover:bg-gray-50">{t('common.cancel')}</button>
        </div>
      </form>
    </div>
  );
}
