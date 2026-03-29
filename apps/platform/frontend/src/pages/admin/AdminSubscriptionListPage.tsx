import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { clsx } from 'clsx';
import {
  useAdminSubscriptions,
  useApproveSubscription,
  useRejectSubscription,
  useSuspendSubscription,
  useCancelSubscription,
  useReactivateSubscription,
  type AdminSubscription,
  type AdminSubscriptionFilters,
} from '@/hooks/admin/useAdminSubscriptions';
import { useAdminApps } from '@/hooks/admin/useAdminApps';
import { ApproveRejectModal } from '@/components/admin/ApproveRejectModal';
import { SubscriptionDetailModal } from '@/components/admin/SubscriptionDetailModal';

const STATUS_COLORS: Record<string, string> = {
  PENDING: 'bg-amber-100 text-amber-700',
  ACTIVE: 'bg-green-100 text-green-700',
  SUSPENDED: 'bg-red-100 text-red-700',
  REJECTED: 'bg-gray-200 text-gray-600',
  CANCELLED: 'bg-gray-200 text-gray-600',
  EXPIRED: 'bg-orange-100 text-orange-700',
};

const STATUS_KEYS: Record<string, string> = {
  PENDING: 'subscription.statusPending',
  ACTIVE: 'subscription.statusActive',
  SUSPENDED: 'subscription.statusSuspended',
  REJECTED: 'subscription.statusRejected',
  CANCELLED: 'subscription.statusCancelled',
  EXPIRED: 'subscription.statusExpired',
};

