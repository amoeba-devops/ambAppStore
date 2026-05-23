'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { ChevronLeft, ChevronRight, Download, FileText, ImageOff, X } from 'lucide-react';
import { cn } from '@car-v2/ui';

export interface AttachmentItem {
  eatId: string;
  eatMime: string;
  eatSizeBytes: number;
  /** Pre-signed GET URL (15-min TTL) issued by the RSC. May be null if the
   * server couldn't sign (AWS creds missing on a dev branch) — falls back to
   * a broken-image tile so the user at least sees the count. */
  signedUrl: string | null;
}

interface AttachmentGalleryProps {
  attachments: AttachmentItem[];
}

const isImageMime = (m: string) => m.startsWith('image/');

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/* Inline thumbnail grid + tap-to-expand lightbox for expense receipts.
 *
 * Responsive grid:
 *   - mobile (< sm):  2 columns, 2px gap — fits 4 receipts above the fold
 *     on a 360px viewport without the user scrolling.
 *   - sm:            3 columns
 *   - md+ (desktop): 4 columns
 *
 * Square aspect ratio everywhere so a mix of portrait + landscape receipts
 * tiles cleanly (object-cover crops to fill). The lightbox restores the
 * native aspect with `object-contain`.
 *
 * Lightbox:
 *   - Full-viewport black backdrop
 *   - Close (top-left) + counter (top-centre) + download (top-right)
 *   - Prev/Next chevrons at the sides (hidden when only 1 attachment)
 *   - Keyboard: Esc closes, ← / → navigate
 *   - Swipe gesture on mobile (horizontal drag > 50px)
 *   - Body scroll locked while open
 *
 * PDF attachments: render as a generic "FileText" tile inline. Tapping
 * opens a new tab to the signed URL — the lightbox can't usefully preview
 * a PDF (iframe sandboxes are fragile across mobile browsers). */
