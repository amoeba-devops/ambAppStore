import { pgTable, char, varchar, integer, text, timestamp, pgEnum, index } from 'drizzle-orm/pg-core';
import { carVehicles } from './vehicles.schema';
import { carUsers } from './users.schema';

/**
 * car_imports — history of Excel trip-log imports (REQ-20260617).
 * One file = one truck, one sheet = one month (per the customer SRS). Records
 * the upload so the manager can audit what was bulk-loaded and roll back.
 */
export const importStatusEnum = pgEnum('car_import_status', [
  'PENDING',
  'COMPLETED',
  'FAILED',
]);

export const carImports = pgTable(
  'car_imports',
  {
    impId: char('imp_id', { length: 36 }).primaryKey(),
    entId: char('ent_id', { length: 36 }).notNull(),
    impFileName: varchar('imp_file_name', { length: 255 }).notNull(),
    /* Target truck the sheet belongs to (nullable until matched in preview). */
    impVehicleId: char('imp_vehicle_id', { length: 36 }).references(() => carVehicles.cvhId),
    impRowCount: integer('imp_row_count').notNull().default(0),
    impStatus: importStatusEnum('imp_status').notNull().default('PENDING'),
    impError: text('imp_error'),
    impCreatedBy: char('imp_created_by', { length: 36 })
      .notNull()
      .references(() => carUsers.usrId),
    impCreatedAt: timestamp('imp_created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    idxEntCreated: index('idx_car_imports_ent_created').on(t.entId, t.impCreatedAt),
  }),
);

export type CarImport = typeof carImports.$inferSelect;
export type CarImportInsert = typeof carImports.$inferInsert;
export type CarImportStatus = (typeof importStatusEnum.enumValues)[number];
