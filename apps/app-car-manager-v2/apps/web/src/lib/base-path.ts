/**
 * basePath-aware path builder for hand-written URLs (Client + Server safe).
 *
 * The app is served under a deployment-specific basePath:
 *   - `/app-car-manager-v2` behind apps.amoeba.site (BASE_PATH build arg)
 *   - empty on Render / local dev
 *
 * Next.js auto-prepends basePath to <Link>, the router, and <Image>, but NOT
 * to raw `<form action>` or `fetch()`. A hand-written `/api/...` therefore
 * escapes the app's mount point and hits the platform reverse proxy instead
 * (location /api/ → bff-platform), which 404s with `PLT-E9999 Cannot POST ...`.
 * Route every hand-written URL that targets our own routes through this helper.
 *
 * NEXT_PUBLIC_BASE_PATH is inlined at build time (see next.config.mjs `env`),
 * so reading it here is safe in both Server and Client Components.
 */
const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? '';

/** Prefix an app-relative path (e.g. `/api/auth/login`) with the basePath. */
export function apiPath(path: string): string {
  const trail = path.startsWith('/') ? path : `/${path}`;
  return `${BASE_PATH}${trail}`;
}
