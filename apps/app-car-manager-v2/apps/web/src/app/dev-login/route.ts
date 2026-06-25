import { NextResponse, type NextRequest } from 'next/server';
import { SignJWT } from 'jose';
import { absoluteUrl } from '@/lib/request-origin';

// Local dev only — gated by DEMO_AUTO_LOGIN=true. Mints an HS256 JWT with
// the same shape AMA would issue, then drops it into the session cookie.
// Use to test the app locally without a real ambManagement session.

const validRoles = ['OWNER', 'MASTER', 'MANAGER', 'MEMBER'] as const;
type AmaRole = (typeof validRoles)[number];

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  if (process.env.DEMO_AUTO_LOGIN !== 'true') {
    return new NextResponse(
      'Dev login disabled. Set DEMO_AUTO_LOGIN=true in .env to enable.',
      { status: 404 },
    );
  }

  const roleParam = req.nextUrl.searchParams.get('role') ?? 'OWNER';
  if (!validRoles.includes(roleParam as AmaRole)) {
    return new NextResponse(`Invalid role. Use one of: ${validRoles.join(', ')}`, { status: 400 });
  }
  const role = roleParam as AmaRole;

  const secret = process.env.JWT_SECRET;
  if (!secret) {
    return new NextResponse('JWT_SECRET not set', { status: 500 });
  }

  /* E2E test support: cho phép override entityId + sub qua query params (gated
   * bởi DEMO_AUTO_LOGIN=true). Test có thể mint token cho 1 entity thật trong
   * db_amb để verify integration với AMA `/entity-settings/members`.
   * Default fallback các users đã được seed bởi
   * `scripts/seed-dev-accounts.mjs` trên DEV01 entity. */
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const entIdOverride = req.nextUrl.searchParams.get('ent_id');
  const subOverride = req.nextUrl.searchParams.get('sub');
  if (entIdOverride && !UUID_RE.test(entIdOverride)) {
    return new NextResponse('Invalid ent_id format (need UUID).', { status: 400 });
  }
  if (subOverride && !UUID_RE.test(subOverride)) {
    return new NextResponse('Invalid sub format (need UUID).', { status: 400 });
  }
  /* Sentinel format: position 13 = '4' (RFC 4122 version), position 17 = '8'
   * (variant 10xx). AMA `resolveEntityId` uses strict `uuidValidate()` —
   * sentinels all-zeros với version=0 (legacy seed) reject với 400. Keep
   * pattern human-readable: last byte distinguishes ent / owner / manager / driver. */
  const entityId = entIdOverride ?? '00000000-0000-4000-8000-000000000010';
  const DEFAULT_SUB_BY_ROLE: Record<AmaRole, string> = {
    OWNER:   '00000000-0000-4000-8000-000000000001',
    MASTER:  '00000000-0000-4000-8000-000000000001',
    MANAGER: '00000000-0000-4000-8000-000000000002',
    MEMBER:  '00000000-0000-4000-8000-000000000003',
  };
  const sub = subOverride ?? DEFAULT_SUB_BY_ROLE[role];

  /* AMA `OwnEntityGuard` (apps/api/src/domain/auth/guard/own-entity.guard.ts)
   * chỉ accept `user.role === 'MASTER' || 'ADMIN'` cho USER_LEVEL. Token với
   * role 'OWNER' literal sẽ bị guard reject 403 khi gọi `/entity-settings/*`.
   *
   * Seed-dev-accounts insert `usr_role = MASTER` cho user owner — token phải
   * mint match DB row, không match URL param. Map URL alias → actual JWT role:
   *   ?role=OWNER  → token role 'MASTER' (seed user thực sự là MASTER)
   *   ?role=MASTER → token role 'MASTER'
   *   ?role=MANAGER → token role 'MANAGER'
   *   ?role=MEMBER → token role 'MEMBER'
   *
   * v2-side: mapAmaRoleToLocal đã treat MASTER ≡ OWNER → local ADMIN, không
   * affect UI/routing. AMA-side: guard pass. */
  const URL_TO_JWT_ROLE: Record<AmaRole, AmaRole> = {
    OWNER:   'MASTER',
    MASTER:  'MASTER',
    MANAGER: 'MANAGER',
    MEMBER:  'MEMBER',
  };
  const jwtRole = URL_TO_JWT_ROLE[role];

  const key = new TextEncoder().encode(secret);
  // Payload shape MUST match AMA's `generateAppToken` exactly — camelCase keys
  // (`entityId`, `appCode`) — so amaJwtClaimsSchema.parse() succeeds on verify.
  // See packages/shared/src/auth/jwt-claims.ts. Drift between mint and verify
  // shows up as: cookie set → next request fails Zod parse → /session-expired
  // loop with the cookie cleared.
  //
  // E2E mode (sub/ent_id override): bỏ email + name khỏi payload để
  // ensureCarUser KHÔNG overwrite các giá trị thật trong car_users với fake
  // `demo-master@dev.local`. Test cần data nguyên vẹn cho assertions.
  const isTestMode = !!entIdOverride && !!subOverride;
  const payload: Record<string, unknown> = {
    sub,
    entityId,
    role: jwtRole,
    appCode: 'car-manager-v2',
  };
  if (!isTestMode) {
    payload.email = `demo-${role.toLowerCase()}@dev.car-manager-v2.local`;
    payload.name = `Demo ${role}`;
  }
  const token = await new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('8h')
    .sign(key);

  const IS_PROD = process.env.NODE_ENV === 'production';
  const cookieName = process.env.SESSION_COOKIE_NAME ?? 'amb_session';
  const redirectTo = req.nextUrl.searchParams.get('next') ?? '/';

  // Localhost dev/screenshot pipeline runs over plain HTTP — WebKit (mobile
  // Safari) rejects `secure=true; sameSite=none` cookies over HTTP, so the
  // session never sticks and downstream tests land back on /login. When the
  // host is localhost, downgrade to `secure=false; sameSite=lax` regardless of
  // NODE_ENV so the screenshot pipeline works under `next start` too.
  const isLocalhost = req.nextUrl.hostname === 'localhost' || req.nextUrl.hostname === '127.0.0.1';
  const cookieSecure = IS_PROD && !isLocalhost;
  const cookieSameSite: 'none' | 'lax' = IS_PROD && !isLocalhost ? 'none' : 'lax';

  const res = NextResponse.redirect(absoluteUrl(req, redirectTo));
  res.cookies.set(cookieName, token, {
    httpOnly: true,
    secure: cookieSecure,
    sameSite: cookieSameSite,
    path: '/',
    maxAge: 60 * 60 * 8,
  });
  return res;
}
