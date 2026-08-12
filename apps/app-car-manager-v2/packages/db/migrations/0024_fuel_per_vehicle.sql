-- 0024_fuel_per_vehicle.sql
-- REQ-20260726: per-trip fuel is allocated from the VEHICLE's own monthly fuel
-- spend (not the region pool), weighted by each trip's km:
--   phí chuyến = tiền xăng tháng của xe × (km chuyến ÷ tổng km tháng của xe)
--
-- 1) Fuel invoices gain the vehicle they were filled for. NULL = legacy
--    region-level invoice (kept working through the old region snapshot).
-- 2) Reports freeze the per-vehicle reconciliation as JSON so the numbers stop
--    drifting once "Lập báo cáo" runs — same freeze semantics as the existing
--    region-level trr_avg_price/trr_consumption columns, which stay for
--    backwards compatibility with reports generated before this change.
-- Both nullable/additive. Apply manually on every branch. Idempotent.

ALTER TABLE car_truck_fuel_invoices ADD COLUMN IF NOT EXISTS tfi_vehicle_id CHAR(36);

CREATE INDEX IF NOT EXISTS idx_car_truck_fuel_invoices_ent_month_vehicle
  ON car_truck_fuel_invoices (ent_id, tfi_month, tfi_vehicle_id);

ALTER TABLE car_truck_reports ADD COLUMN IF NOT EXISTS trr_vehicle_fuel JSONB;
