'use client';

import { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Camera, ImagePlus, Loader2, Plus, X } from 'lucide-react';
import { cn } from '@car-v2/ui';

const MAX_FILES = 5;
/* 10MB matches the server S3_MAX_UPLOAD_BYTES default. Previously 5MB —
 * which rejected a HEIC-from-iPhone-15-Pro after conversion when the JPEG
 * landed at ~6MB (HEIC compresses better than JPEG so the transcode often
 * grows the file). Aligning client + server caps removes a UX cliff where
 * the client said "OK" then the server said "Invalid input". */
const MAX_BYTES = 10 * 1024 * 1024;

/* HEIC / HEIF MIME types that iPhone produces by default for camera photos.
 * Browsers will surface either the official IANA names or empty-string when
 * iOS doesn't include the mime, so we also sniff the file extension. */
const HEIC_MIMES = new Set(['image/heic', 'image/heif', 'image/heic-sequence', 'image/heif-sequence']);
const HEIC_EXT_RE = /\.(heic|heif)$/i;

function isHeic(file: File): boolean {
  return HEIC_MIMES.has(file.type) || HEIC_EXT_RE.test(file.name);
}

export type ReceiptInputError =
  | 'tooManyFiles'
  | 'fileTooLarge'
  | 'cameraDenied'
  | 'heicConversionFailed';

interface ReceiptCameraInputProps {
  files: File[];
  onChange: (files: File[]) => void;
  onError?: (key: ReceiptInputError) => void;
}

/* Camera-first receipt attachment input.
 *
 * The "📷 Take photo" button uses `capture="environment"` — on a phone that
 * goes straight to the rear camera, skipping the system picker. On a desktop
 * it falls back to the standard file chooser.
 *
 * The "🖼 Choose from gallery" button omits `capture` so iOS shows the photo
 * library (after-the-fact uploads).
 *
 * iOS HEIC handling: iPhones save camera photos as HEIC by default. Servers
 * (and most Android browsers' <img> renderers) can't handle HEIC, so we
 * transcode to JPEG client-side via the `heic2any` library, loaded lazily
 * (~70KB gzip) only when we actually see a HEIC file. The conversion is async
 * — UI shows a spinner during processing.
 *
 * iOS PWA camera permission: Safari grants camera access per-session. If the
 * user denies once or cancels the picker without choosing a file, we surface a
 * gentle "did the permission prompt show?" hint after the second consecutive
 * empty result — see `tapWithoutFileRef`. */
