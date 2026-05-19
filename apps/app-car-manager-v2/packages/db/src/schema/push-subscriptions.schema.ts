import { char, index, pgTable, text, timestamp, uniqueIndex, varchar } from 'drizzle-orm/pg-core';
import { carUsers } from './users.schema';

/**
 * car_push_subscriptions — Web Push (RFC 8030) endpoint per browser device.
 * PRD §13 transport channel. One user may have multiple subscriptions
 * (laptop + phone + tablet etc.). Identity is the endpoint URL.
 *
 * `psh_endpoint` is unique per-tenant — the push provider URL itself is
 * the global identifier, so we use a global unique to dedupe across
 * re-subscriptions (same browser hitting subscribe again returns same endpoint).
 */
export const carPushSubscriptions = pgTable(
  'car_push_subscriptions',
  {
    pshId: char('psh_id', { length: 36 }).primaryKey(),
    entId: char('ent_id', { length: 36 }).notNull(),
    pshUserId: char('psh_user_id', { length: 36 })
      .notNull()
      .references(() => carUsers.usrId),
    /** Push provider URL (fcm.googleapis.com / web.push.apple.com / etc.). */
    pshEndpoint: text('psh_endpoint').notNull(),
    /** P-256 ECDH public key — used by web-push to encrypt the payload. */
    pshP256dh: varchar('psh_p256dh', { length: 200 }).notNull(),
    /** Auth secret — second half of the encryption key. */
    pshAuth: varchar('psh_auth', { length: 100 }).notNull(),
    /** Free-text UA snapshot so admins/users can identify the device later. */
    pshUserAgent: text('psh_user_agent'),
    pshCreatedAt: timestamp('psh_created_at', { withTimezone: true }).defaultNow().notNull(),
    /** Last successful push delivery — null until the first push is sent. */
    pshLastUsedAt: timestamp('psh_last_used_at', { withTimezone: true }),
  },
  (t) => ({
    uniqEndpoint: uniqueIndex('uniq_car_push_subscriptions_endpoint').on(t.pshEndpoint),
    idxUser: index('idx_car_push_subscriptions_user').on(t.entId, t.pshUserId),
  }),
);

export type CarPushSubscription = typeof carPushSubscriptions.$inferSelect;
export type CarPushSubscriptionInsert = typeof carPushSubscriptions.$inferInsert;
