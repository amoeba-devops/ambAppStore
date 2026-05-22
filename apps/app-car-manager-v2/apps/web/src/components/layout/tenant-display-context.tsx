'use client';

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';

/* Shared tenant display name across the app shell.
 *
 * Server side resolves the name once on render (DB → JWT → i18n default) and
 * seeds this Client provider. Settings -> Admin can then push live updates
 * here (per keystroke) so the sidebar header re-renders without waiting for
 * the debounced server save / route revalidation. */
interface TenantDisplayState {
  /** The name currently shown in the sidebar/header. */
  name: string;
  /** Auto-derived 1–2 char initial label for the brand square. */
  initials: string;
  /** Update the display name. Pass empty/null → reverts to the default label. */
  setName: (next: string | null) => void;
}

const TenantDisplayContext = createContext<TenantDisplayState | null>(null);

interface TenantDisplayProviderProps {
  /** Initial display name resolved server-side. */
  initialName: string;
  /** Fallback when the user clears the name back to "default". */
  defaultName: string;
  children: ReactNode;
}

export function TenantDisplayProvider({
  initialName,
  defaultName,
  children,
}: TenantDisplayProviderProps) {
  const [name, setNameState] = useState(initialName);

  const setName = useCallback(
    (next: string | null) => {
      const trimmed = next?.trim() ?? '';
      setNameState(trimmed === '' ? defaultName : trimmed);
    },
    [defaultName],
  );

  const value = useMemo<TenantDisplayState>(
    () => ({
      name,
      initials: deriveInitials(name),
      setName,
    }),
    [name, setName],
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
