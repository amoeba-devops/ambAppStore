import 'server-only';
import { cookies } from 'next/headers';
import { routing } from './routing';

const LOCALE_COOKIE = 'NEXT_LOCALE';

/**
 * UI locale of the current request — the language the user is looking at when
 * they press a button. Same resolution as `i18n/request.ts` minus the URL
 * segment (route handlers and server actions have no locale segment): the
 * in-app switcher's `NEXT_LOCALE` cookie, else the default.
 *
 * Used by every download/export path so the FILE NAME comes out in the
 * exporter's language (`screens.*.fileName*` keys), and by report generation so
 * the stored report name is written in that language too.
 */
export async function resolveUiLocale(): Promise<string> {
  const cookieLocale = (await cookies()).get(LOCALE_COOKIE)?.value ?? '';
  return (routing.locales as readonly string[]).includes(cookieLocale)
    ? cookieLocale
    : routing.defaultLocale;
}

const BCP47: Record<string, string> = { vi: 'vi-VN', en: 'en-US', ko: 'ko-KR' };

/** BCP-47 tag for number/date formatting inside a generated file. */
export function bcp47(locale: string): string {
  return BCP47[locale] ?? BCP47[routing.defaultLocale] ?? 'vi-VN';
}

/** Long month name in `locale` for a `YYYY-MM` string — en filenames and column
 * headers spell the month out ("June 2026") where vi/ko use the number. */
export function monthName(month: string, locale: string): string {
  const [y = '', mm = ''] = month.split('-');
  return new Date(Number(y), Number(mm) - 1, 1).toLocaleDateString(bcp47(locale), { month: 'long' });
}
