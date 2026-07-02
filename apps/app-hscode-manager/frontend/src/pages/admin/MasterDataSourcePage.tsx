import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2 } from 'lucide-react';
import { AlertModal, initialModalState, ModalState } from '@/components/ui/AlertModal';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { dataSourceService, CreateDataSourceDto } from '@/services/data-source.service';

const EMPTY_DTO: CreateDataSourceDto = {
  adapter_key: '',
  import_country_code: '',
  display_name: '',
  endpoint_url: '',
  cache_ttl_sec: 86400,
  is_active: false,
  priority: 100,
};

export function MasterDataSourcePage() {
  const { t } = useTranslation('admin');
  const qc = useQueryClient();
  const [modal, setModal] = useState<ModalState>(initialModalState);
  const [open, setOpen] = useState(false);
  const [values, setValues] = useState<CreateDataSourceDto>(EMPTY_DTO);

  const { data: items = [], isLoading } = useQuery({
    queryKey: ['data-sources'],
    queryFn: () => dataSourceService.list(),
  });

  const onError = (err: unknown) => {
    const msg = err instanceof Error ? err.message : String(err);
    setModal({ isOpen: true, type: 'error', title: t('modal.error_title'), message: msg });
  };

  const createMut = useMutation({
    mutationFn: dataSourceService.create,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['data-sources'] });
      setOpen(false);
      setValues(EMPTY_DTO);
      setModal({
        isOpen: true,
        type: 'success',
        title: t('modal.success_title'),
        message: t('modal.created'),
      });
    },
    onError,
  });

  const toggleActiveMut = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      dataSourceService.update(id, { is_active: isActive }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['data-sources'] });
    },
    onError,
  });

  const deleteMut = useMutation({
    mutationFn: dataSourceService.remove,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['data-sources'] });
      setModal({
        isOpen: true,
        type: 'success',
        title: t('modal.success_title'),
        message: t('modal.deleted'),
      });
    },
    onError,
  });

  return (
    <div className="p-6">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-xl font-bold text-gray-900">{t('data_source.title')}</h2>
        <button type="button" className="btn-primary" onClick={() => setOpen(true)}>
          <Plus className="mr-1 inline-block h-4 w-4" />
          {t('data_source.add')}
        </button>
      </div>

      <div className="card overflow-x-auto p-0">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-2 text-left font-medium text-gray-600">
                {t('data_source.adapter_key')}
              </th>
              <th className="px-4 py-2 text-left font-medium text-gray-600">
                {t('data_source.country')}
              </th>
              <th className="px-4 py-2 text-left font-medium text-gray-600">
                {t('data_source.display_name')}
              </th>
              <th className="px-4 py-2 text-left font-medium text-gray-600">
                {t('data_source.priority')}
              </th>
              <th className="px-4 py-2 text-left font-medium text-gray-600">
                {t('data_source.is_active')}
              </th>
              <th className="px-4 py-2 text-right" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {isLoading && (
              <tr>
                <td className="px-4 py-6 text-center text-gray-400" colSpan={6}>
                  …
                </td>
              </tr>
            )}
            {!isLoading && items.length === 0 && (
              <tr>
                <td className="px-4 py-6 text-center text-gray-400" colSpan={6}>
                  {t('empty')}
                </td>
              </tr>
            )}
            {items.map((row) => (
              <tr key={row.id}>
                <td className="px-4 py-2 font-mono text-xs text-gray-700">
                  {row.adapterKey}
                </td>
                <td className="px-4 py-2 font-mono text-gray-700">
                  {row.importCountryCode}
                </td>
                <td className="px-4 py-2 text-gray-800">{row.displayName}</td>
                <td className="px-4 py-2 text-gray-600">{row.priority}</td>
                <td className="px-4 py-2">
                  <button
                    type="button"
                    onClick={() =>
                      toggleActiveMut.mutate({ id: row.id, isActive: !row.isActive })
                    }
                  >
                    <StatusBadge variant={row.isActive ? 'active' : 'inactive'}>
                      {row.isActive ? '✓' : '×'}
                    </StatusBadge>
                  </button>
                </td>
                <td className="px-4 py-2 text-right">
                  <button
                    type="button"
                    className="text-xs text-red-600 hover:underline"
                    onClick={() => {
                      if (window.confirm(t('modal.delete_confirm_message'))) {
                        deleteMut.mutate(row.id);
                      }
                    }}
                    aria-label="delete"
                  >
                    <Trash2 className="inline-block h-3.5 w-3.5" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="border-t border-gray-100 px-4 py-2 text-xs text-gray-500">
          {t('total_count', { count: items.length })}
        </div>
      </div>

      {open && (
        <div
          className="fixed inset-0 z-40 flex items-center justify-center bg-black bg-opacity-30"
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full max-w-xl rounded-lg bg-white p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="mb-4 text-base font-semibold text-gray-900">
              {t('data_source.add')}
            </h3>
            <div className="grid grid-cols-2 gap-3">
              <label className="text-sm">
                <span className="text-gray-600">{t('data_source.adapter_key')}</span>
                <input
                  className="input mt-1 font-mono"
                  placeholder="bieu_thue_xnk_2026"
                  value={values.adapter_key}
                  onChange={(e) =>
                    setValues({ ...values, adapter_key: e.target.value.toLowerCase() })
                  }
                />
              </label>
              <label className="text-sm">
                <span className="text-gray-600">{t('data_source.country')}</span>
                <input
                  className="input mt-1"
                  maxLength={2}
                  placeholder="VN"
                  value={values.import_country_code}
                  onChange={(e) =>
                    setValues({
                      ...values,
                      import_country_code: e.target.value.toUpperCase(),
                    })
                  }
                />
              </label>
              <label className="col-span-2 text-sm">
                <span className="text-gray-600">{t('data_source.display_name')}</span>
                <input
                  className="input mt-1"
                  value={values.display_name}
                  onChange={(e) => setValues({ ...values, display_name: e.target.value })}
                />
              </label>
              <label className="col-span-2 text-sm">
                <span className="text-gray-600">{t('data_source.endpoint')}</span>
                <input
                  className="input mt-1"
                  placeholder="https://..."
                  value={values.endpoint_url ?? ''}
                  onChange={(e) =>
                    setValues({ ...values, endpoint_url: e.target.value })
                  }
                />
              </label>
              <label className="text-sm">
                <span className="text-gray-600">{t('data_source.cache_ttl')}</span>
                <input
                  type="number"
                  className="input mt-1"
                  value={values.cache_ttl_sec ?? 86400}
                  onChange={(e) =>
                    setValues({ ...values, cache_ttl_sec: Number(e.target.value) })
                  }
                />
              </label>
              <label className="text-sm">
                <span className="text-gray-600">{t('data_source.priority')}</span>
                <input
                  type="number"
                  className="input mt-1"
                  value={values.priority ?? 100}
                  onChange={(e) =>
                    setValues({ ...values, priority: Number(e.target.value) })
                  }
                />
              </label>
              <label className="col-span-2 flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={values.is_active === true}
                  onChange={(e) =>
                    setValues({ ...values, is_active: e.target.checked })
                  }
                />
                <span className="text-gray-600">{t('data_source.is_active')}</span>
              </label>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setOpen(false)}
              >
                {t('actions.cancel')}
              </button>
              <button
                type="button"
                className="btn-primary"
                onClick={() => createMut.mutate(values)}
                disabled={createMut.isPending}
              >
                {t('actions.create')}
              </button>
            </div>
          </div>
        </div>
      )}

      <AlertModal state={modal} onClose={() => setModal(initialModalState)} />
    </div>
  );
}
