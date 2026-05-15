'use server';

import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { routing, type AppLocale } from '@/i18n/routing';

const LOCALE_COOKIE = 'NEXT_LOCALE';
const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;
const IS_PROD = process.env.NODE_ENV === 'production';

export async function setLocaleAction(locale: string): Promise<{ success: boolean }> {
  if (!(routing.locales as readonly string[]).includes(locale)) {
    return { success: false };
  }
  const cookieStore = await cookies();
  cookieStore.set(LOCALE_COOKIE, locale as AppLocale, {
    httpOnly: false,
    secure: IS_PROD,
    sameSite: IS_PROD ? 'none' : 'lax',
    path: '/',
    maxAge: ONE_YEAR_SECONDS,
  });
  revalidatePath('/', 'layout');
  return { success: true };
}
