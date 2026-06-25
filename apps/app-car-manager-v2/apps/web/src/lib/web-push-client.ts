import 'server-only';
import webpush from 'web-push';

let configured = false;

/* Lazily configure web-push with the tenant VAPID keys.
 *
 * Why lazy: VAPID isn't always needed (e.g. no driver subscribed yet). We
 * also defer the env check to first call so a missing key doesn't crash
 * unrelated routes at import time.
 *
 * Re-entrancy: web-push's `setVapidDetails` is a module-level global, so we
 * guard against re-applying the same keys on every call. */
export function ensureWebPushConfigured(): typeof webpush {
  if (configured) return webpush;
  const pub = process.env.WEB_PUSH_VAPID_PUBLIC;
  const priv = process.env.WEB_PUSH_VAPID_PRIVATE;
  const contact = process.env.WEB_PUSH_CONTACT;
  if (!pub || !priv || !contact) {
    throw new Error(
      'Push notifications unavailable: set WEB_PUSH_VAPID_PUBLIC, WEB_PUSH_VAPID_PRIVATE, WEB_PUSH_CONTACT.',
    );
  }
  /* `contact` must be a mailto: or https:. Most push services reject bare
   * email strings. */
  const subject = contact.startsWith('mailto:') || contact.startsWith('https://')
    ? contact
    : `mailto:${contact}`;
  webpush.setVapidDetails(subject, pub, priv);
  configured = true;
  return webpush;
}

export { webpush };
