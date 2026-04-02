import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link2, Plus, Pencil, Trash2, Search } from 'lucide-react';
import { useChannelMappingList, useChannelList, useCreateChannelMapping, useUpdateChannelMapping, useDeleteChannelMapping, useSkuList } from '@/hooks/useSales';
import { useToastStore } from '@/stores/toast.store';
import type { ChannelProductMapping, ChannelMaster, SkuMaster } from '@/services/sales.service';

export function ChannelMappingListPage() {
  const { t } = useTranslation('sales');
  const { showToast } = useToastStore();
  const [chnCode, setChnCode] = useState('');
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<ChannelProductMapping | null>(null);

  const { data: mappings = [], isLoading } = useChannelMappingList(
    (chnCode || search) ? { chn_code: chnCode || undefined, search: search || undefined } : undefined,
  );
  const { data: channels = [] } = useChannelList();
  const createMutation = useCreateChannelMapping();
  const updateMutation = useUpdateChannelMapping();
  const deleteMutation = useDeleteChannelMapping();

  const handleDelete = async (m: ChannelProductMapping) => {
    if (!confirm(t('channel.deleteConfirm'))) return;
    try {
      await deleteMutation.mutateAsync(m.cpmId);
      showToast(t('common.success'));
    } catch (err: any) {
      showToast(err.response?.data?.error?.message || t('common.error'), 'error');
    }
  };

  const handleSave = async (data: any) => {
    try {
      if (editing) {
        await updateMutation.mutateAsync({ id: editing.cpmId, data });
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

  const formatPrice = (n: number | null) =>
    n != null ? new Intl.NumberFormat('en-US').format(n) : '-';

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Link2 className="h-5 w-5 text-blue-600" />
          <h1 className="text-xl font-bold text-gray-900">{t('channel.title')}</h1>
        </div>
        <button
          onClick={() => { setEditing(null); setModalOpen(true); }}
          className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          <Plus className="h-4 w-4" />
          {t('common.create')}
        </button>
      </div>

      <div className="mb-4 flex gap-3">
        <select
          value={chnCode}
          onChange={(e) => setChnCode(e.target.value)}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
        >
          <option value="">{t('channel.channelCode')} - All</option>
          {channels.map((ch: ChannelMaster) => (
            <option key={ch.chnCode} value={ch.chnCode}>{ch.chnName} ({ch.chnCode})</option>
          ))}
        </select>
        <div className="relative flex-1">
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
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-gray-200 bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-gray-600">{t('sku.wmsCode')}</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">{t('sku.nameKr')}</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">{t('channel.channelCode')}</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">{t('channel.productId')}</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">{t('channel.variationId')}</th>
                <th className="px-4 py-3 text-right font-medium text-gray-600">{t('sku.sellingPrice')}</th>
                <th className="px-4 py-3 text-center font-medium text-gray-600">{t('common.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-400">{t('common.loading')}</td></tr>
              ) : mappings.length === 0 ? (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-400">{t('common.noData')}</td></tr>
              ) : (
                mappings.map((m: ChannelProductMapping) => (
                  <tr key={m.cpmId} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="px-4 py-3 font-mono text-xs">{m.wmsCode}</td>
                    <td className="px-4 py-3">{m.skuNameKr}</td>
                    <td className="px-4 py-3 font-mono text-xs">{m.chnCode}</td>
                    <td className="px-4 py-3 font-mono text-xs">{m.channelProductId || '-'}</td>
                    <td className="px-4 py-3 font-mono text-xs">{m.channelVariationId || '-'}</td>
                    <td className="px-4 py-3 text-right font-mono">{formatPrice(m.sellingPrice)}</td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <button onClick={() => { setEditing(m); setModalOpen(true); }} className="text-gray-400 hover:text-blue-600">
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button onClick={() => handleDelete(m)} className="text-gray-400 hover:text-red-600">
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
      </div>

      {modalOpen && (
        <ChannelMappingFormModal
          mapping={editing}
          channels={channels}
          onSave={handleSave}
          onClose={() => { setModalOpen(false); setEditing(null); }}
          loading={createMutation.isPending || updateMutation.isPending}
        />
      )}
    </div>
  );
}

function ChannelMappingFormModal({
  mapping,
  channels,
  onSave,
  onClose,
  loading,
}: {
  mapping: ChannelProductMapping | null;
  channels: ChannelMaster[];
  onSave: (data: any) => void;
  onClose: () => void;
  loading: boolean;
}) {
  const { t } = useTranslation('sales');
  const { data: skus = [] } = useSkuList();

  const [form, setForm] = useState({
    sku_id: mapping?.skuId || '',
    chn_code: mapping?.chnCode || '',
    channel_product_id: mapping?.channelProductId || '',
    channel_variation_id: mapping?.channelVariationId || '',
    channel_name_vi: mapping?.channelNameVi || '',
    listing_price: mapping?.listingPrice ? String(mapping.listingPrice) : '',
    selling_price: mapping?.sellingPrice ? String(mapping.sellingPrice) : '',
  });

  const set = (key: string, val: string) => setForm((prev) => ({ ...prev, [key]: val }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const payload: any = { ...form };
    if (payload.listing_price) payload.listing_price = Number(payload.listing_price);
    else delete payload.listing_price;
    if (payload.selling_price) payload.selling_price = Number(payload.selling_price);
    else delete payload.selling_price;
    onSave(payload);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="w-full max-w-lg rounded-xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <h2 className="mb-4 text-lg font-bold text-gray-900">
          {mapping ? t('channel.editTitle') : t('channel.createTitle')}
        </h2>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-600">SKU</label>
            <select
              value={form.sku_id}
              onChange={(e) => set('sku_id', e.target.value)}
              disabled={!!mapping}
              className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm disabled:bg-gray-100"
              required
            >
              <option value="">Select SKU</option>
              {skus.map((s: SkuMaster) => (
                <option key={s.skuId} value={s.skuId}>{s.wmsCode} - {s.nameKr}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600">{t('channel.channelCode')}</label>
            <select
              value={form.chn_code}
              onChange={(e) => set('chn_code', e.target.value)}
              disabled={!!mapping}
              className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm disabled:bg-gray-100"
              required
            >
              <option value="">Select Channel</option>
              {channels.map((ch) => (
                <option key={ch.chnCode} value={ch.chnCode}>{ch.chnName} ({ch.chnCode})</option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600">{t('channel.productId')}</label>
              <input value={form.channel_product_id} onChange={(e) => set('channel_product_id', e.target.value)}
                className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600">{t('channel.variationId')}</label>
              <input value={form.channel_variation_id} onChange={(e) => set('channel_variation_id', e.target.value)}
                className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600">{t('channel.channelNameVi')}</label>
            <input value={form.channel_name_vi} onChange={(e) => set('channel_name_vi', e.target.value)}
              className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600">{t('sku.listingPrice')}</label>
              <input type="number" value={form.listing_price} onChange={(e) => set('listing_price', e.target.value)}
                className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600">{t('sku.sellingPrice')}</label>
              <input type="number" value={form.selling_price} onChange={(e) => set('selling_price', e.target.value)}
                className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
            </div>
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
