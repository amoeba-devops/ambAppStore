'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  ChevronLeft,
  ChevronRight,
  Download,
  ExternalLink,
  FileSpreadsheet,
  FileText,
  FileType,
  ImageOff,
  X,
} from 'lucide-react';
import { Button, cn } from '@car-v2/ui';

/**
 * ONE attachment viewer for the whole app (REQ-20260915).
 *
 * Replaces three divergent surfaces: the expense gallery (had a lightbox +
 * download but no filename), the truck trip detail tiles (tap opened a raw
 * tab, no name, no download) and the truck form thumbnails (no viewing at
 * all). Every attachment now gets the same four affordances the user asked
 * for: any allowed format, open large, download, and its NAME on screen.
 *
 * `AttachmentGrid` renders the tiles; it is also what the editable input
 * embeds, so "what I'm about to upload" and "what is already saved" look
 * identical. `AttachmentLightbox` is the full-screen layer.
 */

/** One file to display — a saved row OR a freshly picked local File. */
export interface AttachmentViewItem {
  /** Stable React key (row id, or `name-index` for a pending file). */
  key: string;
  /** Name shown under the tile and in the lightbox bar. */
  name: string;
  mime: string;
  sizeBytes: number;
  /** Signed GET URL (saved) or object URL (pending). Null = can't render. */
  url: string | null;
}

export const isImageMime = (m: string): boolean => m.startsWith('image/');
const isPdfMime = (m: string): boolean => m === 'application/pdf';

/** Human-readable size — matches the expense gallery's old formatting. */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Icon per family so a spreadsheet doesn't look like a Word file. */
function FileGlyph({ mime, className }: { mime: string; className?: string }) {
  if (isPdfMime(mime)) return <FileType className={className} strokeWidth={1.5} aria-hidden />;
  if (/sheet|excel|csv/i.test(mime)) return <FileSpreadsheet className={className} strokeWidth={1.5} aria-hidden />;
  return <FileText className={className} strokeWidth={1.5} aria-hidden />;
}

