import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus } from 'lucide-react';

import { useDrivers } from '@/hooks/useDrivers';
import { PageHeader } from '@/components/common/PageHeader';
import { FilterBar, type FilterItem } from '@/components/common/FilterBar';
import { DriverFormModal } from '@/components/driver/DriverFormModal';

const STATUS_COLORS: Record<string, string> = {
  ACTIVE: 'bg-green-100 text-green-700',
  ON_LEAVE: 'bg-yellow-100 text-yellow-700',
  INACTIVE: 'bg-gray-100 text-gray-500',
};

export function DriverListPage() {
  const { t } = useTranslation('car');
  const [statusFilter, setStatusFilter] = useState('');
  const [showDriverForm, setShowDriverForm] = useState(false);
  const { data, isLoading } = useDrivers(statusFilter ? { status: statusFilter } : undefined);

  const drivers = data?.data || [];

  const statusFilters: FilterItem[] = [
    { key: '', label: t('common.all') },
    { key: 'ACTIVE', label: t('driver.statusActive') },
    { key: 'ON_LEAVE', label: t('driver.statusOnLeave') },
    { key: 'INACTIVE', label: t('driver.statusInactive') },
  ];

  return (
    <div>
      <PageHeader
        title={t('driver.title')}
        breadcrumb={['app-car-manager', t('nav.driverList')]}
        actions={
          <button
            onClick={() => setShowDriverForm(true)}
            className="flex items-center gap-1.5 rounded-md bg-orange-500 px-3 py-1.5 text-[13px] font-medium text-white transition-colors hover:bg-orange-400"
          >
            <Plus className="h-3.5 w-3.5" />
            {t('driver.addDriver')}
          </button>
        }
      />

      <div className="p-6">
        <div className="mb-4">
          <FilterBar
            label={`${t('common.status')}:`}
            items={statusFilters}
            selected={statusFilter}
            onChange={setStatusFilter}
          />
        </div>

        {isLoading ? (
          <div className="flex h-40 items-center justify-center text-gray-400">
            {t('common.loading')}
          </div>
        ) : drivers.length === 0 ? (
          <div className="flex h-40 items-center justify-center text-gray-400">
            {t('common.noData')}
          </div>
        ) : (
          <div className="overflow-hidden rounded-[10px] border border-[#e2e5eb] bg-white">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[#e2e5eb] bg-[#f0f2f5]">
                  <th className="px-3.5 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide text-gray-400">{t('driver.name')}</th>
                  <th className="px-3.5 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide text-gray-400">{t('driver.role')}</th>
                  <th className="px-3.5 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide text-gray-400">{t('driver.assignedVehicle')}</th>
                  <th className="px-3.5 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide text-gray-400">{t('driver.status')}</th>
                </tr>
              </thead>
              <tbody>
                {drivers.map((d: Record<string, unknown>) => (
                  <tr key={d.driverId as string} className="border-b border-[#e2e5eb] hover:bg-[#eef0f4]">
                    <td className="px-3.5 py-3 text-[13px] font-medium text-gray-900">
                      <div>{(d.driverName as string) || (d.amaUserId as string)}</div>
                      {Boolean(d.driverEmail) && (
                        <div className="text-[11px] text-gray-400">{String(d.driverEmail)}</div>
                      )}
                    </td>
                    <td className="px-3.5 py-3 text-[13px] text-gray-600">{d.role as string}</td>
                    <td className="px-3.5 py-3 text-[13px] text-gray-600">
                      {(d.vehiclePlateNumber as string) || '—'}
                    </td>
                    <td className="px-3.5 py-3">
                      <span className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-medium ${STATUS_COLORS[d.status as string] || 'bg-gray-100'}`}>
                        {d.status as string}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <DriverFormModal
        open={showDriverForm}
        onClose={() => setShowDriverForm(false)}
      />
    </div>
  );
}
