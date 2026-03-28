import { useTranslation } from 'react-i18next';
import { clsx } from 'clsx';

const avatarColors: Record<string, string> = {
  PRIMARY_DRIVER: 'from-orange-400 to-orange-700',
  SUB_DRIVER: 'from-blue-400 to-blue-700',
  POOL_DRIVER: 'from-purple-400 to-purple-700',
};

const roleBadgeStyles: Record<string, string> = {
  PRIMARY_DRIVER: 'bg-orange-500/[0.08] text-orange-600',
  SUB_DRIVER: 'bg-blue-500/[0.08] text-blue-600',
  POOL_DRIVER: 'border border-[#d4d8e0] bg-[#f8f9fb] text-gray-600',
};

const statusStyles: Record<string, string> = {
  ACTIVE: 'bg-green-500/[0.08] text-green-600',
  ON_LEAVE: 'bg-yellow-500/[0.08] text-yellow-600',
  INACTIVE: 'bg-gray-100 text-gray-400',
};

interface DriverCardProps {
  driver: Record<string, unknown>;
  isPrimary?: boolean;
  onEdit?: () => void;
}

export function DriverCard({ driver, isPrimary, onEdit }: DriverCardProps) {
  const { t } = useTranslation('car');

  const role = (driver.role as string) || 'SUB_DRIVER';
  const status = (driver.status as string) || 'ACTIVE';
  const name = (driver.name as string) || (driver.amaUserId as string) || '';
  const initial = name.charAt(0);
  const department = driver.department as string;
  const licenseExpiry = driver.licenseExpiry as string;

  // Calculate D-day for license
  let licenseDays: number | null = null;
  let licenseWarning = false;
  if (licenseExpiry) {
    licenseDays = Math.ceil((new Date(licenseExpiry).getTime() - Date.now()) / 86400000);
    licenseWarning = licenseDays > 0 && licenseDays <= 30;
  }

  return (
    <div
      className={clsx(
        'flex items-center gap-2.5 rounded-md border border-[#d4d8e0] bg-[#f0f2f5] px-3 py-2.5 transition-colors hover:border-orange-500/25',
        isPrimary && 'border-l-2 border-l-orange-500',
      )}
    >
      {/* Avatar */}
      <div
        className={clsx(
          'flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br text-[12px] font-bold text-white',
          avatarColors[role] || 'from-gray-400 to-gray-600',
        )}
      >
        {initial}
      </div>

      {/* Info */}
      <div className="min-w-0 flex-1">
        <div className="text-[13px] font-semibold text-gray-900">{name}</div>
        {department && <div className="text-[11px] text-gray-400">{department}</div>}
      </div>

      {/* Role badge */}
      <span
        className={clsx(
          'rounded-full px-1.5 py-0.5 text-[10px] font-semibold',
          roleBadgeStyles[role],
        )}
      >
        {role === 'PRIMARY_DRIVER' ? 'PRIMARY' : role === 'SUB_DRIVER' ? 'SUB' : 'POOL'}
      </span>

      {/* Status */}
      <span
        className={clsx(
          'rounded-full px-1.5 py-0.5 text-[10px] font-medium',
          statusStyles[status],
        )}
      >
        {status === 'ACTIVE' ? '● ACTIVE' : status === 'ON_LEAVE' ? '🌴 ON_LEAVE' : 'INACTIVE'}
      </span>

      {/* License info */}
      {licenseExpiry && (
        <span
          className={clsx(
            'font-mono text-[11px]',
            licenseWarning ? 'text-red-600' : 'text-gray-400',
          )}
        >
          {licenseWarning
            ? `D-${licenseDays} ⚠`
            : `~${new Date(licenseExpiry).getFullYear()}.${String(new Date(licenseExpiry).getMonth() + 1).padStart(2, '0')}`}
        </span>
      )}

      {/* Edit */}
      {onEdit && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onEdit();
          }}
          className="rounded-md px-2 py-1 text-[12px] text-gray-500 transition-colors hover:bg-gray-200 hover:text-gray-700"
        >
          {t('common.edit')}
        </button>
      )}
    </div>
  );
}
