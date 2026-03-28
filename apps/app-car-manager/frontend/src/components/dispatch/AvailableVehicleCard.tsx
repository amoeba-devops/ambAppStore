import { useTranslation } from 'react-i18next';
import { clsx } from 'clsx';

interface AvailableVehicleCardProps {
  vehicle: Record<string, unknown>;
  selected: boolean;
  onSelect: () => void;
  disabled?: boolean;
}

const TYPE_EMOJI: Record<string, string> = {
  SEDAN: '🚗',
  SUV: '🚙',
  VAN: '🚐',
  TRUCK: '🚛',
  BUS: '🚌',
};

export function AvailableVehicleCard({ vehicle, selected, onSelect, disabled }: AvailableVehicleCardProps) {
  const { t } = useTranslation('car');
  const status = vehicle.status as string;
  const isOk = status === 'AVAILABLE' && !disabled;

  return (
    <button
      type="button"
      disabled={!isOk}
      onClick={onSelect}
      className={clsx(
        'flex w-full items-center gap-3 rounded-lg border p-3 text-left transition-all',
        selected
          ? 'border-green-500 bg-green-500/5 ring-1 ring-green-500/30'
          : isOk
            ? 'border-[#d4d8e0] bg-white hover:border-green-500/25'
            : 'cursor-not-allowed border-gray-200 bg-gray-50 opacity-50',
      )}
    >
      {/* Emoji */}
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#f0f2f5] text-lg">
        {TYPE_EMOJI[vehicle.vehicleType as string] || '🚗'}
      </div>

      {/* Info */}
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <span className="font-mono text-sm font-bold text-gray-900">
            {vehicle.plateNumber as string}
          </span>
          {isOk ? (
            <span className="rounded-full bg-green-100 px-1.5 py-0.5 text-[10px] font-medium text-green-700">
              {t('vehicle.statusAvailable')}
            </span>
          ) : (
            <span className="rounded-full bg-gray-100 px-1.5 py-0.5 text-[10px] text-gray-500">
              {t('dispatch.vehicleUnavailable')}
            </span>
          )}
        </div>
        <div className="mt-0.5 text-[11px] text-gray-400">
          {vehicle.modelName as string}
          {Boolean(vehicle.maxPassengers) && (
            <span className="ml-2">
              👤 {String(vehicle.maxPassengers)}{t('monitor.personsUnit')}
            </span>
          )}
        </div>
      </div>

      {/* Check */}
      {selected && (
        <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-green-500 text-white">
          ✓
        </div>
      )}
    </button>
  );
}
