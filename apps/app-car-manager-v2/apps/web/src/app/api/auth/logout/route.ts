import { NextResponse, type NextRequest } from 'next/server';
import { absoluteUrl } from '@/lib/request-origin';

/**
 * D-013 — Logout / Switch user.
 *
 * Clear 3 cookies (amb_session, amb_ama_access, amb_ama_refresh) + best-effort
 * call AMA /auth/logout. Redirect /login.
 *
 * Accepts GET (link click) + POST (form submit). Idempotent.
 */

const AMA_API = process.env.AMA_API_BASE_URL ?? 'http://localhost:3009/api/v1';

export const dynamic = 'force-dynamic';

async function doLogout(req: NextRequest): Promise<NextResponse> {
  const sessionCookie = process.env.SESSION_COOKIE_NAME ?? 'amb_session';
  const amaAccess = req.cookies.get('amb_ama_access')?.value;

  // Best-effort: notify AMA. Fire-and-forget — không block flow.
  if (amaAccess) {
    fetch(`${AMA_API}/auth/logout`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${amaAccess}` },
    }).catch(() => {
      /* ignore — local cookie clear is the authoritative action */
    });
  }

  const res = NextResponse.redirect(absoluteUrl(req, '/login'));
  res.cookies.delete(sessionCookie);
  res.cookies.delete('amb_ama_access');
  res.cookies.delete('amb_ama_refresh');
  return res;
}

export async function GET(req: NextRequest) {
  return doLogout(req);
}

export async function POST(req: NextRequest) {
  return doLogout(req);
}
