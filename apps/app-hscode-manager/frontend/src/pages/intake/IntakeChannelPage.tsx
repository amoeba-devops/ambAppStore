import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';
import { FileSpreadsheet, Edit3, ScanLine, ChevronLeft } from 'lucide-react';
import clsx from 'clsx';

interface ChannelCardProps {
  icon: typeof FileSpreadsheet;
  title: string;
  description: string;
  disabled?: boolean;
  onClick: () => void;
}

function ChannelCard({ icon: Icon, title, description, disabled, onClick }: ChannelCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={clsx(
        'flex h-44 w-full flex-col items-center justify-center gap-2 rounded-lg border-2 p-6 text-center transition-all',
        disabled
          ? 'cursor-not-allowed border-gray-100 bg-gray-50 opacity-50'
          : 'border-gray-200 bg-white hover:border-blue-400 hover:bg-blue-50/30',
      )}
    >
      <Icon className={clsx('h-10 w-10', disabled ? 'text-gray-300' : 'text-blue-600')} />
      <span className="text-base font-semibold text-gray-900">{title}</span>
      <span className="text-xs text-gray-500">{description}</span>
    </button>
  );
}

export function IntakeChannelPage() {
  const { t } = useTranslation('intake');
  const navigate = useNavigate();
  const { inquiryId } = useParams<{ inquiryId: string }>();

  if (!inquiryId) return null;

  return (
    <div className="p-6">
      <button
        type="button"
        className="mb-4 inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800"
        onClick={() => navigate('/')}
      >
        <ChevronLeft className="h-4 w-4" />
        {t('channel.back')}
      </button>

      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900">{t('channel.title')}</h1>
        <p className="mt-1 text-sm text-gray-500">{t('channel.subtitle')}</p>
      </div>

      <div className="grid max-w-4xl grid-cols-1 gap-4 md:grid-cols-3">
        <ChannelCard
          icon={FileSpreadsheet}
          title={t('channel.excel')}
          description={t('channel.excel_desc')}
          onClick={() => navigate(`/new-work/${inquiryId}/excel`)}
        />
        <ChannelCard
          icon={Edit3}
          title={t('channel.direct')}
          description={t('channel.direct_desc')}
          onClick={() => navigate(`/new-work/${inquiryId}/direct`)}
        />
        <ChannelCard
          icon={ScanLine}
          title={t('channel.barcode')}
          description={t('channel.barcode_desc')}
          disabled
          onClick={() => {}}
        />
      </div>
    </div>
  );
}
