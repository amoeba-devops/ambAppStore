import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { X } from 'lucide-react';

interface Props {
  subId: string;
  onClose: () => void;
  onConfirm: (reason: string) => void;
}

export function ApproveRejectModal({ subId, onClose, onConfirm }: Props) {
  const { t } = useTranslation('admin');
  const [reason, setReason] = useState('');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="relative w-full max-w-md rounded-2xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <button onClick={onClose} className="absolute right-4 top-4 text-gray-400 hover:text-gray-600">
          <X size={20} />
        </button>
        <h2 className="mb-4 text-lg font-bold">{t('subscription.rejectTitle')}</h2>
        <div className="mb-4">
          <label className="mb-1 block text-sm font-medium text-gray-700">{t('subscription.rejectReasonLabel')}</label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder={t('subscription.rejectReasonPlaceholder')}
            rows={3}
            className="w-full rounded-lg border px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </div>
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 rounded-lg border py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
            {t('subscription.cancel')}
          </button>
          <button
            onClick={() => onConfirm(reason)}
            disabled={!reason.trim()}
            className="flex-1 rounded-lg bg-red-600 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
          >
            {t('subscription.reject')}
          </button>
        </div>
      </div>
    </div>
  );
}
