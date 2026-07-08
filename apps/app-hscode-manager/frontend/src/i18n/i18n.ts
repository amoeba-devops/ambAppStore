import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import hscodeKo from './locales/ko/hscode.json';
import hscodeEn from './locales/en/hscode.json';
import hscodeVi from './locales/vi/hscode.json';

const resources = {
  ko: { hscode: hscodeKo },
  en: { hscode: hscodeEn },
  vi: { hscode: hscodeVi },
};

const savedLng = localStorage.getItem('i18n_lng') || 'ko';

i18n.use(initReactI18next).init({
  resources,
  lng: savedLng,
  fallbackLng: 'ko',
  ns: ['hscode'],
  defaultNS: 'hscode',
  // 목업 사전은 평면 점표기 키("nav.qa")를 사용하므로 키 구분자/네임스페이스 분리 비활성
  keySeparator: false,
  nsSeparator: false,
  interpolation: { escapeValue: false },
});

i18n.on('languageChanged', (lng) => {
  localStorage.setItem('i18n_lng', lng);
});

export default i18n;
