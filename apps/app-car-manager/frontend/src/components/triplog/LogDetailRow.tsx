import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { clsx } from 'clsx';
import { ChevronDown, ChevronUp, Pencil, Save, X } from 'lucide-react';
import { StatusBadge, getStatusVariant } from '@/components/common/StatusBadge';
import { useDrivers } from '@/hooks/useDrivers';
import { useUpdateTripLog } from '@/hooks/useTripLogs';

interface LogDetailRowProps {
  log: Record<string, unknown>;
}

export function LogDetailRow({ log }: LogDetailRowProps) {
  const { t } = useTranslation('car');
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(false);

  const status = log.status as string;
  const departAt = (log.departActual || log.departAt) ? new Date((log.departActual || log.departAt) as string) : null;
  const returnAt = (log.arriveActual || log.returnAt) ? new Date((log.arriveActual || log.returnAt) as string) : null;
  const canEdit = status !== 'VERIFIED';

  // Edit state
  const [editDriverId, setEditDriverId] = useState((log.driverId as string) || '');
  const [editPassengerCount, setEditPassengerCount] = useState(log.passengerCount != null ? Number(log.passengerCount) : 1);
  const [editOdoStart, setEditOdoStart] = useState(log.odoStart != null ? Number(log.odoStart) : 0);
  const [editOdoEnd, setEditOdoEnd] = useState(log.odoEnd != null ? Number(log.odoEnd) : 0);
  const [editFuelAmount, setEditFuelAmount] = useState(log.fuelAmount != null ? Number(log.fuelAmount) : 0);
  const [editTollCost, setEditTollCost] = useState(log.tollCost != null ? Number(log.tollCost) : 0);

  const editDistanceKm = editOdoEnd > editOdoStart ? editOdoEnd - editOdoStart : 0;

  const { data: driversRes } = useDrivers();
  const drivers: Record<string, unknown>[] = driversRes?.data ?? [];
  const updateMutation = useUpdateTripLog();

  const startEdit = () => {
    setEditDriverId((log.driverId as string) || '');
    setEditPassengerCount(log.passengerCount != null ? Number(log.passengerCount) : 1);
    setEditOdoStart(log.odoStart != null ? Number(log.odoStart) : 0);
    setEditOdoEnd(log.odoEnd != null ? Number(log.odoEnd) : 0);
    setEditFuelAmount(log.fuelAmount != null ? Number(log.fuelAmount) : 0);
    setEditTollCost(log.tollCost != null ? Number(log.tollCost) : 0);
    setEditing(true);
  };

  const cancelEdit = () => setEditing(false);

  const handleSave = async () => {
    const data: Record<string, unknown> = {
      driver_id: editDriverId || undefined,
      passenger_count: editPassengerCount,
      odo_start: editOdoStart,
      odo_end: editOdoEnd,
      fuel_amount: editFuelAmount,
      toll_cost: editTollCost,
    };
    await updateMutation.mutateAsync({ id: log.tripLogId as string, data });
    setEditing(false);
  };

  return (
    <>
      {/* Main row — 5 columns: 날짜 | 차량번호 | 노선 | 주행거리 | 상태 */}
      <tr
        onClick={() => setExpanded((v) => !v)}
        className={clsx(
          'cursor-pointer transition-colors hover:bg-gray-50',
          expanded && 'bg-orange-500/5',
        )}
      >
        <td className="px-4 py-3 text-sm text-gray-700">
          <div className="flex items-center gap-1.5">
            {expanded ? (
              <ChevronUp className="h-3.5 w-3.5 text-gray-400" />
            ) : (
              <ChevronDown className="h-3.5 w-3.5 text-gray-400" />
            )}
            {departAt
              ? departAt.toLocaleDateString(undefined, { month: '2-digit', day: '2-digit' })
              : '-'}
          </div>
        </td>
        <td className="px-4 py-3">
          <span className="font-mono text-sm font-bold text-gray-900">
            {log.vehiclePlateNumber as string || '-'}
          </span>
        </td>
        <td className="px-4 py-3 text-sm text-gray-700">
          {log.origin as string} → {log.destination as string}
        </td>
        <td className="px-4 py-3 font-mono text-sm text-gray-900">
          {log.distanceKm != null ? `${log.distanceKm}km` : '-'}
        </td>
        <td className="px-4 py-3">
          <StatusBadge variant={getStatusVariant(status)} label={status} />
        </td>
      </tr>

      {/* Expanded detail */}
      {expanded && (
        <tr className="bg-orange-500/5">
          <td colSpan={5} className="px-8 py-4">
            {/* Header with edit/save/cancel */}
            <div className="mb-3 flex items-center justify-end gap-2">
              {!editing && canEdit && (
                <button
                  onClick={(e) => { e.stopPropagation(); startEdit(); }}
                  className="flex items-center gap-1 rounded-md border border-[#d4d8e0] bg-white px-2.5 py-1 text-xs font-medium text-gray-600 hover:bg-gray-50"
                >
                  <Pencil className="h-3 w-3" />
                  {t('tripLog.edit')}
                </button>
              )}
              {editing && (
                <>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleSave(); }}
                    disabled={updateMutation.isPending}
                    className="flex items-center gap-1 rounded-md bg-orange-500 px-2.5 py-1 text-xs font-medium text-white hover:bg-orange-400 disabled:opacity-50"
                  >
                    <Save className="h-3 w-3" />
                    {t('common.save')}
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); cancelEdit(); }}
                    className="flex items-center gap-1 rounded-md border border-[#d4d8e0] bg-white px-2.5 py-1 text-xs font-medium text-gray-600 hover:bg-gray-50"
                  >
                    <X className="h-3 w-3" />
                    {t('common.cancel')}
                  </button>
                </>
              )}
            </div>

            {editing ? (
              /* Edit mode */
              <div className="grid grid-cols-4 gap-4 text-[12px]">
                <EditField label={t('tripLog.assignedDriver')}>
                  <select
                    value={editDriverId}
                    onChange={(e) => setEditDriverId(e.target.value)}
                    className="w-full rounded border border-gray-300 px-2 py-1 text-xs"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <option value="">{t('tripLog.selectDriverPlaceholder')}</option>
                    {drivers.filter((d) => d.status === 'ACTIVE').map((d) => (
                      <option key={d.driverId as string} value={d.driverId as string}>
                        {(d.driverName as string) || (d.amaUserId as string)}
                      </option>
                    ))}
                  </select>
                </EditField>
                <EditField label={t('tripLog.passengers')}>
                  <input
                    type="number" min={1} value={editPassengerCount}
                    onChange={(e) => setEditPassengerCount(Number(e.target.value) || 1)}
                    onClick={(e) => e.stopPropagation()}
                    className="w-full rounded border border-gray-300 px-2 py-1 text-xs"
                  />
                </EditField>
                <EditField label={t('tripLog.startMileage')}>
                  <input
                    type="number" min={0} value={editOdoStart}
                    onChange={(e) => setEditOdoStart(Number(e.target.value) || 0)}
                    onClick={(e) => e.stopPropagation()}
                    className="w-full rounded border border-gray-300 px-2 py-1 text-xs"
                  />
                </EditField>
                <EditField label={t('tripLog.endMileage')}>
                  <input
                    type="number" min={0} value={editOdoEnd}
                    onChange={(e) => setEditOdoEnd(Number(e.target.value) || 0)}
                    onClick={(e) => e.stopPropagation()}
                    className="w-full rounded border border-gray-300 px-2 py-1 text-xs"
                  />
                </EditField>
                <EditField label={t('tripLog.distance')}>
                  <div className="rounded border border-gray-200 bg-gray-50 px-2 py-1 text-xs font-medium">
                    {editDistanceKm} km
                  </div>
                </EditField>
                <EditField label={t('tripLog.fuelAmount')}>
                  <input
                    type="number" min={0} step={0.01} value={editFuelAmount}
                    onChange={(e) => setEditFuelAmount(Number(e.target.value) || 0)}
                    onClick={(e) => e.stopPropagation()}
                    className="w-full rounded border border-gray-300 px-2 py-1 text-xs"
                  />
                </EditField>
                <EditField label={t('tripLog.tollFee')}>
                  <input
                    type="number" min={0} value={editTollCost}
                    onChange={(e) => setEditTollCost(Number(e.target.value) || 0)}
                    onClick={(e) => e.stopPropagation()}
                    className="w-full rounded border border-gray-300 px-2 py-1 text-xs"
                  />
                </EditField>
                {/* Read-only info */}
                <DetailField
                  label={t('tripLog.departTime')}
                  value={departAt?.toLocaleString() || '-'}
                />
              </div>
            ) : (
              /* Read mode */
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
                  label={t('tripLog.assignedDriver')}
                  value={(log.driverName as string) || '-'}
                />
                <DetailField
                  label={t('tripLog.passengers')}
                  value={log.passengerCount != null ? `${log.passengerCount}${t('monitor.personsUnit')}` : '-'}
                />
                <DetailField
                  label={t('tripLog.startMileage')}
                  value={log.odoStart != null ? `${Number(log.odoStart).toLocaleString()}km` : '-'}
                />
                <DetailField
                  label={t('tripLog.endMileage')}
                  value={log.odoEnd != null ? `${Number(log.odoEnd).toLocaleString()}km` : '-'}
                />
                <DetailField
                  label={t('tripLog.fuelAmount')}
                  value={log.fuelAmount != null ? `${log.fuelAmount}L` : '-'}
                />
                <DetailField
                  label={t('tripLog.tollFee')}
                  value={log.tollCost != null ? `₩${Number(log.tollCost).toLocaleString()}` : '-'}
                />
                {Boolean(log.note) && (
                  <div className="col-span-4">
                    <DetailField label={t('tripLog.note')} value={String(log.note)} />
                  </div>
                )}
              </div>
            )}
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

function EditField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-1 text-gray-400">{label}</div>
      {children}
    </div>
  );
}
