import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import platformKo from './locales/ko/platform.json';
import platformEn from './locales/en/platform.json';

const resources = {
  ko: { platform: platformKo },
  en: { platform: platformEn },
};

i18n.use(initReactI18next).init({
  resources,
  lng: 'ko',
  fallbackLng: 'ko',
  ns: ['platform'],
  defaultNS: 'platform',
  interpolation: { escapeValue: false },
});

export default i18n;
