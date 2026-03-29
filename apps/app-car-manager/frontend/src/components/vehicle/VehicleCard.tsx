import { useTranslation } from 'react-i18next';
import { Car, Bus, Truck, Users, Fuel, Settings, MapPin } from 'lucide-react';
import { clsx } from 'clsx';
import { StatusBadge, getStatusVariant } from '@/components/common/StatusBadge';

const typeIcons: Record<string, string> = {
  PASSENGER: '🚗',
  VAN: '🚐',
  TRUCK: '🚛',
};

interface VehicleCardProps {
  vehicle: Record<string, unknown>;
  onClick?: () => void;
}

export function VehicleCard({ vehicle, onClick }: VehicleCardProps) {
  const { t } = useTranslation('car');

  const status = vehicle.status as string;
  const plateNumber = vehicle.plateNumber as string;
  const make: string = (vehicle.make as string) || '';
  const model: string = (vehicle.model as string) || '';
  const year: string = String(vehicle.year || '');
  const fuelType: string = (vehicle.fuelType as string) || '';
  const maxPassengers: number = (vehicle.maxPassengers as number) || 0;
  const transmission: string = (vehicle.transmission as string) || 'AT';
  const purchaseType: string = (vehicle.purchaseType as string) || 'OWNED';
  const isRunning = status === 'IN_USE';
  const isMaintenance = status === 'MAINTENANCE';
  const typeIcon = typeIcons[(vehicle.type as string)] || '🚗';

  return (
    <div
      onClick={onClick}
      className={clsx(
        'relative cursor-pointer overflow-hidden rounded-[10px] border bg-white p-4 transition-all hover:-translate-y-0.5 hover:shadow-[0_4px_16px_rgba(0,0,0,0.1)]',
        isRunning && 'border-blue-400/40',
        isMaintenance && 'border-yellow-400/30 opacity-85',
        !isRunning && !isMaintenance && 'border-[#e2e5eb] hover:border-orange-500/25',
      )}
    >
      {/* Header: icon + status */}
      <div className="mb-3 flex items-start justify-between">
        <span className="text-[28px] leading-none">{typeIcon}</span>
        <StatusBadge variant={getStatusVariant(status)} label={status} />
      </div>

      {/* Plate + model */}
      <div className="mb-0.5 font-mono text-[18px] font-semibold tracking-wide text-gray-900">
        {plateNumber}
      </div>
      <div className="mb-2.5 text-[12px] text-gray-600">
        {make} {model} {year} · {fuelType}
      </div>

      {/* Specs */}
      <div className="flex gap-3">
        <span className="flex items-center gap-1 text-[11px] text-gray-400">
          <Users className="h-3 w-3" />
          {maxPassengers}{t('monitor.personsUnit')}
        </span>
        <span className="flex items-center gap-1 text-[11px] text-gray-400">
          <Settings className="h-3 w-3" />
          {transmission}
        </span>
        <span className="flex items-center gap-1 text-[11px] text-gray-400">
          <Fuel className="h-3 w-3" />
          {purchaseType}
        </span>
      </div>

      {/* Running info (only for IN_USE) */}
      {isRunning && Boolean(vehicle.currentDispatch) && (
        <div className="mt-3 border-t border-[#e2e5eb] pt-3 text-[12px]">
          <div className="flex items-center gap-1 text-gray-600">
            <MapPin className="h-3 w-3 text-gray-500" />
            {(vehicle.currentDispatch as Record<string, unknown>).origin as string} → {(vehicle.currentDispatch as Record<string, unknown>).destination as string}
          </div>
          <div className="text-gray-600">
            {t('dispatch.driver')}: {(vehicle.currentDispatch as Record<string, unknown>).driverName as string}
          </div>
        </div>
      )}

      {/* Maintenance info */}
      {isMaintenance && Boolean(vehicle.maintenanceNote) && (
        <div className="mt-3 border-t border-[#e2e5eb] pt-3 text-[12px]">
          <span className="text-yellow-600">⚠ {vehicle.maintenanceNote as string}</span>
        </div>
      )}
    </div>
  );
}
