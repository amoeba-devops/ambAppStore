import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { Car, Activity, ParkingCircle, Wrench } from 'lucide-react';

import { useDashboard, useActiveDispatches } from '@/hooks/useMonitor';
import { StatCard } from '@/components/common/StatCard';
import { PageHeader } from '@/components/common/PageHeader';
import { MonitorCard } from '@/components/monitor/MonitorCard';
import { Timeline } from '@/components/monitor/Timeline';

export function DashboardPage() {
  const { t } = useTranslation('car');
  const navigate = useNavigate();
  const { data: dashData, isLoading } = useDashboard();
  const { data: activeData } = useActiveDispatches();

  const summary = dashData?.data;
  const activeList: Record<string, unknown>[] = activeData?.data || [];

  // Build timeline entries from active dispatches
  const timelineEntries = activeList.map((d) => ({
    plateNumber: (d.vehiclePlateNumber as string) || '—',
    vehicleModel: (d.vehicleModel as string) || '',
    bars: [
      {
        startHour: new Date(d.departAt as string).getHours(),
        endHour: d.returnAt ? new Date(d.returnAt as string).getHours() : new Date(d.departAt as string).getHours() + 2,
        label: `→ ${d.destination as string}`,
        status: (['DEPARTED', 'ARRIVED'].includes(d.status as string) ? 'running' : 'scheduled') as 'running' | 'scheduled',
      },
    ],
  }));

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center text-gray-400">
        {t('common.loading')}
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title={t('monitor.title')}
        breadcrumb={['app-car-manager', 'monitor']}
        liveBadge
      />

      <div className="space-y-6 p-6">
        {/* Stat Cards */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            color="green"
            label={t('monitor.totalVehicles')}
            value={summary?.vehicles?.total || 0}
            sub={`${t('monitor.passenger')} ${summary?.vehicles?.passenger || 0} · ${t('monitor.van')} ${summary?.vehicles?.van || 0} · ${t('monitor.truck')} ${summary?.vehicles?.truck || 0}`}
            icon={Car}
          />
          <StatCard
            color="blue"
            label={t('monitor.currentRunning')}
            value={summary?.dispatches?.inProgress || 0}
            sub={activeList.length > 0 ? `${(activeList[0] as Record<string, unknown>).vehiclePlateNumber}` : '—'}
            icon={Activity}
          />
          <StatCard
            color="gray"
            label={t('monitor.standbyAvailable')}
            value={summary?.vehicles?.available || 0}
            icon={ParkingCircle}
          />
          <StatCard
            color="yellow"
            label={t('monitor.maintenanceUnavailable')}
            value={summary?.vehicles?.maintenance || 0}
            icon={Wrench}
          />
        </div>

        {/* Currently running */}
        {activeList.length > 0 && (
          <div>
            <h2 className="mb-3 text-[14px] font-semibold text-gray-900">
              🔵 {t('monitor.currentlyRunning')}
            </h2>
            <div className="space-y-3">
              {activeList.map((d) => (
                <MonitorCard
                  key={d.dispatchId as string}
                  plateNumber={(d.vehiclePlateNumber as string) || '—'}
                  vehicleModel={(d.vehicleModel as string) || ''}
                  vehicleType={(d.vehicleType as string) || ''}
                  driverName={(d.driverName as string) || '—'}
                  origin={(d.origin as string) || '—'}
                  destination={(d.destination as string) || '—'}
                  departAt={d.departAt as string}
                  returnAt={(d.returnAt as string) || (d.departAt as string)}
                  passengerCount={(d.passengerCount as number) || 0}
                  purpose={d.purpose as string}
                  requesterName={d.requesterName as string}
                />
              ))}
            </div>
          </div>
        )}

        {/* Two-column: completed + upcoming */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {/* Today completed placeholder */}
          <div>
            <h2 className="mb-3 text-[14px] font-semibold text-gray-900">
              ✅ {t('monitor.todayCompleted')}
            </h2>
            <div className="overflow-hidden rounded-[10px] border border-[#e2e5eb] bg-white">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[#e2e5eb] bg-[#f0f2f5]">
                    <th className="px-3.5 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide text-gray-400">{t('dispatch.vehicle')}</th>
                    <th className="px-3.5 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide text-gray-400">{t('dispatch.driver')}</th>
                    <th className="px-3.5 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide text-gray-400">{t('monitor.route')}</th>
                    <th className="px-3.5 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide text-gray-400">{t('monitor.time')}</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td colSpan={4} className="px-3.5 py-8 text-center text-[13px] text-gray-400">
                      {t('common.noData')}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Today scheduled */}
          <div>
            <h2 className="mb-3 text-[14px] font-semibold text-gray-900">
              📅 {t('monitor.todayScheduled')}
            </h2>
            <div className="overflow-hidden rounded-[10px] border border-[#e2e5eb] bg-white">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[#e2e5eb] bg-[#f0f2f5]">
                    <th className="px-3.5 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide text-gray-400">{t('dispatch.vehicle')}</th>
                    <th className="px-3.5 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide text-gray-400">{t('dispatch.requester')}</th>
                    <th className="px-3.5 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide text-gray-400">{t('monitor.time')}</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td colSpan={3} className="px-3.5 py-8 text-center text-[13px] text-gray-400">
                      {t('common.noData')}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Timeline */}
        {timelineEntries.length > 0 && (
          <div>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-[14px] font-semibold text-gray-900">
                📊 {t('monitor.todayTimeline')}
              </h2>
              <span className="text-[12px] text-gray-400">
                {new Date().toLocaleDateString()}
              </span>
            </div>
            <Timeline entries={timelineEntries} />
          </div>
        )}
      </div>
    </div>
  );
}