export function AttachmentGallery({ attachments }: AttachmentGalleryProps) {
  const t = useTranslations('expenses.detail');
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  /* Touch-swipe state for the lightbox. Only horizontal — vertical drag
   * passes through so the user can still dismiss via system back gesture
   * on iOS PWA. Threshold 50px is the typical iOS UIKit swipe threshold. */
  const touchStartXRef = useRef<number | null>(null);

  const close = useCallback(() => setLightboxIndex(null), []);
  const next = useCallback(() => {
    setLightboxIndex((i) => (i === null ? null : Math.min(attachments.length - 1, i + 1)));
  }, [attachments.length]);
  const prev = useCallback(() => {
    setLightboxIndex((i) => (i === null ? null : Math.max(0, i - 1)));
  }, []);

  useEffect(() => {
    if (lightboxIndex === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
      else if (e.key === 'ArrowLeft') prev();
      else if (e.key === 'ArrowRight') next();
    };
    window.addEventListener('keydown', onKey);
    /* Lock background scroll — without this iOS bounces the page beneath
     * the lightbox when the user pans. Restore on close. */
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [lightboxIndex, close, next, prev]);

  if (attachments.length === 0) {
    return <p className="text-sm text-text-faint italic">{t('noAttachments')}</p>;
  }

  const current = lightboxIndex !== null ? attachments[lightboxIndex] : null;

  return (
    <>
      {/* Thumbnail grid */}
      <ul className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 sm:gap-3">
        {attachments.map((a, i) => {
          const showImage = isImageMime(a.eatMime) && a.signedUrl;
          return (
            <li key={a.eatId}>
              <button
                type="button"
                onClick={() => setLightboxIndex(i)}
                aria-label={t('lightboxOpenItem', { index: i + 1, total: attachments.length })}
                className={cn(
                  'relative w-full aspect-square rounded-lg overflow-hidden border border-border bg-surface-2',
                  'group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-bg',
                  'transition-transform duration-150 motion-reduce:transition-none',
                  'hover:scale-[1.02] active:scale-[0.98]',
                )}
              >
                {showImage ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={a.signedUrl!}
                    alt={t('lightboxImageAlt', { index: i + 1 })}
                    loading="lazy"
                    decoding="async"
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="h-full w-full flex flex-col items-center justify-center gap-1.5 text-text-muted">
                    {a.signedUrl ? (
                      <FileText className="h-9 w-9" strokeWidth={1.5} aria-hidden />
                    ) : (
                      <ImageOff className="h-9 w-9 text-text-faint" strokeWidth={1.5} aria-hidden />
                    )}
                    <span className="text-[11px] font-semibold uppercase tracking-wide">
                      {a.eatMime.replace(/^application\//, '').replace(/^image\//, '')}
                    </span>
                  </div>
                )}
                {/* Hover/focus scrim — subtle so it reads as "interactive"
                 * without competing with the receipt content underneath. */}
                <div
                  className="absolute inset-0 bg-black/0 group-hover:bg-black/15 group-focus-visible:bg-black/15 transition-colors duration-150 motion-reduce:transition-none"
                  aria-hidden
                />
              </button>
            </li>
          );
        })}
      </ul>

      {/* Lightbox */}
      {current && lightboxIndex !== null && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={t('lightboxAria')}
          className="fixed inset-0 z-[60] bg-black/95 flex flex-col"
          onClick={close}
          onTouchStart={(e) => {
            touchStartXRef.current = e.touches[0]?.clientX ?? null;
          }}
          onTouchEnd={(e) => {
            const start = touchStartXRef.current;
            touchStartXRef.current = null;
            if (start === null) return;
            const end = e.changedTouches[0]?.clientX ?? start;
            const dx = end - start;
            if (Math.abs(dx) < 50) return;
            if (dx > 0) prev();
            else next();
          }}
        >
          {/* Top bar — close + counter + download.
           * Padding includes safe-area-inset-top so the close button doesn't
           * sit behind the iOS Dynamic Island in PWA standalone. */}
          <div
            className="flex items-center justify-between gap-3 px-3 pt-[calc(env(safe-area-inset-top,0px)+12px)] pb-3 text-white"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={close}
              aria-label={t('lightboxClose')}
              className={cn(
                'h-10 w-10 rounded-full bg-white/10 hover:bg-white/20 active:bg-white/25',
                'inline-flex items-center justify-center backdrop-blur-sm',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70',
              )}
            >
              <X className="h-5 w-5" />
            </button>
            <span className="text-sm font-semibold tabular bg-white/10 rounded-full px-3 py-1 backdrop-blur-sm">
              {lightboxIndex + 1} / {attachments.length}
            </span>
            {current.signedUrl ? (
              <a
                href={current.signedUrl}
                download
                target="_blank"
                rel="noopener noreferrer"
                aria-label={t('lightboxDownload')}
                className={cn(
                  'h-10 w-10 rounded-full bg-white/10 hover:bg-white/20 active:bg-white/25',
                  'inline-flex items-center justify-center backdrop-blur-sm',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70',
                )}
                onClick={(e) => e.stopPropagation()}
              >
                <Download className="h-5 w-5" />
              </a>
            ) : (
              <div className="h-10 w-10" aria-hidden />
            )}
          </div>

          {/* Image / file area */}
          <div
            className="flex-1 flex items-center justify-center px-3 sm:px-12 overflow-hidden select-none"
            onClick={(e) => e.stopPropagation()}
          >
            {current.signedUrl && isImageMime(current.eatMime) ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={current.signedUrl}
                alt={t('lightboxImageAlt', { index: lightboxIndex + 1 })}
                className="max-h-full max-w-full object-contain rounded-md"
                draggable={false}
              />
            ) : current.signedUrl ? (
              /* Non-image (PDF). Lightbox can't render usefully — direct the
               * user to open it in a new tab where the OS PDF viewer takes
               * over. */
              <div className="text-center text-white">
                <FileText className="h-20 w-20 mx-auto mb-4 text-white/80" strokeWidth={1.5} />
                <a
                  href={current.signedUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 rounded-full bg-white/15 hover:bg-white/25 px-4 py-2 text-sm font-semibold backdrop-blur-sm"
                >
                  {t('lightboxOpenFile')}
                </a>
              </div>
            ) : (
              <div className="text-center text-white/70">
                <ImageOff className="h-20 w-20 mx-auto mb-3" strokeWidth={1.5} />
                <p className="text-sm">{t('lightboxUnavailable')}</p>
              </div>
            )}
          </div>

          {/* Prev/Next — only when there's somewhere to go.
           * On mobile the chevrons hug the viewport edges; swipe gesture
           * remains the primary interaction. */}
          {attachments.length > 1 && (
            <>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  prev();
                }}
                disabled={lightboxIndex === 0}
                aria-label={t('lightboxPrev')}
                className={cn(
                  'absolute left-2 sm:left-4 top-1/2 -translate-y-1/2',
                  'h-12 w-12 rounded-full bg-white/10 hover:bg-white/20 active:bg-white/25',
                  'inline-flex items-center justify-center text-white backdrop-blur-sm',
                  'disabled:opacity-25 disabled:hover:bg-white/10 disabled:cursor-not-allowed',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70',
                )}
              >
                <ChevronLeft className="h-6 w-6" />
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  next();
                }}
                disabled={lightboxIndex === attachments.length - 1}
                aria-label={t('lightboxNext')}
                className={cn(
                  'absolute right-2 sm:right-4 top-1/2 -translate-y-1/2',
                  'h-12 w-12 rounded-full bg-white/10 hover:bg-white/20 active:bg-white/25',
                  'inline-flex items-center justify-center text-white backdrop-blur-sm',
                  'disabled:opacity-25 disabled:hover:bg-white/10 disabled:cursor-not-allowed',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70',
                )}
              >
                <ChevronRight className="h-6 w-6" />
              </button>
            </>
          )}

          {/* Bottom: file metadata + safe-area-inset-bottom so the line
           * doesn't sit on the iOS home indicator. */}
          <div
            className="px-3 pb-[calc(env(safe-area-inset-bottom,0px)+12px)] pt-3 text-center text-white/70 text-xs"
            onClick={(e) => e.stopPropagation()}
          >
            {current.eatMime} · {formatSize(current.eatSizeBytes)}
          </div>
        </div>
      )}
    </>
  );
}
