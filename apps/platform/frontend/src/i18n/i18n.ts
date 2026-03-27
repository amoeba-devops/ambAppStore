import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import platformKo from './locales/ko/platform.json';
import platformEn from './locales/en/platform.json';
import platformVi from './locales/vi/platform.json';
import adminKo from './locales/ko/admin.json';
import adminEn from './locales/en/admin.json';
import adminVi from './locales/vi/admin.json';

const resources = {
  ko: { platform: platformKo, admin: adminKo },
  en: { platform: platformEn, admin: adminEn },
  vi: { platform: platformVi, admin: adminVi },
};

const savedLng = localStorage.getItem('i18n_lng') || 'ko';

i18n.use(initReactI18next).init({
  resources,
  lng: savedLng,
  fallbackLng: 'ko',
  ns: ['platform', 'admin'],
  defaultNS: 'platform',
  interpolation: { escapeValue: false },
});

i18n.on('languageChanged', (lng) => {
  localStorage.setItem('i18n_lng', lng);
});

export default i18n;
