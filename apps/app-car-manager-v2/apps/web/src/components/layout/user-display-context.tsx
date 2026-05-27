'use client';

import { createContext, useContext, useMemo, type ReactNode } from 'react';
import type { LocalRole } from '@car-v2/shared/auth';

/* Per-user display state for client components. Mirrors `TenantDisplayProvider`
 * but for the signed-in user — name + email + computed initials + a
 * deterministic colour palette index. Used by `<MeAvatarLink>` (mobile
 * header) and any future client surface that wants to render the avatar
 * without re-fetching the JWT or pulling props through three layers. */
interface UserDisplayState {
  /** Resolved display name. Falls back to email local-part or "User". */
  name: string;
  email: string | null;
  /** Local app role (ADMIN | MANAGER | DRIVER) — needed by client surfaces
   * that branch on role (e.g. user-guide drawer picks admin/ vs driver/
   * docs). Mirrors the JWT `localRole` resolution. */
  role: LocalRole;
  /** 1–2 char uppercase initials for the avatar circle. */
  initials: string;
  /** Tailwind background + foreground class pair, e.g.
   * `{ bg: 'bg-accent', fg: 'text-accent-fg' }`. Deterministic — same
   * user always gets the same colour so the avatar reads as identity
   * rather than chrome. */
  color: { bg: string; fg: string };
  /** Server-counted unread inbox notifications for THIS user. Drives the
   * red badge on the header bell. 0 hides the badge. Refreshes on every
   * route navigation (server re-renders AppShell). */
  unreadNotifications: number;
}

const UserDisplayContext = createContext<UserDisplayState | null>(null);

interface UserDisplayProviderProps {
  /** Display name from AMA JWT (`claims.name`). Optional — falls back to email. */
  userName: string | null;
  /** Email from AMA JWT (`claims.email`). Optional — falls back to "User". */
  userEmail: string | null;
  /** Mapped local role from JWT (ADMIN | MANAGER | DRIVER). */
  role: LocalRole;
  /** Server-counted unread inbox notifications (from car_notifications). 0
   * when the user has no pending notifications. */
  unreadNotifications: number;
  children: ReactNode;
}

export function UserDisplayProvider({
  userName,
  userEmail,
  role,
  unreadNotifications,
  children,
}: UserDisplayProviderProps) {
  const value = useMemo<UserDisplayState>(() => {
    const name = userName?.trim() || userEmail?.split('@')[0] || 'User';
    return {
      name,
      email: userEmail,
      role,
      initials: deriveInitials(name),
      color: pickColor(userEmail ?? userName ?? name),
      unreadNotifications,
    };
  }, [userName, userEmail, role, unreadNotifications]);
  return <UserDisplayContext.Provider value={value}>{children}</UserDisplayContext.Provider>;
}

export function useUserDisplay(): UserDisplayState {
  const ctx = useContext(UserDisplayContext);
  if (!ctx) {
    throw new Error('useUserDisplay must be used inside <UserDisplayProvider>');
  }
  return ctx;
}

/* "Park Joon-ho" → "PJ"; "demo@x.com" → "DE"; "" → "?". Same shape as
 * the tenant deriveInitials() — kept duplicated (instead of imported)
 * so the user provider stays standalone from tenant concerns. */
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

/* 8-colour palette picked from the design-system tokens so every user
 * lands on a brand-coherent hue regardless of name. Deterministic hash
 * of a stable identity field (email preferred over name — name can
 * change, email is the AMA primary key) maps to one slot, so the same
 * user always sees the same colour across reloads / devices. */
const PALETTE: ReadonlyArray<{ bg: string; fg: string }> = [
  { bg: 'bg-accent',         fg: 'text-accent-fg' },
  { bg: 'bg-info',           fg: 'text-info-fg' },
  { bg: 'bg-success',        fg: 'text-success-fg' },
  { bg: 'bg-warning',        fg: 'text-warning-fg' },
  { bg: 'bg-danger',         fg: 'text-danger-fg' },
  { bg: 'bg-primary',        fg: 'text-primary-fg' },
  { bg: 'bg-text',           fg: 'text-bg' },
  { bg: 'bg-text-muted',     fg: 'text-bg' },
];

function pickColor(seed: string): { bg: string; fg: string } {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = ((hash << 5) - hash + seed.charCodeAt(i)) | 0;
  }
  const slot = Math.abs(hash) % PALETTE.length;
  return PALETTE[slot] ?? PALETTE[0]!;
}
