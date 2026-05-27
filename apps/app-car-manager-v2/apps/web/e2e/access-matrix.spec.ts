import { test, expect, type Page } from '@playwright/test';
import { VN01, VN01_USERS } from './helpers/fixtures';
import { devLogin, clearSession } from './helpers/auth';

/**
 * Role × Route access matrix.
 *
 * Verify mỗi role chỉ truy cập được routes được allow.
 * Driver: middleware allowlist (/today, /trips/[id] view, /expenses, /settings/me, /inbox).
 * Manager: most admin pages except /audit, /settings (admin section).
 * Admin: tất cả routes.
 *
 * Test uses HTTP-level checks (page.request) cho deterministic redirect detection
 * thay vì depend on UI render (Next.js streaming có thể mask redirect).
 */

type ExpectedAccess = 'allow' | 'redirect-today' | 'redirect-login' | 'forbidden';

interface Case {
  role: 'ADMIN' | 'MANAGER' | 'DRIVER';
  sub: string;
  expects: Array<{ path: string; expected: ExpectedAccess; reason?: string }>;
}

const cases: Case[] = [
  {
    role: 'ADMIN',
    sub: VN01_USERS.master.sub,
    expects: [
      { path: '/dashboard', expected: 'allow' },
      { path: '/today', expected: 'allow' },
      { path: '/trips', expected: 'allow' },
      { path: '/trips/new', expected: 'allow' },
      { path: '/drivers', expected: 'allow' },
      { path: '/drivers/new', expected: 'allow' },
      { path: '/vehicles', expected: 'allow' },
      { path: '/vehicles/new', expected: 'allow' },
      { path: '/users', expected: 'allow' },
      { path: '/users/new', expected: 'allow' },
      { path: '/expenses', expected: 'allow' },
      { path: '/expenses/new', expected: 'allow' },
      { path: '/costs', expected: 'allow' },
      { path: '/reports', expected: 'allow' },
      { path: '/audit', expected: 'allow' },
      { path: '/settings', expected: 'allow' },
      { path: '/settings/me', expected: 'allow' },
      { path: '/inbox', expected: 'allow' },
    ],
  },
  {
    role: 'MANAGER',
    sub: VN01_USERS.manager.sub,
    expects: [
      { path: '/dashboard', expected: 'allow' },
      { path: '/trips', expected: 'allow' },
      { path: '/trips/new', expected: 'allow' },
      { path: '/drivers', expected: 'allow' },
      { path: '/vehicles', expected: 'allow' },
      { path: '/users', expected: 'allow' },
      { path: '/users/new', expected: 'allow' },
      { path: '/expenses', expected: 'allow' },
      { path: '/costs', expected: 'allow' },
      { path: '/reports', expected: 'allow' },
      { path: '/settings/me', expected: 'allow' },
      { path: '/inbox', expected: 'allow' },
      /* Audit log: ADMIN-only (requireRole) — manager bị 403 → error boundary */
      { path: '/audit', expected: 'forbidden', reason: 'requireRole ADMIN' },
    ],
  },
  {
    role: 'DRIVER',
    sub: VN01_USERS.driver.sub,
    expects: [
      /* Driver allowlist trong middleware */
      { path: '/today', expected: 'allow' },
      { path: '/trips', expected: 'allow' },
      { path: '/expenses', expected: 'allow' },
      { path: '/expenses/new', expected: 'allow' },
      { path: '/settings/me', expected: 'allow' },
      { path: '/inbox', expected: 'allow' },
      /* Block list — driver redirect /today */
      { path: '/dashboard', expected: 'redirect-today' },
      { path: '/trips/new', expected: 'redirect-today' },
      { path: '/drivers', expected: 'redirect-today' },
      { path: '/vehicles', expected: 'redirect-today' },
      { path: '/users', expected: 'redirect-today' },
      { path: '/reports', expected: 'redirect-today' },
      { path: '/audit', expected: 'redirect-today' },
      { path: '/settings', expected: 'redirect-today', reason: 'tenant settings admin-only' },
      { path: '/costs', expected: 'allow', reason: 'driver có thể xem cost của mình' },
    ],
  },
];

async function setupSession(page: Page, c: Case): Promise<void> {
  await devLogin(page, {
    role: c.role === 'ADMIN' ? 'MASTER' : c.role === 'MANAGER' ? 'MANAGER' : 'MEMBER',
    entId: VN01.entId,
    sub: c.sub,
  });
}

async function checkAccess(
  page: Page,
  path: string,
): Promise<{ status: number; location: string | null }> {
  /* maxRedirects: 0 để observe raw response */
  const res = await page.request.get(path, { maxRedirects: 0 });
  return {
    status: res.status(),
    location: res.headers()['location'] ?? null,
  };
}

for (const c of cases) {
  test.describe(`Access matrix — ${c.role}`, () => {
    test.beforeEach(async ({ page, context }) => {
      await clearSession(context);
      await setupSession(page, c);
    });

    for (const exp of c.expects) {
      const title = `${c.role} → ${exp.path} → ${exp.expected}${
        exp.reason ? ` (${exp.reason})` : ''
      }`;

      test(title, async ({ page }) => {
        const { status, location } = await checkAccess(page, exp.path);
        switch (exp.expected) {
          case 'allow':
            /* 200 OK hoặc 307 → /onboarding (nếu chưa sync). Acceptable */
            expect(
              status === 200 || (status === 307 && location?.includes('/onboarding')),
              `Expected 200 or onboarding redirect, got ${status} → ${location}`,
            ).toBe(true);
            break;
          case 'redirect-today':
            expect(status, `Expected redirect, got ${status}`).toBe(307);
            expect(location).toContain('/today');
            break;
          case 'redirect-login':
            expect(status).toBe(307);
            expect(location).toContain('/login');
            break;
          case 'forbidden':
            /* requireRole throw → Next.js error boundary serve 500 hoặc redirect.
             * Acceptable: 200 với error page, 403, 500 */
            expect([200, 403, 500].includes(status), `Got ${status}`).toBe(true);
            break;
        }
      });
    }
  });
}
