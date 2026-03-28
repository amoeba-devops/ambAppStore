import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Plus } from 'lucide-react';

import { useVehicle } from '@/hooks/useVehicles';
import { useDrivers } from '@/hooks/useDrivers';
import { useDispatches } from '@/hooks/useDispatches';
import { PageHeader } from '@/components/common/PageHeader';
import { TabBar } from '@/components/common/TabBar';
import { StatusBadge, getStatusVariant } from '@/components/common/StatusBadge';
import { DriverCard } from '@/components/driver/DriverCard';

export function VehicleDetailPage() {
  const { t } = useTranslation('car');
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('info');

  const { data, isLoading } = useVehicle(id!);
  const { data: driversData } = useDrivers({ vehicle_id: id });
  const { data: dispatchData } = useDispatches({ vehicle_id: id });

  const vehicle = data?.data;
  const drivers: Record<string, unknown>[] = driversData?.data || [];
  const dispatches: Record<string, unknown>[] = dispatchData?.data || [];

  if (isLoading) {
    return <div className="flex h-64 items-center justify-center text-gray-400">{t('common.loading')}</div>;
  }
  if (!vehicle) {
    return <div className="flex h-64 items-center justify-center text-gray-400">{t('common.noData')}</div>;
  }

  // Group drivers by role
  const primaryDrivers = drivers.filter((d) => d.role === 'PRIMARY_DRIVER');
  const subDrivers = drivers.filter((d) => d.role === 'SUB_DRIVER');
  const poolDrivers = drivers.filter((d) => d.role === 'POOL_DRIVER');

  const tabs = [
    { key: 'info', label: t('detail.tabInfo') },
    { key: 'drivers', label: t('detail.tabDrivers'), count: drivers.length },
    { key: 'dispatch', label: t('detail.tabDispatchHistory'), count: dispatches.length },
    { key: 'maintenance', label: t('detail.tabMaintenance') },
  ];

  return (
    <div>
      <PageHeader
        title={`${vehicle.plateNumber}`}
        breadcrumb={['app-car-manager', 'vehicles', vehicle.plateNumber]}
        actions={
          <div className="flex gap-2">
            <button
              onClick={() => navigate(`/vehicles/${id}/edit`)}
              className="rounded-md border border-[#d4d8e0] bg-[#f0f2f5] px-3 py-1.5 text-[13px] font-medium text-gray-600 transition-colors hover:text-gray-900"
            >
              {t('common.edit')}
            </button>
            <button
              onClick={() => navigate('/dispatches/new')}
              className="flex items-center gap-1.5 rounded-md bg-orange-500 px-3 py-1.5 text-[13px] font-medium text-white transition-colors hover:bg-orange-400"
            >
              <Plus className="h-3.5 w-3.5" />
              {t('dispatch.createDispatch')}
            </button>
          </div>
        }
      />

      <div className="p-6">
        <TabBar tabs={tabs} activeTab={activeTab} onChange={setActiveTab} />

        {/* Info Tab */}
        {activeTab === 'info' && (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {/* Vehicle info */}
            <div className="rounded-[10px] border border-[#e2e5eb] bg-white p-5">
              <div className="mb-4 border-b border-[#e2e5eb] pb-2.5 text-[12px] font-semibold uppercase tracking-wide text-gray-400">
                {t('detail.vehicleInfo')}
              </div>
              <div className="grid grid-cols-2 gap-3.5">
                <InfoField label={t('vehicle.plateNumber')} value={vehicle.plateNumber} mono large />
                <InfoField label={t('vehicle.type')} value={vehicle.type} />
                <InfoField label={`${t('vehicle.make')} / ${t('vehicle.model')}`} value={`${vehicle.make} ${vehicle.model} ${vehicle.year}`} />
                <InfoField label={t('vehicle.color')} value={vehicle.color} />
                <InfoField label={t('vehicle.fuelType')} value={vehicle.fuelType} />
                <InfoField label={t('detail.maxPassengers')} value={`${vehicle.maxPassengers}${t('monitor.personsUnit')}`} />
                <InfoField label={t('detail.purchaseType')} value={vehicle.purchaseType} />
                <InfoField label="VIN" value={vehicle.vin} mono small />
              </div>
            </div>

            {/* Inspection / Insurance */}
            <div className="rounded-[10px] border border-[#e2e5eb] bg-white p-5">
              <div className="mb-4 border-b border-[#e2e5eb] pb-2.5 text-[12px] font-semibold uppercase tracking-wide text-gray-400">
                {t('detail.inspectionInsurance')}
              </div>
              <div className="flex flex-col gap-2.5">
                <InfoBlock
                  label={t('detail.insuranceExpiry')}
                  value={vehicle.insuranceExpiry || '—'}
                  color="green"
                />
                <InfoBlock
                  label={t('detail.inspectionDate')}
                  value={vehicle.inspectionDate || '—'}
                  color="default"
                />
                <InfoBlock
                  label={t('detail.currentMileage')}
                  value={vehicle.currentMileage ? `${Number(vehicle.currentMileage).toLocaleString()} km` : '—'}
                  color="default"
                  large
                />
              </div>
            </div>
          </div>
        )}

        {/* Drivers Tab */}
        {activeTab === 'drivers' && (
          <div>
            <div className="mb-3.5 flex justify-end gap-2">
              <button className="rounded-md border border-[#d4d8e0] bg-[#f0f2f5] px-3 py-1.5 text-[12px] font-medium text-gray-600 transition-colors hover:text-gray-900">
                🌐 {t('detail.poolDriverManage')}
              </button>
              <button className="flex items-center gap-1.5 rounded-md bg-orange-500 px-3 py-1.5 text-[12px] font-medium text-white transition-colors hover:bg-orange-400">
                <Plus className="h-3.5 w-3.5" />
                {t('detail.addDriver')}
              </button>
            </div>

            <div className="space-y-2">
              {primaryDrivers.length > 0 && (
                <>
                  <DriverGroupTitle title={`★ ${t('detail.primaryDriver')} (PRIMARY_DRIVER)`} />
                  {primaryDrivers.map((d) => (
                    <DriverCard key={d.driverId as string} driver={d} isPrimary />
                  ))}
                </>
              )}
              {subDrivers.length > 0 && (
                <>
                  <DriverGroupTitle title={`${t('detail.subDriver')} (SUB_DRIVER)`} />
                  {subDrivers.map((d) => (
                    <DriverCard key={d.driverId as string} driver={d} />
                  ))}
                </>
              )}
              {poolDrivers.length > 0 && (
                <>
                  <DriverGroupTitle title={`${t('detail.poolDriver')} (POOL_DRIVER)`} />
                  {poolDrivers.map((d) => (
                    <DriverCard key={d.driverId as string} driver={d} />
                  ))}
                </>
              )}
              {drivers.length === 0 && (
                <div className="py-10 text-center text-gray-400">{t('common.noData')}</div>
              )}
            </div>

            <div className="mt-4 rounded-md border border-orange-500/25 bg-orange-500/[0.08] px-3.5 py-2.5 text-[12px] text-gray-600">
              ℹ️ {t('detail.poolDriverInfo')}
            </div>
          </div>
        )}

        {/* Dispatch History Tab */}
        {activeTab === 'dispatch' && (
          <div className="overflow-hidden rounded-[10px] border border-[#e2e5eb] bg-white">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[#e2e5eb] bg-[#f0f2f5]">
                  <th className="px-3.5 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide text-gray-400">{t('detail.dispatchNo')}</th>
                  <th className="px-3.5 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide text-gray-400">{t('detail.date')}</th>
                  <th className="px-3.5 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide text-gray-400">{t('dispatch.requester')}</th>
                  <th className="px-3.5 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide text-gray-400">{t('monitor.route')}</th>
                  <th className="px-3.5 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide text-gray-400">{t('dispatch.driver')}</th>
                  <th className="px-3.5 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide text-gray-400">{t('common.status')}</th>
                </tr>
              </thead>
              <tbody>
                {dispatches.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-3.5 py-8 text-center text-[13px] text-gray-400">
                      {t('common.noData')}
                    </td>
                  </tr>
                ) : (
                  dispatches.map((d) => (
                    <tr
                      key={d.dispatchId as string}
                      className="cursor-pointer border-b border-[#e2e5eb] hover:bg-[#eef0f4]"
                      onClick={() => navigate(`/dispatches/${d.dispatchId}`)}
                    >
                      <td className="px-3.5 py-3 font-mono text-[12px] text-gray-400">
                        #{(d.dispatchId as string).slice(0, 8)}
                      </td>
                      <td className="px-3.5 py-3 text-[13px]">
                        {new Date(d.departAt as string).toLocaleDateString()}
                      </td>
                      <td className="px-3.5 py-3 text-[13px]">{d.requesterName as string}</td>
                      <td className="px-3.5 py-3 text-[12px] text-gray-600">
                        {d.origin as string} → {d.destination as string}
                      </td>
                      <td className="px-3.5 py-3 text-[13px]">{(d.driverName as string) || '—'}</td>
                      <td className="px-3.5 py-3">
                        <StatusBadge variant={getStatusVariant(d.status as string)} label={d.status as string} />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Maintenance Tab */}
        {activeTab === 'maintenance' && (
          <div>
            <div className="mb-3.5 flex justify-end">
              <button className="flex items-center gap-1.5 rounded-md bg-orange-500 px-3 py-1.5 text-[12px] font-medium text-white transition-colors hover:bg-orange-400">
                <Plus className="h-3.5 w-3.5" />
                {t('maintenance.addRecord')}
              </button>
            </div>
            <div className="overflow-hidden rounded-[10px] border border-[#e2e5eb] bg-white">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[#e2e5eb] bg-[#f0f2f5]">
                    <th className="px-3.5 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide text-gray-400">{t('maintenance.type')}</th>
                    <th className="px-3.5 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide text-gray-400">{t('maintenance.description')}</th>
                    <th className="px-3.5 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide text-gray-400">{t('maintenance.shopName')}</th>
                    <th className="px-3.5 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide text-gray-400">{t('maintenance.cost')}</th>
                    <th className="px-3.5 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide text-gray-400">{t('maintenance.date')}</th>
                    <th className="px-3.5 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide text-gray-400">{t('maintenance.nextDate')}</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td colSpan={6} className="px-3.5 py-8 text-center text-[13px] text-gray-400">
                      {t('common.noData')}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function InfoField({
  label,
  value,
  mono,
  large,
  small,
}: {
  label: string;
  value: unknown;
  mono?: boolean;
  large?: boolean;
  small?: boolean;
}) {
  return (
    <div>
      <div className="text-[12px] font-medium text-gray-500">{label}</div>
      <div
        className={`mt-1 ${mono ? 'font-mono' : ''} ${large ? 'text-[18px] font-semibold' : small ? 'text-[11px]' : 'text-[13px]'} text-gray-${value ? '600' : '400'}`}
      >
        {value != null ? String(value) : '—'}
      </div>
    </div>
  );
}

function InfoBlock({
  label,
  value,
  color,
  large,
}: {
  label: string;
  value: string;
  color: 'green' | 'default';
  large?: boolean;
}) {
  return (
    <div className="rounded-md border border-[#d4d8e0] bg-[#f0f2f5] px-3 py-2.5">
      <div className="mb-1 text-[11px] text-gray-400">{label}</div>
      <div
        className={`font-mono font-semibold ${large ? 'text-[22px]' : 'text-[16px]'} ${color === 'green' ? 'text-green-600' : 'text-gray-600'}`}
      >
        {value}
      </div>
    </div>
  );
}

function DriverGroupTitle({ title }: { title: string }) {
  return (
    <div className="mt-2 border-b border-[#e2e5eb] pb-1 text-[10px] font-semibold uppercase tracking-wider text-gray-400">
      {title}
    </div>
  );
}
