import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { clsx } from 'clsx';
import type { AppCard as AppCardType } from '@/hooks/useApps';

interface AppCardProps {
  app: AppCardType;
  subscriptionStatus?: string | null;
}

const STATUS_BADGE: Record<string, { label: string; className: string }> = {
  ACTIVE: { label: 'landing.statusAvailable', className: 'bg-green-100 text-green-700' },
  COMING_SOON: { label: 'landing.statusComingSoon', className: 'bg-amber-100 text-amber-700' },
};

const SUBSCRIPTION_BADGE: Record<string, { label: string; className: string }> = {
  ACTIVE: { label: 'landing.statusInUse', className: 'bg-blue-100 text-blue-700' },
  PENDING: { label: 'landing.statusPending', className: 'bg-purple-100 text-purple-700' },
};

const APP_ICONS: Record<string, string> = {
  'app-car-manager': '🚗',
  'app-hscode': '📦',
  'app-sales-report': '📊',
  'app-stock-management': '📈',
};

export function AppCard({ app, subscriptionStatus }: AppCardProps) {
  const { t } = useTranslation('platform');
  const navigate = useNavigate();

  const subBadge = subscriptionStatus ? SUBSCRIPTION_BADGE[subscriptionStatus] : null;
  const statusBadge = STATUS_BADGE[app.status];

  return (
    <div
      onClick={() => navigate(`/apps/${app.slug}`)}
      className="cursor-pointer rounded-xl border bg-white p-6 shadow-md transition-shadow hover:shadow-lg"
    >
      <div className="mb-3 text-4xl">{APP_ICONS[app.slug] || '📱'}</div>
      <h3 className="mb-1 text-lg font-bold text-gray-900">{app.nameEn || app.name}</h3>
      {app.name && app.nameEn && (
        <p className="mb-1 text-sm text-gray-500">({app.name})</p>
      )}
      <p className="mb-4 line-clamp-2 text-sm text-gray-600">{app.shortDesc}</p>
      <div className="flex gap-2">
        {subBadge && (
          <span className={clsx('rounded-full px-2.5 py-0.5 text-xs font-medium', subBadge.className)}>
            {t(subBadge.label)}
          </span>
        )}
        {statusBadge && !subBadge && (
          <span className={clsx('rounded-full px-2.5 py-0.5 text-xs font-medium', statusBadge.className)}>
            {t(statusBadge.label)}
          </span>
        )}
      </div>
    </div>
  );
}
