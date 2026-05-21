import { cookies } from 'next/headers';
import { getRequestConfig } from 'next-intl/server';
import { routing } from './routing';

const LOCALE_COOKIE = 'NEXT_LOCALE';

export default getRequestConfig(async ({ requestLocale }) => {
  // Priority: explicit cookie set by in-app switcher > URL-based locale > default.
  const cookieStore = await cookies();
  const cookieLocale = cookieStore.get(LOCALE_COOKIE)?.value;
  const requested = await requestLocale;

  const candidate = cookieLocale ?? requested ?? '';
  const locale = (routing.locales as readonly string[]).includes(candidate)
    ? candidate
    : routing.defaultLocale;

  return {
    locale,
    messages: (await import(`../../messages/${locale}.json`)).default,
  };
});
