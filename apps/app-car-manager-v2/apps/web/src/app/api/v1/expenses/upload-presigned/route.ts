import { randomUUID } from 'node:crypto';
import { NextResponse, type NextRequest } from 'next/server';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { z } from 'zod';
import { CarError } from '@car-v2/shared/errors';
import { getCurrentUser } from '@/lib/auth/get-current-user';
import { getEnv } from '@/lib/env';
import { getS3Bucket, getS3Client } from '@/lib/s3-client';

export const dynamic = 'force-dynamic';

/* Content-type policy — accept any `image/*`, plus `application/pdf` for paper
 * receipts scanned to PDF, plus `application/octet-stream` as a generic fallback
 * when the browser couldn't infer a MIME (some Android pickers, clipboard
 * paste, older WebViews). Previously the route used a hard `z.enum([...])` of
 * 6 explicit values which rejected the octet-stream fallback the client sends
 * — that surfaced as `CAR-E0001 Invalid input` toasts that looked random
 * because the user picked an "image" but the browser handed us no MIME. The
 * regex is permissive on purpose: client-side `accept="image/*"` already gates
 * the file picker, and the bucket policy (size + key prefix) is the real
 * boundary. */
const CONTENT_TYPE_RE = /^(image\/[a-z0-9.+-]+|application\/(pdf|octet-stream))$/i;

const requestSchema = z.object({
  filename: z.string().min(1).max(255),
  content_type: z.string().min(1).max(128).regex(CONTENT_TYPE_RE, 'unsupported content type'),
  size_bytes: z.number().int().min(1),
});

/* POST /api/v1/expenses/upload-presigned
 *
 * Issues a short-lived presigned S3 PUT URL (TTL from env, default 5 min) the
 * client uploads directly to. We never proxy file bytes through the Next
 * server — that would burn Render bandwidth and lock us to whatever timeout
 * the platform sets.
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

    /* Size cap comes from env (S3_MAX_UPLOAD_BYTES, default 10MB) — previously
     * hard-coded to 5MB inside the Zod schema and the env value was dead. The
     * env knob lets ops bump the limit without a code deploy (e.g., to ingest
     * a particular hi-res inspection PDF). Client still validates at its own
     * cap as the UX gate. */
    const env = getEnv();
    const maxBytes = env.S3_MAX_UPLOAD_BYTES as number;
    if (size_bytes > maxBytes) {
      throw new CarError('CAR-E0001', 400, `file exceeds ${Math.floor(maxBytes / (1024 * 1024))}MB limit`);
    }

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

    /* Do NOT include `ContentLength` in the signed command.
     *
     * When the SDK signs with ContentLength, `content-length` enters the
     * SignedHeaders set and the PUT must echo a byte-exact match. Browsers
     * normally do this automatically for `body: File`, but iOS Safari in PWA
     * standalone has known quirks where the header is rewritten / chunked,
     * which produces `403 SignatureDoesNotMatch` for receipts taken via
     * camera. Dropping the field makes the signature robust without losing
     * any real protection — the bucket's content-length-range policy (if
     * configured) still enforces a hard cap server-side, and we've already
     * validated size_bytes above. */
    const cmd = new PutObjectCommand({
      Bucket: getS3Bucket(),
      Key: key,
      ContentType: content_type,
    });

    /* TTL comes from env (S3_PRESIGN_EXPIRY_SECONDS, default 300s). The
     * previous flat 60s expired before the PUT could even begin on flaky
     * 3G/4G — 5 minutes covers a worst-case mobile network without giving
     * a leaked URL meaningful re-use value. */
    const ttl = env.S3_PRESIGN_EXPIRY_SECONDS as number;
    const uploadUrl = await getSignedUrl(getS3Client(), cmd, { expiresIn: ttl });

    return NextResponse.json({
      success: true,
      data: {
        uploadUrl,
        key,
        expiresIn: ttl,
      },
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
    /* Unknown failure — log server-side, return a generic 500 to the client
     * (per project rule: don't surface raw system errors to the UI). */
    // eslint-disable-next-line no-console
    console.error('[upload-presigned] unexpected error:', e);
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
