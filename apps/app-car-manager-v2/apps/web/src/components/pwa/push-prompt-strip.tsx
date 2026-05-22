'use client';

import { useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Bell, Loader2, X } from 'lucide-react';
import { Button, cn } from '@car-v2/ui';
import { usePushSubscription } from '@/hooks/use-push-subscription';
import { usePushConfig } from './push-config-context';

const STORAGE_KEY = 'pwa.pushStripSnoozedUntil';
const SNOOZE_MS = 15 * 60 * 1000; /* 15 minutes — short enough that an
 * onboarding user gets re-nudged the same session if they tabbed away. */

/* Top-of-content strip prompting the user to enable Web Push.
 *
 * Sits inside `<main>` so it spans from the right edge of the sidebar to the
 * full screen width (and full screen width on mobile where the sidebar is
 * hidden). Scrolls with the page rather than sticking — once the user has
 * scrolled past it, the PageHeader's own sticky bar takes over the top band.
 *
 * Visibility — only renders when the user can actually act:
 *   idle | subscribing | error | denied  → show
 *   subscribed | unsupported              → hide
 *   no VAPID key                          → hide
 *
 * Dismiss snoozes for 15 minutes via localStorage. A pending setTimeout
 * flips it back automatically when the snooze expires so the user doesn't
 * need to refresh. */
export function PushPromptStrip() {
  const t = useTranslations('pwa.push');
  const { vapidPublicKey, basePath } = usePushConfig();
  const { state, errorMessage, subscribe } = usePushSubscription({
    vapidPublicKey,
    basePath,
  });

  /* `hidden === null` means we haven't read localStorage yet — return null
   * during that window to avoid a flash of strip before snooze check
   * completes. */
  const [hidden, setHidden] = useState<boolean | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const stored = Number(window.localStorage.getItem(STORAGE_KEY) ?? '0');
    const remaining = stored - Date.now();
    if (remaining > 0) {
      setHidden(true);
      const id = setTimeout(() => setHidden(false), remaining);
      return () => clearTimeout(id);
    }
    setHidden(false);
  }, []);

  const dismiss = useCallback(() => {
    const until = Date.now() + SNOOZE_MS;
    try {
      window.localStorage.setItem(STORAGE_KEY, String(until));
    } catch {
      /* localStorage unavailable (incognito) — stays dismissed for this
       * mount only, which is acceptable. */
    }
    setHidden(true);
    setTimeout(() => setHidden(false), SNOOZE_MS);
  }, []);

  const onEnable = useCallback(async () => {
    await subscribe();
  }, [subscribe]);

  /* Visibility gates. Order matters: cheap early-returns before render. */
  if (hidden === null) return null;
  if (hidden) return null;
  if (!vapidPublicKey) return null;
  if (state === 'unsupported' || state === 'subscribed') return null;

  const isBusy = state === 'subscribing';
  const isError = state === 'error';
  const isDenied = state === 'denied';

  return (
    <div
      role="region"
      aria-label={t('promptAria')}
      className={cn(
        'border-b',
        isError
          ? 'border-danger/20 bg-danger-soft/40'
          : isDenied
            ? 'border-border bg-surface-2/60'
            : 'border-accent/20 bg-accent-soft/40',
      )}
    >
      <div className="flex items-center gap-3 px-4 md:px-6 py-2">
        <Bell className="h-4 w-4 text-accent shrink-0" aria-hidden />
        <div className="flex-1 min-w-0 text-sm">
          <span className="font-medium text-text">{t('promptTitle')}</span>
          {/* Hide description on mobile — title alone is enough at narrow
            * width to communicate the action. */}
          <span className="text-text-muted ml-2 hidden md:inline">
            {isDenied ? t('deniedHint') : t('promptDesc')}
          </span>
          {isError && errorMessage && (
            <span className="block md:inline md:ml-2 text-xs text-danger">
              {t('errorRetry', { message: errorMessage })}
            </span>
          )}
        </div>
        {!isDenied && (
          <Button
            variant="accent"
            size="sm"
            onClick={onEnable}
            disabled={isBusy}
            iconLeft={isBusy ? <Loader2 className="animate-spin" /> : undefined}
            className="shrink-0"
          >
            {isBusy ? null : isError ? t('retry') : t('enable')}
          </Button>
        )}
        <button
          type="button"
          onClick={dismiss}
          aria-label={t('dismissAria')}
          className={cn(
            'h-7 w-7 rounded-md inline-flex items-center justify-center shrink-0',
            'text-text-faint hover:text-text hover:bg-surface-2 transition-colors',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          )}
        >
          <X className="h-4 w-4" aria-hidden />
        </button>
      </div>
    </div>
  );
}
