import 'server-only';
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

/**
 * S3 client + helpers. Returns null when credentials aren't configured — in
 * that case ingest still proceeds (snapshot saves), but raw files aren't
 * archived to S3 (DB row will have `arfS3Key = null`).
 */

let _client: S3Client | null | undefined;

export function getS3Client(): S3Client | null {
  if (_client !== undefined) return _client;
  const region = process.env.AWS_REGION;
  const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
  const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;
  if (!region || !accessKeyId || !secretAccessKey) {
    _client = null;
    return null;
  }
  _client = new S3Client({ region, credentials: { accessKeyId, secretAccessKey } });
  return _client;
}

export function getS3Bucket(): string | null {
  return process.env.AWS_S3_BUCKET ?? null;
}

/**
 * Upload a buffer to S3 under `key`. Returns the key on success, null if S3
 * isn't configured.
 */
export async function uploadToS3(
  key: string,
  body: ArrayBuffer | Uint8Array | Buffer,
  contentType?: string,
): Promise<string | null> {
  const client = getS3Client();
  const bucket = getS3Bucket();
  if (!client || !bucket) return null;
  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: body instanceof ArrayBuffer ? new Uint8Array(body) : body,
      ContentType: contentType,
    }),
  );
  return key;
}

/**
 * Generate a short-lived signed download URL. Returns null if S3 isn't
 * configured or the object doesn't exist.
 */
export async function presignDownload(
  key: string,
  expiresInSeconds = 300,
): Promise<string | null> {
  const client = getS3Client();
  const bucket = getS3Bucket();
  if (!client || !bucket) return null;
  try {
    // Verify object exists before signing — avoids serving 404s to operators
    await client.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
  } catch {
    return null;
  }
  return getSignedUrl(
    client,
    new GetObjectCommand({ Bucket: bucket, Key: key }),
    { expiresIn: expiresInSeconds },
  );
}
