import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import platformKo from './locales/ko/platform.json';
import platformEn from './locales/en/platform.json';
import adminKo from './locales/ko/admin.json';
import adminEn from './locales/en/admin.json';

const resources = {
  ko: { platform: platformKo, admin: adminKo },
  en: { platform: platformEn, admin: adminEn },
};

i18n.use(initReactI18next).init({
  resources,
  lng: 'ko',
  fallbackLng: 'ko',
  ns: ['platform', 'admin'],
  defaultNS: 'platform',
  interpolation: { escapeValue: false },
});

export default i18n;
