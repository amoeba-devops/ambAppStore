import { useTranslation } from 'react-i18next';
import { Bell } from 'lucide-react';

export function NotificationsPage() {
  const { t } = useTranslation('sales');
  return (
    <div>
      <div className="mb-6 flex items-center gap-2">
        <Bell className="h-5 w-5 text-blue-600" />
        <h1 className="text-xl font-bold text-gray-900">{t('nav.notifications')}</h1>
      </div>
      <div className="rounded-lg border border-gray-200 bg-white p-12 text-center">
        <Bell className="mx-auto mb-3 h-10 w-10 text-gray-300" />
        <p className="text-lg font-medium text-gray-500">{t('placeholder.comingSoon')}</p>
        <p className="mt-1 text-sm text-gray-400">{t('placeholder.comingSoonDesc')}</p>
      </div>
    </div>
  );
}
