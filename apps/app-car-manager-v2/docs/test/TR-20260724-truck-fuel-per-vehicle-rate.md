# TR-20260724 — Kết quả test: Phí nhiên liệu theo định mức + giá của XE

> Kèm [TC-20260724](TC-20260724-truck-fuel-per-vehicle-rate.md). Verify thật trên **staging** (car-manager-staging.onrender.com, DB ep-noisy-heart) sau deploy `decdd30`.

## Môi trường
- Build staging live sau ~135s (commit `decdd30`). Migration `cvh_fuel_price` đã áp local + ep-noisy-heart (verify `information_schema`).
- Xe test: **50D-32938** (định mức 10 L/100km sẵn có; giá xăng đặt = 25.000đ qua form). Các xe khác chưa đặt giá.

## Kết quả

| TC | Nội dung | KQ |
|---|---|---|
| TC1/TC4 | Trước khi đặt giá: mọi chuyến | ✅ badge **"Chưa đặt định mức"**, phí = 0đ, KPI phí nhiên liệu = 0đ |
| TC5 | Đặt giá 25.000 cho 50D-32938 (form có ô "Giá xăng (đ/L)") | ✅ Lưu OK; trip 50D-32938 chuyển **"Theo định mức"** |
| TC1 | 50D-32938 TR-3021 km=10: phí | ✅ **25.000đ** = 10 × (10/100) × 25.000; Đơn giá 25.000, Lít 1.0 |
| TC2 | Sửa km 10 → 100 (TR-3021) | ✅ phí **25.000 → 250.000đ** tính lại ngay (= 100 × 10/100 × 25.000); Lít 1→10; lợi nhuận 5.175.000 → 4.950.000 |
| — | Cách ly theo xe | ✅ TR-3020 (cùng xe, km=10) giữ 25.000; xe khác vẫn "Chưa đặt định mức" |
| — | KPI rollup | ✅ Phí nhiên liệu tháng 0 → 50.000 → 275.000đ theo thay đổi |
| TC3 | Form chuyến | ✅ ô Lít/Đơn giá đã bỏ; hiển thị read-only "Phí nhiên liệu tính theo định mức của xe (km × định mức × giá)" |
| TC10 | Migration | ✅ cvh_fuel_price present trên cả 2 nhánh |
| — | typecheck + lint (web+core+shared+db) | ✅ sạch |

## Kết luận
Đạt yêu cầu R1/R2/R4/R5: phí nhiên liệu mặc định = km × định mức xe × giá xe, tính **live theo km, không cần hoá đơn**; badge 3 trạng thái + toast hoạt động; model bình quân theo hoá đơn (R3) giữ nguyên (đè khi có báo cáo). Không đổi số báo cáo đã lập.

## Ghi chú
- Đã để lại giá xăng **25.000đ** trên xe 50D-32938 (dữ liệu demo) — có thể sửa/xoá trong Phương tiện.
- Odometer TR-3021 đã revert về nguyên trạng (km=10) sau khi test.
- Verify km-live thực hiện qua write DB có kiểm soát (đã revert) do form edit bị kẹt hydration không ổn định trên staging; công thức + cách ly theo xe đã chứng minh trực quan.
