'use client';

import { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Camera, ImagePlus, Loader2, X } from 'lucide-react';
import { Button, cn } from '@car-v2/ui';

const MAX_FILES = 5;
const MAX_BYTES = 5 * 1024 * 1024;

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

      <div className="flex flex-col sm:flex-row gap-2">
        <Button
          type="button"
          variant="secondary"
          size="lg"
          iconLeft={converting ? <Loader2 className="animate-spin" /> : <Camera />}
          onClick={() => cameraRef.current?.click()}
          disabled={disabled}
          className="flex-1"
        >
          {converting ? t('receiptConverting') : t('receiptCamera')}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="lg"
          iconLeft={<ImagePlus />}
          onClick={() => galleryRef.current?.click()}
          disabled={disabled}
          className="flex-1"
        >
          {t('receiptGallery')}
        </Button>
      </div>

      {files.length > 0 && (
        <ul className="mt-3 grid grid-cols-3 sm:grid-cols-5 gap-2">
          {files.map((f, i) => {
            const url = previewUrlsRef.current.get(f);
            return (
              <li
                key={`${f.name}-${i}`}
                className={cn(
                  'relative aspect-square rounded-lg overflow-hidden border border-border bg-surface-2',
                  'group',
                )}
              >
                {url && (
                  /* Native <img> is fine here — these are tiny client-only
                   * blob URLs, not optimised remote images. next/image would
                   * need a domain config it can't have for blob:. */
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={url} alt={f.name} className="h-full w-full object-cover" />
                )}
                <button
                  type="button"
                  aria-label={t('receiptRemoveAria')}
                  onClick={() => remove(i)}
                  className={cn(
                    'absolute top-1 right-1 h-7 w-7 rounded-full bg-bg/80 text-text',
                    'backdrop-blur flex items-center justify-center',
                    'hover:bg-bg active:scale-95',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  )}
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <p className="mt-2 text-xs text-text-muted">{t('receiptHint')}</p>
    </div>
  );
}
