-- Migration: Convention Violation Fixes
-- Date: 2026-04-03
-- Description: Add missing columns for convention compliance

-- 1. Add ent_id to car_vehicle_managers (multi-tenancy)
ALTER TABLE car_vehicle_managers ADD COLUMN ent_id CHAR(36) NOT NULL AFTER cvm_id;
CREATE INDEX idx_cvm_ent ON car_vehicle_managers(ent_id);

-- 2. Add soft delete to car_import_logs
ALTER TABLE car_import_logs ADD COLUMN cil_deleted_at DATETIME NULL DEFAULT NULL;

-- 3. Add updated_at and soft delete to car_trip_log_fees
ALTER TABLE car_trip_log_fees
  ADD COLUMN ctlf_updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  ADD COLUMN ctlf_deleted_at DATETIME NULL DEFAULT NULL;
