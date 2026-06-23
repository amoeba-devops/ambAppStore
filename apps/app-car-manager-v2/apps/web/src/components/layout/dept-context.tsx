'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import type { LocalRole } from '@car-v2/shared/auth';
import { DeptThemeEffect } from './dept-theme-effect';
import { clearlyDept, type FleetDept } from './nav-items';

/* Persisted active workspace. Client-readable (not HttpOnly) because the
 * sticky resolver runs in the browser; it carries no security decision — the
 * server always re-checks `requireFleet`/`resolveFleetAccess` on every action
 * and route. The cookie only remembers a UI preference across reloads. */
const COOKIE = 'ccms.fleet.dept';
const ONE_YEAR = 60 * 60 * 24 * 365;

const ActiveDeptContext = createContext<FleetDept>('CAR');

/**
 * The fleet workspace the user is currently in (CAR | TRUCK). Stays STICKY when
 * navigating to department-neutral pages (drivers/users/settings/audit), so the
 * sidebar, dept switch and theme no longer "jump" back to car (BUG-20260622).
 */
export function useActiveDept(): FleetDept {
  return useContext(ActiveDeptContext);
}

function persist(dept: FleetDept): void {
  try {
    document.cookie = `${COOKIE}=${dept};path=/;max-age=${ONE_YEAR};samesite=lax`;
  } catch {
    /* document.cookie unavailable (SSR/incognito edge) — ignore. */
  }
}

/** Can the user actually enter this department? Drivers/managers are limited to
 * their granted memberships; the resolver never parks them in a dept they lack. */
function canEnter(dept: FleetDept, hasCar: boolean, hasTruck: boolean): boolean {
  return dept === 'TRUCK' ? hasTruck : hasCar;
}

interface DeptProviderProps {
  role: LocalRole;
  /** Departments the user may enter (ADMIN → both; others → membership rows). */
  fleetAccess: FleetDept[];
  /** Server-resolved seed (cookie clamped to access) so the first client paint
   * matches SSR and there is no flash of the wrong workspace. */
  initialDept: FleetDept;
  children: React.ReactNode;
}

/**
 * Owns the active-workspace state for the whole app shell and applies the
 * matching department theme. Resolution rules:
 *   - DRIVER  → locked to their single membership (they never switch).
 *   - STAFF   → a department-specific URL (`/truck/*`, `/dashboard`, `/trips`…)
 *               sets + persists the workspace; a neutral URL keeps the last one.
 *
 * Because the `(app)` layout persists across client navigations, this MUST be a
 * client component reacting to `usePathname()` — a server-computed value would
 * go stale on the next `<Link>` click.
 */
export function DeptProvider({ role, fleetAccess, initialDept, children }: DeptProviderProps) {
  const pathname = usePathname() ?? '/';
  const hasCar = fleetAccess.includes('CAR');
  const hasTruck = fleetAccess.includes('TRUCK');

  const [dept, setDept] = useState<FleetDept>(() => {
    if (role === 'DRIVER') return hasTruck ? 'TRUCK' : 'CAR';
    const pd = clearlyDept(pathname);
    return pd && canEnter(pd, hasCar, hasTruck) ? pd : initialDept;
  });

  useEffect(() => {
    if (role === 'DRIVER') {
      const locked: FleetDept = hasTruck ? 'TRUCK' : 'CAR';
      setDept((prev) => (prev === locked ? prev : locked));
      return;
    }
    const pd = clearlyDept(pathname);
    if (pd && canEnter(pd, hasCar, hasTruck)) {
      setDept((prev) => {
        if (prev === pd) return prev;
        persist(pd);
        return pd;
      });
    }
    /* Neutral path → keep the current sticky workspace (no change). */
  }, [pathname, role, hasCar, hasTruck]);

  return (
    <ActiveDeptContext.Provider value={dept}>
      <DeptThemeEffect dept={dept} />
      {children}
    </ActiveDeptContext.Provider>
  );
}