export function AdminSubscriptionListPage() {
  const { t } = useTranslation('admin');
  const [filters, setFilters] = useState<AdminSubscriptionFilters>({ page: 1, size: 20 });
  const [selectedSub, setSelectedSub] = useState<AdminSubscription | null>(null);
  const [rejectTarget, setRejectTarget] = useState<string | null>(null);
  const [detailTarget, setDetailTarget] = useState<AdminSubscription | null>(null);
  const [approveTarget, setApproveTarget] = useState<string | null>(null);
  const [approveExpiresAt, setApproveExpiresAt] = useState('');

  const { data, isLoading } = useAdminSubscriptions(filters);
  const { data: apps } = useAdminApps();
  const approveMutation = useApproveSubscription();
  const rejectMutation = useRejectSubscription();
  const suspendMutation = useSuspendSubscription();
  const cancelMutation = useCancelSubscription();
  const reactivateMutation = useReactivateSubscription();

  const handleApprove = (subId: string) => {
    setApproveTarget(subId);
    setApproveExpiresAt('');
  };

  const handleApproveConfirm = () => {
    if (!approveTarget) return;
    const body = approveExpiresAt ? { expires_at: approveExpiresAt } : undefined;
    approveMutation.mutate({ subId: approveTarget, body });
    setApproveTarget(null);
  };

  const handleSuspend = (subId: string) => {
    if (confirm(t('subscription.confirmSuspend'))) {
      suspendMutation.mutate({ subId });
    }
  };

  const handleCancel = (subId: string) => {
    if (confirm(t('subscription.confirmCancel'))) {
      cancelMutation.mutate({ subId });
    }
  };

  const handleReactivate = (subId: string) => {
    if (confirm(t('subscription.confirmReactivate'))) {
      reactivateMutation.mutate({ subId });
    }
  };

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold">{t('subscription.title')}</h1>

      {/* Filters */}
      <div className="mb-4 flex flex-wrap gap-3">
        <input
          type="text"
          placeholder={t('subscription.searchPlaceholder')}
          className="rounded-lg border px-3 py-2 text-sm"
          onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value || undefined, page: 1 }))}
        />
        <select
          className="rounded-lg border px-3 py-2 text-sm"
          onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value || undefined, page: 1 }))}
        >
          <option value="">{t('subscription.filterByStatus')}</option>
          {['PENDING', 'ACTIVE', 'SUSPENDED', 'REJECTED', 'CANCELLED', 'EXPIRED'].map((s) => (
            <option key={s} value={s}>{t(STATUS_KEYS[s])}</option>
          ))}
        </select>
        <select
          className="rounded-lg border px-3 py-2 text-sm"
          onChange={(e) => setFilters((f) => ({ ...f, app_slug: e.target.value || undefined, page: 1 }))}
        >
          <option value="">{t('subscription.filterByApp')}</option>
          {apps?.map((a) => (
            <option key={a.slug} value={a.slug}>{a.name}</option>
          ))}
        </select>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-lg border bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b bg-gray-50 text-xs font-medium uppercase text-gray-500">
            <tr>
              <th className="px-4 py-3">{t('subscription.colEntity')}</th>
              <th className="px-4 py-3">{t('subscription.colApp')}</th>
              <th className="px-4 py-3">{t('subscription.colRequester')}</th>
              <th className="px-4 py-3">{t('subscription.colStatus')}</th>
              <th className="px-4 py-3">{t('subscription.colExpires')}</th>
              <th className="px-4 py-3">{t('subscription.colDate')}</th>
              <th className="px-4 py-3">{t('subscription.colActions')}</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-400">{t('subscription.noData')}</td></tr>
            ) : data?.items.length === 0 ? (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-400">{t('subscription.noData')}</td></tr>
            ) : (
              data?.items.map((sub) => (
                <tr key={sub.subId} className="border-b hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <button onClick={() => setDetailTarget(sub)} className="text-left hover:underline">
                      <div className="font-medium">{sub.entCode}</div>
                      <div className="text-xs text-gray-400">{sub.entName}</div>
                    </button>
                  </td>
                  <td className="px-4 py-3">{sub.appName}</td>
                  <td className="px-4 py-3">
                    <div>{sub.requestedName}</div>
                    <div className="text-xs text-gray-400">{sub.requestedEmail}</div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={clsx('rounded-full px-2 py-0.5 text-xs font-medium', STATUS_COLORS[sub.status])}>
                      {t(STATUS_KEYS[sub.status])}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500">
                    {sub.expiresAt ? new Date(sub.expiresAt).toLocaleDateString() : '-'}
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500">{new Date(sub.createdAt).toLocaleDateString()}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1">
                      {sub.status === 'PENDING' && (
                        <>
                          <button onClick={() => handleApprove(sub.subId)} className="rounded bg-green-600 px-2 py-1 text-xs text-white hover:bg-green-700">{t('subscription.approve')}</button>
                          <button onClick={() => setRejectTarget(sub.subId)} className="rounded bg-gray-500 px-2 py-1 text-xs text-white hover:bg-gray-600">{t('subscription.reject')}</button>
                        </>
                      )}
                      {sub.status === 'ACTIVE' && (
                        <>
                          <button onClick={() => handleSuspend(sub.subId)} className="rounded bg-amber-500 px-2 py-1 text-xs text-white hover:bg-amber-600">{t('subscription.suspend')}</button>
                          <button onClick={() => handleCancel(sub.subId)} className="rounded bg-red-500 px-2 py-1 text-xs text-white hover:bg-red-600">{t('subscription.cancel')}</button>
                        </>
                      )}
                      {sub.status === 'SUSPENDED' && (
                        <>
                          <button onClick={() => handleReactivate(sub.subId)} className="rounded bg-blue-600 px-2 py-1 text-xs text-white hover:bg-blue-700">{t('subscription.reactivate')}</button>
                          <button onClick={() => handleCancel(sub.subId)} className="rounded bg-red-500 px-2 py-1 text-xs text-white hover:bg-red-600">{t('subscription.cancel')}</button>
                        </>
                      )}
                      {sub.status === 'EXPIRED' && (
                        <button onClick={() => handleReactivate(sub.subId)} className="rounded bg-blue-600 px-2 py-1 text-xs text-white hover:bg-blue-700">{t('subscription.reactivate')}</button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {data && data.pagination.totalPages > 1 && (
        <div className="mt-4 flex justify-center gap-2">
          {Array.from({ length: data.pagination.totalPages }, (_, i) => (
            <button
              key={i + 1}
              onClick={() => setFilters((f) => ({ ...f, page: i + 1 }))}
              className={clsx(
                'rounded px-3 py-1 text-sm',
                filters.page === i + 1 ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200',
              )}
            >
              {i + 1}
            </button>
          ))}
        </div>
      )}

      {/* Approve Modal with Expiration Date */}
      {approveTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-full max-w-sm rounded-lg bg-white p-6 shadow-xl">
            <h3 className="mb-4 text-lg font-semibold">{t('subscription.approveTitle')}</h3>
            <label className="mb-2 block text-sm text-gray-600">
              {t('subscription.expiresAtLabel')}
            </label>
            <input
              type="date"
              value={approveExpiresAt}
              onChange={(e) => setApproveExpiresAt(e.target.value)}
              min={new Date().toISOString().split('T')[0]}
              className="mb-1 w-full rounded-lg border px-3 py-2 text-sm"
            />
            <p className="mb-4 text-xs text-gray-400">{t('subscription.expiresAtHint')}</p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setApproveTarget(null)}
                className="rounded-lg border px-4 py-2 text-sm text-gray-600 hover:bg-gray-50"
              >
                {t('subscription.cancelBtn')}
              </button>
              <button
                onClick={handleApproveConfirm}
                className="rounded-lg bg-green-600 px-4 py-2 text-sm text-white hover:bg-green-700"
              >
                {t('subscription.approve')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reject Modal */}
      {rejectTarget && (
        <ApproveRejectModal
          subId={rejectTarget}
          onClose={() => setRejectTarget(null)}
          onConfirm={(reason) => {
            rejectMutation.mutate({ subId: rejectTarget, body: { reject_reason: reason } });
            setRejectTarget(null);
          }}
        />
      )}

      {/* Detail Modal */}
      {detailTarget && (
        <SubscriptionDetailModal sub={detailTarget} onClose={() => setDetailTarget(null)} />
      )}
    </div>
  );
}
