'use client';

import { useCallback, useEffect, useRef } from 'react';

/* sessionStorage-backed form draft persistence.
 *
 * Why: when a Trip form user follows a conflict-banner link to another trip,
 * the conflict link now opens in the SAME tab (PWA-friendly), so without a
 * draft mechanism the user would lose their in-progress form values.
 *
 * Why sessionStorage (not localStorage):
 *   - same-origin, same-tab: drafts auto-discard when the tab closes
 *   - drafts don't leak between users sharing a browser
 *   - drafts don't survive across separate sessions (privacy + staleness)
 *
 * Lifecycle:
 *   1. mount  → read JSON from sessionStorage[key] (if any), call `hydrate(values)`
 *   2. change → on every `state` change, debounce 500ms then write JSON
 *   3. submit success → caller invokes `clearDraft()` to remove the saved value
 *
 * Tab-close behaviour: sessionStorage entries are scoped to the tab; closing
 * the tab discards the draft automatically — no cleanup needed.
 *
 * Multi-tab safety: each tab has its own sessionStorage, so two parallel
 * trip-new tabs do not collide.
 */
export function useFormPersistence<T extends Record<string, unknown>>(
  key: string,
  state: T,
  hydrate: (values: Partial<T>) => void,
): { clearDraft: () => void } {
  const hydrated = useRef(false);
  const hydrateRef = useRef(hydrate);
  /* Keep hydrate stable across renders without making the caller memoise it. */
  hydrateRef.current = hydrate;

  /* Hydrate once on mount (client only — sessionStorage isn't in SSR). */
  useEffect(() => {
    if (hydrated.current) return;
    hydrated.current = true;
    try {
      const raw = sessionStorage.getItem(key);
      if (!raw) return;
      const parsed = JSON.parse(raw) as Partial<T>;
      if (parsed && typeof parsed === 'object') hydrateRef.current(parsed);
    } catch {
      /* Corrupt JSON, quota error, or sessionStorage blocked — silent fallback. */
    }
  }, [key]);

  /* Serialise state to a stable string so the effect doesn't fire on every
   * parent re-render that produces a new object reference with identical
   * contents. JSON.stringify is cheap for the ~10 field trip form. */
  const serialised = JSON.stringify(state);

  useEffect(() => {
    if (!hydrated.current) return;
    const timer = setTimeout(() => {
      try {
        sessionStorage.setItem(key, serialised);
      } catch {
        /* Quota exceeded or storage disabled — silent. */
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [key, serialised]);

  const clearDraft = useCallback(() => {
    try {
      sessionStorage.removeItem(key);
    } catch {
      /* Silent. */
    }
  }, [key]);

  return { clearDraft };
}
