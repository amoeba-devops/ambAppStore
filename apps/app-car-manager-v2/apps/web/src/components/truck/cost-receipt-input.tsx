'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { FileText, Paperclip, WifiOff, X } from 'lucide-react';
import { Button, cn, toast } from '@car-v2/ui';
import {
  TRUCK_COST_ATTACHMENT_MAX_BYTES,
  TRUCK_COST_ATTACHMENT_MAX_PER_KIND,
} from '@car-v2/shared/zod';

/** A receipt already saved on the trip (edit mode). Echoed back on save so
 * kept attachments survive; dropped ones get soft-deleted server-side. */
export interface ExistingCostAttachment {
  id: string;
  s3Key: string;
  mime: string;
  sizeBytes: number;
  signedUrl: string | null;
}

interface CostReceiptInputProps {
  /** Already-saved attachments (edit). */
  existing: ExistingCostAttachment[];
  onExistingChange: (next: ExistingCostAttachment[]) => void;
  /** Newly picked files, uploaded on submit. */
  files: File[];
  onFilesChange: (next: File[]) => void;
  /** Locked during submit/upload — no add, no remove. */
  disabled?: boolean;
}

const ACCEPT = 'image/*,application/pdf';
const isImage = (m: string) => m.startsWith('image/');

/** Are we online? Receipts need the network (S3 PUT), so the add control is
 * disabled offline with a hint — no offline queue in this first cut. */
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

/**
 * Receipt/invoice attachment field for a truck trip cost (REQ-20260709).
 * Image + PDF, multiple files, optional. Used by both the manager trip form and
 * the driver completion form — a plain file field, no role gating.
 *
 * Shows saved attachments (removable) + newly picked files (removable) as a
 * thumbnail row with a compact "attach" button. Client-validates type / size
 * (50MB) / count before anything hits the network.
 */
export function CostReceiptInput({
  existing,
  onExistingChange,
  files,
  onFilesChange,
  disabled,
}: CostReceiptInputProps) {
  const t = useTranslations('truckCostReceipt');
  const inputRef = useRef<HTMLInputElement>(null);
  const online = useOnline();

  /* Object URLs for new-file previews. Built with useMemo (not a ref) so each
   * URL exists on the SAME render the file first appears — a ref mutated in an
   * effect wouldn't re-render, leaving the <img> without a src. The effect
   * revokes the previous batch when `files` changes / on unmount (no blob leak). */
  const previews = useMemo(
    () => files.map((f) => ({ file: f, url: URL.createObjectURL(f) })),
    [files],
  );
  useEffect(
    () => () => {
      for (const p of previews) URL.revokeObjectURL(p.url);
    },
    [previews],
  );
  const urlFor = (f: File) => previews.find((p) => p.file === f)?.url ?? null;

  const total = existing.length + files.length;
  const canAdd = !disabled && online && total < TRUCK_COST_ATTACHMENT_MAX_PER_KIND;

  const addFiles = (incoming: FileList | null) => {
    if (!incoming || incoming.length === 0) return;
    const arr = Array.from(incoming);

    /* Type gate — belt-and-braces over the input `accept`. */
    const badType = arr.find((f) => !(isImage(resolveType(f)) || resolveType(f) === 'application/pdf'));
    if (badType) {
      toast.error(t('errType'));
      return;
    }
    /* Size gate. */
    if (arr.some((f) => f.size > TRUCK_COST_ATTACHMENT_MAX_BYTES)) {
      toast.error(t('errTooLarge', { max: Math.floor(TRUCK_COST_ATTACHMENT_MAX_BYTES / (1024 * 1024)) }));
      return;
    }
    /* Count gate — trim to the per-kind cap. */
    const room = TRUCK_COST_ATTACHMENT_MAX_PER_KIND - total;
    if (arr.length > room) {
      toast.error(t('errTooMany', { max: TRUCK_COST_ATTACHMENT_MAX_PER_KIND }));
      onFilesChange([...files, ...arr.slice(0, room)]);
      return;
    }
    onFilesChange([...files, ...arr]);
  };

  const removeExisting = (id: string) => onExistingChange(existing.filter((a) => a.id !== id));
  const removeFile = (idx: number) => onFilesChange(files.filter((_, i) => i !== idx));

  return (
    <div className="space-y-2">
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        multiple
        className="sr-only"
        onChange={(e) => {
          addFiles(e.target.files);
          e.target.value = '';
        }}
      />

      {total > 0 && (
        <ul className="grid grid-cols-3 sm:grid-cols-4 gap-2">
          {existing.map((a) => (
            <Thumb
              key={a.id}
              mime={a.mime}
              url={a.signedUrl}
              label={t('savedAlt')}
              onRemove={disabled ? undefined : () => removeExisting(a.id)}
              removeAria={t('remove')}
            />
          ))}
          {files.map((f, i) => (
            <Thumb
              key={`${f.name}-${i}`}
              mime={resolveType(f)}
              url={urlFor(f)}
              label={f.name}
              onRemove={disabled ? undefined : () => removeFile(i)}
              removeAria={t('remove')}
            />
          ))}
        </ul>
      )}

      {canAdd ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => inputRef.current?.click()}
          className="gap-1.5 text-xs text-text-muted hover:text-text"
        >
          <Paperclip className="h-3.5 w-3.5" />
          {total > 0 ? t('addMore') : t('add')}
        </Button>
      ) : !online ? (
        <p className="flex items-center gap-1.5 text-xs text-text-faint">
          <WifiOff className="h-3.5 w-3.5" />
          {t('offline')}
        </p>
      ) : total >= TRUCK_COST_ATTACHMENT_MAX_PER_KIND ? (
        <p className="text-xs text-text-faint">{t('maxReached', { max: TRUCK_COST_ATTACHMENT_MAX_PER_KIND })}</p>
      ) : null}
    </div>
  );
}

/** MIME with the same empty-`type` fallback the uploader uses. */
function resolveType(f: File): string {
  if (f.type) return f.type;
  if (/\.pdf$/i.test(f.name)) return 'application/pdf';
  return 'image/jpeg';
}

function Thumb({
  mime,
  url,
  label,
  onRemove,
  removeAria,
}: {
  mime: string;
  url: string | null;
  label: string;
  onRemove?: () => void;
  removeAria: string;
}) {
  return (
    <li className="relative aspect-square rounded-lg overflow-hidden border border-border bg-surface-2">
      {isImage(mime) && url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt={label} className="h-full w-full object-cover" />
      ) : (
        <div className="h-full w-full flex flex-col items-center justify-center gap-1 text-text-muted">
          <FileText className="h-7 w-7" strokeWidth={1.5} aria-hidden />
          <span className="text-[10px] font-semibold uppercase tracking-wide">
            {mime.replace(/^application\//, '').replace(/^image\//, '')}
          </span>
        </div>
      )}
      {onRemove && (
        <button
          type="button"
          aria-label={removeAria}
          onClick={onRemove}
          className={cn(
            'absolute top-1 right-1 h-7 w-7 rounded-full bg-bg/85 text-text shadow-sm',
            'backdrop-blur flex items-center justify-center hover:bg-bg active:scale-95',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          )}
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </li>
  );
}