/** Short type label on a non-image tile: "PDF", "DOCX", "CSV"… */
function typeLabel(mime: string, name: string): string {
  const ext = name.includes('.') ? name.split('.').pop() : undefined;
  if (ext && ext.length <= 5) return ext.toUpperCase();
  return mime
    .replace(/^application\/(vnd\.openxmlformats-officedocument\.)?/, '')
    .replace(/^(wordprocessingml|spreadsheetml)\./, '')
    .replace(/^text\//, '')
    .slice(0, 8)
    .toUpperCase();
}

/* ── Grid ──────────────────────────────────────────────────────────────── */

export interface AttachmentGridProps {
  items: AttachmentViewItem[];
  /** Omit for read-only (detail screens); provide to show a remove button. */
  onRemove?: (item: AttachmentViewItem, index: number) => void;
  /** Locks remove while a submit/upload is in flight. */
  disabled?: boolean;
  /** Per-tile overlay during upload: index currently uploading + total. */
  uploadProgress?: { currentIndex: number; total: number } | null;
  className?: string;
}

export function AttachmentGrid({
  items,
  onRemove,
  disabled,
  uploadProgress,
  className,
}: AttachmentGridProps) {
  const t = useTranslations('attachments');
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const [failed, setFailed] = useState<Set<string>>(new Set());

  if (items.length === 0) return null;

  return (
    <>
      <ul className={cn('grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2', className)}>
        {items.map((it, i) => {
          const showImage = isImageMime(it.mime) && it.url && !failed.has(it.key);
          const state = uploadProgress
            ? i < uploadProgress.currentIndex
              ? 'done'
              : i === uploadProgress.currentIndex
                ? 'uploading'
                : 'queued'
            : null;
          return (
            <li key={it.key} className="min-w-0">
              <div className="relative aspect-square rounded-lg overflow-hidden border border-border bg-surface-2">
                <button
                  type="button"
                  onClick={() => setOpenIndex(i)}
                  aria-label={t('open', { name: it.name })}
                  className={cn(
                    'block h-full w-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                    state === 'uploading' && 'opacity-60',
                    state === 'queued' && 'opacity-50',
                  )}
                >
                  {showImage ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={it.url!}
                      alt={it.name}
                      loading="lazy"
                      className="h-full w-full object-cover"
                      onError={() => setFailed((s) => new Set(s).add(it.key))}
                    />
                  ) : (
                    <div className="h-full w-full flex flex-col items-center justify-center gap-1 text-text-muted">
                      {it.url || !isImageMime(it.mime) ? (
                        <FileGlyph mime={it.mime} className="h-8 w-8" />
                      ) : (
                        <ImageOff className="h-8 w-8" strokeWidth={1.5} aria-hidden />
                      )}
                      <span className="text-[10px] font-semibold uppercase tracking-wide">
                        {typeLabel(it.mime, it.name)}
                      </span>
                    </div>
                  )}
                </button>

                {onRemove && !disabled && (
                  <button
                    type="button"
                    aria-label={t('remove', { name: it.name })}
                    onClick={() => onRemove(it, i)}
                    className={cn(
                      'absolute top-1 right-1 h-7 w-7 rounded-full bg-bg/85 text-text shadow-sm',
                      'backdrop-blur flex items-center justify-center hover:bg-bg active:scale-95',
                      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                    )}
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>

              {/* The name — the piece every previous surface was missing. */}
              <p className="mt-1 truncate text-[11px] leading-tight text-text" title={it.name}>
                {it.name}
              </p>
              <p className="truncate text-[10px] leading-tight text-text-faint">{formatBytes(it.sizeBytes)}</p>
            </li>
          );
        })}
      </ul>

      {openIndex !== null && items[openIndex] && (
        <AttachmentLightbox
          items={items}
          index={openIndex}
          onIndexChange={setOpenIndex}
          onClose={() => setOpenIndex(null)}
        />
      )}
    </>
  );
}

/* ── Lightbox ──────────────────────────────────────────────────────────── */

export interface AttachmentLightboxProps {
  items: AttachmentViewItem[];
  index: number;
  onIndexChange: (i: number) => void;
  onClose: () => void;
}

/**
 * Full-viewport overlay: image fits with `object-contain`; anything else shows
 * a large glyph plus explicit "open in new tab" / "download" buttons, because
 * sandboxed PDF iframes are unreliable across mobile browsers.
 *
 * Esc closes, ← / → navigate, horizontal swipe > 50px navigates on touch, and
 * body scroll is locked while open.
 */
export function AttachmentLightbox({ items, index, onIndexChange, onClose }: AttachmentLightboxProps) {
  const t = useTranslations('attachments');
  const touchStartXRef = useRef<number | null>(null);
  const current = items[index];

  const next = useCallback(
    () => onIndexChange(Math.min(items.length - 1, index + 1)),
    [index, items.length, onIndexChange],
  );
  const prev = useCallback(() => onIndexChange(Math.max(0, index - 1)), [index, onIndexChange]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      else if (e.key === 'ArrowRight') next();
      else if (e.key === 'ArrowLeft') prev();
    };
    window.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [next, prev, onClose]);

  if (!current) return null;
  const showImage = isImageMime(current.mime) && current.url;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/95 flex flex-col"
      role="dialog"
      aria-modal="true"
      aria-label={t('lightboxAria')}
      onClick={onClose}
      onTouchStart={(e) => {
        touchStartXRef.current = e.touches[0]?.clientX ?? null;
      }}
      onTouchEnd={(e) => {
        const start = touchStartXRef.current;
        touchStartXRef.current = null;
        if (start === null) return;
        const dx = (e.changedTouches[0]?.clientX ?? start) - start;
        if (Math.abs(dx) < 50) return;
        if (dx > 0) prev();
        else next();
      }}
    >
      {/* Top bar: close · name + counter · download */}
      <div
        className="flex items-center gap-3 px-3 pt-[calc(env(safe-area-inset-top,0px)+12px)] pb-3 text-white"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label={t('close')}
          className="h-10 w-10 shrink-0 rounded-full bg-white/10 hover:bg-white/20 active:bg-white/25 inline-flex items-center justify-center backdrop-blur-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="min-w-0 flex-1 text-center">
          <p className="truncate text-sm font-semibold" title={current.name}>
            {current.name}
          </p>
          <p className="text-xs text-white/70 tabular">
            {formatBytes(current.sizeBytes)}
            {items.length > 1 ? ` · ${index + 1}/${items.length}` : ''}
          </p>
        </div>

        {current.url ? (
          <a
            href={current.url}
            download={current.name}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={t('download')}
            className="h-10 w-10 shrink-0 rounded-full bg-white/10 hover:bg-white/20 active:bg-white/25 inline-flex items-center justify-center backdrop-blur-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
            onClick={(e) => e.stopPropagation()}
          >
            <Download className="h-5 w-5" />
          </a>
        ) : (
          <div className="h-10 w-10 shrink-0" aria-hidden />
        )}
      </div>

      {/* Stage */}
      <div className="relative flex-1 min-h-0 flex items-center justify-center px-3 pb-[calc(env(safe-area-inset-bottom,0px)+16px)]">
        {showImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={current.url!}
            alt={current.name}
            className="max-h-full max-w-full object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <div
            className="flex flex-col items-center gap-4 text-white/85"
            onClick={(e) => e.stopPropagation()}
          >
            <FileGlyph mime={current.mime} className="h-20 w-20" />
            <p className="text-sm font-semibold">{typeLabel(current.mime, current.name)}</p>
            {current.url ? (
              <div className="flex flex-wrap items-center justify-center gap-2">
                <Button asChild variant="secondary" size="md">
                  <a href={current.url} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="h-4 w-4" />
                    {t('openNewTab')}
                  </a>
                </Button>
                <Button asChild variant="secondary" size="md">
                  <a href={current.url} download={current.name} target="_blank" rel="noopener noreferrer">
                    <Download className="h-4 w-4" />
                    {t('download')}
                  </a>
                </Button>
              </div>
            ) : (
              <p className="text-sm text-white/60">{t('unavailable')}</p>
            )}
          </div>
        )}

        {items.length > 1 && (
          <>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                prev();
              }}
              disabled={index === 0}
              aria-label={t('prev')}
              className="absolute left-2 top-1/2 -translate-y-1/2 h-11 w-11 rounded-full bg-white/10 text-white hover:bg-white/20 disabled:opacity-25 inline-flex items-center justify-center backdrop-blur-sm"
            >
              <ChevronLeft className="h-6 w-6" />
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                next();
              }}
              disabled={index === items.length - 1}
              aria-label={t('next')}
              className="absolute right-2 top-1/2 -translate-y-1/2 h-11 w-11 rounded-full bg-white/10 text-white hover:bg-white/20 disabled:opacity-25 inline-flex items-center justify-center backdrop-blur-sm"
            >
              <ChevronRight className="h-6 w-6" />
            </button>
          </>
        )}
      </div>
    </div>
  );
}
