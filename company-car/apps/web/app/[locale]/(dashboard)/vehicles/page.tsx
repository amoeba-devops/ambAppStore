'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { apiFetch } from '@/lib/client/api';
import type { Vehicle, VehicleStatus, User } from '@repo/api-types';
import { Plus, Edit2 } from 'lucide-react';

type Row = Vehicle & {
  assignedDriver: { id: string; fullName: string; licenseNumber: string } | null;
};

const STATUS_STYLE: Record<VehicleStatus, string> = {
  ACTIVE: 'bg-green-50 text-green-700 border-green-200',
  MAINTENANCE: 'bg-amber-50 text-amber-700 border-amber-200',
  INACTIVE: 'bg-gray-100 text-gray-600 border-gray-200',
};

export default function VehicleListPage() {
  const t = useTranslations();
  const [items, setItems] = useState<Row[]>([]);
  const [me, setMe] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      apiFetch<Row[]>('/api/vehicles'),
      apiFetch<User>('/api/auth/me'),
    ])
      .then(([v, u]) => {
        setItems(v);
        setMe(u);
      })
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, []);

  const isAdmin = me?.role === 'ADMIN';

  return (
    <div className="mx-auto max-w-6xl">
      <header className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">{t('nav.vehicles')}</h1>
        {isAdmin && (
          <Link
            href="/vehicles/new"
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
          >
            <Plus className="h-4 w-4" />
            {t('common.create')}
          </Link>
        )}
      </header>

      <div className="overflow-hidden rounded-2xl border border-border bg-background">
        {loading ? (
          <div className="p-10 text-center text-sm text-muted-foreground">{t('common.loading')}</div>
        ) : items.length === 0 ? (
          <div className="p-10 text-center text-sm text-muted-foreground">No vehicles yet.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-muted/40 text-left">
              <tr>
                <th className="px-4 py-3 font-medium">License</th>
                <th className="px-4 py-3 font-medium">Type</th>
                <th className="px-4 py-3 font-medium">Year</th>
                <th className="px-4 py-3 font-medium">Driver</th>
                <th className="px-4 py-3 font-medium">Odometer</th>
                <th className="px-4 py-3 font-medium">Status</th>
                {isAdmin && <th className="px-4 py-3 font-medium" />}
              </tr>
            </thead>
            <tbody>
              {items.map((v) => (
                <tr key={v.id} className="border-b border-border last:border-0 hover:bg-muted/30">
                  <td className="px-4 py-3 font-mono">
                    <Link href={`/vehicles/${v.id}` as never} className="text-primary hover:underline">
                      {v.licensePlate}
                    </Link>
                  </td>
                  <td className="px-4 py-3">{v.vehicleType}</td>
                  <td className="px-4 py-3">{v.manufactureYear ?? '—'}</td>
                  <td className="px-4 py-3">{v.assignedDriver?.fullName ?? '—'}</td>
                  <td className="px-4 py-3 tabular-nums">{v.currentKm.toLocaleString()} km</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-medium ${STATUS_STYLE[v.status]}`}>
                      {v.status}
                    </span>
                  </td>
                  {isAdmin && (
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/vehicles/${v.id}/edit` as never}
                        className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                      >
                        <Edit2 className="h-3 w-3" /> {t('common.edit')}
                      </Link>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
