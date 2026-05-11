'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Link, useRouter } from '@/i18n/navigation';
import { apiFetch, ClientApiError } from '@/lib/client/api';
import { TripStatusBadge } from '@/components/trips/TripStatusBadge';
import type { Trip, TripStatus, User } from '@repo/api-types';
import { ArrowLeft, ExternalLink } from 'lucide-react';

type TripDetail = Trip & {
  passenger: { id: string; fullName: string; email: string };
  driver: {
    id: string;
    fullName: string;
    licenseNumber: string;
    phone: string | null;
    userId: string | null;
  };
  vehicle: { id: string; licensePlate: string; vehicleType: string };
};

export default function TripDetailPage() {
  const t = useTranslations();
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const id = params.id;

  const [trip, setTrip] = useState<TripDetail | null>(null);
  const [me, setMe] = useState<User | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    try {
      const [t, u] = await Promise.all([
        apiFetch<TripDetail>(`/api/trips/${id}`),
        apiFetch<User>('/api/auth/me'),
      ]);
      setTrip(t);
      setMe(u);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load');
    }
  }

  useEffect(() => {
    load();
  }, [id]);

  async function callAction(action: string, body?: unknown) {
    setBusy(true);
    setError(null);
    try {
      await apiFetch(`/api/trips/${id}/${action}`, {
        method: 'POST',
        body: body ? JSON.stringify(body) : undefined,
      });
      await load();
    } catch (err) {
      if (err instanceof ClientApiError) setError(`${err.code}: ${err.message}`);
      else setError('Action failed');
    } finally {
      setBusy(false);
    }
  }

  if (!trip || !me) {
    return <div className="text-sm text-muted-foreground">{t('common.loading')}</div>;
  }

  const isAssignedDriver = me.role === 'DRIVER' && trip.driver.userId === me.id;
  const isAdmin = me.role === 'ADMIN';
  const isOwner = trip.passenger.id === me.id || trip.createdBy === me.id;
  const status = trip.status as TripStatus;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <Link href="/trips" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> All trips
      </Link>

      <div className="rounded-2xl border border-border bg-background p-6">
        <header className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-semibold">
              {trip.tripDate} · {trip.tripTime}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {trip.estimatedEndTime ? `until ${trip.estimatedEndTime}` : ''}
            </p>
          </div>
          <TripStatusBadge status={status} />
        </header>

        {trip.rejectionReason && (
          <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
            <span className="font-medium">Reason:</span> {trip.rejectionReason}
          </div>
        )}

        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Info label="Passenger" value={`${trip.passenger.fullName} (${trip.passenger.email})`} />
          <Info label="Driver" value={`${trip.driver.fullName} · ${trip.driver.licenseNumber}`} />
          <Info label="Vehicle" value={`${trip.vehicle.licensePlate} · ${trip.vehicle.vehicleType}`} />
          <Info label="Note" value={trip.note ?? '—'} />
        </div>

        <div className="mt-6 space-y-3">
          <Place label="Pickup" loc={trip.pickupLocation} />
          {trip.stopovers.map((s, i) => (
            <Place key={i} label={`Stopover ${i + 1}`} loc={s} />
          ))}
          <Place label="Destination" loc={trip.destination} />
        </div>

        {trip.mapsUrl && (
          <a
            href={trip.mapsUrl}
            target="_blank"
            rel="noreferrer"
            className="mt-6 inline-flex items-center gap-2 text-sm text-primary hover:underline"
          >
            <ExternalLink className="h-4 w-4" /> Open in Google Maps
          </a>
        )}
      </div>

      {error && (
        <div className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-700">{error}</div>
      )}

      <div className="rounded-2xl border border-border bg-background p-6">
        <h2 className="text-base font-medium">Actions</h2>
        <div className="mt-4 flex flex-wrap gap-2">
          {isAssignedDriver && status === 'PENDING_DRIVER_CONFIRM' && (
            <>
              <ActionButton onClick={() => callAction('confirm')} variant="primary" disabled={busy}>
                {t('common.confirm')}
              </ActionButton>
              <ActionButton
                onClick={() => {
                  const reason = prompt('Rejection reason?');
                  if (reason) callAction('reject', { reason });
                }}
                variant="danger"
                disabled={busy}
              >
                {t('common.reject')}
              </ActionButton>
            </>
          )}
          {isAssignedDriver && status === 'CONFIRMED' && (
            <ActionButton onClick={() => callAction('start')} variant="primary" disabled={busy}>
              Start trip
            </ActionButton>
          )}
          {isAssignedDriver && status === 'IN_PROGRESS' && (
            <ActionButton onClick={() => callAction('complete')} variant="primary" disabled={busy}>
              Complete trip
            </ActionButton>
          )}
          {isAdmin && status === 'DRIVER_REJECTED' && (
            <ActionButton
              onClick={() => {
                const driverId = prompt('New driver ID');
                if (driverId) callAction('reassign', { driverId });
              }}
              variant="primary"
              disabled={busy}
            >
              Reassign driver
            </ActionButton>
          )}
          {(isOwner || isAdmin) && !['COMPLETED', 'CANCELLED'].includes(status) && (
            <ActionButton
              onClick={() => {
                const reason = prompt('Cancel reason?');
                if (reason) callAction('cancel', { reason });
              }}
              variant="ghost"
              disabled={busy}
            >
              {t('common.cancel')}
            </ActionButton>
          )}
        </div>
        {!isAssignedDriver && !isAdmin && !isOwner && (
          <p className="mt-2 text-xs text-muted-foreground">No actions available for your role.</p>
        )}
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

function Place({ label, loc }: { label: string; loc: { address: string; lat: number; lng: number } }) {
  return (
    <div className="rounded-lg border border-border bg-muted/20 p-3">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm">{loc.address}</p>
      <p className="text-xs text-muted-foreground">{loc.lat.toFixed(4)}, {loc.lng.toFixed(4)}</p>
    </div>
  );
}

function ActionButton({
  onClick,
  variant,
  disabled,
  children,
}: {
  onClick: () => void;
  variant: 'primary' | 'danger' | 'ghost';
  disabled?: boolean;
  children: React.ReactNode;
}) {
  const cls =
    variant === 'primary'
      ? 'bg-primary text-primary-foreground'
      : variant === 'danger'
        ? 'bg-red-600 text-white'
        : 'border border-border text-foreground';
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-50 ${cls}`}
    >
      {children}
    </button>
  );
}
