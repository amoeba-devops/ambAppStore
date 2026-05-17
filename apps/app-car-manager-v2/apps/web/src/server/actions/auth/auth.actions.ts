'use server';

import { cookies } from 'next/headers';

const SESSION_COOKIE = process.env.SESSION_COOKIE_NAME ?? 'amb_session';

/**
 * Clears the AMA session cookie. The client navigates to `/session-expired`
 * after this resolves — that page handles the "back to AMA" button so we
 * don't have to validate `NEXT_PUBLIC_AMA_ORIGIN` here (it's often unset
 * or has wildcard chars that break URL parsing).
 */
export async function logoutAction(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);
}
