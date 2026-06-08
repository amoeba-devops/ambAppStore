import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2 } from 'lucide-react';
import { AlertModal, initialModalState, ModalState } from '@/components/ui/AlertModal';
import { StatusBadge } from '@/components/ui/StatusBadge';
import {
  importCountryService,
  CreateImportCountryDto,
} from '@/services/master-country.service';
import type { ImportCountry, SupportStatus } from '@/types/master.types';

interface FormState {
  open: boolean;
  mode: 'create' | 'status';
  editing: ImportCountry | null;
  values: CreateImportCountryDto & { _statusValue?: SupportStatus };
}

const EMPTY_FORM: FormState = {
  open: false,
  mode: 'create',
  editing: null,
  values: {
    code: '',
    name_ko: '',
    name_en: '',
    name_vi: '',
    support_status: 'NOT_SUPPORTED',
    adapter_key: '',
    currency_code: '',
  },
};

function statusVariant(status: SupportStatus) {
  if (status === 'ACTIVE') return 'active' as const;
  if (status === 'BETA') return 'beta' as const;
  return 'inactive' as const;
}

export function MasterImportCountryPage() {
  const { t } = useTranslation('admin');
  const qc = useQueryClient();
  const [modal, setModal] = useState<ModalState>(initialModalState);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);

  const { data: items = [], isLoading } = useQuery({
    queryKey: ['import-countries'],
    queryFn: importCountryService.list,
  });

  const onError = (err: unknown) => {
    const msg = err instanceof Error ? err.message : String(err);
    setModal({
      isOpen: true,
      type: 'error',
      title: t('modal.error_title'),
      message: msg,
    });
  };

  const createMut = useMutation({
    mutationFn: importCountryService.create,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['import-countries'] });
      setForm(EMPTY_FORM);
      setModal({
        isOpen: true,
        type: 'success',
        title: t('modal.success_title'),
        message: t('modal.created'),
      });
    },
    onError,
  });

  const statusMut = useMutation({
    mutationFn: ({
      id,
      support_status,
      adapter_key,
    }: {
      id: string;
      support_status: SupportStatus;
      adapter_key?: string;
    }) =>
      importCountryService.updateStatus(id, {
        support_status,
        adapter_key,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['import-countries'] });
      setForm(EMPTY_FORM);
      setModal({
        isOpen: true,
        type: 'success',
        title: t('modal.success_title'),
        message: t('modal.status_changed'),
      });
    },
    onError,
  });

  const deleteMut = useMutation({
    mutationFn: importCountryService.remove,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['import-countries'] });
      setModal({
        isOpen: true,
        type: 'success',
        title: t('modal.success_title'),
        message: t('modal.deleted'),
      });
    },
    onError,
  });

  const onCreate = () => {
    setForm({ ...EMPTY_FORM, open: true });
  };

  const onStatusEdit = (row: ImportCountry) => {
    setForm({
      open: true,
      mode: 'status',
      editing: row,
      values: {
        code: row.code,
        name_ko: row.nameKo,
        name_en: row.nameEn,
        name_vi: row.nameVi,
        support_status: row.supportStatus,
        adapter_key: row.adapterKey ?? '',
        _statusValue: row.supportStatus,
      },
    });
  };

  const onDelete = (row: ImportCountry) => {
    if (window.confirm(t('modal.delete_confirm_message'))) {
      deleteMut.mutate(row.id);
    }
  };

  const submit = () => {
    if (form.mode === 'create') {
      createMut.mutate({
        code: form.values.code.toUpperCase(),
        name_ko: form.values.name_ko,
        name_en: form.values.name_en,
        name_vi: form.values.name_vi,
        support_status: form.values.support_status,
        adapter_key: form.values.adapter_key || undefined,
        currency_code: form.values.currency_code || undefined,
        default_tariff_currency: form.values.default_tariff_currency || undefined,
      });
    } else if (form.mode === 'status' && form.editing) {
      statusMut.mutate({
        id: form.editing.id,
        support_status: form.values._statusValue ?? form.editing.supportStatus,
        adapter_key: form.values.adapter_key || undefined,
      });
    }
  };

  return (
    <div className="p-6">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-xl font-bold text-gray-900">{t('import_country.title')}</h2>
        <button type="button" className="btn-primary" onClick={onCreate}>
          <Plus className="mr-1 inline-block h-4 w-4" />
          {t('import_country.add')}
        </button>
      </div>

      <div className="card overflow-x-auto p-0">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-2 text-left font-medium text-gray-600">
                {t('import_country.code')}
              </th>
              <th className="px-4 py-2 text-left font-medium text-gray-600">
                {t('import_country.name_ko')}
              </th>
              <th className="px-4 py-2 text-left font-medium text-gray-600">
                {t('import_country.name_en')}
              </th>
              <th className="px-4 py-2 text-left font-medium text-gray-600">
                {t('import_country.adapter_key')}
              </th>
              <th className="px-4 py-2 text-left font-medium text-gray-600">
                {t('import_country.currency')}
              </th>
              <th className="px-4 py-2 text-left font-medium text-gray-600">
                {t('import_country.status')}
              </th>
              <th className="px-4 py-2 text-right font-medium text-gray-600">
                {t('import_country.actions')}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {isLoading && (
              <tr>
                <td className="px-4 py-6 text-center text-gray-400" colSpan={7}>
                  …
                </td>
              </tr>
            )}
            {!isLoading && items.length === 0 && (
              <tr>
                <td className="px-4 py-6 text-center text-gray-400" colSpan={7}>
                  {t('empty')}
                </td>
              </tr>
            )}
            {items.map((row) => (
              <tr key={row.id}>
                <td className="px-4 py-2 font-mono text-gray-700">{row.code}</td>
                <td className="px-4 py-2 text-gray-800">{row.nameKo}</td>
                <td className="px-4 py-2 text-gray-600">{row.nameEn}</td>
                <td className="px-4 py-2 font-mono text-xs text-gray-500">
                  {row.adapterKey ?? '—'}
                </td>
                <td className="px-4 py-2 text-gray-500">{row.currencyCode ?? '—'}</td>
                <td className="px-4 py-2">
                  <StatusBadge variant={statusVariant(row.supportStatus)}>
                    {t(`support_status.${row.supportStatus}`)}
                  </StatusBadge>
                </td>
                <td className="px-4 py-2 text-right">
                  <button
                    type="button"
                    className="text-xs text-blue-600 hover:underline"
                    onClick={() => onStatusEdit(row)}
                  >
                    {t('import_country.edit_status')}
                  </button>
                  <button
                    type="button"
                    className="ml-3 text-xs text-red-600 hover:underline"
                    onClick={() => onDelete(row)}
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

      {form.open && (
        <div
          className="fixed inset-0 z-40 flex items-center justify-center bg-black bg-opacity-30"
          onClick={() => setForm(EMPTY_FORM)}
        >
          <div
            className="w-full max-w-xl rounded-lg bg-white p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="mb-4 text-base font-semibold text-gray-900">
              {form.mode === 'create'
                ? t('import_country.add')
                : t('import_country.edit_status')}
            </h3>
            <div className="grid grid-cols-2 gap-3">
              {form.mode === 'create' && (
                <>
                  <label className="text-sm">
                    <span className="text-gray-600">{t('import_country.code')}</span>
                    <input
                      className="input mt-1"
                      maxLength={2}
                      value={form.values.code}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          values: { ...form.values, code: e.target.value.toUpperCase() },
                        })
                      }
                    />
                  </label>
                  <label className="text-sm">
                    <span className="text-gray-600">{t('import_country.name_ko')}</span>
                    <input
                      className="input mt-1"
                      value={form.values.name_ko}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          values: { ...form.values, name_ko: e.target.value },
                        })
                      }
                    />
                  </label>
                  <label className="text-sm">
                    <span className="text-gray-600">{t('import_country.name_en')}</span>
                    <input
                      className="input mt-1"
                      value={form.values.name_en}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          values: { ...form.values, name_en: e.target.value },
                        })
                      }
                    />
                  </label>
                  <label className="text-sm">
                    <span className="text-gray-600">{t('import_country.name_vi')}</span>
                    <input
                      className="input mt-1"
                      value={form.values.name_vi}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          values: { ...form.values, name_vi: e.target.value },
                        })
                      }
                    />
                  </label>
                  <label className="text-sm">
                    <span className="text-gray-600">{t('import_country.currency')}</span>
                    <input
                      className="input mt-1"
                      maxLength={3}
                      placeholder="VND"
                      value={form.values.currency_code ?? ''}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          values: { ...form.values, currency_code: e.target.value.toUpperCase() },
                        })
                      }
                    />
                  </label>
                </>
              )}

              <label className="text-sm">
                <span className="text-gray-600">{t('import_country.status')}</span>
                <select
                  className="input mt-1"
                  value={
                    form.mode === 'status'
                      ? form.values._statusValue ?? form.values.support_status ?? 'NOT_SUPPORTED'
                      : form.values.support_status ?? 'NOT_SUPPORTED'
                  }
                  onChange={(e) => {
                    const v = e.target.value as SupportStatus;
                    if (form.mode === 'status') {
                      setForm({ ...form, values: { ...form.values, _statusValue: v } });
                    } else {
                      setForm({ ...form, values: { ...form.values, support_status: v } });
                    }
                  }}
                >
                  <option value="ACTIVE">{t('support_status.ACTIVE')}</option>
                  <option value="BETA">{t('support_status.BETA')}</option>
                  <option value="NOT_SUPPORTED">{t('support_status.NOT_SUPPORTED')}</option>
                </select>
              </label>

              <label className="text-sm">
                <span className="text-gray-600">{t('import_country.adapter_key')}</span>
                <input
                  className="input mt-1"
                  placeholder="bieu_thue_xnk_2026"
                  value={form.values.adapter_key ?? ''}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      values: { ...form.values, adapter_key: e.target.value },
                    })
                  }
                />
              </label>
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setForm(EMPTY_FORM)}
              >
                {t('actions.cancel')}
              </button>
              <button
                type="button"
                className="btn-primary"
                onClick={submit}
                disabled={createMut.isPending || statusMut.isPending}
              >
                {t('actions.save')}
              </button>
            </div>
          </div>
        </div>
      )}

      <AlertModal state={modal} onClose={() => setModal(initialModalState)} />
    </div>
  );
}
