-- 0017_vehicle_code.sql
-- REQ-20260629 (Phương tiện screen, design alignment): add a free-text vehicle
-- code / registration ("Mã xe") column to the fleet table. Nullable. "Ghi chú"
-- reuses the existing cvh_notes column. Apply manually on every branch. Idempotent.

ALTER TABLE car_vehicles ADD COLUMN IF NOT EXISTS cvh_code VARCHAR(120);
