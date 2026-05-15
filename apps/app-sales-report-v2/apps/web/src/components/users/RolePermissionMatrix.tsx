'use client';

import { useEffect, useState } from 'react';
import { Check, Minus, RotateCcw, Lock } from 'lucide-react';
import { cn } from '@v2/ui';
import { appendActionLog } from '@/lib/action-log-mock';

type Role = 'OPERATOR' | 'MANAGER' | 'ADMIN';

interface Permission {
  key: string;
  label: string;
  defaults: Record<Role, boolean>;
}

/** Keep `key` stable — defaults seeded from spec. Admin always retains all. */
const PERMISSIONS: Permission[] = [
  { key: 'upload', label: 'Upload CSV files', defaults: { OPERATOR: true, MANAGER: false, ADMIN: true } },
  { key: 'manual', label: 'Input / edit manual data', defaults: { OPERATOR: true, MANAGER: false, ADMIN: true } },
  { key: 'view_reports', label: 'View reports', defaults: { OPERATOR: true, MANAGER: true, ADMIN: true } },
  { key: 'download_reports', label: 'Download reports', defaults: { OPERATOR: true, MANAGER: true, ADMIN: true } },
  { key: 'edit_prime_cost', label: 'Edit Prime Cost / COGS', defaults: { OPERATOR: true, MANAGER: false, ADMIN: true } },
  { key: 'view_activity_log', label: 'View Activity Log', defaults: { OPERATOR: false, MANAGER: true, ADMIN: true } },
  { key: 'manage_users', label: 'Manage users', defaults: { OPERATOR: false, MANAGER: false, ADMIN: true } },
  { key: 'configure_formulas', label: 'Configure formulas', defaults: { OPERATOR: false, MANAGER: false, ADMIN: true } },
];

const ROLES: Role[] = ['OPERATOR', 'MANAGER', 'ADMIN'];
const STORAGE_KEY = 'role-permissions-overrides';

type OverrideMap = Partial<Record<string, Partial<Record<Role, boolean>>>>;

function readOverrides(): OverrideMap {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function writeOverrides(map: OverrideMap): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  } catch {
    // ignore
  }
}

