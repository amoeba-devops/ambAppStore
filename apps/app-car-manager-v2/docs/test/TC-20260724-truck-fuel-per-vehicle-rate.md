# TC-20260724 — Phí nhiên liệu theo định mức + giá của XE

> Kèm [REQ](../analysis/REQ-20260724-truck-fuel-per-vehicle-rate.md) + [PLN](../plan/PLN-20260724-truck-fuel-per-vehicle-rate.md). Verify **trên staging** (local dev không hydrate — đã biết).

## Dữ liệu nền
- Xe X (TRUCK), khu vực HCM, `cvh_fuel_quota=30` (L/100km), `cvh_fuel_price=25.000`.
- Xe Y (TRUCK) **chưa** đặt định mức/giá.
- Chuyến COMPLETED, km = end−start.

## Test cases

| # | Tiền đề | Thao tác | Kỳ vọng |
|---|---------|----------|---------|
| TC1 | Xe X, km=100, khu vực **chưa** hoá đơn | Mở Chi phí & LN / chi tiết chuyến | Phí = 100×0.3×25.000 = **750.000đ**; badge **"Theo định mức"** |
| TC2 | Như TC1 | Sửa chuyến: km 100→150, Lưu | Phí = **1.125.000đ** (tính lại ngay); toast "…theo định mức xe" |
| TC3 | Xe X | Xem form chuyến | "Lít" = 45 (150×0.3) chỉ-đọc; "Đơn giá" = 25.000 chỉ-đọc; không nhập được |
| TC4 | Xe Y (chưa định mức/giá), km=100 | Xem phí | Phí = **0**; badge **"Chưa đặt định mức xe"**; tooltip nhắc vào Phương tiện |
| TC5 | Xe Y | Vào Phương tiện đặt định mức=28, giá=24.000, Lưu → xem lại chuyến | Phí = 100×0.28×24.000 = **672.000đ**; badge chuyển "Theo định mức" |
| TC6 | Xe X, khu vực HCM **có** hoá đơn + **đã lập báo cáo** | Xem chuyến | Phí = km×consumption×avgPrice (**bình quân**); badge **"Bình quân"** (đè lên định mức) — R3 giữ nguyên |
| TC7 | Báo cáo đã freeze trước đó | Sau khi đổi định mức xe | Số trong báo cáo cũ **không đổi** (đã freeze) |
| TC8 | P&L tháng, nhiều xe | Xem tổng | fuelCost tổng = Σ theo nhánh đúng từng xe; badge tổng phản ánh full/partial |
| TC9 | Xuất Excel báo cáo | Tải file | Giá trị phí khớp màn hình; layout cột KHÔNG vỡ |
| TC10 | Migration | Query xe sau ALTER | `cvh_fuel_price` đọc được; không 500 |
| TC11 | i18n | Đổi vi/en/ko | 3 badge + tooltip + toast dịch đủ 3 ngôn ngữ |

## Verify kỹ thuật
- `tsc --noEmit` (web+core+shared+db) + `next lint` sạch.
- 3 file messages parse OK.
- Migration áp local + staging trước deploy.
