# TC-20260904 — Truck: Bảo trì (CRUD · chặn chuyến · cộng chi phí)

> REQ: [REQ-20260904-truck-maintenance.md](../analysis/REQ-20260904-truck-maintenance.md) · PLN: [PLN-20260904-truck-maintenance.md](../plan/PLN-20260904-truck-maintenance.md)
> Môi trường: staging (`https://stg-…`) sau khi áp `0030_truck_maintenance.sql`. Vai trò: ADMIN (toàn quyền), MANAGER khu vực HCM (bị thu hẹp), DRIVER xe tải.
> Dữ liệu seed gợi ý: xe A (HCM) có 4 chuyến COMPLETED tháng T ở các ngày 02, 10, 15, 20; lương tài xế mặc định 12.000.000; khấu hao 4.000.000. Xe B (Đồng Nai) không có chuyến tháng T.

## A. CRUD & danh sách

| ID | Bước | Kỳ vọng |
|---|---|---|
| A1 | ADMIN › Sidebar truck › nhóm Vận hành | Có mục **Bảo trì** (icon cờ lê) sau "Tài xế". Mobile: thanh dưới vẫn Chuyến · Đội xe · (▦) · Tài xế · Thêm; sheet "Thêm" › Vận hành có "Bảo trì" |
| A2 | Mở `/truck/maintenance` lần đầu | Empty state + nút "Thêm bảo trì"; không lỗi 500 (bảng đã tồn tại) |
| A3 | Thêm bảo trì: xe A, 05/T–08/T, chi phí 7.500.000 → Lưu | Toast "Đã thêm bảo trì cho {biển số}"; về danh sách; dòng mới: Ngày = hôm nay, Phương tiện, `05/T – 08/T · 4 ngày · chip trạng thái`, `7.500.000 ₫`, Cập nhật bởi = tên ADMIN, Cập nhật = giờ hiện tại |
| A4 | Lọc tháng T | Subtitle "1 lần bảo trì · Tổng chi phí bảo trì tháng MM/YYYY: 7.500.000 ₫" |
| A5 | Lọc khu vực Đồng Nai | Danh sách rỗng (bản ghi thuộc xe HCM) |
| A6 | Sửa: đổi chi phí 7.500.000 → 9.000.000 → Lưu | Toast cập nhật; cột Chi phí 9.000.000; Cập nhật đổi giờ; Cập nhật bởi = người sửa |
| A7 | Kết thúc < Bắt đầu | Dòng đỏ "Ngày kết thúc phải từ ngày bắt đầu…" + Lưu bị khoá; (gọi action trực tiếp) → CAR-E0001 zod |
| A8 | Chi phí = 0 (để trống) | Lưu được, Chi phí hiển thị `0 ₫`; chặn chuyến vẫn áp dụng |
| A9 | Xoá từ cột Hành động → xác nhận | Toast xoá; dòng biến mất; DB `tmn_deleted_at` set (soft) |
| A10 | Chip trạng thái | today < start → "Sắp tới"; start ≤ today ≤ end → "Đang bảo trì"; today > end → "Đã xong" |
| A11 | Audit log | 3 dòng `TRUCK_MAINTENANCE.CREATE/UPDATE/DELETE`, entity Vehicle, ref = biển số, payload có start/end/month/cost |

## B. Chặn hai chiều (BR-7 / BR-8)

| ID | Bước | Kỳ vọng |
|---|---|---|
| B1 | Thêm bảo trì xe A, khoảng 09/T–12/T (trùng chuyến ngày 10) | Ngay khi chọn xong xe + ngày: banner đỏ "Xe … đã có 1 chuyến trong khoảng này (TR-…)"; nút Lưu khoá. Gọi action trực tiếp → `CAR-E1014` |
| B2 | Cùng form, đổi sang 05/T–08/T | Banner biến mất, Lưu mở |
| B3 | Form bảo trì, chọn ngày 09/T–12/T trước rồi mở Select xe | Xe A hiển thị "(có 1 chuyến trong khoảng)" và **không chọn được**; xe B chọn được |
| B4 | Mở trang **sửa** bản ghi có sẵn mà xe đã có chuyến trong khoảng (tạo dữ liệu bằng SQL) | Cảnh báo hiện **ngay khi mở**, Lưu khoá |
| B5 | Có bảo trì xe A 05/T–08/T. Quản lý tạo chuyến xe A ngày 06/T | Trong Select xe: "xe A (bảo trì 05/T–08/T)" bị disable. Nếu chọn xe trước rồi đổi ngày về 06/T → dòng đỏ dưới Select; Lưu → toast `CAR-E1013 — Xe … đang bảo trì từ … đến …`, **không** có dialog "Vẫn tiếp tục" |
| B6 | Cùng bước B5 nhưng ngày 09/T | Lưu thành công |
| B7 | Tạo chuyến "ghi chuyến đã hoàn thành" ngày 07/T xe A | `CAR-E1013` (chặn cả chuyến đã xong) |
| B8 | DRIVER `/today/truck/new` chọn xe A ngày 06/T | Option disable + `CAR-E1013` nếu gửi |
| B9 | Gán xe A cho chuyến chờ có ngày 06/T | `CAR-E1013` |
| B10 | Sửa chuyến ngày 09/T xe A → đổi ngày 06/T | `CAR-E1013` |
| B11 | Import Excel xe A, file có dòng 7 ngày 06/T | Từ chối toàn file: `CAR-E1013 — Dòng 7: xe … đang bảo trì …`; **không** dòng nào được ghi |
| B12 | Xe A có `cvh_status = MAINTENANCE` (đặt qua form xe con) nhưng **không** có bản ghi bảo trì, tạo chuyến | Vẫn là cảnh báo mềm cũ "Xe … đang bảo dưỡng" + "Vẫn tiếp tục" (không đổi) |
| B13 | Hai bản ghi bảo trì cùng xe A trùng khoảng (03–06 và 05–08), không có chuyến | Banner vàng "đã có bản ghi bảo trì trùng khoảng…", **vẫn lưu được** |

