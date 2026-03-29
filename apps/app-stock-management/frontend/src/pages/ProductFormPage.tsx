import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useProduct, useCreateProduct, useUpdateProduct } from '@/hooks/useProducts';
import { PageHeader } from '@/components/common/PageHeader';
import { useToastStore } from '@/stores/toast.store';

export function ProductFormPage() {
  const { t } = useTranslation('stock');
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const isEdit = !!id;
  const { data: existing } = useProduct(id || '');
  const create = useCreateProduct();
  const update = useUpdateProduct();
  const { showToast } = useToastStore();

  const [form, setForm] = useState({ prd_code: '', prd_name: '', prd_category: '', prd_brand: '', prd_note: '' });

  useEffect(() => {
    if (existing?.data) {
      const d = existing.data;
      setForm({ prd_code: d.prdCode || '', prd_name: d.prdName || '', prd_category: d.prdCategory || '', prd_brand: d.prdBrand || '', prd_note: d.prdNote || '' });
    }
  }, [existing]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (isEdit) {
        await update.mutateAsync({ id: id!, data: form });
      } else {
        await create.mutateAsync(form);
      }
      showToast(isEdit ? 'Updated' : 'Created', 'success');
      navigate('/products');
    } catch {
      showToast('Error', 'error');
    }
  };

  return (
    <div>
      <PageHeader title={isEdit ? t('common.edit') : t('product.addProduct')} breadcrumb={['stock-management', 'products', isEdit ? 'edit' : 'new']} />
      <form onSubmit={handleSubmit} className="max-w-lg space-y-4 rounded-xl border border-[#e2e5eb] bg-white p-6">
        {[
          { key: 'prd_code', label: t('product.code') },
          { key: 'prd_name', label: t('product.name') },
          { key: 'prd_category', label: t('product.category') },
          { key: 'prd_brand', label: t('product.brand') },
        ].map((f) => (
          <div key={f.key}>
            <label className="mb-1 block text-sm font-medium text-gray-700">{f.label}</label>
            <input
              type="text"
              value={(form as Record<string, string>)[f.key] || ''}
              onChange={(e) => setForm((p) => ({ ...p, [f.key]: e.target.value }))}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
          </div>
        ))}
        <div className="flex gap-3 pt-2">
          <button type="submit" className="rounded-md bg-emerald-600 px-4 py-2 text-sm text-white hover:bg-emerald-500">{t('common.save')}</button>
          <button type="button" onClick={() => navigate('/products')} className="rounded-md border px-4 py-2 text-sm text-gray-600 hover:bg-gray-50">{t('common.cancel')}</button>
        </div>
      </form>
    </div>
  );
}
