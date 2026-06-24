import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { CheckCircle2, XCircle, AlertTriangle, Info, X } from 'lucide-react';
import clsx from 'clsx';

export type AlertModalType = 'success' | 'error' | 'warning' | 'info';

export interface ModalState {
  isOpen: boolean;
  type: AlertModalType;
  title: string;
  message: string;
  autoCloseMs?: number;
}

interface Props {
  state: ModalState;
  onClose: () => void;
}

const TYPE_ICON: Record<AlertModalType, typeof CheckCircle2> = {
  success: CheckCircle2,
  error: XCircle,
  warning: AlertTriangle,
  info: Info,
};

const TYPE_COLOR: Record<AlertModalType, string> = {
  success: 'text-green-600',
  error: 'text-red-600',
  warning: 'text-amber-600',
  info: 'text-blue-600',
};

export function AlertModal({ state, onClose }: Props) {
  const { t } = useTranslation('common');
  const Icon = TYPE_ICON[state.type];

  useEffect(() => {
    if (state.isOpen && state.type === 'success' && state.autoCloseMs !== 0) {
      const ms = state.autoCloseMs ?? 3000;
      const id = setTimeout(onClose, ms);
      return () => clearTimeout(id);
    }
    return undefined;
  }, [state.isOpen, state.type, state.autoCloseMs, onClose]);

  if (!state.isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-30"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-3">
          <Icon className={clsx('mt-0.5 h-6 w-6 flex-shrink-0', TYPE_COLOR[state.type])} />
          <div className="flex-1">
            <h3 className="text-base font-semibold text-gray-900">{state.title}</h3>
            <p className="mt-1 whitespace-pre-line text-sm text-gray-600">
              {state.message}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
            aria-label="close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="mt-4 flex justify-end">
          <button type="button" className="btn-primary" onClick={onClose}>
            {t('common.confirm')}
          </button>
        </div>
      </div>
    </div>
  );
}

export const initialModalState: ModalState = {
  isOpen: false,
  type: 'info',
  title: '',
  message: '',
};