## C. Số liệu — một nguồn (BR-1…BR-6)

Bối cảnh: xe A tháng T: 4 chuyến, lương 12.000.000, KH 4.000.000, bảo trì 7.500.000 (05–08/T).

| ID | Màn | Kỳ vọng |
|---|---|---|
| C1 | Dashboard, kỳ "Tháng này", khu vực HCM | KPI **Tổng chi phí** tăng đúng 7.500.000 so với trước khi thêm bảo trì; **Lợi nhuận ròng** giảm đúng 7.500.000; tooltip có "+ Chi phí bảo trì"; subtitle KPI có "· bảo trì" |
| C2 | Dashboard › Cơ cấu chi phí | Có lát "Bảo trì" 7.500.000; Σ các lát = số ở tâm donut |
| C3 | Dashboard › Tổng phí cố định | = 12.000.000 + 4.000.000 + 7.500.000 = **23.500.000**; 3 dòng Lương / Khấu hao / Bảo trì; ghi chú "Bảo trì tính theo tháng, không phân bổ theo chuyến" |
| C4 | Chi phí & LN › Tổng quan P&L, cột tháng T | Dòng mới **Bảo trì** 7.500.000 nằm giữa Khấu hao và **Tổng phí cố định** 23.500.000; Lợi nhuận ròng khớp dashboard |
| C5 | Export P&L (Excel + PDF) | Có dòng "Chi phí bảo trì"; Tổng phí cố định = Σ 3 dòng |
| C6 | Chi phí & LN › Theo chuyến | Card "Chi phí cố định" 23.500.000 + ghi chú "gồm bảo trì 7.500.000 ₫ — không phân bổ theo chuyến"; cột **CP cố định phân bổ** mỗi chuyến vẫn = (12.000.000 + 4.000.000) ÷ 4 = 4.000.000 (**không** có bảo trì); Σ Lợi nhuận 4 chuyến − 7.500.000 = Lợi nhuận ròng tháng |
| C7 | Xe B (0 chuyến) tháng T, thêm bảo trì 20.000.000; lọc dashboard khu vực Đồng Nai | Tổng phí cố định = 20.000.000 (lương/KH = 0 vì 0 chuyến), LN ròng = −20.000.000 (Q7) |
| C8 | Bảo trì xe A khoảng 30/(T−1)–02/T | Hạch toán tháng T−1 (theo ngày bắt đầu); tháng T không đổi (Q3) |
| C9 | Lập báo cáo tháng T (MONTHLY_SUMMARY) khu vực HCM | Sheet vi/en/ko: mục B có dòng 24 "Chi phí khác" (0) **và** dòng 25 "Chi phí bảo trì" 7.500.000; dòng 26 Tổng chi phí = `SUM(C19:C25)`; dòng 29 Lợi nhuận gộp = `C16−C26`; mục E cột "Tổng chi phí"/"Lợi nhuận" xe A đã gồm bảo trì; TỔNG mục E = mục B/C |
| C10 | Review lập BC (bước 2) | "Chi phí cố định" xe A = 23.500.000 |
| C11 | Sau khi lập BC, sửa/xoá bản ghi bảo trì tháng T | Badge "Đã lập BC … dữ liệu đã thay đổi, cần lập lại" chuyển cam ở Finance/P&L/Dashboard |
| C12 | Tháng T đã **chốt sổ** (legacy) | Trang sửa bản ghi bảo trì read-only + banner "Tháng đã chốt sổ"; thêm/sửa/xoá → `CAR-E1002` |

## D. Phân quyền & khu vực

| ID | Bước | Kỳ vọng |
|---|---|---|
| D1 | MANAGER chỉ có khu vực HCM mở `/truck/maintenance` | Chỉ thấy bản ghi xe HCM; Select khu vực chỉ có HCM; Select xe chỉ xe HCM |
| D2 | MANAGER HCM gọi `createTruckMaintenanceAction` với xe Đồng Nai | `CAR-E0403` |
| D3 | DRIVER mở `/truck/maintenance` | Redirect `/today` (truck layout) |
| D4 | MANAGER không có TRUCK access | Redirect `/dashboard` |

## E. Kỹ thuật

| ID | Bước | Kỳ vọng |
|---|---|---|
| E1 | `npx tsc --noEmit` ở `packages/db`, `packages/shared`, `packages/core`, `apps/web` | 0 lỗi |
| E2 | `npx next lint` ở `apps/web` | 0 lỗi (warning cũ không tăng) |
| E3 | Áp `0030_truck_maintenance.sql` 2 lần | Idempotent, lần 2 không lỗi |
| E4 | Deploy build mới **trước** khi áp migration | Dashboard/P&L 500 (`relation car_truck_maintenances does not exist`) → bắt buộc áp migration trước (skill `pre-deploy-check`) |