export function ReceiptCameraInput({ files, onChange, onError }: ReceiptCameraInputProps) {
  const t = useTranslations('expenses.submit');
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);
  const previewUrlsRef = useRef<Map<File, string>>(new Map());

  /* Tracks consecutive camera taps that resulted in zero files added. After
   * two in a row we assume the OS-level permission was denied / the dialog
   * didn't show and surface a help toast. Reset whenever a file lands. */
  const tapWithoutFileRef = useRef(0);

  const [converting, setConverting] = useState(false);

  /* Manage object URLs for previews — revoke when the file leaves the list so
   * we don't leak blob memory. Done in effect to stay strict-mode-safe. */
  useEffect(() => {
    const urls = previewUrlsRef.current;
    for (const f of files) {
      if (!urls.has(f)) urls.set(f, URL.createObjectURL(f));
    }
    for (const [f, url] of urls.entries()) {
      if (!files.includes(f)) {
        URL.revokeObjectURL(url);
        urls.delete(f);
      }
    }
    return () => {
      // Cleanup-on-unmount handled by the same logic next render; final unmount
      // is the only branch we need to explicitly revoke from.
    };
  }, [files]);

  useEffect(() => {
    /* On unmount: revoke any remaining URLs. Snapshot the ref into a local at
     * effect-mount time so React's exhaustive-deps lint stays happy — the ref
     * value itself is stable for this component's lifetime, but the rule
     * doesn't trust that. */
    const urls = previewUrlsRef.current;
    return () => {
      for (const url of urls.values()) URL.revokeObjectURL(url);
      urls.clear();
    };
  }, []);

  /* HEIC → JPEG transcode. Dynamic import keeps the library out of the
   * initial bundle — only loaded the first time a phone hands us a HEIC.
   * Quality 0.85 balances size (~70% of HEIC) and readability for receipts. */
  const convertHeic = async (file: File): Promise<File> => {
    const heic2any = (await import('heic2any')).default;
    const result = await heic2any({ blob: file, toType: 'image/jpeg', quality: 0.85 });
    const blob = Array.isArray(result) ? result[0]! : result;
    const newName = file.name.replace(HEIC_EXT_RE, '') + '.jpg';
    return new File([blob], newName, { type: 'image/jpeg', lastModified: file.lastModified });
  };

  const addFiles = async (incoming: FileList | null, source: 'camera' | 'gallery') => {
    if (!incoming || incoming.length === 0) {
      /* Empty result from the file picker. On gallery this is just "user
       * cancelled" — quiet. On camera, the second consecutive zero-file tap
       * almost always means iOS Safari either denied permission or the prompt
       * was dismissed without granting. Nudge the user. */
      if (source === 'camera') {
        tapWithoutFileRef.current += 1;
        if (tapWithoutFileRef.current >= 2) {
          onError?.('cameraDenied');
          tapWithoutFileRef.current = 0;
        }
      }
      return;
    }
    tapWithoutFileRef.current = 0;

    /* Two-pass processing: convert HEICs first (async), then validate the
     * resulting File set. We do the conversion before size-check because a
     * HEIC at 4MB often becomes a JPEG at ~3MB — letting an oversize HEIC
     * through to the size cap would block the camera unfairly. */
    const arr = Array.from(incoming);
    const hasHeic = arr.some(isHeic);
    let processed: File[];
    if (hasHeic) {
      setConverting(true);
      try {
        processed = await Promise.all(
          arr.map(async (f) => (isHeic(f) ? await convertHeic(f) : f)),
        );
      } catch {
        onError?.('heicConversionFailed');
        setConverting(false);
        return;
      }
      setConverting(false);
    } else {
      processed = arr;
    }

    /* Size check applied to the post-conversion file. */
    for (const f of processed) {
      if (f.size > MAX_BYTES) {
        onError?.('fileTooLarge');
        return;
      }
    }

    const merged = [...files, ...processed];
    if (merged.length > MAX_FILES) {
      onError?.('tooManyFiles');
      onChange(merged.slice(0, MAX_FILES));
      return;
    }
    onChange(merged);
  };

  const remove = (idx: number) => {
    onChange(files.filter((_, i) => i !== idx));
  };

  const disabled = files.length >= MAX_FILES || converting;

  return (
    <div>
      {/* Hidden inputs — buttons trigger them. Two separate inputs because iOS
       * treats `capture` as a hard switch and ignores re-clicks if you reassign
       * the attribute on the same element.
       *
       * `accept` includes explicit HEIC mimes so iOS surfaces "Photo Library"
       * even when the user's most recent photos are HEIC (some older iOS
       * versions would otherwise grey them out under a plain `image/*`). */}
      <input
        ref={cameraRef}
        type="file"
        accept="image/*,image/heic,image/heif"
        capture="environment"
        className="sr-only"
        onChange={(e) => {
          void addFiles(e.target.files, 'camera');
          e.target.value = '';
        }}
      />
      <input
        ref={galleryRef}
        type="file"
        accept="image/*,image/heic,image/heif"
        multiple
        className="sr-only"
        onChange={(e) => {
          void addFiles(e.target.files, 'gallery');
          e.target.value = '';
        }}
      />

      {files.length === 0 ? (
        /* Empty state — large dashed dropzone card. Tap = camera (driver is
         * almost always capturing in the moment). Gallery is offered as a
         * smaller secondary link below so the primary intent stays obvious. */
        <div className="space-y-3">
          <button
            type="button"
            onClick={() => cameraRef.current?.click()}
            disabled={converting}
            className={cn(
              'w-full rounded-xl border-2 border-dashed border-border bg-surface-2/40',
              'px-4 py-7 flex flex-col items-center justify-center gap-3 min-h-[148px]',
              'hover:border-accent/40 hover:bg-accent-soft/30 active:scale-[0.99]',
              'transition-all duration-150 motion-reduce:transition-none',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-bg',
              'disabled:opacity-60 disabled:pointer-events-none',
            )}
          >
            <div className="h-14 w-14 rounded-full bg-accent-soft text-accent flex items-center justify-center">
              {converting
                ? <Loader2 className="h-7 w-7 animate-spin" />
                : <Camera className="h-7 w-7" strokeWidth={1.8} />}
            </div>
            <div className="text-center">
              <div className="text-md font-semibold text-text">
                {converting ? t('receiptConverting') : t('receiptEmptyTitle')}
              </div>
              <div className="text-xs text-text-muted mt-0.5 leading-relaxed max-w-xs mx-auto">
                {t('receiptEmptyDesc')}
              </div>
            </div>
          </button>
          <button
            type="button"
            onClick={() => galleryRef.current?.click()}
            disabled={disabled}
            className={cn(
              'mx-auto flex items-center gap-1.5 text-sm font-medium text-accent',
              'hover:underline focus-visible:outline-none focus-visible:underline',
              'disabled:opacity-50 disabled:no-underline disabled:cursor-not-allowed',
            )}
          >
            <ImagePlus className="h-4 w-4" /> {t('receiptGallery')}
          </button>
          <p className="text-center text-[11px] text-text-muted">{t('receiptHint')}</p>
        </div>
      ) : (
        /* Filled state — thumbnail tiles + a trailing "+" tile that mirrors
         * the dashed dropzone (visual continuity with the empty state). The
         * counter + gallery link below give a clear escape hatch when the
         * camera-direct affordance isn't what the user wants. */
        <div className="space-y-3">
          <ul className="grid grid-cols-3 sm:grid-cols-4 gap-2">
            {files.map((f, i) => {
              const url = previewUrlsRef.current.get(f);
              return (
                <li
                  key={`${f.name}-${i}`}
                  className="relative aspect-square rounded-lg overflow-hidden border border-border bg-surface-2 group"
                >
                  {url && (
                    /* Native <img> — blob URLs aren't a fit for next/image. */
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={url} alt={f.name} className="h-full w-full object-cover" />
                  )}
                  <button
                    type="button"
                    aria-label={t('receiptRemoveAria')}
                    onClick={() => remove(i)}
                    className={cn(
                      'absolute top-1.5 right-1.5 h-9 w-9 rounded-full bg-bg/85 text-text shadow-sm',
                      'backdrop-blur flex items-center justify-center',
                      'hover:bg-bg active:scale-95',
                      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                    )}
                  >
                    <X className="h-4 w-4" />
                  </button>
                </li>
              );
            })}
            {files.length < MAX_FILES && (
              <li>
                <button
                  type="button"
                  onClick={() => cameraRef.current?.click()}
                  disabled={converting}
                  aria-label={t('receiptAddMore')}
                  className={cn(
                    'w-full aspect-square rounded-lg border-2 border-dashed border-border bg-surface-2/40',
                    'flex flex-col items-center justify-center gap-1',
                    'hover:border-accent/40 hover:bg-accent-soft/30 active:scale-95',
                    'transition-all duration-150 motion-reduce:transition-none',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-bg',
                    'disabled:opacity-60 disabled:pointer-events-none',
                  )}
                >
                  {converting
                    ? <Loader2 className="h-6 w-6 animate-spin text-text-muted" />
                    : <Plus className="h-6 w-6 text-text-muted" strokeWidth={1.8} />}
                  <span className="text-[11px] font-medium text-text-muted leading-none">
                    {t('receiptAddMore')}
                  </span>
                </button>
              </li>
            )}
          </ul>
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs text-text-muted tabular">
              {t('receiptCounter', { count: files.length, max: MAX_FILES })}
            </span>
            {files.length < MAX_FILES && (
              <button
                type="button"
                onClick={() => galleryRef.current?.click()}
                disabled={disabled}
                className={cn(
                  'inline-flex items-center gap-1.5 text-sm font-medium text-accent',
                  'hover:underline focus-visible:outline-none focus-visible:underline',
                  'disabled:opacity-50 disabled:no-underline disabled:cursor-not-allowed',
                )}
              >
                <ImagePlus className="h-4 w-4" /> {t('receiptGallery')}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
