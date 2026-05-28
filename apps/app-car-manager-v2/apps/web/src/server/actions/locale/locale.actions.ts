'use server';

import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { and, eq } from 'drizzle-orm';
import { db } from '@car-v2/db/client';
import { carUsers } from '@car-v2/db/schema';
import { routing, type AppLocale } from '@/i18n/routing';
import { getCurrentUser } from '@/lib/auth/get-current-user';

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

  /* Mirror the choice into car_users so server-side renderers (email + push,
   * which run without a Next.js request context) use the latest preference
   * instead of the value frozen at onboarding. Silently skipped for the
   * unauthenticated locale switch on the login screen — getCurrentUser
   * throws CAR-E0101 when middleware hasn't injected the auth headers. */
  try {
    const actor = await getCurrentUser();
    await db
      .update(carUsers)
      .set({ usrPreferredLocale: locale, usrUpdatedAt: new Date() })
      .where(and(eq(carUsers.usrId, actor.userId), eq(carUsers.entId, actor.entId)));
  } catch {
    /* Unauthenticated locale switch (login page) — cookie alone is enough. */
  }

  revalidatePath('/', 'layout');
  return { success: true };
}