export function RolePermissionMatrix() {
  const [overrides, setOverrides] = useState<OverrideMap>({});
  const [lastEdited, setLastEdited] = useState<{ at: string; by: string } | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  useEffect(() => {
    setOverrides(readOverrides());
    try {
      const raw = localStorage.getItem(`${STORAGE_KEY}-meta`);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed?.at && parsed?.by) setLastEdited(parsed);
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    if (!feedback) return;
    const t = setTimeout(() => setFeedback(null), 2000);
    return () => clearTimeout(t);
  }, [feedback]);

  const resolve = (key: string, role: Role): boolean => {
    const ov = overrides[key]?.[role];
    if (typeof ov === 'boolean') return ov;
    return PERMISSIONS.find((p) => p.key === key)!.defaults[role];
  };

  const isDirty = (key: string, role: Role): boolean => {
    const ov = overrides[key]?.[role];
    if (typeof ov !== 'boolean') return false;
    return ov !== PERMISSIONS.find((p) => p.key === key)!.defaults[role];
  };

  const toggle = (perm: Permission, role: Role) => {
    if (role === 'ADMIN') return; // Admin column is locked — Admin always has all permissions
    const current = resolve(perm.key, role);
    const next = !current;
    const map: OverrideMap = { ...overrides };
    if (!map[perm.key]) map[perm.key] = {};
    map[perm.key]![role] = next;
    setOverrides(map);
    writeOverrides(map);

    const now = new Date().toISOString();
    const by = 'dev@amoeba.group';
    setLastEdited({ at: now, by });
    try {
      localStorage.setItem(`${STORAGE_KEY}-meta`, JSON.stringify({ at: now, by }));
    } catch {
      // ignore
    }

    appendActionLog({
      username: by,
      userRole: 'ADMIN',
      category: 'OTHER',
      verb: next ? 'GRANT' : 'REVOKE',
      targetType: 'permission',
      targetLabel: `${role} · ${perm.label}`,
      summary: `${next ? 'Granted' : 'Revoked'} "${perm.label}" for ${role}`,
      metadata: { permissionKey: perm.key, role, value: next },
    });

    setFeedback(`${next ? 'Granted' : 'Revoked'} "${perm.label}" for ${role}`);
  };

  const resetAll = () => {
    if (Object.keys(overrides).length === 0) return;
    if (!confirm('Reset all role permissions to defaults? This will discard your overrides.')) return;
    setOverrides({});
    writeOverrides({});
    const now = new Date().toISOString();
    const by = 'dev@amoeba.group';
    setLastEdited({ at: now, by });
    try {
      localStorage.setItem(`${STORAGE_KEY}-meta`, JSON.stringify({ at: now, by }));
    } catch {
      // ignore
    }
    appendActionLog({
      username: by,
      userRole: 'ADMIN',
      category: 'OTHER',
      verb: 'RESET',
      targetType: 'permission',
      targetLabel: 'Role Permission Matrix',
      summary: 'Reset all role permissions to defaults',
    });
    setFeedback('All permissions reset to defaults');
  };

  const hasOverrides = Object.values(overrides).some(
    (v) => v && Object.keys(v).length > 0,
  );

  return (
    <div className="rounded-lg border border-neutral-200 bg-white">
      <div className="flex items-start justify-between gap-3 border-b border-neutral-100 px-5 py-4">
        <div>
          <h2 className="text-base font-semibold text-neutral-900">Role Permission Matrix</h2>
          <p className="mt-0.5 text-xs text-neutral-500">
            Click a cell to toggle. Admin column is locked — Admin always retains all permissions.
            {lastEdited && (
              <>
                {' · '}Last edited{' '}
                <span className="font-mono text-neutral-700">{fmtDateTime(lastEdited.at)}</span>{' '}
                by <span className="font-mono text-neutral-700">{lastEdited.by}</span>
              </>
            )}
          </p>
        </div>
        {hasOverrides && (
          <button
            type="button"
            onClick={resetAll}
            className="inline-flex items-center gap-1 rounded-md border border-neutral-300 bg-white px-2.5 py-1 text-xs font-medium text-neutral-700 hover:bg-neutral-50 shrink-0"
          >
            <RotateCcw className="h-3 w-3" />
            Reset to defaults
          </button>
        )}
      </div>

      {feedback && (
        <div className="mx-5 mt-3 rounded-md border border-success-500 bg-success-50 px-3 py-2 text-xs text-success-500">
          {feedback}
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-neutral-50 text-xs uppercase tracking-wider text-neutral-500">
            <tr>
              <th className="px-5 py-2.5 text-left font-medium">Permission</th>
              {ROLES.map((r) => (
                <th key={r} className="px-5 py-2.5 text-center font-medium">
                  <div className="inline-flex items-center justify-center gap-1">
                    <span>{r[0] + r.slice(1).toLowerCase()}</span>
                    {r === 'ADMIN' && <Lock className="h-3 w-3 text-neutral-400" />}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {PERMISSIONS.map((p) => (
              <tr key={p.key} className="hover:bg-neutral-50/60">
                <td className="px-5 py-3 text-neutral-700">{p.label}</td>
                {ROLES.map((r) => {
                  const allowed = resolve(p.key, r);
                  const dirty = isDirty(p.key, r);
                  const locked = r === 'ADMIN';
                  return (
                    <td key={r} className="px-5 py-3 text-center">
                      <button
                        type="button"
                        onClick={() => toggle(p, r)}
                        disabled={locked}
                        title={
                          locked
                            ? 'Admin always retains all permissions'
                            : allowed
                              ? `Revoke for ${r}`
                              : `Grant for ${r}`
                        }
                        className={cn(
                          'inline-flex h-6 w-6 items-center justify-center rounded-full transition-colors',
                          allowed
                            ? 'bg-success-50 text-success-500'
                            : 'bg-neutral-50 text-neutral-300',
                          !locked && 'hover:ring-2 hover:ring-info-500/30 cursor-pointer',
                          locked && 'cursor-not-allowed opacity-90',
                          dirty && 'ring-2 ring-warning-500/40',
                        )}
                      >
                        {allowed ? (
                          <Check className="h-3.5 w-3.5" />
                        ) : (
                          <Minus className="h-3.5 w-3.5" />
                        )}
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function fmtDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
