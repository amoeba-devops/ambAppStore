-- Idempotent apply of truck migrations 0011-0022 for car-manager-v2.
-- Reconciles a partially-migrated Neon branch: creates missing objects, skips
-- existing ones (all guarded with IF NOT EXISTS / DO $ EXCEPTION). Safe to
-- re-run. Also records each migration in drizzle.__drizzle_migrations so future
-- drizzle-kit sees them as applied.
--
-- HOW TO RUN: paste this whole file into the Neon SQL console for the target
-- branch (it handles multi-statement + DO blocks), or psql -f against it.
-- Generated 2026-07-17T06:42:22.134Z from packages/db/migrations/*.sql.


-- ============================== 0011_fleet_access ==============================
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
-- Idempotency guards added 2026-07-17 (CREATE TYPE/CONSTRAINT wrapped, TABLE/
-- INDEX/COLUMN IF NOT EXISTS) so it re-runs cleanly on partially-migrated DBs.

-- 1. Fleet department discriminator on vehicles -----------------------------
DO $$ BEGIN
  CREATE TYPE "car_vehicle_type" AS ENUM ('CAR', 'TRUCK');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

ALTER TABLE "car_vehicles"
  ADD COLUMN IF NOT EXISTS "cvh_type" "car_vehicle_type" NOT NULL DEFAULT 'CAR';

CREATE INDEX IF NOT EXISTS "idx_car_vehicles_ent_type"
  ON "car_vehicles" USING btree ("ent_id", "cvh_type");

-- 2. car_user_fleet_access — per-user department membership ------------------
CREATE TABLE IF NOT EXISTS "car_user_fleet_access" (
  "ufa_id"           char(36) PRIMARY KEY NOT NULL,
  "ent_id"           char(36) NOT NULL,
  "usr_id"           char(36) NOT NULL,
  "ufa_vehicle_type" "car_vehicle_type" NOT NULL,
  "ufa_dep_id"       char(36),
  "ufa_granted_by"   char(36),
  "ufa_granted_at"   timestamptz NOT NULL DEFAULT now(),
  "ufa_deleted_at"   timestamptz
);

DO $$ BEGIN
  ALTER TABLE "car_user_fleet_access"
    ADD CONSTRAINT "car_user_fleet_access_usr_id_car_users_usr_id_fk"
    FOREIGN KEY ("usr_id") REFERENCES "public"."car_users"("usr_id")
    ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "uniq_car_user_fleet_access_ent_usr_type"
  ON "car_user_fleet_access" USING btree ("ent_id", "usr_id", "ufa_vehicle_type")
  WHERE "ufa_deleted_at" IS NULL;

CREATE INDEX IF NOT EXISTS "idx_car_user_fleet_access_ent_usr"
  ON "car_user_fleet_access" USING btree ("ent_id", "usr_id");

-- 3. car_fleet_access_requests — manager request/approve queue ---------------
DO $$ BEGIN
  CREATE TYPE "car_fleet_access_request_status" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS "car_fleet_access_requests" (
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

DO $$ BEGIN
  ALTER TABLE "car_fleet_access_requests"
    ADD CONSTRAINT "car_fleet_access_requests_usr_id_car_users_usr_id_fk"
    FOREIGN KEY ("usr_id") REFERENCES "public"."car_users"("usr_id")
    ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

CREATE INDEX IF NOT EXISTS "idx_car_fleet_access_requests_ent_status"
  ON "car_fleet_access_requests" USING btree ("ent_id", "far_status");

CREATE INDEX IF NOT EXISTS "idx_car_fleet_access_requests_ent_usr"
  ON "car_fleet_access_requests" USING btree ("ent_id", "usr_id");

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
INSERT INTO drizzle.__drizzle_migrations (hash, created_at)
  SELECT 'manual-0011_fleet_access', 1783000000000
  WHERE NOT EXISTS (SELECT 1 FROM drizzle.__drizzle_migrations WHERE created_at=1783000000000);


-- ============================== 0012_fleet_truck ==============================
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
-- Idempotency guards added 2026-07-17 (CREATE TYPE/CONSTRAINT wrapped, TABLE/
-- INDEX/COLUMN IF NOT EXISTS) so it re-runs cleanly on partially-migrated DBs.

-- 1. Trip-kind discriminator + truck trip-log fields on car_trips -----------
DO $$ BEGIN
  CREATE TYPE "car_trip_kind" AS ENUM ('DISPATCH', 'LOG');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

ALTER TABLE "car_trips"
  ADD COLUMN IF NOT EXISTS "trp_kind"        "car_trip_kind" NOT NULL DEFAULT 'DISPATCH',
  ADD COLUMN IF NOT EXISTS "trp_customer"    varchar(255),
  ADD COLUMN IF NOT EXISTS "trp_bol"         varchar(64),
  ADD COLUMN IF NOT EXISTS "trp_cdf"         varchar(64),
  ADD COLUMN IF NOT EXISTS "trp_fuel_liters" numeric(10, 2),
  ADD COLUMN IF NOT EXISTS "trp_fuel_price"  numeric(14, 2),
  ADD COLUMN IF NOT EXISTS "trp_toll_fee"    numeric(14, 2),
  ADD COLUMN IF NOT EXISTS "trp_revenue"     numeric(14, 2);

CREATE INDEX IF NOT EXISTS "idx_car_trips_ent_kind_scheduled"
  ON "car_trips" USING btree ("ent_id", "trp_kind", "trp_scheduled_at");

-- 2. Truck attributes on car_vehicles --------------------------------------
ALTER TABLE "car_vehicles"
  ADD COLUMN IF NOT EXISTS "cvh_tonnage"    numeric(6, 2),
  ADD COLUMN IF NOT EXISTS "cvh_fuel_quota" numeric(6, 2);

-- 3. car_trip_extra_costs — structured "other costs" per truck trip ---------
CREATE TABLE IF NOT EXISTS "car_trip_extra_costs" (
  "tec_id"         char(36) PRIMARY KEY NOT NULL,
  "ent_id"         char(36) NOT NULL,
  "trp_id"         char(36) NOT NULL,
  "tec_name"       varchar(255) NOT NULL,
  "tec_amount"     numeric(14, 2) NOT NULL,
  "tec_created_at" timestamptz NOT NULL DEFAULT now()
);

DO $$ BEGIN
  ALTER TABLE "car_trip_extra_costs"
    ADD CONSTRAINT "car_trip_extra_costs_trp_id_car_trips_trp_id_fk"
    FOREIGN KEY ("trp_id") REFERENCES "public"."car_trips"("trp_id")
    ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

CREATE INDEX IF NOT EXISTS "idx_car_trip_extra_costs_trip"
  ON "car_trip_extra_costs" USING btree ("trp_id");

CREATE INDEX IF NOT EXISTS "idx_car_trip_extra_costs_ent_trip"
  ON "car_trip_extra_costs" USING btree ("ent_id", "trp_id");

-- 4. car_truck_fixed_costs — monthly fixed costs per truck ------------------
CREATE TABLE IF NOT EXISTS "car_truck_fixed_costs" (
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

DO $$ BEGIN
  ALTER TABLE "car_truck_fixed_costs"
    ADD CONSTRAINT "car_truck_fixed_costs_cvh_id_car_vehicles_cvh_id_fk"
    FOREIGN KEY ("cvh_id") REFERENCES "public"."car_vehicles"("cvh_id")
    ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "uniq_car_truck_fixed_costs_ent_vehicle_month"
  ON "car_truck_fixed_costs" USING btree ("ent_id", "cvh_id", "tfc_month");

CREATE INDEX IF NOT EXISTS "idx_car_truck_fixed_costs_ent_month"
  ON "car_truck_fixed_costs" USING btree ("ent_id", "tfc_month");

-- 5. car_imports — Excel import history ------------------------------------
DO $$ BEGIN
  CREATE TYPE "car_import_status" AS ENUM ('PENDING', 'COMPLETED', 'FAILED');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS "car_imports" (
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

DO $$ BEGIN
  ALTER TABLE "car_imports"
    ADD CONSTRAINT "car_imports_imp_vehicle_id_car_vehicles_cvh_id_fk"
    FOREIGN KEY ("imp_vehicle_id") REFERENCES "public"."car_vehicles"("cvh_id")
    ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "car_imports"
    ADD CONSTRAINT "car_imports_imp_created_by_car_users_usr_id_fk"
    FOREIGN KEY ("imp_created_by") REFERENCES "public"."car_users"("usr_id")
    ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

CREATE INDEX IF NOT EXISTS "idx_car_imports_ent_created"
  ON "car_imports" USING btree ("ent_id", "imp_created_at");

-- 6. Backfill: existing trips are car dispatch -----------------------------
--    Column default already sets 'DISPATCH'; this is belt-and-suspenders for
--    any row created before the default took effect. Idempotent.
UPDATE "car_trips" SET "trp_kind" = 'DISPATCH' WHERE "trp_kind" IS NULL;
INSERT INTO drizzle.__drizzle_migrations (hash, created_at)
  SELECT 'manual-0012_fleet_truck', 1783000000001
  WHERE NOT EXISTS (SELECT 1 FROM drizzle.__drizzle_migrations WHERE created_at=1783000000001);


-- ============================== 0013_truck_month_close ==============================
-- 0013_truck_month_close.sql — Pha 2 (REQ-20260623)
-- G1 financial period lock ("Chốt sổ tháng") + P3 monthly fuel-invoice ledger.
-- Manual migration (staging/prod do not run db:push). Idempotent.
-- Reuses the car_vehicle_type enum created in 0012.

-- ── Month close (financial period lock per dept × month) ──────────────────────
CREATE TABLE IF NOT EXISTS car_truck_month_close (
  tmc_id            CHAR(36) PRIMARY KEY,
  ent_id            CHAR(36) NOT NULL,
  tmc_vehicle_type  car_vehicle_type NOT NULL DEFAULT 'TRUCK',
  tmc_month         VARCHAR(7) NOT NULL,
  tmc_closed_by     CHAR(36),
  tmc_closed_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  tmc_reopen_reason TEXT,
  tmc_reopened_by   CHAR(36),
  tmc_reopened_at   TIMESTAMPTZ,
  tmc_deleted_at    TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS uniq_car_truck_month_close_ent_type_month
  ON car_truck_month_close (ent_id, tmc_vehicle_type, tmc_month)
  WHERE tmc_deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_car_truck_month_close_ent_type
  ON car_truck_month_close (ent_id, tmc_vehicle_type);

-- ── Monthly fuel-invoice ledger (avg price + consumption analytics) ───────────
CREATE TABLE IF NOT EXISTS car_truck_fuel_invoices (
  tfi_id            CHAR(36) PRIMARY KEY,
  ent_id            CHAR(36) NOT NULL,
  tfi_vehicle_type  car_vehicle_type NOT NULL DEFAULT 'TRUCK',
  tfi_month         VARCHAR(7) NOT NULL,
  tfi_date          DATE NOT NULL,
  tfi_station       VARCHAR(120),
  tfi_liters        DECIMAL(10,2) NOT NULL DEFAULT 0,
  tfi_price         DECIMAL(14,2) NOT NULL DEFAULT 0,
  tfi_created_by    CHAR(36),
  tfi_created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  tfi_deleted_at    TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_car_truck_fuel_invoices_ent_type_month
  ON car_truck_fuel_invoices (ent_id, tfi_vehicle_type, tfi_month);
INSERT INTO drizzle.__drizzle_migrations (hash, created_at)
  SELECT 'manual-0013_truck_month_close', 1783000000002
  WHERE NOT EXISTS (SELECT 1 FROM drizzle.__drizzle_migrations WHERE created_at=1783000000002);


-- ============================== 0014_truck_multispot ==============================
-- 0014_truck_multispot.sql
-- Multi-stop route + driver self-create (REQ-20260623).
-- Apply manually on staging and production (not tracked by drizzle-kit journal).
-- Idempotent: IF NOT EXISTS / DO $$ EXCEPTION guards.

BEGIN;

-- 1. Stop type enum
DO $$ BEGIN
  CREATE TYPE car_stop_type AS ENUM ('ORIGIN', 'PICKUP', 'DELIVERY', 'WAYPOINT', 'RETURN');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 2. Add structured columns to car_trip_stopovers
--    Existing rows default to WAYPOINT (safe — they were untyped generic stops).
ALTER TABLE car_trip_stopovers
  ADD COLUMN IF NOT EXISTS tst_type car_stop_type NOT NULL DEFAULT 'WAYPOINT',
  ADD COLUMN IF NOT EXISTS tst_km INTEGER,
  ADD COLUMN IF NOT EXISTS tst_arrived_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS tst_notes TEXT;

-- 3. Add depot address to car_tenant_settings (nullable — not every tenant sets one)
ALTER TABLE car_tenant_settings
  ADD COLUMN IF NOT EXISTS tns_depot_address TEXT;

-- 4. Index for stopover type queries (list all stops of a type for a trip)
CREATE INDEX IF NOT EXISTS idx_car_trip_stopovers_type
  ON car_trip_stopovers (tst_trip_id, tst_type);

COMMIT;
INSERT INTO drizzle.__drizzle_migrations (hash, created_at)
  SELECT 'manual-0014_truck_multispot', 1783000000003
  WHERE NOT EXISTS (SELECT 1 FROM drizzle.__drizzle_migrations WHERE created_at=1783000000003);


-- ============================== 0015_driver_fixed_salary ==============================
-- 0015_driver_fixed_salary.sql
-- Per-driver fixed (monthly) salary for TRUCK drivers — feeds a new "driver
-- salary" line in the monthly truck P&L (REQ-20260624). Nullable: only truck
-- drivers set it; NULL is treated as 0. Apply manually on every branch.
-- Idempotent.

ALTER TABLE car_drivers
  ADD COLUMN IF NOT EXISTS drv_fixed_salary DECIMAL(14,2);
INSERT INTO drizzle.__drizzle_migrations (hash, created_at)
  SELECT 'manual-0015_driver_fixed_salary', 1783000000004
  WHERE NOT EXISTS (SELECT 1 FROM drizzle.__drizzle_migrations WHERE created_at=1783000000004);


-- ============================== 0016_truck_monthend_reports ==============================
-- 0016_truck_monthend_reports.sql
-- REQ-20260629 — Truck month-end finance model + Reports module.
-- (1) Snapshot the monthly average fuel price + consumption rate onto each
--     month-close row, so a trip's official fuel cost (km × consumption ×
--     avg price, per customer SRS netcost.txt) is deterministic & recomputable
--     without writing per-trip. NULL on rows closed before this migration →
--     P&L falls back to the trip's own liters × price (old numbers preserved).
-- (2) car_truck_reports: metadata for generated monthly reports (file in S3).
-- (3) car_users.usr_truck_reports_seen_at: per-user "last viewed reports" mark
--     for the "Mới" (new) badge.
-- Apply manually on every branch. Idempotent.

-- (1) month-close snapshot --------------------------------------------------
ALTER TABLE car_truck_month_close ADD COLUMN IF NOT EXISTS tmc_avg_price    DECIMAL(14,2);
ALTER TABLE car_truck_month_close ADD COLUMN IF NOT EXISTS tmc_consumption  DECIMAL(10,6);
ALTER TABLE car_truck_month_close ADD COLUMN IF NOT EXISTS tmc_total_liters DECIMAL(12,2);
ALTER TABLE car_truck_month_close ADD COLUMN IF NOT EXISTS tmc_total_km     DECIMAL(12,2);

-- (2) generated reports -----------------------------------------------------
CREATE TABLE IF NOT EXISTS car_truck_reports (
  trr_id           CHAR(36)     PRIMARY KEY,
  ent_id           CHAR(36)     NOT NULL,
  trr_vehicle_type VARCHAR(8)   NOT NULL DEFAULT 'TRUCK',
  trr_month        VARCHAR(7)   NOT NULL,            -- 'YYYY-MM'
  trr_type         VARCHAR(16)  NOT NULL,            -- PNL | TRIP_LOG | VEHICLE
  trr_format       VARCHAR(8)   NOT NULL DEFAULT 'EXCEL',
  trr_s3_key       VARCHAR(512) NOT NULL,
  trr_name         VARCHAR(200) NOT NULL,
  trr_created_by   CHAR(36),
  trr_created_at   TIMESTAMPTZ  NOT NULL DEFAULT now(),
  trr_deleted_at   TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_car_truck_reports_ent_month
  ON car_truck_reports (ent_id, trr_month);

-- (3) per-user "reports seen" mark for the new-badge -------------------------
ALTER TABLE car_users ADD COLUMN IF NOT EXISTS usr_truck_reports_seen_at TIMESTAMPTZ;
INSERT INTO drizzle.__drizzle_migrations (hash, created_at)
  SELECT 'manual-0016_truck_monthend_reports', 1783000000005
  WHERE NOT EXISTS (SELECT 1 FROM drizzle.__drizzle_migrations WHERE created_at=1783000000005);


-- ============================== 0017_vehicle_code ==============================
-- 0017_vehicle_code.sql
-- REQ-20260629 (Phương tiện screen, design alignment): add a free-text vehicle
-- code / registration ("Mã xe") column to the fleet table. Nullable. "Ghi chú"
-- reuses the existing cvh_notes column. Apply manually on every branch. Idempotent.

ALTER TABLE car_vehicles ADD COLUMN IF NOT EXISTS cvh_code VARCHAR(120);
INSERT INTO drizzle.__drizzle_migrations (hash, created_at)
  SELECT 'manual-0017_vehicle_code', 1783000000006
  WHERE NOT EXISTS (SELECT 1 FROM drizzle.__drizzle_migrations WHERE created_at=1783000000006);


-- ============================== 0018_truck_region ==============================
-- 0018_truck_region.sql
-- REQ-20260630 — Operating region ("Khu vực") for the TRUCK fleet.
-- Region is a code (HCM / DONG_NAI / BAIKSAN, see TRUCK_REGIONS). Stored on the
-- vehicle, on fuel invoices, and on the month-close row so finance can be
-- reconciled + closed per (month × region). A trip inherits its vehicle's region.
-- Apply manually on every branch. Idempotent.

-- (1) Vehicle region -------------------------------------------------------
ALTER TABLE car_vehicles ADD COLUMN IF NOT EXISTS cvh_region VARCHAR(40);
CREATE INDEX IF NOT EXISTS idx_car_vehicles_ent_type_region
  ON car_vehicles (ent_id, cvh_type, cvh_region);

-- (2) Fuel-invoice region (region-scoped fuel reconciliation) --------------
ALTER TABLE car_truck_fuel_invoices ADD COLUMN IF NOT EXISTS tfi_region VARCHAR(40);
CREATE INDEX IF NOT EXISTS idx_car_truck_fuel_invoices_ent_region_month
  ON car_truck_fuel_invoices (ent_id, tfi_region, tfi_month);

-- (3) Month-close region (close per month × region) ------------------------
ALTER TABLE car_truck_month_close ADD COLUMN IF NOT EXISTS tmc_region VARCHAR(40);
-- Replace the (ent, type, month) live-uniqueness with (ent, type, month, region).
-- COALESCE(tmc_region,'') keeps a NULL-region (legacy whole-fleet) close unique
-- per month while allowing one live close per region going forward.
DROP INDEX IF EXISTS uniq_car_truck_month_close_ent_type_month;
CREATE UNIQUE INDEX IF NOT EXISTS uniq_car_truck_month_close_ent_type_month_region
  ON car_truck_month_close (ent_id, tmc_vehicle_type, tmc_month, COALESCE(tmc_region, ''))
  WHERE tmc_deleted_at IS NULL;
INSERT INTO drizzle.__drizzle_migrations (hash, created_at)
  SELECT 'manual-0018_truck_region', 1783000000007
  WHERE NOT EXISTS (SELECT 1 FROM drizzle.__drizzle_migrations WHERE created_at=1783000000007);


-- ============================== 0019_truck_report_region ==============================
-- 0019_truck_report_region.sql
-- Multi-region truck reports. A generated monthly report is now scoped to ONE
-- operating region (HCM / DONG_NAI / BAIKSAN, see TRUCK_REGIONS); the "Lập báo
-- cáo" wizard lets a manager multi-select regions and fan out one report per
-- region. `trr_region` records that scope so the month picker can show
-- "Đã xuất X/3 khu vực" (how many distinct regions have been exported).
-- NULL = legacy whole-fleet report (pre-region rows). Apply manually on every
-- branch. Idempotent.

-- (1) Report region scope --------------------------------------------------
ALTER TABLE car_truck_reports ADD COLUMN IF NOT EXISTS trr_region VARCHAR(40);
CREATE INDEX IF NOT EXISTS idx_car_truck_reports_ent_month_region
  ON car_truck_reports (ent_id, trr_month, trr_region);

-- (2) Backfill region from the S3 key of existing rows ---------------------
-- Key shape: truck-reports/{ent}/{month}/{TYPE}-{REGION|all}-{uuid}.xlsx
-- Capture the uppercase region token between the type and the (lowercase-hex)
-- uuid. 'all' is lowercase so it won't match → those rows stay NULL.
UPDATE car_truck_reports
   SET trr_region = substring(trr_s3_key FROM '(?:PNL|TRIP_LOG|VEHICLE)-([A-Z_]+)-')
 WHERE trr_region IS NULL;
INSERT INTO drizzle.__drizzle_migrations (hash, created_at)
  SELECT 'manual-0019_truck_report_region', 1783000000008
  WHERE NOT EXISTS (SELECT 1 FROM drizzle.__drizzle_migrations WHERE created_at=1783000000008);


-- ============================== 0020_vehicle_default_driver_depreciation ==============================
-- 0020_vehicle_default_driver_depreciation.sql
-- QA feedback 2026-07: the "Thêm phương tiện" form gains a default driver + a
-- monthly depreciation. "1 xe ↔ 1 tài xế": the default driver's fixed salary and
-- the vehicle depreciation feed the per-vehicle monthly P&L as fixed costs when
-- no manual car_truck_fixed_costs row exists for that (vehicle, month).
-- Both nullable (cars + existing trucks unaffected). Apply manually on every
-- branch. Idempotent.

ALTER TABLE car_vehicles ADD COLUMN IF NOT EXISTS cvh_default_driver_id CHAR(36);
ALTER TABLE car_vehicles ADD COLUMN IF NOT EXISTS cvh_depreciation DECIMAL(14, 2);
INSERT INTO drizzle.__drizzle_migrations (hash, created_at)
  SELECT 'manual-0020_vehicle_default_driver_depreciation', 1783000000009
  WHERE NOT EXISTS (SELECT 1 FROM drizzle.__drizzle_migrations WHERE created_at=1783000000009);


-- ============================== 0021_report_fuel_snapshot ==============================
-- 0021_report_fuel_snapshot.sql
-- "Lập báo cáo" now RECOMPUTES the month-end fuel reconciliation (the old chốt
-- sổ formulas: avg invoice price + consumption L/km) on every generation and
-- freezes the result ONTO the report row. The latest live report per
-- (ent, month, region) is the official fuel snapshot; car_truck_month_close
-- remains read-only legacy fallback. Precision mirrors car_truck_month_close.
-- Apply manually on every branch. Idempotent.

ALTER TABLE car_truck_reports ADD COLUMN IF NOT EXISTS trr_avg_price     NUMERIC(14,2);
ALTER TABLE car_truck_reports ADD COLUMN IF NOT EXISTS trr_consumption   NUMERIC(10,6);
ALTER TABLE car_truck_reports ADD COLUMN IF NOT EXISTS trr_total_liters  NUMERIC(12,2);
ALTER TABLE car_truck_reports ADD COLUMN IF NOT EXISTS trr_total_km      NUMERIC(12,2);
INSERT INTO drizzle.__drizzle_migrations (hash, created_at)
  SELECT 'manual-0021_report_fuel_snapshot', 1783000000010
  WHERE NOT EXISTS (SELECT 1 FROM drizzle.__drizzle_migrations WHERE created_at=1783000000010);


-- ============================== 0022_trip_cost_attachments ==============================
-- 0022_trip_cost_attachments.sql
-- REQ-20260709 — Receipt/invoice/document uploads for truck trip-log costs.
-- Image + PDF attached to a trip's FUEL / TOLL / EXTRA costs. Rows hold the S3
-- key only (never file bytes). Trip-scoped + tagged by cost kind rather than
-- FK'd to individual car_trip_extra_costs rows (those are delete+reinserted on
-- every edit). Soft delete via tca_deleted_at keeps rows + S3 objects for audit.
-- Apply manually on every branch. Idempotent.

CREATE TABLE IF NOT EXISTS car_trip_cost_attachments (
  tca_id          CHAR(36) PRIMARY KEY,
  ent_id          CHAR(36) NOT NULL,
  trp_id          CHAR(36) NOT NULL REFERENCES car_trips (trp_id),
  tca_cost_kind   VARCHAR(10) NOT NULL,               -- FUEL | TOLL | EXTRA
  tca_s3_key      TEXT NOT NULL,
  tca_mime        VARCHAR(64) NOT NULL,
  tca_size_bytes  BIGINT NOT NULL,
  tca_uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  tca_deleted_at  TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_car_trip_cost_attachments_trip
  ON car_trip_cost_attachments (trp_id);

CREATE INDEX IF NOT EXISTS idx_car_trip_cost_attachments_ent_trip
  ON car_trip_cost_attachments (ent_id, trp_id);
INSERT INTO drizzle.__drizzle_migrations (hash, created_at)
  SELECT 'manual-0022_trip_cost_attachments', 1783000000011
  WHERE NOT EXISTS (SELECT 1 FROM drizzle.__drizzle_migrations WHERE created_at=1783000000011);
