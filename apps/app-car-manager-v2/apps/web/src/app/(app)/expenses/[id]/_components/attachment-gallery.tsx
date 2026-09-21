'use client';

import { useTranslations } from 'next-intl';
import { AttachmentGrid } from '@/components/attachments/attachment-viewer';

/**
 * Expense receipt gallery — now a thin adapter over the app-wide
 * `AttachmentGrid` (REQ-20260915).
 *
 * It used to own ~300 lines of its own lightbox. That lightbox was the ONLY
 * place in the app where an attachment could be opened full-screen and
 * downloaded, while the truck screens had neither — and none of them showed the
 * file's NAME. The behaviour now lives in one component shared by expenses,
 * trip receipts and maintenance invoices, so every surface gains the name,
 * the full-screen view, the download button and the wider format support at
 * once.
 *
 * The `eat*` prop shape is kept so the three call sites (detail page, peek
 * drawer, review panel) didn't have to change.
 */

export interface AttachmentItem {
  eatId: string;
  eatMime: string;
  eatSizeBytes: number;
  /** Original filename; null for rows saved before the column existed. */
  eatFileName?: string | null;
  /** Pre-signed GET URL (15-min TTL). Null when signing failed. */
  signedUrl: string | null;
  /** Attachment-disposition URL for the download button — browsers ignore
   * <a download> on cross-origin S3 hrefs. */
  downloadUrl?: string | null;
}

interface AttachmentGalleryProps {
  attachments: AttachmentItem[];
}

export function AttachmentGallery({ attachments }: AttachmentGalleryProps) {
  const t = useTranslations('attachments');
  return (
    <AttachmentGrid
      items={attachments.map((a) => ({
        key: a.eatId,
        name: a.eatFileName?.trim() || t('savedFallback'),
        mime: a.eatMime,
        sizeBytes: a.eatSizeBytes,
        url: a.signedUrl,
        downloadUrl: a.downloadUrl,
      }))}
    />
  );
}
