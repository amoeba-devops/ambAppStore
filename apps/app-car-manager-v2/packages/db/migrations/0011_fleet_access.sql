-- REQ-20260617 fleet-access: department × role access for the multi-fleet
-- (CAR / TRUCK) plan. The AMA JWT is frozen (one global role, no department)
-- and AMA's department model is not built, so the department × access matrix is
-- owned by this app via two new tables + a fleet discriminator on vehicles.
--
-- Safety: every new column is nullable or has a default; nothing destructive.
-- The backfill tags all existing data + users as CAR so the live car MVP is
-- untouched (single-fleet behaviour preserved).
--
-- Manual migration (same pattern as 0009/0010): NOT in the drizzle journal.
-- Dev syncs schema via `db:push`; staging/prod apply this file via psql. The
-- backfill (steps 5–6) is idempotent — safe to re-run per environment.

-- 1. Fleet department discriminator on vehicles -----------------------------
CREATE TYPE "car_vehicle_type" AS ENUM ('CAR', 'TRUCK');
--> statement-breakpoint
ALTER TABLE "car_vehicles"
  ADD COLUMN "cvh_type" "car_vehicle_type" NOT NULL DEFAULT 'CAR';
--> statement-breakpoint
CREATE INDEX "idx_car_vehicles_ent_type"
  ON "car_vehicles" USING btree ("ent_id", "cvh_type");
--> statement-breakpoint

-- 2. car_user_fleet_access — per-user department membership ------------------
CREATE TABLE "car_user_fleet_access" (
  "ufa_id"           char(36) PRIMARY KEY NOT NULL,
  "ent_id"           char(36) NOT NULL,
  "usr_id"           char(36) NOT NULL,
  "ufa_vehicle_type" "car_vehicle_type" NOT NULL,
  "ufa_dep_id"       char(36),
  "ufa_granted_by"   char(36),
  "ufa_granted_at"   timestamptz NOT NULL DEFAULT now(),
  "ufa_deleted_at"   timestamptz
);
--> statement-breakpoint
ALTER TABLE "car_user_fleet_access"
  ADD CONSTRAINT "car_user_fleet_access_usr_id_car_users_usr_id_fk"
  FOREIGN KEY ("usr_id") REFERENCES "public"."car_users"("usr_id")
  ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
CREATE UNIQUE INDEX "uniq_car_user_fleet_access_ent_usr_type"
  ON "car_user_fleet_access" USING btree ("ent_id", "usr_id", "ufa_vehicle_type")
  WHERE "ufa_deleted_at" IS NULL;
--> statement-breakpoint
CREATE INDEX "idx_car_user_fleet_access_ent_usr"
  ON "car_user_fleet_access" USING btree ("ent_id", "usr_id");
--> statement-breakpoint

-- 3. car_fleet_access_requests — manager request/approve queue ---------------
CREATE TYPE "car_fleet_access_request_status" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');
--> statement-breakpoint
CREATE TABLE "car_fleet_access_requests" (
  "far_id"            char(36) PRIMARY KEY NOT NULL,
  "ent_id"            char(36) NOT NULL,
  "usr_id"            char(36) NOT NULL,
  "far_vehicle_type"  "car_vehicle_type" NOT NULL,
  "far_status"        "car_fleet_access_request_status" NOT NULL DEFAULT 'PENDING',
  "far_reason"        text,
  "far_requested_at"  timestamptz NOT NULL DEFAULT now(),
  "far_decided_by"    char(36),
  "far_decided_at"    timestamptz,
  "far_decision_note" text
);
--> statement-breakpoint
ALTER TABLE "car_fleet_access_requests"
  ADD CONSTRAINT "car_fleet_access_requests_usr_id_car_users_usr_id_fk"
  FOREIGN KEY ("usr_id") REFERENCES "public"."car_users"("usr_id")
  ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "idx_car_fleet_access_requests_ent_status"
  ON "car_fleet_access_requests" USING btree ("ent_id", "far_status");
--> statement-breakpoint
CREATE INDEX "idx_car_fleet_access_requests_ent_usr"
  ON "car_fleet_access_requests" USING btree ("ent_id", "usr_id");
--> statement-breakpoint

-- 4. (vehicles already defaulted to CAR via the column default) --------------

-- 5. Backfill: grant every existing live user a CAR membership ---------------
--    Idempotent: skips users that already hold a live CAR membership.
INSERT INTO "car_user_fleet_access" ("ufa_id", "ent_id", "usr_id", "ufa_vehicle_type")
SELECT gen_random_uuid(), u."ent_id", u."usr_id", 'CAR'
FROM "car_users" u
WHERE u."usr_deleted_at" IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM "car_user_fleet_access" a
    WHERE a."usr_id" = u."usr_id"
      AND a."ufa_vehicle_type" = 'CAR'
      AND a."ufa_deleted_at" IS NULL
  );
