import { NextResponse, type NextRequest } from 'next/server';
import { verifyAmaJwt } from '@/lib/auth/verify-jwt';
import { absoluteUrl } from '@/lib/request-origin';

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
    // `req.nextUrl.clone()` preserves basePath; building from `pathname` alone
    // would strip it and bounce the user to the platform catalog instead of
    // back to the app dashboard.
    const cleanUrl = req.nextUrl.clone();
    cleanUrl.searchParams.delete('ama_token');
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
    // MUST propagate as REQUEST headers (not response headers) so RSC's
    // `headers()` in getCurrentUser() can read x-ent-id / x-user-id / x-user-role.
    // Setting on `res.headers` would only send them to the browser, not the page.
    const requestHeaders = new Headers(req.headers);
    requestHeaders.set('x-ent-id', claims.ent_id);
    requestHeaders.set('x-user-id', claims.sub);
    requestHeaders.set('x-user-role', claims.role);
    return NextResponse.next({ request: { headers: requestHeaders } });
  } catch {
    // Cookie present but verification failed — most common cause: cookie minted
    // by a sibling app with different `app_code` (Zod parse fails). On localhost
    // dev, all amb apps share the same cookie name on the same origin, so this
    // is expected. Clear the bad cookie so the next request goes through the
    // clean `no cookie → /session-expired → re-login` flow instead of looping.
    const res = NextResponse.redirect(absoluteUrl(req, '/session-expired'));
    res.cookies.delete(SESSION_COOKIE);
    return res;
  }
}

export const config = {
  // Match every path INCLUDING root '/' — the pattern needs both an explicit
  // '/' entry AND the negative-lookahead variant; using only the latter skips
  // the root request (which is where the dashboard lives under basePath).
  matcher: ['/', '/((?!_next/static|_next/image|favicon.ico).+)'],
};
