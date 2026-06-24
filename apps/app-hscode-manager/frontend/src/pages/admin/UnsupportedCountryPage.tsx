import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertModal, initialModalState, ModalState } from '@/components/ui/AlertModal';
import { StatusBadge } from '@/components/ui/StatusBadge';
import {
  adminService,
  CreateUcrDto,
  UcrStatus,
} from '@/services/admin.service';

const EMPTY: CreateUcrDto = {
  requested_country_code: '',
  business_case: '',
};

const STATUS_OPTIONS: UcrStatus[] = ['OPEN', 'IN_PROGRESS', 'RESOLVED', 'REJECTED'];

function statusVariant(s: UcrStatus) {
  if (s === 'RESOLVED') return 'success' as const;
  if (s === 'REJECTED') return 'error' as const;
  if (s === 'IN_PROGRESS') return 'warning' as const;
  return 'info' as const;
}

export function UnsupportedCountryPage() {
  const { t } = useTranslation('admin');
  const qc = useQueryClient();
  const [modal, setModal] = useState<ModalState>(initialModalState);
  const [filter, setFilter] = useState<UcrStatus | ''>('');
  const [form, setForm] = useState<CreateUcrDto>(EMPTY);
  const [open, setOpen] = useState(false);

  const { data: items = [], isLoading } = useQuery({
    queryKey: ['ucr-list', filter || 'all'],
    queryFn: () => adminService.listUcr(filter || undefined),
  });

  const createMut = useMutation({
    mutationFn: adminService.createUcr,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ucr-list'] });
      setOpen(false);
      setForm(EMPTY);
      setModal({
        isOpen: true,
        type: 'success',
        title: t('modal.success_title'),
        message: t('ucr.submitted_message'),
      });
    },
    onError: (err) =>
      setModal({
        isOpen: true,
        type: 'error',
        title: t('modal.error_title'),
        message: err instanceof Error ? err.message : String(err),
        autoCloseMs: 0,
      }),
  });

  const statusMut = useMutation({
    mutationFn: ({
      id,
      status,
      note,
    }: {
      id: string;
      status: UcrStatus;
      note?: string;
    }) => adminService.updateUcrStatus(id, status, note),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ucr-list'] });
      setModal({
        isOpen: true,
        type: 'success',
        title: t('modal.success_title'),
        message: t('modal.status_changed'),
      });
    },
    onError: (err) =>
      setModal({
        isOpen: true,
        type: 'error',
        title: t('modal.error_title'),
        message: err instanceof Error ? err.message : String(err),
        autoCloseMs: 0,
      }),
  });

  return (
    <div className="p-6">
      <header className="mb-4 flex items-end justify-between">
        <h2 className="text-xl font-bold text-gray-900">{t('ucr.title')}</h2>
        <div className="flex items-end gap-2">
          <label className="text-sm">
            <span className="text-gray-600">{t('ucr.status')}</span>
            <select
              className="input ml-2 w-32"
              value={filter}
              onChange={(e) => setFilter(e.target.value as UcrStatus | '')}
            >
              <option value="">—</option>
              {STATUS_OPTIONS.map((s) => (
                <option key={s} value={s}>
                  {t(`ucr.status_options.${s}`)}
                </option>
              ))}
            </select>
          </label>
          <button type="button" className="btn-primary" onClick={() => setOpen(true)}>
            {t('ucr.submit')}
          </button>
        </div>
      </header>

      <div className="card overflow-x-auto p-0">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-3 py-2 text-left font-medium text-gray-600">
                {t('ucr.request_country')}
              </th>
              <th className="px-3 py-2 text-left font-medium text-gray-600">
                {t('ucr.business_case')}
              </th>
              <th className="px-3 py-2 text-left font-medium text-gray-600">
                {t('ucr.estimated_volume')}
              </th>
              <th className="px-3 py-2 text-left font-medium text-gray-600">
                {t('ucr.user_email')}
              </th>
              <th className="px-3 py-2 text-left font-medium text-gray-600">
                {t('ucr.created_at')}
              </th>
              <th className="px-3 py-2 text-left font-medium text-gray-600">
                {t('ucr.status')}
              </th>
              <th className="px-3 py-2 text-right" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {isLoading && (
              <tr>
                <td className="px-3 py-4 text-center text-gray-400" colSpan={7}>
                  …
                </td>
              </tr>
            )}
            {!isLoading && items.length === 0 && (
              <tr>
                <td className="px-3 py-4 text-center text-gray-400" colSpan={7}>
                  {t('ucr.empty')}
                </td>
              </tr>
            )}
            {items.map((u) => (
              <tr key={u.id}>
                <td className="px-3 py-2 font-mono text-gray-900">
                  {u.requestedCountryCode}
                </td>
                <td className="px-3 py-2 text-xs text-gray-700">
                  {u.businessCase ?? '—'}
                </td>
                <td className="px-3 py-2 font-mono text-gray-700">
                  {u.estimatedVolume ?? '—'}
                </td>
                <td className="px-3 py-2 text-xs text-gray-600">
                  {u.userEmail ?? '—'}
                </td>
                <td className="px-3 py-2 text-gray-600">
                  {u.createdAt.slice(0, 10)}
                </td>
                <td className="px-3 py-2">
                  <StatusBadge variant={statusVariant(u.status)}>
                    {t(`ucr.status_options.${u.status}`)}
                  </StatusBadge>
                </td>
                <td className="px-3 py-2 text-right">
                  <select
                    className="input text-xs"
                    value={u.status}
                    onChange={(e) =>
                      statusMut.mutate({
                        id: u.id,
                        status: e.target.value as UcrStatus,
                      })
                    }
                  >
                    {STATUS_OPTIONS.map((s) => (
                      <option key={s} value={s}>
                        {t(`ucr.status_options.${s}`)}
                      </option>
                    ))}
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {open && (
        <div
          className="fixed inset-0 z-40 flex items-center justify-center bg-black bg-opacity-30"
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="mb-3 text-base font-semibold text-gray-900">
              {t('ucr.submit')}
            </h3>
            <div className="space-y-3">
              <label className="block text-sm">
                <span className="text-gray-600">{t('ucr.request_country')}</span>
                <input
                  className="input mt-1"
                  maxLength={2}
                  placeholder="PH"
                  value={form.requested_country_code}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      requested_country_code: e.target.value.toUpperCase(),
                    })
                  }
                />
              </label>
              <label className="block text-sm">
                <span className="text-gray-600">{t('ucr.business_case')}</span>
                <textarea
                  className="input mt-1"
                  rows={3}
                  value={form.business_case ?? ''}
                  onChange={(e) =>
                    setForm({ ...form, business_case: e.target.value })
                  }
                />
              </label>
              <label className="block text-sm">
                <span className="text-gray-600">{t('ucr.estimated_volume')}</span>
                <input
                  type="number"
                  className="input mt-1"
                  value={form.estimated_volume ?? ''}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      estimated_volume:
                        e.target.value === '' ? undefined : Number(e.target.value),
                    })
                  }
                />
              </label>
            </div>
            <div className="mt-4 flex justify-end gap-2">
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
                onClick={() => createMut.mutate(form)}
                disabled={!form.requested_country_code || createMut.isPending}
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
