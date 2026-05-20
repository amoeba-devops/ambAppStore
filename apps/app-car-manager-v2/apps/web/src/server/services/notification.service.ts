import 'server-only';
import { randomUUID } from 'node:crypto';
import { and, eq, isNull } from 'drizzle-orm';
import { db } from '@car-v2/db/client';
import { carNotifications, carPushSubscriptions, carUsers } from '@car-v2/db/schema';
import { sendEmail } from './email.service';
import {
  renderNotification,
  resolveLocale,
  type NotificationEvent,
  type TemplateContext,
} from './notification-template.service';
import { sendPushToSubscriptions, type PushSubscriptionRecord } from './push.service';

/**
 * Notification fan-out — DB queue + email + Web Push (P4).
 *
 * Order of operations:
 *   1. Insert row into car_notifications (in-app bell)  ← ALWAYS happens
 *   2. Load recipient (email + locale + push subscriptions)
 *   3. If event matches DELIVERY_CHANNELS, fire email + push in parallel
 *   4. All transport failures are swallowed (best-effort) — parent mutation
 *      MUST NOT crash because Resend is down.
 *
 * Transport gating: each channel checks its own env config (`getEmailConfig`,
 * `getPushConfig`). Missing → silent skip. This lets a feature branch ship
 * without Resend keys, and still benefit from in-app bell.
 *
 * @see notification-template.service for the 6 trip event templates
 * @see push.service for VAPID + endpoint cleanup
 */

interface NotifyInput {
  entId: string;
  userId: string;
  /** Upper-snake event identifier: TRIP.ASSIGNED, TRIP.REJECTED, ... */
  event: string;
  title: string;
  body?: string;
  entityId?: string;
  entityRef?: string;
  /**
   * Template context for email/push render. Optional — when omitted, only
   * the in-app bell row is inserted (title/body used as-is). Most callers
   * SHOULD provide this so email/push get rich content.
   */
  template?: TemplateContext;
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
};

export async function notifyUser(input: NotifyInput): Promise<void> {
  /* Step 1 — DB queue. ALWAYS run, even if transport fails or is disabled. */
  try {
    await db.insert(carNotifications).values({
      ntfId: randomUUID(),
      entId: input.entId,
      ntfUserId: input.userId,
      ntfEvent: input.event,
      ntfTitle: input.title,
      ntfBody: input.body ?? null,
      ntfEntityId: input.entityId ?? null,
      ntfEntityRef: input.entityRef ?? null,
    });
  } catch (err) {
    /* eslint-disable-next-line no-console */
    console.error('[notify] failed to queue notification', input.event, err);
    /* DB failed — don't even try transport, recipient already de facto "lost". */
    return;
  }

  /* Step 2 — Fan out to email + push, gated by event + config. */
  const channels = DELIVERY_CHANNELS[input.event];
  if (!channels) return;
  if (!input.template) return; // Caller didn't opt into transport rendering.

  const wantEmail = channels.email;
  const wantPush = channels.push;
  if (!wantEmail && !wantPush) return;

  /* Recipient lookup. Skip transport if user soft-deleted or missing locale. */
  const user = await db.query.carUsers.findFirst({
    where: and(
      eq(carUsers.usrId, input.userId),
      eq(carUsers.entId, input.entId),
      isNull(carUsers.usrDeletedAt),
    ),
  });
  if (!user) return;

  const locale = resolveLocale(user.usrPreferredLocale);
  const rendered = renderNotification(input.event as NotificationEvent, locale, input.template);

  const tasks: Array<Promise<unknown>> = [];

  if (wantEmail && user.usrEmail) {
    tasks.push(
      sendEmail({
        to: user.usrEmail,
        subject: rendered.subject,
        html: rendered.html,
        text: rendered.plainText,
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
          title: rendered.subject,
          body: rendered.body,
          url: rendered.url,
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
