/**
 * AMA Token SSO utilities for app-car-manager.
 * Handles JWT decoding, referrer validation, and subscription checking.
 */

const APP_SLUG = 'app-car-manager';
const APP_CODE_VARIANTS = ['app-car-manager', 'car-manager'];

const ALLOWED_REFERRERS = ['stg-ama.amoeba.site', 'ama.amoeba.site'];

const PLATFORM_API_BASE =
  window.location.hostname === 'localhost'
    ? 'http://localhost:3100/api/v1/platform'
    : '/api/v1/platform';

export interface AmaTokenPayload {
  sub: string;
  email: string;
  role: string;
  entityId: string;
  appId: string;
  appCode: string;
  scope: string;
  iat: number;
  exp: number;
}

export type SubscriptionStatus =
  | 'ACTIVE'
  | 'PENDING'
  | 'SUSPENDED'
  | 'REJECTED'
  | 'CANCELLED'
  | 'EXPIRED'
  | null;

/**
 * Extract ama_token and locale from the current URL query parameters.
 */
export function getAmaTokenFromUrl(): { token: string; locale: string } | null {
  const params = new URLSearchParams(window.location.search);
  const token = params.get('ama_token');
  if (!token) return null;
  const locale = params.get('locale') || 'en';
  return { token, locale };
}

/**
 * Decode AMA JWT token (no signature verification — frontend only).
 */
export function decodeAmaToken(token: string): AmaTokenPayload | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
    return payload as AmaTokenPayload;
  } catch {
    return null;
  }
}

/**
 * Validate document.referrer against allowed AMA domains.
 * Soft mode: empty referrer is allowed (Referrer-Policy may strip it).
 */
export function validateReferrer(): boolean {
  const referrer = document.referrer;
  if (!referrer) return true; // soft mode: allow empty referrer
  try {
    const host = new URL(referrer).hostname;
    return ALLOWED_REFERRERS.includes(host);
  } catch {
    return false;
  }
}

/**
 * Check if the token is expired.
 */
export function isTokenExpired(payload: AmaTokenPayload): boolean {
  return payload.exp * 1000 < Date.now();
}

/**
 * Validate the appCode in the token matches this app.
 */
export function isValidAppCode(payload: AmaTokenPayload): boolean {
  return APP_CODE_VARIANTS.includes(payload.appCode);
}

/**
 * Check subscription status via Platform Public API.
 */
export async function checkSubscription(
  entityId: string,
  appSlug: string = APP_SLUG,
): Promise<SubscriptionStatus> {
  try {
    const res = await fetch(`${PLATFORM_API_BASE}/subscriptions/entity/${entityId}`);
    if (!res.ok) return null;
    const json = await res.json();
    const apps = json?.data?.apps;
    if (!Array.isArray(apps)) return null;
    const matched = apps.find((a: any) => a.appSlug === appSlug);
    return (matched?.subscription?.status as SubscriptionStatus) ?? null;
  } catch {
    return null;
  }
}
