-- 0034_truck_trip_fixed_cost_types.sql
-- REQ-20260916: 4 loại chi phí cố định mới cho chuyến truck (vệ sinh phương tiện,
-- sửa chữa, cầu phà, bốc dỡ hàng hóa) — cùng tầng với trp_toll_fee hiện có.
--
-- Migration THỦ CÔNG (không nằm trong drizzle journal) — idempotent.
-- Nhớ probe trong scripts/check-manual-migrations.mjs.

ALTER TABLE car_trips
  ADD COLUMN IF NOT EXISTS trp_cleaning_fee DECIMAL(14,2),
  ADD COLUMN IF NOT EXISTS trp_repair_fee DECIMAL(14,2),
  ADD COLUMN IF NOT EXISTS trp_ferry_fee DECIMAL(14,2),
  ADD COLUMN IF NOT EXISTS trp_loading_fee DECIMAL(14,2);
