'use client';

import { useEffect, useState } from 'react';
import { Link } from '@/i18n/navigation';
import { useTranslations } from 'next-intl';
import { apiFetch } from '@/lib/client/api';
import { TripStatusBadge } from '@/components/trips/TripStatusBadge';
import type { Trip, TripStatus } from '@repo/api-types';
import { Plus } from 'lucide-react';

type TripListItem = Trip & {
  passengerName: string;
  driverName: string;
  licensePlate: string;
};

const STATUS_OPTIONS: TripStatus[] = [
  'PENDING_DRIVER_CONFIRM',
  'CONFIRMED',
  'IN_PROGRESS',
  'COMPLETED',
  'DRIVER_REJECTED',
  'CANCELLED',
];

export default function TripListPage() {
  const t = useTranslations();
  const [items, setItems] = useState<TripListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<TripStatus | ''>('');

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (filterStatus) params.set('status', filterStatus);
    apiFetch<TripListItem[]>(`/api/trips?${params.toString()}`)
      .then(setItems)
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, [filterStatus]);

  return (
    <div className="mx-auto max-w-6xl">
      <header className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">{t('nav.trips')}</h1>
        <Link
          href="/trips/new"
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
        >
          <Plus className="h-4 w-4" />
          {t('common.create')}
        </Link>
      </header>

      <div className="mb-4 flex items-center gap-3">
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value as TripStatus | '')}
          className="rounded-lg border border-border bg-background px-3 py-1.5 text-sm"
        >
          <option value="">All statuses</option>
          {STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>
              {t(`trip.status.${s}`)}
            </option>
          ))}
        </select>
      </div>

      <div className="overflow-hidden rounded-2xl border border-border bg-background">
        {loading ? (
          <div className="p-10 text-center text-sm text-muted-foreground">{t('common.loading')}</div>
        ) : items.length === 0 ? (
          <div className="p-10 text-center text-sm text-muted-foreground">No trips yet.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-muted/40 text-left">
              <tr>
                <th className="px-4 py-3 font-medium">Date</th>
                <th className="px-4 py-3 font-medium">Time</th>
                <th className="px-4 py-3 font-medium">Passenger</th>
                <th className="px-4 py-3 font-medium">Driver</th>
                <th className="px-4 py-3 font-medium">Vehicle</th>
                <th className="px-4 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {items.map((trip) => (
                <tr key={trip.id} className="border-b border-border last:border-0 hover:bg-muted/30">
                  <td className="px-4 py-3">
                    <Link href={`/trips/${trip.id}` as never} className="text-primary hover:underline">
                      {trip.tripDate}
                    </Link>
                  </td>
                  <td className="px-4 py-3">{trip.tripTime}</td>
                  <td className="px-4 py-3">{trip.passengerName}</td>
                  <td className="px-4 py-3">{trip.driverName}</td>
                  <td className="px-4 py-3 font-mono text-xs">{trip.licensePlate}</td>
                  <td className="px-4 py-3">
                    <TripStatusBadge status={trip.status} />
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
