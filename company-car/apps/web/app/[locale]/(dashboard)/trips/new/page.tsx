'use client';

import { useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/navigation';
import { apiFetch, ClientApiError } from '@/lib/client/api';
import type {
  Driver,
  Vehicle,
  User,
  Trip,
} from '@repo/api-types';

type Conflict = {
  type: 'vehicle' | 'driver';
  tripId: string;
  passengerName: string;
  tripDate: string;
  tripTime: string;
  estimatedEndTime: string | null;
  status: string;
};

export default function NewTripPage() {
  const t = useTranslations();
  const router = useRouter();

  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [me, setMe] = useState<User | null>(null);

  const [tripDate, setTripDate] = useState('');
  const [tripTime, setTripTime] = useState('09:00');
  const [vehicleId, setVehicleId] = useState('');
  const [driverId, setDriverId] = useState('');
  const [pickupAddress, setPickupAddress] = useState('');
  const [pickupLat, setPickupLat] = useState('10.7769');
  const [pickupLng, setPickupLng] = useState('106.7009');
  const [destAddress, setDestAddress] = useState('');
  const [destLat, setDestLat] = useState('10.7769');
  const [destLng, setDestLng] = useState('106.7009');
  const [note, setNote] = useState('');

  const [conflicts, setConflicts] = useState<Conflict[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      apiFetch<Vehicle[]>('/api/vehicles?status=ACTIVE'),
      apiFetch<Driver[]>('/api/drivers?status=ACTIVE'),
      apiFetch<User>('/api/auth/me'),
    ])
      .then(([v, d, u]) => {
        setVehicles(v);
        setDrivers(d);
        setMe(u);
      })
      .catch(() => setError('Failed to load form data'));
  }, []);

  // Debounced conflict check
  useEffect(() => {
    if (!vehicleId && !driverId) return;
    if (!tripDate || !tripTime) return;
    const timer = setTimeout(async () => {
      try {
        const params = new URLSearchParams({ date: tripDate, time: tripTime });
        if (vehicleId) params.set('vehicleId', vehicleId);
        if (driverId) params.set('driverId', driverId);
        const result = await apiFetch<{ conflicts: Conflict[]; hasConflict: boolean }>(
          `/api/trips/conflicts?${params.toString()}`,
        );
        setConflicts(result.conflicts);
      } catch {
        setConflicts([]);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [vehicleId, driverId, tripDate, tripTime]);

  const canSubmit = useMemo(
    () =>
      Boolean(
        me &&
          tripDate &&
          tripTime &&
          vehicleId &&
          driverId &&
          pickupAddress &&
          destAddress &&
          conflicts.length === 0,
      ),
    [me, tripDate, tripTime, vehicleId, driverId, pickupAddress, destAddress, conflicts],
  );

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!me) return;
    setError(null);
    setSubmitting(true);
    try {
      const created = await apiFetch<Trip>('/api/trips', {
        method: 'POST',
        body: JSON.stringify({
          passengerId: me.id,
          driverId,
          vehicleId,
          tripDate,
          tripTime,
          pickupLocation: {
            address: pickupAddress,
            lat: Number(pickupLat),
            lng: Number(pickupLng),
          },
          destination: {
            address: destAddress,
            lat: Number(destLat),
            lng: Number(destLng),
          },
          stopovers: [],
          note: note || undefined,
        }),
      });
      router.push(`/trips/${created.id}` as never);
    } catch (err) {
      if (err instanceof ClientApiError) {
        setError(`${err.code}: ${err.message}`);
      } else {
        setError('Failed to create trip');
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="mb-6 text-2xl font-semibold">New trip</h1>

      <form onSubmit={onSubmit} className="space-y-5 rounded-2xl border border-border bg-background p-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Date">
            <input
              type="date"
              value={tripDate}
              onChange={(e) => setTripDate(e.target.value)}
              min={new Date().toISOString().slice(0, 10)}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
              required
            />
          </Field>
          <Field label="Time">
            <input
              type="time"
              value={tripTime}
              onChange={(e) => setTripTime(e.target.value)}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
              required
            />
          </Field>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Vehicle">
            <select
              value={vehicleId}
              onChange={(e) => setVehicleId(e.target.value)}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
              required
            >
              <option value="">— select —</option>
              {vehicles.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.licensePlate} — {v.vehicleType}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Driver">
            <select
              value={driverId}
              onChange={(e) => setDriverId(e.target.value)}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
              required
            >
              <option value="">— select —</option>
              {drivers.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.fullName} ({d.licenseNumber})
                </option>
              ))}
            </select>
          </Field>
        </div>

        <fieldset className="grid grid-cols-1 gap-3 rounded-lg border border-border bg-muted/20 p-4">
          <legend className="px-2 text-sm font-medium">Pickup</legend>
          <input
            placeholder="Address"
            value={pickupAddress}
            onChange={(e) => setPickupAddress(e.target.value)}
            className="rounded-lg border border-border bg-background px-3 py-2 text-sm"
            required
          />
          <div className="grid grid-cols-2 gap-2">
            <input
              placeholder="Latitude"
              type="number"
              step="any"
              value={pickupLat}
              onChange={(e) => setPickupLat(e.target.value)}
              className="rounded-lg border border-border bg-background px-3 py-2 text-sm"
              required
            />
            <input
              placeholder="Longitude"
              type="number"
              step="any"
              value={pickupLng}
              onChange={(e) => setPickupLng(e.target.value)}
              className="rounded-lg border border-border bg-background px-3 py-2 text-sm"
              required
            />
          </div>
        </fieldset>

        <fieldset className="grid grid-cols-1 gap-3 rounded-lg border border-border bg-muted/20 p-4">
          <legend className="px-2 text-sm font-medium">Destination</legend>
          <input
            placeholder="Address"
            value={destAddress}
            onChange={(e) => setDestAddress(e.target.value)}
            className="rounded-lg border border-border bg-background px-3 py-2 text-sm"
            required
          />
          <div className="grid grid-cols-2 gap-2">
            <input
              placeholder="Latitude"
              type="number"
              step="any"
              value={destLat}
              onChange={(e) => setDestLat(e.target.value)}
              className="rounded-lg border border-border bg-background px-3 py-2 text-sm"
              required
            />
            <input
              placeholder="Longitude"
              type="number"
              step="any"
              value={destLng}
              onChange={(e) => setDestLng(e.target.value)}
              className="rounded-lg border border-border bg-background px-3 py-2 text-sm"
              required
            />
          </div>
        </fieldset>

        <Field label="Note (optional)">
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={3}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
            maxLength={1000}
          />
        </Field>

        {conflicts.length > 0 && (
          <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800">
            <p className="font-medium">Schedule conflict detected:</p>
            <ul className="mt-2 space-y-1">
              {conflicts.map((c, i) => (
                <li key={i}>
                  · {c.type === 'vehicle' ? 'Vehicle' : 'Driver'} already booked
                  {' '}
                  {c.tripDate} {c.tripTime} → {c.estimatedEndTime ?? '?'} ({c.passengerName})
                </li>
              ))}
            </ul>
          </div>
        )}

        {error && (
          <div className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={() => router.back()}
            className="rounded-lg border border-border px-4 py-2 text-sm"
          >
            {t('common.cancel')}
          </button>
          <button
            type="submit"
            disabled={!canSubmit || submitting}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-60"
          >
            {submitting ? t('common.loading') : t('common.create')}
          </button>
        </div>
      </form>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1">
      <span className="text-sm font-medium">{label}</span>
      {children}
    </label>
  );
}
