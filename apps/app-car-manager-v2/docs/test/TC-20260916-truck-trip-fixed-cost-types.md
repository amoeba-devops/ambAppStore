# TC-20260916 — Thêm loại chi phí cố định + hóa đơn riêng cho chuyến đi Truck

> REQ: [REQ-20260916-truck-trip-fixed-cost-types](../analysis/REQ-20260916-truck-trip-fixed-cost-types.md)
> PLN: [PLN-20260916-truck-trip-fixed-cost-types](../plan/PLN-20260916-truck-trip-fixed-cost-types.md)

## 1. Phạm vi test
Workspace TRUCK (`/truck/*`, `trp_kind='LOG'`) — form tạo/sửa chuyến (Manager), form hoàn thành chuyến (Driver),
chi tiết chuyến, dashboard tài chính, báo cáo tháng, import Excel. Không test lại phân hệ CAR (Expense) — ngoài scope.

## 2. Test case chức năng

| TC | Kịch bản (Given/When) | Kết quả mong đợi | Ưu tiên |
|---|---|---|---|
| TC-01 | Manager tạo chuyến mới, nhập đủ 4 phí mới (Vệ sinh/Sửa chữa/Cầu phà/Bốc dỡ) + Toll + Nhiên liệu | Lưu thành công; Tổng chi phí = fuelCost + toll + 4 phí mới + extraTotal; xem lại chuyến hiển thị đúng 7 dòng chi phí | Cao |
| TC-02 | Driver hoàn thành chuyến, nhập 4 phí mới ở form hoàn thành (không nhập ở lúc tạo) | Lưu thành công; giá trị hiển thị đúng ở chi tiết chuyến sau khi hoàn thành | Cao |
| TC-03 | Tạo/hoàn thành chuyến **để trống cả 4 phí mới** (chỉ nhập Toll + Nhiên liệu như trước đây) | Tổng chi phí/Lợi nhuận **giống hệt** hành vi trước khi có tính năng này (regression) — không có giá trị NULL/NaN hiển thị | Cao (regression) |
| TC-04 | Mở một chuyến **đã tạo trước khi triển khai tính năng** (4 cột mới NULL trong DB) | Trang chi tiết/sửa/hoàn thành mở bình thường, 4 field mới hiển thị trống/0, không lỗi 500 | Cao (regression) |
| TC-05 | Driver mở lại chuyến đã có 4 phí mới (nhập từ lúc Manager tạo) rồi bấm "Hoàn thành" mà không sửa gì | Sau khi submit, 4 phí mới **vẫn giữ nguyên giá trị cũ** (không bị xoá do complete ghi đè toàn bộ — kiểm tra `truck-complete-initial.ts` seed đủ field) | Cao |
| TC-06 | Vẫn dùng nút "+ Thêm khoản phí" để thêm 1 khoản tự do tên tuỳ ý (vd "Phí gửi xe qua đêm") | Hoạt động y hệt trước đây — không bị ảnh hưởng bởi 4 field cố định mới | Trung bình (regression) |
| TC-07 | Đính kèm 1 file ảnh vào từng nhóm hóa đơn trong 7 nhóm (Nhiên liệu/Cầu đường/Vệ sinh/Sửa chữa/Cầu phà/Bốc dỡ/Khác) | Cả 7 nhóm lưu và hiển thị đúng file đã đính, đúng nhóm — không lẫn nhóm | Cao |
| TC-08 | Đính kèm 10 file vào 1 nhóm mới (vd Cầu phà) — chạm giới hạn tối đa/nhóm | File thứ 11 bị chặn với thông báo lỗi rõ ràng (giống hành vi giới hạn hiện tại của nhóm FUEL/TOLL) | Trung bình |
| TC-09 | Tổng số file đính kèm trên toàn bộ 7 nhóm > 30 (vd 5 file × 7 nhóm = 35) | Lưu thành công (xác nhận cap đã tăng 30→70, không bị chặn nhầm) | Cao |
| TC-10 | Xoá (soft-delete) 1 file hóa đơn ở nhóm mới (vd Sửa chữa) rồi lưu | File biến mất khỏi UI, không mất các file khác cùng nhóm hoặc nhóm khác | Trung bình |
| TC-11 | Sửa chuyến đã hoàn thành, đổi giá trị 1 trong 4 phí mới | Tổng chi phí/Lợi nhuận cập nhật đúng theo giá trị mới; P&L/dashboard tài chính phản ánh số mới | Cao |
| TC-12 | Xem Dashboard tài chính (`truck/finance`) sau khi có chuyến chứa 4 phí mới | Biến phí/lợi nhuận hiển thị cộng đúng cả 4 khoản mới, khớp với số ở chi tiết chuyến | Cao |
| TC-13 | Xuất báo cáo tháng Excel cho tháng có chuyến chứa 4 phí mới | File Excel xuất ra không lỗi; cột "Chi phí phát sinh khác" (hoặc cột quyết định ở PLN Phase 6) cộng đúng 4 khoản; tổng khớp với dashboard tài chính (TC-12) | Cao |
| TC-14 | Import Excel hàng loạt bằng **template cũ** (không có cột cho 4 phí mới) | Import chạy thành công như trước, 4 cột mới = NULL cho các dòng import | Trung bình |
| TC-15 | Chuyển ngôn ngữ vi/en/ko trên form tạo chuyến, form hoàn thành, chi tiết chuyến | Toàn bộ label mới (4 field + 4 nhóm hóa đơn + nhãn "Hóa đơn khác") hiển thị đúng bản dịch ở cả 3 ngôn ngữ, không rơi về key thô (vd `screens.truckTrips.form.cleaningFee`) | Cao |
| TC-16 | Kiểm tra multi-tenancy: 2 `ent_id` khác nhau, mỗi bên có chuyến với 4 phí mới | Không rò rỉ dữ liệu chéo tenant ở bất kỳ màn hình nào (chi tiết, dashboard, báo cáo) | Cao |
| TC-17 | Nhập số âm vào 1 trong 4 field phí mới | Bị chặn validate (giống `toll_fee` hiện tại dùng `.nonnegative()`), thông báo lỗi rõ ràng | Trung bình |

## 3. Điều kiện hoàn thành (Definition of Done)
- Toàn bộ TC ưu tiên **Cao** pass trên staging trước khi xin duyệt lên production.
- 2 câu hỏi mở ở REQ §6 (báo cáo Excel gộp/tách cột, phí mới có trừ lợi nhuận hay không) đã được khách hàng xác
  nhận bằng văn bản/tin nhắn trước khi coi TC-13 là "pass" chính thức (không chỉ là "chạy không lỗi").
- Không có regression ở chuyến/dữ liệu tạo trước khi triển khai (TC-03, TC-04, TC-06).
