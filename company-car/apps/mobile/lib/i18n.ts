import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import * as Localization from 'expo-localization';

import en from '../locales/en.json';
import ko from '../locales/ko.json';
import vi from '../locales/vi.json';

const SUPPORTED = ['en', 'ko', 'vi'] as const;
type Locale = (typeof SUPPORTED)[number];

function detectLocale(): Locale {
  const tag = Localization.getLocales()[0]?.languageCode ?? 'en';
  return (SUPPORTED as readonly string[]).includes(tag) ? (tag as Locale) : 'en';
}

i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    ko: { translation: ko },
    vi: { translation: vi },
  },
  lng: detectLocale(),
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
});

export default i18n;
