-- 0020_vehicle_default_driver_depreciation.sql
-- QA feedback 2026-07: the "Thêm phương tiện" form gains a default driver + a
-- monthly depreciation. "1 xe ↔ 1 tài xế": the default driver's fixed salary and
-- the vehicle depreciation feed the per-vehicle monthly P&L as fixed costs when
-- no manual car_truck_fixed_costs row exists for that (vehicle, month).
-- Both nullable (cars + existing trucks unaffected). Apply manually on every
-- branch. Idempotent.

ALTER TABLE car_vehicles ADD COLUMN IF NOT EXISTS cvh_default_driver_id CHAR(36);
ALTER TABLE car_vehicles ADD COLUMN IF NOT EXISTS cvh_depreciation DECIMAL(14, 2);
