import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronLeft } from 'lucide-react';
import { AlertModal, initialModalState, ModalState } from '@/components/ui/AlertModal';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { intakeService } from '@/services/intake.service';
import type { HoldRow } from '@/types/inquiry.types';

export function HoldQueuePage() {
  const { t } = useTranslation('intake');
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { inquiryId, batchId } = useParams<{ inquiryId: string; batchId: string }>();
  const [modal, setModal] = useState<ModalState>(initialModalState);
  const [editing, setEditing] = useState<HoldRow | null>(null);
  const [editValues, setEditValues] = useState<Record<string, string>>({});

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ['hold-rows', batchId],
    queryFn: () => intakeService.listHoldRows(batchId!),
    enabled: !!batchId,
  });

  const updateMut = useMutation({
    mutationFn: ({ id, raw }: { id: string; raw: Record<string, unknown> }) =>
      intakeService.updateHold(id, raw),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['hold-rows', batchId] });
      setEditing(null);
      setEditValues({});
      setModal({
        isOpen: true,
        type: 'success',
        title: t('common:common.confirm'),
        message: t('modal.hold_resolved'),
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

  const startEdit = (row: HoldRow) => {
    setEditing(row);
    const v: Record<string, string> = {};
    for (const [k, val] of Object.entries(row.rawData)) {
      v[k] = val === null || val === undefined ? '' : String(val);
    }
    setEditValues(v);
  };

  const saveEdit = () => {
    if (!editing) return;
    const raw: Record<string, unknown> = {};
    for (const [k, val] of Object.entries(editValues)) {
      raw[k] = val === '' ? null : val;
    }
    updateMut.mutate({ id: editing.id, raw });
  };

  return (
    <div className="p-6">
      <button
        type="button"
        className="mb-4 inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800"
        onClick={() => navigate(`/new-work/${inquiryId}/excel`)}
      >
        <ChevronLeft className="h-4 w-4" />
        {t('channel.back')}
      </button>

      <h1 className="mb-4 text-xl font-bold text-gray-900">{t('hold.title')}</h1>

      <div className="card overflow-x-auto p-0">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-3 py-2 text-left font-medium text-gray-600">
                {t('hold.row')}
              </th>
              <th className="px-3 py-2 text-left font-medium text-gray-600">
                {t('hold.errors')}
              </th>
              <th className="px-3 py-2 text-left font-medium text-gray-600">data</th>
              <th className="px-3 py-2 text-right" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {isLoading && (
              <tr>
                <td className="px-3 py-4 text-center text-gray-400" colSpan={4}>
                  …
                </td>
              </tr>
            )}
            {!isLoading && rows.length === 0 && (
              <tr>
                <td className="px-3 py-4 text-center text-gray-400" colSpan={4}>
                  {t('hold.empty')}
                </td>
              </tr>
            )}
            {rows.map((row) => (
              <tr key={row.id} className={row.resolvedAt ? 'bg-green-50/30' : ''}>
                <td className="px-3 py-2 font-mono text-gray-700">{row.rowIndex + 1}</td>
                <td className="px-3 py-2">
                  {row.resolvedAt ? (
                    <StatusBadge variant="success">{t('hold.resolved')}</StatusBadge>
                  ) : (
                    <div className="flex flex-wrap gap-1">
                      {row.validationErrors?.map((e, i) => (
                        <StatusBadge key={i} variant="error">
                          {e.field}: {e.code}
                        </StatusBadge>
                      ))}
                    </div>
                  )}
                </td>
                <td className="px-3 py-2 text-xs text-gray-600">
                  <code className="rounded bg-gray-100 px-1.5 py-0.5">
                    {JSON.stringify(row.rawData).slice(0, 120)}
                    {JSON.stringify(row.rawData).length > 120 && '…'}
                  </code>
                </td>
                <td className="px-3 py-2 text-right">
                  {!row.resolvedAt && (
                    <button
                      type="button"
                      className="text-xs text-blue-600 hover:underline"
                      onClick={() => startEdit(row)}
                    >
                      {t('hold.edit')}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editing && (
        <div
          className="fixed inset-0 z-40 flex items-center justify-center bg-black bg-opacity-30"
          onClick={() => setEditing(null)}
        >
          <div
            className="w-full max-w-xl rounded-lg bg-white p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="mb-3 text-base font-semibold text-gray-900">
              Row #{editing.rowIndex + 1}
            </h3>
            <div className="max-h-96 space-y-2 overflow-y-auto">
              {Object.keys(editValues).map((k) => (
                <label key={k} className="block text-sm">
                  <span className="text-gray-600">{k}</span>
                  <input
                    className="input mt-1"
                    value={editValues[k]}
                    onChange={(e) =>
                      setEditValues({ ...editValues, [k]: e.target.value })
                    }
                  />
                </label>
              ))}
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" className="btn-secondary" onClick={() => setEditing(null)}>
                {t('common:common.cancel')}
              </button>
              <button
                type="button"
                className="btn-primary"
                onClick={saveEdit}
                disabled={updateMut.isPending}
              >
                {t('hold.edit')}
              </button>
            </div>
          </div>
        </div>
      )}

      <AlertModal state={modal} onClose={() => setModal(initialModalState)} />
    </div>
  );
}
