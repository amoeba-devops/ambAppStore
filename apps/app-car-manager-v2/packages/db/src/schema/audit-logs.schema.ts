import {
  char,
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  varchar,
} from 'drizzle-orm/pg-core';
import { carUsers } from './users.schema';

/**
 * car_audit_logs — append-only mutation log per NFR-9 (PRD §7).
 * REQ-20260513 §3.1.5 · CLAUDE.md §8 ("UPDATE/DELETE on car_audit_logs forbidden").
 *
 * `inet` type intentionally NOT used — Drizzle's pg-core typing for inet is awkward
 * and we store the IP as plain text for portability.
 */
export const carAuditLogs = pgTable(
  'car_audit_logs',
  {
    audId: char('aud_id', { length: 36 }).primaryKey(),
    entId: char('ent_id', { length: 36 }).notNull(),
    /* NULL when the action was performed by the system (e.g. cron job). */
    audUserId: char('aud_user_id', { length: 36 }).references(() => carUsers.usrId),
    audAction: varchar('aud_action', { length: 64 }).notNull(),
    audEntity: varchar('aud_entity', { length: 32 }).notNull(),
    audEntityId: char('aud_entity_id', { length: 36 }),
    audEntityRef: varchar('aud_entity_ref', { length: 40 }),
    audBefore: jsonb('aud_before'),
    audAfter: jsonb('aud_after'),
    audIp: varchar('aud_ip', { length: 45 }),
    audUserAgent: text('aud_user_agent'),
    audCreatedAt: timestamp('aud_created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    idxEntCreated: index('idx_car_audit_logs_ent_created').on(t.entId, t.audCreatedAt),
    idxEntity: index('idx_car_audit_logs_entity').on(t.audEntity, t.audEntityId),
  }),
);

export type CarAuditLog = typeof carAuditLogs.$inferSelect;
export type CarAuditLogInsert = typeof carAuditLogs.$inferInsert;
