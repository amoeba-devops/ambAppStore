import { z } from 'zod';

/**
 * ONE attachment contract for the whole app (REQ-20260915).
 *
 * Before this, three upload surfaces each had their own accept list, size cap
 * and row shape: truck trip receipts, truck maintenance invoices and car
 * expense receipts. The formats they accepted, whether you could open a file
 * full-screen, download it, or even see its NAME all differed. Everything now
 * routes through these constants plus `components/attachments/*`.
 *
 * Scope decision: a whitelist, not "anything". This is a company document
 * store fed by phones in the field — images, PDFs and the office formats an
 * invoice actually arrives in. Executables / scripts / archives stay out, so a
 * compromised account can't turn the receipts bucket into a malware host. Add
 * a MIME here (and its extension to ATTACHMENT_ACCEPT) to widen it.
 */

/** MIME types the server will presign an upload for. */
export const ATTACHMENT_MIME_ALLOWLIST = [
  /* Photos / scans — the common case. */
  'image/*',
  'application/pdf',
  /* Office documents an invoice or quote arrives in. */
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/csv',
  'text/plain',
  /* Browsers that hand us no MIME at all (some Android pickers, clipboard
   * paste, older WebViews). The extension in the filename is the real signal. */
  'application/octet-stream',
] as const;

/** `accept` attribute for the file input — MIME groups + extensions, because
 * Android pickers match on extension far more reliably than on MIME. */
export const ATTACHMENT_ACCEPT = [
  'image/*',
  '.pdf',
  '.doc',
  '.docx',
  '.xls',
  '.xlsx',
  '.csv',
  '.txt',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/csv',
  'text/plain',
].join(',');

/** Server-side gate. Mirrors the allowlist above; `image/<anything>` is open
 * because phones emit a long tail (heic, heif, avif, webp…). */
export const ATTACHMENT_CONTENT_TYPE_RE =
  /^(image\/[a-z0-9.+-]+|application\/(pdf|msword|octet-stream|vnd\.ms-excel|vnd\.openxmlformats-officedocument\.(wordprocessingml\.document|spreadsheetml\.sheet))|text\/(csv|plain))$/i;

/** Default ceilings. Call sites may tighten them (the car expense flow keeps
 * its stricter 5 × 10MB because a driver uploads over mobile data). */
export const ATTACHMENT_MAX_BYTES = 50 * 1024 * 1024;
export const ATTACHMENT_MAX_FILES = 10;

/** Original filename, as typed by the device. Stored so the UI can show it —
 * the S3 key only carries a sanitised, truncated copy. */
export const attachmentFileNameSchema = z.string().trim().min(1).max(255);

/** One uploaded file: the client PUTs to S3 with a presigned URL first and
 * sends only this metadata — bytes never pass through the Next server. */
export const attachmentMetaSchema = z.object({
  s3_key: z.string().min(1).max(1024),
  mime: z.string().min(1).max(64),
  size_bytes: z.number().int().min(1),
  /** Optional so older callers (and rows created before REQ-20260915) still
   * validate; the UI falls back to the name embedded in the S3 key. */
  file_name: attachmentFileNameSchema.optional(),
});
export type AttachmentMetaDto = z.infer<typeof attachmentMetaSchema>;

/**
 * Best-effort original name from an S3 key shaped
 * `{entId}/{resource}/{userId}/{uuid}-{safeName}`. Used for rows stored before
 * the `*_file_name` column existed. Returns null when the key doesn't match,
 * so the caller can fall back to a generic label rather than print a UUID.
 */
export function fileNameFromS3Key(key: string): string | null {
  const last = key.split('/').pop();
  if (!last) return null;
  const m = last.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}-(.+)$/i);
  return m?.[1]?.trim() || null;
}
