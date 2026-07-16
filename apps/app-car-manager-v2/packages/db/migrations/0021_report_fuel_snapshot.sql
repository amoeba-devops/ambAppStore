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
