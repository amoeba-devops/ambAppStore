-- 0025_truck_cost_rate_history.sql
-- QA 2026-07-30: chi phí cố định phải theo LỊCH SỬ TỪNG THÁNG.
--
-- Trước: chi phí cố định của một tháng đọc giá trị HIỆN HÀNH trên bản ghi
-- (car_vehicles.cvh_depreciation, car_drivers.drv_fixed_salary) → tháng nào
-- cũng lấy số hôm nay, kể cả tháng trước khi mua xe; tăng lương tháng 7 là
-- viết lại cả tháng 6.
--
-- Sau: mỗi dòng ở đây nói "từ tháng này trở đi, mức này áp dụng". Tra cho tháng
-- M = dòng mới nhất có tcr_month <= M; không có dòng nào → 0. Bảng
-- car_truck_fixed_costs (nhập tay theo xe/tháng) vẫn đè lên tất cả.
--
-- Idempotent. Áp thủ công trên mọi nhánh (local, staging, prod).

CREATE TABLE IF NOT EXISTS car_truck_cost_rates (
  tcr_id         CHAR(36) PRIMARY KEY,
  ent_id         CHAR(36) NOT NULL,
  tcr_scope      VARCHAR(10) NOT NULL,   -- VEHICLE | DRIVER
  tcr_ref_id     CHAR(36) NOT NULL,      -- cvh_id | drv_id
  tcr_kind       VARCHAR(20) NOT NULL,   -- DEPRECIATION | SALARY
  tcr_month      VARCHAR(7) NOT NULL,    -- hiệu lực TỪ tháng này (gồm cả tháng này)
  tcr_amount     DECIMAL(14,2) NOT NULL DEFAULT 0,
  tcr_note       TEXT,
  tcr_created_by CHAR(36),
  tcr_created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  tcr_deleted_at TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_car_truck_cost_rates_live
  ON car_truck_cost_rates (ent_id, tcr_scope, tcr_ref_id, tcr_kind, tcr_month)
  WHERE tcr_deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_car_truck_cost_rates_lookup
  ON car_truck_cost_rates (ent_id, tcr_scope, tcr_ref_id, tcr_kind, tcr_month);

-- ---------------------------------------------------------------------------
-- Backfill: dựng mốc hiệu lực đầu tiên từ giá trị hiện hành.
--
-- Tháng hiệu lực = tháng NHỎ HƠN giữa (tháng tạo bản ghi) và (tháng có chuyến
-- hoàn thành sớm nhất của xe / tài xế đó). Lấy min để các tháng ĐÃ có chuyến —
-- và có thể đã lập báo cáo — giữ nguyên con số cũ; chỉ những tháng trước đó
-- (xe chưa tồn tại, chưa chạy gì) mới về 0.
-- ---------------------------------------------------------------------------

INSERT INTO car_truck_cost_rates (tcr_id, ent_id, tcr_scope, tcr_ref_id, tcr_kind, tcr_month, tcr_amount, tcr_note)
SELECT gen_random_uuid()::text, v.ent_id, 'VEHICLE', v.cvh_id, 'DEPRECIATION',
       LEAST(
         to_char(v.cvh_created_at, 'YYYY-MM'),
         COALESCE((SELECT to_char(min(t.trp_scheduled_at), 'YYYY-MM') FROM car_trips t
                    WHERE t.trp_vehicle_id = v.cvh_id AND t.trp_kind = 'LOG'
                      AND t.trp_status = 'COMPLETED' AND t.trp_deleted_at IS NULL),
                  to_char(v.cvh_created_at, 'YYYY-MM'))
       ),
       v.cvh_depreciation,
       'backfill 0025 từ cvh_depreciation'
FROM car_vehicles v
WHERE v.cvh_type = 'TRUCK'
  AND v.cvh_depreciation IS NOT NULL
  AND v.cvh_depreciation <> 0
ON CONFLICT DO NOTHING;

INSERT INTO car_truck_cost_rates (tcr_id, ent_id, tcr_scope, tcr_ref_id, tcr_kind, tcr_month, tcr_amount, tcr_note)
SELECT gen_random_uuid()::text, d.ent_id, 'DRIVER', d.drv_id, 'SALARY',
       LEAST(
         to_char(d.drv_created_at, 'YYYY-MM'),
         COALESCE((SELECT to_char(min(t.trp_scheduled_at), 'YYYY-MM') FROM car_trips t
                    WHERE t.trp_driver_id = d.drv_id AND t.trp_kind = 'LOG'
                      AND t.trp_status = 'COMPLETED' AND t.trp_deleted_at IS NULL),
                  to_char(d.drv_created_at, 'YYYY-MM'))
       ),
       d.drv_fixed_salary,
       'backfill 0025 từ drv_fixed_salary'
FROM car_drivers d
WHERE d.drv_fixed_salary IS NOT NULL
  AND d.drv_fixed_salary <> 0
ON CONFLICT DO NOTHING;
