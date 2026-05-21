import { char, index, pgTable, text, timestamp, varchar } from 'drizzle-orm/pg-core';
import { carUsers } from './users.schema';

/**
 * car_notifications — in-app notification queue.
 * REQ-20260513 §3.1.6 · PRD §13. P1 stub: INSERT only, delivery (push/email) in P4.
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
