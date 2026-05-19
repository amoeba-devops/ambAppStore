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
