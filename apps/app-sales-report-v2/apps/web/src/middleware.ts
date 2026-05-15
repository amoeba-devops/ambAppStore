import { NextResponse, type NextRequest } from 'next/server';
import { verifyAmaJwt } from '@/lib/auth/verify-jwt';
import { absoluteUrl, getRequestOrigin } from '@/lib/request-origin';

const SESSION_COOKIE = process.env.SESSION_COOKIE_NAME ?? 'amb_session';
const PUBLIC_PATHS = ['/api/v1/health', '/session-expired', '/dev-login', '/_next', '/favicon.ico'];
const IS_PROD = process.env.NODE_ENV === 'production';

const cookieAttrs = {
  httpOnly: true,
  secure: IS_PROD,
  sameSite: IS_PROD ? ('none' as const) : ('lax' as const),
  path: '/',
};

export async function middleware(req: NextRequest) {
  const { pathname, searchParams } = req.nextUrl;

  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  const incomingToken = searchParams.get('ama_token');
  if (incomingToken) {
    try {
      await verifyAmaJwt(incomingToken);
    } catch {
      return new NextResponse('Invalid token', { status: 401 });
    }
    const cleanUrl = new URL(pathname, getRequestOrigin(req));
    searchParams.forEach((value, key) => {
      if (key !== 'ama_token') cleanUrl.searchParams.set(key, value);
    });
    const res = NextResponse.redirect(cleanUrl);
    res.cookies.set(SESSION_COOKIE, incomingToken, cookieAttrs);
    return res;
  }

  const cookieToken = req.cookies.get(SESSION_COOKIE)?.value;
  if (!cookieToken) {
    return NextResponse.redirect(absoluteUrl(req, '/session-expired'));
  }
  try {
    const claims = await verifyAmaJwt(cookieToken);
    const res = NextResponse.next();
    res.headers.set('x-ent-id', claims.ent_id);
    res.headers.set('x-user-id', claims.sub);
    res.headers.set('x-user-role', claims.role);
    if (claims.email) res.headers.set('x-user-email', claims.email);
    if (claims.name) res.headers.set('x-user-name', encodeURIComponent(claims.name));
    return res;
  } catch {
    return NextResponse.redirect(absoluteUrl(req, '/session-expired'));
  }
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
