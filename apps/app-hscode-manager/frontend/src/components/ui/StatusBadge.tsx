import clsx from 'clsx';

interface Props {
  variant: 'active' | 'beta' | 'inactive' | 'success' | 'warning' | 'error' | 'info';
  children: React.ReactNode;
}

const COLOR: Record<Props['variant'], string> = {
  active: 'bg-green-50 text-green-700 ring-green-600/20',
  beta: 'bg-amber-50 text-amber-700 ring-amber-600/20',
  inactive: 'bg-gray-50 text-gray-600 ring-gray-500/20',
  success: 'bg-green-50 text-green-700 ring-green-600/20',
  warning: 'bg-amber-50 text-amber-700 ring-amber-600/20',
  error: 'bg-red-50 text-red-700 ring-red-600/20',
  info: 'bg-blue-50 text-blue-700 ring-blue-600/20',
};

export function StatusBadge({ variant, children }: Props) {
  return (
    <span
      className={clsx(
        'inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ring-1 ring-inset',
        COLOR[variant],
      )}
    >
      {children}
    </span>
  );
}
