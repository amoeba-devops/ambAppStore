import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronLeft, ChevronRight, Download, Upload, Search } from 'lucide-react';
import { TripLogImportModal } from '@/components/trip-log/TripLogImportModal';

import { useTripLogs } from '@/hooks/useTripLogs';
import { useVehicles } from '@/hooks/useVehicles';
import { PageHeader } from '@/components/common/PageHeader';
import { StatCard } from '@/components/common/StatCard';
import { LogDetailRow } from '@/components/triplog/LogDetailRow';

function formatMonth(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

export function TripLogListPage() {
  const { t } = useTranslation('car');
  const [currentMonth, setCurrentMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });

  const [showImport, setShowImport] = useState(false);
  const [vehicleFilter, setVehicleFilter] = useState('');
  const [routeSearch, setRouteSearch] = useState('');
  const { data, isLoading } = useTripLogs();
  const { data: vehiclesRes } = useVehicles();
  const tripLogs: Record<string, unknown>[] = data?.data || [];
  const vehicles: Record<string, unknown>[] = vehiclesRes?.data ?? [];

  // Filter by current month (departActual or createdAt)
  const filtered = useMemo(() => {
    const monthStr = formatMonth(currentMonth);
    let result = tripLogs.filter((tl) => {
      const d = (tl.departActual as string) || (tl.createdAt as string);
      return d && d.startsWith(monthStr);
    });
    if (vehicleFilter) {
      result = result.filter((tl) => tl.vehicleId === vehicleFilter);
    }
    if (routeSearch.trim()) {
      const q = routeSearch.trim().toLowerCase();
      result = result.filter((tl) => {
        const origin = ((tl.origin as string) || '').toLowerCase();
        const dest = ((tl.destination as string) || '').toLowerCase();
        return origin.includes(q) || dest.includes(q);
      });
    }
    return result;
  }, [tripLogs, currentMonth, vehicleFilter, routeSearch]);

  // Summary stats
  const summary = useMemo(() => {
    let totalDistance = 0;
    let totalFuel = 0;
    let totalTrips = filtered.length;
    for (const tl of filtered) {
      if (tl.distanceKm != null) totalDistance += tl.distanceKm as number;
      if (tl.fuelCost != null) totalFuel += tl.fuelCost as number;
    }
    return { totalTrips, totalDistance, totalFuel };
  }, [filtered]);

  const prevMonth = () => {
    setCurrentMonth((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1));
  };
  const nextMonth = () => {
    setCurrentMonth((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1));
  };

  const monthLabel = currentMonth.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
  });

  return (
    <div className="space-y-4">
      <PageHeader
        title={t('tripLog.title')}
        actions={
          <div className="flex gap-2">
            <button
              onClick={() => setShowImport(true)}
              className="flex items-center gap-1.5 rounded-lg bg-orange-500 px-3 py-2 text-sm font-medium text-white hover:bg-orange-400"
            >
              <Upload className="h-4 w-4" />
              {t('tripLogImport.upload')}
            </button>
            <button className="flex items-center gap-1.5 rounded-lg border border-[#d4d8e0] bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
              <Download className="h-4 w-4" />
              {t('tripLog.excelDownload')}
            </button>
          </div>
        }
      />

      {/* Month selector */}
      <div className="flex items-center justify-center gap-4">
        <button
          onClick={prevMonth}
          className="rounded-lg border border-[#d4d8e0] p-1.5 text-gray-500 hover:bg-gray-50"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <span className="min-w-[140px] text-center text-lg font-bold text-gray-900">
          {monthLabel}
        </span>
        <button
          onClick={nextMonth}
          className="rounded-lg border border-[#d4d8e0] p-1.5 text-gray-500 hover:bg-gray-50"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4">
        <StatCard
          label={t('tripLog.totalTrips')}
          value={summary.totalTrips}
          sub={t('tripLog.tripsUnit')}
          color="blue"
        />
        <StatCard
          label={t('tripLog.totalDistance')}
          value={Math.round(summary.totalDistance)}
          sub="km"
          color="green"
        />
        <StatCard
          label={t('tripLog.totalFuelCost')}
          value={`₩${summary.totalFuel.toLocaleString()}`}
          color="yellow"
        />
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 rounded-[10px] border border-[#e2e5eb] bg-white px-4 py-3">
        <div className="flex items-center gap-2">
          <label className="text-xs font-medium text-gray-500">{t('vehicle.plateNumber')}:</label>
          <select
            value={vehicleFilter}
            onChange={(e) => setVehicleFilter(e.target.value)}
            className="rounded-md border border-[#d4d8e0] bg-white px-2.5 py-1.5 text-sm text-gray-700"
          >
            <option value="">{t('common.all')}</option>
            {vehicles.map((v) => (
              <option key={v.cvhId as string} value={v.cvhId as string}>
                {v.plateNumber as string}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs font-medium text-gray-500">{t('tripLog.route')}:</label>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={routeSearch}
              onChange={(e) => setRouteSearch(e.target.value)}
              placeholder={t('common.search')}
              className="rounded-md border border-[#d4d8e0] bg-white py-1.5 pl-8 pr-3 text-sm text-gray-700"
            />
          </div>
        </div>
      </div>

      {/* Trip log table */}
      {isLoading ? (
        <div className="py-16 text-center text-gray-400">{t('common.loading')}</div>
      ) : filtered.length === 0 ? (
        <div className="py-16 text-center text-gray-400">{t('common.noData')}</div>
      ) : (
        <div className="overflow-hidden rounded-[10px] border border-[#e2e5eb] bg-white">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-[#e2e5eb] bg-[#f5f6f8] text-xs text-gray-500">
              <tr>
                <th className="px-4 py-3">{t('tripLog.date')}</th>
                <th className="px-4 py-3">{t('vehicle.plateNumber')}</th>
                <th className="px-4 py-3">{t('tripLog.route')}</th>
                <th className="px-4 py-3">{t('tripLog.distance')}</th>
                <th className="px-4 py-3">{t('common.status')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#e2e5eb]">
              {filtered.map((tl) => (
                <LogDetailRow key={tl.tripLogId as string} log={tl} />
              ))}
            </tbody>
          </table>
        </div>
      )}
      <TripLogImportModal open={showImport} onClose={() => setShowImport(false)} />
    </div>
  );
}
