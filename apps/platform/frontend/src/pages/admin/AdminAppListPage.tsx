import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { clsx } from 'clsx';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { useAdminApps, useDeleteApp, type AdminApp } from '@/hooks/admin/useAdminApps';
import { AppFormModal } from '@/components/admin/AppFormModal';

const STATUS_COLORS: Record<string, string> = {
  ACTIVE: 'bg-green-100 text-green-700',
  INACTIVE: 'bg-gray-200 text-gray-600',
  COMING_SOON: 'bg-amber-100 text-amber-700',
};

export function AdminAppListPage() {
  const { t } = useTranslation('admin');
  const { data: apps, isLoading } = useAdminApps();
  const deleteMutation = useDeleteApp();
  const [editTarget, setEditTarget] = useState<AdminApp | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  const handleDelete = (app: AdminApp) => {
    if (confirm(t('app.confirmDelete'))) {
      deleteMutation.mutate(app.appId);
    }
  };

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t('app.title')}</h1>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-1 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
        >
          <Plus size={16} />
          {t('app.addNew')}
        </button>
      </div>

      <div className="overflow-x-auto rounded-lg border bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b bg-gray-50 text-xs font-medium uppercase text-gray-500">
            <tr>
              <th className="px-4 py-3">{t('app.colName')}</th>
              <th className="px-4 py-3">{t('app.colSlug')}</th>
              <th className="px-4 py-3">{t('app.colStatus')}</th>
              <th className="px-4 py-3">{t('app.colSort')}</th>
              <th className="px-4 py-3">{t('app.colPorts')}</th>
              <th className="px-4 py-3">{t('app.colActions')}</th>
            </tr>
          </thead>
          <tbody>
            {isLoading || !apps?.length ? (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400">{t('app.noData')}</td></tr>
            ) : (
              apps.map((app) => (
                <tr key={app.appId} className="border-b hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium">{app.name}</td>
                  <td className="px-4 py-3 font-mono text-xs text-gray-500">{app.slug}</td>
                  <td className="px-4 py-3">
                    <span className={clsx('rounded-full px-2 py-0.5 text-xs font-medium', STATUS_COLORS[app.status])}>
                      {app.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">{app.sortOrder}</td>
                  <td className="px-4 py-3 text-xs text-gray-500">
                    {app.portFe && `FE:${app.portFe}`} {app.portBe && `BE:${app.portBe}`}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1">
                      <button
                        onClick={() => setEditTarget(app)}
                        className="rounded p-1 text-gray-500 hover:bg-gray-100 hover:text-indigo-600"
                      >
                        <Pencil size={16} />
                      </button>
                      <button
                        onClick={() => handleDelete(app)}
                        className="rounded p-1 text-gray-500 hover:bg-gray-100 hover:text-red-600"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {(showCreate || editTarget) && (
        <AppFormModal
          app={editTarget}
          onClose={() => { setShowCreate(false); setEditTarget(null); }}
        />
      )}
    </div>
  );
}
