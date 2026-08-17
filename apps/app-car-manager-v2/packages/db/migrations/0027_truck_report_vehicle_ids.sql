-- 0027_truck_report_vehicle_ids.sql
-- REQ-20260817: allow a chốt-sổ report to freeze numbers for a SUBSET of a
-- region's trucks instead of always the whole region.
--
-- NULL (every existing row, and any new report that doesn't narrow by vehicle)
-- keeps its established meaning: "covers every truck in trr_region". A
-- non-null array narrows the freeze to exactly those vehicle ids — the fold in
-- loadTruckRegionSnapshots (truck-fuel-snapshot.ts) reads this to decide which
-- vehicles a given report is allowed to overwrite.
-- Additive/nullable, no backfill needed. Apply manually on every branch. Idempotent.

ALTER TABLE car_truck_reports ADD COLUMN IF NOT EXISTS trr_vehicle_ids JSONB;
