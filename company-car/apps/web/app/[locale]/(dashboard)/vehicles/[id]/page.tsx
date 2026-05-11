'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Link } from '@/i18n/navigation';
import { apiFetch } from '@/lib/client/api';
import type { User, Vehicle } from '@repo/api-types';
import { ArrowLeft, Edit2 } from 'lucide-react';

type V = Vehicle & {
  assignedDriver: { id: string; fullName: string; licenseNumber: string } | null;
};

export default function VehicleDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [vehicle, setVehicle] = useState<V | null>(null);
  const [me, setMe] = useState<User | null>(null);

  useEffect(() => {
    Promise.all([apiFetch<V>(`/api/vehicles/${id}`), apiFetch<User>('/api/auth/me')]).then(
      ([v, u]) => {
        setVehicle(v);
        setMe(u);
      },
    );
  }, [id]);

  if (!vehicle) return <div className="text-sm text-muted-foreground">Loading...</div>;

  const kmSince = vehicle.currentKm - vehicle.lastOilChangeKm;
  const remaining = vehicle.oilChangeIntervalKm - kmSince;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <Link href="/vehicles" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> All vehicles
      </Link>

      <div className="rounded-2xl border border-border bg-background p-6">
        <header className="flex items-start justify-between">
          <div>
            <h1 className="font-mono text-2xl font-semibold">{vehicle.licensePlate}</h1>
            <p className="mt-1 text-sm text-muted-foreground">{vehicle.vehicleType}</p>
          </div>
          {me?.role === 'ADMIN' && (
            <Link
              href={`/vehicles/${id}/edit` as never}
              className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-1.5 text-sm hover:bg-muted"
            >
              <Edit2 className="h-4 w-4" /> Edit
            </Link>
          )}
        </header>

        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Info label="Status" value={vehicle.status} />
          <Info label="Year / Color" value={`${vehicle.manufactureYear ?? '—'} · ${vehicle.color ?? '—'}`} />
          <Info label="Assigned driver" value={vehicle.assignedDriver?.fullName ?? '—'} />
          <Info label="Current odometer" value={`${vehicle.currentKm.toLocaleString()} km`} />
          <Info label="Oil change interval" value={`${vehicle.oilChangeIntervalKm.toLocaleString()} km`} />
          <Info label="Last oil change at" value={`${vehicle.lastOilChangeKm.toLocaleString()} km`} />
        </div>

        <div className="mt-6 rounded-lg border border-border bg-muted/20 p-3 text-sm">
          <p>
            <span className="text-muted-foreground">Distance since last oil change:</span>{' '}
            <strong className="tabular-nums">{kmSince.toLocaleString()} km</strong>
          </p>
          <p>
            <span className="text-muted-foreground">Remaining until next:</span>{' '}
            <strong className={`tabular-nums ${remaining < 500 ? 'text-amber-700' : ''}`}>
              {remaining.toLocaleString()} km
            </strong>
            {remaining < 500 && <span className="ml-2 text-xs text-amber-700">⚠ due soon</span>}
          </p>
        </div>
      </div>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm">{value}</p>
    </div>
  );
}
