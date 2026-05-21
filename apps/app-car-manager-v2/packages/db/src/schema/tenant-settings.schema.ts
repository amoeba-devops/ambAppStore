import {
  boolean,
  char,
  integer,
  pgEnum,
  pgTable,
  timestamp,
  uniqueIndex,
  varchar,
} from 'drizzle-orm/pg-core';
import { carUsers } from './users.schema';

/**
 * car_tenant_settings — per-tenant workspace + notification + retention prefs.
 *
 * Singleton row per `ent_id` (UNIQUE constraint). Lazy-seeded the first time
 * an Admin opens `/settings` for a tenant that has no row yet — defaults
 * baked here mirror the SQL DEFAULTs to keep dev/seed paths in sync.
 *
 * Scope: persist-only for currency/timezone/retention — downstream wiring
 * (expense display, date formatting, retention cleanup job) is deliberately
 * out of scope per PLAN-20260521 Q1/Q2.
 */
export const currencyEnum = pgEnum('car_currency', ['VND', 'KRW', 'USD']);

export const carTenantSettings = pgTable(
  'car_tenant_settings',
  {
    tnsId: char('tns_id', { length: 36 }).primaryKey(),
    entId: char('ent_id', { length: 36 }).notNull(),
    /* Display name override for the tenant — falls back to AMA-provided
     * entity name when NULL. Nullable so admins can clear back to default. */
    tnsTenantName: varchar('tns_tenant_name', { length: 120 }),
    tnsCurrency: currencyEnum('tns_currency').notNull().default('VND'),
    /* IANA tz name. Service-layer allowlist (Asia/Ho_Chi_Minh, Asia/Seoul)
     * keeps this from accepting arbitrary strings via direct action calls. */
    tnsTimezone: varchar('tns_timezone', { length: 64 }).notNull().default('Asia/Ho_Chi_Minh'),
    tnsNotifInapp: boolean('tns_notif_inapp').notNull().default(true),
    tnsNotifEmail: boolean('tns_notif_email').notNull().default(true),
    tnsNotifDigest: boolean('tns_notif_digest').notNull().default(true),
    /* Years to keep trip records before purge. Allowlist 1/3/5/7 in service. */
    tnsRetentionTripYears: integer('tns_retention_trip_years').notNull().default(5),
    /* Audit log: NULL = indefinite. Allowlist 3/5/NULL in service. */
    tnsRetentionAuditYears: integer('tns_retention_audit_years').default(5),
    tnsUpdatedAt: timestamp('tns_updated_at', { withTimezone: true }).defaultNow().notNull(),
    tnsUpdatedBy: char('tns_updated_by', { length: 36 }).references(() => carUsers.usrId, {
      onDelete: 'set null',
    }),
  },
  (t) => ({
    uniqEnt: uniqueIndex('uniq_car_tenant_settings_ent').on(t.entId),
  }),
);

export type CarTenantSettings = typeof carTenantSettings.$inferSelect;
export type CarTenantSettingsInsert = typeof carTenantSettings.$inferInsert;
export type CarCurrency = (typeof currencyEnum.enumValues)[number];
