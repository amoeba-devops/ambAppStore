import { isNull } from 'drizzle-orm';
import { pgTable, char, timestamp, index, uniqueIndex } from 'drizzle-orm/pg-core';
import { carUsers } from './users.schema';
import { vehicleTypeEnum } from './vehicles.schema';

/**
 * car_user_fleet_access — per-user fleet department membership (REQ-20260617).
 *
 * The AMA JWT is frozen and carries only ONE global role + ent_id (no
 * department). AMA's own department model is a draft, not yet built. So the
 * department × access matrix is owned by this app: each row grants one user
 * access to one fleet department (CAR | TRUCK).
 *
 * Role itself (ADMIN/MANAGER/DRIVER) still comes from `car_users.usr_local_role`
 * and is uniform across a user's departments. Membership only decides WHICH
 * departments they may enter:
 *   - ADMIN  → both departments implicitly (no row needed; resolved in auth).
 *   - MANAGER → 1 or 2 rows (second one obtained via the request/approve flow).
 *   - DRIVER  → exactly 1 active row (enforced at the application layer).
 *
 * `ufa_dep_id` is reserved (nullable) to map onto AMA's `amb_departments.dep_id`
 * once AMA builds its department model — convergence stays cheap.
 */
export const carUserFleetAccess = pgTable(
  'car_user_fleet_access',
  {
    ufaId: char('ufa_id', { length: 36 }).primaryKey(),
    entId: char('ent_id', { length: 36 }).notNull(),
    usrId: char('usr_id', { length: 36 })
      .notNull()
      .references(() => carUsers.usrId),
    ufaVehicleType: vehicleTypeEnum('ufa_vehicle_type').notNull(),
    /* Reserved for future AMA amb_departments mapping (convergence). */
    ufaDepId: char('ufa_dep_id', { length: 36 }),
    ufaGrantedBy: char('ufa_granted_by', { length: 36 }),
    ufaGrantedAt: timestamp('ufa_granted_at', { withTimezone: true }).defaultNow().notNull(),
    ufaDeletedAt: timestamp('ufa_deleted_at', { withTimezone: true }),
  },
  (t) => ({
    /* One live membership per (user, department). Re-granting after revoke
     * is allowed because the partial index only counts live rows. */
    uniqEntUsrType: uniqueIndex('uniq_car_user_fleet_access_ent_usr_type')
      .on(t.entId, t.usrId, t.ufaVehicleType)
      .where(isNull(t.ufaDeletedAt)),
    idxEntUsr: index('idx_car_user_fleet_access_ent_usr').on(t.entId, t.usrId),
  }),
);

export type CarUserFleetAccess = typeof carUserFleetAccess.$inferSelect;
export type CarUserFleetAccessInsert = typeof carUserFleetAccess.$inferInsert;
