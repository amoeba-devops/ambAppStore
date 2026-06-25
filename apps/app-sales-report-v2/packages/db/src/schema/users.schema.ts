import { pgTable, char, varchar, integer, timestamp, uniqueIndex, pgEnum } from 'drizzle-orm/pg-core';

export const localRoleEnum = pgEnum('sal_user_local_role', ['OPERATOR', 'MANAGER', 'ADMIN']);
export const userStatusEnum = pgEnum('sal_user_status', ['ACTIVE', 'INACTIVE']);

export const salUsers = pgTable(
  'sal_users',
  {
    usrId: char('usr_id', { length: 36 }).primaryKey(),
    entId: char('ent_id', { length: 36 }).notNull(),
    usrAmaUserId: char('usr_ama_user_id', { length: 36 }).notNull(),
    usrEmail: varchar('usr_email', { length: 255 }),
    usrName: varchar('usr_name', { length: 255 }),
    usrLocalRole: localRoleEnum('usr_local_role').notNull().default('OPERATOR'),
    usrAmaRoleSnapshot: varchar('usr_ama_role_snapshot', { length: 32 }),
    usrStatus: userStatusEnum('usr_status').notNull().default('ACTIVE'),
    usrLoginCount: integer('usr_login_count').notNull().default(0),
    usrMfaLastAt: timestamp('usr_mfa_last_at', { withTimezone: true }),
    usrLastLoginAt: timestamp('usr_last_login_at', { withTimezone: true }),
    usrCreatedAt: timestamp('usr_created_at', { withTimezone: true }).defaultNow().notNull(),
    usrUpdatedAt: timestamp('usr_updated_at', { withTimezone: true }),
    usrDeletedAt: timestamp('usr_deleted_at', { withTimezone: true }),
  },
  (t) => ({
    uniqEntAma: uniqueIndex('uniq_sal_users_ent_ama').on(t.entId, t.usrAmaUserId),
  }),
);

export type SalUser = typeof salUsers.$inferSelect;
export type SalUserInsert = typeof salUsers.$inferInsert;
export type UserStatus = (typeof userStatusEnum.enumValues)[number];
