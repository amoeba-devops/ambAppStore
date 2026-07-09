# TC-20260709 — Đính kèm hóa đơn/biên lai cho chi phí chuyến đi (Truck)

> PLAN: [PLAN-20260709-truck-trip-cost-receipt-upload](../plan/PLAN-20260709-truck-trip-cost-receipt-upload.md)

| # | Kịch bản | Bước | Kỳ vọng |
|---|---|---|---|
| TC1 | Đính kèm 1 ảnh cho Nhiên liệu (Manager, tạo trip) | Manager tạo trip → nhập fuel_liters → bấm đính kèm → chọn 1 JPG < 50MB → submit | Trip lưu thành công, xem detail thấy 1 file đính kèm ở dòng Nhiên liệu |
| TC2 | Đính kèm nhiều file cho 1 dòng Extra cost | Thêm extra cost "Rửa xe" → đính kèm 3 file (2 ảnh + 1 PDF) → submit | Lưu đủ 3 attachment, đúng dòng extra cost tương ứng (không lẫn sang dòng khác) |
| TC3 | Không đính kèm gì (regression) | Tạo/sửa trip với fuel/toll/extra cost như cũ, không chạm nút đính kèm | Hành vi giống hệt trước khi có feature — không lỗi, không tạo row attachment rác |
| TC4 | File PDF cho Toll | Nhập toll_fee → đính kèm 1 file PDF | Lưu thành công, mime lưu đúng `application/pdf` |
| TC5 | File vượt 50MB | Chọn file ảnh 60MB | Bị chặn ở UI (client-side) trước khi gọi presign, thông báo lỗi rõ dung lượng tối đa |
| TC6 | File 10-50MB (trước đây từng bị chặn ở 10MB) | Chọn file PDF 25MB | Upload + lưu thành công (xác nhận giới hạn mới thực sự có hiệu lực, không còn hard-code 10MB nào chặn ngầm) |
| TC7 | Sai định dạng (vd .docx, .exe) | Chọn file không phải ảnh/PDF | Bị chặn ở UI, không gọi S3 |
| TC8 | Driver complete trip có đính kèm | Driver mở "hoàn thành chuyến" → nhập metric + extra cost → đính kèm ảnh chụp từ camera (mobile) → submit | Lưu thành công giống luồng Manager, ảnh hiển thị đúng ở trip detail |
| TC9 | Sửa trip — xoá attachment đã có (soft-delete) | Mở trip đã có attachment → xoá 1 file → submit | File biến mất khỏi UI ngay; DB row vẫn tồn tại với `tca_deleted_at` set (verify trực tiếp qua query) — **không** xoá cứng row, **không** xoá S3 object |
| TC9b | Query trip detail không trả file đã xoá | Sau TC9, load lại trip detail | Danh sách attachment không còn file đã xoá (JOIN lọc `tca_deleted_at IS NULL`), nhưng file khác của cùng dòng chi phí vẫn hiển thị đúng |
| TC10 | Sửa trip — thêm attachment cho dòng chi phí đã tồn tại từ trước (tạo trước khi có feature) | Mở trip cũ (không có attachment nào) → thêm attachment cho dòng Nhiên liệu đã có sẵn số liệu → submit | Thêm thành công, không ảnh hưởng số liệu fuel_liters gốc |
| TC11 | Không ảnh hưởng module Expense (car) | Vào module Expense (không phải Truck) → tạo expense mới → đính kèm receipt như luồng cũ | Hành vi y hệt trước (giới hạn 10MB, code không đổi) — xác nhận feature Truck không đụng tới Expense |
| TC12 | Multi-tenant isolation | Ent A tạo trip có attachment → Ent B (khác `ent_id`) query/xem trip của Ent A | Không truy cập được (chặn ở tầng query `withEnt`, không phải chỉ chặn ở UI) |
| TC13 | i18n | Đổi locale vi/en/ko trên form | Label nút đính kèm, thông báo lỗi dung lượng/định dạng hiển thị đúng cả 3 ngôn ngữ, không có key thiếu |
| TC14 | Presigned upload thất bại giữa chừng (network) | Ngắt mạng khi đang upload file lớn | Lỗi hiển thị rõ, không crash form, không mất dữ liệu các field khác đã nhập |
| TC15 | Driver offline — nút đính kèm bị disable | Driver mở form complete trip khi mất mạng (`navigator.onLine === false`) | Nút "Đính kèm" disable, tooltip/toast "cần mạng để đính kèm"; các field số liệu khác (fuel/toll/extra cost) vẫn nhập được bình thường, không bị disable |
| TC16 | Driver có mạng lại giữa lúc điền form | Bắt đầu offline (nút disable) → mạng có lại → không cần reload trang | Nút đính kèm tự bật lại (enable) khi online trở lại |
