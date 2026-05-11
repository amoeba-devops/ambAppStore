'use client';

import { useEffect, useState } from 'react';
import { Link } from '@/i18n/navigation';
import { useTranslations } from 'next-intl';
import { apiFetch } from '@/lib/client/api';
import { CostStatusBadge } from '@/components/costs/CostStatusBadge';
import { CostTypeBadge } from '@/components/costs/CostTypeBadge';
import type { Cost, CostStatus, CostType } from '@repo/api-types';
import { Plus } from 'lucide-react';

type Row = Cost & { licensePlate: string; submitterName: string };

const TYPES: CostType[] = ['FUEL', 'OIL_CHANGE', 'ACCIDENT', 'MEAL', 'REPAIR_MAINTENANCE'];
const STATUSES: CostStatus[] = ['DRAFT', 'PENDING_APPROVAL', 'APPROVED_TO_PROCEED', 'SUBMITTED', 'APPROVED', 'REJECTED'];

export default function CostListPage() {
  const t = useTranslations();
  const [items, setItems] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [type, setType] = useState<CostType | ''>('');
  const [status, setStatus] = useState<CostStatus | ''>('');

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (type) params.set('type', type);
    if (status) params.set('status', status);
    apiFetch<Row[]>(`/api/costs?${params.toString()}`)
      .then(setItems)
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, [type, status]);

  return (
    <div className="mx-auto max-w-6xl">
      <header className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">{t('nav.costs')}</h1>
        <Link
          href="/costs/new"
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
        >
          <Plus className="h-4 w-4" />
          {t('common.create')}
        </Link>
      </header>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <select
          value={type}
          onChange={(e) => setType(e.target.value as CostType | '')}
          className="rounded-lg border border-border bg-background px-3 py-1.5 text-sm"
        >
          <option value="">All types</option>
          {TYPES.map((x) => (
            <option key={x} value={x}>
              {t(`cost.type.${x}`)}
            </option>
          ))}
        </select>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value as CostStatus | '')}
          className="rounded-lg border border-border bg-background px-3 py-1.5 text-sm"
        >
          <option value="">All statuses</option>
          {STATUSES.map((x) => (
            <option key={x} value={x}>
              {t(`cost.status.${x}`)}
            </option>
          ))}
        </select>
      </div>

      <div className="overflow-hidden rounded-2xl border border-border bg-background">
        {loading ? (
          <div className="p-10 text-center text-sm text-muted-foreground">{t('common.loading')}</div>
        ) : items.length === 0 ? (
          <div className="p-10 text-center text-sm text-muted-foreground">No costs yet.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-muted/40 text-left">
              <tr>
                <th className="px-4 py-3 font-medium">Date</th>
                <th className="px-4 py-3 font-medium">Type</th>
                <th className="px-4 py-3 font-medium">Vehicle</th>
                <th className="px-4 py-3 font-medium">Amount</th>
                <th className="px-4 py-3 font-medium">Submitter</th>
                <th className="px-4 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {items.map((c) => (
                <tr key={c.id} className="border-b border-border last:border-0 hover:bg-muted/30">
                  <td className="px-4 py-3">
                    <Link href={`/costs/${c.id}` as never} className="text-primary hover:underline">
                      {c.costDate}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <CostTypeBadge type={c.type} />
                  </td>
                  <td className="px-4 py-3 font-mono text-xs">{c.licensePlate}</td>
                  <td className="px-4 py-3 tabular-nums">
                    {Number(c.amount).toLocaleString()} {c.currency}
                  </td>
                  <td className="px-4 py-3">{c.submitterName}</td>
                  <td className="px-4 py-3">
                    <CostStatusBadge status={c.status} />
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
