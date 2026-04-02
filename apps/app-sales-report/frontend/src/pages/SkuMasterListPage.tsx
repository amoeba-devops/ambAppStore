import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Barcode, Plus, Pencil, Trash2, Search, History, Download, Upload, FileSpreadsheet } from 'lucide-react';
import { useSkuList, useCreateSku, useUpdateSku, useDeleteSku, useSkuCostHistory } from '@/hooks/useSales';
import { useDownloadTemplate, useExportProductMaster, useImportProductMaster } from '@/hooks/useProductMasterExcel';
import { useToastStore } from '@/stores/toast.store';
import type { SkuMaster, SkuCostHistory } from '@/services/sales.service';

export function SkuMasterListPage() {
  const { t } = useTranslation('sales');
  const { showToast } = useToastStore();
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<SkuMaster | null>(null);
  const [historySkuId, setHistorySkuId] = useState<string | null>(null);
  const [importModalOpen, setImportModalOpen] = useState(false);

  const { data: skus = [], isLoading } = useSkuList(search ? { search } : undefined);
  const createMutation = useCreateSku();
  const updateMutation = useUpdateSku();
  const deleteMutation = useDeleteSku();
  const templateMutation = useDownloadTemplate();
  const exportMutation = useExportProductMaster();
  const importMutation = useImportProductMaster();

  const handleDelete = async (sku: SkuMaster) => {
    if (!confirm(t('sku.deleteConfirm'))) return;
    try {
      await deleteMutation.mutateAsync(sku.skuId);
      showToast(t('common.success'));
    } catch (err: any) {
      showToast(err.response?.data?.error?.message || t('common.error'), 'error');
    }
  };

  const handleSave = async (data: any) => {
    try {
      if (editing) {
        await updateMutation.mutateAsync({ id: editing.skuId, data });
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

  const formatPrice = (n: number) =>
    new Intl.NumberFormat('en-US', { minimumFractionDigits: 0 }).format(n);

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Barcode className="h-5 w-5 text-blue-600" />
          <h1 className="text-xl font-bold text-gray-900">{t('sku.title')}</h1>
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

      {/* Excel Toolbar */}
      <div className="mb-4 flex items-center gap-2">
        <button
          onClick={() => templateMutation.mutate()}
          disabled={templateMutation.isPending}
          className="flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50"
        >
          <FileSpreadsheet className="h-4 w-4" />
          {t('productMaster.template')}
        </button>
        <button
          onClick={() => exportMutation.mutate()}
          disabled={exportMutation.isPending}
          className="flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50"
        >
          <Download className="h-4 w-4" />
          {t('productMaster.export')}
        </button>
        <button
          onClick={() => setImportModalOpen(true)}
          className="flex items-center gap-1.5 rounded-lg border border-blue-300 bg-blue-50 px-3 py-2 text-sm text-blue-700 hover:bg-blue-100"
        >
          <Upload className="h-4 w-4" />
          {t('productMaster.import')}
        </button>
      </div>

      <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-gray-200 bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-gray-600">{t('sku.wmsCode')}</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">{t('sku.spuCode')}</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">{t('sku.nameKr')}</th>
                <th className="px-4 py-3 text-right font-medium text-gray-600">{t('sku.primeCost')}</th>
                <th className="px-4 py-3 text-right font-medium text-gray-600">{t('sku.sellingPrice')}</th>
                <th className="px-4 py-3 text-center font-medium text-gray-600">{t('common.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400">{t('common.loading')}</td></tr>
              ) : skus.length === 0 ? (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400">{t('common.noData')}</td></tr>
              ) : (
                skus.map((sku: SkuMaster) => (
                  <tr key={sku.skuId} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="px-4 py-3 font-mono text-xs">{sku.wmsCode}</td>
                    <td className="px-4 py-3 font-mono text-xs text-gray-500">{sku.spuCode}</td>
                    <td className="px-4 py-3 font-medium">{sku.nameKr}</td>
                    <td className="px-4 py-3 text-right font-mono">{formatPrice(sku.primeCost)}</td>
                    <td className="px-4 py-3 text-right font-mono">{formatPrice(sku.sellingPrice)}</td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <button onClick={() => setHistorySkuId(sku.skuId)} className="text-gray-400 hover:text-purple-600" title={t('sku.costHistory')}>
                          <History className="h-4 w-4" />
                        </button>
                        <button onClick={() => { setEditing(sku); setModalOpen(true); }} className="text-gray-400 hover:text-blue-600">
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button onClick={() => handleDelete(sku)} className="text-gray-400 hover:text-red-600">
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
        <SkuFormModal
          sku={editing}
          onSave={handleSave}
          onClose={() => { setModalOpen(false); setEditing(null); }}
          loading={createMutation.isPending || updateMutation.isPending}
        />
      )}

      {historySkuId && (
        <CostHistoryDrawer skuId={historySkuId} onClose={() => setHistorySkuId(null)} />
      )}

      {importModalOpen && (
        <ExcelImportModal
          onClose={() => setImportModalOpen(false)}
          onImport={importMutation}
        />
      )}
    </div>
  );
}

function SkuFormModal({
  sku,
  onSave,
  onClose,
  loading,
}: {
  sku: SkuMaster | null;
  onSave: (data: any) => void;
  onClose: () => void;
  loading: boolean;
}) {
  const { t } = useTranslation('sales');
  const [form, setForm] = useState({
    wms_code: sku?.wmsCode || '',
    sku_name_kr: sku?.nameKr || '',
    sku_name_en: sku?.nameEn || '',
    sku_name_vi: sku?.nameVi || '',
    sku_variant: sku?.variant || '',
    sync_code: sku?.syncCode || '',
    gtin_code: sku?.gtinCode || '',
    hs_code: sku?.hsCode || '',
    prime_cost: String(sku?.primeCost || ''),
    supply_price: String(sku?.supplyPrice || ''),
    listing_price: String(sku?.listingPrice || ''),
    selling_price: String(sku?.sellingPrice || ''),
    fulfillment_fee_override: sku?.fulfillmentFeeOverride ? String(sku.fulfillmentFeeOverride) : '',
    weight: sku?.weight ? String(sku.weight) : '',
    unit: sku?.unit || 'EA',
    cost_change_memo: '',
  });

  const set = (key: string, val: string) => setForm((prev) => ({ ...prev, [key]: val }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const payload: any = { ...form };
    ['prime_cost', 'supply_price', 'listing_price', 'selling_price', 'fulfillment_fee_override', 'weight'].forEach((k) => {
      if (payload[k]) payload[k] = Number(payload[k]);
      else delete payload[k];
    });
    onSave(payload);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <h2 className="mb-4 text-lg font-bold text-gray-900">
          {sku ? t('sku.editTitle') : t('sku.createTitle')}
        </h2>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-600">{t('sku.wmsCode')}</label>
            <input value={form.wms_code} onChange={(e) => set('wms_code', e.target.value)}
              disabled={!!sku} className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm disabled:bg-gray-100" required />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600">{t('sku.nameKr')}</label>
              <input value={form.sku_name_kr} onChange={(e) => set('sku_name_kr', e.target.value)}
                className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" required />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600">{t('sku.nameEn')}</label>
              <input value={form.sku_name_en} onChange={(e) => set('sku_name_en', e.target.value)}
                className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600">{t('sku.nameVi')}</label>
              <input value={form.sku_name_vi} onChange={(e) => set('sku_name_vi', e.target.value)}
                className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
            </div>
          </div>
          <div className="grid grid-cols-4 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600">{t('sku.primeCost')}</label>
              <input type="number" value={form.prime_cost} onChange={(e) => set('prime_cost', e.target.value)}
                className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" required />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600">{t('sku.supplyPrice')}</label>
              <input type="number" value={form.supply_price} onChange={(e) => set('supply_price', e.target.value)}
                className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" required />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600">{t('sku.listingPrice')}</label>
              <input type="number" value={form.listing_price} onChange={(e) => set('listing_price', e.target.value)}
                className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" required />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600">{t('sku.sellingPrice')}</label>
              <input type="number" value={form.selling_price} onChange={(e) => set('selling_price', e.target.value)}
                className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" required />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600">{t('sku.variant')}</label>
              <input value={form.sku_variant} onChange={(e) => set('sku_variant', e.target.value)}
                className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600">{t('sku.weight')}</label>
              <input type="number" value={form.weight} onChange={(e) => set('weight', e.target.value)}
                className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600">{t('sku.unit')}</label>
              <input value={form.unit} onChange={(e) => set('unit', e.target.value)}
                className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
            </div>
          </div>
          {sku && (
            <div>
              <label className="block text-xs font-medium text-gray-600">{t('sku.costChangeMemo')}</label>
              <input value={form.cost_change_memo} onChange={(e) => set('cost_change_memo', e.target.value)}
                className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" placeholder="가격 변경 시 사유 입력" />
            </div>
          )}
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

function CostHistoryDrawer({ skuId, onClose }: { skuId: string; onClose: () => void }) {
  const { t } = useTranslation('sales');
  const { data: histories = [], isLoading } = useSkuCostHistory(skuId);

  const formatPrice = (n: number) =>
    new Intl.NumberFormat('en-US', { minimumFractionDigits: 0 }).format(n);

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/30" onClick={onClose}>
      <div className="h-full w-full max-w-lg bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex h-14 items-center justify-between border-b px-6">
          <h3 className="font-bold text-gray-900">{t('sku.costHistory')}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">&times;</button>
        </div>
        <div className="overflow-y-auto p-6" style={{ maxHeight: 'calc(100vh - 56px)' }}>
          {isLoading ? (
            <p className="text-center text-gray-400">{t('common.loading')}</p>
          ) : histories.length === 0 ? (
            <p className="text-center text-gray-400">{t('common.noData')}</p>
          ) : (
            <div className="space-y-3">
              {histories.map((h: SkuCostHistory) => (
                <div key={h.schId} className="rounded-lg border border-gray-200 p-4">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-900">{h.effectiveDate}</span>
                    <span className="text-xs text-gray-400">{new Date(h.createdAt).toLocaleDateString()}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div><span className="text-gray-500">{t('sku.primeCost')}:</span> <span className="font-mono">{formatPrice(h.primeCost)}</span></div>
                    <div><span className="text-gray-500">{t('sku.supplyPrice')}:</span> <span className="font-mono">{formatPrice(h.supplyPrice)}</span></div>
                    <div><span className="text-gray-500">{t('sku.listingPrice')}:</span> <span className="font-mono">{formatPrice(h.listingPrice)}</span></div>
                    <div><span className="text-gray-500">{t('sku.sellingPrice')}:</span> <span className="font-mono">{formatPrice(h.sellingPrice)}</span></div>
                  </div>
                  {h.memo && <p className="mt-2 text-xs text-gray-500">{h.memo}</p>}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ExcelImportModal({
  onClose,
  onImport,
}: {
  onClose: () => void;
  onImport: { mutateAsync: (file: File) => Promise<any>; isPending: boolean };
}) {
  const { t } = useTranslation('sales');
  const { showToast } = useToastStore();
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<{
    total: number;
    inserted: number;
    updated: number;
    errors: { row: number; field: string; message: string }[];
  } | null>(null);

  const handleUpload = async () => {
    if (!file) return;
    try {
      const res = await onImport.mutateAsync(file);
      setResult(res);
      showToast(t('common.success'));
    } catch (err: any) {
      showToast(err.response?.data?.error?.message || t('common.error'), 'error');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="w-full max-w-lg rounded-xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <h2 className="mb-4 text-lg font-bold text-gray-900">{t('productMaster.import')}</h2>

        {!result ? (
          <>
            <div
              className="mb-4 rounded-lg border-2 border-dashed border-gray-300 p-8 text-center"
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                const f = e.dataTransfer.files[0];
                if (f?.name.endsWith('.xlsx')) setFile(f);
              }}
            >
              {file ? (
                <div className="text-sm">
                  <p className="font-medium text-gray-900">{file.name}</p>
                  <p className="text-gray-500">{(file.size / 1024).toFixed(1)} KB</p>
                </div>
              ) : (
                <div>
                  <Upload className="mx-auto mb-2 h-8 w-8 text-gray-400" />
                  <p className="text-sm text-gray-500">{t('upload.dropzone')}</p>
                </div>
              )}
              <input
                type="file"
                accept=".xlsx"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) setFile(f);
                }}
                className="mt-2 text-sm"
              />
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={onClose} className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">
                {t('common.cancel')}
              </button>
              <button
                onClick={handleUpload}
                disabled={!file || onImport.isPending}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {onImport.isPending ? t('common.loading') : t('productMaster.import')}
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="mb-4 grid grid-cols-3 gap-3">
              <div className="rounded-lg bg-gray-50 p-3 text-center">
                <p className="text-2xl font-bold text-gray-900">{result.total}</p>
                <p className="text-xs text-gray-500">{t('productMaster.totalRows')}</p>
              </div>
              <div className="rounded-lg bg-green-50 p-3 text-center">
                <p className="text-2xl font-bold text-green-600">{result.inserted}</p>
                <p className="text-xs text-gray-500">{t('productMaster.inserted')}</p>
              </div>
              <div className="rounded-lg bg-blue-50 p-3 text-center">
                <p className="text-2xl font-bold text-blue-600">{result.updated}</p>
                <p className="text-xs text-gray-500">{t('productMaster.updated')}</p>
              </div>
            </div>
            {result.errors.length > 0 && (
              <div className="mb-4 max-h-40 overflow-y-auto rounded-lg bg-red-50 p-3">
                <p className="mb-1 text-sm font-medium text-red-700">{t('productMaster.errors')} ({result.errors.length})</p>
                {result.errors.map((e, i) => (
                  <p key={i} className="text-xs text-red-600">
                    Row {e.row}: [{e.field}] {e.message}
                  </p>
                ))}
              </div>
            )}
            <div className="flex justify-end">
              <button onClick={onClose} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
                {t('common.confirm')}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
