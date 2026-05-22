import 'server-only';
import { cookies } from 'next/headers';
import { defaultLocale, isLocale, LOCALE_COOKIE, type Locale } from './config';

/**
 * Resolve the active locale for the current request.
 *
 * Order of precedence:
 * 1. `sal_locale` cookie (set by the in-app language switcher)
 * 2. fallback `defaultLocale` ('en')
 *
 * AMA iframe can override later by reading `?locale=` query param in the
 * middleware and setting the cookie before the page renders.
 */
export async function getRequestLocale(): Promise<Locale> {
  const store = await cookies();
  const fromCookie = store.get(LOCALE_COOKIE)?.value;
  if (isLocale(fromCookie)) return fromCookie;
  return defaultLocale;
}
