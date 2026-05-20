import 'server-only';
import { S3Client } from '@aws-sdk/client-s3';

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
