import { apiPath } from '@/lib/base-path';

/**
 * Client-side upload of a trip-cost receipt (REQ-20260709): presign → direct
 * S3 PUT. Mirrors the expense receipt flow but targets the truck route + its
 * own key prefix / size cap. Returns the metadata the trip action persists.
 *
 * File bytes never pass through the Next server — the browser PUTs straight to
 * S3 with the presigned URL.
 */

export interface UploadedCostFile {
  s3_key: string;
  mime: string;
  size_bytes: number;
  /** Original device filename, persisted so the UI can show it (REQ-20260915).
   * The S3 key only carries a sanitised, truncated copy. */
  file_name: string;
}

/* Resolve a MIME for the upload. `f.type` is empty surprisingly often (some
 * Android pickers, clipboard paste, older WebViews). Infer PDF from the
 * extension, else assume image — the picker is gated to image/PDF, and a
 * concrete type keeps the later signed-URL render honest. */
export function resolveCostMime(f: File): string {
  if (f.type) return f.type;
  if (/\.pdf$/i.test(f.name)) return 'application/pdf';
  return 'image/jpeg';
}

async function requestPresigned(
  f: File,
  endpoint = '/api/v1/truck/trips/upload-presigned',
): Promise<{ uploadUrl: string; key: string }> {
  const res = await fetch(apiPath(endpoint), {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      filename: f.name,
      content_type: resolveCostMime(f),
      size_bytes: f.size,
    }),
  });
  const json = await res.json();
  if (!res.ok || !json.success) {
    throw new Error(json?.error?.message ?? 'presign failed');
  }
  return json.data;
}

async function uploadToS3(url: string, f: File): Promise<void> {
  /* The content-type header MUST match what we sent to the presign route, so
   * reuse resolveCostMime rather than re-derive from f.type (would diverge when
   * f.type is empty). */
  const res = await fetch(url, {
    method: 'PUT',
    headers: { 'content-type': resolveCostMime(f) },
    body: f,
  });
  if (!res.ok) throw new Error(`S3 upload failed: ${res.status}`);
}

/** Upload one file, resolving to the row metadata the trip action stores. */
export async function uploadTruckCostFile(f: File): Promise<UploadedCostFile> {
  const presigned = await requestPresigned(f);
  await uploadToS3(presigned.uploadUrl, f);
  return { s3_key: presigned.key, mime: resolveCostMime(f), size_bytes: f.size, file_name: f.name };
}

/** Same flow for a MAINTENANCE invoice (REQ-20260914) — only the presign route
 * differs, so the file lands under the `maintenance/` key prefix. */
export async function uploadTruckMaintenanceFile(f: File): Promise<UploadedCostFile> {
  const presigned = await requestPresigned(f, '/api/v1/truck/maintenance/upload-presigned');
  await uploadToS3(presigned.uploadUrl, f);
  return { s3_key: presigned.key, mime: resolveCostMime(f), size_bytes: f.size, file_name: f.name };
}
