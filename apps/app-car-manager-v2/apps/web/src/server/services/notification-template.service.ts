import 'server-only';
import { getTranslations } from 'next-intl/server';
import { buildAppUrl } from '@/lib/env';

/**
 * Locale-aware notification copy for the 11 in-app/email/push events.
 *
 * Templates live in `messages/{vi,ko,en}.json` under `notifications.events.*`
 * (Option A — single source of truth for both server-side delivery render
 * AND client-side inbox re-render on UI locale switch).
 *
 * Each event produces the same shape `{ subject, body, plainText, html, url }`:
 *   - subject + body are short — used by both email subject/preheader AND
 *     Web Push notification title/body.
 *   - html + plainText are the email body.
 *   - url points the user back to the trip detail.
 *
 * Events with optional context (route, reason) have two body variants in JSON
 * — `body` and `bodyWithRoute` / `bodyWithReason`. The renderer picks the
 * variant based on which payload fields are present.
 */

export type SupportedLocale = 'vi' | 'en' | 'ko';

const SUPPORTED_LOCALES: SupportedLocale[] = ['vi', 'en', 'ko'];

export function resolveLocale(input: string | null | undefined): SupportedLocale {
  const v = (input ?? '').toLowerCase();
  if (v === 'en' || v === 'ko') return v;
  return 'vi';
}

export type NotificationEvent =
  | 'TRIP.ASSIGNED'
  | 'TRIP.NEEDS_ASSIGNMENT'
  | 'TRIP.ACCEPTED'
  | 'TRIP.REJECTED'
  | 'TRIP.COMPLETED'
  | 'TRIP.CANCELLED'
  | 'EXPENSE.ACCIDENT_REPORTED'
  | 'EXPENSE.APPROVED'
  | 'MAINTENANCE.OIL_OVERDUE'
  | 'MAINTENANCE.OIL_DUE_SOON'
  | 'MAINTENANCE.INSPECTION_OVERDUE'
  | 'MAINTENANCE.INSPECTION_DUE_SOON'
  | 'TRUCK_TRIP.ASSIGNED'
  | 'TRUCK_TRIP.COMPLETED'
  | 'FLEET.ACCESS_REQUESTED'
  | 'FLEET.ACCESS_APPROVED'
  | 'FLEET.ACCESS_REJECTED'
  | 'FLEET.ACCESS_GRANTED'
  | 'FLEET.ACCESS_REVOKED';

export interface TemplateContext {
  /** Trip / vehicle / expense reference like "TR-1042" or "29A-123.45". */
  ref: string;
  /** Human-friendly route summary, e.g. "Quận 1 → Sân bay TSN". */
  route?: string;
  /** Free-form reason for reject/cancel events. */
  reason?: string;
  /** Pre-formatted currency amount for EXPENSE.APPROVED, e.g. "850.000₫". */
  amount?: string;
  /** Free-form description for EXPENSE.APPROVED body — stays in original language. */
  description?: string;
  /** Trip detail path, e.g. `/trips/abc-123`. URL built via `buildAppUrl`. */
  tripPath: string;
  /* ─── Role-based content (P4 post-MVP) ─────────────────────────────────── */
  /** Recipient's local role — used to pick role-specific content variants. */
  recipientRole?: 'ADMIN' | 'MANAGER' | 'DRIVER';
  /** Actor's display name for "cancelled by {actorName}" messages. */
  actorName?: string;
}

export interface RenderedNotification {
  subject: string;
  body: string;
  plainText: string;
  html: string;
  /** Absolute URL to the trip detail. */
  url: string;
}

/* ─── Subject/Body variant resolver ────────────────────────────────────── */

type SubjectKey = 'subject' | 'subjectDriver';
type BodyKey =
  | 'body'
  | 'bodyWithRoute'
  | 'bodyWithReason'
  | 'bodyDriver'
  | 'bodyDriverWithReason';

/**
 * Decide which subject translation key to use based on recipient role.
 * For TRIP.CANCELLED, drivers see "Your trip was cancelled" while
 * admins/managers see the generic "Trip cancelled".
 */
