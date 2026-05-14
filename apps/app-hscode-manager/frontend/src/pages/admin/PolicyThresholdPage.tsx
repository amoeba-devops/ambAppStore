import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2 } from 'lucide-react';
import { AlertModal, initialModalState, ModalState } from '@/components/ui/AlertModal';
import {
  adminService,
  PolicyValueType,
  UpsertPolicyDto,
} from '@/services/admin.service';

const EMPTY: UpsertPolicyDto = {
  import_country_code: '',
  key: '',
  value: '',
  value_type: 'number',
};

const VALUE_TYPES: PolicyValueType[] = ['number', 'boolean', 'string', 'json'];

export function PolicyThresholdPage() {
  const { t } = useTranslation('admin');
  const qc = useQueryClient();
  const [modal, setModal] = useState<ModalState>(initialModalState);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<UpsertPolicyDto>(EMPTY);

  const { data, isLoading } = useQuery({
    queryKey: ['policy-thresholds'],
    queryFn: adminService.listPolicies,
  });

  const upsertMut = useMutation({
    mutationFn: adminService.upsertPolicy,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['policy-thresholds'] });
      setOpen(false);
      setForm(EMPTY);
      setModal({
        isOpen: true,
        type: 'success',
        title: t('modal.success_title'),
        message: t('modal.updated'),
      });
    },
    onError: (err) => {
      setModal({
        isOpen: true,
        type: 'error',
        title: t('modal.error_title'),
        message: err instanceof Error ? err.message : String(err),
        autoCloseMs: 0,
      });
    },
  });

  const removeMut = useMutation({
    mutationFn: adminService.removePolicy,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['policy-thresholds'] });
      setModal({
        isOpen: true,
        type: 'success',
        title: t('modal.success_title'),
        message: t('modal.deleted'),
      });
    },
    onError: (err) => {
      setModal({
        isOpen: true,
        type: 'error',
        title: t('modal.error_title'),
        message: err instanceof Error ? err.message : String(err),
        autoCloseMs: 0,
      });
    },
  });

  return (
    <div className="p-6">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-xl font-bold text-gray-900">{t('policy.title')}</h2>
        <button type="button" className="btn-primary" onClick={() => setOpen(true)}>
          <Plus className="mr-1 inline-block h-4 w-4" />
          {t('policy.add')}
        </button>
      </div>

      <div className="card overflow-x-auto p-0">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-3 py-2 text-left font-medium text-gray-600">
                {t('policy.scope')}
              </th>
              <th className="px-3 py-2 text-left font-medium text-gray-600">
                {t('policy.key')}
              </th>
              <th className="px-3 py-2 text-left font-medium text-gray-600">
                {t('policy.value')}
              </th>
              <th className="px-3 py-2 text-left font-medium text-gray-600">
                {t('policy.value_type')}
              </th>
              <th className="px-3 py-2 text-left font-medium text-gray-600">
                {t('policy.description')}
              </th>
              <th className="px-3 py-2 text-right" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {isLoading && (
              <tr>
                <td className="px-3 py-4 text-center text-gray-400" colSpan={6}>
                  …
                </td>
              </tr>
            )}
            {!isLoading && (data?.items.length ?? 0) === 0 && (
              <tr>
                <td className="px-3 py-4 text-center text-gray-400" colSpan={6}>
                  {t('policy.fallback_warning')}
                </td>
              </tr>
            )}
            {data?.items.map((p) => (
              <tr key={p.id}>
                <td className="px-3 py-2 font-mono text-gray-700">
                  {p.importCountryCode ?? t('policy.scope_global')}
                </td>
                <td className="px-3 py-2 font-mono text-gray-800">{p.key}</td>
                <td className="px-3 py-2 font-mono text-gray-900">{p.value}</td>
                <td className="px-3 py-2 text-xs text-gray-500">{p.valueType}</td>
                <td className="px-3 py-2 text-xs text-gray-600">
                  {p.description ?? '—'}
                </td>
                <td className="px-3 py-2 text-right">
                  <button
                    type="button"
                    className="text-xs text-red-600 hover:underline"
                    onClick={() => {
                      if (window.confirm(t('modal.delete_confirm_message'))) {
                        removeMut.mutate(p.id);
                      }
                    }}
                  >
                    <Trash2 className="inline-block h-3.5 w-3.5" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {data?.defaultKeys && data.defaultKeys.length > 0 && (
        <div className="mt-4 rounded border border-amber-200 bg-amber-50 p-3">
          <h3 className="mb-1 text-xs font-semibold text-amber-800">
            {t('policy.default_keys_title')}
          </h3>
          <ul className="grid grid-cols-1 gap-1 text-xs text-amber-900 md:grid-cols-2">
            {data.defaultKeys.map((d) => (
              <li key={d.key}>
                <code className="rounded bg-white px-1.5 py-0.5">{d.key}</code>{' '}
                <span className="text-amber-700">({d.type})</span> · {d.description}
              </li>
            ))}
          </ul>
        </div>
      )}

      {open && (
        <div
          className="fixed inset-0 z-40 flex items-center justify-center bg-black bg-opacity-30"
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full max-w-xl rounded-lg bg-white p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="mb-3 text-base font-semibold text-gray-900">
              {t('policy.add')}
            </h3>
            <div className="grid grid-cols-2 gap-3">
              <label className="text-sm">
                <span className="text-gray-600">{t('policy.scope')}</span>
                <input
                  className="input mt-1"
                  maxLength={2}
                  placeholder="VN (글로벌은 비움)"
                  value={form.import_country_code ?? ''}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      import_country_code: e.target.value.toUpperCase() || undefined,
                    })
                  }
                />
              </label>
              <label className="text-sm">
                <span className="text-gray-600">{t('policy.key')}</span>
                <input
                  className="input mt-1 font-mono"
                  placeholder="confidence_cutoff"
                  value={form.key}
                  onChange={(e) =>
                    setForm({ ...form, key: e.target.value.toLowerCase() })
                  }
                />
              </label>
              <label className="text-sm">
                <span className="text-gray-600">{t('policy.value')}</span>
                <input
                  className="input mt-1 font-mono"
                  value={form.value}
                  onChange={(e) => setForm({ ...form, value: e.target.value })}
                />
              </label>
              <label className="text-sm">
                <span className="text-gray-600">{t('policy.value_type')}</span>
                <select
                  className="input mt-1"
                  value={form.value_type}
                  onChange={(e) =>
                    setForm({ ...form, value_type: e.target.value as PolicyValueType })
                  }
                >
                  {VALUE_TYPES.map((vt) => (
                    <option key={vt} value={vt}>
                      {vt}
                    </option>
                  ))}
                </select>
              </label>
              <label className="col-span-2 text-sm">
                <span className="text-gray-600">{t('policy.description')}</span>
                <input
                  className="input mt-1"
                  value={form.description ?? ''}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                />
              </label>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" className="btn-secondary" onClick={() => setOpen(false)}>
                {t('actions.cancel')}
              </button>
              <button
                type="button"
                className="btn-primary"
                onClick={() => upsertMut.mutate(form)}
                disabled={!form.key || !form.value || upsertMut.isPending}
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
