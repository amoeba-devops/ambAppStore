import { pgTable, char, text, timestamp, index, pgEnum } from 'drizzle-orm/pg-core';
import { carUsers } from './users.schema';
import { vehicleTypeEnum } from './vehicles.schema';

/**
 * car_fleet_access_requests — self-service request/approve for a MANAGER who
 * wants access to a second fleet department (REQ-20260617).
 *
 * Mirrors the platform's `plt_subscriptions` PENDING→ACTIVE approval and the
 * app's expense approval queue: a manager submits a PENDING request, an admin
 * decides. On APPROVED, `decideFleetAccessAction` inserts the corresponding
 * `car_user_fleet_access` row in the same transaction.
 *
 * Drivers (single department) and admins (both departments) do not use this
 * flow — only managers expanding from 1 → 2 departments.
 */
export const fleetAccessRequestStatusEnum = pgEnum('car_fleet_access_request_status', [
  'PENDING',
  'APPROVED',
  'REJECTED',
]);

export const carFleetAccessRequests = pgTable(
  'car_fleet_access_requests',
  {
    farId: char('far_id', { length: 36 }).primaryKey(),
    entId: char('ent_id', { length: 36 }).notNull(),
    usrId: char('usr_id', { length: 36 })
      .notNull()
      .references(() => carUsers.usrId),
    farVehicleType: vehicleTypeEnum('far_vehicle_type').notNull(),
    farStatus: fleetAccessRequestStatusEnum('far_status').notNull().default('PENDING'),
    farReason: text('far_reason'),
    farRequestedAt: timestamp('far_requested_at', { withTimezone: true }).defaultNow().notNull(),
    farDecidedBy: char('far_decided_by', { length: 36 }),
    farDecidedAt: timestamp('far_decided_at', { withTimezone: true }),
    farDecisionNote: text('far_decision_note'),
  },
  (t) => ({
    idxEntStatus: index('idx_car_fleet_access_requests_ent_status').on(t.entId, t.farStatus),
    idxEntUsr: index('idx_car_fleet_access_requests_ent_usr').on(t.entId, t.usrId),
  }),
);

export type CarFleetAccessRequest = typeof carFleetAccessRequests.$inferSelect;
export type CarFleetAccessRequestInsert = typeof carFleetAccessRequests.$inferInsert;
export type CarFleetAccessRequestStatus =
  (typeof fleetAccessRequestStatusEnum.enumValues)[number];
