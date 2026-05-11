'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/navigation';
import { apiFetch, ClientApiError } from '@/lib/client/api';
import type { Vehicle, VehicleStatus, Driver } from '@repo/api-types';

const STATUSES: VehicleStatus[] = ['ACTIVE', 'MAINTENANCE', 'INACTIVE'];

type Props = {
  initial?: Partial<Vehicle>;
  drivers: Driver[];
  isEdit?: boolean;
  vehicleId?: string;
};

export function VehicleForm({ initial, drivers, isEdit = false, vehicleId }: Props) {
  const t = useTranslations();
  const router = useRouter();

  const [licensePlate, setLicensePlate] = useState(initial?.licensePlate ?? '');
  const [vehicleType, setVehicleType] = useState(initial?.vehicleType ?? '');
  const [manufactureYear, setManufactureYear] = useState(
    initial?.manufactureYear ? String(initial.manufactureYear) : '',
  );
  const [color, setColor] = useState(initial?.color ?? '');
  const [currentKm, setCurrentKm] = useState(String(initial?.currentKm ?? 0));
  const [oilChangeIntervalKm, setOilChangeIntervalKm] = useState(String(initial?.oilChangeIntervalKm ?? 5000));
  const [lastOilChangeKm, setLastOilChangeKm] = useState(String(initial?.lastOilChangeKm ?? 0));
  const [assignedDriverId, setAssignedDriverId] = useState(initial?.assignedDriverId ?? '');
  const [status, setStatus] = useState<VehicleStatus>(initial?.status ?? 'ACTIVE');

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const payload = {
        licensePlate,
        vehicleType,
        manufactureYear: manufactureYear ? Number(manufactureYear) : undefined,
        color: color || undefined,
        currentKm: Number(currentKm),
        oilChangeIntervalKm: Number(oilChangeIntervalKm),
        lastOilChangeKm: Number(lastOilChangeKm),
        assignedDriverId: assignedDriverId || undefined,
        status,
      };
      if (isEdit && vehicleId) {
        await apiFetch(`/api/vehicles/${vehicleId}`, {
          method: 'PATCH',
          body: JSON.stringify(payload),
        });
        router.push(`/vehicles/${vehicleId}` as never);
      } else {
        const created = await apiFetch<Vehicle>('/api/vehicles', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        router.push(`/vehicles/${created.id}` as never);
      }
    } catch (err) {
      if (err instanceof ClientApiError) setError(`${err.code}: ${err.message}`);
      else setError('Save failed');
    } finally {
      setSubmitting(false);
    }
  }

  async function onDelete() {
    if (!isEdit || !vehicleId) return;
    if (!confirm('Delete this vehicle? Trips referencing it will fail.')) return;
    try {
      await apiFetch(`/api/vehicles/${vehicleId}`, { method: 'DELETE' });
      router.push('/vehicles');
    } catch (err) {
      if (err instanceof ClientApiError) setError(`${err.code}: ${err.message}`);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5 rounded-2xl border border-border bg-background p-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="License plate">
          <input
            value={licensePlate}
            onChange={(e) => setLicensePlate(e.target.value)}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 font-mono text-sm uppercase"
            required
            maxLength={20}
          />
        </Field>
        <Field label="Vehicle type">
          <input
            value={vehicleType}
            onChange={(e) => setVehicleType(e.target.value)}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
            required
            placeholder="Toyota Camry"
          />
        </Field>
        <Field label="Manufacture year">
          <input
            type="number"
            min="1900"
            max="2100"
            value={manufactureYear}
            onChange={(e) => setManufactureYear(e.target.value)}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
          />
        </Field>
        <Field label="Color">
          <input
            value={color}
            onChange={(e) => setColor(e.target.value)}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
            placeholder="Black"
          />
        </Field>
        <Field label="Current km">
          <input
            type="number"
            min="0"
            value={currentKm}
            onChange={(e) => setCurrentKm(e.target.value)}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm tabular-nums"
            required
          />
        </Field>
        <Field label="Oil change interval (km)">
          <input
            type="number"
            min="1"
            value={oilChangeIntervalKm}
            onChange={(e) => setOilChangeIntervalKm(e.target.value)}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm tabular-nums"
            required
          />
        </Field>
        <Field label="Last oil change km">
          <input
            type="number"
            min="0"
            value={lastOilChangeKm}
            onChange={(e) => setLastOilChangeKm(e.target.value)}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm tabular-nums"
          />
        </Field>
        <Field label="Assigned driver (optional)">
          <select
            value={assignedDriverId}
            onChange={(e) => setAssignedDriverId(e.target.value)}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
          >
            <option value="">— none —</option>
            {drivers.map((d) => (
              <option key={d.id} value={d.id}>
                {d.fullName} ({d.licenseNumber})
              </option>
            ))}
          </select>
        </Field>
        <Field label="Status">
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as VehicleStatus)}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
            required
          >
            {STATUSES.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </Field>
      </div>

      {error && (
        <div className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-700">{error}</div>
      )}

      <div className="flex justify-between">
        {isEdit ? (
          <button
            type="button"
            onClick={onDelete}
            className="rounded-lg border border-red-300 bg-white px-4 py-2 text-sm text-red-700 hover:bg-red-50"
          >
            {t('common.delete')}
          </button>
        ) : <span />}
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => router.back()}
            className="rounded-lg border border-border px-4 py-2 text-sm"
          >
            {t('common.cancel')}
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-60"
          >
            {submitting ? t('common.loading') : t('common.save')}
          </button>
        </div>
      </div>
    </form>
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
