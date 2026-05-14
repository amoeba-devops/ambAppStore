import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Search, Trash2 } from 'lucide-react';
import { AlertModal, initialModalState, ModalState } from '@/components/ui/AlertModal';
import { ftaService, CreateFtaDto } from '@/services/fta.service';

const EMPTY_DTO: CreateFtaDto = {
  import_country_code: '',
  export_country_code: '',
  agreement_code: '',
  hs_code: '',
  rate: '0.000',
  effective_from: new Date().toISOString().slice(0, 10),
};

export function MasterFtaPage() {
  const { t } = useTranslation('admin');
  const qc = useQueryClient();
  const [modal, setModal] = useState<ModalState>(initialModalState);
  const [open, setOpen] = useState(false);
  const [values, setValues] = useState<CreateFtaDto>(EMPTY_DTO);

  const [filter, setFilter] = useState({
    import_country: '',
    export_country: '',
    agreement: '',
    hs_code: '',
  });
  const [applied, setApplied] = useState(filter);

  const [lookup, setLookup] = useState({ import: '', export: '', hs: '' });
  const [lookupResult, setLookupResult] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['fta-matrix', applied],
    queryFn: () =>
      ftaService.list({
        import_country: applied.import_country || undefined,
        export_country: applied.export_country || undefined,
        agreement: applied.agreement || undefined,
        hs_code: applied.hs_code || undefined,
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
    mutationFn: ftaService.create,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['fta-matrix'] });
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

  const deleteMut = useMutation({
    mutationFn: ftaService.remove,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['fta-matrix'] });
      setModal({
        isOpen: true,
        type: 'success',
        title: t('modal.success_title'),
        message: t('modal.deleted'),
      });
    },
    onError,
  });

  const lookupMut = useMutation({
    mutationFn: () =>
      ftaService.lookup({
        import_country: lookup.import.toUpperCase(),
        export_country: lookup.export.toUpperCase(),
        hs_code: lookup.hs,
      }),
    onSuccess: (row) => {
      if (!row) {
        setLookupResult(t('fta.lookup_no_result'));
      } else {
        setLookupResult(
          `${row.agreementCode}  ·  ${row.rate}%  ·  ${row.effectiveFrom} ~ ${row.effectiveTo ?? '∞'}`,
        );
      }
    },
    onError,
  });

  return (
    <div className="p-6">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-xl font-bold text-gray-900">{t('fta.title')}</h2>
        <button type="button" className="btn-primary" onClick={() => setOpen(true)}>
          <Plus className="mr-1 inline-block h-4 w-4" />
          {t('fta.add')}
        </button>
      </div>

      <div className="card mb-3 flex flex-wrap items-end gap-3">
        <label className="text-sm">
          <span className="text-gray-600">{t('fta.import_country')}</span>
          <input
            className="input mt-1 w-20"
            maxLength={2}
            placeholder="VN"
            value={filter.import_country}
            onChange={(e) =>
              setFilter({ ...filter, import_country: e.target.value.toUpperCase() })
            }
          />
        </label>
        <label className="text-sm">
          <span className="text-gray-600">{t('fta.export_country')}</span>
          <input
            className="input mt-1 w-20"
            maxLength={2}
            placeholder="KR"
            value={filter.export_country}
            onChange={(e) =>
              setFilter({ ...filter, export_country: e.target.value.toUpperCase() })
            }
          />
        </label>
        <label className="text-sm">
          <span className="text-gray-600">{t('fta.agreement')}</span>
          <input
            className="input mt-1 w-24"
            placeholder="VKFTA"
            value={filter.agreement}
            onChange={(e) =>
              setFilter({ ...filter, agreement: e.target.value.toUpperCase() })
            }
          />
        </label>
        <label className="text-sm">
          <span className="text-gray-600">{t('fta.hs_code')}</span>
          <input
            className="input mt-1"
            placeholder="7220.20.10"
            value={filter.hs_code}
            onChange={(e) => setFilter({ ...filter, hs_code: e.target.value })}
          />
        </label>
        <button
          type="button"
          className="btn-secondary"
          onClick={() => setApplied(filter)}
        >
          <Search className="mr-1 inline-block h-4 w-4" />
          {t('actions.search')}
        </button>
      </div>

      <div className="card mb-4 flex flex-wrap items-end gap-3 border-blue-100 bg-blue-50/30">
        <label className="text-sm">
          <span className="text-gray-600">{t('fta.import_country')}</span>
          <input
            className="input mt-1 w-20"
            maxLength={2}
            value={lookup.import}
            onChange={(e) =>
              setLookup({ ...lookup, import: e.target.value.toUpperCase() })
            }
          />
        </label>
        <label className="text-sm">
          <span className="text-gray-600">{t('fta.export_country')}</span>
          <input
            className="input mt-1 w-20"
            maxLength={2}
            value={lookup.export}
            onChange={(e) =>
              setLookup({ ...lookup, export: e.target.value.toUpperCase() })
            }
          />
        </label>
        <label className="text-sm">
          <span className="text-gray-600">{t('fta.hs_code')}</span>
          <input
            className="input mt-1"
            value={lookup.hs}
            onChange={(e) => setLookup({ ...lookup, hs: e.target.value })}
          />
        </label>
        <button
          type="button"
          className="btn-primary"
          onClick={() => lookupMut.mutate()}
          disabled={!lookup.import || !lookup.export || !lookup.hs}
        >
          {t('fta.lookup_button')}
        </button>
        {lookupResult !== null && (
          <span className="text-sm font-medium text-blue-700">{lookupResult}</span>
        )}
      </div>

      <div className="card overflow-x-auto p-0">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-2 text-left font-medium text-gray-600">
                {t('fta.import_country')}
              </th>
              <th className="px-4 py-2 text-left font-medium text-gray-600">
                {t('fta.export_country')}
              </th>
              <th className="px-4 py-2 text-left font-medium text-gray-600">
                {t('fta.agreement')}
              </th>
              <th className="px-4 py-2 text-left font-medium text-gray-600">
                {t('fta.hs_code')}
              </th>
              <th className="px-4 py-2 text-right font-medium text-gray-600">
                {t('fta.rate')}
              </th>
              <th className="px-4 py-2 text-left font-medium text-gray-600">
                {t('fta.effective_from')}
              </th>
              <th className="px-4 py-2 text-left font-medium text-gray-600">
                {t('fta.effective_to')}
              </th>
              <th className="px-4 py-2 text-right" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {isLoading && (
              <tr>
                <td className="px-4 py-6 text-center text-gray-400" colSpan={8}>
                  …
                </td>
              </tr>
            )}
            {!isLoading && items.length === 0 && (
              <tr>
                <td className="px-4 py-6 text-center text-gray-400" colSpan={8}>
                  {t('empty')}
                </td>
              </tr>
            )}
            {items.map((row) => (
              <tr key={row.id}>
                <td className="px-4 py-2 font-mono text-gray-700">
                  {row.importCountryCode}
                </td>
                <td className="px-4 py-2 font-mono text-gray-700">
                  {row.exportCountryCode}
                </td>
                <td className="px-4 py-2 font-medium text-gray-800">
                  {row.agreementCode}
                </td>
                <td className="px-4 py-2 font-mono text-gray-700">{row.hsCode}</td>
                <td className="px-4 py-2 text-right font-mono text-gray-800">
                  {row.rate}
                </td>
                <td className="px-4 py-2 text-gray-600">{row.effectiveFrom}</td>
                <td className="px-4 py-2 text-gray-600">{row.effectiveTo ?? '∞'}</td>
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
            <h3 className="mb-4 text-base font-semibold text-gray-900">{t('fta.add')}</h3>
            <div className="grid grid-cols-2 gap-3">
              <label className="text-sm">
                <span className="text-gray-600">{t('fta.import_country')}</span>
                <input
                  className="input mt-1"
                  maxLength={2}
                  value={values.import_country_code}
                  onChange={(e) =>
                    setValues({
                      ...values,
                      import_country_code: e.target.value.toUpperCase(),
                    })
                  }
                />
              </label>
              <label className="text-sm">
                <span className="text-gray-600">{t('fta.export_country')}</span>
                <input
                  className="input mt-1"
                  maxLength={2}
                  value={values.export_country_code}
                  onChange={(e) =>
                    setValues({
                      ...values,
                      export_country_code: e.target.value.toUpperCase(),
                    })
                  }
                />
              </label>
              <label className="text-sm">
                <span className="text-gray-600">{t('fta.agreement')}</span>
                <input
                  className="input mt-1"
                  placeholder="VKFTA"
                  value={values.agreement_code}
                  onChange={(e) =>
                    setValues({ ...values, agreement_code: e.target.value.toUpperCase() })
                  }
                />
              </label>
              <label className="text-sm">
                <span className="text-gray-600">{t('fta.hs_code')}</span>
                <input
                  className="input mt-1"
                  placeholder="7220.20.10"
                  value={values.hs_code}
                  onChange={(e) => setValues({ ...values, hs_code: e.target.value })}
                />
              </label>
              <label className="text-sm">
                <span className="text-gray-600">{t('fta.rate')}</span>
                <input
                  className="input mt-1"
                  placeholder="0.000"
                  value={values.rate}
                  onChange={(e) => setValues({ ...values, rate: e.target.value })}
                />
              </label>
              <label className="text-sm">
                <span className="text-gray-600">{t('fta.effective_from')}</span>
                <input
                  type="date"
                  className="input mt-1"
                  value={values.effective_from}
                  onChange={(e) =>
                    setValues({ ...values, effective_from: e.target.value })
                  }
                />
              </label>
              <label className="text-sm">
                <span className="text-gray-600">{t('fta.effective_to')}</span>
                <input
                  type="date"
                  className="input mt-1"
                  value={values.effective_to ?? ''}
                  onChange={(e) =>
                    setValues({
                      ...values,
                      effective_to: e.target.value || undefined,
                    })
                  }
                />
              </label>
              <label className="col-span-2 text-sm">
                <span className="text-gray-600">{t('fta.memo')}</span>
                <input
                  className="input mt-1"
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
