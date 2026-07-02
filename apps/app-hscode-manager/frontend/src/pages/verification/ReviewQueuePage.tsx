import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check } from 'lucide-react';
import { AlertModal, initialModalState, ModalState } from '@/components/ui/AlertModal';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { verificationService } from '@/services/verification.service';

export function ReviewQueuePage() {
  const { t } = useTranslation('verification');
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [modal, setModal] = useState<ModalState>(initialModalState);
  const [openOnly, setOpenOnly] = useState(true);
  const [resolveTarget, setResolveTarget] = useState<{
    id: string;
    notes: string;
  } | null>(null);

  const { data: items = [], isLoading } = useQuery({
    queryKey: ['review-queue', openOnly],
    queryFn: () => verificationService.reviewQueue(openOnly),
  });

  const { data: kpi } = useQuery({
    queryKey: ['kpi', 1],
    queryFn: () => verificationService.kpi(1),
  });

  const resolveMut = useMutation({
    mutationFn: ({ id, notes }: { id: string; notes?: string }) =>
      verificationService.resolveQueue(id, notes),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['review-queue'] });
      setResolveTarget(null);
      setModal({
        isOpen: true,
        type: 'success',
        title: t('common:common.confirm'),
        message: t('queue.modal.resolved'),
      });
    },
    onError: (err) => {
      const msg = err instanceof Error ? err.message : String(err);
      setModal({
        isOpen: true,
        type: 'error',
        title: t('common:common.error'),
        message: msg,
        autoCloseMs: 0,
      });
    },
  });

  return (
    <div className="p-6">
      <header className="mb-4 flex items-end justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">{t('queue.title')}</h1>
        </div>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-1 text-xs text-gray-600">
            <input
              type="checkbox"
              checked={openOnly}
              onChange={(e) => setOpenOnly(e.target.checked)}
            />
            {t('queue.open_only')}
          </label>
        </div>
      </header>

      {kpi && (
        <div className="card mb-4 grid grid-cols-2 gap-3 md:grid-cols-5">
          <div>
            <div className="text-xs text-gray-500">{t('kpi.total_adopted')}</div>
            <div className="font-mono text-lg text-gray-900">{kpi.totalAdopted}</div>
          </div>
          <div>
            <div className="text-xs text-gray-500">{t('kpi.seizure_rate')}</div>
            <div className="font-mono text-lg text-red-700">
              {(kpi.seizureRate * 100).toFixed(2)}%
            </div>
          </div>
          <div>
            <div className="text-xs text-gray-500">{t('kpi.correction_rate')}</div>
            <div className="font-mono text-lg text-amber-700">
              {(kpi.correctionRate * 100).toFixed(2)}%
            </div>
          </div>
          <div>
            <div className="text-xs text-gray-500">{t('kpi.sealed_rate')}</div>
            <div className="font-mono text-lg text-green-700">
              {(kpi.sealedRate * 100).toFixed(2)}%
            </div>
          </div>
          <div>
            <div className="text-xs text-gray-500">{t('kpi.seizure_amount')}</div>
            <div className="font-mono text-sm text-gray-900">
              ${kpi.totalSeizureAmountUsd.toLocaleString()}
            </div>
          </div>
        </div>
      )}

      <div className="card overflow-x-auto p-0">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-3 py-2 text-left font-medium text-gray-600">
                {t('queue.priority')}
              </th>
              <th className="px-3 py-2 text-left font-medium text-gray-600">
                {t('queue.target_type')}
              </th>
              <th className="px-3 py-2 text-left font-medium text-gray-600">
                {t('queue.reason')}
              </th>
              <th className="px-3 py-2 text-left font-medium text-gray-600">HS</th>
              <th className="px-3 py-2 text-left font-medium text-gray-600">
                {t('queue.created_at')}
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
            {!isLoading && items.length === 0 && (
              <tr>
                <td className="px-3 py-4 text-center text-gray-400" colSpan={6}>
                  {t('queue.empty')}
                </td>
              </tr>
            )}
            {items.map((q) => (
              <tr
                key={q.id}
                className={`cursor-pointer hover:bg-gray-50 ${q.resolvedAt ? 'opacity-60' : ''}`}
                onClick={() => {
                  if (q.targetType === 'CLASSIFICATION') {
                    navigate(`/classifications/${q.targetId}`);
                  }
                }}
              >
                <td className="px-3 py-2 text-center">
                  <span
                    className={`inline-flex h-6 min-w-[2rem] items-center justify-center rounded text-xs font-bold ${
                      q.priority <= 10
                        ? 'bg-red-100 text-red-700'
                        : q.priority <= 30
                          ? 'bg-amber-100 text-amber-700'
                          : 'bg-gray-100 text-gray-600'
                    }`}
                  >
                    {q.priority}
                  </span>
                </td>
                <td className="px-3 py-2">
                  <StatusBadge variant="info">
                    {t(`queue.target.${q.targetType}`)}
                  </StatusBadge>
                </td>
                <td className="px-3 py-2 text-xs text-gray-700">
                  {t(`queue.reasons.${q.reason}`)}
                </td>
                <td className="px-3 py-2 font-mono text-gray-800">
                  {q.targetSummary?.hsCode ?? '—'}
                  {q.targetSummary?.itemName && (
                    <span className="ml-2 text-xs text-gray-500">
                      {q.targetSummary.itemName}
                    </span>
                  )}
                </td>
                <td className="px-3 py-2 text-gray-600">
                  {q.createdAt.slice(0, 16).replace('T', ' ')}
                </td>
                <td className="px-3 py-2 text-right">
                  {q.resolvedAt ? (
                    <StatusBadge variant="success">{t('queue.resolved')}</StatusBadge>
                  ) : (
                    <button
                      type="button"
                      className="text-xs text-blue-600 hover:underline"
                      onClick={(e) => {
                        e.stopPropagation();
                        setResolveTarget({ id: q.id, notes: '' });
                      }}
                    >
                      <Check className="mr-0.5 inline-block h-3.5 w-3.5" />
                      {t('queue.resolve')}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {resolveTarget && (
        <div
          className="fixed inset-0 z-40 flex items-center justify-center bg-black bg-opacity-30"
          onClick={() => setResolveTarget(null)}
        >
          <div
            className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="mb-3 text-base font-semibold text-gray-900">
              {t('queue.resolve')}
            </h3>
            <label className="block text-sm">
              <span className="text-gray-600">{t('queue.resolve_notes')}</span>
              <textarea
                className="input mt-1 w-full"
                rows={3}
                value={resolveTarget.notes}
                onChange={(e) =>
                  setResolveTarget({ ...resolveTarget, notes: e.target.value })
                }
              />
            </label>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setResolveTarget(null)}
              >
                {t('common:common.cancel')}
              </button>
              <button
                type="button"
                className="btn-primary"
                disabled={resolveMut.isPending}
                onClick={() =>
                  resolveMut.mutate({
                    id: resolveTarget.id,
                    notes: resolveTarget.notes || undefined,
                  })
                }
              >
                {t('queue.resolve')}
              </button>
            </div>
          </div>
        </div>
      )}

      <AlertModal state={modal} onClose={() => setModal(initialModalState)} />
    </div>
  );
}
