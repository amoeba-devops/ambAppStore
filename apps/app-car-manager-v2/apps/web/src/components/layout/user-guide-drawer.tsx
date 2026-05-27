'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { BookOpen, ExternalLink, Loader2 } from 'lucide-react';
import { Button, Sheet, SheetContent, SheetTrigger } from '@car-v2/ui';
import type { LocalRole } from '@car-v2/shared/auth';
import { guideHomeUrl, resolveGuidePage } from '@/lib/user-guide-map';

interface UserGuideDrawerProps {
  role: LocalRole;
  /** Optional render override for the trigger (defaults to icon + label button). */
  trigger?: React.ReactNode;
}

const BASE_PATH = '';

/**
 * In-app user-guide drawer. Auto-resolves the guide page that matches the
 * current `(pathname × role × locale)` and embeds it via iframe so the
 * docs render with full styling + search + lightbox.
 *
 * Layout:
 *   - Desktop ≥md: slides in from the right, max-w-4xl
 *   - Mobile <md: full-width slide-in (same right side, but takes the screen)
 *   - Closed state animates out via Sheet's built-in slide-out
 *
 * Inside the sheet: header with title + "open in new tab" icon + close, then
 * the iframe filling the rest. The iframe `src` re-resolves when route /
 * locale changes — close + re-open always lands on the right page.
 */
export function UserGuideDrawer({ role, trigger }: UserGuideDrawerProps) {
  const pathname = usePathname();
  const uiLocale = useLocale();
  const t = useTranslations('nav');
  const tGuide = useTranslations('userGuide');

  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  /* Re-compute on every open so we always reflect the current pathname /
   * locale — admin who switched locale or navigated since first mount still
   * gets the right page. */
  const resolved = resolveGuidePage(pathname, role, uiLocale, BASE_PATH);

  /* Reset the loading state every time the drawer opens (the iframe re-renders
   * its src and onLoad fires again). */
  useEffect(() => {
    if (open) setLoading(true);
  }, [open, resolved.src]);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        {trigger ?? (
          <Button
            variant="ghost"
            size="sm"
            iconLeft={<BookOpen />}
            aria-label={t('userGuideAria')}
            title={t('userGuide')}
          >
            <span className="hidden md:inline">{t('userGuide')}</span>
          </Button>
        )}
      </SheetTrigger>

      <SheetContent
        side="right"
        /* Override default `w-3/4 max-w-sm` (too narrow for a doc iframe).
         * Mobile: full screen. Desktop: ~70vw capped at 1100px. Padding=0 so
         * the iframe sits flush against the chrome. */
        className="w-screen max-w-none p-0 md:w-[70vw] md:max-w-[1100px] flex flex-col"
      >
        <header className="flex items-center justify-between gap-2 px-4 py-3 border-b border-border bg-surface">
          <div className="min-w-0 flex items-center gap-2">
            <BookOpen className="h-4 w-4 text-accent shrink-0" aria-hidden />
            <div className="min-w-0">
              <div className="text-sm font-semibold text-text truncate">
                {t('userGuide')}
              </div>
              <div className="text-[11px] text-text-faint truncate">
                {resolved.matched
                  ? tGuide('matchedHint', { page: resolved.page })
                  : tGuide('fallbackHint')}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            <Button
              variant="ghost"
              size="sm"
              asChild
              title={tGuide('openInNewTab')}
              aria-label={tGuide('openInNewTab')}
            >
              <a
                href={resolved.src}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1"
              >
                <ExternalLink className="h-4 w-4" />
                <span className="sr-only md:not-sr-only md:text-xs">{tGuide('openInNewTab')}</span>
              </a>
            </Button>
            {/* Spacer to leave room for the Sheet's built-in close button (top-right). */}
            <div className="w-7" aria-hidden />
          </div>
        </header>

        <div className="relative flex-1 bg-surface-2">
          {loading && (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-surface-2/80 backdrop-blur-[1px]">
              <div className="flex items-center gap-2 text-text-muted text-sm">
                <Loader2 className="h-4 w-4 animate-spin" />
                {tGuide('loading')}
              </div>
            </div>
          )}
          {/* Iframe is re-mounted when key changes — guarantees fresh load
           * when user navigates or switches locale while the drawer is open. */}
          <iframe
            key={resolved.src}
            src={resolved.src}
            title={t('userGuide')}
            className="w-full h-full border-0"
            onLoad={() => setLoading(false)}
            /* Restrict the embedded HTML site — it's a same-origin static
             * bundle so we don't need cross-origin permissions. */
            sandbox="allow-same-origin allow-scripts allow-popups allow-popups-to-escape-sandbox"
          />
        </div>

        <footer className="px-4 py-2 border-t border-border bg-surface text-[11px] text-text-faint flex items-center justify-between gap-2">
          <span>
            {tGuide('localeNote', {
              locale: resolved.locale.toUpperCase(),
              uiLocale: uiLocale.toUpperCase(),
            })}
          </span>
          <a
            href={guideHomeUrl(uiLocale, BASE_PATH)}
            target="_blank"
            rel="noreferrer"
            className="text-accent hover:underline inline-flex items-center gap-1"
          >
            {tGuide('viewIndex')} <ExternalLink className="h-3 w-3" />
          </a>
        </footer>
      </SheetContent>
    </Sheet>
  );
}
