import 'server-only';
import { z } from 'zod';

/**
 * Server-side env loader with Zod validation.
 *
 * Currently scoped to the P4 notification transport (Resend email + Web Push).
 * Everything else still reads `process.env.*` directly until a refactor pass —
 * we intentionally don't centralize all env at once to keep the surface small.
 *
 * Lookups are lazy + cached so we don't crash a build that doesn't need
 * notifications (e.g. running `next build` without Resend keys for a feature
 * branch). Caller decides when to require what.
 */

const envSchema = z.object({
  /* Email transport — Resend. */
  RESEND_API_KEY: z.string().min(1).optional(),
  /** From address. RFC-5322 — must be a verified domain on Resend. */
  EMAIL_FROM: z
    .string()
    .regex(/^.+@.+\..+$/, 'EMAIL_FROM must look like "Name <addr@example.com>"')
    .optional(),
  /** Optional reply-to override. */
  EMAIL_REPLY_TO: z.string().email().optional(),

  /* Web Push — VAPID keys generated via `npx web-push generate-vapid-keys`. */
  WEB_PUSH_VAPID_PRIVATE: z.string().min(1).optional(),
  /** Public counterpart. Must match NEXT_PUBLIC_WEB_PUSH_VAPID_PUBLIC byte-for-byte. */
  WEB_PUSH_VAPID_PUBLIC: z.string().min(1).optional(),
  /** Contact (mailto: or https://) shown to push provider for abuse reports. */
  WEB_PUSH_CONTACT: z
    .string()
    .regex(/^(mailto:|https?:\/\/)/, 'WEB_PUSH_CONTACT must start with mailto: or https://')
    .optional(),

  /**
   * Public origin used to build notification target links. Accepts:
   *   - full URL: `https://stg-apps.amoeba.site`
   *   - hostname:port: `localhost:3001` (auto-prefixed with http:// in buildAppUrl)
   *   - empty: notification links degrade to relative paths
   * Relaxed validation so a malformed value doesn't crash the env loader and
   * cascade-fail every trip mutation — broken links are the worst case.
   */
  APP_URL: z.string().min(1).optional(),

  /* AWS S3 — receipt attachment upload (REQ-20260519). Allow empty string
   * (common in shared .env templates) — `getS3Config()` treats falsy as
   * "not configured" and returns null. */
  AWS_REGION: z.string().optional(),
  AWS_S3_BUCKET: z.string().optional(),
  AWS_ACCESS_KEY_ID: z.string().optional(),
  AWS_SECRET_ACCESS_KEY: z.string().optional(),
  S3_PRESIGN_EXPIRY_SECONDS: z
    .string()
    .regex(/^\d+$/)
    .optional()
    .transform((v) => (v ? Number(v) : 300)),
  S3_MAX_UPLOAD_BYTES: z
    .string()
    .regex(/^\d+$/)
    .optional()
    .transform((v) => (v ? Number(v) : 10_485_760)),

  /* Module 2 — Expense + Maintenance. */
  EXPENSE_LOCK_DAYS: z
    .string()
    .regex(/^\d+$/)
    .optional()
    .transform((v) => (v ? Number(v) : 7)),

  /* Bearer secret for /api/v1/cron/maintenance-alert. */
  CRON_SECRET: z.string().min(8).optional(),
});

type Env = z.infer<typeof envSchema>;

let cached: Env | null = null;

function loadEnv(): Env {
  if (cached) return cached;
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    /* eslint-disable-next-line no-console */
    console.error('[env] invalid environment variables:', parsed.error.flatten().fieldErrors);
    throw new Error('Invalid environment configuration — see server logs');
  }
  cached = parsed.data;
  return cached;
}

/** Get the parsed env object. Safe to call from any server context. */
export function getEnv(): Env {
  return loadEnv();
}

/**
 * Returns Resend config if fully configured, else null. Caller treats null
 * as "email transport disabled" (notification still queues in DB).
 */
export function getEmailConfig():
  | { apiKey: string; from: string; replyTo: string | undefined }
  | null {
  const env = loadEnv();
  if (!env.RESEND_API_KEY || !env.EMAIL_FROM) return null;
  return { apiKey: env.RESEND_API_KEY, from: env.EMAIL_FROM, replyTo: env.EMAIL_REPLY_TO };
}

/**
 * Returns VAPID config if fully configured, else null. Caller treats null
 * as "push transport disabled" (notification still queues in DB).
 */
export function getPushConfig():
  | { vapidPrivate: string; vapidPublic: string; contact: string }
  | null {
  const env = loadEnv();
  if (!env.WEB_PUSH_VAPID_PRIVATE || !env.WEB_PUSH_VAPID_PUBLIC || !env.WEB_PUSH_CONTACT) {
    return null;
  }
  return {
    vapidPrivate: env.WEB_PUSH_VAPID_PRIVATE,
    vapidPublic: env.WEB_PUSH_VAPID_PUBLIC,
    contact: env.WEB_PUSH_CONTACT,
  };
}

/**
 * Returns S3 config if fully configured, else null. Caller treats null
 * as "S3 upload disabled" — presigned attachment endpoint should 503.
 */
export function getS3Config():
  | {
      region: string;
      bucket: string;
      accessKeyId: string;
      secretAccessKey: string;
      presignExpirySeconds: number;
      maxUploadBytes: number;
    }
  | null {
  const env = loadEnv();
  if (
    !env.AWS_REGION ||
    !env.AWS_S3_BUCKET ||
    !env.AWS_ACCESS_KEY_ID ||
    !env.AWS_SECRET_ACCESS_KEY
  ) {
    return null;
  }
  return {
    region: env.AWS_REGION,
    bucket: env.AWS_S3_BUCKET,
    accessKeyId: env.AWS_ACCESS_KEY_ID,
    secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
    presignExpirySeconds: env.S3_PRESIGN_EXPIRY_SECONDS as number,
    maxUploadBytes: env.S3_MAX_UPLOAD_BYTES as number,
  };
}

/** Module 2 — expense edit lock window in days (default 7). */
export function getExpenseLockDays(): number {
  return loadEnv().EXPENSE_LOCK_DAYS as number;
}

/** Bearer secret expected by /api/v1/cron/* routes. Null = cron disabled. */
export function getCronSecret(): string | null {
  return loadEnv().CRON_SECRET ?? null;
}

/**
 * Build absolute URL from a basePath-relative path. Falls back to plain path
 * if APP_URL not configured — notification body still readable, just relative.
 * Auto-prepends http:// if APP_URL has no scheme (forgiving for `localhost:3001`).
 */
export function buildAppUrl(path: string): string {
  const env = loadEnv();
  if (!env.APP_URL) return path;
  let base = env.APP_URL.replace(/\/+$/, '');
  if (!/^https?:\/\//.test(base)) base = `http://${base}`;
  const trail = path.startsWith('/') ? path : `/${path}`;
  return `${base}${trail}`;
}
