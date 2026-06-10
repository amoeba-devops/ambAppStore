import { char, index, jsonb, pgTable, text, timestamp, varchar } from 'drizzle-orm/pg-core';
import { carUsers } from './users.schema';

/**
 * Interpolation values for re-rendering a notification at read time from the
 * locale-aware template tables in `messages/{vi,ko,en}.json`
 * (namespace `notifications.events`). Shape mirrors
 * `notification-template.service.TemplateContext`.
 */
export interface NotificationTemplatePayload {
  ref: string;
  route?: string;
  reason?: string;
  /** Pre-formatted currency amount for EXPENSE.APPROVED, e.g. "850.000₫". */
  amount?: string;
  /** Free-form description for EXPENSE.APPROVED body. */
  description?: string;
  tripPath?: string;
  /** Actor's display name for role-based messages like "cancelled by {actorName}". */
  actorName?: string;
}

/**
 * car_notifications — in-app notification queue.
 * REQ-20260513 §3.1.6 · PRD §13. P1 stub: INSERT only, delivery (push/email) in P4.
 *
 * Localization: rows created from 2026-05-28 onward carry `ntf_event +
 * ntf_template_payload` so the inbox can re-render in the user's CURRENT UI
 * locale. Legacy rows have `ntf_template_payload = NULL` and fall back to
 * the frozen `ntf_title` / `ntf_body` (rendered in whichever locale was
 * active when the row was created).
 */
export const carNotifications = pgTable(
  'car_notifications',
  {
    ntfId: char('ntf_id', { length: 36 }).primaryKey(),
    entId: char('ent_id', { length: 36 }).notNull(),
    ntfUserId: char('ntf_user_id', { length: 36 })
      .notNull()
      .references(() => carUsers.usrId),
    ntfEvent: varchar('ntf_event', { length: 64 }).notNull(),
    ntfTitle: varchar('ntf_title', { length: 255 }).notNull(),
    ntfBody: text('ntf_body'),
    ntfTemplatePayload: jsonb('ntf_template_payload').$type<NotificationTemplatePayload>(),
    ntfEntityId: char('ntf_entity_id', { length: 36 }),
    ntfEntityRef: varchar('ntf_entity_ref', { length: 40 }),
    ntfReadAt: timestamp('ntf_read_at', { withTimezone: true }),
    ntfCreatedAt: timestamp('ntf_created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    idxUserUnread: index('idx_car_notifications_user_unread').on(t.ntfUserId, t.ntfReadAt),
  }),
);

export type CarNotification = typeof carNotifications.$inferSelect;
export type CarNotificationInsert = typeof carNotifications.$inferInsert;
