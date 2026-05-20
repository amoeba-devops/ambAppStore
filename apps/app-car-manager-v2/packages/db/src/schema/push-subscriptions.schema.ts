import { char, index, pgTable, text, timestamp, uniqueIndex, varchar } from 'drizzle-orm/pg-core';
import { carUsers } from './users.schema';

/**
 * car_push_subscriptions — VAPID Web Push subscription records.
 * REQ-20260520 H.6 · PRD §13 P4 push transport.
 *
 * One row per (user × browser/device). The endpoint URL is the unique key —
 * a user may have multiple subscriptions (phone PWA, desktop browser, etc.)
 * and the push service guarantees endpoint uniqueness per UA install.
 *
 * `last_seen_at` lets a future janitor reap subscriptions that have been
 * silent for >30 days (most likely uninstalled or revoked).
 */
export const carPushSubscriptions = pgTable(
  'car_push_subscriptions',
  {
    psbId: char('psb_id', { length: 36 }).primaryKey(),
    entId: char('ent_id', { length: 36 }).notNull(),
    psbUserId: char('psb_user_id', { length: 36 })
      .notNull()
      .references(() => carUsers.usrId),
    psbEndpoint: text('psb_endpoint').notNull(),
    psbP256dh: text('psb_p256dh').notNull(),
    psbAuth: text('psb_auth').notNull(),
    psbUserAgent: varchar('psb_user_agent', { length: 255 }),
    psbCreatedAt: timestamp('psb_created_at', { withTimezone: true }).defaultNow().notNull(),
    psbLastSeenAt: timestamp('psb_last_seen_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    /* Endpoint is globally unique per push service — across tenants we never
     * collide, but enforcing the constraint at row level lets us upsert
     * cleanly on the subscribe endpoint. */
    uniqEndpoint: uniqueIndex('uniq_car_push_subscriptions_endpoint').on(t.psbEndpoint),
    idxUser: index('idx_car_push_subscriptions_user').on(t.entId, t.psbUserId),
  }),
);

export type CarPushSubscription = typeof carPushSubscriptions.$inferSelect;
export type CarPushSubscriptionInsert = typeof carPushSubscriptions.$inferInsert;
