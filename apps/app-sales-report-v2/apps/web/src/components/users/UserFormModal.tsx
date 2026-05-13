'use client';

import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { cn } from '@v2/ui';
import { updateUserAction, inviteUserAction, type UserRow } from '@/server/actions/user.actions';

const ROLES = ['OPERATOR', 'MANAGER', 'ADMIN'] as const;
type Role = (typeof ROLES)[number];

interface Props {
  open: boolean;
  mode: 'add' | 'edit';
  initial: UserRow | null;
  onClose: () => void;
  onSaved: () => void;
}

export function UserFormModal({ open, mode, initial, onClose, onSaved }: Props) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<Role>('OPERATOR');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Mock AMA members (usrId starts with `mock-ama-`) aren't in the DB yet —
  // editing them really means "import + assign role" → route to invite.
  const isMockAmaImport =
    mode === 'edit' && initial != null && initial.usrId.startsWith('mock-ama-');

  useEffect(() => {
    if (open) {
      setName(initial?.name ?? '');
      setEmail(initial?.email ?? '');
      const r = (initial?.role as Role | 'UNASSIGNED') ?? 'OPERATOR';
      setRole(r === 'UNASSIGNED' ? 'OPERATOR' : (r as Role));
      setError(null);
    }
  }, [open, initial]);

  if (!open) return null;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if ((mode === 'add' || isMockAmaImport) && !email) {
      setError('Email is required');
      return;
    }
    setSubmitting(true);
    const res =
      mode === 'edit' && initial && !isMockAmaImport
        ? await updateUserAction({ usrId: initial.usrId, name: name || null, role })
        : await inviteUserAction({ email, name: name || undefined, role });
    setSubmitting(false);
    if (!res.success) {
      setError(res.error.message);
      return;
    }
    onSaved();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-900/40 p-4">
      <div className="w-full max-w-lg rounded-lg bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-neutral-200 px-6 py-4">
          <h2 className="text-lg font-semibold text-neutral-900">
            {isMockAmaImport ? 'Grant access — AMA member' : mode === 'add' ? 'Add user' : 'Edit user'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1.5 text-neutral-500 hover:bg-neutral-100"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={submit} className="space-y-4 px-6 py-5">
          {mode === 'add' && (
            <div className="rounded-md bg-info-50 px-3 py-2 text-xs text-info-500">
              Identity is managed by AMA. Pre-staged users will be linked to their real AMA
              account on their first login to this app.
            </div>
          )}
          {isMockAmaImport && (
            <div className="rounded-md bg-info-50 px-3 py-2 text-xs text-info-500">
              Granting <span className="font-mono">{email}</span> access to the app. Identity
              stays managed by AMA — picking a role here just records the local permission.
            </div>
          )}

          <label className="block">
            <span className="mb-1 block text-xs font-medium uppercase tracking-wider text-neutral-500">
              Email {mode === 'add' && '*'}
            </span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={mode === 'edit'}
              required={mode === 'add' || isMockAmaImport}
              placeholder="user@socialbean.vn"
              className={cn(
                'w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm placeholder:text-neutral-400 focus:border-neutral-500 focus:outline-none',
                mode === 'edit' && 'bg-neutral-100 text-neutral-500',
              )}
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-xs font-medium uppercase tracking-wider text-neutral-500">
              Name
            </span>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Truc Hoang"
              className="w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm placeholder:text-neutral-400 focus:border-neutral-500 focus:outline-none"
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-xs font-medium uppercase tracking-wider text-neutral-500">
              Role
            </span>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as Role)}
              className="w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm focus:border-neutral-500 focus:outline-none"
            >
              <option value="OPERATOR">Operator — upload files, edit data</option>
              <option value="MANAGER">Manager — view + approve</option>
              <option value="ADMIN">Admin — full control</option>
            </select>
          </label>

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
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800 disabled:opacity-50"
            >
              {submitting ? 'Saving…' : mode === 'add' ? 'Add user' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
