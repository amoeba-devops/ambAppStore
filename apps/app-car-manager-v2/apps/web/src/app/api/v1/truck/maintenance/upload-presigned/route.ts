import { randomUUID } from 'node:crypto';
import { NextResponse, type NextRequest } from 'next/server';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { z } from 'zod';
import { CarError } from '@car-v2/shared/errors';
import { ATTACHMENT_CONTENT_TYPE_RE } from '@car-v2/shared/zod';
import { getCurrentUser } from '@/lib/auth/get-current-user';
import { getEnv, getTruckUploadMaxBytes } from '@/lib/env';
import { getS3Bucket, getS3Client } from '@/lib/s3-client';

export const dynamic = 'force-dynamic';

/* Allowed types live in ONE place now (REQ-20260915) — images, PDF and the
 * office formats an invoice arrives in. Widen the shared list, not this file. */
const CONTENT_TYPE_RE = ATTACHMENT_CONTENT_TYPE_RE;

const requestSchema = z.object({
  filename: z.string().min(1).max(255),
  content_type: z.string().min(1).max(128).regex(CONTENT_TYPE_RE, 'unsupported content type'),
  size_bytes: z.number().int().min(1),
});

/* POST /api/v1/truck/maintenance/upload-presigned
 *
 * Short-lived presigned S3 PUT URL for a MAINTENANCE invoice (REQ-20260914).
 * Deliberately a sibling of the trip-receipt route rather than a shared one:
 * each resource family owns its own key prefix, so per-tenant lifecycle rules
 * and IAM scoping can treat them separately.
 *
 * Key layout: `{entId}/maintenance/{userId}/{uuid}-{filename}` — entity
 * outermost like `trips/` and `expenses/`.
 *
 * The route does NOT create the car_truck_maintenance_attachments row; that
 * happens when the create/update maintenance action runs with the returned
 * key. An uploaded-but-never-saved object leaks until a janitor prunes
 * unreferenced keys — same trade-off as trips and expenses. */
export async function POST(req: NextRequest) {
  try {
    const actor = await getCurrentUser();
    const body = await req.json();
    const parsed = requestSchema.safeParse(body);
    if (!parsed.success) {
      throw new CarError('CAR-E0001', 400, parsed.error.issues[0]?.message ?? 'Invalid input');
    }
    const { filename, content_type, size_bytes } = parsed.data;

    const maxBytes = getTruckUploadMaxBytes();
    if (size_bytes > maxBytes) {
      throw new CarError('CAR-E0001', 400, `file exceeds ${Math.floor(maxBytes / (1024 * 1024))}MB limit`);
    }

    const safeName = filename.replace(/[\\/\x00-\x1f]/g, '_').slice(0, 100);
    const key = `${actor.entId}/maintenance/${actor.userId}/${randomUUID()}-${safeName}`;

    /* ContentLength intentionally unsigned — iOS Safari PWA rewrites it and
     * breaks the signature (see the trip + expense routes). Size is validated
     * above and bounded by the bucket policy. */
    const cmd = new PutObjectCommand({
      Bucket: getS3Bucket(),
      Key: key,
      ContentType: content_type,
    });

    const ttl = getEnv().S3_PRESIGN_EXPIRY_SECONDS as number;
    const uploadUrl = await getSignedUrl(getS3Client(), cmd, { expiresIn: ttl });

    return NextResponse.json({
      success: true,
      data: { uploadUrl, key, expiresIn: ttl },
      timestamp: new Date().toISOString(),
    });
  } catch (e) {
    if (e instanceof CarError) {
      return NextResponse.json(
        { success: false, error: { code: e.code, message: e.message }, timestamp: new Date().toISOString() },
        { status: e.httpStatus },
      );
    }
    // eslint-disable-next-line no-console
    console.error('[truck maintenance upload-presigned] unexpected error:', e);
    return NextResponse.json(
      {
        success: false,
        error: { code: 'CAR-E9000', message: 'Unexpected error' },
        timestamp: new Date().toISOString(),
      },
      { status: 500 },
    );
  }
}
