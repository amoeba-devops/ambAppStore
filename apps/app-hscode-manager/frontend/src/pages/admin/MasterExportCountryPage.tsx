import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2 } from 'lucide-react';
import { AlertModal, initialModalState, ModalState } from '@/components/ui/AlertModal';
import { StatusBadge } from '@/components/ui/StatusBadge';
import {
  exportCountryService,
  CreateExportCountryDto,
} from '@/services/master-country.service';

const EMPTY_DTO: CreateExportCountryDto = {
  code: '',
  name_ko: '',
  name_en: '',
  name_vi: '',
  is_active: true,
};

export function MasterExportCountryPage() {
  const { t } = useTranslation('admin');
  const qc = useQueryClient();
  const [modal, setModal] = useState<ModalState>(initialModalState);
  const [open, setOpen] = useState(false);
  const [values, setValues] = useState<CreateExportCountryDto>(EMPTY_DTO);

  const { data: items = [], isLoading } = useQuery({
    queryKey: ['export-countries'],
    queryFn: exportCountryService.list,
  });

  const onError = (err: unknown) => {
    const msg = err instanceof Error ? err.message : String(err);
    setModal({ isOpen: true, type: 'error', title: t('modal.error_title'), message: msg });
  };

  const createMut = useMutation({
    mutationFn: exportCountryService.create,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['export-countries'] });
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
    mutationFn: exportCountryService.remove,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['export-countries'] });
      setModal({
        isOpen: true,
        type: 'success',
        title: t('modal.success_title'),
        message: t('modal.deleted'),
      });
    },
    onError,
  });

  const onDelete = (id: string) => {
    if (window.confirm(t('modal.delete_confirm_message'))) {
      deleteMut.mutate(id);
    }
  };

  return (
    <div className="p-6">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-xl font-bold text-gray-900">{t('export_country.title')}</h2>
        <button type="button" className="btn-primary" onClick={() => setOpen(true)}>
          <Plus className="mr-1 inline-block h-4 w-4" />
          {t('export_country.add')}
        </button>
      </div>

      <div className="card overflow-x-auto p-0">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-2 text-left font-medium text-gray-600">
                {t('export_country.code')}
              </th>
              <th className="px-4 py-2 text-left font-medium text-gray-600">
                {t('export_country.name_ko')}
              </th>
              <th className="px-4 py-2 text-left font-medium text-gray-600">
                {t('export_country.name_en')}
              </th>
              <th className="px-4 py-2 text-left font-medium text-gray-600">
                {t('export_country.name_vi')}
              </th>
              <th className="px-4 py-2 text-left font-medium text-gray-600">
                {t('export_country.is_active')}
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
                <td className="px-4 py-2 font-mono text-gray-700">{row.code}</td>
                <td className="px-4 py-2 text-gray-800">{row.nameKo}</td>
                <td className="px-4 py-2 text-gray-600">{row.nameEn}</td>
                <td className="px-4 py-2 text-gray-600">{row.nameVi}</td>
                <td className="px-4 py-2">
                  <StatusBadge variant={row.isActive ? 'active' : 'inactive'}>
                    {row.isActive ? '✓' : '×'}
                  </StatusBadge>
                </td>
                <td className="px-4 py-2 text-right">
                  <button
                    type="button"
                    className="text-xs text-red-600 hover:underline"
                    onClick={() => onDelete(row.id)}
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
            className="w-full max-w-lg rounded-lg bg-white p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="mb-4 text-base font-semibold text-gray-900">
              {t('export_country.add')}
            </h3>
            <div className="grid grid-cols-2 gap-3">
              <label className="text-sm">
                <span className="text-gray-600">{t('export_country.code')}</span>
                <input
                  className="input mt-1"
                  maxLength={2}
                  value={values.code}
                  onChange={(e) =>
                    setValues({ ...values, code: e.target.value.toUpperCase() })
                  }
                />
              </label>
              <label className="text-sm">
                <span className="text-gray-600">{t('export_country.name_ko')}</span>
                <input
                  className="input mt-1"
                  value={values.name_ko}
                  onChange={(e) => setValues({ ...values, name_ko: e.target.value })}
                />
              </label>
              <label className="text-sm">
                <span className="text-gray-600">{t('export_country.name_en')}</span>
                <input
                  className="input mt-1"
                  value={values.name_en}
                  onChange={(e) => setValues({ ...values, name_en: e.target.value })}
                />
              </label>
              <label className="text-sm">
                <span className="text-gray-600">{t('export_country.name_vi')}</span>
                <input
                  className="input mt-1"
                  value={values.name_vi}
                  onChange={(e) => setValues({ ...values, name_vi: e.target.value })}
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
