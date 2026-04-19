import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { Plus, Search } from 'lucide-react';

import { useVehicles } from '@/hooks/useVehicles';
import { PageHeader } from '@/components/common/PageHeader';
import { FilterBar, type FilterItem } from '@/components/common/FilterBar';
import { VehicleCard } from '@/components/vehicle/VehicleCard';
import { AlertSection } from '@/components/vehicle/AlertSection';

export function VehicleListPage() {
  const { t } = useTranslation('car');
  const navigate = useNavigate();
  const [typeFilter, setTypeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const { data, isLoading } = useVehicles(
    Object.fromEntries(
      Object.entries({ type: typeFilter, status: statusFilter }).filter(([, v]) => v),
    ) as { type?: string; status?: string } | undefined,
  );

  const vehicles: Record<string, unknown>[] = data?.data || [];

  const typeFilters: FilterItem[] = [
    { key: '', label: t('common.all') },
    { key: 'PASSENGER', label: `🚗 ${t('vehicle.typePassenger')}` },
    { key: 'VAN', label: `🚐 ${t('vehicle.typeVan')}` },
    { key: 'TRUCK', label: `🚛 ${t('vehicle.typeTruck')}` },
  ];

  const statusFilters: FilterItem[] = [
    { key: '', label: t('common.all') },
    { key: 'AVAILABLE', label: `● ${t('vehicle.statusAvailable')}` },
    { key: 'IN_USE', label: `🔵 ${t('vehicle.statusInUse')}` },
    { key: 'MAINTENANCE', label: `🔧 ${t('vehicle.statusMaintenance')}` },
  ];

  // Generate alerts from vehicle data
  const alerts = useMemo(() => {
    const items: { id: string; type: 'warning' | 'danger'; plateNumber: string; label: string; highlight?: string; actionLabel?: string }[] = [];
    vehicles.forEach((v) => {
      if (v.insuranceExpiry) {
        const daysLeft = Math.ceil(
          (new Date(v.insuranceExpiry as string).getTime() - Date.now()) / 86400000,
        );
        if (daysLeft > 0 && daysLeft <= 30) {
          items.push({
            id: `ins-${v.cvhId}`,
            type: daysLeft <= 7 ? 'danger' : 'warning',
            plateNumber: v.plateNumber as string,
            label: t('vehicle.insuranceExpiry'),
            highlight: `D-${daysLeft}`,
            actionLabel: t('vehicle.renewInsurance'),
          });
        }
      }
    });
    return items;
  }, [vehicles, t]);

  return (
    <div>
      <PageHeader
        title={t('vehicle.title')}
        breadcrumb={['app-car-manager', 'vehicles']}
        actions={
          <div className="flex items-center gap-2">
            <button className="flex items-center gap-1.5 rounded-md border border-[#d4d8e0] bg-[#f0f2f5] px-3 py-1.5 text-[13px] font-medium text-gray-600 transition-colors hover:text-gray-900">
              <Search className="h-3.5 w-3.5" />
              {t('common.search')}
            </button>
            <button
              onClick={() => navigate('/vehicles/new')}
              className="flex items-center gap-1.5 rounded-md bg-orange-500 px-3 py-1.5 text-[13px] font-medium text-white transition-colors hover:bg-orange-400"
            >
              <Plus className="h-3.5 w-3.5" />
              {t('vehicle.addVehicle')}
            </button>
          </div>
        }
      />

      <div className="p-6">
        {/* Filters */}
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <FilterBar
            label={`${t('vehicle.type')}:`}
            items={typeFilters}
            selected={typeFilter}
            onChange={setTypeFilter}
          />
          <div className="mx-1 h-4 w-px bg-[#e2e5eb]" />
          <FilterBar
            label={`${t('common.status')}:`}
            items={statusFilters}
            selected={statusFilter}
            onChange={setStatusFilter}
          />
        </div>

        {/* Grid */}
        {isLoading ? (
          <div className="flex h-40 items-center justify-center text-gray-400">
            {t('common.loading')}
          </div>
        ) : vehicles.length === 0 ? (
          <div className="flex h-40 items-center justify-center text-gray-400">
            {t('common.noData')}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3.5 md:grid-cols-2 lg:grid-cols-3">
            {vehicles.map((v) => (
              <VehicleCard
                key={v.cvhId as string}
                vehicle={v}
                onClick={() => navigate(`/vehicles/${v.cvhId}`)}
              />
            ))}
          </div>
        )}

        {/* Alert Section */}
        <AlertSection alerts={alerts} />
      </div>
    </div>
  );
}
