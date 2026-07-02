import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Search, Trash2 } from 'lucide-react';
import { AlertModal, initialModalState, ModalState } from '@/components/ui/AlertModal';
import { exporterService, CreateExporterDto } from '@/services/exporter.service';

const EMPTY_DTO: CreateExporterDto = {
  name: '',
  country_code: '',
  aliases: [],
  memo: '',
};

export function MasterExporterPage() {
  const { t } = useTranslation('admin');
  const qc = useQueryClient();
  const [modal, setModal] = useState<ModalState>(initialModalState);
  const [open, setOpen] = useState(false);
  const [values, setValues] = useState<CreateExporterDto>(EMPTY_DTO);
  const [aliasInput, setAliasInput] = useState('');
  const [searchQ, setSearchQ] = useState('');
  const [searchCountry, setSearchCountry] = useState('');
  const [appliedQ, setAppliedQ] = useState('');
  const [appliedCountry, setAppliedCountry] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['exporters', appliedQ, appliedCountry],
    queryFn: () =>
      exporterService.list({
        q: appliedQ || undefined,
        country_code: appliedCountry || undefined,
        page: 1,
        page_size: 100,
      }),
  });
  const items = data?.items ?? [];

  const onError = (err: unknown) => {
    const msg = err instanceof Error ? err.message : String(err);
    setModal({ isOpen: true, type: 'error', title: t('modal.error_title'), message: msg });
  };

  const createMut = useMutation({
    mutationFn: exporterService.create,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['exporters'] });
      setOpen(false);
      setValues(EMPTY_DTO);
      setAliasInput('');
      setModal({
        isOpen: true,
        type: 'success',
        title: t('modal.success_title'),
        message: t('modal.created'),
      });
    },
    onError,
  });

  const deleteMut = useMutation({
    mutationFn: exporterService.remove,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['exporters'] });
      setModal({
        isOpen: true,
        type: 'success',
        title: t('modal.success_title'),
        message: t('modal.deleted'),
      });
    },
    onError,
  });

  const addAlias = () => {
    if (!aliasInput.trim()) return;
    setValues({
      ...values,
      aliases: [...(values.aliases ?? []), aliasInput.trim()],
    });
    setAliasInput('');
  };

  return (
    <div className="p-6">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-xl font-bold text-gray-900">{t('exporter.title')}</h2>
        <button type="button" className="btn-primary" onClick={() => setOpen(true)}>
          <Plus className="mr-1 inline-block h-4 w-4" />
          {t('exporter.add')}
        </button>
      </div>

      <div className="card mb-4 flex flex-wrap items-end gap-3">
        <label className="text-sm">
          <span className="text-gray-600">{t('exporter.search_placeholder')}</span>
          <input
            className="input mt-1"
            value={searchQ}
            onChange={(e) => setSearchQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                setAppliedQ(searchQ);
                setAppliedCountry(searchCountry);
              }
            }}
          />
        </label>
        <label className="text-sm">
          <span className="text-gray-600">{t('exporter.country')}</span>
          <input
            className="input mt-1 w-20"
            maxLength={2}
            placeholder="KR"
            value={searchCountry}
            onChange={(e) => setSearchCountry(e.target.value.toUpperCase())}
          />
        </label>
        <button
          type="button"
          className="btn-secondary"
          onClick={() => {
            setAppliedQ(searchQ);
            setAppliedCountry(searchCountry);
          }}
        >
          <Search className="mr-1 inline-block h-4 w-4" />
          {t('actions.search')}
        </button>
      </div>

      <div className="card overflow-x-auto p-0">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-2 text-left font-medium text-gray-600">
                {t('exporter.name')}
              </th>
              <th className="px-4 py-2 text-left font-medium text-gray-600">
                {t('exporter.country')}
              </th>
              <th className="px-4 py-2 text-left font-medium text-gray-600">
                {t('exporter.aliases')}
              </th>
              <th className="px-4 py-2 text-left font-medium text-gray-600">
                {t('exporter.memo')}
              </th>
              <th className="px-4 py-2 text-right" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {isLoading && (
              <tr>
                <td className="px-4 py-6 text-center text-gray-400" colSpan={5}>
                  …
                </td>
              </tr>
            )}
            {!isLoading && items.length === 0 && (
              <tr>
                <td className="px-4 py-6 text-center text-gray-400" colSpan={5}>
                  {t('empty')}
                </td>
              </tr>
            )}
            {items.map((row) => (
              <tr key={row.id}>
                <td className="px-4 py-2 font-medium text-gray-800">{row.name}</td>
                <td className="px-4 py-2 font-mono text-gray-700">{row.countryCode}</td>
                <td className="px-4 py-2 text-xs text-gray-500">
                  {row.aliases.length > 0 ? row.aliases.join(', ') : '—'}
                </td>
                <td className="px-4 py-2 text-xs text-gray-500">{row.memo ?? '—'}</td>
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
          {t('total_count', { count: data?.total ?? 0 })}
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
              {t('exporter.add')}
            </h3>
            <div className="space-y-3">
              <label className="block text-sm">
                <span className="text-gray-600">{t('exporter.name')}</span>
                <input
                  className="input mt-1"
                  value={values.name}
                  onChange={(e) => setValues({ ...values, name: e.target.value })}
                />
              </label>
              <label className="block text-sm">
                <span className="text-gray-600">{t('exporter.country')}</span>
                <input
                  className="input mt-1 w-24"
                  maxLength={2}
                  placeholder="KR"
                  value={values.country_code}
                  onChange={(e) =>
                    setValues({ ...values, country_code: e.target.value.toUpperCase() })
                  }
                />
              </label>
              <div>
                <span className="text-sm text-gray-600">{t('exporter.aliases')}</span>
                <div className="mt-1 flex gap-2">
                  <input
                    className="input"
                    placeholder="ABC Co."
                    value={aliasInput}
                    onChange={(e) => setAliasInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        addAlias();
                      }
                    }}
                  />
                  <button type="button" className="btn-secondary" onClick={addAlias}>
                    +
                  </button>
                </div>
                {values.aliases && values.aliases.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {values.aliases.map((a, i) => (
                      <span
                        key={i}
                        className="inline-flex items-center rounded bg-gray-100 px-2 py-0.5 text-xs"
                      >
                        {a}
                        <button
                          type="button"
                          className="ml-1 text-gray-400 hover:text-red-600"
                          onClick={() =>
                            setValues({
                              ...values,
                              aliases: values.aliases?.filter((_, idx) => idx !== i),
                            })
                          }
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <label className="block text-sm">
                <span className="text-gray-600">{t('exporter.memo')}</span>
                <textarea
                  className="input mt-1"
                  rows={3}
                  value={values.memo ?? ''}
                  onChange={(e) => setValues({ ...values, memo: e.target.value })}
                />
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
