import type { NextRequest } from 'next/server';

/**
 * Returns the canonical public origin for the current request.
 * Behind Render's reverse proxy, req.url reports internal address — breaks redirects.
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
