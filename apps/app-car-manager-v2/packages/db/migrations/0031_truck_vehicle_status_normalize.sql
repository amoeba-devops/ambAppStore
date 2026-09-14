-- 0031_truck_vehicle_status_normalize.sql
-- REQ-20260907: trạng thái xe tải.
--
-- Xe tải chỉ LƯU hai giá trị người dùng chọn được: AVAILABLE ("Sẵn sàng") và
-- RETIRED ("Ngừng sử dụng"). MAINTENANCE ("Bảo trì") là trạng thái DẪN XUẤT khi
-- đọc: xe có bản ghi car_truck_maintenances còn hiệu lực với
-- tmn_start_date <= hôm nay (UTC) <= tmn_end_date. Không lưu, không cron.
-- IN_USE chỉ thuộc luồng điều xe CAR; chuyến LOG của xe tải không bao giờ đặt.
--
-- Đây là migration DỮ LIỆU, không đổi schema/enum (enum dùng chung với CAR):
-- xoá giá trị đặt tay còn sót trên xe tải để "Bảo trì" chỉ còn đến từ bản ghi.
-- Idempotent — chạy lại ra UPDATE 0.
UPDATE car_vehicles
   SET cvh_status = 'AVAILABLE',
       cvh_updated_at = now()
 WHERE cvh_type = 'TRUCK'
   AND cvh_status IN ('MAINTENANCE', 'IN_USE')
   AND cvh_deleted_at IS NULL;
