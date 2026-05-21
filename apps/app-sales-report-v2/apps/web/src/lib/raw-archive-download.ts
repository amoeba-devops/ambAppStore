/**
 * Mock download for archive files — generates a CSV placeholder containing
 * file metadata + a couple of sample rows, then triggers a browser download
 * and logs the action.
 *
 * Once S3 + presigned URLs ship, replace `buildContent()` with a `fetch()` of
 * the real signed URL.
 */

import type { ArchiveFile, ArchivePeriod } from './raw-archive-mock';
import { appendActionLog } from './action-log-mock';

function fmtBytes(b: number): string {
  if (b >= 1_000_000) return `${(b / 1_000_000).toFixed(1)} MB`;
  if (b >= 1_000) return `${(b / 1_000).toFixed(1)} KB`;
  return `${b} B`;
}

function buildContent(file: ArchiveFile): string {
  const lines = [
    `# Mock archive file — FIRGI Sales Report v2 demo`,
    `# Filename:        ${file.filename}`,
    `# Storage path:    ${file.storagePath}`,
    `# Platform:        ${file.platform}`,
    `# Source:          ${file.source}`,
    `# Rows:            ${file.rows}`,
    `# Size:            ${file.bytes} bytes`,
    `# SHA-256:         ${file.checksum}`,
    `# Uploaded at:     ${file.uploadedAt}`,
    `# Uploaded by:     ${file.uploadedBy}`,
    `#`,
    `# Placeholder content for the v2 mock environment.`,
    `# Real raw bytes will be served from S3 once the ingest pipeline ships.`,
    `#`,
    'col_1,col_2,col_3',
    '"sample","data","row"',
  ];
  return lines.join('\n');
}

/**
 * Bulk download — bundles every file for a period into a single CSV that
 * contains a manifest header and per-file content sections, separated by
 * banner lines. Auditor opens one file, sees everything.
 *
 * Once S3 ships, swap for a server-side ZIP stream.
 */
