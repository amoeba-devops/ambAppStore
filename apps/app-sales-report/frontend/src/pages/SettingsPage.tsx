import { useTranslation } from 'react-i18next';
import { Settings } from 'lucide-react';

export function SettingsPage() {
  const { t } = useTranslation('sales');
  return (
    <div>
      <div className="mb-6 flex items-center gap-2">
        <Settings className="h-5 w-5 text-blue-600" />
        <h1 className="text-xl font-bold text-gray-900">{t('nav.settings')}</h1>
      </div>
      <div className="rounded-lg border border-gray-200 bg-white p-12 text-center">
        <Settings className="mx-auto mb-3 h-10 w-10 text-gray-300" />
        <p className="text-lg font-medium text-gray-500">{t('placeholder.comingSoon')}</p>
        <p className="mt-1 text-sm text-gray-400">{t('placeholder.comingSoonDesc')}</p>
      </div>
    </div>
  );
}
