# FIX-261016 — Báo cáo tháng truck thiếu Lương/Khấu hao (tháng trước mốc rate) + lương tài xế tính sai

## Triệu chứng
CargoRush xuất báo cáo tháng 8 (file `MONTHLY_SUMMARY-all-e6dee53d…xlsx`, lập 15/10 06:37): dòng `Lương tài xế = 0`, `Khấu hao xe = 0`, tổng chi phí chỉ 5.686.904đ, lợi nhuận 62,66tr (margin 91,7%).

## Nguyên nhân #1 (chính — đã đọc file S3 xác nhận)
`loadTruckFixedMonthly` nạp rate bằng `tcr_month <= lastMonth` (tháng đang báo cáo). Rate của CargoRush đều bắt đầu `2026-09` (nhập 09-17) nên khi báo cáo tháng 8 truy vấn KHÔNG trả rate nào → cơ chế "mượn rate đầu tiên" (BUG-260930 case 4, đã deploy) không có rate để mượn → 0. Cả 2 xe đều có chuyến tháng 8 nên điều kiện active đã đúng; chỉ thiếu dữ liệu rate. Tháng 9 đúng vì mốc rate ≤ tháng 9.

## Nguyên nhân #2 (số lương sai kể cả khi có rate)
Báo cáo tháng 8 có tổng lương 24tr, tháng 9 là 26tr dù cùng 2 tài xế. Lương một xe phụ thuộc vào ai lái chuyến đầu tiên.

## Nguyên nhân (đã đối chiếu DB prod, chỉ đọc)
- Xe 50H-78901 không có tài xế mặc định. `computeTruckPnl` chọn tài xế của CHUYẾN SỚM NHẤT trong tháng (`driverByKey`) để tính lương cả tháng.
- Tháng 8, 50H có 2 tài xế: e19a (21 chuyến, 12tr) và 0a2a (20 chuyến, 14tr). Chỉ e19a bị tính; 0a2a (14tr) bị bỏ sót.
- e19a cũng là tài xế mặc định của 51D-45678 → bị tính 12tr lần nữa (tổng 24tr cho một người).
- Rate chỉ bắt đầu từ 2026-09 nên tháng 7–8 phụ thuộc cơ chế mượn rate đầu tiên; cơ chế này không sai, lỗi nằm ở việc chọn tài xế.

## Sửa
1. Bỏ giới hạn `tcr_month <= lastMonth` khi nạp rate (nạp mọi rate còn hiệu lực của tenant; `rateAt` tự chọn).
2. Cách A cho lương:
`packages/core/src/truck/truck-fixed-monthly.ts`: lương tính theo (tài xế, tháng) MỘT lần, chia cho các xe tài xế đã lái theo tỷ lệ số chuyến COMPLETED (`allocateSalary`, số nguyên, phần dư vào xe nhiều chuyến nhất, tổng luôn khớp).
- Tài xế không có chuyến trong tháng → tính trên xe mặc định của họ (xe idle vẫn thấy lương), chỉ mượn rate đầu khi xe đó chạy.
- Tải chuyến/tài xế trên TOÀN BỘ xe của tenant rồi mới lọc theo khu vực/xe, nên báo cáo theo khu vực vẫn chia đúng.
- Bỏ `driverByKey` (truck-pnl.service.ts, truck-trip-delete-impact.ts).

Dự kiến tháng 8 (mô phỏng trên dữ liệu prod): khấu hao 8,0tr + 8,5tr = 16,5tr; lương: T8 = 51D 2.307.692 + 50H 23.692.308 = 26tr; T9 = 12tr + 14tr = 26tr; T7 = 14tr (50H).

## Lưu ý
- Số live tháng 8 của 51D giảm, 50H tăng; tổng đúng 26tr.
- Báo cáo Excel đã render (S3) không tự đổi → lập lại báo cáo tháng 8 (HCM, DONG_NAI, tất cả khu vực) và tháng 9 nếu cần.
- Chưa typecheck / chưa có unit test (host không có Node, repo core chưa có test runner). Cần build trước khi deploy.

## File
- packages/core/src/truck/truck-fixed-monthly.ts
- packages/core/src/truck/truck-pnl.service.ts
- packages/core/src/truck/truck-trip-delete-impact.ts

## Phòng tái diễn
Chi phí của người (lương) không được gắn cứng vào một xe theo thứ tự chuyến; phải tính theo người rồi phân bổ.
