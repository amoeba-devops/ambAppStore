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
