import { useTranslation } from 'react-i18next';
import { MapPin, User } from 'lucide-react';

interface MonitorCardProps {
  plateNumber: string;
  vehicleModel: string;
  vehicleType: string;
  driverName: string;
  origin: string;
  destination: string;
  departAt: string;
  returnAt: string;
  passengerCount: number;
  passengers?: string[];
  purpose?: string;
  requesterName?: string;
}

export function MonitorCard({
  plateNumber,
  vehicleModel,
  vehicleType,
  driverName,
  origin,
  destination,
  departAt,
  returnAt,
  passengerCount,
  passengers = [],
  purpose,
  requesterName,
}: MonitorCardProps) {
  const { t } = useTranslation('car');

  const departTime = new Date(departAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const returnTime = new Date(returnAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  return (
    <div className="overflow-hidden rounded-[10px] border border-[#e2e5eb] bg-white">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[#e2e5eb] bg-[#f0f2f5] px-4 py-3.5">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 text-[12px] font-medium text-gray-600">
            <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-gray-500" />
            {t('monitor.running')}
          </div>
          <span className="font-mono text-[14px] font-semibold text-gray-900">{plateNumber}</span>
          <span className="text-[12px] text-gray-500">
            {vehicleModel} ({vehicleType})
          </span>
        </div>
        <span className="text-[12px] text-gray-400">
          {t('dispatch.driver')}: {driverName}
        </span>
      </div>

      {/* Body */}
      <div className="p-4">
        {/* Route visual */}
        <div className="mb-3 flex items-center gap-2 rounded-md border border-[#d4d8e0] bg-[#f0f2f5] px-3.5 py-2.5 text-[13px]">
          <div className="flex items-center gap-1 font-medium text-gray-900">
            <MapPin className="h-3.5 w-3.5 text-gray-400" />
            {origin}
          </div>
          <div className="flex-1 text-center text-orange-500">→ ─────── →</div>
          <div className="font-medium text-gray-900">{destination}</div>
        </div>

        {/* Meta grid */}
        <div className="grid grid-cols-3 gap-2.5">
          <div className="text-center">
            <div className="text-[10px] uppercase tracking-wide text-gray-400">
              {t('monitor.departTime')}
            </div>
            <div className="font-mono text-[14px] font-semibold text-gray-900">{departTime}</div>
          </div>
          <div className="text-center">
            <div className="text-[10px] uppercase tracking-wide text-gray-400">
              {t('monitor.returnTime')}
            </div>
            <div className="font-mono text-[14px] font-semibold text-gray-900">{returnTime}</div>
          </div>
          <div className="text-center">
            <div className="text-[10px] uppercase tracking-wide text-gray-400">
              {t('monitor.passengers')}
            </div>
            <div className="font-mono text-[14px] font-semibold text-gray-900">
              {passengerCount}{t('monitor.personsUnit')}
            </div>
          </div>
        </div>

        {/* Passengers */}
        {passengers.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5 border-t border-[#e2e5eb] pt-3">
            <span className="text-[11px] text-gray-400">{t('monitor.passengerList')}:</span>
            {passengers.map((p, i) => (
              <span
                key={i}
                className="flex items-center gap-1 rounded-full border border-[#d4d8e0] bg-[#f0f2f5] px-2.5 py-1 text-[12px] text-gray-600"
              >
                <User className="h-3 w-3" />
                {p}
              </span>
            ))}
          </div>
        )}

        {/* Purpose */}
        {purpose && (
          <div className="mt-2.5 flex items-center gap-3 border-t border-[#e2e5eb] pt-2.5 text-[11px]">
            <span className="text-gray-400">{t('monitor.purpose')}:</span>
            <span className="text-gray-600">{purpose}</span>
            {requesterName && (
              <span className="ml-auto text-gray-400">
                {t('monitor.dispatcher')}: {requesterName}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
