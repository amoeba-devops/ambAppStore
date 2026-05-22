'use client';

import { useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { AlertTriangle, Copy, Download, Share, Smartphone, X } from 'lucide-react';
import { Button, cn, toast } from '@car-v2/ui';
import { useDisplayMode } from './use-display-mode';

const STORAGE_KEY = 'pwa.installDismissedUntil';

/* Snooze durations. "Để sau" (snooze button) is the soft option — user is
 * interested but not now. "X" (close) signals stronger rejection, so we wait
 * longer before nagging again. iOS only has X (no install button), so the
 * 90-day value also governs iOS dismiss. */
const SNOOZE_DAYS = 30;
const CLOSE_DAYS = 90;

function isSnoozed(): boolean {
  try {
    const until = window.localStorage.getItem(STORAGE_KEY);
    return until !== null && Number(until) > Date.now();
  } catch {
    return false;
  }
}

/* Chrome / Edge `beforeinstallprompt` event shape (not in lib.dom yet). */
interface BIPEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

/* Variants:
 *   android      — Chrome/Edge desktop or Android with beforeinstallprompt event
 *   ios-safari   — Real Safari on iOS (only browser on iOS that can install a
 *                  true PWA; shows Share→Add to Home Screen instructions)
 *   ios-alt      — Chrome/Firefox/etc on iOS. Apple forces all browsers on iOS
 *                  to use WebKit + bans third-party install paths, so "Add to
 *                  Home Screen" inside those browsers just bookmarks the page
 *                  inside the host browser's in-app view (with URL bar + nav
 *                  chrome visible). Banner tells the user to switch to Safari
 *                  for a true standalone PWA. */
type Variant = 'hidden' | 'android' | 'ios-safari' | 'ios-alt';

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
 * Dismiss durations: "Để sau" (snooze) = 30 days, "X" (close) = 90 days.
 * Both `beforeinstallprompt` (Chrome can refire it across navigations) and
 * the initial mount check honour the snooze window, so once dismissed the
 * banner stays gone until the timestamp elapses.
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

    /* Initial snooze check. */
    if (isSnoozed()) return;

    const ua = window.navigator.userAgent;
    const isIOSDevice = /iPhone|iPad|iPod/.test(ua);
    const isAltBrowser = /CriOS|FxiOS|EdgiOS/.test(ua);
    if (isIOSDevice && !isAltBrowser) {
      setVariant('ios-safari');
    } else if (isIOSDevice && isAltBrowser) {
      /* Chrome/Firefox/Edge on iOS — can't install a real PWA. Tell the user
       * to switch to Safari, since "Add to Home Screen" from these browsers
       * just bookmarks the page inside the in-app view (browser chrome stays
       * visible on every page, which is what the user reported as the
       * "session header/footer still showing after install" symptom). */
      setVariant('ios-alt');
    }

    /* Android / desktop — wait for beforeinstallprompt. Chrome can refire this
     * event across SPA navigations even after we've dismissed once, so the
     * handler must re-check the snooze window — otherwise the banner pops back
     * up immediately after the next route change. */
    const onBIP = (e: Event) => {
      e.preventDefault();
      if (isSnoozed()) return;
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

  const copyCurrentUrl = useCallback(async () => {
    /* iOS browsers (Chrome/Firefox/Edge) can't programmatically open Safari —
     * Apple sandboxes that. Best we can do is copy the URL so the user can
     * paste it into Safari themselves. Fall back to a tiny temporary input
     * + select+copy if the Clipboard API isn't available (rare on iOS 13+). */
    const url = window.location.href;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
      } else {
        const ta = document.createElement('textarea');
        ta.value = url;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.focus();
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
      }
      toast.success(t('iosAltCopySuccess'));
    } catch {
      toast.error(t('iosAltCopyFail'));
    }
  }, [t]);

  const onInstall = useCallback(async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const choice = await deferredPrompt.userChoice;
    /* Either way, this prompt is single-use — clear local state. */
    setDeferredPrompt(null);
    if (choice.outcome === 'accepted') {
      setVariant('hidden');
    } else {
      /* User dismissed the native install sheet — treat as a "Để sau" snooze
       * rather than a hard close, since they did engage with the prompt. */
      dismiss(SNOOZE_DAYS);
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
      <div
        className={cn(
          'mx-auto max-w-md rounded-2xl border shadow-lg px-4 py-3.5',
          variant === 'ios-alt'
            ? 'border-warning/40 bg-warning-soft/30'
            : 'border-border bg-surface',
        )}
      >
        <div className="flex items-start gap-3">
          <div
            className={cn(
              'h-10 w-10 rounded-lg flex items-center justify-center shrink-0',
              variant === 'ios-alt' ? 'bg-warning/15 text-warning' : 'bg-accent-soft text-accent',
            )}
          >
            {variant === 'android' ? (
              <Download className="h-5 w-5" />
            ) : variant === 'ios-alt' ? (
              <AlertTriangle className="h-5 w-5" />
            ) : (
              <Smartphone className="h-5 w-5" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div id="pwa-install-title" className="text-sm font-semibold text-text">
              {variant === 'android'
                ? t('installPrompt')
                : variant === 'ios-alt'
                  ? t('iosAltTitle')
                  : t('iosInstallTitle')}
            </div>
            {variant === 'android' && (
              <p className="mt-0.5 text-xs text-text-muted leading-relaxed">{t('installPromptSub')}</p>
            )}
            {variant === 'ios-safari' && (
              <ol className="mt-1 text-xs text-text-muted leading-relaxed space-y-0.5">
                <li className="flex items-center gap-1.5">
                  <Share className="h-3 w-3 shrink-0 text-text-faint" aria-hidden />
                  <span>{t('iosInstallStep1')}</span>
                </li>
                <li>{t('iosInstallStep2')}</li>
              </ol>
            )}
            {variant === 'ios-alt' && (
              <>
                <p className="mt-1 text-xs text-text leading-relaxed">{t('iosAltDesc')}</p>
                <ol className="mt-1.5 text-xs text-text-muted leading-relaxed space-y-0.5">
                  <li>1. {t('iosAltStep1')}</li>
                  <li>2. {t('iosAltStep2')}</li>
                  <li className="flex items-center gap-1.5">
                    3. <Share className="h-3 w-3 shrink-0 text-text-faint" aria-hidden />
                    {t('iosAltStep3')}
                  </li>
                </ol>
              </>
            )}
          </div>
          <button
            type="button"
            onClick={() => dismiss(CLOSE_DAYS)}
            aria-label={t('installDismiss')}
            className="h-9 w-9 -mt-1 -mr-1 rounded flex items-center justify-center text-text-faint hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        {variant === 'ios-alt' && (
          <div className="mt-3 flex gap-2">
            <Button variant="ghost" size="sm" className="flex-1" onClick={() => dismiss(SNOOZE_DAYS)}>
              {t('installDismiss')}
            </Button>
            <Button
              variant="accent"
              size="sm"
              className="flex-1"
              iconLeft={<Copy />}
              onClick={copyCurrentUrl}
            >
              {t('iosAltCopyUrl')}
            </Button>
          </div>
        )}
        {variant === 'android' && (
          <div className="mt-3 flex gap-2">
            <Button variant="ghost" size="sm" className="flex-1" onClick={() => dismiss(SNOOZE_DAYS)}>
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
