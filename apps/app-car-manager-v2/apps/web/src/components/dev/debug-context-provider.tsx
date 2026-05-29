import 'server-only';
import { cookies } from 'next/headers';
import { getCurrentUser } from '@/lib/auth/get-current-user';
import { safeDecodeJwt } from './decode-jwt';
import type { DebugCookieMeta, DebugServerContext } from './debug-context-panel';

const SESSION_COOKIE = process.env.SESSION_COOKIE_NAME ?? 'amb_session';

/**
 * Returns true when the debug panel should render.
 *
 *   - dev (NODE_ENV !== 'production')  → always on
 *   - prod build + DEBUG_PANEL_ENABLED=true  → on (staging troubleshooting)
 *   - prod build + anything else  → OFF (production safety)
 *
 * Evaluated server-side, so dead branches don't ship to the client when off.
 */
function isDebugEnabled(): boolean {
  if (process.env.NODE_ENV !== 'production') return true;
  return process.env.DEBUG_PANEL_ENABLED === 'true';
}

/**
 * DebugContextProvider — RSC gate. Pulls AuthContext + cookie metadata from
 * the request and forwards to <DebugContextPanel /> (client). Returns null in
 * production unless DEBUG_PANEL_ENABLED is explicitly true, so the dependency
 * graph collapses and the panel module is not shipped to the browser.
 */
export async function DebugContextProvider() {
  // Early bail BEFORE importing the panel. `await import()` keeps the client
  // chunk reference inside a dead branch in prod builds, so bundlers can drop
  // it entirely. A static top-level import would pin the chunk regardless.
  if (!isDebugEnabled()) return null;

  // Server context. CAR-E0101 is the expected "no session" shape; treat as
  // null instead of bubbling — the panel is meant to *show* that state.
  let serverContext: DebugServerContext | null = null;
  try {
    const user = await getCurrentUser();
    serverContext = {
      entId: user.entId,
      userId: user.userId,
      amaRole: user.amaRole,
      role: user.role,
    };
  } catch {
    serverContext = null;
  }

  // Cookie metadata — never expose the raw value (HttpOnly intent).
  const jar = await cookies();
  const cookieEntry = jar.get(SESSION_COOKIE);
  const decoded = cookieEntry?.value ? safeDecodeJwt(cookieEntry.value) : null;

  const nowSec = Math.floor(Date.now() / 1000);
  const expSec = typeof decoded?.exp === 'number' ? decoded.exp : null;
  const cookieMeta: DebugCookieMeta = {
    exists: !!cookieEntry,
    expiresInSec: expSec !== null ? expSec - nowSec : null,
    expiresAt: expSec !== null ? new Date(expSec * 1000).toISOString() : null,
  };

  const { DebugContextPanel } = await import('./debug-context-panel');
  return (
    <DebugContextPanel
      serverContext={serverContext}
      cookieMeta={cookieMeta}
      decodedClaims={decoded}
    />
  );
}
