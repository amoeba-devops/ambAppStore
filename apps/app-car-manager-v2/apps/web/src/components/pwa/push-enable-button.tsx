'use client';

import { useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { Bell, BellOff, BellRing, Loader2 } from 'lucide-react';
import {
  Button,
  cn,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@car-v2/ui';
import { usePushSubscription } from '@/hooks/use-push-subscription';
import { usePushConfig } from './push-config-context';

/* Compact header affordance for managing the browser's Web Push subscription.
 *
 * Renders a bell-icon button that opens a dropdown describing the current
 * state and offers the relevant action (enable / disable / open browser
 * settings). Replaces the older full-width banner above page content.
 *
 * Mounted in two places, both seeded by the same PushConfigProvider in
 * AppShellClient:
 *   - Desktop sidebar brand header (always visible on md+)
 *   - Mobile app-bar right slot via PageHeader (always visible on < md)
 *
 * Visibility:
 *   - Hidden when the server can't push (no VAPID key in env).
 *   - Hidden when the browser doesn't support Web Push (`unsupported`).
 *     Showing a disabled control there just confuses the user.
 *   - Shown for `idle | subscribing | subscribed | denied | error`.
 *
 * Dot indicator on the bell: appears for `idle` and `error` only — i.e.
 * states where the user can act to get notifications working. Subscribed
 * users see a clean bell; denied users see BellOff (informational). */
export function PushEnableButton() {
  const t = useTranslations('pwa.push');
  const { vapidPublicKey, basePath } = usePushConfig();
  const { state, errorMessage, subscribe, unsubscribe } = usePushSubscription({
    vapidPublicKey,
    basePath,
  });

  const onEnable = useCallback(async () => {
    await subscribe();
  }, [subscribe]);

  const onDisable = useCallback(async () => {
    await unsubscribe();
  }, [unsubscribe]);

  /* Hidden states — server can't push, or the browser flat-out doesn't support
   * Push API. Showing nothing keeps the sidebar header clean. */
  if (!vapidPublicKey) return null;
  if (state === 'unsupported') return null;

  const showDot = state === 'idle' || state === 'error';
  const isBusy = state === 'subscribing';

  /* Icon picks: ringing bell when subscribed (active), bell-off when denied
   * (informational), plain bell otherwise. Keeps the visual cheap to scan. */
  const Icon = state === 'subscribed' ? BellRing : state === 'denied' ? BellOff : Bell;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={t('promptAria')}
          className={cn(
            'relative h-8 w-8 rounded-md inline-flex items-center justify-center shrink-0',
            'text-text-muted hover:text-text hover:bg-surface-2 transition-colors',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            'data-[state=open]:bg-surface-2 data-[state=open]:text-text',
          )}
        >
          {isBusy ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          ) : (
            <Icon className="h-4 w-4" aria-hidden />
          )}
          {showDot && !isBusy && (
            <span
              className="absolute top-1 right-1 h-1.5 w-1.5 rounded-full bg-accent ring-1 ring-surface"
              aria-hidden
            />
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent side="bottom" align="end" sideOffset={6} className="w-[280px]">
        <DropdownMenuLabel>{t('promptTitle')}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <div className="px-2 py-2 text-xs text-text-muted leading-relaxed">
          {state === 'subscribed' ? t('subscribedHint') : t('promptDesc')}
        </div>
        {state === 'error' && errorMessage && (
          <div className="px-2 pb-2 text-xs text-danger">
            {t('errorRetry', { message: errorMessage })}
          </div>
        )}
        {state === 'denied' && (
          <div className="px-2 pb-2 text-xs text-text-muted">{t('deniedHint')}</div>
        )}
        {(state === 'idle' || state === 'error' || state === 'subscribing') && (
          <div className="px-2 pb-2">
            <Button
              variant="accent"
              size="sm"
              className="w-full"
              onClick={onEnable}
              disabled={isBusy}
              iconLeft={isBusy ? <Loader2 className="animate-spin" /> : <Bell />}
            >
              {state === 'error' ? t('retry') : t('enable')}
            </Button>
          </div>
        )}
        {state === 'subscribed' && (
          <div className="px-2 pb-2">
            <Button
              variant="ghost"
              size="sm"
              className="w-full"
              onClick={onDisable}
              iconLeft={<BellOff />}
            >
              {t('disable')}
            </Button>
          </div>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
