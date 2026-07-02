import 'server-only';
import { randomUUID } from 'node:crypto';
import { and, eq, isNull } from 'drizzle-orm';
import { db } from '@car-v2/db/client';
import {
  carNotifications,
  carPushSubscriptions,
  carUsers,
  type NotificationTemplatePayload,
} from '@car-v2/db/schema';
import { sendEmail } from './email.service';
import {
  renderNotification,
  resolveLocale,
  type NotificationEvent,
  type TemplateContext,
} from './notification-template.service';
import { sendPushToSubscriptions, type PushSubscriptionRecord } from './push.service';

/**
 * Notification fan-out — DB queue + email + Web Push.
 *
 * Localization strategy (Option A — render-at-read):
 *   - DB stores `ntf_event + ntf_template_payload` so the inbox UI can
 *     re-render in the user's CURRENT UI locale.
 *   - Email + Push render server-side using the recipient's saved
 *     `usr_preferred_locale` (they aren't in a Next request context so
 *     `useTranslations` isn't available client-side for them).
 *   - The frozen `ntf_title` / `ntf_body` columns now hold the
 *     recipient-locale render as a FALLBACK for legacy rows + clients that
 *     can't resolve the event key (e.g. old service workers caching the
 *     inbox JSON).
 *
 * Order of operations:
 *   1. Lookup recipient (need locale + email + push subs)
 *   2. Render in recipient locale (for DB fallback + email/push transports)
 *   3. INSERT row with event + payload + frozen fallback strings
 *   4. Fire email + push in parallel — best-effort, swallow failures so the
 *      parent mutation doesn't crash because Resend is down.
 */

interface NotifyInput {
  entId: string;
  userId: string;
  /** Upper-snake event identifier matching messages/*.json `notifications.events.*`. */
  event: NotificationEvent | string;
  /** Plain-string fallback when the event has no template entry (rare). */
  title?: string;
  body?: string;
  entityId?: string;
  entityRef?: string;
  /**
   * Template context for re-rendering at read time AND for email/push render.
   * REQUIRED for any event listed in the templates JSON — without it the
   * inbox UI can't re-render on locale switch.
   */
  template?: Omit<TemplateContext, 'recipientRole'>;
  /**
   * Actor's display name for role-based messages like "cancelled by {actorName}".
   * Passed separately from template because template is stored in DB for inbox
   * re-render, but actorName is only used during initial render.
   */
  actorName?: string;
}

/** Events that fan out to email + push. Others stay in-app only. */
const DELIVERY_CHANNELS: Record<string, { email: boolean; push: boolean }> = {
  'TRIP.ASSIGNED': { email: true, push: true },
  'TRIP.NEEDS_ASSIGNMENT': { email: true, push: true },
  'TRIP.ACCEPTED': { email: true, push: true },
  'TRIP.REJECTED': { email: true, push: true },
  'TRIP.COMPLETED': { email: false, push: true },
  'TRIP.CANCELLED': { email: true, push: true },
  /* CONFLICT_OVERRIDDEN is for the audit trail only — no user notification. */
  /* Module 2 — REQ-20260519 §5 (Q5): all 3 channels for incidents & maintenance. */
  'EXPENSE.ACCIDENT_REPORTED': { email: true, push: true },
  'MAINTENANCE.OIL_OVERDUE': { email: true, push: true },
  'MAINTENANCE.OIL_DUE_SOON': { email: false, push: true },
  'MAINTENANCE.INSPECTION_OVERDUE': { email: true, push: true },
  'MAINTENANCE.INSPECTION_DUE_SOON': { email: false, push: true },
  /* Truck trip-log (REQ-20260617): push the driver on assign, push the creator
   * on completion. Fleet-access events stay in-app only (omitted). */
  'TRUCK_TRIP.ASSIGNED': { email: false, push: true },
  'TRUCK_TRIP.COMPLETED': { email: false, push: true },
};

