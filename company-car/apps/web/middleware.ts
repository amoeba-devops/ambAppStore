import createIntlMiddleware from 'next-intl/middleware';
import { NextResponse, type NextRequest } from 'next/server';
import { routing } from './i18n/routing';

const intlMiddleware = createIntlMiddleware(routing);

const PUBLIC_PATHS = ['/login', '/sso-callback'];
const API_PUBLIC = [
  '/api/health',
  '/api/auth',
  '/api/mobile/auth/login',
  '/api/mobile/auth/refresh',
  '/api/cron',
];

function isApiPublic(pathname: string): boolean {
  return API_PUBLIC.some((p) => pathname === p || pathname.startsWith(p + '/'));
}

function stripLocale(pathname: string): string {
  for (const loc of routing.locales) {
    if (pathname === `/${loc}`) return '/';
    if (pathname.startsWith(`/${loc}/`)) return pathname.slice(`/${loc}`.length);
  }
  return pathname;
}

export default function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // API routes: only check public list, skip i18n
  if (pathname.startsWith('/api/')) {
    if (isApiPublic(pathname)) return NextResponse.next();
    // Auth gating for protected APIs is handled at route handler level
    // (need DB access — middleware runs on edge by default)
    return NextResponse.next();
  }

  // i18n for everything else
  const response = intlMiddleware(req);

  // Light auth gate for protected pages: check if Auth.js cookie is present
  const stripped = stripLocale(pathname);
  const isPublicPage = PUBLIC_PATHS.some((p) => stripped === p || stripped.startsWith(p + '/'));
  if (!isPublicPage && stripped !== '/login') {
    const sessionCookie =
      req.cookies.get('authjs.session-token') ?? req.cookies.get('__Secure-authjs.session-token');
    if (!sessionCookie) {
      const url = req.nextUrl.clone();
      url.pathname = '/login';
      url.searchParams.set('callbackUrl', pathname);
      return NextResponse.redirect(url);
    }
  }

  return response;
}

export const config = {
  matcher: ['/((?!_next|_vercel|favicon.ico|.*\\..*).*)'],
};
