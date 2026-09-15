'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Camera, Images, Loader2, Paperclip, WifiOff } from 'lucide-react';
import { Button, cn, toast } from '@car-v2/ui';
import {
  ATTACHMENT_ACCEPT,
  ATTACHMENT_MAX_BYTES,
  ATTACHMENT_MAX_FILES,
} from '@car-v2/shared/zod';
import { AttachmentGrid, type AttachmentViewItem } from './attachment-viewer';

/**
 * ONE attachment picker for the whole app (REQ-20260915).
 *
 * Replaces `CostReceiptInput` (truck trips + maintenance) and
 * `ReceiptCameraInput` (car expenses). Both are still fully served:
 *   - every allowed format, not just image/PDF (see ATTACHMENT_ACCEPT);
 *   - each file shows its NAME and size, and opens full-screen with a
 *     download button (AttachmentGrid);
 *   - `camera` turns on the driver's capture-first layout, including the
 *     iOS HEIC→JPEG transcode and the "permission prompt didn't show" hint.
 *
 * Saved files and freshly picked ones render in the SAME grid, so the user
 * sees one consistent list rather than two stacked widgets.
 */

/** A file already persisted on the record (edit mode). */
export interface StoredAttachment {
  id: string;
  s3Key: string;
  mime: string;
  sizeBytes: number;
  /** Original name; null for rows saved before it was stored. */
  fileName?: string | null;
  signedUrl: string | null;
}

export type AttachmentInputError = 'tooManyFiles' | 'fileTooLarge' | 'badType' | 'cameraDenied' | 'heicFailed';

export interface AttachmentInputProps {
  /** Saved files the user has KEPT. Dropping one here soft-deletes on save. */
  existing: StoredAttachment[];
  onExistingChange: (next: StoredAttachment[]) => void;
  /** Newly picked files, uploaded by the parent on submit. */
  files: File[];
  onFilesChange: (next: File[]) => void;
  disabled?: boolean;
  /** Total cap across saved + pending. */
  maxFiles?: number;
  maxBytes?: number;
  /** Capture-first layout for field users (car expenses, driver flows). */
  camera?: boolean;
  /** Per-tile upload overlay while the parent uploads. */
  uploadProgress?: { currentIndex: number; total: number } | null;
  /** Surface an error the parent wants to phrase itself; a toast is shown
   * either way so the component is usable without wiring this. */
  onError?: (key: AttachmentInputError) => void;
}

const HEIC_MIMES = new Set(['image/heic', 'image/heif', 'image/heic-sequence', 'image/heif-sequence']);
const HEIC_EXT_RE = /\.(heic|heif)$/i;
const isHeic = (f: File) => HEIC_MIMES.has(f.type) || HEIC_EXT_RE.test(f.name);

/** MIME with the fallback the uploader uses — `File.type` is empty
 * surprisingly often (some Android pickers, clipboard paste, old WebViews). */
export function resolveFileMime(f: File): string {
  if (f.type) return f.type;
  if (/\.pdf$/i.test(f.name)) return 'application/pdf';
  if (/\.(xlsx|xls)$/i.test(f.name)) return 'application/vnd.ms-excel';
  if (/\.(docx|doc)$/i.test(f.name)) return 'application/msword';
  if (/\.csv$/i.test(f.name)) return 'text/csv';
  if (/\.txt$/i.test(f.name)) return 'text/plain';
  return 'image/jpeg';
}

/** Receipts need the network (direct S3 PUT) — no offline queue in this cut. */
function useOnline(): boolean {
  const [online, setOnline] = useState(true);
  useEffect(() => {
    const sync = () => setOnline(navigator.onLine);
    sync();
    window.addEventListener('online', sync);
    window.addEventListener('offline', sync);
    return () => {
      window.removeEventListener('online', sync);
      window.removeEventListener('offline', sync);
    };
  }, []);
  return online;
}

