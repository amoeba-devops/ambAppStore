-- 0033_attachment_file_name.sql
-- REQ-20260915: một component đính kèm dùng chung cho toàn hệ thống.
--
-- Ba bảng đính kèm trước đây chỉ lưu s3_key / mime / size — KHÔNG có tên tệp
-- gốc, nên giao diện không thể hiện "tên file đã upload". Tên chỉ còn nằm lẫn
-- trong s3_key dạng `{uuid}-{tên đã làm sạch}` (bị cắt 100 ký tự, ký tự đặc
-- biệt thay bằng _).
--
-- Migration này thêm cột tên tệp cho cả ba bảng và BACKFILL từ s3_key để dữ
-- liệu cũ cũng hiện được tên thay vì chuỗi UUID.
--
-- Migration THỦ CÔNG (không nằm trong drizzle journal) — idempotent.
-- Nhớ probe trong scripts/check-manual-migrations.mjs.

ALTER TABLE car_trip_cost_attachments
  ADD COLUMN IF NOT EXISTS tca_file_name VARCHAR(255);

ALTER TABLE car_truck_maintenance_attachments
  ADD COLUMN IF NOT EXISTS tma_file_name VARCHAR(255);

ALTER TABLE car_expense_attachments
  ADD COLUMN IF NOT EXISTS eat_file_name VARCHAR(255);

-- Backfill: lấy phần sau `{uuid}-` của segment cuối trong s3_key.
-- regexp bám đúng 36 ký tự UUID + dấu gạch nối, nên khoá không khớp mẫu sẽ
-- để NULL (giao diện tự fallback) thay vì lưu rác.
UPDATE car_trip_cost_attachments
   SET tca_file_name = substring(
         regexp_replace(tca_s3_key, '^.*/', ''),
         '^[0-9a-fA-F-]{36}-(.+)$'
       )
 WHERE tca_file_name IS NULL;

UPDATE car_truck_maintenance_attachments
   SET tma_file_name = substring(
         regexp_replace(tma_s3_key, '^.*/', ''),
         '^[0-9a-fA-F-]{36}-(.+)$'
       )
 WHERE tma_file_name IS NULL;

UPDATE car_expense_attachments
   SET eat_file_name = substring(
         regexp_replace(eat_s3_key, '^.*/', ''),
         '^[0-9a-fA-F-]{36}-(.+)$'
       )
 WHERE eat_file_name IS NULL;
