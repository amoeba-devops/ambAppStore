import type { BrowserContext, Page } from '@playwright/test';

export type DevRole = 'OWNER' | 'MASTER' | 'MANAGER' | 'MEMBER';

/**
 * Login qua /dev-login với override entityId + sub.
 * Sau khi login, cookies `amb_session` được set trên context, page có thể navigate.
 *
 * Return URL hiện tại sau redirect (để test verify redirect target).
 */
export async function devLogin(
  page: Page,
  opts: { role: DevRole; entId: string; sub: string },
): Promise<string> {
  const url = `/dev-login?role=${opts.role}&ent_id=${opts.entId}&sub=${opts.sub}`;
  // KHÔNG dùng waitUntil 'networkidle' vì onboarding page có thể có streaming
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  return page.url();
}

/** Clear all cookies — dùng giữa các test scenario. */
export async function clearSession(context: BrowserContext): Promise<void> {
  await context.clearCookies();
}

/** Manually set 1 cookie value — dùng test S6 (corrupt token). */
export async function setSessionCookie(
  context: BrowserContext,
  name: string,
  value: string,
  domain = 'localhost',
): Promise<void> {
  await context.addCookies([
    {
      name,
      value,
      domain,
      path: '/',
      httpOnly: true,
      secure: false,
      sameSite: 'Lax',
    },
  ]);
}
