import { clsx } from 'clsx';

type BadgeVariant = 'success' | 'warning' | 'danger' | 'info' | 'default' | 'live';

interface StatusBadgeProps {
  label: string;
  variant?: BadgeVariant;
  size?: 'sm' | 'md';
  dot?: boolean;
  pulse?: boolean;
}

const variantMap: Record<BadgeVariant, string> = {
  success: 'bg-green-100 text-green-700 border-green-200',
  warning: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  danger: 'bg-red-100 text-red-700 border-red-200',
  info: 'bg-blue-100 text-blue-700 border-blue-200',
  default: 'bg-gray-100 text-gray-700 border-gray-200',
  live: 'bg-green-100 text-green-700 border-green-300',
};

const dotColorMap: Record<BadgeVariant, string> = {
  success: 'bg-green-500',
  warning: 'bg-yellow-500',
  danger: 'bg-red-500',
  info: 'bg-blue-500',
  default: 'bg-gray-500',
  live: 'bg-green-500',
};

// Helper: map status strings to badge variants
const STATUS_VARIANT_MAP: Record<string, BadgeVariant> = {
  AVAILABLE: 'success',
  ACTIVE: 'success',
  COMPLETED: 'success',
  VERIFIED: 'success',
  IN_USE: 'info',
  IN_PROGRESS: 'info',
  APPROVED: 'info',
  DRIVER_ACCEPTED: 'info',
  DEPARTED: 'info',
  ARRIVED: 'info',
  PENDING: 'warning',
  ON_LEAVE: 'warning',
  MAINTENANCE: 'warning',
  REJECTED: 'danger',
  DRIVER_REJECTED: 'danger',
  CANCELLED: 'danger',
  DISPOSED: 'danger',
  INACTIVE: 'default',
};

export function getStatusVariant(status: string): BadgeVariant {
  return STATUS_VARIANT_MAP[status] || 'default';
}

export function StatusBadge({ label, variant = 'default', size = 'sm', dot, pulse }: StatusBadgeProps) {
  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1.5 rounded-full border font-medium',
        variantMap[variant],
        size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-3 py-1 text-sm',
      )}
    >
      {dot && (
        <span className="relative flex h-2 w-2">
          {pulse && (
            <span
              className={clsx('absolute inline-flex h-full w-full animate-ping rounded-full opacity-75', dotColorMap[variant])}
            />
          )}
          <span className={clsx('relative inline-flex h-2 w-2 rounded-full', dotColorMap[variant])} />
        </span>
      )}
      {label}
    </span>
  );
}
