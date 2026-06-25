'use client';

import { useEffect, useState } from 'react';
import { Check, Minus, RotateCcw, Lock } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { cn } from '@v2/ui';
import { appendActionLog } from '@/lib/action-log-mock';

type Role = 'OPERATOR' | 'MANAGER' | 'ADMIN';

interface Permission {
  key: string;
  /** i18n key under `usersPage.permissions.row.*` */
  labelKey: string;
  defaults: Record<Role, boolean>;
}

/** Keep `key` stable — defaults seeded from spec. Admin always retains all. */
const PERMISSIONS: Permission[] = [
  { key: 'upload', labelKey: 'upload', defaults: { OPERATOR: true, MANAGER: false, ADMIN: true } },
  { key: 'manual', labelKey: 'manual', defaults: { OPERATOR: true, MANAGER: false, ADMIN: true } },
  { key: 'view_reports', labelKey: 'view_reports', defaults: { OPERATOR: true, MANAGER: true, ADMIN: true } },
  { key: 'download_reports', labelKey: 'download_reports', defaults: { OPERATOR: true, MANAGER: true, ADMIN: true } },
  { key: 'edit_prime_cost', labelKey: 'edit_prime_cost', defaults: { OPERATOR: true, MANAGER: false, ADMIN: true } },
  { key: 'view_activity_log', labelKey: 'view_activity_log', defaults: { OPERATOR: false, MANAGER: true, ADMIN: true } },
  { key: 'manage_users', labelKey: 'manage_users', defaults: { OPERATOR: false, MANAGER: false, ADMIN: true } },
  { key: 'configure_formulas', labelKey: 'configure_formulas', defaults: { OPERATOR: false, MANAGER: false, ADMIN: true } },
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
  const t = useTranslations('usersPage.permissions');
  const tRole = useTranslations('role');
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
    const handle = setTimeout(() => setFeedback(null), 2000);
    return () => clearTimeout(handle);
  }, [feedback]);

  const roleLabel = (r: Role): string => {
    if (r === 'ADMIN') return tRole('admin');
    if (r === 'MANAGER') return tRole('manager');
    return tRole('operator');
  };

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

    const localizedLabel = t(`row.${perm.labelKey}`);
    appendActionLog({
      username: by,
      userRole: 'ADMIN',
      category: 'OTHER',
      verb: next ? 'GRANT' : 'REVOKE',
      targetType: 'permission',
      targetLabel: `${role} · ${localizedLabel}`,
      summary: `${next ? 'Granted' : 'Revoked'} "${localizedLabel}" for ${role}`,
      metadata: { permissionKey: perm.key, role, value: next },
    });

    setFeedback(
      next
        ? t('feedback.granted', { label: localizedLabel, role: roleLabel(role) })
        : t('feedback.revoked', { label: localizedLabel, role: roleLabel(role) }),
    );
  };

  const resetAll = () => {
    if (Object.keys(overrides).length === 0) return;
    if (!confirm(t('confirmReset'))) return;
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
    setFeedback(t('feedback.resetAll'));
  };

  const hasOverrides = Object.values(overrides).some(
    (v) => v && Object.keys(v).length > 0,
  );

  return (
    <div className="rounded-lg border border-neutral-200 bg-white">
      <div className="flex items-start justify-between gap-3 border-b border-neutral-100 px-5 py-4">
        <div>
          <h2 className="text-base font-semibold text-neutral-900">{t('title')}</h2>
          <p className="mt-0.5 text-xs text-neutral-500">
            {t('subtitle')}
            {lastEdited && (
              <>{t('lastEdited', { at: fmtDateTime(lastEdited.at), by: lastEdited.by })}</>
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
            {t('resetButton')}
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
              <th className="px-5 py-2.5 text-left font-medium">{t('permissionColHeader')}</th>
              {ROLES.map((r) => (
                <th key={r} className="px-5 py-2.5 text-center font-medium">
                  <div className="inline-flex items-center justify-center gap-1">
                    <span>{roleLabel(r)}</span>
                    {r === 'ADMIN' && <Lock className="h-3 w-3 text-neutral-400" />}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {PERMISSIONS.map((p) => (
              <tr key={p.key} className="hover:bg-neutral-50/60">
                <td className="px-5 py-3 text-neutral-700">{t(`row.${p.labelKey}`)}</td>
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
                            ? t('tooltip.adminLocked')
                            : allowed
                              ? t('tooltip.revokeFor', { role: roleLabel(r) })
                              : t('tooltip.grantFor', { role: roleLabel(r) })
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
