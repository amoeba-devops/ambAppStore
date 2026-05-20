import { isNull } from 'drizzle-orm';
import {
  bigint,
  char,
  date,
  decimal,
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from 'drizzle-orm/pg-core';
import { carDrivers } from './drivers.schema';
import { carTrips } from './trips.schema';
import { carUsers } from './users.schema';

/**
 * car_expenses — driver-submitted expense record.
 * PRD §6.2 · 8 expense types (5 SRS + 3 PRD extension).
 *
 * exp_status flow:
 *   PENDING   → driver submitted, awaiting admin
 *   APPROVED  → admin approved
 *   REJECTED  → admin rejected (with note)
 *   AUTO_APPROVED → server auto-approved (under threshold per car_approval_rules)
 *
 * Soft delete via exp_deleted_at.
 * exp_locked_until: 7 days after submission per PRD §6.2.3 — driver can edit
 * within that window, after which the record freezes (Admin can still change).
 */

export const expenseTypeEnum = pgEnum('car_expense_type', [
  'FUEL',
  'OIL',
  'MEAL',
  'REPAIR',
  'PARKING',
  'TOLL',
  'ACCIDENT',
  'INSPECTION',
]);

export const expenseStatusEnum = pgEnum('car_expense_status', [
  'PENDING',
  'APPROVED',
  'REJECTED',
  'AUTO_APPROVED',
]);

export const carExpenses = pgTable(
  'car_expenses',
  {
    expId: char('exp_id', { length: 36 }).primaryKey(),
    entId: char('ent_id', { length: 36 }).notNull(),
    expType: expenseTypeEnum('exp_type').notNull(),
    /* DECIMAL(14,2) supports up to ~999 billion VND — well beyond any sane
     * single-receipt amount. Stored as string in Drizzle; helpers in the
     * service layer convert to/from number for UI. */
    expAmount: decimal('exp_amount', { precision: 14, scale: 2 }).notNull(),
    expCurrency: varchar('exp_currency', { length: 3 }).notNull().default('VND'),
    expOccurredAt: date('exp_occurred_at').notNull(),
    expNote: text('exp_note'),
    expStatus: expenseStatusEnum('exp_status').notNull().default('PENDING'),
    /* Nullable — driver may submit a standalone expense not tied to a trip
     * (e.g. monthly toll prepay, scheduled inspection). */
    expTripId: char('exp_trip_id', { length: 36 }).references(() => carTrips.trpId),
    expDriverId: char('exp_driver_id', { length: 36 })
      .notNull()
      .references(() => carDrivers.drvId),
    expSubmittedBy: char('exp_submitted_by', { length: 36 })
      .notNull()
      .references(() => carUsers.usrId),
    expSubmittedAt: timestamp('exp_submitted_at', { withTimezone: true }).defaultNow().notNull(),
    expReviewedBy: char('exp_reviewed_by', { length: 36 }).references(() => carUsers.usrId),
    expReviewedAt: timestamp('exp_reviewed_at', { withTimezone: true }),
    expReviewNote: text('exp_review_note'),
    /* 7-day soft-edit window for driver. Set at submission to NOW() + 7 days. */
    expLockedUntil: timestamp('exp_locked_until', { withTimezone: true }).notNull(),
    expCreatedAt: timestamp('exp_created_at', { withTimezone: true }).defaultNow().notNull(),
    expUpdatedAt: timestamp('exp_updated_at', { withTimezone: true }),
    expDeletedAt: timestamp('exp_deleted_at', { withTimezone: true }),
  },
  (t) => ({
    idxEntStatus: index('idx_car_expenses_ent_status').on(t.entId, t.expStatus),
    idxEntDriver: index('idx_car_expenses_ent_driver').on(t.entId, t.expDriverId),
    idxEntOccurred: index('idx_car_expenses_ent_occurred').on(t.entId, t.expOccurredAt),
    idxTrip: index('idx_car_expenses_trip').on(t.expTripId),
  }),
);

/* car_expense_attachments — S3-backed receipt images.
 *
 * Rows hold pointers (S3 key) only, never file bytes. Lifecycle is parent-
 * coupled: if the parent expense is soft-deleted we leave the attachment row
 * (no FK CASCADE) so audit history stays intact; an eventual janitor job can
 * prune orphaned S3 objects older than retention. */
export const carExpenseAttachments = pgTable(
  'car_expense_attachments',
  {
    eatId: char('eat_id', { length: 36 }).primaryKey(),
    entId: char('ent_id', { length: 36 }).notNull(),
    eatExpenseId: char('eat_expense_id', { length: 36 })
      .notNull()
      .references(() => carExpenses.expId),
    eatS3Key: text('eat_s3_key').notNull(),
    eatMime: varchar('eat_mime', { length: 64 }).notNull(),
    eatSizeBytes: bigint('eat_size_bytes', { mode: 'number' }).notNull(),
    eatUploadedAt: timestamp('eat_uploaded_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    idxExpense: index('idx_car_expense_attachments_expense').on(t.eatExpenseId),
  }),
);

/* car_approval_rules — per-tenant policy for each expense type.
 *
 * One row per (ent_id, apr_type). Lazy-seeded the first time a tenant submits
 * an expense — defaults baked in the service layer per CLAUDE.md §4.8. */
export const carApprovalRules = pgTable(
  'car_approval_rules',
  {
    aprId: char('apr_id', { length: 36 }).primaryKey(),
    entId: char('ent_id', { length: 36 }).notNull(),
    aprType: expenseTypeEnum('apr_type').notNull(),
    /* When false: always auto-approve regardless of amount. When true:
     * inspect apr_auto_threshold — under = auto-approved, over = needs admin. */
    aprRequiresApproval: integer('apr_requires_approval').notNull().default(0),
    /* Nullable: when apr_requires_approval=true and threshold=NULL, every
     * amount needs explicit admin review (no auto path). */
    aprAutoThreshold: decimal('apr_auto_threshold', { precision: 14, scale: 2 }),
    aprUpdatedAt: timestamp('apr_updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    uniqEntType: uniqueIndex('uniq_car_approval_rules_ent_type').on(t.entId, t.aprType),
  }),
);

export type CarExpense = typeof carExpenses.$inferSelect;
export type CarExpenseInsert = typeof carExpenses.$inferInsert;
export type CarExpenseStatus = (typeof expenseStatusEnum.enumValues)[number];
export type CarExpenseType = (typeof expenseTypeEnum.enumValues)[number];
export type CarExpenseAttachment = typeof carExpenseAttachments.$inferSelect;
export type CarExpenseAttachmentInsert = typeof carExpenseAttachments.$inferInsert;
export type CarApprovalRule = typeof carApprovalRules.$inferSelect;

/* Silence linter for `isNull` import retained for future use. */
void isNull;
