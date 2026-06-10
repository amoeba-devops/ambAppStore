'use client';

import { useCallback, useEffect, useState } from 'react';
import { PUSH_STATE_EVENT, dispatchPushStateChanged } from './push-event';

/**
 * usePushSubscription — Web Push subscription lifecycle from the browser side.
 *
 * State machine:
 *   unsupported → ❌ no API in this browser/context (HTTP, old browser, iOS pre-16.4)
 *   denied      → user has clicked "Block" in the browser permission dialog
 *   idle        → ready to subscribe
 *   subscribing → in-flight (permission prompt or POST /push/subscribe)
 *   subscribed  → SW registered + endpoint posted to server
 *   error       → last action failed; check `errorMessage`
 *
 * The SW path is computed against the Next.js basePath at runtime — staging
 * deploys under /app-car-manager-v2 must register sw.js at
 * /app-car-manager-v2/sw.js with matching scope, else the browser rejects.
 *
 * Cross-instance sync: each consumer (PushPromptStrip, PushToggle, …) has
 * its own state. Without a sync mechanism the header strip kept showing
 * "Enable" forever after a user enabled push from a different surface (e.g.
 * `MePushCard`), because AppShellClient never unmounts in App Router and
 * the mount-time check fires exactly once. Solved by:
 *   1. Re-detecting on `visibilitychange` (tab regains focus)
 *   2. Listening for the `PUSH_STATE_EVENT` window event that every
 *      subscribe/unsubscribe success path fires — see push-event.ts.
 *
 * The detection itself uses `getRegistration()` (no args, defaults to the
 * current document URL) instead of `getRegistration(scope)` because scope
 * matching is brittle: a SW registered at `/` returns undefined when asked
 * for the empty scope `/` (Chrome 119+ glitch), but always returns it when
 * asked about the current page URL. */

export type PushState =
  | 'unsupported'
  | 'iframe'
  | 'denied'
  | 'idle'
  | 'subscribing'
  | 'subscribed'
  | 'error';

interface UsePushSubscriptionOptions {
  /** VAPID public key (urlBase64-encoded). REQUIRED. */
  vapidPublicKey: string | undefined;
  /** Next.js basePath — '' for clean URL, '/app-car-manager-v2' on staging. */
  basePath: string;
}

interface UsePushSubscriptionResult {
  state: PushState;
  errorMessage: string | null;
  subscribe: () => Promise<void>;
  unsubscribe: () => Promise<void>;
}

export function usePushSubscription({
  vapidPublicKey,
  basePath,
}: UsePushSubscriptionOptions): UsePushSubscriptionResult {
  const [state, setState] = useState<PushState>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  /* Detect support + current permission/subscription. Runs on mount AND on
   * (a) tab visibility regain and (b) the shared `PUSH_STATE_EVENT` so
   * sibling instances stay in sync — see header comment. */
  useEffect(() => {
    if (typeof window === 'undefined') return;

    /* In iframe context (AMA embed), Service Worker scope doesn't work properly.
     * The SW would be registered under the iframe URL which is not useful —
     * push notifications need top-level navigation to be installable as PWA.
     * Show iframe state so UI can display guidance to open in new tab. */
    if (window.self !== window.top) {
      setState('iframe');
      return;
    }

    if (
      !('serviceWorker' in navigator) ||
      !('PushManager' in window) ||
      !('Notification' in window)
    ) {
      setState('unsupported');
      return;
    }
    if (Notification.permission === 'denied') {
      setState('denied');
      return;
    }

    let cancelled = false;
    const detect = async () => {
      try {
        /* `getRegistration()` (no args) resolves the registration whose scope
         * covers the current document URL — more robust than passing an
         * explicit `${basePath}/` scope, which has returned undefined in
         * some Chrome builds even when a matching SW is installed. */
        const reg = await navigator.serviceWorker.getRegistration();
        const existing = await reg?.pushManager.getSubscription();
        if (!cancelled) setState((prev) => {
          /* Don't clobber an in-flight 'subscribing' / 'error' state with a
           * detection sweep — the user is mid-interaction and the detection
           * result is stale by definition. Only fire transitions between
           * the two "resting" states. */
          if (prev === 'subscribing' || prev === 'error') return prev;
          return existing ? 'subscribed' : 'idle';
        });
      } catch {
        if (!cancelled) setState((prev) => (prev === 'subscribing' || prev === 'error' ? prev : 'idle'));
      }
    };
    void detect();

    const onVisible = () => {
      if (document.visibilityState === 'visible') void detect();
    };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener(PUSH_STATE_EVENT, detect);

    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener(PUSH_STATE_EVENT, detect);
    };
  }, [basePath]);

  const subscribe = useCallback(async () => {
    if (!vapidPublicKey) {
      setState('error');
      setErrorMessage('VAPID public key missing');
      return;
    }
    setState('subscribing');
    setErrorMessage(null);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        setState(permission === 'denied' ? 'denied' : 'idle');
        return;
      }

      /* Register SW under basePath. Both file location and scope must match. */
      const swUrl = `${basePath}/sw.js`;
      const scope = `${basePath}/`;
      const reg = await navigator.serviceWorker.register(swUrl, { scope });
      await navigator.serviceWorker.ready;

      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
      });
      const json = sub.toJSON();
      const res = await fetch(`${basePath}/api/v1/push/subscribe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          endpoint: json.endpoint,
          keys: json.keys,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        setState('error');
        setErrorMessage(body?.error?.message ?? `HTTP ${res.status}`);
        return;
      }
      setState('subscribed');
      dispatchPushStateChanged();
    } catch (e) {
      setState('error');
      setErrorMessage(e instanceof Error ? e.message : 'Unknown error');
    }
  }, [vapidPublicKey, basePath]);

  const unsubscribe = useCallback(async () => {
    setErrorMessage(null);
    try {
      const reg = await navigator.serviceWorker.getRegistration(`${basePath}/`);
      const sub = await reg?.pushManager.getSubscription();
      if (sub) {
        const endpoint = sub.endpoint;
        await sub.unsubscribe();
        /* Best-effort tell the server — if it fails we still moved client to
         * a "no subscription" state, server cleanup will happen on next 410. */
        try {
          await fetch(`${basePath}/api/v1/push/unsubscribe`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ endpoint }),
          });
        } catch {
          /* swallow */
        }
      }
      setState('idle');
      dispatchPushStateChanged();
    } catch (e) {
      setState('error');
      setErrorMessage(e instanceof Error ? e.message : 'Unknown error');
    }
  }, [basePath]);

  return { state, errorMessage, subscribe, unsubscribe };
}

/* VAPID public keys are urlBase64 — PushManager.subscribe wants a BufferSource.
 * Allocate against a regular ArrayBuffer (not the default ArrayBufferLike that
 * the lib types reject under strict TS settings). */
function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const buffer = new ArrayBuffer(raw.length);
  const out = new Uint8Array(buffer);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}
