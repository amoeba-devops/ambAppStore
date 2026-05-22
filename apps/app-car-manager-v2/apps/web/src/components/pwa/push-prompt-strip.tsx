'use client';

import { useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Bell, BellOff, Loader2, X } from 'lucide-react';
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
 * PWA-aware: the top safe-area inset is applied so the strip doesn't get
 * clipped under the iPhone notch / status bar in standalone mode.
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

  /* Bell icon picks per state — matches the background colour so the icon
   * doesn't look pasted-on. Denied uses BellOff for an at-a-glance "blocked"
   * read. */
  const IconCmp = isDenied ? BellOff : Bell;
  const iconColor = isError
    ? 'text-danger'
    : isDenied
      ? 'text-text-muted'
      : 'text-accent';

  /* Body text per state — denied has no CTA so the hint replaces the
   * generic promptDesc entirely; on mobile the title row becomes the hint
   * itself since the description column is hidden there. */
  const bodyDesc = isDenied ? t('deniedHint') : t('promptDesc');
  const mobileTitle = isDenied ? t('deniedHint') : t('promptTitle');

  return (
    <div
      role="region"
      aria-label={t('promptAria')}
      className={cn(
        'border-b',
        /* iPhone PWA standalone has a notch — without this top inset the
         * strip is clipped under the status bar. Desktop / Android browsers
         * report env() as 0 so this is a no-op there. */
        'pt-[env(safe-area-inset-top,0px)]',
        isError
          ? 'border-danger/20 bg-danger-soft/40'
          : isDenied
            ? 'border-border bg-surface-2/60'
            : 'border-accent/20 bg-accent-soft/40',
      )}
    >
      <div className="flex items-center gap-2 md:gap-3 px-3 md:px-6 py-2">
        <IconCmp className={cn('h-4 w-4 shrink-0', iconColor)} aria-hidden />
        <div className="flex-1 min-w-0 text-sm leading-tight">
          {/* Mobile: title line carries the most important phrase for the
            * current state (hint when denied, promptTitle otherwise) since
            * the description column is hidden. Desktop keeps the standard
            * "Title · description" pair. */}
          <span className="font-medium text-text md:hidden truncate block">
            {mobileTitle}
          </span>
          <span className="font-medium text-text hidden md:inline">
            {t('promptTitle')}
          </span>
          <span className="text-text-muted ml-2 hidden md:inline">{bodyDesc}</span>
          {/* Error message stays inline + truncate on mobile so the strip
            * never grows to two rows and shifts the page below it. */}
          {isError && errorMessage && (
            <span className="text-xs text-danger ml-2 hidden md:inline truncate">
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
            {isError ? t('retry') : t('enable')}
          </Button>
        )}
        <button
          type="button"
          onClick={dismiss}
          aria-label={t('dismissAria')}
          className={cn(
            /* 44px touch target on mobile per WCAG AA; tighter 28px on
             * desktop where pointer precision is fine. */
            'inline-flex items-center justify-center shrink-0 rounded-md',
            'h-11 w-11 md:h-7 md:w-7',
            '-mr-1 md:mr-0',
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
