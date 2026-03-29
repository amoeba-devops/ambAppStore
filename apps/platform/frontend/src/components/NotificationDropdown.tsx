import { useTranslation } from 'react-i18next';
import { CheckCheck, Info, AlertTriangle, XCircle, Clock, Bell as BellIcon } from 'lucide-react';
import { NotificationItem, useMarkAsRead, useMarkAllAsRead } from '@/hooks/useNotifications';
import clsx from 'clsx';

const TYPE_ICONS: Record<string, typeof Info> = {
  SUB_APPROVED: CheckCheck,
  SUB_REJECTED: XCircle,
  SUB_SUSPENDED: AlertTriangle,
  SUB_EXPIRED: Clock,
  SUB_EXPIRING_SOON: AlertTriangle,
  SYSTEM: BellIcon,
};

const TYPE_COLORS: Record<string, string> = {
  SUB_APPROVED: 'text-green-500',
  SUB_REJECTED: 'text-red-500',
  SUB_SUSPENDED: 'text-yellow-500',
  SUB_EXPIRED: 'text-gray-500',
  SUB_EXPIRING_SOON: 'text-orange-500',
  SYSTEM: 'text-blue-500',
};

interface NotificationDropdownProps {
  notifications: NotificationItem[];
  onClose: () => void;
}

export function NotificationDropdown({ notifications, onClose }: NotificationDropdownProps) {
  const { t } = useTranslation('platform');
  const markAsRead = useMarkAsRead();
  const markAllAsRead = useMarkAllAsRead();

  const handleRead = (ntf: NotificationItem) => {
    if (!ntf.isRead) {
      markAsRead.mutate(ntf.ntfId);
    }
  };

  const handleMarkAllRead = () => {
    markAllAsRead.mutate();
  };

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    if (minutes < 1) return t('notification.justNow');
    if (minutes < 60) return t('notification.minutesAgo', { count: minutes });
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return t('notification.hoursAgo', { count: hours });
    const days = Math.floor(hours / 24);
    return t('notification.daysAgo', { count: days });
  };

  return (
    <div className="absolute right-0 z-50 mt-2 w-80 rounded-lg border bg-white shadow-xl">
      {/* Header */}
      <div className="flex items-center justify-between border-b px-4 py-3">
        <h3 className="text-sm font-semibold text-gray-900">{t('notification.title')}</h3>
        {notifications.some((n) => !n.isRead) && (
          <button
            onClick={handleMarkAllRead}
            className="text-xs text-blue-600 hover:text-blue-700"
          >
            {t('notification.markAllRead')}
          </button>
        )}
      </div>

      {/* List */}
      <div className="max-h-80 overflow-y-auto">
        {notifications.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-gray-400">{t('notification.empty')}</p>
        ) : (
          notifications.slice(0, 5).map((ntf) => {
            const Icon = TYPE_ICONS[ntf.type] || BellIcon;
            const color = TYPE_COLORS[ntf.type] || 'text-gray-500';

            return (
              <button
                key={ntf.ntfId}
                onClick={() => handleRead(ntf)}
                className={clsx(
                  'flex w-full items-start gap-3 px-4 py-3 text-left hover:bg-gray-50',
                  !ntf.isRead && 'bg-blue-50/50',
                )}
              >
                <Icon className={clsx('mt-0.5 h-4 w-4 shrink-0', color)} />
                <div className="min-w-0 flex-1">
                  <p className={clsx('text-sm', !ntf.isRead ? 'font-medium text-gray-900' : 'text-gray-700')}>
                    {ntf.title}
                  </p>
                  <p className="mt-0.5 truncate text-xs text-gray-500">{ntf.message}</p>
                  <p className="mt-1 text-xs text-gray-400">{formatTime(ntf.createdAt)}</p>
                </div>
                {!ntf.isRead && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-blue-500" />}
              </button>
            );
          })
        )}
      </div>

      {/* Footer */}
      {notifications.length > 5 && (
        <div className="border-t px-4 py-2 text-center">
          <button
            onClick={onClose}
            className="text-xs text-blue-600 hover:text-blue-700"
          >
            {t('notification.viewAll')}
          </button>
        </div>
      )}
    </div>
  );
}
