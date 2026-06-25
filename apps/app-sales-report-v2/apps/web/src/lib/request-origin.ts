import type { NextRequest } from 'next/server';

/**
 * Returns the canonical public origin for the current request.
 *
 * Behind a reverse proxy (Render, Vercel, Cloudflare), `req.url` reports the
 * internal address (e.g., http://localhost:10000), which breaks redirects.
 *
 * Resolution priority:
 *   1. APP_URL env var (explicit override — set this for prod if needed)
 *   2. RENDER_EXTERNAL_URL (auto-set by Render)
 *   3. x-forwarded-proto + x-forwarded-host (standard proxy headers)
 *   4. host header
 *   5. req.url origin (fallback for local dev)
 */
export function getRequestOrigin(req: NextRequest): string {
  const fromEnv = process.env.APP_URL ?? process.env.RENDER_EXTERNAL_URL;
  if (fromEnv) return fromEnv.replace(/\/$/, '');

  const fwdProto = req.headers.get('x-forwarded-proto');
  const fwdHost = req.headers.get('x-forwarded-host') ?? req.headers.get('host');
  if (fwdHost) {
    const proto = fwdProto ?? (process.env.NODE_ENV === 'production' ? 'https' : 'http');
    return `${proto}://${fwdHost}`;
  }

  return new URL(req.url).origin;
}

export function absoluteUrl(req: NextRequest, path: string): URL {
  const safePath = path.startsWith('/') && !path.startsWith('//') ? path : '/';
  return new URL(safePath, getRequestOrigin(req));
}
