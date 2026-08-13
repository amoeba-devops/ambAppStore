import { isNull } from 'drizzle-orm';
import { pgTable, char, varchar, timestamp, index, uniqueIndex } from 'drizzle-orm/pg-core';
import { carUsers } from './users.schema';

/**
 * car_user_region_access — per-user operating-region allow-list (REQ-20260813).
 *
 * Unlike `car_user_fleet_access` (which is "you need a row to get in"), this is
 * an OVERRIDE list: no rows means the user sees every region, which keeps the
 * pre-existing behaviour intact on rollout. Adding rows NARROWS the user down to
 * exactly those regions.
 *   - ADMIN  → all regions, always (resolved in auth, no rows needed).
 *   - others → 0 rows = all regions; ≥1 row = only those regions.
 *
 * `ura_region` is varchar (not a pg enum) to match how regions are already
 * stored on cvh_region / trr_region / tfi_region / tmc_region.
 */
export const carUserRegionAccess = pgTable(
  'car_user_region_access',
  {
    uraId: char('ura_id', { length: 36 }).primaryKey(),
    entId: char('ent_id', { length: 36 }).notNull(),
    usrId: char('usr_id', { length: 36 })
      .notNull()
      .references(() => carUsers.usrId),
    uraRegion: varchar('ura_region', { length: 40 }).notNull(),
    uraGrantedBy: char('ura_granted_by', { length: 36 }),
    uraGrantedAt: timestamp('ura_granted_at', { withTimezone: true }).defaultNow().notNull(),
    uraDeletedAt: timestamp('ura_deleted_at', { withTimezone: true }),
  },
  (t) => ({
    /* One live grant per (user, region); re-granting after revoke works because
     * the partial index only counts live rows. */
    uniqEntUsrRegion: uniqueIndex('uniq_car_user_region_access_ent_usr_region')
      .on(t.entId, t.usrId, t.uraRegion)
      .where(isNull(t.uraDeletedAt)),
    idxEntUsr: index('idx_car_user_region_access_ent_usr').on(t.entId, t.usrId),
  }),
);

export type CarUserRegionAccess = typeof carUserRegionAccess.$inferSelect;
export type CarUserRegionAccessInsert = typeof carUserRegionAccess.$inferInsert;
