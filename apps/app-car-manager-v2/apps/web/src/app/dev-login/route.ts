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

  const key = new TextEncoder().encode(secret);
  // Payload shape MUST match AMA's `generateAppToken` exactly — camelCase keys
  // (`entityId`, `appCode`) — so amaJwtClaimsSchema.parse() succeeds on verify.
  // See packages/shared/src/auth/jwt-claims.ts. Drift between mint and verify
  // shows up as: cookie set → next request fails Zod parse → /session-expired
  // loop with the cookie cleared.
  const token = await new SignJWT({
    sub: '00000000-0000-0000-0000-000000000001',
    entityId: '00000000-0000-0000-0000-000000000010',
    role,
    email: `demo-${role.toLowerCase()}@dev.car-manager-v2.local`,
    name: `Demo ${role}`,
    appCode: 'car-manager-v2',
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('8h')
    .sign(key);

  const IS_PROD = process.env.NODE_ENV === 'production';
  const cookieName = process.env.SESSION_COOKIE_NAME ?? 'amb_session';
  const redirectTo = req.nextUrl.searchParams.get('next') ?? '/';

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
