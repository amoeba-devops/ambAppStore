'use client';

import { useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Download, Share, Smartphone, X } from 'lucide-react';
import { Button } from '@car-v2/ui';
import { useDisplayMode } from './use-display-mode';

const STORAGE_KEY = 'pwa.installDismissedUntil';

/* Chrome / Edge `beforeinstallprompt` event shape (not in lib.dom yet). */
interface BIPEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

type Variant = 'hidden' | 'android' | 'ios';

/* Bottom banner that offers installing Fleet as a PWA.
 *
 * Three variants:
 *   - 'android' (or desktop Chrome) — show only after the browser fires
 *     `beforeinstallprompt`; clicking the install button replays the prompt
 *   - 'ios' — Safari never fires that event, so we surface a Share→Add
 *     instructions card instead
 *   - 'hidden' — already installed, iframe, dismissed recently, or unsupported
 *
 * Suppressed in iframes (AMA passthrough) because install only works from a
 * top-level browsing context anyway.
 *
 * Dismiss durations: "Để sau" (snooze) = 7 days, "X" (close) = 30 days.
 */
export function InstallPrompt() {
  const t = useTranslations('pwa');
  const displayMode = useDisplayMode();

  const [variant, setVariant] = useState<Variant>('hidden');
  const [deferredPrompt, setDeferredPrompt] = useState<BIPEvent | null>(null);

  /* Compute initial variant: returns 'hidden' if we should never show. */
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (window.self !== window.top) return;            // iframe
    if (displayMode === 'standalone') return;          // already installed

    /* Check dismissal expiry. */
    try {
      const until = window.localStorage.getItem(STORAGE_KEY);
      if (until && Number(until) > Date.now()) return;
    } catch {
      /* localStorage may be blocked — ignore, just always show. */
    }

    const ua = window.navigator.userAgent;
    const isIOS = /iPhone|iPad|iPod/.test(ua) && !/CriOS|FxiOS/.test(ua); // Safari only
    if (isIOS) setVariant('ios');

    /* Android / desktop — wait for beforeinstallprompt. */
    const onBIP = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BIPEvent);
      setVariant('android');
    };
    window.addEventListener('beforeinstallprompt', onBIP);

    /* If the app gets installed during this session, hide the banner. */
    const onInstalled = () => {
      setVariant('hidden');
      setDeferredPrompt(null);
    };
    window.addEventListener('appinstalled', onInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', onBIP);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, [displayMode]);

  const dismiss = useCallback((days: number) => {
    try {
      window.localStorage.setItem(STORAGE_KEY, String(Date.now() + days * 86_400_000));
    } catch {
      /* Silent. */
    }
    setVariant('hidden');
  }, []);

  const onInstall = useCallback(async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const choice = await deferredPrompt.userChoice;
    /* Either way, this prompt is single-use — clear local state. */
    setDeferredPrompt(null);
    if (choice.outcome === 'accepted') {
      setVariant('hidden');
    } else {
      dismiss(7);
    }
  }, [deferredPrompt, dismiss]);

  if (variant === 'hidden') return null;

  return (
    <div
      role="dialog"
      aria-labelledby="pwa-install-title"
      className="fixed inset-x-0 bottom-0 z-50 px-3 pb-3"
      style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}
    >
      <div className="mx-auto max-w-md rounded-2xl border border-border bg-surface shadow-lg px-4 py-3.5">
        <div className="flex items-start gap-3">
          <div className="h-10 w-10 rounded-lg bg-accent-soft text-accent flex items-center justify-center shrink-0">
            {variant === 'android' ? <Download className="h-5 w-5" /> : <Smartphone className="h-5 w-5" />}
          </div>
          <div className="flex-1 min-w-0">
            <div id="pwa-install-title" className="text-sm font-semibold text-text">
              {variant === 'android' ? t('installPrompt') : t('iosInstallTitle')}
            </div>
            {variant === 'android' ? (
              <p className="mt-0.5 text-xs text-text-muted leading-relaxed">{t('installPromptSub')}</p>
            ) : (
              <ol className="mt-1 text-xs text-text-muted leading-relaxed space-y-0.5">
                <li className="flex items-center gap-1.5">
                  <Share className="h-3 w-3 shrink-0 text-text-faint" aria-hidden />
                  <span>{t('iosInstallStep1')}</span>
                </li>
                <li>{t('iosInstallStep2')}</li>
              </ol>
            )}
          </div>
          <button
            type="button"
            onClick={() => dismiss(30)}
            aria-label={t('installDismiss')}
            className="h-7 w-7 -mt-1 -mr-1 rounded flex items-center justify-center text-text-faint hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        {variant === 'android' && (
          <div className="mt-3 flex gap-2">
            <Button variant="ghost" size="sm" className="flex-1" onClick={() => dismiss(7)}>
              {t('installDismiss')}
            </Button>
            <Button variant="accent" size="sm" className="flex-1" onClick={onInstall} disabled={!deferredPrompt}>
              {t('installButton')}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
