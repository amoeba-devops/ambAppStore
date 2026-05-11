import {
  pgEnum,
  pgTable,
  uuid,
  varchar,
  text,
  date,
  time,
  timestamp,
  integer,
  decimal,
  jsonb,
  boolean,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { relations, sql } from 'drizzle-orm';

// ============================================================================
// Enums (mirror @repo/api-types/enums)
// ============================================================================
export const roleEnum = pgEnum('role', ['ADMIN', 'MANAGER', 'DRIVER']);
export const userStatusEnum = pgEnum('user_status', ['ACTIVE', 'DISABLED']);
export const languageEnum = pgEnum('language', ['en', 'ko', 'vi']);
export const vehicleStatusEnum = pgEnum('vehicle_status', [
  'ACTIVE',
  'MAINTENANCE',
  'INACTIVE',
]);
export const driverStatusEnum = pgEnum('driver_status', ['ACTIVE', 'INACTIVE']);
export const tripStatusEnum = pgEnum('trip_status', [
  'PENDING_DRIVER_CONFIRM',
  'CONFIRMED',
  'DRIVER_REJECTED',
  'IN_PROGRESS',
  'COMPLETED',
  'CANCELLED',
]);
export const costTypeEnum = pgEnum('cost_type', [
  'FUEL',
  'OIL_CHANGE',
  'ACCIDENT',
  'MEAL',
  'REPAIR_MAINTENANCE',
]);
export const costStatusEnum = pgEnum('cost_status', [
  'DRAFT',
  'PENDING_APPROVAL',
  'APPROVED_TO_PROCEED',
  'SUBMITTED',
  'APPROVED',
  'REJECTED',
]);
export const platformEnum = pgEnum('platform', ['web', 'ios', 'android']);

// ============================================================================
// Users
// ============================================================================
export const users = pgTable(
  'users',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    email: varchar('email', { length: 255 }).notNull(),
    passwordHash: varchar('password_hash', { length: 255 }),
    fullName: varchar('full_name', { length: 200 }).notNull(),
    position: varchar('position', { length: 200 }),
    role: roleEnum('role').notNull(),
    language: languageEnum('language').notNull().default('en'),
    status: userStatusEnum('status').notNull().default('ACTIVE'),
    ssoProvider: varchar('sso_provider', { length: 50 }),
    ssoId: varchar('sso_id', { length: 255 }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [uniqueIndex('users_email_unique').on(t.email)],
);

// ============================================================================
// Drivers
// ============================================================================
export const drivers = pgTable(
  'drivers',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
    fullName: varchar('full_name', { length: 200 }).notNull(),
    licenseNumber: varchar('license_number', { length: 50 }).notNull(),
    licenseClass: varchar('license_class', { length: 20 }),
    licenseExpiryDate: date('license_expiry_date').notNull(),
    phone: varchar('phone', { length: 30 }),
    avatarUrl: text('avatar_url'),
    status: driverStatusEnum('status').notNull().default('ACTIVE'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex('drivers_license_number_unique').on(t.licenseNumber),
    index('drivers_user_id_idx').on(t.userId),
  ],
);

// ============================================================================
// Vehicles
// ============================================================================
export const vehicles = pgTable(
  'vehicles',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    licensePlate: varchar('license_plate', { length: 20 }).notNull(),
    vehicleType: varchar('vehicle_type', { length: 100 }).notNull(),
    manufactureYear: integer('manufacture_year'),
    color: varchar('color', { length: 50 }),
    photos: jsonb('photos').$type<string[]>().notNull().default(sql`'[]'::jsonb`),
    currentKm: integer('current_km').notNull().default(0),
    oilChangeIntervalKm: integer('oil_change_interval_km').notNull().default(5000),
    lastOilChangeKm: integer('last_oil_change_km').notNull().default(0),
    assignedDriverId: uuid('assigned_driver_id').references(() => drivers.id, {
      onDelete: 'set null',
    }),
    status: vehicleStatusEnum('status').notNull().default('ACTIVE'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [uniqueIndex('vehicles_license_plate_unique').on(t.licensePlate)],
);

// ============================================================================
// Trips
// ============================================================================
type LocationJson = {
  address: string;
  lat: number;
  lng: number;
  placeId?: string;
};

export const trips = pgTable(
  'trips',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    passengerId: uuid('passenger_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    driverId: uuid('driver_id')
      .notNull()
      .references(() => drivers.id, { onDelete: 'restrict' }),
    vehicleId: uuid('vehicle_id')
      .notNull()
      .references(() => vehicles.id, { onDelete: 'restrict' }),
    tripDate: date('trip_date').notNull(),
    tripTime: time('trip_time').notNull(),
    estimatedEndTime: time('estimated_end_time'),
    pickupLocation: jsonb('pickup_location').$type<LocationJson>().notNull(),
    destination: jsonb('destination').$type<LocationJson>().notNull(),
    stopovers: jsonb('stopovers').$type<LocationJson[]>().notNull().default(sql`'[]'::jsonb`),
    mapsUrl: text('maps_url'),
    note: text('note'),
    status: tripStatusEnum('status').notNull().default('PENDING_DRIVER_CONFIRM'),
    rejectionReason: text('rejection_reason'),
    createdBy: uuid('created_by')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index('trips_vehicle_date_idx').on(t.vehicleId, t.tripDate),
    index('trips_driver_date_idx').on(t.driverId, t.tripDate),
    index('trips_status_idx').on(t.status),
    index('trips_passenger_idx').on(t.passengerId),
  ],
);

// ============================================================================
// Costs + Cost Attachments
// ============================================================================
export const costs = pgTable(
  'costs',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    type: costTypeEnum('type').notNull(),
    vehicleId: uuid('vehicle_id')
      .notNull()
      .references(() => vehicles.id, { onDelete: 'restrict' }),
    tripId: uuid('trip_id').references(() => trips.id, { onDelete: 'set null' }),
    costDate: date('cost_date').notNull(),
    amount: decimal('amount', { precision: 15, scale: 2 }).notNull(),
    currency: varchar('currency', { length: 3 }).notNull().default('VND'),
    description: text('description'),
    metadata: jsonb('metadata').$type<Record<string, unknown>>().notNull().default(sql`'{}'::jsonb`),
    status: costStatusEnum('status').notNull().default('SUBMITTED'),
    rejectionReason: text('rejection_reason'),
    submittedBy: uuid('submitted_by')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    approvedBy: uuid('approved_by').references(() => users.id, { onDelete: 'set null' }),
    approvedAt: timestamp('approved_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index('costs_vehicle_date_idx').on(t.vehicleId, t.costDate),
    index('costs_status_idx').on(t.status),
    index('costs_type_idx').on(t.type),
    index('costs_trip_idx').on(t.tripId),
  ],
);

export const costAttachments = pgTable(
  'cost_attachments',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    costId: uuid('cost_id')
      .notNull()
      .references(() => costs.id, { onDelete: 'cascade' }),
    fileUrl: text('file_url').notNull(),
    fileKey: text('file_key').notNull(),
    fileType: varchar('file_type', { length: 100 }).notNull(),
    uploadedBy: uuid('uploaded_by')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index('cost_attachments_cost_id_idx').on(t.costId)],
);

// ============================================================================
// Notifications + Device Tokens
// ============================================================================
export const notifications = pgTable(
  'notifications',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    type: varchar('type', { length: 50 }).notNull(),
    title: varchar('title', { length: 200 }).notNull(),
    body: text('body').notNull(),
    payload: jsonb('payload').$type<Record<string, unknown>>().default(sql`'{}'::jsonb`),
    readAt: timestamp('read_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index('notifications_user_idx').on(t.userId, t.createdAt),
    index('notifications_unread_idx').on(t.userId, t.readAt),
  ],
);

export const deviceTokens = pgTable(
  'device_tokens',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    platform: platformEnum('platform').notNull(),
    token: text('token').notNull(),
    lastActiveAt: timestamp('last_active_at', { withTimezone: true }).defaultNow().notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex('device_tokens_token_unique').on(t.token),
    index('device_tokens_user_idx').on(t.userId),
  ],
);

// ============================================================================
// Refresh Tokens (mobile)
// ============================================================================
export const refreshTokens = pgTable(
  'refresh_tokens',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    tokenHash: varchar('token_hash', { length: 255 }).notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex('refresh_tokens_hash_unique').on(t.tokenHash),
    index('refresh_tokens_user_idx').on(t.userId),
  ],
);

