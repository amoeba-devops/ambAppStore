'use server';

import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { isLocale, LOCALE_COOKIE } from '@/i18n/config';

const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

/**
 * Persist the user's language preference in an HttpOnly-style cookie so the
 * choice survives reloads + new tabs. Called by the header LanguageSwitcher.
 *
 * NOTE: not HttpOnly because we may want to read it client-side later. It only
 * controls UI strings — no security boundary.
 */
export async function setLocaleAction(nextLocale: string): Promise<{ ok: true }> {
  if (!isLocale(nextLocale)) {
    throw new Error(`Unsupported locale: ${nextLocale}`);
  }
  const store = await cookies();
  store.set(LOCALE_COOKIE, nextLocale, {
    maxAge: ONE_YEAR_SECONDS,
    path: '/',
    sameSite: 'lax',
  });
  // Force any server-rendered surface (Sidebar, PageTitleHeader, etc.) to
  // re-fetch translations under the new locale.
  revalidatePath('/', 'layout');
  return { ok: true };
}
