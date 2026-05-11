'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/navigation';
import { apiFetch, ClientApiError } from '@/lib/client/api';
import type { Language, Role, User, UserStatus } from '@repo/api-types';

const ROLES: Role[] = ['ADMIN', 'MANAGER', 'DRIVER'];
const LANGS: Language[] = ['en', 'ko', 'vi'];
const STATUSES: UserStatus[] = ['ACTIVE', 'DISABLED'];

type Props = {
  initial?: Partial<User>;
  isEdit?: boolean;
  userId?: string;
};

export function UserForm({ initial, isEdit = false, userId }: Props) {
  const t = useTranslations();
  const router = useRouter();

  const [email, setEmail] = useState(initial?.email ?? '');
  const [fullName, setFullName] = useState(initial?.fullName ?? '');
  const [position, setPosition] = useState(initial?.position ?? '');
  const [role, setRole] = useState<Role>(initial?.role ?? 'MANAGER');
  const [language, setLanguage] = useState<Language>(initial?.language ?? 'en');
  const [status, setStatus] = useState<UserStatus>(initial?.status ?? 'ACTIVE');
  const [password, setPassword] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      if (isEdit && userId) {
        await apiFetch(`/api/users/${userId}`, {
          method: 'PATCH',
          body: JSON.stringify({
            email,
            fullName,
            position: position || undefined,
            role,
            language,
            status,
            ...(password ? { newPassword: password } : {}),
          }),
        });
      } else {
        if (!password) {
          setError('Password is required');
          setSubmitting(false);
          return;
        }
        await apiFetch<User>('/api/users', {
          method: 'POST',
          body: JSON.stringify({
            email,
            password,
            fullName,
            position: position || undefined,
            role,
            language,
          }),
        });
      }
      router.push('/users');
    } catch (err) {
      if (err instanceof ClientApiError) setError(`${err.code}: ${err.message}`);
      else setError('Save failed');
    } finally {
      setSubmitting(false);
    }
  }

  async function onDelete() {
    if (!isEdit || !userId) return;
    if (!confirm('Delete this user? This cannot be undone.')) return;
    try {
      await apiFetch(`/api/users/${userId}`, { method: 'DELETE' });
      router.push('/users');
    } catch (err) {
      if (err instanceof ClientApiError) setError(`${err.code}: ${err.message}`);
    }
  }

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
        <Field label="Email">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
            required
            autoComplete="off"
          />
        </Field>
        <Field label={isEdit ? 'New password (leave blank to keep current)' : 'Password'}>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
            required={!isEdit}
            minLength={8}
            autoComplete="new-password"
          />
        </Field>
        <Field label="Position">
          <input
            value={position ?? ''}
            onChange={(e) => setPosition(e.target.value)}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
            placeholder="Director, Manager…"
          />
        </Field>
        <Field label="Role">
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as Role)}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
            required
          >
            {ROLES.map((r) => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>
        </Field>
        <Field label="Language">
          <select
            value={language}
            onChange={(e) => setLanguage(e.target.value as Language)}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
          >
            {LANGS.map((l) => (
              <option key={l} value={l}>{l.toUpperCase()}</option>
            ))}
          </select>
        </Field>
        {isEdit && (
          <Field label="Status">
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as UserStatus)}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
            >
              {STATUSES.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </Field>
        )}
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
