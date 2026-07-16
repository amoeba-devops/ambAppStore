import 'server-only';
import { GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

let cached: S3Client | null = null;

/* Lazy singleton S3 client. Construction reads env (AWS_REGION + key pair),
 * cached so we don't re-instantiate on every action invocation.
 *
 * Why lazy: the env vars only need to exist when expense-related code runs.
 * Eager construction at module import would force `AWS_*` to be present in
 * any dev that doesn't touch expenses (worth the slight complexity). */
export function getS3Client(): S3Client {
  if (cached) return cached;
  const region = process.env.AWS_REGION;
  const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
  const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;
  if (!region || !accessKeyId || !secretAccessKey) {
    throw new Error(
      'S3 client unavailable: set AWS_REGION, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY.',
    );
  }
  cached = new S3Client({ region, credentials: { accessKeyId, secretAccessKey } });
  return cached;
}

export function getS3Bucket(): string {
  const bucket = process.env.AWS_S3_BUCKET;
  if (!bucket) throw new Error('AWS_S3_BUCKET is required for receipt uploads.');
  return bucket;
}

/* Sign a short-lived GET URL for a receipt object.
 *
 * Used by RSC detail pages to surface images inline without exposing the
 * bucket or burning a route handler per attachment. Default TTL 15 min — long
 * enough that a user keeping the page open won't see broken images, short
 * enough that a leaked URL has limited replay value. Caller can override (eg.
 * a printable PDF view that needs a longer window).
 *
 * Returns null if the S3 client isn't configured — caller can degrade to the
 * old "metadata only" rendering instead of a hard crash on dev branches
 * without AWS creds.
 *
 * `downloadFilename` (optional): serve as an attachment under this name instead
 * of the S3 key's basename (which is a uuid for generated reports). Signed into
 * the URL via ResponseContentDisposition; RFC 5987 encoding so Vietnamese and
 * Korean names survive (same pattern as excelResponse). */
export async function getSignedGetUrl(
  key: string,
  expiresIn = 900,
  downloadFilename?: string,
): Promise<string | null> {
  try {
    const cmd = new GetObjectCommand({
      Bucket: getS3Bucket(),
      Key: key,
      ...(downloadFilename
        ? {
            ResponseContentDisposition: `attachment; filename="${downloadFilename.replace(/[^\x20-\x7e]/g, '_').replace(/["\\]/g, '_')}"; filename*=UTF-8''${encodeURIComponent(downloadFilename)}`,
          }
        : {}),
    });
    return await getSignedUrl(getS3Client(), cmd, { expiresIn });
  } catch {
    return null;
  }
}

/* Server-side upload of a generated file (e.g. a report workbook). Unlike
 * receipts — which the browser PUTs straight to S3 via a presigned URL — these
 * are built on the server, so we push the bytes directly. Throws if S3 isn't
 * configured (caller surfaces a clear error). */
export async function putObject(key: string, body: Uint8Array, contentType: string): Promise<void> {
  const cmd = new PutObjectCommand({
    Bucket: getS3Bucket(),
    Key: key,
    Body: body,
    ContentType: contentType,
  });
  await getS3Client().send(cmd);
}
