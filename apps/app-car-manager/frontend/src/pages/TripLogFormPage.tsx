import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

import { PageHeader } from '@/components/common/PageHeader';

export function TripLogFormPage() {
  const { t } = useTranslation('car');
  const navigate = useNavigate();

  return (
    <div>
      <PageHeader
        title={t('nav.tripLogEntry')}
        breadcrumb={['app-car-manager', 'trip-logs', 'new']}
        actions={
          <button
            onClick={() => navigate('/trip-logs')}
            className="flex items-center gap-1.5 rounded-md border border-[#d4d8e0] bg-[#f0f2f5] px-3 py-1.5 text-[13px] font-medium text-gray-600 transition-colors hover:text-gray-900"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            {t('common.back')}
          </button>
        }
      />

      <div className="p-6">
        <div className="flex h-60 items-center justify-center rounded-lg border-2 border-dashed border-gray-300 bg-white text-gray-400">
          {t('nav.tripLogEntry')} — {t('common.loading')}
        </div>
      </div>
    </div>
  );
}
