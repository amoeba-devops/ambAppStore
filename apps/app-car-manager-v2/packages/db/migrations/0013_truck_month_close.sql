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
