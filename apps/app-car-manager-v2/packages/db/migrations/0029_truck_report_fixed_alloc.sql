-- 0029_truck_report_fixed_alloc.sql
-- REQ-20260821: per-trip fixed-cost allocation (lương/khấu hao ÷ số chuyến) must
-- only be (re)computed when a report is generated — trip CRUD after a report
-- must not shift the numbers that report already showed.
--
-- Each generated report now freezes its allocation basis per vehicle:
--   [{ vehicleId, salary, depreciation, tripCount }]
-- Readers resolve a trip's share from the latest report covering it (same
-- coverage rule as trr_vehicle_fuel: trip changed after the report → not
-- covered) and only fall back to the live computation when no report does.
--
-- NULL (every existing row) = report generated before this column existed →
-- readers keep the live computation for it, so historical months look exactly
-- as they did. Additive/nullable, no backfill. Apply manually on every branch.
-- Idempotent.

ALTER TABLE car_truck_reports ADD COLUMN IF NOT EXISTS trr_fixed_alloc JSONB;
