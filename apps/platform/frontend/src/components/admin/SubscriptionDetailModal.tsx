import { useTranslation } from 'react-i18next';
import { X } from 'lucide-react';
import { clsx } from 'clsx';
import type { AdminSubscription } from '@/hooks/admin/useAdminSubscriptions';

const STATUS_COLORS: Record<string, string> = {
  PENDING: 'bg-amber-100 text-amber-700',
  ACTIVE: 'bg-green-100 text-green-700',
  SUSPENDED: 'bg-red-100 text-red-700',
  REJECTED: 'bg-gray-200 text-gray-600',
  CANCELLED: 'bg-gray-200 text-gray-600',
};

interface Props {
  sub: AdminSubscription;
  onClose: () => void;
}

export function SubscriptionDetailModal({ sub, onClose }: Props) {
  const { t } = useTranslation('admin');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="relative w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <button onClick={onClose} className="absolute right-4 top-4 text-gray-400 hover:text-gray-600">
          <X size={20} />
        </button>
        <h2 className="mb-4 text-lg font-bold">{t('subscription.detailTitle')}</h2>

        <div className="space-y-4">
          {/* Entity Info */}
          <fieldset className="rounded-lg border p-3">
            <legend className="px-1 text-xs font-medium text-gray-500">{t('subscription.entityInfo')}</legend>
            <dl className="grid grid-cols-2 gap-2 text-sm">
              <dt className="text-gray-500">Entity Code</dt>
              <dd className="font-medium">{sub.entCode}</dd>
              <dt className="text-gray-500">Entity Name</dt>
              <dd className="font-medium">{sub.entName}</dd>
            </dl>
          </fieldset>

          {/* Requester Info */}
          <fieldset className="rounded-lg border p-3">
            <legend className="px-1 text-xs font-medium text-gray-500">{t('subscription.requesterInfo')}</legend>
            <dl className="grid grid-cols-2 gap-2 text-sm">
              <dt className="text-gray-500">{t('subscription.colRequester')}</dt>
              <dd className="font-medium">{sub.requestedName}</dd>
              <dt className="text-gray-500">Email</dt>
              <dd className="font-medium">{sub.requestedEmail}</dd>
            </dl>
          </fieldset>

          {/* Subscription Info */}
          <fieldset className="rounded-lg border p-3">
            <legend className="px-1 text-xs font-medium text-gray-500">{t('subscription.subscriptionInfo')}</legend>
            <dl className="grid grid-cols-2 gap-2 text-sm">
              <dt className="text-gray-500">{t('subscription.colApp')}</dt>
              <dd className="font-medium">{sub.appName}</dd>
              <dt className="text-gray-500">{t('subscription.colStatus')}</dt>
              <dd>
                <span className={clsx('rounded-full px-2 py-0.5 text-xs font-medium', STATUS_COLORS[sub.status])}>
                  {sub.status}
                </span>
              </dd>
              <dt className="text-gray-500">{t('subscription.colDate')}</dt>
              <dd className="font-medium">{new Date(sub.createdAt).toLocaleString()}</dd>
              {sub.reason && (
                <>
                  <dt className="text-gray-500">{t('subscription.reason')}</dt>
                  <dd className="font-medium">{sub.reason}</dd>
                </>
              )}
              {sub.rejectReason && (
                <>
                  <dt className="text-gray-500">{t('subscription.rejectReason')}</dt>
                  <dd className="font-medium text-red-600">{sub.rejectReason}</dd>
                </>
              )}
              {sub.approvedAt && (
                <>
                  <dt className="text-gray-500">{t('subscription.approvedAt')}</dt>
                  <dd className="font-medium">{new Date(sub.approvedAt).toLocaleString()}</dd>
                </>
              )}
            </dl>
          </fieldset>
        </div>

        <button onClick={onClose} className="mt-4 w-full rounded-lg border py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
          {t('subscription.cancel')}
        </button>
      </div>
    </div>
  );
}
