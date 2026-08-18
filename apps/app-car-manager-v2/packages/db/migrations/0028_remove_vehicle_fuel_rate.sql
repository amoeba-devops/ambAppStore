-- 0028_remove_vehicle_fuel_rate.sql
-- Drop cvh_fuel_quota / cvh_fuel_price (REQ-20260724, migration 0012 + 0023).
-- BUG-260730 (2026-07-30) removed the "định mức × giá xe" branch from every
-- cost path — trip fuel cost is now always km × (vehicle's real monthly fuel
-- spend ÷ its monthly km). Since then these 2 columns were reference-only and
-- unread by any code; the vehicle form's plain "Định mức"/"Giá xăng" labels
-- with no such note made managers think they still drove cost, so removing
-- rather than just annotating. Apply manually on every branch. Idempotent.

ALTER TABLE car_vehicles DROP COLUMN IF EXISTS cvh_fuel_quota;
ALTER TABLE car_vehicles DROP COLUMN IF EXISTS cvh_fuel_price;