export async function notifyUser(input: NotifyInput): Promise<void> {
  /* Step 1 — Recipient lookup. We need this BEFORE insert to pick the
   * fallback render locale. If the user is missing/soft-deleted, skip the
   * notification entirely (their inbox can't receive it anyway). */
  const user = await db.query.carUsers.findFirst({
    where: and(
      eq(carUsers.usrId, input.userId),
      eq(carUsers.entId, input.entId),
      isNull(carUsers.usrDeletedAt),
    ),
  });
  if (!user) return;

  const locale = resolveLocale(user.usrPreferredLocale);

  /* Step 2 — Render fallback strings + payload. If the event has no template
   * registered we fall back to the caller-supplied title/body (rare path —
   * future events without copy yet). */
  let renderedSubject = input.title ?? input.event;
  let renderedBody: string | null = input.body ?? null;
  let renderedUrl: string | null = null;
  let renderedHtml: string | null = null;
  let renderedPlainText: string | null = null;

  if (input.template) {
    try {
      const rendered = await renderNotification(
        input.event as NotificationEvent,
        locale,
        {
          ...input.template,
          /* Role-based content: pass recipient's local role and actor's name
           * so renderNotification can pick appropriate template variants
           * (e.g. "Your trip was cancelled by {actorName}" for Driver). */
          recipientRole: user.usrLocalRole,
          actorName: input.actorName,
        },
      );
      renderedSubject = rendered.subject;
      renderedBody = rendered.body;
      renderedUrl = rendered.url;
      renderedHtml = rendered.html;
      renderedPlainText = rendered.plainText;
    } catch (err) {
      /* Template key missing → fall back to caller-supplied strings.
       * Don't crash the parent mutation just because copy is unrouted. */
      // eslint-disable-next-line no-console
      console.warn('[notify] template render failed, using fallback', input.event, err);
    }
  }

  /* Step 3 — INSERT row. Payload is what the inbox UI reads to re-render in
   * the user's CURRENT UI locale; title/body stay as immutable fallback. */
  const payload: NotificationTemplatePayload | null = input.template
    ? {
        ref: input.template.ref,
        route: input.template.route,
        reason: input.template.reason,
        amount: input.template.amount,
        description: input.template.description,
        tripPath: input.template.tripPath,
        actorName: input.actorName,
      }
    : null;

  try {
    await db.insert(carNotifications).values({
      ntfId: randomUUID(),
      entId: input.entId,
      ntfUserId: input.userId,
      ntfEvent: input.event,
      ntfTitle: renderedSubject,
      ntfBody: renderedBody,
      ntfTemplatePayload: payload,
      ntfEntityId: input.entityId ?? null,
      ntfEntityRef: input.entityRef ?? null,
    });
  } catch (err) {
    /* eslint-disable-next-line no-console */
    console.error('[notify] failed to queue notification', input.event, err);
    /* DB failed — don't even try transport, recipient already de facto "lost". */
    return;
  }

  /* Step 4 — Fan out to email + push, gated by event + config. Skip if no
   * template (we have no rich content to send) or no channels configured. */
  const channels = DELIVERY_CHANNELS[input.event];
  if (!channels) return;
  if (!input.template || renderedUrl === null) return;

  const wantEmail = channels.email;
  const wantPush = channels.push;
  if (!wantEmail && !wantPush) return;

  const tasks: Array<Promise<unknown>> = [];

  if (wantEmail && user.usrEmail && renderedHtml && renderedPlainText) {
    tasks.push(
      sendEmail({
        to: user.usrEmail,
        subject: renderedSubject,
        html: renderedHtml,
        text: renderedPlainText,
      }),
    );
  }

  if (wantPush) {
    tasks.push(
      (async () => {
        const subs = await db.query.carPushSubscriptions.findMany({
          where: and(
            eq(carPushSubscriptions.entId, input.entId),
            eq(carPushSubscriptions.pshUserId, input.userId),
          ),
          columns: {
            pshId: true,
            pshEndpoint: true,
            pshP256dh: true,
            pshAuth: true,
          },
        });
        if (subs.length === 0) return;
        await sendPushToSubscriptions(subs as PushSubscriptionRecord[], {
          title: renderedSubject,
          body: renderedBody ?? '',
          url: renderedUrl,
          ref: input.template!.ref,
        });
      })(),
    );
  }

  /* Parallel fan-out, all best-effort. allSettled so one failure doesn't
   * cancel the other channel. */
  await Promise.allSettled(tasks);
}

export async function notifyMany(userIds: string[], input: Omit<NotifyInput, 'userId'>): Promise<void> {
  await Promise.all(userIds.map((userId) => notifyUser({ ...input, userId })));
}
