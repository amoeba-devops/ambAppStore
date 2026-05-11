'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { apiFetch } from '@/lib/client/api';
import type { Role, User } from '@repo/api-types';
import { Plus, Edit2 } from 'lucide-react';

const ROLE_STYLE: Record<Role, string> = {
  ADMIN: 'bg-violet-50 text-violet-700 border-violet-200',
  MANAGER: 'bg-blue-50 text-blue-700 border-blue-200',
  DRIVER: 'bg-emerald-50 text-emerald-700 border-emerald-200',
};

export default function UserListPage() {
  const t = useTranslations();
  const [items, setItems] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (q) params.set('q', q);
    const debounce = setTimeout(() => {
      apiFetch<User[]>(`/api/users?${params}`)
        .then(setItems)
        .catch(() => setItems([]))
        .finally(() => setLoading(false));
    }, 200);
    return () => clearTimeout(debounce);
  }, [q]);

  return (
    <div className="mx-auto max-w-6xl">
      <header className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">{t('nav.users')}</h1>
        <Link
          href="/users/new"
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
        >
          <Plus className="h-4 w-4" />
          {t('common.create')}
        </Link>
      </header>

      <div className="mb-4">
        <input
          placeholder="Search by name or email"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="w-full max-w-sm rounded-lg border border-border bg-background px-3 py-1.5 text-sm"
        />
      </div>

      <div className="overflow-hidden rounded-2xl border border-border bg-background">
        {loading ? (
          <div className="p-10 text-center text-sm text-muted-foreground">{t('common.loading')}</div>
        ) : items.length === 0 ? (
          <div className="p-10 text-center text-sm text-muted-foreground">No users found.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-muted/40 text-left">
              <tr>
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Email</th>
                <th className="px-4 py-3 font-medium">Position</th>
                <th className="px-4 py-3 font-medium">Role</th>
                <th className="px-4 py-3 font-medium">Lang</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium" />
              </tr>
            </thead>
            <tbody>
              {items.map((u) => (
                <tr key={u.id} className="border-b border-border last:border-0 hover:bg-muted/30">
                  <td className="px-4 py-3 font-medium">{u.fullName}</td>
                  <td className="px-4 py-3 text-muted-foreground">{u.email}</td>
                  <td className="px-4 py-3">{u.position ?? '—'}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-medium ${ROLE_STYLE[u.role]}`}>
                      {u.role}
                    </span>
                  </td>
                  <td className="px-4 py-3 uppercase text-xs">{u.language}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-medium ${
                      u.status === 'ACTIVE'
                        ? 'bg-green-50 text-green-700 border-green-200'
                        : 'bg-gray-100 text-gray-600 border-gray-200'
                    }`}>
                      {u.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/users/${u.id}/edit` as never}
                      className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                    >
                      <Edit2 className="h-3 w-3" /> {t('common.edit')}
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
