import { randomUUID } from 'node:crypto';
import { NextResponse, type NextRequest } from 'next/server';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { z } from 'zod';
import { CarError } from '@car-v2/shared/errors';
import { getCurrentUser } from '@/lib/auth/get-current-user';
import { getEnv, getTruckUploadMaxBytes } from '@/lib/env';
import { getS3Bucket, getS3Client } from '@/lib/s3-client';

export const dynamic = 'force-dynamic';

/* Content-type policy — accept any `image/*`, plus `application/pdf` for paper
 * invoices scanned to PDF, plus `application/octet-stream` as a generic
 * fallback when the browser couldn't infer a MIME (some Android pickers,
 * clipboard paste, older WebViews). Mirrors the expense upload route; the
 * client `accept="image/*,application/pdf"` already gates the picker and the
 * bucket policy is the real boundary. */
const CONTENT_TYPE_RE = /^(image\/[a-z0-9.+-]+|application\/(pdf|octet-stream))$/i;

const requestSchema = z.object({
  filename: z.string().min(1).max(255),
  content_type: z.string().min(1).max(128).regex(CONTENT_TYPE_RE, 'unsupported content type'),
  size_bytes: z.number().int().min(1),
});

/* POST /api/v1/truck/trips/upload-presigned
 *
 * Issues a short-lived presigned S3 PUT URL the client uploads a trip-cost
 * receipt (image / PDF) directly to. Independent from the expense upload route
 * (REQ-20260709) — its own key prefix and its own size cap
 * (TRUCK_S3_MAX_UPLOAD_BYTES, default 50MB).
 *
 * Key layout: `{entId}/trips/{userId}/{uuid}-{filename}` — entity ID outermost
 * (per-tenant GDPR delete / IAM scope / lifecycle), then the `trips/` resource
 * family, mirroring the `expenses/` layout under the same tenant root.
 *
 * The route does NOT create the car_trip_cost_attachments row — that happens
 * when the trip create/update/complete action runs with the returned key. An
 * uploaded-but-never-submitted object leaks until a future janitor job prunes
 * unreferenced keys (same trade-off as expenses). */
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

    /* Sanitize the filename — strip path separators + control chars. The UUID
     * prefix makes the filename mostly cosmetic for the bucket. */
    const safeName = filename.replace(/[\\/\x00-\x1f]/g, '_').slice(0, 100);
    const key = `${actor.entId}/trips/${actor.userId}/${randomUUID()}-${safeName}`;

    /* Don't sign ContentLength — see the expense route's note: iOS Safari PWA
     * standalone rewrites/chunks content-length, producing 403
     * SignatureDoesNotMatch for camera captures. Size is already validated
     * above + bounded by the bucket policy. */
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
        {
          success: false,
          error: { code: e.code, message: e.message },
          timestamp: new Date().toISOString(),
        },
        { status: e.httpStatus },
      );
    }
    // eslint-disable-next-line no-console
    console.error('[truck upload-presigned] unexpected error:', e);
    return NextResponse.json(
      {
        success: false,
        error: { code: 'CAR-E0500', message: 'Upload service temporarily unavailable' },
        timestamp: new Date().toISOString(),
      },
      { status: 500 },
    );
  }
}
