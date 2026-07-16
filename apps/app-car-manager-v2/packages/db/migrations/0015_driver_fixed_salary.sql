-- 0015_driver_fixed_salary.sql
-- Per-driver fixed (monthly) salary for TRUCK drivers — feeds a new "driver
-- salary" line in the monthly truck P&L (REQ-20260624). Nullable: only truck
-- drivers set it; NULL is treated as 0. Apply manually on every branch.
-- Idempotent.

ALTER TABLE car_drivers
  ADD COLUMN IF NOT EXISTS drv_fixed_salary DECIMAL(14,2);
