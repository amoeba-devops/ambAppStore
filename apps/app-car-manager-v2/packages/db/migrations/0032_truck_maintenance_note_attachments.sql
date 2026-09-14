-- 0032_truck_maintenance_note_attachments.sql
-- REQ-20260914: bản ghi bảo trì có thêm 2 trường
--   1. tmn_note        — chú thích dạng text (nội dung sửa chữa, garage, bảo hành…)
--   2. hoá đơn bảo trì — nhiều tệp đính kèm (ảnh / PDF), bảng riêng
--      car_truck_maintenance_attachments, CHỈ lưu S3 key (không lưu bytes,
--      CLAUDE.md §8); xoá tệp = soft delete để giữ vết kiểm toán.
--
-- Cùng khuôn với car_trip_cost_attachments (REQ-20260709) nhưng KHÔNG có cột
-- cost_kind: một lần bảo trì chỉ có một loại chi phí nên FK thẳng vào tmn_id.
--
-- Không đụng công thức tiền: chú thích + đính kèm thuần mô tả, tmn_cost giữ
-- nguyên vai trò trong computeTruckPnl (phí cố định tháng, không phân bổ chuyến).
--
-- Migration THỦ CÔNG (không nằm trong drizzle journal) — idempotent, chạy lại
-- ra 0 thay đổi. Nhớ probe trong scripts/check-manual-migrations.mjs.

ALTER TABLE car_truck_maintenances
  ADD COLUMN IF NOT EXISTS tmn_note TEXT;

CREATE TABLE IF NOT EXISTS car_truck_maintenance_attachments (
  tma_id           CHAR(36) PRIMARY KEY,
  ent_id           CHAR(36) NOT NULL,
  tmn_id           CHAR(36) NOT NULL REFERENCES car_truck_maintenances(tmn_id),
  tma_s3_key       TEXT NOT NULL,
  tma_mime         VARCHAR(64) NOT NULL,
  tma_size_bytes   BIGINT NOT NULL,
  tma_uploaded_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  tma_deleted_at   TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_car_truck_maintenance_attachments_tmn
  ON car_truck_maintenance_attachments (tmn_id);

CREATE INDEX IF NOT EXISTS idx_car_truck_maintenance_attachments_ent_tmn
  ON car_truck_maintenance_attachments (ent_id, tmn_id);
