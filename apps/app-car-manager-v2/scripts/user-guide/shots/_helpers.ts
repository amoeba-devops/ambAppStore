import { type Page, type BrowserContext, type TestInfo, expect } from '@playwright/test';
import { resolve } from 'node:path';
import { mkdir } from 'node:fs/promises';

export type UiLocale = 'vi' | 'ko';
export type Device = 'desktop' | 'mobile';
export type AmaRole = 'OWNER' | 'MASTER' | 'MANAGER' | 'MEMBER';

const COOKIE_LOCALE = 'NEXT_LOCALE';

/** Repo root for app-car-manager-v2 (3 levels up from `shots/_helpers.ts`). */
export const APP_ROOT = resolve(import.meta.dirname, '../../..');

/** Output base for raw (un-annotated) screenshots — pre-process input. */
export const RAW_OUT = resolve(APP_ROOT, 'scripts/user-guide/shots-output/raw');

/** Final published screenshots — what HTML pages reference. */
export const PUBLISHED_OUT = resolve(
  APP_ROOT,
  'apps/web/public/docs/user-guide/assets/img/screenshots',
);

/**
 * Set the in-app locale cookie before any navigation so `next-intl` picks it up
 * on the very first server render. The `localePrefix: 'as-needed'` routing
 * config relies on cookie > URL > default in that order.
 */
export async function setUiLocale(context: BrowserContext, locale: UiLocale, baseURL: string) {
  const url = new URL(baseURL);
  await context.addCookies([
    {
      name: COOKIE_LOCALE,
      value: locale,
      domain: url.hostname,
      path: '/',
      httpOnly: false,
      secure: false,
      sameSite: 'Lax',
    },
  ]);
}

/**
 * Pre-snooze the PWA push-prompt banner so it never renders during the shot.
 * Must run BEFORE first navigation — uses `addInitScript` so localStorage is
 * populated on the first page load, before the React component reads it.
 *
 * Source: apps/web/src/components/pwa/push-prompt-strip.tsx
 *   key:      'pwa.pushStripSnoozedUntil'
 *   duration: 15 * 60 * 1000 ms (we snooze for 1 hour)
 */
export async function snoozePushBanner(context: BrowserContext) {
  await context.addInitScript(() => {
    try {
      const oneHour = 60 * 60 * 1000;
      window.localStorage.setItem('pwa.pushStripSnoozedUntil', String(Date.now() + oneHour));
    } catch {
      // Some pages may not have storage access yet — harmless for shots.
    }
  });
}

/**
 * Login via the /dev-login route (enabled by DEMO_AUTO_LOGIN=true). The route
 * mints an HS256 JWT identical in shape to what AMA would issue, then drops it
 * into the session cookie and 302s to `next`.
 *
 * Two ways to specify the user:
 *   - `preset`: shorthand for {role,userId,name,email} bundle matched to the
 *     user-guide seed (admin-vi, manager-vi, driver-vi, …). Recommended.
 *   - `role` alone: legacy form — uses the default user UUID (Admin) with the
 *     generic "Demo ROLE" name. Kept for backwards compatibility with the P0
 *     demo spec.
 *
 * Waits until the URL is no longer `/dev-login` (any landing page is OK).
 */
export type LoginPreset =
  | 'admin-vi' | 'manager-vi' | 'driver-vi'
  | 'admin-ko' | 'manager-ko' | 'driver-ko';

export async function loginAs(
  page: Page,
  opts: { preset?: LoginPreset; role?: AmaRole; next?: string } = {},
) {
  const { preset, role, next = '/' } = opts;
  const params = new URLSearchParams();
  if (preset) params.set('preset', preset);
  if (role) params.set('role', role);
  params.set('next', next);
  await page.goto(`/dev-login?${params}`, { waitUntil: 'networkidle' });
  await page.waitForURL((u) => !/\/dev-login(\?|$|#)/.test(u.toString()), {
    timeout: 15_000,
  });
}

/**
 * Map a UI locale to the matching admin preset — convenience for shots that
 * just need "Admin in the right language" without thinking about names.
 */
export function adminPresetFor(locale: UiLocale): LoginPreset {
  return locale === 'vi' ? 'admin-vi' : 'admin-ko';
}

export function managerPresetFor(locale: UiLocale): LoginPreset {
  return locale === 'vi' ? 'manager-vi' : 'manager-ko';
}

export function driverPresetFor(locale: UiLocale): LoginPreset {
  return locale === 'vi' ? 'driver-vi' : 'driver-ko';
}

/**
 * Wait for the page to be visually stable: network idle + 1 animation frame.
 * Use BEFORE taking a screenshot to avoid capturing mid-fade or skeleton loaders.
 */
export async function waitForReady(page: Page) {
  await page.waitForLoadState('networkidle');
  await page.evaluate(
    () => new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r()))),
  );
  // Tiny extra buffer for any CSS transition (200ms covers Tailwind defaults).
  await page.waitForTimeout(250);
}

/**
 * Build the output path for a raw screenshot, mirroring the
 * `{locale}/{section}/{slug}.png` structure used by the published assets.
 */
export function shotPath(
  base: string,
  locale: UiLocale,
  section: 'common' | 'admin' | 'manager' | 'driver',
  slug: string,
): string {
  return resolve(base, locale, section, `${slug}.png`);
}

export async function ensureDir(path: string) {
  await mkdir(resolve(path, '..'), { recursive: true });
}

/**
 * Take a full-page screenshot with deterministic settings. The omitBackground
 * flag stays false so we capture the actual app background — published shots
 * should look like real screen captures, not transparent overlays.
 */
export async function captureRaw(page: Page, outputPath: string, opts: { fullPage?: boolean } = {}) {
  await ensureDir(outputPath);
  await page.screenshot({
    path: outputPath,
    fullPage: opts.fullPage ?? false,
    animations: 'disabled',
    caret: 'hide',
    scale: 'css',
  });
}

export function uiLocaleFromTestInfo(info: TestInfo): UiLocale {
  const fromMeta = (info.project.metadata as { uiLocale?: UiLocale }).uiLocale;
  if (fromMeta === 'vi' || fromMeta === 'ko') return fromMeta;
  throw new Error(`Project ${info.project.name} missing metadata.uiLocale`);
}

export function deviceFromTestInfo(info: TestInfo): Device {
  const d = (info.project.metadata as { device?: Device }).device;
  if (d === 'desktop' || d === 'mobile') return d;
  throw new Error(`Project ${info.project.name} missing metadata.device`);
}

/** Sanity assertion: when called from any shot test, the cookie must be set. */
export async function assertLocale(page: Page, expected: UiLocale) {
  const html = await page.locator('html').getAttribute('lang');
  expect(html, `expected <html lang> = ${expected}`).toBe(expected);
}
