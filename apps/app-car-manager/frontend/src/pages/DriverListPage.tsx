import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useDrivers } from '@/hooks/useDrivers';
import { Plus } from 'lucide-react';

const STATUS_COLORS: Record<string, string> = {
  ACTIVE: 'bg-green-100 text-green-700',
  ON_LEAVE: 'bg-yellow-100 text-yellow-700',
  INACTIVE: 'bg-gray-100 text-gray-500',
};

export function DriverListPage() {
  const { t } = useTranslation('car');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const { data, isLoading } = useDrivers(statusFilter ? { status: statusFilter } : undefined);

  const drivers = data?.data || [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">{t('driver.title')}</h1>
        <button className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
          <Plus className="h-4 w-4" />
          {t('driver.addDriver')}
        </button>
      </div>

      <div className="flex gap-2">
        {['', 'ACTIVE', 'ON_LEAVE', 'INACTIVE'].map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`rounded-full px-3 py-1 text-sm font-medium transition-colors ${
              statusFilter === s ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {s ? t(`driver.status${s.charAt(0) + s.slice(1).toLowerCase().replace(/_./g, (m) => m[1].toUpperCase())}`) : t('common.all')}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="py-10 text-center text-gray-500">{t('common.loading')}</div>
      ) : drivers.length === 0 ? (
        <div className="py-10 text-center text-gray-400">{t('common.noData')}</div>
      ) : (
        <div className="overflow-hidden rounded-xl border bg-white shadow-sm">
          <table className="w-full text-left text-sm">
            <thead className="border-b bg-gray-50 text-gray-500">
              <tr>
                <th className="px-4 py-3">{t('driver.name')}</th>
                <th className="px-4 py-3">{t('driver.role')}</th>
                <th className="px-4 py-3">{t('driver.assignedVehicle')}</th>
                <th className="px-4 py-3">{t('driver.status')}</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {drivers.map((d: Record<string, unknown>) => (
                <tr key={d.driverId as string} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium">{d.amaUserId as string}</td>
                  <td className="px-4 py-3">{d.role as string}</td>
                  <td className="px-4 py-3">{(d.vehiclePlateNumber as string) || '-'}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[d.status as string] || 'bg-gray-100'}`}>
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
  );
}
