import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Package, Plus, Pencil, Trash2, Search } from 'lucide-react';
import { useSpuList, useCreateSpu, useUpdateSpu, useDeleteSpu } from '@/hooks/useSales';
import { useToastStore } from '@/stores/toast.store';
import type { SpuMaster } from '@/services/sales.service';

export function SpuMasterListPage() {
  const { t } = useTranslation('sales');
  const { showToast } = useToastStore();
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<SpuMaster | null>(null);

  const { data: spus = [], isLoading } = useSpuList(search || undefined);
  const createMutation = useCreateSpu();
  const updateMutation = useUpdateSpu();
  const deleteMutation = useDeleteSpu();

  const handleDelete = async (spu: SpuMaster) => {
    if (!confirm(t('spu.deleteConfirm'))) return;
    try {
      await deleteMutation.mutateAsync(spu.spuId);
      showToast(t('common.success'));
    } catch (err: any) {
      showToast(err.response?.data?.error?.message || t('common.error'), 'error');
    }
  };

  const handleSave = async (data: any) => {
    try {
      if (editing) {
        await updateMutation.mutateAsync({ id: editing.spuId, data });
      } else {
        await createMutation.mutateAsync(data);
      }
      showToast(t('common.success'));
      setModalOpen(false);
      setEditing(null);
    } catch (err: any) {
      showToast(err.response?.data?.error?.message || t('common.error'), 'error');
    }
  };

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Package className="h-5 w-5 text-blue-600" />
          <h1 className="text-xl font-bold text-gray-900">{t('spu.title')}</h1>
        </div>
        <button
          onClick={() => { setEditing(null); setModalOpen(true); }}
          className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          <Plus className="h-4 w-4" />
          {t('common.create')}
        </button>
      </div>

      <div className="mb-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('common.search')}
            className="w-full rounded-lg border border-gray-300 py-2 pl-10 pr-4 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
        <table className="w-full text-sm">
          <thead className="border-b border-gray-200 bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left font-medium text-gray-600">{t('spu.spuCode')}</th>
              <th className="px-4 py-3 text-left font-medium text-gray-600">{t('spu.brandCode')}</th>
              <th className="px-4 py-3 text-left font-medium text-gray-600">{t('spu.nameKr')}</th>
              <th className="px-4 py-3 text-left font-medium text-gray-600">{t('spu.category')}</th>
              <th className="px-4 py-3 text-center font-medium text-gray-600">{t('spu.isActive')}</th>
              <th className="px-4 py-3 text-center font-medium text-gray-600">{t('common.actions')}</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400">{t('common.loading')}</td></tr>
            ) : spus.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400">{t('common.noData')}</td></tr>
            ) : (
              spus.map((spu: SpuMaster) => (
                <tr key={spu.spuId} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="px-4 py-3 font-mono text-xs">{spu.spuCode}</td>
                  <td className="px-4 py-3">{spu.brandCode}</td>
                  <td className="px-4 py-3 font-medium">{spu.nameKr}</td>
                  <td className="px-4 py-3 text-gray-500">{spu.category || '-'}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${spu.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                      {spu.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <div className="flex items-center justify-center gap-2">
                      <button onClick={() => { setEditing(spu); setModalOpen(true); }} className="text-gray-400 hover:text-blue-600">
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button onClick={() => handleDelete(spu)} className="text-gray-400 hover:text-red-600">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {modalOpen && (
        <SpuFormModal
          spu={editing}
          onSave={handleSave}
          onClose={() => { setModalOpen(false); setEditing(null); }}
          loading={createMutation.isPending || updateMutation.isPending}
        />
      )}
    </div>
  );
}

function SpuFormModal({
  spu,
  onSave,
  onClose,
  loading,
}: {
  spu: SpuMaster | null;
  onSave: (data: any) => void;
  onClose: () => void;
  loading: boolean;
}) {
  const { t } = useTranslation('sales');
  const [form, setForm] = useState({
    spu_code: spu?.spuCode || '',
    brand_code: spu?.brandCode || '',
    sub_brand_code: spu?.subBrandCode || '',
    spu_name_kr: spu?.nameKr || '',
    spu_name_en: spu?.nameEn || '',
    spu_name_vi: spu?.nameVi || '',
    spu_category: spu?.category || '',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(form);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="w-full max-w-lg rounded-xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <h2 className="mb-4 text-lg font-bold text-gray-900">
          {spu ? t('spu.editTitle') : t('spu.createTitle')}
        </h2>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600">{t('spu.spuCode')}</label>
              <input value={form.spu_code} onChange={(e) => setForm({ ...form, spu_code: e.target.value })}
                disabled={!!spu} className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm disabled:bg-gray-100" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600">{t('spu.brandCode')}</label>
              <input value={form.brand_code} onChange={(e) => setForm({ ...form, brand_code: e.target.value })}
                className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600">{t('spu.subBrandCode')}</label>
            <input value={form.sub_brand_code} onChange={(e) => setForm({ ...form, sub_brand_code: e.target.value })}
              className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600">{t('spu.nameKr')}</label>
            <input value={form.spu_name_kr} onChange={(e) => setForm({ ...form, spu_name_kr: e.target.value })}
              className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" required />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600">{t('spu.nameEn')}</label>
              <input value={form.spu_name_en} onChange={(e) => setForm({ ...form, spu_name_en: e.target.value })}
                className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600">{t('spu.nameVi')}</label>
              <input value={form.spu_name_vi} onChange={(e) => setForm({ ...form, spu_name_vi: e.target.value })}
                className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600">{t('spu.category')}</label>
            <input value={form.spu_category} onChange={(e) => setForm({ ...form, spu_category: e.target.value })}
              className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">
              {t('common.cancel')}
            </button>
            <button type="submit" disabled={loading} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
              {loading ? t('common.loading') : t('common.save')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
