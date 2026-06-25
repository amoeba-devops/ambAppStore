'use client';

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';

/* Shared brand-header display state — both the tenant identity (initial
 * square + secondary "Tenant" line) and the primary app-name label.
 *
 * Server side resolves both names once on render and seeds this Client
 * provider:
 *   - tenantName: car_tenant_settings.tns_tenant_name → JWT.entityName → i18n
 *   - appName:    car_tenant_settings.tns_app_name    → i18n `appName`
 *
 * Settings → Admin can then push live updates per keystroke so the sidebar
 * brand header re-renders without waiting for the debounced server save or
 * a route revalidation. */
interface TenantDisplayState {
  /** Tenant name shown as the second line in the brand header. */
  name: string;
  /** Auto-derived 1–2 char initial label for the brand square. */
  initials: string;
  /** Update the tenant name. Pass empty/null → reverts to the default label. */
  setName: (next: string | null) => void;
  /** App name shown as the primary line in the brand header. */
  appName: string;
  /** Update the app name. Pass empty/null → reverts to the default app name. */
  setAppName: (next: string | null) => void;
}

const TenantDisplayContext = createContext<TenantDisplayState | null>(null);

interface TenantDisplayProviderProps {
  /** Initial tenant name resolved server-side. */
  initialName: string;
  /** Fallback when the user clears the tenant name back to "default". */
  defaultName: string;
  /** Initial app name resolved server-side (DB → i18n). */
  initialAppName: string;
  /** Fallback when the user clears the app name back to "default". */
  defaultAppName: string;
  children: ReactNode;
}

export function TenantDisplayProvider({
  initialName,
  defaultName,
  initialAppName,
  defaultAppName,
  children,
}: TenantDisplayProviderProps) {
  const [name, setNameState] = useState(initialName);
  const [appName, setAppNameState] = useState(initialAppName);

  const setName = useCallback(
    (next: string | null) => {
      const trimmed = next?.trim() ?? '';
      setNameState(trimmed === '' ? defaultName : trimmed);
    },
    [defaultName],
  );

  const setAppName = useCallback(
    (next: string | null) => {
      const trimmed = next?.trim() ?? '';
      setAppNameState(trimmed === '' ? defaultAppName : trimmed);
    },
    [defaultAppName],
  );

  const value = useMemo<TenantDisplayState>(
    () => ({
      name,
      initials: deriveInitials(name),
      setName,
      appName,
      setAppName,
    }),
    [name, setName, appName, setAppName],
  );

  return <TenantDisplayContext.Provider value={value}>{children}</TenantDisplayContext.Provider>;
}

export function useTenantDisplay(): TenantDisplayState {
  const ctx = useContext(TenantDisplayContext);
  if (!ctx) {
    throw new Error('useTenantDisplay must be used inside <TenantDisplayProvider>');
  }
  return ctx;
}

/* "HanaTech Vietnam" → "HV"; "Acme" → "AC"; "" → "?".
 * Words split on whitespace; multi-word picks first+last, single word picks
 * its first two letters. Uppercased for the avatar-square treatment. */
function deriveInitials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '?';
  if (words.length === 1) {
    const w = words[0] ?? '';
    return w.slice(0, 2).toUpperCase();
  }
  const first = words[0] ?? '';
  const last = words[words.length - 1] ?? '';
  return ((first[0] ?? '') + (last[0] ?? '')).toUpperCase();
}