// ============================================================================
// System Settings (key-value, JSONB)
// ============================================================================
export const systemSettings = pgTable('system_settings', {
  key: varchar('key', { length: 100 }).primaryKey(),
  value: jsonb('value').notNull(),
  description: text('description'),
  updatedBy: uuid('updated_by').references(() => users.id, { onDelete: 'set null' }),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

// ============================================================================
// Audit Logs
// ============================================================================
export const auditLogs = pgTable(
  'audit_logs',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
    action: varchar('action', { length: 100 }).notNull(),
    entityType: varchar('entity_type', { length: 50 }).notNull(),
    entityId: uuid('entity_id'),
    oldValue: jsonb('old_value'),
    newValue: jsonb('new_value'),
    ipAddress: varchar('ip_address', { length: 45 }),
    userAgent: text('user_agent'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index('audit_logs_user_idx').on(t.userId, t.createdAt),
    index('audit_logs_entity_idx').on(t.entityType, t.entityId),
  ],
);

// ============================================================================
// Relations
// ============================================================================
export const usersRelations = relations(users, ({ many, one }) => ({
  driverProfile: one(drivers, { fields: [users.id], references: [drivers.userId] }),
  tripsAsPassenger: many(trips, { relationName: 'tripPassenger' }),
  tripsCreated: many(trips, { relationName: 'tripCreator' }),
  costsSubmitted: many(costs, { relationName: 'costSubmitter' }),
  notifications: many(notifications),
  deviceTokens: many(deviceTokens),
}));

export const driversRelations = relations(drivers, ({ one, many }) => ({
  user: one(users, { fields: [drivers.userId], references: [users.id] }),
  vehiclesAssigned: many(vehicles),
  trips: many(trips),
}));

export const vehiclesRelations = relations(vehicles, ({ one, many }) => ({
  assignedDriver: one(drivers, {
    fields: [vehicles.assignedDriverId],
    references: [drivers.id],
  }),
  trips: many(trips),
  costs: many(costs),
}));

export const tripsRelations = relations(trips, ({ one, many }) => ({
  passenger: one(users, {
    fields: [trips.passengerId],
    references: [users.id],
    relationName: 'tripPassenger',
  }),
  creator: one(users, {
    fields: [trips.createdBy],
    references: [users.id],
    relationName: 'tripCreator',
  }),
  driver: one(drivers, { fields: [trips.driverId], references: [drivers.id] }),
  vehicle: one(vehicles, { fields: [trips.vehicleId], references: [vehicles.id] }),
  costs: many(costs),
}));

export const costsRelations = relations(costs, ({ one, many }) => ({
  vehicle: one(vehicles, { fields: [costs.vehicleId], references: [vehicles.id] }),
  trip: one(trips, { fields: [costs.tripId], references: [trips.id] }),
  submitter: one(users, {
    fields: [costs.submittedBy],
    references: [users.id],
    relationName: 'costSubmitter',
  }),
  approver: one(users, { fields: [costs.approvedBy], references: [users.id] }),
  attachments: many(costAttachments),
}));

export const costAttachmentsRelations = relations(costAttachments, ({ one }) => ({
  cost: one(costs, { fields: [costAttachments.costId], references: [costs.id] }),
  uploader: one(users, { fields: [costAttachments.uploadedBy], references: [users.id] }),
}));

// ============================================================================
// Inferred types
// ============================================================================
export type DbUser = typeof users.$inferSelect;
export type DbVehicle = typeof vehicles.$inferSelect;
export type DbDriver = typeof drivers.$inferSelect;
export type DbTrip = typeof trips.$inferSelect;
export type DbCost = typeof costs.$inferSelect;
