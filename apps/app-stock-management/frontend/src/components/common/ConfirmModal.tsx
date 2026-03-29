import { useTranslation } from 'react-i18next';

interface ConfirmModalProps {
  open: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmModal({ open, title, message, onConfirm, onCancel }: ConfirmModalProps) {
  const { t } = useTranslation('stock');
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="w-full max-w-sm rounded-lg bg-white p-6 shadow-xl">
        <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
        <p className="mt-2 text-sm text-gray-600">{message}</p>
        <div className="mt-6 flex justify-end gap-3">
          <button onClick={onCancel} className="rounded-md border px-4 py-2 text-sm text-gray-600 hover:bg-gray-50">{t('common.cancel')}</button>
          <button onClick={onConfirm} className="rounded-md bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-500">{t('common.confirm')}</button>
        </div>
      </div>
    </div>
  );
}
