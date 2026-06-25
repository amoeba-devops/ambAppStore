'use client';

import { useEffect, useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { Bell, BellOff, Loader2 } from 'lucide-react';
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardHeaderText,
  CardTitle,
  toast,
} from '@car-v2/ui';
import { dispatchPushStateChanged } from '@/hooks/push-event';

type SubState = 'unknown' | 'unsupported' | 'subscribed' | 'unsubscribed' | 'denied';

/* Web Push subscription toggle.
 *
 * Lifecycle:
 *   1. On mount, check `serviceWorker.ready` + current PushSubscription.
 *      If we already have one, mark 'subscribed'. If permission was denied
 *      previously, mark 'denied' (which disables the button and shows hint).
 *   2. Tap "Enable" → request notification permission, subscribe, POST to
 *      `/api/v1/push/subscribe` with endpoint + keys.
 *   3. Tap "Disable" → unsubscribe locally + POST to
 *      `/api/v1/push/unsubscribe` so the server stops fan-out.
 *
 * iOS PWA caveat: notification permission can only be requested AFTER the
 * app is installed to the home screen (iOS 16.4+). Pre-install, we surface a
 * hint pointing to the install prompt. */
export function MePushCard() {
  const tMe = useTranslations('settings.me.push');
  const [state, setState] = useState<SubState>('unknown');
  const [pending, start] = useTransition();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (typeof window === 'undefined') return;
      if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
        if (!cancelled) setState('unsupported');
        return;
      }
      if (Notification.permission === 'denied') {
        if (!cancelled) setState('denied');
        return;
      }
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (!cancelled) setState(sub ? 'subscribed' : 'unsubscribed');
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const enable = () => {
    start(async () => {
      try {
        const reg = await navigator.serviceWorker.ready;
        const perm = await Notification.requestPermission();
        if (perm !== 'granted') {
          setState(perm === 'denied' ? 'denied' : 'unsubscribed');
          toast.info(tMe('permissionDenied'));
          return;
        }
        const vapidPub = process.env.NEXT_PUBLIC_WEB_PUSH_VAPID_PUBLIC;
        if (!vapidPub) {
          toast.error(tMe('errVapidMissing'));
          return;
        }
        const sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapidPub),
        });
        const res = await fetch('/api/v1/push/subscribe', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(sub.toJSON()),
        });
        if (!res.ok) {
          throw new Error(`subscribe API ${res.status}`);
        }
        setState('subscribed');
        /* Notify sibling consumers (PushPromptStrip header banner, PushToggle
         * in admin Settings/Notifications) so they refresh state without
         * waiting for a full remount. */
        dispatchPushStateChanged();
        toast.success(tMe('enableSuccess'));
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'unknown';
        toast.error(tMe('errEnable'), { description: msg });
      }
    });
  };

  const disable = () => {
    start(async () => {
      try {
        const reg = await navigator.serviceWorker.ready;
        const sub = await reg.pushManager.getSubscription();
        if (sub) {
          /* Tell the server first so we don't keep firing pushes after
           * unsubscribe completes locally (race: server fan-out + UA
           * already-revoked subscription would return 410 anyway). */
          await fetch('/api/v1/push/unsubscribe', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ endpoint: sub.endpoint }),
          }).catch(() => {});
          await sub.unsubscribe();
        }
        setState('unsubscribed');
        dispatchPushStateChanged();
        toast.success(tMe('disableSuccess'));
      } catch (err) {
        toast.error(tMe('errDisable'), {
          description: err instanceof Error ? err.message : 'unknown',
        });
      }
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardHeaderText>
          <CardTitle>
            <span className="inline-flex items-center gap-2">
              {state === 'subscribed' ? (
                <Bell className="h-4 w-4 text-accent" aria-hidden />
              ) : (
                <BellOff className="h-4 w-4 text-text-muted" aria-hidden />
              )}
              {tMe('title')}
            </span>
          </CardTitle>
        </CardHeaderText>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-text-muted mb-4 leading-relaxed">
          {tMe('description')}
        </p>

        {state === 'unsupported' && (
          <div className="text-sm text-text-muted bg-surface-2 rounded-md px-3 py-2">
            {tMe('unsupported')}
          </div>
        )}
        {state === 'denied' && (
          <div className="text-sm text-warning bg-warning-soft rounded-md px-3 py-2">
            {tMe('denied')}
          </div>
        )}
        {state === 'subscribed' && (
          <Button variant="ghost" size="lg" onClick={disable} disabled={pending} iconLeft={pending ? <Loader2 className="animate-spin" /> : <BellOff />}>
            {tMe('disable')}
          </Button>
        )}
        {(state === 'unsubscribed' || state === 'unknown') && (
          <Button variant="accent" size="lg" onClick={enable} disabled={pending || state === 'unknown'} iconLeft={pending ? <Loader2 className="animate-spin" /> : <Bell />}>
            {tMe('enable')}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

/* VAPID public key is a URL-safe base64 string; the Web Push spec requires
 * a BufferSource (ArrayBuffer-backed) for `applicationServerKey`. TS's lib.dom
 * `PushSubscriptionOptionsInit.applicationServerKey` won't accept a generic
 * `Uint8Array<ArrayBufferLike>` directly, so we materialise the bytes into a
 * fresh `ArrayBuffer` and return that. */
function urlBase64ToUint8Array(base64: string): ArrayBuffer {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(b64);
  const buffer = new ArrayBuffer(raw.length);
  const view = new Uint8Array(buffer);
  for (let i = 0; i < raw.length; i += 1) view[i] = raw.charCodeAt(i);
  return buffer;
}
