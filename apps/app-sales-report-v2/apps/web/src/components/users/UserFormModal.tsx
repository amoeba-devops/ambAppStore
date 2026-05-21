'use client';

import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { cn } from '@v2/ui';
import { updateUserAction, inviteUserAction, type UserRow } from '@/server/actions/user.actions';
import { grantMockAccess, isMockUserId } from '@/lib/users-state';

const ROLES = ['OPERATOR', 'MANAGER', 'ADMIN'] as const;
type Role = (typeof ROLES)[number];

interface Props {
  open: boolean;
  mode: 'add' | 'edit';
  initial: UserRow | null;
  onClose: () => void;
  onSaved: () => void;
}

type Status = 'ACTIVE' | 'INACTIVE';

export function UserFormModal({ open, mode, initial, onClose, onSaved }: Props) {
  const t = useTranslations('usersPage.form');
  const tCommon = useTranslations('common');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<Role>('OPERATOR');
  const [status, setStatus] = useState<Status>('ACTIVE');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Mock AMA members (usrId starts with `mock-ama-`) aren't in the DB yet —
  // editing them is purely client-side localStorage state.
  const isMockAmaImport =
    mode === 'edit' && initial != null && isMockUserId(initial.usrId);

  useEffect(() => {
    if (open) {
      setName(initial?.name ?? '');
      setEmail(initial?.email ?? '');
      const r = (initial?.role as Role | 'UNASSIGNED') ?? 'OPERATOR';
      setRole(r === 'UNASSIGNED' ? 'OPERATOR' : (r as Role));
      // Default Active when granting AMA member; keep current for edit; Active for new add
      const seedStatus = initial?.status as Status | undefined;
      setStatus(isMockAmaImport ? 'ACTIVE' : (seedStatus ?? 'ACTIVE'));
      setError(null);
    }
  }, [open, initial, isMockAmaImport]);

  if (!open) return null;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if ((mode === 'add' || isMockAmaImport) && !email) {
      setError(t('errorEmailRequired'));
      return;
    }
    setSubmitting(true);

    // Mock AMA grant — purely local, no DB hit
    if (isMockAmaImport && initial) {
      grantMockAccess(initial, { name: name || null, role, status });
      setSubmitting(false);
      onSaved();
      return;
    }

    const res =
      mode === 'edit' && initial
        ? await updateUserAction({ usrId: initial.usrId, name: name || null, role })
        : await inviteUserAction({ email, name: name || undefined, role });
    setSubmitting(false);
    if (!res.success) {
      setError(res.error.message);
      return;
    }
    onSaved();
  };

  const dialogTitle = isMockAmaImport
    ? t('titleGrantAma')
    : mode === 'add'
      ? t('titleAdd')
      : t('titleEdit');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-900/40 p-4">
      <div className="w-full max-w-lg rounded-lg bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-neutral-200 px-6 py-4">
          <h2 className="text-lg font-semibold text-neutral-900">{dialogTitle}</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1.5 text-neutral-500 hover:bg-neutral-100"
            aria-label={tCommon('close')}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={submit} className="space-y-4 px-6 py-5">
          {mode === 'add' && (
            <div className="rounded-md bg-info-50 px-3 py-2 text-xs text-info-500">
              {t('addNote')}
            </div>
          )}
          {isMockAmaImport && (
            <div className="rounded-md bg-info-50 px-3 py-2 text-xs text-info-500">
              {t.rich('grantAmaNote', {
                email,
                mono: (chunks) => <span className="font-mono">{chunks}</span>,
              })}
            </div>
          )}

          <label className="block">
            <span className="mb-1 block text-xs font-medium uppercase tracking-wider text-neutral-500">
              {t('labelEmail')} {mode === 'add' && '*'}
            </span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={mode === 'edit'}
              required={mode === 'add' || isMockAmaImport}
              placeholder={t('emailPlaceholder')}
              className={cn(
                'w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm placeholder:text-neutral-400 focus:border-neutral-500 focus:outline-none',
                mode === 'edit' && 'bg-neutral-100 text-neutral-500',
              )}
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-xs font-medium uppercase tracking-wider text-neutral-500">
              {t('labelName')}
            </span>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t('namePlaceholder')}
              className="w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm placeholder:text-neutral-400 focus:border-neutral-500 focus:outline-none"
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-xs font-medium uppercase tracking-wider text-neutral-500">
              {t('labelRole')}
            </span>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as Role)}
              className="w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm focus:border-neutral-500 focus:outline-none"
            >
              <option value="OPERATOR">{t('roleOption.operator')}</option>
              <option value="MANAGER">{t('roleOption.manager')}</option>
              <option value="ADMIN">{t('roleOption.admin')}</option>
            </select>
          </label>

          {isMockAmaImport && (
            <fieldset>
              <legend className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-neutral-500">
                {t('labelStatus')}
              </legend>
              <div className="grid grid-cols-2 gap-2">
                <label
                  className={cn(
                    'flex items-start gap-2 rounded-md border px-3 py-2 cursor-pointer transition-colors',
                    status === 'ACTIVE'
                      ? 'border-success-500 bg-success-500/5'
                      : 'border-neutral-300 bg-white hover:bg-neutral-50',
                  )}
                >
                  <input
                    type="radio"
                    name="status"
                    value="ACTIVE"
                    checked={status === 'ACTIVE'}
                    onChange={() => setStatus('ACTIVE')}
                    className="mt-0.5 accent-success-500"
                  />
                  <span>
                    <span className="block text-sm font-medium text-neutral-900">
                      {t('statusActive')}
                    </span>
                    <span className="block text-[11px] text-neutral-500">
                      {t('statusActiveDesc')}
                    </span>
                  </span>
                </label>
                <label
                  className={cn(
                    'flex items-start gap-2 rounded-md border px-3 py-2 cursor-pointer transition-colors',
                    status === 'INACTIVE'
                      ? 'border-neutral-900 bg-neutral-50'
                      : 'border-neutral-300 bg-white hover:bg-neutral-50',
                  )}
                >
                  <input
                    type="radio"
                    name="status"
                    value="INACTIVE"
                    checked={status === 'INACTIVE'}
                    onChange={() => setStatus('INACTIVE')}
                    className="mt-0.5 accent-neutral-700"
                  />
                  <span>
                    <span className="block text-sm font-medium text-neutral-900">
                      {t('statusInactive')}
                    </span>
                    <span className="block text-[11px] text-neutral-500">
                      {t('statusInactiveDesc')}
                    </span>
                  </span>
                </label>
              </div>
            </fieldset>
          )}

          {error && (
            <div className="rounded-md border border-error-500 bg-error-50 px-3 py-2 text-sm text-error-500">
              {error}
            </div>
          )}

          <div className="flex justify-end gap-2 border-t border-neutral-200 pt-4">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="rounded-md border border-neutral-300 bg-white px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50 disabled:opacity-50"
            >
              {tCommon('cancel')}
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800 disabled:opacity-50"
            >
              {submitting
                ? tCommon('saving')
                : mode === 'add'
                  ? t('submitAdd')
                  : t('submitSave')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