export function AttachmentInput({
  existing,
  onExistingChange,
  files,
  onFilesChange,
  disabled,
  maxFiles = ATTACHMENT_MAX_FILES,
  maxBytes = ATTACHMENT_MAX_BYTES,
  camera = false,
  uploadProgress,
  onError,
}: AttachmentInputProps) {
  const t = useTranslations('attachments');
  const pickerRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  /* Two consecutive empty camera results on iOS almost always means the
   * permission prompt was denied or dismissed — nudge instead of staying mute. */
  const emptyCameraTapsRef = useRef(0);
  const [converting, setConverting] = useState(false);
  const online = useOnline();

  /* Object URLs for pending files, built in useMemo so each URL exists on the
   * SAME render the file first appears; the effect revokes the prior batch. */
  const previews = useMemo(() => files.map((f) => ({ file: f, url: URL.createObjectURL(f) })), [files]);
  useEffect(
    () => () => {
      for (const p of previews) URL.revokeObjectURL(p.url);
    },
    [previews],
  );

  const total = existing.length + files.length;
  const busy = !!disabled || converting || !!uploadProgress;
  const canAdd = !busy && online && total < maxFiles;

  const fail = (key: AttachmentInputError, msg: string) => {
    onError?.(key);
    toast.error(msg);
  };

  /* HEIC → JPEG. Dynamic import keeps ~70KB out of the initial bundle; only
   * loaded the first time a phone actually hands us a HEIC. */
  const convertHeic = async (file: File): Promise<File> => {
    const heic2any = (await import('heic2any')).default;
    const result = await heic2any({ blob: file, toType: 'image/jpeg', quality: 0.85 });
    const blob = Array.isArray(result) ? result[0]! : result;
    return new File([blob], file.name.replace(HEIC_EXT_RE, '') + '.jpg', {
      type: 'image/jpeg',
      lastModified: file.lastModified,
    });
  };

  const addFiles = async (incoming: FileList | null, source: 'camera' | 'picker') => {
    if (!incoming || incoming.length === 0) {
      if (source === 'camera') {
        emptyCameraTapsRef.current += 1;
        if (emptyCameraTapsRef.current >= 2) {
          fail('cameraDenied', t('errCameraDenied'));
          emptyCameraTapsRef.current = 0;
        }
      }
      return;
    }
    emptyCameraTapsRef.current = 0;

    /* Transcode HEIC BEFORE the size check: a 4MB HEIC often lands at ~3MB as
     * JPEG, so checking first would reject the camera unfairly. */
    let arr = Array.from(incoming);
    if (arr.some(isHeic)) {
      setConverting(true);
      try {
        arr = await Promise.all(arr.map(async (f) => (isHeic(f) ? convertHeic(f) : f)));
      } catch {
        setConverting(false);
        fail('heicFailed', t('errHeic'));
        return;
      }
      setConverting(false);
    }

    const tooBig = arr.find((f) => f.size > maxBytes);
    if (tooBig) {
      fail('fileTooLarge', t('errTooLarge', { max: Math.floor(maxBytes / (1024 * 1024)) }));
      return;
    }

    const room = maxFiles - total;
    if (room <= 0) {
      fail('tooManyFiles', t('errTooMany', { max: maxFiles }));
      return;
    }
    if (arr.length > room) {
      fail('tooManyFiles', t('errTooMany', { max: maxFiles }));
      onFilesChange([...files, ...arr.slice(0, room)]);
      return;
    }
    onFilesChange([...files, ...arr]);
  };

  /* Saved + pending in ONE list so the grid looks the same everywhere. */
  const items: AttachmentViewItem[] = [
    ...existing.map((a) => ({
      key: a.id,
      name: a.fileName?.trim() || t('savedFallback'),
      mime: a.mime,
      sizeBytes: a.sizeBytes,
      url: a.signedUrl,
    })),
    ...files.map((f, i) => ({
      key: `${f.name}-${i}`,
      name: f.name,
      mime: resolveFileMime(f),
      sizeBytes: f.size,
      url: previews.find((p) => p.file === f)?.url ?? null,
    })),
  ];

  const removeAt = (_item: AttachmentViewItem, index: number) => {
    if (index < existing.length) onExistingChange(existing.filter((_, i) => i !== index));
    else onFilesChange(files.filter((_, i) => i !== index - existing.length));
  };

  return (
    <div className="space-y-2">
      <input
        ref={pickerRef}
        type="file"
        accept={ATTACHMENT_ACCEPT}
        multiple
        className="sr-only"
        onChange={(e) => {
          void addFiles(e.target.files, 'picker');
          e.target.value = '';
        }}
      />
      {camera && (
        /* Separate element: iOS treats `capture` as a hard switch and ignores
         * re-clicks if the attribute is reassigned on the same input. */
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
      )}

      <AttachmentGrid
        items={items}
        onRemove={busy ? undefined : removeAt}
        disabled={busy}
        uploadProgress={uploadProgress}
      />

      {converting ? (
        <p className="flex items-center gap-1.5 text-xs text-text-muted">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          {t('converting')}
        </p>
      ) : canAdd ? (
        <div className="flex flex-wrap items-center gap-2">
          {camera && (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => cameraRef.current?.click()}
              className="gap-1.5"
            >
              <Camera className="h-4 w-4" />
              {t('takePhoto')}
            </Button>
          )}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => pickerRef.current?.click()}
            className={cn('gap-1.5 text-xs text-text-muted hover:text-text', camera && 'text-text')}
          >
            {camera ? <Images className="h-4 w-4" /> : <Paperclip className="h-3.5 w-3.5" />}
            {total > 0 ? t('addMore') : camera ? t('chooseFile') : t('add')}
          </Button>
        </div>
      ) : !online ? (
        <p className="flex items-center gap-1.5 text-xs text-text-faint">
          <WifiOff className="h-3.5 w-3.5" />
          {t('offline')}
        </p>
      ) : total >= maxFiles ? (
        <p className="text-xs text-text-faint">{t('maxReached', { max: maxFiles })}</p>
      ) : null}
    </div>
  );
}
