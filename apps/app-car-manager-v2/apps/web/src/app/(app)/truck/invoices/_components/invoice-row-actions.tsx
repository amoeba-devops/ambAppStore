'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Download, Eye } from 'lucide-react';
import { AttachmentLightbox, type AttachmentViewItem } from '@/components/attachments/attachment-viewer';

/**
 * "Xem" / "Tải về" for one row of the Truck Invoice list (REQ-20260921 R2).
 * Reuses the app-wide `AttachmentLightbox` (REQ-20260915) with a 1-item set
 * instead of building a new viewer — the lightbox already has both
 * affordances (open full-screen + download with the real filename).
 */
export function InvoiceRowActions({ item }: { item: AttachmentViewItem }) {
  const t = useTranslations('attachments');
  const [open, setOpen] = useState(false);

  if (!item.url) {
    return <span className="text-xs text-text-faint">—</span>;
  }

  return (
    <div className="flex items-center gap-1">
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={t('open', { name: item.name })}
        className="inline-flex h-8 w-8 items-center justify-center rounded-md text-text-muted hover:bg-surface-2 hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <Eye className="h-4 w-4" />
      </button>
      <a
        href={item.downloadUrl ?? item.url}
        download={item.name}
        aria-label={t('download')}
        className="inline-flex h-8 w-8 items-center justify-center rounded-md text-text-muted hover:bg-surface-2 hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <Download className="h-4 w-4" />
      </a>
      {open && (
        <AttachmentLightbox items={[item]} index={0} onIndexChange={() => {}} onClose={() => setOpen(false)} />
      )}
    </div>
  );
}
