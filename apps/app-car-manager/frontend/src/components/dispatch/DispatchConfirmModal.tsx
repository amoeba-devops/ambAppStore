import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Modal } from '@/components/common/Modal';
import { DriverSelector } from '@/components/dispatch/DriverSelector';
import { AvailableVehicleCard } from '@/components/dispatch/AvailableVehicleCard';
import { useVehicles } from '@/hooks/useVehicles';
import { useAvailableDrivers } from '@/hooks/useDrivers';
import { useApproveDispatch } from '@/hooks/useDispatches';

interface DispatchConfirmModalProps {
  dispatch: Record<string, unknown>;
  onClose: () => void;
}

export function DispatchConfirmModal({ dispatch, onClose }: DispatchConfirmModalProps) {
  const { t } = useTranslation('car');
  const { data: vehiclesData } = useVehicles({ status: 'AVAILABLE' });
  const { data: driversData } = useAvailableDrivers();
  const approveMut = useApproveDispatch();

  const [selectedVehicle, setSelectedVehicle] = useState<string | null>(null);
  const [selectedDriver, setSelectedDriver] = useState<string | null>(null);

  const vehicles: Record<string, unknown>[] = vehiclesData?.data || [];
  const drivers: Record<string, unknown>[] = driversData?.data || [];

  const handleConfirm = async () => {
    if (!selectedVehicle) return;
    await approveMut.mutateAsync({
      id: dispatch.dispatchId as string,
      data: {
        vehicle_id: selectedVehicle,
        ...(selectedDriver && { driver_id: selectedDriver }),
      },
    });
    onClose();
  };

  const departAt = dispatch.departAt as string;
  const returnAt = dispatch.returnAt as string;

  return (
    <Modal open onClose={onClose} title={t('dispatch.confirmDispatch')} size="lg">
      <div className="space-y-5">
        {/* Dispatch summary */}
        <div className="rounded-lg border border-[#e2e5eb] bg-[#f5f6f8] p-4">
          <div className="mb-2 text-sm font-semibold text-gray-900">{t('dispatch.dispatchSummary')}</div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-[12px]">
            <div className="text-gray-400">{t('dispatch.requester')}</div>
            <div className="font-medium text-gray-900">{dispatch.requesterName as string}</div>

            <div className="text-gray-400">{t('dispatch.purpose')}</div>
            <div className="text-gray-700">{dispatch.purpose as string}</div>

            <div className="text-gray-400">{t('dispatch.departAt')}</div>
            <div className="text-gray-700">{new Date(departAt).toLocaleString()}</div>

            <div className="text-gray-400">{t('dispatch.returnAt')}</div>
            <div className="text-gray-700">{new Date(returnAt).toLocaleString()}</div>

            <div className="text-gray-400">{t('dispatch.origin')} → {t('dispatch.destination')}</div>
            <div className="text-gray-700">{dispatch.origin as string} → {dispatch.destination as string}</div>

            <div className="text-gray-400">{t('dispatch.passengers')}</div>
            <div className="text-gray-700">{dispatch.passengerCount as number}{t('monitor.personsUnit')}</div>
          </div>
        </div>

        {/* Vehicle selection */}
        <div>
          <div className="mb-2 text-sm font-semibold text-gray-900">
            {t('dispatch.selectVehicle')} <span className="text-red-500">*</span>
          </div>
          <div className="max-h-48 space-y-1.5 overflow-y-auto">
            {vehicles.map((v) => (
              <AvailableVehicleCard
                key={v.cvhId as string}
                vehicle={v}
                selected={selectedVehicle === (v.cvhId as string)}
                onSelect={() => setSelectedVehicle(v.cvhId as string)}
              />
            ))}
            {vehicles.length === 0 && (
              <div className="py-4 text-center text-xs text-gray-400">{t('dispatch.noAvailableVehicles')}</div>
            )}
          </div>
        </div>

        {/* Driver selection */}
        <div>
          <div className="mb-2 text-sm font-semibold text-gray-900">
            {t('dispatch.selectDriver')}
            <span className="ml-1 text-[11px] font-normal text-gray-400">({t('common.optional')})</span>
          </div>
          <div className="max-h-48 overflow-y-auto">
            <DriverSelector
              drivers={drivers.map((d) => ({
                driverId: d.driverId as string,
                driverName: d.driverName as string,
                phone: d.phone as string | undefined,
                licenseType: d.licenseType as string | undefined,
                role: d.role as string | undefined,
                status: d.status as string | undefined,
              }))}
              selected={selectedDriver}
              onSelect={setSelectedDriver}
            />
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-2 border-t border-[#e2e5eb] pt-4">
          <button onClick={onClose} className="btn-secondary">
            {t('common.cancel')}
          </button>
          <button
            onClick={handleConfirm}
            disabled={!selectedVehicle || approveMut.isPending}
            className="flex items-center gap-1.5 rounded-lg bg-orange-500 px-5 py-2 text-sm font-medium text-white hover:bg-orange-400 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {approveMut.isPending ? t('common.loading') : t('dispatch.confirmDispatch')}
          </button>
        </div>
      </div>
    </Modal>
  );
}
