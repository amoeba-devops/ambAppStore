import { randomUUID } from 'node:crypto';
import { NextResponse, type NextRequest } from 'next/server';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { z } from 'zod';
import { CarError } from '@car-v2/shared/errors';
import { getCurrentUser } from '@/lib/auth/get-current-user';
import { getS3Bucket, getS3Client } from '@/lib/s3-client';

export const dynamic = 'force-dynamic';

const requestSchema = z.object({
  filename: z.string().min(1).max(255),
  /* Allow common image MIMEs + PDF for paper receipts scanned to PDF. */
  content_type: z.enum([
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/heic',
    'image/heif',
    'application/pdf',
  ]),
  size_bytes: z.number().int().min(1).max(5 * 1024 * 1024),
});

const PRESIGNED_TTL_SECONDS = 60;

/* POST /api/v1/expenses/upload-presigned
 *
 * Issues a short-lived (60s) presigned S3 PUT URL the client uploads directly
 * to. We never proxy file bytes through the Next server — that would burn
 * Render bandwidth and lock us to whatever timeout the platform sets.
 *
 * Key layout: `expenses/{entId}/{userId}/{uuid}-{filename}` — keeps tenant +
 * uploader isolation visible in the bucket, and the UUID prevents collision
 * if two phones submit the same `IMG_0001.jpg` at the same time.
 *
 * The route does NOT create the `car_expense_attachments` row — that happens
 * later when the client calls `submitExpenseAction` with the S3 key. If the
 * client uploads then never submits, we leak an object — a janitor job
 * (separate REQ) can prune objects not referenced by any row after N days. */
export async function POST(req: NextRequest) {
  try {
    const actor = await getCurrentUser();
    const body = await req.json();
    const parsed = requestSchema.safeParse(body);
    if (!parsed.success) {
      throw new CarError('CAR-E0001', 400, parsed.error.issues[0]?.message ?? 'Invalid input');
    }
    const { filename, content_type, size_bytes } = parsed.data;

    /* Sanitize the filename — strip path separators + control chars to be
     * defensive about the key format, even though the UUID prefix means the
     * filename is mostly cosmetic for the bucket. */
    const safeName = filename.replace(/[\\/\x00-\x1f]/g, '_').slice(0, 100);
    /* Key layout: `{entId}/expenses/{userId}/{uuid}-{filename}`.
     *
     * Entity (company) ID is the OUTERMOST segment so future ops are simple:
     *   - GDPR delete a company → `aws s3 rm --recursive s3://bucket/{entId}/`
     *   - Per-tenant IAM scope → policy Resource `arn:.../{entId}/*`
     *   - Per-tenant lifecycle / quotas without touching other tenants
     *
     * `expenses/` then groups by resource family, leaving room for `vehicles/`,
     * `drivers/` etc later under the same tenant root. */
    const key = `${actor.entId}/expenses/${actor.userId}/${randomUUID()}-${safeName}`;

    const cmd = new PutObjectCommand({
      Bucket: getS3Bucket(),
      Key: key,
      ContentType: content_type,
      ContentLength: size_bytes,
    });

    const uploadUrl = await getSignedUrl(getS3Client(), cmd, { expiresIn: PRESIGNED_TTL_SECONDS });

    return NextResponse.json({
      success: true,
      data: {
        uploadUrl,
        key,
        expiresIn: PRESIGNED_TTL_SECONDS,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (e) {
    const err =
      e instanceof CarError ? e : new CarError('CAR-E0500', 500, e instanceof Error ? e.message : 'Unknown error');
    return NextResponse.json(
      {
        success: false,
        error: { code: err.code, message: err.message },
        timestamp: new Date().toISOString(),
      },
      { status: err.httpStatus },
    );
  }
}
