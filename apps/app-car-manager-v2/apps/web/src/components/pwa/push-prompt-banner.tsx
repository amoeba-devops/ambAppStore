'use client';

import { useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Bell, BellOff, Loader2, X } from 'lucide-react';
import { Button } from '@car-v2/ui';
import { usePushSubscription } from '@/hooks/use-push-subscription';

const STORAGE_KEY = 'pwa.pushPromptDismissedUntil';

/* Snooze durations mirror InstallPrompt — "Để sau" is soft (user might come
 * back tomorrow), "X" is hard (don't bug me for a while). Push is more useful
 * than install (you can install AND still miss trip updates), so we re-prompt
 * sooner than install (90d) to give a second chance after onboarding. */
const SNOOZE_DAYS = 14;
const CLOSE_DAYS = 60;

function isSnoozed(): boolean {
  try {
    const until = window.localStorage.getItem(STORAGE_KEY);
    return until !== null && Number(until) > Date.now();
  } catch {
    return false;
  }
}

interface PushPromptBannerProps {
  vapidPublicKey: string | undefined;
  basePath: string;
}

/* Top-of-page banner urging the user to enable Web Push.
 *
 * Visibility matrix (only `idle` shows the banner):
 *   state == 'idle'       → show           (browser supports it, no prior choice)
 *   state == 'subscribed' → hidden         (already enabled — toggle in /settings handles off)
 *   state == 'denied'     → hidden         (can't be re-prompted; user must reset in browser)
 *   state == 'unsupported'→ hidden         (no SW/PushManager/Notification API)
 *   !vapidPublicKey       → hidden         (server can't push — pointless to ask)
 *
 * Also hidden when snoozed via localStorage (`isSnoozed()`) so the banner
 * doesn't reappear on every navigation.
 *
 * `vapidPublicKey` and `basePath` come from the server-rendered AppShell so the
 * env values reach the client deterministically (no client-side process.env
 * access in app router). */
export function PushPromptBanner({ vapidPublicKey, basePath }: PushPromptBannerProps) {
  const t = useTranslations('pwa.push');
  const { state, errorMessage, subscribe } = usePushSubscription({ vapidPublicKey, basePath });

  /* `snoozed` is read once on mount — we don't poll localStorage. If the user
   * dismisses on this page, we hide locally via the `dismissed` flag instead
   * of waiting for a re-mount. */
  const [snoozed, setSnoozed] = useState<boolean | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    setSnoozed(isSnoozed());
  }, []);

  const dismiss = useCallback((days: number) => {
    try {
      window.localStorage.setItem(STORAGE_KEY, String(Date.now() + days * 86_400_000));
    } catch {
      /* localStorage unavailable (incognito) — banner stays hidden for the
       * session only, which is fine. */
    }
    setDismissed(true);
  }, []);

  const onEnable = useCallback(async () => {
    await subscribe();
    /* `subscribe()` mutates state — if user denied or any step failed, the
     * hint inside this banner will read it on next render via `state`. If
     * successful, the banner hides itself (state becomes 'subscribed'). */
  }, [subscribe]);

  /* Compute visibility. Wait for snooze-read to complete to avoid a flash. */
  if (snoozed === null) return null;
  if (snoozed || dismissed) return null;
  if (!vapidPublicKey) return null;
  if (state !== 'idle' && state !== 'error') return null;

  /* Error state — still show the banner so user can retry, but with a hint. */
  const showRetry = state === 'error';
  const isBusy = false; /* hook tracks via state === 'subscribing', which we hide above */

  return (
    <div
      role="region"
      aria-label={t('promptAria')}
      className="px-3 pt-3 md:px-4 md:pt-4"
    >
      <div className="mx-auto max-w-3xl rounded-xl border border-accent/30 bg-accent-soft/40 px-4 py-3 shadow-sm">
        <div className="flex items-start gap-3">
          <div className="h-9 w-9 rounded-lg bg-accent text-accent-fg flex items-center justify-center shrink-0">
            <Bell className="h-4.5 w-4.5" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold text-text">{t('promptTitle')}</div>
            <p className="mt-0.5 text-xs text-text-muted leading-relaxed">
              {t('promptDesc')}
            </p>
            {showRetry && errorMessage && (
              <p className="mt-1.5 text-xs text-danger flex items-center gap-1">
                <BellOff className="h-3 w-3 shrink-0" aria-hidden />
                {t('errorRetry', { message: errorMessage })}
              </p>
            )}
            <div className="mt-2.5 flex gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => dismiss(SNOOZE_DAYS)}
                disabled={isBusy}
              >
                {t('later')}
              </Button>
              <Button
                variant="accent"
                size="sm"
                onClick={onEnable}
                disabled={isBusy}
                iconLeft={isBusy ? <Loader2 className="animate-spin" /> : <Bell />}
              >
                {showRetry ? t('retry') : t('enable')}
              </Button>
            </div>
          </div>
          <button
            type="button"
            onClick={() => dismiss(CLOSE_DAYS)}
            aria-label={t('dismissAria')}
            className="h-8 w-8 -mt-1 -mr-1 rounded flex items-center justify-center text-text-faint hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
