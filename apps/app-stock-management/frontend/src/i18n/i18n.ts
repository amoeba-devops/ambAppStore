import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import stockKo from './locales/ko/stock.json';
import stockEn from './locales/en/stock.json';
import stockVi from './locales/vi/stock.json';

const resources = {
  ko: { stock: stockKo },
  en: { stock: stockEn },
  vi: { stock: stockVi },
};

const savedLng = localStorage.getItem('i18n_lng') || 'ko';

i18n.use(initReactI18next).init({
  resources,
  lng: savedLng,
  fallbackLng: 'ko',
  ns: ['stock'],
  defaultNS: 'stock',
  interpolation: { escapeValue: false },
});

i18n.on('languageChanged', (lng) => {
  localStorage.setItem('i18n_lng', lng);
});

export default i18n;
