'use client';

import { useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/navigation';
import { apiFetch, ClientApiError } from '@/lib/client/api';
import type { Cost, CostType, Vehicle, Trip } from '@repo/api-types';

const TYPES: CostType[] = ['FUEL', 'OIL_CHANGE', 'ACCIDENT', 'MEAL', 'REPAIR_MAINTENANCE'];

export default function NewCostPage() {
  const t = useTranslations();
  const router = useRouter();

  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [trips, setTrips] = useState<Array<Trip & { passengerName: string; licensePlate: string }>>([]);
  const [type, setType] = useState<CostType>('FUEL');
  const [vehicleId, setVehicleId] = useState('');
  const [tripId, setTripId] = useState('');
  const [costDate, setCostDate] = useState(new Date().toISOString().slice(0, 10));
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [preApproval, setPreApproval] = useState(false);

  // Per-type metadata fields
  const [liters, setLiters] = useState('');
  const [unitPrice, setUnitPrice] = useState('');
  const [gasStation, setGasStation] = useState('');
  const [currentKm, setCurrentKm] = useState('');
  const [oilType, setOilType] = useState('');
  const [accidentDescription, setAccidentDescription] = useState('');
  const [numberOfPeople, setNumberOfPeople] = useState('1');
  const [itemDescription, setItemDescription] = useState('');
  const [provider, setProvider] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<Vehicle[]>('/api/vehicles').then(setVehicles).catch(() => setVehicles([]));
    apiFetch<Array<Trip & { passengerName: string; licensePlate: string }>>(
      '/api/trips?status=COMPLETED&limit=50',
    ).then(setTrips).catch(() => setTrips([]));
  }, []);

  // Auto-calc fuel amount from liters × unitPrice
  useEffect(() => {
    if (type === 'FUEL' && liters && unitPrice) {
      const calc = Number(liters) * Number(unitPrice);
      if (!isNaN(calc) && calc > 0) setAmount(String(Math.round(calc)));
    }
  }, [type, liters, unitPrice]);

  const metadata = useMemo<Record<string, unknown>>(() => {
    switch (type) {
      case 'FUEL':
        return {
          liters: Number(liters || 0),
          unitPrice: Number(unitPrice || 0),
          gasStation: gasStation || undefined,
          currentKm: currentKm ? Number(currentKm) : undefined,
        };
      case 'OIL_CHANGE':
        return {
          oilType,
          currentKm: Number(currentKm || 0),
        };
      case 'ACCIDENT':
        return { description: accidentDescription };
      case 'MEAL':
        return { numberOfPeople: Number(numberOfPeople || 1) };
      case 'REPAIR_MAINTENANCE':
        return { itemDescription, provider: provider || undefined };
    }
  }, [type, liters, unitPrice, gasStation, currentKm, oilType, accidentDescription, numberOfPeople, itemDescription, provider]);

  const canSubmit =
    Boolean(vehicleId && costDate && amount && Number(amount) > 0) &&
    (type !== 'MEAL' || tripId !== '');

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const created = await apiFetch<Cost>('/api/costs', {
        method: 'POST',
        body: JSON.stringify({
          type,
          vehicleId,
          tripId: tripId || undefined,
          costDate,
          amount: Number(amount),
          description: description || undefined,
          metadata,
          preApproval: preApproval || undefined,
        }),
      });
      router.push(`/costs/${created.id}` as never);
    } catch (err) {
      if (err instanceof ClientApiError) setError(`${err.code}: ${err.message}`);
      else setError('Failed to create cost');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="mb-6 text-2xl font-semibold">New cost</h1>

      <form onSubmit={onSubmit} className="space-y-5 rounded-2xl border border-border bg-background p-6">
        <Field label="Type">
          <div className="flex flex-wrap gap-2">
            {TYPES.map((x) => (
              <button
                type="button"
                key={x}
                onClick={() => setType(x)}
                className={`rounded-full border px-3 py-1 text-xs ${
                  type === x ? 'border-primary bg-primary/10 text-primary' : 'border-border text-foreground'
                }`}
              >
                {t(`cost.type.${x}`)}
              </button>
            ))}
          </div>
        </Field>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Date">
            <input
              type="date"
              value={costDate}
              onChange={(e) => setCostDate(e.target.value)}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
              required
            />
          </Field>
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
        </div>

        {type === 'MEAL' && (
          <Field label="Linked trip (required for MEAL)">
            <select
              value={tripId}
              onChange={(e) => setTripId(e.target.value)}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
              required
            >
              <option value="">— select —</option>
              {trips
                .filter((t) => !vehicleId || t.vehicleId === vehicleId)
                .map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.tripDate} {t.tripTime} · {t.passengerName} ({t.licensePlate})
                  </option>
                ))}
            </select>
          </Field>
        )}

        {type === 'FUEL' && (
          <fieldset className="grid grid-cols-1 gap-3 rounded-lg border border-border bg-muted/20 p-4 sm:grid-cols-2">
            <legend className="px-2 text-sm font-medium">Fuel details</legend>
            <Field label="Liters">
              <input
                type="number"
                step="0.01"
                min="0"
                value={liters}
                onChange={(e) => setLiters(e.target.value)}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                required
              />
            </Field>
            <Field label="Unit price (VND/L)">
              <input
                type="number"
                step="1"
                min="0"
                value={unitPrice}
                onChange={(e) => setUnitPrice(e.target.value)}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                required
              />
            </Field>
            <Field label="Gas station">
              <input
                value={gasStation}
                onChange={(e) => setGasStation(e.target.value)}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
              />
            </Field>
            <Field label="Odometer (km)">
              <input
                type="number"
                value={currentKm}
                onChange={(e) => setCurrentKm(e.target.value)}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
              />
            </Field>
          </fieldset>
        )}

        {type === 'OIL_CHANGE' && (
          <fieldset className="grid grid-cols-1 gap-3 rounded-lg border border-border bg-muted/20 p-4 sm:grid-cols-2">
            <legend className="px-2 text-sm font-medium">Oil change details</legend>
            <Field label="Oil type">
              <input
                value={oilType}
                onChange={(e) => setOilType(e.target.value)}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                required
              />
            </Field>
            <Field label="Odometer (km)">
              <input
                type="number"
                value={currentKm}
                onChange={(e) => setCurrentKm(e.target.value)}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                required
              />
            </Field>
          </fieldset>
        )}

        {type === 'ACCIDENT' && (
          <Field label="Accident description (photos can be uploaded after creating)">
            <textarea
              value={accidentDescription}
              onChange={(e) => setAccidentDescription(e.target.value)}
              rows={4}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
              required
            />
          </Field>
        )}

        {type === 'MEAL' && (
          <Field label="Number of people">
            <input
              type="number"
              min="1"
              value={numberOfPeople}
              onChange={(e) => setNumberOfPeople(e.target.value)}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
              required
            />
          </Field>
        )}

        {type === 'REPAIR_MAINTENANCE' && (
          <fieldset className="grid grid-cols-1 gap-3 rounded-lg border border-border bg-muted/20 p-4">
            <legend className="px-2 text-sm font-medium">Repair / Maintenance details</legend>
            <Field label="Item description">
              <textarea
                value={itemDescription}
                onChange={(e) => setItemDescription(e.target.value)}
                rows={3}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                required
              />
            </Field>
            <Field label="Provider">
              <input
                value={provider}
                onChange={(e) => setProvider(e.target.value)}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
              />
            </Field>
          </fieldset>
        )}

        <Field label="Amount (VND)">
          <input
            type="number"
            step="1"
            min="1"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
            required
          />
        </Field>

        <Field label="Description (optional)">
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
          />
        </Field>

        {(type === 'REPAIR_MAINTENANCE' || type === 'ACCIDENT') && (
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={preApproval}
              onChange={(e) => setPreApproval(e.target.checked)}
            />
            Submit as <strong>pre-approval request</strong> (admin approves first, then I add receipts)
          </label>
        )}

        {error && (
          <div className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-700">{error}</div>
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