function pickSubjectKey(event: NotificationEvent, ctx: TemplateContext): SubjectKey {
  if (event === 'TRIP.CANCELLED' && ctx.recipientRole === 'DRIVER') {
    return 'subjectDriver';
  }
  return 'subject';
}

/**
 * Decide which body translation key to use based on which optional context
 * fields the caller provided. Mirrors the conditional segments in the old
 * inline template literals.
 *
 * For TRIP.CANCELLED with Driver recipient: use bodyDriver/bodyDriverWithReason
 * to show "cancelled by {actorName}" instead of passive voice.
 */
function pickBodyKey(event: NotificationEvent, ctx: TemplateContext): BodyKey {
  /* TRIP.CANCELLED has role-specific variants for Driver recipients. */
  if (event === 'TRIP.CANCELLED' && ctx.recipientRole === 'DRIVER') {
    return ctx.reason ? 'bodyDriverWithReason' : 'bodyDriver';
  }
  if ((event === 'TRIP.ASSIGNED' || event === 'TRIP.NEEDS_ASSIGNMENT') && ctx.route) {
    return 'bodyWithRoute';
  }
  if ((event === 'TRUCK_TRIP.ASSIGNED' || event === 'TRUCK_TRIP.COMPLETED') && ctx.route) {
    return 'bodyWithRoute';
  }
  if ((event === 'TRIP.REJECTED' || event === 'TRIP.CANCELLED') && ctx.reason) {
    return 'bodyWithReason';
  }
  return 'body';
}

/* ─── Render entry point ───────────────────────────────────────────────── */

/**
 * Render a notification for the given recipient locale. Used server-side by
 * email + push transports. Inbox UI does its own render via `useTranslations`
 * so it follows the CURRENT UI locale, not the locale at insert time.
 */
export async function renderNotification(
  event: NotificationEvent,
  locale: SupportedLocale,
  ctx: TemplateContext,
): Promise<RenderedNotification> {
  const t = await getTranslations({ locale, namespace: 'notifications' });
  const subjectKey = pickSubjectKey(event, ctx);
  const subject = t(`events.${event}.${subjectKey}`, {
    ref: ctx.ref,
    amount: ctx.amount ?? '',
  });
  const bodyKey = pickBodyKey(event, ctx);
  const body = t(`events.${event}.${bodyKey}`, {
    ref: ctx.ref,
    route: ctx.route ?? '',
    reason: ctx.reason ?? '',
    amount: ctx.amount ?? '',
    description: ctx.description ?? '',
    actorName: ctx.actorName ?? '',
  });
  const cta = t('cta');
  const url = buildAppUrl(ctx.tripPath);

  /* Email HTML — intentionally minimalist (no React Email yet). Inline styles
   * because Gmail strips <style>. Content matches plainText 1:1 so spam
   * filters and screen readers see the same text. */
  const html = `<!doctype html>
<html lang="${locale}">
  <body style="margin:0;background:#f6f7f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:#1f2937;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
      <tr><td align="center" style="padding:24px 12px;">
        <table role="presentation" width="100%" style="max-width:520px;background:#ffffff;border-radius:12px;border:1px solid #e5e7eb;">
          <tr><td style="padding:24px;">
            <h1 style="margin:0 0 12px;font-size:18px;line-height:1.4;color:#111827;">${escapeHtml(subject)}</h1>
            <p style="margin:0 0 20px;font-size:14px;line-height:1.6;color:#374151;">${escapeHtml(body)}</p>
            <p style="margin:0;">
              <a href="${url}" style="display:inline-block;background:#3182f6;color:#ffffff;text-decoration:none;padding:10px 18px;border-radius:8px;font-size:14px;font-weight:600;">${escapeHtml(cta)}</a>
            </p>
          </td></tr>
        </table>
        <p style="margin:16px 0 0;font-size:11px;color:#9ca3af;">${escapeHtml(ctx.ref)} · CCMS</p>
      </td></tr>
    </table>
  </body>
</html>`;

  const plainText = `${subject}\n\n${body}\n\n${cta}: ${url}\n\n— ${ctx.ref} · CCMS`;

  return { subject, body, plainText, html, url };
}

function escapeHtml(s: string): string {
  return s
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

/* Re-export so callers can iterate. */
export { SUPPORTED_LOCALES };
