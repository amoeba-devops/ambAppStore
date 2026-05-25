import { NextResponse, type NextRequest } from 'next/server';
import { SignJWT } from 'jose';
import { absoluteUrl } from '@/lib/request-origin';

// Local dev only — gated by DEMO_AUTO_LOGIN=true. Mints an HS256 JWT with
// the same shape AMA would issue, then drops it into the session cookie.
// Use to test the app locally without a real ambManagement session.
//
// Query params (all optional):
//   role     — OWNER | MASTER | MANAGER | MEMBER (default: OWNER)
//   userId   — UUID overriding the default subject (default: 000...001)
//   entityId — UUID overriding the default tenant (default: 000...010)
//   name     — display name (default: "Demo <ROLE>")
//   email    — email (default: "demo-<role>@dev.car-manager-v2.local")
//   preset   — convenience bundle: admin-vi | manager-vi | driver-vi |
//                                 admin-ko | manager-ko | driver-ko
//              Sets userId/role/name/email together; individual params still
//              win if also passed. Used by the user-guide screenshot pipeline.
//   next     — post-login redirect (default: /)

const validRoles = ['OWNER', 'MASTER', 'MANAGER', 'MEMBER'] as const;
type AmaRole = (typeof validRoles)[number];

const DEFAULT_USER_ID = '00000000-0000-0000-0000-000000000001';
const DEFAULT_ENT_ID = '00000000-0000-0000-0000-000000000010';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Presets mirror the seed (db-seed.mjs + seed-user-guide.mjs) so the
// screenshot pipeline can hit the right user with one short query string.
const PRESETS: Record<string, { role: AmaRole; userId: string; name: string; email: string }> = {
  'admin-vi':   { role: 'OWNER',   userId: '00000000-0000-0000-0000-000000000001', name: 'Nguyễn Thanh An', email: 'an.nguyen@amoeba.group' },
  'manager-vi': { role: 'MANAGER', userId: '11111111-1111-1111-1111-111111111200', name: 'Lê Hoàng',         email: 'hoang.le@amoeba.group' },
  'driver-vi':  { role: 'MEMBER',  userId: '11111111-1111-1111-1111-111111111101', name: 'Nguyễn Văn Tú',    email: 'tu.nguyen@amoeba.group' },
  'admin-ko':   { role: 'OWNER',   userId: '00000000-0000-0000-0000-000000000001', name: '박준호',            email: 'park.joonho@amoeba.group' },
  'manager-ko': { role: 'MANAGER', userId: '11111111-1111-1111-1111-111111111200', name: '김민수',            email: 'kim.minsoo@amoeba.group' },
  'driver-ko':  { role: 'MEMBER',  userId: '11111111-1111-1111-1111-111111111101', name: '이성재',            email: 'lee.sungjae@amoeba.group' },
};

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  if (process.env.DEMO_AUTO_LOGIN !== 'true') {
    return new NextResponse(
      'Dev login disabled. Set DEMO_AUTO_LOGIN=true in .env to enable.',
      { status: 404 },
    );
  }

  const q = req.nextUrl.searchParams;

  // Apply preset first; explicit query params then override individual fields.
  const presetKey = q.get('preset');
  const preset = presetKey ? PRESETS[presetKey] : undefined;
  if (presetKey && !preset) {
    return new NextResponse(
      `Unknown preset "${presetKey}". Valid: ${Object.keys(PRESETS).join(', ')}`,
      { status: 400 },
    );
  }

  const roleParam = q.get('role') ?? preset?.role ?? 'OWNER';
  if (!validRoles.includes(roleParam as AmaRole)) {
    return new NextResponse(`Invalid role. Use one of: ${validRoles.join(', ')}`, { status: 400 });
  }
  const role = roleParam as AmaRole;

  const userId = q.get('userId') ?? preset?.userId ?? DEFAULT_USER_ID;
  if (!UUID_RE.test(userId)) {
    return new NextResponse(`Invalid userId — must be a UUID`, { status: 400 });
  }

  const entityId = q.get('entityId') ?? DEFAULT_ENT_ID;
  if (!UUID_RE.test(entityId)) {
    return new NextResponse(`Invalid entityId — must be a UUID`, { status: 400 });
  }

  const name = q.get('name') ?? preset?.name ?? `Demo ${role}`;
  const email = q.get('email') ?? preset?.email ?? `demo-${role.toLowerCase()}@dev.car-manager-v2.local`;

  const secret = process.env.JWT_SECRET;
  if (!secret) {
    return new NextResponse('JWT_SECRET not set', { status: 500 });
  }

  const key = new TextEncoder().encode(secret);
  // Payload shape MUST match AMA's `generateAppToken` exactly — camelCase keys
  // (`entityId`, `appCode`) — so amaJwtClaimsSchema.parse() succeeds on verify.
  // See packages/shared/src/auth/jwt-claims.ts. Drift between mint and verify
  // shows up as: cookie set → next request fails Zod parse → /session-expired
  // loop with the cookie cleared.
  const token = await new SignJWT({
    sub: userId,
    entityId,
    role,
    email,
    name,
    appCode: 'car-manager-v2',
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('8h')
    .sign(key);

  const IS_PROD = process.env.NODE_ENV === 'production';
  const cookieName = process.env.SESSION_COOKIE_NAME ?? 'amb_session';
  const redirectTo = q.get('next') ?? '/';

  const res = NextResponse.redirect(absoluteUrl(req, redirectTo));
  res.cookies.set(cookieName, token, {
    httpOnly: true,
    secure: IS_PROD,
    sameSite: IS_PROD ? 'none' : 'lax',
    path: '/',
    maxAge: 60 * 60 * 8,
  });
  return res;
}
