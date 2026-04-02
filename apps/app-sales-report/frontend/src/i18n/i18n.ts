import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import salesKo from './locales/ko/sales.json';
import salesEn from './locales/en/sales.json';
import salesVi from './locales/vi/sales.json';

const resources = {
  ko: { sales: salesKo },
  en: { sales: salesEn },
  vi: { sales: salesVi },
};

const savedLng = localStorage.getItem('i18n_lng') || 'ko';

i18n.use(initReactI18next).init({
  resources,
  lng: savedLng,
  fallbackLng: 'ko',
  ns: ['sales'],
  defaultNS: 'sales',
  interpolation: { escapeValue: false },
});

i18n.on('languageChanged', (lng) => {
  localStorage.setItem('i18n_lng', lng);
});

export default i18n;
