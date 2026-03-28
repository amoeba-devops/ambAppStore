import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import carKo from './locales/ko/car.json';
import carEn from './locales/en/car.json';
import carVi from './locales/vi/car.json';

const resources = {
  ko: { car: carKo },
  en: { car: carEn },
  vi: { car: carVi },
};

const savedLng = localStorage.getItem('i18n_lng') || 'ko';

i18n.use(initReactI18next).init({
  resources,
  lng: savedLng,
  fallbackLng: 'ko',
  ns: ['car'],
  defaultNS: 'car',
  interpolation: { escapeValue: false },
});

i18n.on('languageChanged', (lng) => {
  localStorage.setItem('i18n_lng', lng);
});

export default i18n;
