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
    let tokenClaims;
    try {
      tokenClaims = await verifyAmaJwt(incomingToken);
    } catch {
      return new NextResponse('Invalid token', { status: 401 });
    }
    const cleanUrl = new URL(pathname, getRequestOrigin(req));
    searchParams.forEach((value, key) => {
      if (key !== 'ama_token') cleanUrl.searchParams.set(key, value);
    });
    const res = NextResponse.redirect(cleanUrl);
    // Anchor maxAge to the JWT's own exp so the cookie never outlives the token.
    // Without maxAge the browser writes a session cookie that cross-site iframes
    // (and iOS Safari PWA) drop immediately — every reload then hits
    // no-cookie → /session-expired. (Same fix applied to car-manager-v2.)
    const nowSec = Math.floor(Date.now() / 1000);
    const maxAgeSec = Math.max(60, tokenClaims.exp - nowSec);
    res.cookies.set(SESSION_COOKIE, incomingToken, { ...cookieAttrs, maxAge: maxAgeSec });
    return res;
  }

  const cookieToken = req.cookies.get(SESSION_COOKIE)?.value;
  if (!cookieToken) {
    return NextResponse.redirect(absoluteUrl(req, '/session-expired'));
  }
  try {
    const claims = await verifyAmaJwt(cookieToken);
    // MUST propagate as REQUEST headers (not response headers) so RSC's
    // `headers()` in getCurrentUser() can read x-ent-id / x-user-id / x-user-role.
    // Setting on `res.headers` only sends them to the browser, not the RSC page.
    const requestHeaders = new Headers(req.headers);
    requestHeaders.set('x-ent-id', claims.ent_id);
    requestHeaders.set('x-user-id', claims.sub);
    requestHeaders.set('x-user-role', claims.role);
    if (claims.email) requestHeaders.set('x-user-email', claims.email);
    if (claims.name) requestHeaders.set('x-user-name', encodeURIComponent(claims.name));
    return NextResponse.next({ request: { headers: requestHeaders } });
  } catch {
    // Cookie present but verify failed — most common cause: cookie minted by
    // a sibling v2 app on the same origin with different `app_code`. Clear the
    // bad cookie so the next request takes the clean `no cookie → /session-expired`
    // path instead of looping.
    const res = NextResponse.redirect(absoluteUrl(req, '/session-expired'));
    res.cookies.delete(SESSION_COOKIE);
    return res;
  }
}

export const config = {
  // Must include explicit '/' — the single-pattern negative lookahead form
  // empirically does NOT match the root path in Next.js 15 with basePath enabled.
  matcher: ['/', '/((?!_next/static|_next/image|favicon.ico).+)'],
};
