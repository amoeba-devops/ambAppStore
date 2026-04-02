import { useTranslation } from 'react-i18next';
import { LayoutDashboard } from 'lucide-react';

export function DashboardPage() {
  const { t } = useTranslation('sales');

  return (
    <div>
      <div className="mb-6 flex items-center gap-2">
        <LayoutDashboard className="h-5 w-5 text-blue-600" />
        <h1 className="text-xl font-bold text-gray-900">{t('nav.dashboard')}</h1>
      </div>
      <div className="rounded-lg border border-gray-200 bg-white p-8 text-center">
        <p className="text-gray-500">Dashboard - Coming Soon</p>
        <p className="mt-2 text-sm text-gray-400">일일 매출 리포트, 주간/월간 CM 분석이 이곳에 표시됩니다.</p>
      </div>
    </div>
  );
}
