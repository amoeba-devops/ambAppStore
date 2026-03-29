import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { ExternalLink, X, RotateCcw, AlertCircle } from 'lucide-react';
import { clsx } from 'clsx';
import type { SubscriptionItem } from '@/hooks/useSubscription';

const STATUS_COLORS: Record<string, string> = {
  PENDING: 'bg-amber-100 text-amber-700',
  ACTIVE: 'bg-green-100 text-green-700',
  SUSPENDED: 'bg-purple-100 text-purple-700',
  REJECTED: 'bg-red-100 text-red-700',
  CANCELLED: 'bg-gray-200 text-gray-500',
  EXPIRED: 'bg-orange-100 text-orange-700',
};

const STATUS_KEYS: Record<string, string> = {
  PENDING: 'mySubscriptions.statusPending',
  ACTIVE: 'mySubscriptions.statusActive',
  SUSPENDED: 'mySubscriptions.statusSuspended',
  REJECTED: 'mySubscriptions.statusRejected',
  CANCELLED: 'mySubscriptions.statusCancelled',
  EXPIRED: 'mySubscriptions.statusExpired',
};

const APP_ICONS: Record<string, string> = {
  'app-car-manager': '🚗',
  'app-hscode': '📦',
  'app-sales-report': '📊',
  'app-stock-management': '📈',
};

interface Props {
  subscription: SubscriptionItem;
  onCancel: (subId: string) => void;
  isCancelling: boolean;
}

export function SubscriptionCard({ subscription: sub, onCancel, isCancelling }: Props) {
  const { t } = useTranslation('platform');
  const navigate = useNavigate();

  const canCancel = sub.status === 'PENDING' || sub.status === 'ACTIVE';
  const canReapply = sub.status === 'REJECTED' || sub.status === 'CANCELLED' || sub.status === 'EXPIRED';
  const canGoToApp = sub.status === 'ACTIVE';

  return (
    <div className="rounded-xl border bg-white p-5 shadow-sm transition-shadow hover:shadow-md">
      {/* Header */}
      <div className="mb-3 flex items-start justify-between">
        <div className="flex items-center gap-3">
          <span className="text-3xl">{APP_ICONS[sub.appSlug] || '📱'}</span>
          <div>
            <h3 className="font-semibold text-gray-900">{sub.appName}</h3>
            <p className="text-xs text-gray-400">{sub.entCode} · {sub.entName}</p>
          </div>
        </div>
        <span className={clsx('rounded-full px-2.5 py-0.5 text-xs font-medium', STATUS_COLORS[sub.status] || 'bg-gray-100 text-gray-500')}>
          {t(STATUS_KEYS[sub.status] || 'mySubscriptions.statusCancelled')}
        </span>
      </div>

      {/* Info */}
      <div className="mb-3 space-y-1 text-sm text-gray-600">
        <div className="flex justify-between">
          <span>{t('mySubscriptions.appliedAt')}</span>
          <span>{new Date(sub.createdAt).toLocaleDateString()}</span>
        </div>
        {sub.expiresAt && (
          <div className="flex justify-between">
            <span>{t('mySubscriptions.expiresAt')}</span>
            <span>{new Date(sub.expiresAt).toLocaleDateString()}</span>
          </div>
        )}
        {sub.status === 'ACTIVE' && !sub.expiresAt && (
          <div className="flex justify-between">
            <span>{t('mySubscriptions.expiresAt')}</span>
            <span className="text-green-600">{t('mySubscriptions.noExpiry')}</span>
          </div>
        )}
      </div>

      {/* Reject Reason */}
      {sub.status === 'REJECTED' && sub.rejectReason && (
        <div className="mb-3 flex items-start gap-2 rounded-lg bg-red-50 p-3 text-sm">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-500" />
          <div>
            <p className="font-medium text-red-700">{t('mySubscriptions.rejectReason')}</p>
            <p className="text-red-600">{sub.rejectReason}</p>
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2 pt-1">
        {canGoToApp && (
          <a
            href={`/${sub.appSlug}`}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-blue-600 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            <ExternalLink className="h-4 w-4" />
            {t('mySubscriptions.goToApp')}
          </a>
        )}
        {canCancel && (
          <button
            onClick={() => onCancel(sub.subId)}
            disabled={isCancelling}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-gray-300 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            <X className="h-4 w-4" />
            {t('mySubscriptions.cancelSubscription')}
          </button>
        )}
        {canReapply && (
          <button
            onClick={() => navigate(`/apps/${sub.appSlug}`)}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-indigo-300 py-2 text-sm font-medium text-indigo-700 hover:bg-indigo-50"
          >
            <RotateCcw className="h-4 w-4" />
            {t('mySubscriptions.reapply')}
          </button>
        )}
      </div>
    </div>
  );
}
