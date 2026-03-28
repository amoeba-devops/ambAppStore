import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { maintenanceApi } from '@/services/api';

export function MaintenanceListPage() {
  const { t } = useTranslation('car');
  const { data, isLoading } = useQuery({
    queryKey: ['maintenance'],
    queryFn: () => maintenanceApi.getAll(),
  });

  const records = data?.data || [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">{t('maintenance.title')}</h1>
        <button className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
          <Plus className="h-4 w-4" />
          {t('maintenance.addRecord')}
        </button>
      </div>

      {isLoading ? (
        <div className="py-10 text-center text-gray-500">{t('common.loading')}</div>
      ) : records.length === 0 ? (
        <div className="py-10 text-center text-gray-400">{t('common.noData')}</div>
      ) : (
        <div className="overflow-hidden rounded-xl border bg-white shadow-sm">
          <table className="w-full text-left text-sm">
            <thead className="border-b bg-gray-50 text-gray-500">
              <tr>
                <th className="px-4 py-3">{t('vehicle.plateNumber')}</th>
                <th className="px-4 py-3">{t('maintenance.type')}</th>
                <th className="px-4 py-3">{t('maintenance.shopName')}</th>
                <th className="px-4 py-3">{t('maintenance.cost')}</th>
                <th className="px-4 py-3">{t('maintenance.date')}</th>
                <th className="px-4 py-3">{t('maintenance.nextDate')}</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {records.map((r: Record<string, unknown>) => (
                <tr key={r.maintenanceId as string} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium">{(r.vehiclePlateNumber as string) || '-'}</td>
                  <td className="px-4 py-3">{r.type as string}</td>
                  <td className="px-4 py-3">{(r.shopName as string) || '-'}</td>
                  <td className="px-4 py-3">{r.cost != null ? `₩${(r.cost as number).toLocaleString()}` : '-'}</td>
                  <td className="px-4 py-3">{r.date as string}</td>
                  <td className="px-4 py-3">{(r.nextDate as string) || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
