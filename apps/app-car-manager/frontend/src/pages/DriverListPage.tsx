import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, Plus, Pencil, Trash2 } from 'lucide-react';

import { useDrivers, useDeleteDriver } from '@/hooks/useDrivers';
import { useToastStore } from '@/stores/toast.store';
import { PageHeader } from '@/components/common/PageHeader';
import { FilterBar, type FilterItem } from '@/components/common/FilterBar';
import { DriverFormModal, type DriverFormInitial } from '@/components/driver/DriverFormModal';

const STATUS_COLORS: Record<string, string> = {
  ACTIVE: 'bg-green-100 text-green-700',
  ON_LEAVE: 'bg-yellow-100 text-yellow-700',
  INACTIVE: 'bg-gray-100 text-gray-500',
};

export function DriverListPage() {
  const { t } = useTranslation('car');
  const [statusFilter, setStatusFilter] = useState('');
  const [showDriverForm, setShowDriverForm] = useState(false);
  const [editingDriver, setEditingDriver] = useState<DriverFormInitial | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);
  const [confirmText, setConfirmText] = useState('');
  const { data, isLoading } = useDrivers(statusFilter ? { status: statusFilter } : undefined);
  const deleteMut = useDeleteDriver();
  const showToast = useToastStore((s) => s.showToast);

  const drivers = data?.data || [];

  const statusFilters: FilterItem[] = [
    { key: '', label: t('common.all') },
    { key: 'ACTIVE', label: t('driver.statusActive') },
    { key: 'ON_LEAVE', label: t('driver.statusOnLeave') },
    { key: 'INACTIVE', label: t('driver.statusInactive') },
  ];

  const handleEdit = (d: Record<string, unknown>) => {
    setEditingDriver({
      driverId: d.driverId as string,
      amaUserId: d.amaUserId as string,
      driverName: (d.driverName as string) ?? null,
      driverEmail: (d.driverEmail as string) ?? null,
      role: d.role as string,
      note: (d.note as string) ?? null,
    });
  };

  const openDeleteConfirm = (d: Record<string, unknown>) => {
    const name = (d.driverName as string) || (d.amaUserId as string);
    setDeleteTarget({ id: d.driverId as string, name });
    setConfirmText('');
  };

  const closeDeleteConfirm = () => {
    setDeleteTarget(null);
    setConfirmText('');
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    try {
      await deleteMut.mutateAsync(deleteTarget.id);
      showToast(t('driver.deleted'), 'success');
      closeDeleteConfirm();
    } catch (err) {
      showToast(`${t('driver.deleteFailed')}: ${(err as Error).message}`, 'error');
    }
  };

  const handleCloseForm = () => {
    setShowDriverForm(false);
    setEditingDriver(null);
  };

  const deleteConfirmValid = deleteTarget !== null && confirmText.trim() === deleteTarget.name;

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
                  <th className="px-3.5 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wide text-gray-400">{t('common.actions')}</th>
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
                    <td className="px-3.5 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => handleEdit(d)}
                          title={t('common.edit')}
                          aria-label={t('common.edit')}
                          className="rounded p-1.5 text-gray-500 transition-colors hover:bg-orange-50 hover:text-orange-600"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => openDeleteConfirm(d)}
                          disabled={deleteMut.isPending}
                          title={t('common.delete')}
                          aria-label={t('common.delete')}
                          className="rounded p-1.5 text-gray-500 transition-colors hover:bg-red-50 hover:text-red-600 disabled:opacity-40"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <DriverFormModal
        open={showDriverForm || !!editingDriver}
        onClose={handleCloseForm}
        driver={editingDriver ?? undefined}
      />

      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
            <h3 className="mb-2 flex items-center gap-2 text-lg font-semibold text-gray-900">
              <AlertTriangle className="h-5 w-5 text-red-500" />
              {t('driver.deleteTitle')}
            </h3>
            <p className="mb-3 text-sm text-gray-600">{t('driver.deleteWarning')}</p>
            <p className="mb-1 text-xs text-gray-500">
              {t('driver.deleteTypeNameToConfirm')}
              <span className="ml-1 rounded bg-red-50 px-1.5 py-0.5 font-mono text-red-700">
                {deleteTarget.name}
              </span>
            </p>
            <input
              type="text"
              autoFocus
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder={deleteTarget.name}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-red-400 focus:outline-none"
            />
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={closeDeleteConfirm}
                disabled={deleteMut.isPending}
                className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                {t('common.cancel')}
              </button>
              <button
                type="button"
                onClick={handleDeleteConfirm}
                disabled={!deleteConfirmValid || deleteMut.isPending}
                className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-500 disabled:opacity-50"
              >
                {t('common.delete')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
