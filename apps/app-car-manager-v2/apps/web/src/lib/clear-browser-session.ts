/**
 * Wipe all client-side session state for this app's origin — called on logout.
 *
 * Clears:
 *   - `localStorage`   — form drafts (`ccms-draft:*` for trips/vehicles/expenses,
 *     new + edit), sidebar collapse, dashboard view/colour prefs, dismiss snoozes.
 *   - `sessionStorage` — trip view mode, in-progress form persistence, banner
 *     dismissals.
 *   - Cache API        — service-worker asset/runtime caches.
 *
 * Deliberately PRESERVED:
 *   - Notifications — the Service Worker registration (delivers push) and the
 *     Push subscription live in the browser's `PushManager` + the server
 *     `car_push_subscriptions` table, NOT in web storage, so a full storage
 *     wipe never disables notifications; the app re-detects the live
 *     subscription on next sign-in.
 *   - Language (i18n) — the chosen locale is the `NEXT_LOCALE` cookie (set by
 *     `setLocaleAction`), which neither this client wipe (cookies untouched)
 *     nor logout (clears only the auth cookies) removes, so the UI stays in the
 *     same language after signing back in. As defence-in-depth we also keep any
 *     locale/i18n key should one ever land in web storage (see PRESERVE_KEY).
 *
 * Embed-safe: when running inside the AMA iframe the app has its own origin, so
 * clearing here can't touch AMA's storage.
 */

/** Keys to keep across the wipe — anything locale / i18n related. Substring
 * match (not word-bounded) so common shapes like `i18nextLng`, `app.locale`,
 * `NEXT_LOCALE` are all retained. Over-keeping a stray pref is harmless. */
const PRESERVE_KEY = /(locale|i18n|lang)/i;

function clearPreserving(storage: Storage): void {
  const keep: Array<[string, string]> = [];
  for (let i = 0; i < storage.length; i++) {
    const k = storage.key(i);
    if (k && PRESERVE_KEY.test(k)) {
      const v = storage.getItem(k);
      if (v != null) keep.push([k, v]);
    }
  }
  storage.clear();
  for (const [k, v] of keep) {
    try {
      storage.setItem(k, v);
    } catch {
      /* quota — skip */
    }
  }
}

export async function clearBrowserSession(): Promise<void> {
  if (typeof window === 'undefined') return;

  try {
    clearPreserving(window.localStorage);
  } catch {
    /* private mode / storage disabled — nothing to clear */
  }
  try {
    clearPreserving(window.sessionStorage);
  } catch {
    /* private mode / storage disabled */
  }
  try {
    if ('caches' in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
    }
  } catch {
    /* Cache API unavailable — non-fatal */
  }
}
