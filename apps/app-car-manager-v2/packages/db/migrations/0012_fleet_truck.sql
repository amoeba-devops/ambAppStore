-- REQ-20260617 fleet-truck: merge TRUCK domain into car-manager-v2.
-- Adds the trip-kind discriminator + truck trip-log fields on car_trips, truck
-- attributes on car_vehicles, and 3 new tables (extra costs, monthly fixed
-- costs, import history). Builds on 0011_fleet_access.sql (cvh_type + fleet
-- membership).
--
-- Safety: every new column is nullable or has a default; nothing destructive.
-- Backfill tags existing trips as DISPATCH so the live car flow is unchanged.
--
-- Manual migration (pattern 0009/0010/0011): NOT in the drizzle journal. Dev
-- syncs schema via `db:push`; staging/prod apply this file via psql.

-- 1. Trip-kind discriminator + truck trip-log fields on car_trips -----------
CREATE TYPE "car_trip_kind" AS ENUM ('DISPATCH', 'LOG');
--> statement-breakpoint
ALTER TABLE "car_trips"
  ADD COLUMN "trp_kind"        "car_trip_kind" NOT NULL DEFAULT 'DISPATCH',
  ADD COLUMN "trp_customer"    varchar(255),
  ADD COLUMN "trp_bol"         varchar(64),
  ADD COLUMN "trp_cdf"         varchar(64),
  ADD COLUMN "trp_fuel_liters" numeric(10, 2),
  ADD COLUMN "trp_fuel_price"  numeric(14, 2),
  ADD COLUMN "trp_toll_fee"    numeric(14, 2),
  ADD COLUMN "trp_revenue"     numeric(14, 2);
--> statement-breakpoint
CREATE INDEX "idx_car_trips_ent_kind_scheduled"
  ON "car_trips" USING btree ("ent_id", "trp_kind", "trp_scheduled_at");
--> statement-breakpoint

-- 2. Truck attributes on car_vehicles --------------------------------------
ALTER TABLE "car_vehicles"
  ADD COLUMN "cvh_tonnage"    numeric(6, 2),
  ADD COLUMN "cvh_fuel_quota" numeric(6, 2);
--> statement-breakpoint

-- 3. car_trip_extra_costs — structured "other costs" per truck trip ---------
CREATE TABLE "car_trip_extra_costs" (
  "tec_id"         char(36) PRIMARY KEY NOT NULL,
  "ent_id"         char(36) NOT NULL,
  "trp_id"         char(36) NOT NULL,
  "tec_name"       varchar(255) NOT NULL,
  "tec_amount"     numeric(14, 2) NOT NULL,
  "tec_created_at" timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "car_trip_extra_costs"
  ADD CONSTRAINT "car_trip_extra_costs_trp_id_car_trips_trp_id_fk"
  FOREIGN KEY ("trp_id") REFERENCES "public"."car_trips"("trp_id")
  ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "idx_car_trip_extra_costs_trip"
  ON "car_trip_extra_costs" USING btree ("trp_id");
--> statement-breakpoint
CREATE INDEX "idx_car_trip_extra_costs_ent_trip"
  ON "car_trip_extra_costs" USING btree ("ent_id", "trp_id");
--> statement-breakpoint

-- 4. car_truck_fixed_costs — monthly fixed costs per truck ------------------
CREATE TABLE "car_truck_fixed_costs" (
  "tfc_id"           char(36) PRIMARY KEY NOT NULL,
  "ent_id"           char(36) NOT NULL,
  "cvh_id"           char(36) NOT NULL,
  "tfc_month"        varchar(7) NOT NULL,
  "tfc_salary"       numeric(14, 2) NOT NULL DEFAULT '0',
  "tfc_depreciation" numeric(14, 2) NOT NULL DEFAULT '0',
  "tfc_insurance"    numeric(14, 2) NOT NULL DEFAULT '0',
  "tfc_created_at"   timestamptz NOT NULL DEFAULT now(),
  "tfc_updated_at"   timestamptz
);
--> statement-breakpoint
ALTER TABLE "car_truck_fixed_costs"
  ADD CONSTRAINT "car_truck_fixed_costs_cvh_id_car_vehicles_cvh_id_fk"
  FOREIGN KEY ("cvh_id") REFERENCES "public"."car_vehicles"("cvh_id")
  ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
CREATE UNIQUE INDEX "uniq_car_truck_fixed_costs_ent_vehicle_month"
  ON "car_truck_fixed_costs" USING btree ("ent_id", "cvh_id", "tfc_month");
--> statement-breakpoint
CREATE INDEX "idx_car_truck_fixed_costs_ent_month"
  ON "car_truck_fixed_costs" USING btree ("ent_id", "tfc_month");
--> statement-breakpoint

-- 5. car_imports — Excel import history ------------------------------------
CREATE TYPE "car_import_status" AS ENUM ('PENDING', 'COMPLETED', 'FAILED');
--> statement-breakpoint
CREATE TABLE "car_imports" (
  "imp_id"         char(36) PRIMARY KEY NOT NULL,
  "ent_id"         char(36) NOT NULL,
  "imp_file_name"  varchar(255) NOT NULL,
  "imp_vehicle_id" char(36),
  "imp_row_count"  integer NOT NULL DEFAULT 0,
  "imp_status"     "car_import_status" NOT NULL DEFAULT 'PENDING',
  "imp_error"      text,
  "imp_created_by" char(36) NOT NULL,
  "imp_created_at" timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "car_imports"
  ADD CONSTRAINT "car_imports_imp_vehicle_id_car_vehicles_cvh_id_fk"
  FOREIGN KEY ("imp_vehicle_id") REFERENCES "public"."car_vehicles"("cvh_id")
  ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "car_imports"
  ADD CONSTRAINT "car_imports_imp_created_by_car_users_usr_id_fk"
  FOREIGN KEY ("imp_created_by") REFERENCES "public"."car_users"("usr_id")
  ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "idx_car_imports_ent_created"
  ON "car_imports" USING btree ("ent_id", "imp_created_at");
--> statement-breakpoint

-- 6. Backfill: existing trips are car dispatch -----------------------------
--    Column default already sets 'DISPATCH'; this is belt-and-suspenders for
--    any row created before the default took effect. Idempotent.
UPDATE "car_trips" SET "trp_kind" = 'DISPATCH' WHERE "trp_kind" IS NULL;
