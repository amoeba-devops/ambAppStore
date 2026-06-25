import { test, expect, type BrowserContext } from '@playwright/test';
import { VN01, VN01_USERS } from './helpers/fixtures';
import { devLogin, clearSession } from './helpers/auth';

/**
 * i18n E2E.
 *
 * Verify:
 *   - 3 locales vi / en / ko render đúng text trên các trang quan trọng
 *   - Switch locale persist qua cookie `NEXT_LOCALE`
 *   - No raw key (`screens.foo.bar`) leaks vào DOM
 *
 * Pages cover:
 *   - /login (public, no auth)
 *   - /onboarding (admin first-time)
 *   - /dashboard (admin landing)
 *   - /today (driver landing)
 *   - /users (admin)
 */

const LOCALES = ['vi', 'en', 'ko'] as const;
type Locale = (typeof LOCALES)[number];

const EXPECTED_TEXTS: Record<string, Record<Locale, string>> = {
  loginTitle: {
    vi: 'Đăng nhập',
    en: 'Sign in',
    ko: '로그인',
  },
  loginEntCodeLabel: {
    vi: 'Mã công ty',
    en: 'Company code',
    ko: '회사 코드',
  },
  navUsers: {
    vi: 'Người dùng',
    en: 'Users',
    ko: '사용자',
  },
};

async function setLocaleCookie(context: BrowserContext, locale: Locale): Promise<void> {
  await context.addCookies([
    {
      name: 'NEXT_LOCALE',
      value: locale,
      domain: 'localhost',
      path: '/',
    },
  ]);
}

test.describe('i18n — /login page (public)', () => {
  for (const locale of LOCALES) {
    test(`I1-${locale} — /login render text đúng locale`, async ({ page, context }) => {
      await clearSession(context);
      await setLocaleCookie(context, locale);
      await page.goto('/login', { waitUntil: 'domcontentloaded' });

      /* Verify key strings. The title text also appears on the submit button
       * + dev-login buttons, so target the <h1> heading specifically to avoid
       * a strict-mode multi-match. */
      await expect(
        page.getByRole('heading', { name: EXPECTED_TEXTS.loginTitle[locale] }),
      ).toBeVisible({ timeout: 15_000 });
      await expect(page.getByText(EXPECTED_TEXTS.loginEntCodeLabel[locale])).toBeVisible();

      /* No raw key leak — a missed translation renders as e.g. "login.title"
       * or "nav.users". Use innerText (visible text only — excludes the RSC
       * streaming <script> JS, whose member-access like `a.previousSibling.data`
       * would false-match a generic dotted pattern) and scope to the i18n
       * namespaces this page actually uses, so URLs/emails don't trip it. */
      const visibleText = await page.locator('body').innerText();
      expect(visibleText, 'Raw i18n key leaked into DOM').not.toMatch(
        /\b(login|nav|common|errors)\.[a-zA-Z]/,
      );
    });
  }
});

/* The /onboarding page + gate were removed (Option 1b — JIT per-user sync +
 * manual "Sync from AMA" on /users replaced the first-run onboarding flow), so
 * the former I2 onboarding-i18n block no longer applies. */

test.describe('i18n — sidebar nav (authenticated)', () => {
  for (const locale of LOCALES) {
    test(`I3-${locale} — Sidebar "Users" link text`, async ({ page, context }) => {
      await clearSession(context);
      await setLocaleCookie(context, locale);
      await devLogin(page, {
        role: 'MASTER',
        entId: VN01.entId,
        sub: VN01_USERS.master.sub,
      });
      await page.goto('/dashboard', { waitUntil: 'domcontentloaded' });

      /* No onboarding gate any more — admin lands straight on /dashboard with
       * the full sidebar, so the localized "Users" link must be present. */
      await expect(
        page.getByRole('link', { name: new RegExp(EXPECTED_TEXTS.navUsers[locale], 'i') }).first(),
      ).toBeVisible({ timeout: 15_000 });
    });
  }
});

test.describe('i18n — Missing key detection', () => {
  test('I4 — Console không có "MISSING_MESSAGE" warning', async ({ page, context }) => {
    const warnings: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'warning' || msg.type() === 'error') {
        const text = msg.text();
        if (/MISSING_MESSAGE|missing.*translation/i.test(text)) {
          warnings.push(text);
        }
      }
    });

    await clearSession(context);
    await setLocaleCookie(context, 'vi');
    await page.goto('/login', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2_000);

    await setLocaleCookie(context, 'en');
    await page.goto('/login', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2_000);

    await setLocaleCookie(context, 'ko');
    await page.goto('/login', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2_000);

    expect(warnings, `Missing translation warnings: ${warnings.join('\n')}`).toEqual([]);
  });
});
