import { pgTable, char, varchar, timestamp, uniqueIndex, pgEnum } from 'drizzle-orm/pg-core';

/**
 * car_users — AMA SSO user cache + local role mapping.
 * PRD §4: Admin / Manager / Driver. See CLAUDE.md §4.6.
 */
export const localRoleEnum = pgEnum('car_user_local_role', ['DRIVER', 'MANAGER', 'ADMIN']);

export const carUsers = pgTable(
  'car_users',
  {
    usrId: char('usr_id', { length: 36 }).primaryKey(),
    entId: char('ent_id', { length: 36 }).notNull(),
    usrAmaUserId: char('usr_ama_user_id', { length: 36 }).notNull(),
    usrEmail: varchar('usr_email', { length: 255 }),
    usrName: varchar('usr_name', { length: 255 }),
    usrLocalRole: localRoleEnum('usr_local_role').notNull().default('DRIVER'),
    usrAmaRoleSnapshot: varchar('usr_ama_role_snapshot', { length: 32 }),
    usrPreferredLocale: varchar('usr_preferred_locale', { length: 8 }),
    /* Last time the user opened the truck reports list — drives the "Mới" (new)
     * badge: reports created after this mark count as new (REQ-20260629, R8). */
    usrTruckReportsSeenAt: timestamp('usr_truck_reports_seen_at', { withTimezone: true }),
    usrLastLoginAt: timestamp('usr_last_login_at', { withTimezone: true }),
    usrCreatedAt: timestamp('usr_created_at', { withTimezone: true }).defaultNow().notNull(),
    usrUpdatedAt: timestamp('usr_updated_at', { withTimezone: true }),
    usrDeletedAt: timestamp('usr_deleted_at', { withTimezone: true }),
  },
  (t) => ({
    uniqEntAma: uniqueIndex('uniq_car_users_ent_ama').on(t.entId, t.usrAmaUserId),
  }),
);

export type CarUser = typeof carUsers.$inferSelect;
export type CarUserInsert = typeof carUsers.$inferInsert;
export type CarUserLocalRole = (typeof localRoleEnum.enumValues)[number];