export function downloadPeriodBulk(period: ArchivePeriod): void {
  if (typeof window === 'undefined') return;
  const files = period.files;
  const totalBytes = files.reduce((s, f) => s + f.bytes, 0);
  const totalRows = files.reduce((s, f) => s + f.rows, 0);

  const banner = (label: string) =>
    [
      '',
      '############################################################',
      `# ${label}`,
      '############################################################',
    ].join('\n');

  const sections: string[] = [];

  // Manifest header
  sections.push(
    [
      banner(`PERIOD ${period.label} — ARCHIVE BUNDLE`),
      `# Period:        ${period.label} (${period.rangeLabel})`,
      `# Granularity:   ${period.granularity}`,
      `# Status:        ${period.status}`,
      `# Ingested:      ${period.ingestedAt} by ${period.ingestedBy}`,
      period.finalizedAt
        ? `# Finalized:     ${period.finalizedAt} by ${period.finalizedBy ?? '—'}`
        : '',
      `# Files:         ${files.length}`,
      `# Total rows:    ${totalRows.toLocaleString('en-US')}`,
      `# Total bytes:   ${totalBytes.toLocaleString('en-US')}`,
      `# Bundle built:  ${new Date().toISOString()}`,
      `#`,
      '# This is a mock bundle for the v2 demo. Real raw files will be',
      '# served as a ZIP stream from S3 once the ingest pipeline ships.',
    ]
      .filter(Boolean)
      .join('\n'),
  );

  // Manifest table
  sections.push(banner('MANIFEST'));
  sections.push(
    [
      'filename,platform,source,rows,size_bytes,checksum_sha256,uploaded_at,uploaded_by,storage_path',
      ...files.map((f) =>
        [
          f.filename,
          f.platform,
          f.source,
          String(f.rows),
          String(f.bytes),
          f.checksum,
          f.uploadedAt,
          f.uploadedBy,
          f.storagePath,
        ]
          .map((s) => (/[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s))
          .join(','),
      ),
    ].join('\n'),
  );

  // Per-file content sections (mock placeholders)
  for (const f of files) {
    sections.push(banner(`FILE: ${f.filename}`));
    sections.push(
      [
        `# Storage path: ${f.storagePath}`,
        `# SHA-256:      ${f.checksum}`,
        `# Rows:         ${f.rows}`,
        `# Size:         ${f.bytes} bytes`,
        '#',
        '# Mock placeholder — real bytes served from S3 in production.',
        'col_1,col_2,col_3',
        '"sample","data","row"',
      ].join('\n'),
    );
  }

  const bundle = sections.join('\n\n');
  const blob = new Blob([bundle], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const ts = new Date().toISOString().slice(0, 10);
  const downloadName = `${period.label.replace(/\s+/g, '_')}_archive_${ts}.csv`;
  const a = document.createElement('a');
  a.href = url;
  a.download = downloadName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  appendActionLog({
    username: 'dev@amoeba.group',
    userRole: 'OPERATOR',
    category: 'EXPORT',
    verb: 'BULK_DOWNLOAD',
    targetType: 'period',
    targetLabel: period.label,
    summary: `Bulk downloaded ${files.length} archive files (${totalRows.toLocaleString('en-US')} rows, ${fmtBytes(totalBytes)})`,
    metadata: {
      periodKey: period.periodKey,
      fileCount: files.length,
      totalRows,
      totalBytes,
      filename: downloadName,
    },
  });
}

export async function downloadArchiveFile(file: ArchiveFile): Promise<void> {
  if (typeof window === 'undefined') return;

  // Real files have a UUID id (from `sal_archive_files.arf_id`) AND a non-mock
  // storage path. Try presigning first; on failure fall back to mock CSV.
  const isLikelyRealFile = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    file.id,
  );
  if (isLikelyRealFile) {
    try {
      const { presignArchiveDownloadAction } = await import(
        '@/server/actions/archive.actions'
      );
      const res = await presignArchiveDownloadAction(file.id);
      if (res.success && res.data.url) {
        // Anchor to real S3 signed URL — browser handles the download.
        const a = document.createElement('a');
        a.href = res.data.url;
        a.download = res.data.filename ?? file.filename;
        a.target = '_blank';
        a.rel = 'noopener';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        appendActionLog({
          username: 'dev@amoeba.group',
          userRole: 'OPERATOR',
          category: 'EXPORT',
          verb: 'DOWNLOAD',
          targetType: 'archive-file',
          targetLabel: file.filename,
          summary: `Downloaded archive file from S3 (${file.rows.toLocaleString('en-US')} rows, ${fmtBytes(file.bytes)})`,
          metadata: { filename: file.filename, bytes: file.bytes, rows: file.rows, source: 's3' },
        });
        return;
      }
      if (res.success && res.data.url == null) {
        alert(
          `Archive file "${file.filename}" was ingested before S3 was configured. Only metadata is preserved — re-upload the file to enable download.`,
        );
        return;
      }
    } catch (err) {
      console.error('[archive-download] presign failed, falling back to mock:', err);
    }
  }

  // Mock fallback for legacy/demo periods
  const blob = new Blob([buildContent(file)], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const downloadName = file.filename.replace(/\.(xlsx|xls)$/i, '.csv');
  const a = document.createElement('a');
  a.href = url;
  a.download = downloadName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  appendActionLog({
    username: 'dev@amoeba.group',
    userRole: 'OPERATOR',
    category: 'EXPORT',
    verb: 'DOWNLOAD',
    targetType: 'archive-file',
    targetLabel: file.filename,
    summary: `Downloaded archive file (${file.rows.toLocaleString('en-US')} rows, ${fmtBytes(file.bytes)})`,
    metadata: {
      filename: file.filename,
      bytes: file.bytes,
      rows: file.rows,
      checksum: file.checksum,
    },
  });
}
