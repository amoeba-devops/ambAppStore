import { useTranslation } from 'react-i18next';
import { UserCheck, UserMinus, Loader2 } from 'lucide-react';

import { Modal } from '@/components/common/Modal';
import { useDrivers, useAssignDriver, useUnassignDriver } from '@/hooks/useDrivers';

interface PoolDriverModalProps {
  open: boolean;
  onClose: () => void;
  vehicleId: string;
}

export function PoolDriverModal({ open, onClose, vehicleId }: PoolDriverModalProps) {
  const { t } = useTranslation('car');
  const { data, isLoading } = useDrivers(open ? undefined : { vehicle_id: '__disabled__' });
  const assignMut = useAssignDriver();
  const unassignMut = useUnassignDriver();

  const allDrivers: Record<string, unknown>[] = data?.data || [];
  const poolDrivers = allDrivers.filter((d) => d.role === 'POOL_DRIVER');

  const assigned = poolDrivers.filter((d) => d.vehicleId === vehicleId);
  const available = poolDrivers.filter((d) => d.vehicleId !== vehicleId);

  const handleAssign = async (driverId: string) => {
    await assignMut.mutateAsync({ id: driverId, vehicleId });
  };

  const handleUnassign = async (driverId: string) => {
    await unassignMut.mutateAsync(driverId);
  };

  const driverName = (d: Record<string, unknown>) =>
    (d.driverName as string) || (d.amaUserId as string) || '';

  const driverEmail = (d: Record<string, unknown>) =>
    (d.driverEmail as string) || '';

  return (
    <Modal open={open} onClose={onClose} title={`🌐 ${t('detail.poolDriverManage')}`} size="md">
      {isLoading ? (
        <div className="flex items-center justify-center py-10">
          <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
        </div>
      ) : poolDrivers.length === 0 ? (
        <div className="py-10 text-center text-sm text-gray-400">
          {t('poolDriver.noPoolDrivers')}
        </div>
      ) : (
        <div className="space-y-5">
          {/* Assigned to this vehicle */}
          <div>
            <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">
              {t('poolDriver.assignedToVehicle')} ({assigned.length})
            </div>
            {assigned.length === 0 ? (
              <div className="rounded-lg border border-dashed border-[#d4d8e0] px-4 py-4 text-center text-xs text-gray-400">
                {t('poolDriver.noneAssigned')}
              </div>
            ) : (
              <div className="space-y-1.5">
                {assigned.map((d) => (
                  <div
                    key={d.driverId as string}
                    className="flex items-center justify-between rounded-lg border border-orange-200 bg-orange-50/50 px-3 py-2.5"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-orange-500 text-xs font-semibold text-white">
                        {driverName(d).charAt(0) || '?'}
                      </div>
                      <div>
                        <div className="text-sm font-medium text-gray-900">{driverName(d)}</div>
                        {driverEmail(d) && (
                          <div className="text-xs text-gray-400">{driverEmail(d)}</div>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={() => handleUnassign(d.driverId as string)}
                      disabled={unassignMut.isPending}
                      className="flex items-center gap-1 rounded-md border border-red-200 bg-white px-2.5 py-1 text-xs font-medium text-red-500 transition-colors hover:bg-red-50 disabled:opacity-50"
                    >
                      <UserMinus className="h-3.5 w-3.5" />
                      {t('poolDriver.unassign')}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Available pool drivers */}
          <div>
            <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">
              {t('poolDriver.available')} ({available.length})
            </div>
            {available.length === 0 ? (
              <div className="rounded-lg border border-dashed border-[#d4d8e0] px-4 py-4 text-center text-xs text-gray-400">
                {t('poolDriver.allAssigned')}
              </div>
            ) : (
              <div className="space-y-1.5">
                {available.map((d) => (
                  <div
                    key={d.driverId as string}
                    className="flex items-center justify-between rounded-lg border border-[#e2e5eb] bg-white px-3 py-2.5"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-200 text-xs font-semibold text-gray-600">
                        {driverName(d).charAt(0) || '?'}
                      </div>
                      <div>
                        <div className="text-sm font-medium text-gray-900">{driverName(d)}</div>
                        {driverEmail(d) && (
                          <div className="text-xs text-gray-400">{driverEmail(d)}</div>
                        )}
                        {d.vehicleId && (
                          <div className="text-[10px] text-gray-400">
                            {t('poolDriver.currentVehicle')}: {(d.vehiclePlateNumber as string) || '-'}
                          </div>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={() => handleAssign(d.driverId as string)}
                      disabled={assignMut.isPending}
                      className="flex items-center gap-1 rounded-md border border-green-200 bg-white px-2.5 py-1 text-xs font-medium text-green-600 transition-colors hover:bg-green-50 disabled:opacity-50"
                    >
                      <UserCheck className="h-3.5 w-3.5" />
                      {t('poolDriver.assign')}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </Modal>
  );
}
