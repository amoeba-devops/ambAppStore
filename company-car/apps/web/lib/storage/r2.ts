import { S3Client, GetObjectCommand, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { HttpError } from '@/lib/api/response';
import crypto from 'node:crypto';

const ACCOUNT_ID = process.env.R2_ACCOUNT_ID;
const ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID;
const SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY;
const BUCKET = process.env.R2_BUCKET;
const PUBLIC_URL = process.env.R2_PUBLIC_URL;

let _client: S3Client | null = null;
function getClient(): S3Client {
  if (!_client) {
    if (!ACCOUNT_ID || !ACCESS_KEY_ID || !SECRET_ACCESS_KEY || !BUCKET) {
      throw new HttpError(
        503,
        'R2_NOT_CONFIGURED',
        'Cloudflare R2 storage is not configured. Set R2_* env vars.',
      );
    }
    _client = new S3Client({
      region: 'auto',
      endpoint: `https://${ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: ACCESS_KEY_ID,
        secretAccessKey: SECRET_ACCESS_KEY,
      },
    });
  }
  return _client;
}

export function isR2Configured(): boolean {
  return Boolean(ACCOUNT_ID && ACCESS_KEY_ID && SECRET_ACCESS_KEY && BUCKET);
}

export function publicUrlFor(key: string): string {
  if (PUBLIC_URL) return `${PUBLIC_URL.replace(/\/$/, '')}/${key}`;
  return `r2://${BUCKET}/${key}`;
}

export async function createPresignedUploadUrl(args: {
  key: string;
  contentType: string;
  contentLength: number;
}): Promise<string> {
  const client = getClient();
  const cmd = new PutObjectCommand({
    Bucket: BUCKET,
    Key: args.key,
    ContentType: args.contentType,
    ContentLength: args.contentLength,
  });
  return getSignedUrl(client, cmd, { expiresIn: 5 * 60 });
}

export async function createPresignedDownloadUrl(key: string): Promise<string> {
  const client = getClient();
  const cmd = new GetObjectCommand({ Bucket: BUCKET, Key: key });
  return getSignedUrl(client, cmd, { expiresIn: 5 * 60 });
}

export async function deleteObject(key: string): Promise<void> {
  const client = getClient();
  await client.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }));
}

export function generateObjectKey(prefix: string, fileName: string): string {
  const ext = fileName.includes('.') ? fileName.slice(fileName.lastIndexOf('.')) : '';
  const safeBase = fileName
    .slice(0, fileName.length - ext.length)
    .replace(/[^a-zA-Z0-9_-]/g, '-')
    .slice(0, 60);
  const random = crypto.randomBytes(8).toString('hex');
  const date = new Date().toISOString().slice(0, 10);
  return `${prefix}/${date}/${random}-${safeBase}${ext}`;
}
