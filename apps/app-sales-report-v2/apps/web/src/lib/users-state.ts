/**
 * Client-side overrides for mock AMA members (those with `usrId` starting with
 * `mock-ama-`). Lets the Admin grant access + activate / deactivate without
 * hitting the real DB during demo. Once the real `sal_users` table is
 * populated, swap these calls for the server actions in `user.actions.ts`.
 */

import { useEffect, useMemo, useState } from 'react';
import type { UserRow, UserRowRole } from '@/server/actions/user.actions';
import { appendActionLog } from './action-log-mock';

const STORAGE_KEY = 'users-mock-state';
const CHANGE_EVENT = 'users-mock-state-change';
const CURRENT_ADMIN = 'dev@amoeba.group';

export interface UserOverride {
  /** Replaces the seed name if set. */
  name?: string;
  /** Replaces the seed role (UNASSIGNED, OPERATOR, MANAGER, ADMIN). */
  role?: UserRowRole;
  /** Replaces the seed status. */
  status?: 'ACTIVE' | 'INACTIVE';
  grantedAt?: string;
  grantedBy?: string;
  lastLoginAt?: string;
  loginCount?: number;
}

type OverrideMap = Record<string, UserOverride>; // keyed by mock usrId

function readMap(): OverrideMap {
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

function writeMap(map: OverrideMap): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
    window.dispatchEvent(new CustomEvent(CHANGE_EVENT));
  } catch {
    // ignore
  }
}

export function isMockUserId(usrId: string): boolean {
  return usrId.startsWith('mock-ama-');
}

function applyOverride(member: UserRow): UserRow {
  const map = readMap();
  const o = map[member.usrId];
  if (!o) return member;
  return {
    ...member,
    name: o.name ?? member.name,
    role: o.role ?? member.role,
    status: o.status ?? member.status,
    lastLoginAt: o.lastLoginAt ?? member.lastLoginAt,
    loginCount: o.loginCount ?? member.loginCount,
  };
}

/**
 * Grant a role + set status for a mock AMA member in one shot. Matches the
 * 1-step "pick role, set status, save" UX the spec calls for.
 */
export function grantMockAccess(
  member: UserRow,
  payload: {
    name: string | null;
    role: Exclude<UserRowRole, 'UNASSIGNED'>;
    status: 'ACTIVE' | 'INACTIVE';
  },
): void {
  const map = readMap();
  const now = new Date().toISOString();
  const previous = map[member.usrId];
  map[member.usrId] = {
    ...(previous ?? {}),
    name: payload.name ?? member.name ?? undefined,
    role: payload.role,
    status: payload.status,
    grantedAt: now,
    grantedBy: CURRENT_ADMIN,
    // Seed a login timestamp on first activation (mock proxy for "synced from AMA")
    lastLoginAt:
      payload.status === 'ACTIVE'
        ? (previous?.lastLoginAt ?? now)
        : (previous?.lastLoginAt ?? null) ?? undefined,
    loginCount: previous?.loginCount ?? 0,
  };
  writeMap(map);
  const statusLabel = payload.status === 'ACTIVE' ? 'active' : 'inactive';
  appendActionLog({
    username: CURRENT_ADMIN,
    userRole: 'ADMIN',
    category: 'OTHER',
    verb: 'GRANT',
    targetType: 'user',
    targetLabel: member.email ?? member.usrId,
    summary: `Granted ${payload.role} access to ${member.email ?? member.usrId} (${statusLabel})`,
    metadata: { usrId: member.usrId, role: payload.role, status: payload.status },
  });
}

/** Toggle status of a mock user (Activate / Deactivate). */
export function setMockUserStatus(
  member: UserRow,
  status: 'ACTIVE' | 'INACTIVE',
): void {
  const map = readMap();
  const now = new Date().toISOString();
  map[member.usrId] = {
    ...(map[member.usrId] ?? {}),
    status,
    // When activating for the first time, simulate a login timestamp
    ...(status === 'ACTIVE' && !map[member.usrId]?.lastLoginAt
      ? { lastLoginAt: now, loginCount: 0 }
      : {}),
  };
  writeMap(map);
  appendActionLog({
    username: CURRENT_ADMIN,
    userRole: 'ADMIN',
    category: 'OTHER',
    verb: status === 'ACTIVE' ? 'ACTIVATE' : 'DEACTIVATE',
    targetType: 'user',
    targetLabel: member.email ?? member.usrId,
    summary: `${status === 'ACTIVE' ? 'Activated' : 'Deactivated'} ${member.email ?? member.usrId}`,
    metadata: { usrId: member.usrId, status },
  });
}

/** React hook returning mock members with overrides applied, reactive to changes. */
export function useEffectiveMockMembers(seed: UserRow[]): UserRow[] {
  const [tick, setTick] = useState(0);
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
    const bump = () => setTick((t) => t + 1);
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) bump();
    };
    window.addEventListener('storage', onStorage);
    window.addEventListener(CHANGE_EVENT, bump);
    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener(CHANGE_EVENT, bump);
    };
  }, []);
  return useMemo(
    () => (mounted ? seed.map(applyOverride) : seed),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [seed, tick, mounted],
  );
}
