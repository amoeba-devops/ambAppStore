import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

import { useDispatches, useApproveDispatch, useRejectDispatch } from '@/hooks/useDispatches';
import { PageHeader } from '@/components/common/PageHeader';
import { DispatchCard } from '@/components/dispatch/DispatchCard';
import { KanbanColumn } from '@/components/dispatch/KanbanColumn';
import { DispatchConfirmModal } from '@/components/dispatch/DispatchConfirmModal';
import { Plus } from 'lucide-react';

type DispatchItem = Record<string, unknown>;

const PENDING_STATUSES = ['PENDING'];
const ACTIVE_STATUSES = ['APPROVED', 'DRIVER_ACCEPTED', 'DEPARTED', 'ARRIVED'];
const DONE_STATUSES = ['COMPLETED'];

export function DispatchListPage() {
  const { t } = useTranslation('car');
  const navigate = useNavigate();
  const { data, isLoading } = useDispatches();
  const approveMut = useApproveDispatch();
  const rejectMut = useRejectDispatch();

  const [confirmTarget, setConfirmTarget] = useState<DispatchItem | null>(null);

  const dispatches: DispatchItem[] = data?.data || [];

  const { pending, active, done } = useMemo(() => {
    const p: DispatchItem[] = [];
    const a: DispatchItem[] = [];
    const d: DispatchItem[] = [];

    for (const item of dispatches) {
      const status = item.status as string;
      if (PENDING_STATUSES.includes(status)) p.push(item);
      else if (ACTIVE_STATUSES.includes(status)) a.push(item);
      else if (DONE_STATUSES.includes(status)) d.push(item);
    }
    return { pending: p, active: a, done: d };
  }, [dispatches]);

  const handleApprove = (dispatch: DispatchItem) => {
    setConfirmTarget(dispatch);
  };

  const handleReject = async (dispatch: DispatchItem) => {
    await rejectMut.mutateAsync({
      id: dispatch.dispatchId as string,
      reason: '',
    });
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title={t('dispatch.title')}
        liveBadge
        actions={
          <button
            onClick={() => navigate('/dispatches/new')}
            className="flex items-center gap-1.5 rounded-lg bg-orange-500 px-4 py-2 text-sm font-medium text-white hover:bg-orange-400"
          >
            <Plus className="h-4 w-4" />
            {t('dispatch.createDispatch')}
          </button>
        }
      />

      {isLoading ? (
        <div className="py-20 text-center text-gray-400">{t('common.loading')}</div>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          {/* Pending */}
          <KanbanColumn title={t('dispatch.statusPending')} count={pending.length} color="yellow">
            {pending.length === 0 ? (
              <div className="py-8 text-center text-xs text-gray-400">{t('common.noData')}</div>
            ) : (
              pending.map((d) => (
                <DispatchCard
                  key={d.dispatchId as string}
                  dispatch={d}
                  onApprove={() => handleApprove(d)}
                  onReject={() => handleReject(d)}
                  onClick={() => navigate(`/dispatches/${d.dispatchId}`)}
                />
              ))
            )}
          </KanbanColumn>

          {/* Active */}
          <KanbanColumn title={t('dispatch.statusApproved')} count={active.length} color="blue">
            {active.length === 0 ? (
              <div className="py-8 text-center text-xs text-gray-400">{t('common.noData')}</div>
            ) : (
              active.map((d) => (
                <DispatchCard
                  key={d.dispatchId as string}
                  dispatch={d}
                  onClick={() => navigate(`/dispatches/${d.dispatchId}`)}
                />
              ))
            )}
          </KanbanColumn>

          {/* Completed */}
          <KanbanColumn title={t('dispatch.statusCompleted')} count={done.length} color="green">
            {done.length === 0 ? (
              <div className="py-8 text-center text-xs text-gray-400">{t('common.noData')}</div>
            ) : (
              done.map((d) => (
                <DispatchCard
                  key={d.dispatchId as string}
                  dispatch={d}
                  onClick={() => navigate(`/dispatches/${d.dispatchId}`)}
                />
              ))
            )}
          </KanbanColumn>
        </div>
      )}

      {/* Dispatch confirm modal */}
      {confirmTarget && (
        <DispatchConfirmModal
          dispatch={confirmTarget}
          onClose={() => setConfirmTarget(null)}
        />
      )}
    </div>
  );
}
