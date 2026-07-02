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
