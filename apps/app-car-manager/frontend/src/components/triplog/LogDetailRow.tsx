import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { clsx } from 'clsx';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { StatusBadge, getStatusVariant } from '@/components/common/StatusBadge';

interface LogDetailRowProps {
  log: Record<string, unknown>;
}

export function LogDetailRow({ log }: LogDetailRowProps) {
  const { t } = useTranslation('car');
  const [expanded, setExpanded] = useState(false);

  const status = log.status as string;
  const departAt = log.departAt ? new Date(log.departAt as string) : null;
  const returnAt = log.returnAt ? new Date(log.returnAt as string) : null;

  return (
    <>
      {/* Main row */}
      <tr
        onClick={() => setExpanded((v) => !v)}
        className={clsx(
          'cursor-pointer transition-colors hover:bg-gray-50',
          expanded && 'bg-orange-500/5',
        )}
      >
        <td className="px-4 py-3">
          <div className="flex items-center gap-1.5">
            {expanded ? (
              <ChevronUp className="h-3.5 w-3.5 text-gray-400" />
            ) : (
              <ChevronDown className="h-3.5 w-3.5 text-gray-400" />
            )}
            <span className="font-mono text-sm font-bold text-gray-900">
              {log.vehiclePlateNumber as string || '-'}
            </span>
          </div>
        </td>
        <td className="px-4 py-3 text-sm text-gray-700">
          {departAt
            ? departAt.toLocaleDateString(undefined, { month: '2-digit', day: '2-digit' })
            : '-'}
        </td>
        <td className="px-4 py-3 text-sm text-gray-700">
          {log.origin as string} → {log.destination as string}
        </td>
        <td className="px-4 py-3 font-mono text-sm text-gray-900">
          {log.distanceKm != null ? `${log.distanceKm}km` : '-'}
        </td>
        <td className="px-4 py-3 font-mono text-sm text-gray-900">
          {log.fuelCost != null ? `₩${(log.fuelCost as number).toLocaleString()}` : '-'}
        </td>
        <td className="px-4 py-3">
          <StatusBadge variant={getStatusVariant(status)} label={status} />
        </td>
      </tr>

      {/* Expanded detail */}
      {expanded && (
        <tr className="bg-orange-500/5">
          <td colSpan={6} className="px-8 py-4">
            <div className="grid grid-cols-4 gap-4 text-[12px]">
              <DetailField
                label={t('tripLog.departTime')}
                value={departAt?.toLocaleString() || '-'}
              />
              <DetailField
                label={t('tripLog.returnTime')}
                value={returnAt?.toLocaleString() || '-'}
              />
              <DetailField
                label={t('dispatch.driver')}
                value={(log.driverName as string) || '-'}
              />
              <DetailField
                label={t('tripLog.passengers')}
                value={log.passengerCount != null ? `${log.passengerCount}${t('monitor.personsUnit')}` : '-'}
              />
              <DetailField
                label={t('tripLog.startMileage')}
                value={log.startMileage != null ? `${(log.startMileage as number).toLocaleString()}km` : '-'}
              />
              <DetailField
                label={t('tripLog.endMileage')}
                value={log.endMileage != null ? `${(log.endMileage as number).toLocaleString()}km` : '-'}
              />
              <DetailField
                label={t('tripLog.fuelAmount')}
                value={log.fuelAmount != null ? `${log.fuelAmount}L` : '-'}
              />
              <DetailField
                label={t('tripLog.tollFee')}
                value={log.tollFee != null ? `₩${(log.tollFee as number).toLocaleString()}` : '-'}
              />
              {Boolean(log.note) && (
                <div className="col-span-4">
                  <DetailField label={t('dispatch.note')} value={String(log.note)} />
                </div>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

function DetailField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="mb-0.5 text-gray-400">{label}</div>
      <div className="font-medium text-gray-700">{value}</div>
    </div>
  );
}
