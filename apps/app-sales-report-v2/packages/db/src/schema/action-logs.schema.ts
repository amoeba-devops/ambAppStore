import {
  pgTable,
  char,
  varchar,
  text,
  jsonb,
  timestamp,
  pgEnum,
  index,
} from 'drizzle-orm/pg-core';

export const actionCategoryEnum = pgEnum('sal_action_category', [
  'UPLOAD',
  'APPROVAL',
  'MANUAL_INPUT',
  'MASTER_DATA',
  'FORMULA',
  'REPORT',
  'EXPORT',
  'OTHER',
]);

export const salActionLogs = pgTable(
  'sal_action_logs',
  {
    actId: char('act_id', { length: 36 }).primaryKey(),
    entId: char('ent_id', { length: 36 }).notNull(),
    actUserId: char('act_user_id', { length: 36 }).notNull(),
    actUsername: varchar('act_username', { length: 128 }).notNull(),
    actUserRole: varchar('act_user_role', { length: 16 }).notNull(),
    actCategory: actionCategoryEnum('act_category').notNull(),
    actVerb: varchar('act_verb', { length: 32 }).notNull(),
    actTargetType: varchar('act_target_type', { length: 32 }),
    actTargetId: varchar('act_target_id', { length: 64 }),
    actTargetLabel: varchar('act_target_label', { length: 512 }).notNull(),
    actSummary: text('act_summary'),
    actMetadata: jsonb('act_metadata').$type<Record<string, unknown>>(),
    actBefore: jsonb('act_before').$type<Record<string, unknown>>(),
    actAfter: jsonb('act_after').$type<Record<string, unknown>>(),
    actCreatedAt: timestamp('act_created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    idxEntCreated: index('idx_sal_act_ent_created').on(t.entId, t.actCreatedAt),
    idxEntCategory: index('idx_sal_act_ent_category').on(t.entId, t.actCategory),
    idxUser: index('idx_sal_act_user').on(t.actUserId),
  }),
);

export type SalActionLog = typeof salActionLogs.$inferSelect;
export type SalActionLogInsert = typeof salActionLogs.$inferInsert;
export type ActionCategory = (typeof actionCategoryEnum.enumValues)[number];
