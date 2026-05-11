'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/navigation';
import { apiFetch, ClientApiError } from '@/lib/client/api';
import type { Driver, DriverStatus, User } from '@repo/api-types';

const STATUSES: DriverStatus[] = ['ACTIVE', 'INACTIVE'];

type Props = {
  initial?: Partial<Driver>;
  users: User[];
  isEdit?: boolean;
  driverId?: string;
};

export function DriverForm({ initial, users, isEdit = false, driverId }: Props) {
  const t = useTranslations();
  const router = useRouter();

  const [fullName, setFullName] = useState(initial?.fullName ?? '');
  const [licenseNumber, setLicenseNumber] = useState(initial?.licenseNumber ?? '');
  const [licenseClass, setLicenseClass] = useState(initial?.licenseClass ?? '');
  const [licenseExpiryDate, setLicenseExpiryDate] = useState(initial?.licenseExpiryDate ?? '');
  const [phone, setPhone] = useState(initial?.phone ?? '');
  const [userId, setUserId] = useState(initial?.userId ?? '');
  const [status, setStatus] = useState<DriverStatus>(initial?.status ?? 'ACTIVE');

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const payload = {
        fullName,
        licenseNumber,
        licenseClass: licenseClass || undefined,
        licenseExpiryDate,
        phone: phone || undefined,
        userId: userId || undefined,
        status,
      };
      if (isEdit && driverId) {
        await apiFetch(`/api/drivers/${driverId}`, {
          method: 'PATCH',
          body: JSON.stringify(payload),
        });
        router.push('/drivers');
      } else {
        await apiFetch<Driver>('/api/drivers', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        router.push('/drivers');
      }
    } catch (err) {
      if (err instanceof ClientApiError) setError(`${err.code}: ${err.message}`);
      else setError('Save failed');
    } finally {
      setSubmitting(false);
    }
  }

  async function onDelete() {
    if (!isEdit || !driverId) return;
    if (!confirm('Delete this driver? Trips referencing it will fail.')) return;
    try {
      await apiFetch(`/api/drivers/${driverId}`, { method: 'DELETE' });
      router.push('/drivers');
    } catch (err) {
      if (err instanceof ClientApiError) setError(`${err.code}: ${err.message}`);
    }
  }

  // Filter users not yet linked (only DRIVER role makes sense)
  const driverUsers = users.filter((u) => u.role === 'DRIVER');

  return (
    <form onSubmit={onSubmit} className="space-y-5 rounded-2xl border border-border bg-background p-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Full name">
          <input
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
            required
          />
        </Field>
        <Field label="License number">
          <input
            value={licenseNumber}
            onChange={(e) => setLicenseNumber(e.target.value)}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 font-mono text-sm uppercase"
            required
          />
        </Field>
        <Field label="License class (optional)">
          <input
            value={licenseClass ?? ''}
            onChange={(e) => setLicenseClass(e.target.value)}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
            placeholder="B2"
          />
        </Field>
        <Field label="License expiry">
          <input
            type="date"
            value={licenseExpiryDate}
            onChange={(e) => setLicenseExpiryDate(e.target.value)}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
            required
          />
        </Field>
        <Field label="Phone">
          <input
            type="tel"
            value={phone ?? ''}
            onChange={(e) => setPhone(e.target.value)}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
          />
        </Field>
        <Field label="Linked user account (optional)">
          <select
            value={userId ?? ''}
            onChange={(e) => setUserId(e.target.value)}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
          >
            <option value="">— none —</option>
            {driverUsers.map((u) => (
              <option key={u.id} value={u.id}>
                {u.fullName} ({u.email})
              </option>
            ))}
          </select>
        </Field>
        <Field label="Status">
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as DriverStatus)}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
            required
          >
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
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
          <button type="button" onClick={() => router.back()} className="rounded-lg border border-border px-4 py-2 text-sm">
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
