import { cookies } from 'next/headers';
import { getRequestConfig } from 'next-intl/server';
import { routing } from './routing';

const LOCALE_COOKIE = 'NEXT_LOCALE';

export default getRequestConfig(async ({ requestLocale }) => {
  /* Priority: explicitly requested locale > cookie set by in-app switcher > default.
   *
   * `requestLocale` is ONLY set here when a caller asks for a specific language —
   * `getTranslations({ locale })` — because this app runs without next-intl's
   * middleware and without a `[locale]` URL segment, so a normal page render has
   * no request locale at all and falls through to the cookie.
   *
   * The order matters: with the cookie first, an explicit request was silently
   * overruled, so `getTranslations({ locale: 'en' })` handed back the viewer's
   * language. That broke every multi-language server render — the trilingual
   * MONTHLY_SUMMARY workbook got three sheets in ONE language (and then died on
   * ExcelJS's duplicate-sheet-name check), and notification emails went out in
   * the sender's language instead of the recipient's. */
  const cookieStore = await cookies();
  const cookieLocale = cookieStore.get(LOCALE_COOKIE)?.value;
  const requested = await requestLocale;

  const candidate = requested ?? cookieLocale ?? '';
  const locale = (routing.locales as readonly string[]).includes(candidate)
    ? candidate
    : routing.defaultLocale;

  return {
    locale,
    messages: (await import(`../../messages/${locale}.json`)).default,
  };
});
