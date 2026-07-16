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
