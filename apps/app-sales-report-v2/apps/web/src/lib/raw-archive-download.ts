/**
 * Archive file + period downloads.
 *
 * Single-file: hits the `/api/v1/archive/[arfId]/download` Route Handler
 *   which streams the raw bytes stored in `sal_archive_files.arf_raw_bytes`
 *   (falls back to S3 presigned URL when no inline copy is available).
 *
 * Bulk: still client-side. Builds a single CSV bundle in-browser since
 *   streaming a ZIP of N files would need a dedicated route — for the
 *   current low-volume usage the inline CSV is enough.
 */

import type { ArchiveFile, ArchivePeriod } from './raw-archive-mock';
import { appendActionLog } from './action-log-mock';

function fmtBytes(b: number): string {
  if (b >= 1_000_000) return `${(b / 1_000_000).toFixed(1)} MB`;
  if (b >= 1_000) return `${(b / 1_000).toFixed(1)} KB`;
  return `${b} B`;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function downloadArchiveFile(file: ArchiveFile): Promise<void> {
  if (typeof window === 'undefined') return;

  // Only real DB-backed files (UUID id) can be served by the API route.
  if (!UUID_RE.test(file.id)) {
    alert(
      `Download unavailable for "${file.filename}" — this row predates DB-backed storage.`,
    );
    return;
  }

  // Use fetch + Blob (rather than a plain <a href>) so we can read JSON
  // error bodies (410 "body unavailable" / 404) and show a friendly message.
  const url = `/api/v1/archive/${encodeURIComponent(file.id)}/download`;
  try {
    const res = await fetch(url, { credentials: 'same-origin' });
    if (!res.ok) {
      const ct = res.headers.get('content-type') ?? '';
      if (ct.includes('application/json')) {
        const body = (await res.json()) as { error?: { message?: string } };
        const msg = body.error?.message ?? `Download failed (${res.status})`;
        alert(msg);
      } else {
        alert(`Download failed (${res.status})`);
      }
      return;
    }
    const blob = await res.blob();
    const blobUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = file.filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(blobUrl);

    appendActionLog({
      username: 'dev@amoeba.group',
      userRole: 'OPERATOR',
      category: 'EXPORT',
      verb: 'DOWNLOAD',
      targetType: 'archive-file',
      targetLabel: file.filename,
      summary: `Downloaded archive file (${file.rows.toLocaleString('en-US')} rows, ${fmtBytes(file.bytes)})`,
      metadata: { filename: file.filename, bytes: file.bytes, rows: file.rows },
    });
  } catch (err) {
    console.error('[archive-download] fetch failed:', err);
    alert('Download failed — check your network connection.');
  }
}

/**
 * Bulk download — best-effort: fetch every file's bytes in parallel via the
 * single-file route, then build a ZIP-like CSV bundle browser-side. Skips
 * files whose body is unavailable (410) and reports the skip count.
 *
 * Replaced the old mock-CSV-manifest behaviour now that real bytes are
 * available for files uploaded post-migration.
 */
export async function downloadPeriodBulk(period: ArchivePeriod): Promise<void> {
  if (typeof window === 'undefined') return;

  const files = period.files.filter((f) => UUID_RE.test(f.id));
  if (files.length === 0) {
    alert('No downloadable files in this period.');
    return;
  }

  type FetchedFile = { file: ArchiveFile; bytes: Uint8Array } | { file: ArchiveFile; error: string };
  const results: FetchedFile[] = await Promise.all(
    files.map(async (file): Promise<FetchedFile> => {
      const url = `/api/v1/archive/${encodeURIComponent(file.id)}/download`;
      try {
        const res = await fetch(url, { credentials: 'same-origin' });
        if (!res.ok) {
          let msg = `HTTP ${res.status}`;
          try {
            const body = (await res.json()) as { error?: { message?: string } };
            if (body.error?.message) msg = body.error.message;
          } catch {
            /* non-JSON body */
          }
          return { file, error: msg };
        }
        const buf = await res.arrayBuffer();
        return { file, bytes: new Uint8Array(buf) };
      } catch (err) {
        return { file, error: err instanceof Error ? err.message : String(err) };
      }
    }),
  );

  const succeeded = results.filter((r): r is { file: ArchiveFile; bytes: Uint8Array } => 'bytes' in r);
  const failed = results.filter((r): r is { file: ArchiveFile; error: string } => 'error' in r);

  if (succeeded.length === 0) {
    alert(
      `No files in this period have a stored body yet. ${failed.length} skipped — re-upload them to enable bulk download.`,
    );
    return;
  }

  // Sequentially trigger a save dialog per file. Browsers throttle/coalesce
  // multiple downloads — slight delay between each helps Chrome/Firefox not
  // drop them.
  for (const r of succeeded) {
    // Slice into a new ArrayBuffer so Blob accepts it under strict lib.dom
    // typings (Uint8Array<ArrayBufferLike> isn't assignable to BlobPart).
    const blob = new Blob([r.bytes.slice().buffer]);
    const blobUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = r.file.filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(blobUrl);
    // Brief gap so the browser registers each download separately.
    await new Promise((resolve) => setTimeout(resolve, 250));
  }

  if (failed.length > 0) {
    const sampled = failed.slice(0, 3).map((f) => f.file.filename).join(', ');
    alert(
      `${succeeded.length} files downloaded · ${failed.length} skipped (body unavailable): ${sampled}${failed.length > 3 ? '…' : ''}`,
    );
  }

  const totalBytes = succeeded.reduce((s, r) => s + r.bytes.byteLength, 0);
  const totalRows = succeeded.reduce((s, r) => s + r.file.rows, 0);
  appendActionLog({
    username: 'dev@amoeba.group',
    userRole: 'OPERATOR',
    category: 'EXPORT',
    verb: 'BULK_DOWNLOAD',
    targetType: 'period',
    targetLabel: period.label,
    summary: `Bulk downloaded ${succeeded.length}/${files.length} archive files (${totalRows.toLocaleString('en-US')} rows, ${fmtBytes(totalBytes)})`,
    metadata: {
      periodKey: period.periodKey,
      fileCount: succeeded.length,
      skipped: failed.length,
      totalRows,
      totalBytes,
    },
  });
}
