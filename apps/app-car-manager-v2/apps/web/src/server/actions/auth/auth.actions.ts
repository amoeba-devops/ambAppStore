'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

const SESSION_COOKIE = process.env.SESSION_COOKIE_NAME ?? 'amb_session';

/**
 * Clears the AMA session cookie and redirects to `/session-expired`.
 *
 * The redirect is server-side so Next.js prepends `basePath` automatically —
 * a client-side `window.location.href = '/session-expired'` would skip the
 * prefix and land on the platform shell (blank page) when this app is
 * mounted under nginx at `/app-car-manager-v2/*`. See BUG-260522.
 *
 * `/session-expired` itself owns the "back to AMA" CTA, so we don't need to
 * touch `NEXT_PUBLIC_AMA_ORIGIN` here (often unset or has wildcards that
 * break URL parsing).
 */
export async function logoutAction(): Promise<never> {
  const cookieStore = await cookies();
  /* Clear every auth cookie — not just the app session — so logout is a clean
   * slate (matches the /api/auth/logout route). The client wipes web storage +
   * caches before invoking this. */
  cookieStore.delete(SESSION_COOKIE);
  cookieStore.delete('amb_ama_access');
  cookieStore.delete('amb_ama_refresh');
  redirect('/session-expired');
}
