import { useTranslation } from 'react-i18next';
import { clsx } from 'clsx';

interface DriverOption {
  driverId: string;
  driverName: string;
  phone?: string;
  licenseType?: string;
  role?: string;
  status?: string;
}

interface DriverSelectorProps {
  drivers: DriverOption[];
  selected: string | null;
  onSelect: (driverId: string) => void;
}

const ROLE_ORDER = ['PRIMARY_DRIVER', 'SUB_DRIVER', 'POOL_DRIVER'];
const ROLE_I18N_KEY: Record<string, string> = {
  PRIMARY_DRIVER: 'driverForm.rolePrimary',
  SUB_DRIVER: 'driverForm.roleSub',
  POOL_DRIVER: 'driverForm.rolePool',
};
const ROLE_COLOR: Record<string, string> = {
  PRIMARY_DRIVER: 'bg-blue-100 text-blue-700',
  SUB_DRIVER: 'bg-green-100 text-green-700',
  POOL_DRIVER: 'bg-gray-100 text-gray-700',
};

export function DriverSelector({ drivers, selected, onSelect }: DriverSelectorProps) {
  const { t } = useTranslation('car');

  // Group by role
  const groups = ROLE_ORDER.reduce<Record<string, DriverOption[]>>((acc, role) => {
    const filtered = drivers.filter((d) => d.role === role);
    if (filtered.length > 0) acc[role] = filtered;
    return acc;
  }, {});

  if (drivers.length === 0) {
    return (
      <div className="py-4 text-center text-xs text-gray-400">
        {t('dispatch.noAvailableDrivers')}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {Object.entries(groups).map(([role, list]) => (
        <div key={role}>
          <div className="mb-1.5 text-[11px] font-semibold uppercase text-gray-400">
            {t(ROLE_I18N_KEY[role]) || role}
          </div>
          <div className="space-y-1.5">
            {list.map((driver) => {
              const isSelected = selected === driver.driverId;
              const isAvailable = driver.status === 'ACTIVE' || driver.status === 'AVAILABLE';

              return (
                <button
                  key={driver.driverId}
                  type="button"
                  disabled={!isAvailable}
                  onClick={() => onSelect(driver.driverId)}
                  className={clsx(
                    'flex w-full items-center gap-3 rounded-lg border p-2.5 text-left transition-all',
                    isSelected
                      ? 'border-orange-500 bg-orange-500/5 ring-1 ring-orange-500/30'
                      : isAvailable
                        ? 'border-[#d4d8e0] bg-white hover:border-orange-500/25'
                        : 'cursor-not-allowed border-gray-200 bg-gray-50 opacity-50',
                  )}
                >
                  {/* Radio indicator */}
                  <div
                    className={clsx(
                      'flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2',
                      isSelected ? 'border-orange-500' : 'border-gray-300',
                    )}
                  >
                    {isSelected && <div className="h-2 w-2 rounded-full bg-orange-500" />}
                  </div>

                  {/* Driver info */}
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-gray-900">{driver.driverName}</span>
                      <span className={clsx('rounded-full px-1.5 py-0.5 text-[10px] font-medium', ROLE_COLOR[role])}>
                        {t(ROLE_I18N_KEY[role])}
                      </span>
                      {!isAvailable && (
                        <span className="rounded-full bg-red-100 px-1.5 py-0.5 text-[10px] text-red-600">
                          {t('dispatch.driverBusy')}
                        </span>
                      )}
                    </div>
                    <div className="mt-0.5 text-[11px] text-gray-400">
                      {driver.phone && <span>{driver.phone}</span>}
                      {driver.licenseType && <span className="ml-2">🪪 {driver.licenseType}</span>}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
