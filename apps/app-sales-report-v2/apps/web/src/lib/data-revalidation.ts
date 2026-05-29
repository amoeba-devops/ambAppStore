'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Cross-tab data revalidation channel.
 *
 * Server Actions invalidate the server-rendered output via `revalidatePath`
 * — that handles same-tab freshness when the user navigates. But when the
 * user has TWO tabs open (e.g. Product List in tab A, Prime Cost in tab B),
 * mutating in A does NOT automatically refresh B. The user had to F5.
 *
 * We use the BroadcastChannel API to publish a small "scope changed"
 * message after each mutation. Other tabs listening on the matching scope
 * trigger `router.refresh()`, which re-fetches the RSC tree for their
 * current route. The server side has already been invalidated by
 * `revalidatePath` in the same action, so the refresh gets fresh data.
 *
 * Scope names should match the data domain, not the page route, because
 * one mutation can affect multiple routes (editing a Prime Cost master
 * row updates 4 pages).
 */
export type RevalidationScope =
  | 'cost-master' // sal_prime_costs + 3 version tables → 4 RFR Data pages
  | 'period-snapshot' // sal_period_snapshots → Weekly / Monthly / Trends / Dashboard
  | 'archive' // sal_archive_files → Raw Archive list + detail
  | 'action-log' // sal_action_logs → Activity Log
  | 'user'; // sal_users → User Management

const CHANNEL_NAME = 'firgi-data-revalidation';

interface RevalidationMessage {
  scope: RevalidationScope;
  /** Optional origin tag so we don't pingpong a tab against itself. */
  origin?: string;
}

let channel: BroadcastChannel | null = null;

function getChannel(): BroadcastChannel | null {
  if (typeof window === 'undefined') return null;
  if (typeof BroadcastChannel === 'undefined') return null; // Old browsers
  if (channel == null) channel = new BroadcastChannel(CHANNEL_NAME);
  return channel;
}

// Random origin tag per tab — set once and reused across all posts.
const ORIGIN_TAG =
  typeof window !== 'undefined' && typeof crypto !== 'undefined'
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2);

/**
 * Publish that data in `scope` was mutated. Other tabs listening on this
 * scope will trigger their RSC refresh.
 */
export function broadcastMutation(scope: RevalidationScope): void {
  const ch = getChannel();
  if (!ch) return;
  const msg: RevalidationMessage = { scope, origin: ORIGIN_TAG };
  try {
    ch.postMessage(msg);
  } catch {
    /* channel may be closed (e.g., tab being unloaded) — ignore */
  }
}

/**
 * Hook: trigger `router.refresh()` whenever another tab publishes a
 * mutation in any of the given scopes. Own-tab broadcasts are ignored so
 * we don't double-refresh after our own mutation (the calling code is
 * expected to do its own refetch right after mutating).
 */
export function useRevalidateOnMutation(scopes: RevalidationScope[]): void {
  const router = useRouter();
  useEffect(() => {
    const ch = getChannel();
    if (!ch) return;
    const set = new Set(scopes);
    const handler = (e: MessageEvent<RevalidationMessage>) => {
      if (!e.data || !set.has(e.data.scope)) return;
      if (e.data.origin === ORIGIN_TAG) return; // Skip self
      router.refresh();
    };
    ch.addEventListener('message', handler);
    return () => ch.removeEventListener('message', handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scopes.join(','), router]);
}
