import { useTranslation } from 'react-i18next';
import { Bell } from 'lucide-react';
import { clsx } from 'clsx';

interface Alert {
  id: string;
  type: 'warning' | 'danger';
  message: string;
  actionLabel?: string;
  onAction?: () => void;
}

interface AlertSectionProps {
  alerts: Alert[];
}

const alertStyles = {
  warning: 'bg-yellow-500/[0.08] border-yellow-500/30',
  danger: 'bg-red-500/[0.08] border-red-500/30',
};

export function AlertSection({ alerts }: AlertSectionProps) {
  const { t } = useTranslation('car');

  if (alerts.length === 0) return null;

  return (
    <div className="mt-6">
      <h2 className="mb-3 text-[14px] font-semibold text-gray-900">
        ⚠️ {t('vehicle.alerts')}
      </h2>
      <div className="flex flex-col gap-2">
        {alerts.map((alert) => (
          <div
            key={alert.id}
            className={clsx(
              'flex items-center gap-2.5 rounded-md border px-3.5 py-2.5',
              alertStyles[alert.type],
            )}
          >
            <Bell className="h-3.5 w-3.5 flex-shrink-0 text-gray-500" />
            <span
              className="flex-1 text-[13px] text-gray-600"
              dangerouslySetInnerHTML={{ __html: alert.message }}
            />
            {alert.actionLabel && (
              <button
                onClick={alert.onAction}
                className="ml-auto flex-shrink-0 rounded-md px-2.5 py-1 text-[12px] text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700"
              >
                {alert.actionLabel}
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
