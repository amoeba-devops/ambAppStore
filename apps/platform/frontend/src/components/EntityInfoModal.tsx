import { useTranslation } from 'react-i18next';
import { X, Building2, Mail, Hash, FileText } from 'lucide-react';
import { EntityContext } from '@/stores/entity-context.store';

interface Props {
  entity: EntityContext;
  onClose: () => void;
}

export function EntityInfoModal({ entity, onClose }: Props) {
  const { t } = useTranslation('platform');

  const rows = [
    { icon: Hash, label: t('entityModal.entityId'), value: entity.entId },
    { icon: FileText, label: t('entityModal.entityCode'), value: entity.entCode },
    { icon: Building2, label: t('entityModal.entityName'), value: entity.entName },
    { icon: Mail, label: t('entityModal.email'), value: entity.email },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div
        className="relative w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <button onClick={onClose} className="absolute right-4 top-4 text-gray-400 hover:text-gray-600">
          <X size={20} />
        </button>

        <h2 className="mb-4 text-lg font-bold text-gray-900">{t('entityModal.title')}</h2>

        <div className="space-y-3">
          {rows.map(({ icon: Icon, label, value }) => (
            <div key={label} className="flex items-start gap-3">
              <Icon className="mt-0.5 h-4 w-4 shrink-0 text-gray-400" />
              <div className="min-w-0">
                <p className="text-xs text-gray-500">{label}</p>
                <p className="truncate text-sm font-medium text-gray-900" title={value}>
                  {value || '-'}
                </p>
              </div>
            </div>
          ))}
        </div>

        <button
          onClick={onClose}
          className="mt-6 w-full rounded-lg bg-gray-100 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200"
        >
          {t('common.confirm')}
        </button>
      </div>
    </div>
  );
}
