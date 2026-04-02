import { useToastStore } from '@/stores/toast.store';
import { X } from 'lucide-react';
import { clsx } from 'clsx';

export function ToastContainer() {
  const { toasts, dismissToast } = useToastStore();

  if (toasts.length === 0) return null;

  return (
    <div className="fixed right-4 top-4 z-50 flex flex-col gap-2">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={clsx(
            'flex items-center gap-2 rounded-lg px-4 py-3 text-sm shadow-lg',
            toast.type === 'success' && 'bg-green-50 text-green-800 border border-green-200',
            toast.type === 'error' && 'bg-red-50 text-red-800 border border-red-200',
            toast.type === 'info' && 'bg-blue-50 text-blue-800 border border-blue-200',
            toast.type === 'warning' && 'bg-yellow-50 text-yellow-800 border border-yellow-200',
          )}
        >
          <span className="flex-1">{toast.message}</span>
          <button onClick={() => dismissToast(toast.id)} className="opacity-60 hover:opacity-100">
            <X className="h-4 w-4" />
          </button>
        </div>
      ))}
    </div>
  );
}
