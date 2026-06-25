import { test } from '@playwright/test';
import { resolve } from 'node:path';
import {
  loginAs,
  setUiLocale,
  waitForReady,
  assertLocale,
  captureRaw,
  snoozePushBanner,
  adminPresetFor,
  uiLocaleFromTestInfo,
  deviceFromTestInfo,
  shotPath,
  RAW_OUT,
  PUBLISHED_OUT,
} from './_helpers.js';
import { applyAnnotations, loadSpec } from '../annotate.js';

// Phần Chung — screenshots shared across all roles. Captured on BOTH desktop
// and mobile so that pages embedded in driver guide (PWA flows) can reference
// touch-optimized variants for login + inbox.

test.describe('Chung · Phần Chung (desktop)', () => {
  test.beforeEach(async ({ context, baseURL }, info) => {
    test.skip(deviceFromTestInfo(info) !== 'desktop', 'Desktop project only');
    await setUiLocale(context, uiLocaleFromTestInfo(info), baseURL!);
    await snoozePushBanner(context);
  });

  test('01 · Form đăng nhập / 로그인 폼', async ({ page }, info) => {
    const locale = uiLocaleFromTestInfo(info);
    // Hit /login directly without a session — middleware lets it through
    // as a public path and renders the form.
    await page.goto('/login');
    await assertLocale(page, locale);
    await waitForReady(page);

    // Strip the DEV MODE buttons section before shooting — production users
    // never see it (it's env-gated on DEMO_AUTO_LOGIN), so capturing it would
    // be misleading documentation.
    await page.evaluate(() => {
      document.querySelector('[data-testid="dev-mode-section"]')?.remove();
    });

    const slug = '01-login-form';
    const raw = shotPath(RAW_OUT, locale, 'common', slug);
    const out = shotPath(PUBLISHED_OUT, locale, 'common', slug);
    await captureRaw(page, raw, { fullPage: false });
    const spec = await loadSpec(resolve(import.meta.dirname, 'annotations/common-01-login.shot.yml'));
    await applyAnnotations(raw, spec, out);
  });

  test('02 · Dashboard tổng quan / 대시보드 개요', async ({ page }, info) => {
    const locale = uiLocaleFromTestInfo(info);
    await loginAs(page, { preset: adminPresetFor(locale), next: '/dashboard' });
    await assertLocale(page, locale);
    await waitForReady(page);

    const slug = '02-dashboard-overview';
    const raw = shotPath(RAW_OUT, locale, 'common', slug);
    const out = shotPath(PUBLISHED_OUT, locale, 'common', slug);
    await captureRaw(page, raw, { fullPage: false });
    const spec = await loadSpec(resolve(import.meta.dirname, 'annotations/common-02-dashboard.shot.yml'));
    await applyAnnotations(raw, spec, out);
  });

  test('03 · Khối đổi ngôn ngữ / 언어 카드', async ({ page }, info) => {
    const locale = uiLocaleFromTestInfo(info);
    await loginAs(page, { preset: adminPresetFor(locale), next: '/settings/me' });
    await assertLocale(page, locale);
    await waitForReady(page);

    const slug = '03-language-card';
    const raw = shotPath(RAW_OUT, locale, 'common', slug);
    const out = shotPath(PUBLISHED_OUT, locale, 'common', slug);
    await captureRaw(page, raw, { fullPage: false });
    const spec = await loadSpec(resolve(import.meta.dirname, 'annotations/common-03-language.shot.yml'));
    await applyAnnotations(raw, spec, out);
  });

  test('04 · Hộp thư thông báo / 알림 받은편지함', async ({ page }, info) => {
    const locale = uiLocaleFromTestInfo(info);
    await loginAs(page, { preset: adminPresetFor(locale), next: '/inbox' });
    await assertLocale(page, locale);
    await waitForReady(page);

    const slug = '04-inbox-list';
    const raw = shotPath(RAW_OUT, locale, 'common', slug);
    const out = shotPath(PUBLISHED_OUT, locale, 'common', slug);
    await captureRaw(page, raw, { fullPage: false });
    const spec = await loadSpec(resolve(import.meta.dirname, 'annotations/common-04-inbox.shot.yml'));
    await applyAnnotations(raw, spec, out);
  });
});

// Mobile variants — Driver guide references these in 01-cai-pwa.html (login on
// phone) and 06-canh-bao-bao-duong.html (inbox alert on phone). Captured at
// iPhone 14 viewport to match the actual user experience.
test.describe('Chung · Phần Chung (mobile)', () => {
  test.beforeEach(async ({ context, baseURL }, info) => {
    test.skip(deviceFromTestInfo(info) !== 'mobile', 'Mobile project only');
    await setUiLocale(context, uiLocaleFromTestInfo(info), baseURL!);
    await snoozePushBanner(context);
  });

  test('01 · Form đăng nhập mobile / 로그인 폼 모바일', async ({ page }, info) => {
    const locale = uiLocaleFromTestInfo(info);
    await page.goto('/login');
    await assertLocale(page, locale);
    await waitForReady(page);
    await page.evaluate(() => {
      document.querySelector('[data-testid="dev-mode-section"]')?.remove();
    });

    const slug = '01-login-form-mobile';
    const raw = shotPath(RAW_OUT, locale, 'common', slug);
    const out = shotPath(PUBLISHED_OUT, locale, 'common', slug);
    await captureRaw(page, raw, { fullPage: false });
    const spec = await loadSpec(resolve(import.meta.dirname, 'annotations/common-01-login-mobile.shot.yml'));
    await applyAnnotations(raw, spec, out);
  });

  test('04 · Hộp thư mobile / 알림함 모바일', async ({ page }, info) => {
    const locale = uiLocaleFromTestInfo(info);
    await loginAs(page, { preset: adminPresetFor(locale), next: '/inbox' });
    await assertLocale(page, locale);
    await waitForReady(page);

    const slug = '04-inbox-list-mobile';
    const raw = shotPath(RAW_OUT, locale, 'common', slug);
    const out = shotPath(PUBLISHED_OUT, locale, 'common', slug);
    await captureRaw(page, raw, { fullPage: false });
    const spec = await loadSpec(resolve(import.meta.dirname, 'annotations/common-04-inbox-mobile.shot.yml'));
    await applyAnnotations(raw, spec, out);
  });
});
