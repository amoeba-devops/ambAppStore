export const locales = ['en', 'ko'] as const;
export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = 'en';

export const localeNames: Record<Locale, string> = {
  en: 'English',
  ko: '한국어',
};

export const LOCALE_COOKIE = 'sal_locale';

export function isLocale(value: string | undefined | null): value is Locale {
  return value === 'en' || value === 'ko';
}
