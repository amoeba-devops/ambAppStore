import { NextResponse, type NextRequest } from 'next/server';
import { SignJWT } from 'jose';
import { absoluteUrl } from '@/lib/request-origin';

const validRoles = ['OWNER', 'MASTER', 'MANAGER', 'MEMBER'] as const;
type AmaRole = (typeof validRoles)[number];

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  if (process.env.DEMO_AUTO_LOGIN !== 'true') {
    return new NextResponse('Demo login disabled. Set DEMO_AUTO_LOGIN=true to enable.', {
      status: 404,
    });
  }

  const roleParam = req.nextUrl.searchParams.get('role') ?? 'OWNER';
  if (!validRoles.includes(roleParam as AmaRole)) {
    return new NextResponse(`Invalid role. Use one of: ${validRoles.join(', ')}`, {
      status: 400,
    });
  }
  const role = roleParam as AmaRole;

  const secret = process.env.JWT_SECRET;
  if (!secret) {
    return new NextResponse('JWT_SECRET not set', { status: 500 });
  }

  const key = new TextEncoder().encode(secret);
  // Mirror AMA's real iframe-token payload shape (camelCase entityId/appCode,
  // no iss/aud) so the dev token passes the same verify path as production.
  const token = await new SignJWT({
    sub: '00000000-0000-0000-0000-000000000001',
    entityId: '00000000-0000-0000-0000-000000000010',
    role,
    email: `demo-${role.toLowerCase()}@dev.firgi.local`,
    name: `Demo ${role}`,
    appCode: 'sales-report-v2',
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
