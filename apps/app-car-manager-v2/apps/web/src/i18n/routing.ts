import { defineRouting } from 'next-intl/routing';

export const routing = defineRouting({
  locales: ['vi', 'en', 'ko'],
  defaultLocale: (process.env.NEXT_PUBLIC_DEFAULT_LOCALE as 'vi' | 'en' | 'ko') ?? 'vi',
  localePrefix: 'as-needed',
});

export type AppLocale = (typeof routing.locales)[number];
