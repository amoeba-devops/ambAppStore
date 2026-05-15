'use client';

import { useEffect } from 'react';
import type { ArchiveFile } from '@/lib/raw-archive-mock';

interface Props {
  file: ArchiveFile;
  onClose: () => void;
}

/**
 * Lightweight read-only preview — once parsed CSV/XLSX is stored as JSON
 * during ingest, this will show the first ~5 rows of real data. For now it
 * renders a representative mock based on the file's `source` type.
 */
export function FilePreviewModal({ file, onClose }: Props) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  const { headers, rows } = buildMockPreview(file);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-900/50 backdrop-blur-sm px-4 py-6 text-left"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-4xl max-h-full rounded-xl bg-white shadow-2xl overflow-hidden flex flex-col text-left"
      >
        <div className="flex items-center justify-between border-b border-neutral-100 px-5 py-3">
          <div>
            <h3 className="text-sm font-semibold text-neutral-900 font-mono leading-tight">
              {file.filename}
            </h3>
            <p className="text-[10px] uppercase tracking-wider text-neutral-500 mt-0.5">
              File preview · first 5 rows
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center gap-1 rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-xs font-medium text-neutral-700 hover:bg-neutral-50"
          >
            Close
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-neutral-50 text-[10px] uppercase tracking-wider text-neutral-500">
              <tr>
                {headers.map((h) => (
                  <th key={h} className="px-3 py-2 text-left font-semibold whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {rows.map((r, i) => (
                <tr key={i}>
                  {r.map((c, j) => (
                    <td
                      key={j}
                      className="px-3 py-2 font-mono text-xs text-neutral-700 whitespace-nowrap"
                    >
                      {c}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="border-t border-neutral-100 bg-neutral-50/40 px-5 py-2.5 text-[11px] text-neutral-500">
          Showing 5 of {file.rows.toLocaleString('en-US')} rows. Download to inspect the full
          file.
        </div>
      </div>
    </div>
  );
}

function buildMockPreview(file: ArchiveFile): { headers: string[]; rows: string[][] } {
  // Pick representative headers + rows based on the source type so the preview
  // feels relevant (Sales/Ads/Traffic look different).
  if (file.source === 'Sales') {
    const headers = ['Order ID', 'SKU', 'Product Name', 'Quantity', 'GMV'];
    const rows = Array.from({ length: 5 }, (_, i) => [
      `${241204000 + i + 1}`,
      `SKU-${100 + i}`,
      `Sample Product ${i + 1}`,
      `${1 + i}`,
      `${(199_000 * (i + 1)).toLocaleString('en-US')}`,
    ]);
    return { headers, rows };
  }
  if (file.source === 'Traffic') {
    const headers = ['Date', 'SKU', 'Page View', 'Add to Cart', 'Conv. Rate %'];
    const rows = Array.from({ length: 5 }, (_, i) => [
      `2026-04-${27 + (i % 4)}`,
      `SKU-${100 + i}`,
      `${4200 + i * 130}`,
      `${120 + i * 8}`,
      `${(2.5 + i * 0.3).toFixed(2)}`,
    ]);
    return { headers, rows };
  }
  if (file.source === 'Ads' || file.source === 'Brand Ads' || file.source === 'Off-Platform Ads') {
    const headers = ['Date', 'Campaign', 'Impressions', 'Clicks', 'Spend'];
    const rows = Array.from({ length: 5 }, (_, i) => [
      `2026-04-${27 + (i % 4)}`,
      `Campaign ${i + 1}`,
      `${12_400 + i * 890}`,
      `${320 + i * 24}`,
      `${(450_000 + i * 38_000).toLocaleString('en-US')}`,
    ]);
    return { headers, rows };
  }
  if (file.source === 'Affiliate') {
    const headers = ['Date', 'Affiliate ID', 'Orders', 'Commission', 'Booking Fee'];
    const rows = Array.from({ length: 5 }, (_, i) => [
      `2026-04-${27 + (i % 4)}`,
      `AFF-${1000 + i}`,
      `${4 + i}`,
      `${(85_000 + i * 12_000).toLocaleString('en-US')}`,
      `${(15_000 + i * 2_000).toLocaleString('en-US')}`,
    ]);
    return { headers, rows };
  }
  // Fallback
  const headers = ['Col A', 'Col B', 'Col C', 'Col D', 'Col E'];
  const rows = Array.from({ length: 5 }, (_, i) =>
    headers.map((_, j) => `R${i + 1}C${j + 1}`),
  );
  return { headers, rows };
}
