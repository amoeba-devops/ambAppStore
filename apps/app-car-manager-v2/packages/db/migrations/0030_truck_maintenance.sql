-- 0030_truck_maintenance.sql
-- REQ-20260904: bản ghi bảo trì xe tải (menu "Bảo trì" workspace TRUCK).
--
-- Mỗi dòng = 1 lần bảo trì của 1 xe: khoảng ngày [tmn_start_date, tmn_end_date]
-- (bao gồm 2 đầu, đơn vị NGÀY) + chi phí. Hai nơi dùng, đều ở cấp THÁNG:
--   1. P&L: Σ tmn_cost theo tmn_month là thành phần thứ 3 của chi phí cố định
--      (computeTruckPnl: fixedCost = lương + khấu hao + bảo trì). KHÔNG phân bổ
--      theo chuyến (trr_fixed_alloc / loadTruckFixedAllocation giữ nguyên) và
--      KHÔNG về 0 khi tháng không có chuyến.
--   2. Điều xe: trong khoảng ngày còn hiệu lực, không tạo/gán/sửa/import chuyến
--      LOG cho xe đó (CAR-E1013); ngược lại không ghi bảo trì lên ngày xe đã có
--      chuyến (CAR-E1014).
-- tmn_month = to_char(tmn_start_date,'YYYY-MM'): 100% chi phí hạch toán vào
-- tháng BẮT ĐẦU, không chia theo ngày sang tháng khác.
--
-- Idempotent. Áp thủ công trên mọi nhánh (local, staging, prod) TRƯỚC khi deploy
-- build có đọc bảng này (dashboard/P&L SELECT bảng mới → 500 nếu thiếu).

CREATE TABLE IF NOT EXISTS car_truck_maintenances (
  tmn_id          CHAR(36) PRIMARY KEY,
  ent_id          CHAR(36) NOT NULL,
  cvh_id          CHAR(36) NOT NULL REFERENCES car_vehicles(cvh_id),
  tmn_start_date  DATE NOT NULL,
  tmn_end_date    DATE NOT NULL,
  tmn_month       VARCHAR(7) NOT NULL,            -- to_char(tmn_start_date,'YYYY-MM')
  tmn_cost        DECIMAL(14,2) NOT NULL DEFAULT 0,
  tmn_created_by  CHAR(36),
  tmn_created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  tmn_updated_by  CHAR(36),
  tmn_updated_at  TIMESTAMPTZ,
  tmn_deleted_at  TIMESTAMPTZ,
  CONSTRAINT chk_car_truck_maintenances_range CHECK (tmn_end_date >= tmn_start_date)
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_car_truck_maintenances_ent_vehicle_range
  ON car_truck_maintenances (ent_id, cvh_id, tmn_start_date, tmn_end_date)
  WHERE tmn_deleted_at IS NULL;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_car_truck_maintenances_ent_month
  ON car_truck_maintenances (ent_id, tmn_month);
