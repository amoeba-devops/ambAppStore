'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { apiFetch } from '@/lib/client/api';
import type { Driver, User } from '@repo/api-types';
import { Plus, Edit2, AlertTriangle } from 'lucide-react';

function daysUntil(dateStr: string): number {
  const diff = new Date(dateStr).getTime() - Date.now();
  return Math.ceil(diff / (24 * 60 * 60 * 1000));
}

export default function DriverListPage() {
  const t = useTranslations();
  const [items, setItems] = useState<Driver[]>([]);
  const [me, setMe] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([apiFetch<Driver[]>('/api/drivers'), apiFetch<User>('/api/auth/me')])
      .then(([d, u]) => {
        setItems(d);
        setMe(u);
      })
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, []);

  const isAdmin = me?.role === 'ADMIN';

  return (
    <div className="mx-auto max-w-6xl">
      <header className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">{t('nav.drivers')}</h1>
        {isAdmin && (
          <Link
            href="/drivers/new"
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
          <div className="p-10 text-center text-sm text-muted-foreground">No drivers yet.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-muted/40 text-left">
              <tr>
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">License</th>
                <th className="px-4 py-3 font-medium">Class</th>
                <th className="px-4 py-3 font-medium">Phone</th>
                <th className="px-4 py-3 font-medium">Expiry</th>
                <th className="px-4 py-3 font-medium">Status</th>
                {isAdmin && <th className="px-4 py-3 font-medium" />}
              </tr>
            </thead>
            <tbody>
              {items.map((d) => {
                const days = daysUntil(d.licenseExpiryDate);
                const expiringSoon = days <= 30 && days > 0;
                const expired = days <= 0;
                return (
                  <tr key={d.id} className="border-b border-border last:border-0 hover:bg-muted/30">
                    <td className="px-4 py-3 font-medium">{d.fullName}</td>
                    <td className="px-4 py-3 font-mono text-xs">{d.licenseNumber}</td>
                    <td className="px-4 py-3">{d.licenseClass ?? '—'}</td>
                    <td className="px-4 py-3">{d.phone ?? '—'}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="tabular-nums">{d.licenseExpiryDate}</span>
                        {expired && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-xs text-red-700">
                            <AlertTriangle className="h-3 w-3" /> expired
                          </span>
                        )}
                        {expiringSoon && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-xs text-amber-700">
                            {days}d left
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-medium ${
                        d.status === 'ACTIVE' ? 'bg-green-50 text-green-700 border-green-200' : 'bg-gray-100 text-gray-600 border-gray-200'
                      }`}>
                        {d.status}
                      </span>
                    </td>
                    {isAdmin && (
                      <td className="px-4 py-3 text-right">
                        <Link
                          href={`/drivers/${d.id}/edit` as never}
                          className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                        >
                          <Edit2 className="h-3 w-3" /> {t('common.edit')}
                        </Link>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
