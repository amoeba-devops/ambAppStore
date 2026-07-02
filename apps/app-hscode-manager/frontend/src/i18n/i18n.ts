import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import commonKo from './locales/ko/common.json';
import commonEn from './locales/en/common.json';
import commonVi from './locales/vi/common.json';
import adminKo from './locales/ko/admin.json';
import adminEn from './locales/en/admin.json';
import adminVi from './locales/vi/admin.json';
import inquiryKo from './locales/ko/inquiry.json';
import inquiryEn from './locales/en/inquiry.json';
import inquiryVi from './locales/vi/inquiry.json';
import intakeKo from './locales/ko/intake.json';
import intakeEn from './locales/en/intake.json';
import intakeVi from './locales/vi/intake.json';
import matchingKo from './locales/ko/matching.json';
import matchingEn from './locales/en/matching.json';
import matchingVi from './locales/vi/matching.json';
import classificationKo from './locales/ko/classification.json';
import classificationEn from './locales/en/classification.json';
import classificationVi from './locales/vi/classification.json';
import verificationKo from './locales/ko/verification.json';
import verificationEn from './locales/en/verification.json';
import verificationVi from './locales/vi/verification.json';
import expertKo from './locales/ko/expert.json';
import expertEn from './locales/en/expert.json';
import expertVi from './locales/vi/expert.json';

const resources = {
  ko: {
    common: commonKo,
    admin: adminKo,
    inquiry: inquiryKo,
    intake: intakeKo,
    matching: matchingKo,
    classification: classificationKo,
    verification: verificationKo,
    expert: expertKo,
  },
  en: {
    common: commonEn,
    admin: adminEn,
    inquiry: inquiryEn,
    intake: intakeEn,
    matching: matchingEn,
    classification: classificationEn,
    verification: verificationEn,
    expert: expertEn,
  },
  vi: {
    common: commonVi,
    admin: adminVi,
    inquiry: inquiryVi,
    intake: intakeVi,
    matching: matchingVi,
    classification: classificationVi,
    verification: verificationVi,
    expert: expertVi,
  },
};

const savedLng = localStorage.getItem('i18n_lng') || 'ko';

i18n.use(initReactI18next).init({
  resources,
  lng: savedLng,
  fallbackLng: 'ko',
  ns: [
    'common',
    'admin',
    'inquiry',
    'intake',
    'matching',
    'classification',
    'verification',
    'expert',
  ],
  defaultNS: 'common',
  interpolation: { escapeValue: false },
});

i18n.on('languageChanged', (lng) => {
  localStorage.setItem('i18n_lng', lng);
});

export default i18n;
