# RPT-20260725 — Đối chiếu Sheet3 (CR TRUCK APP) + phân bổ lương/khấu hao theo chuyến

Nguồn: Google Sheet "CR TRUCK APP" (`1k4S_dpQkPbCO2OiUaSVtM28fC5vodHqG2-rjwSbYS9M`), tab **Sheet3** + tab **NEW RULE**. Commit `24c8bdc` trên `staging-car-truck`.

## 1. Audit Sheet3 — sheet tự nó ĐÚNG
Công thức: `LN/chuyến = DT − (lương phân bổ + khấu hao phân bổ + nhiên liệu phân bổ + cầu đường + phát sinh)`; "phân bổ" = tổng tháng ÷ số chuyến của xe.
Verify: Chuyến 1 = 10.000.000 − 3.700.000 = 6.300.000 ✓; tổng 88.000.000 − 48.800.000 = 39.200.000 ✓; theo khu vực (16 + 7,8 + 15,4) ✓; theo xe (8+8+3,9+3,9+7,7+7,7) ✓.

## 2. Hai nguồn spec mâu thuẫn nhau → cách xử lý
| | Tab NEW RULE (spec viết) | Sheet3 (demo số) |
|---|---|---|
| Xăng | `tiêu hao/km × km × giá bình quân tháng` | không có cột km → **không phân biệt được** |
| LN/chuyến | `DT − xăng − cầu đường − phát sinh` (không trừ cố định) | **có** trừ lương + khấu hao phân bổ |

- **Xăng: GIỮ NGUYÊN** mô hình km — app đã khớp NEW RULE. Sheet3 mỗi xe đúng 2 chuyến, tiền xăng chia đôi → **chia đều ≡ chia theo km** khi 2 chuyến bằng km, nên Sheet3 không bác bỏ mô hình km. (Ban đầu tôi kết luận nhầm là "chia đều", đã đính chính.)
- **LN/chuyến: THEO Sheet3** — bổ sung phân bổ lương + khấu hao.

## 3. Đã implement
`packages/core/src/truck/truck-fixed-allocation.ts` — `loadTruckFixedAllocation()`:
- Nguồn tháng **đúng nguồn `computeTruckPnl`** dùng (ưu tiên `car_truck_fixed_costs` theo (xe, tháng); không có → khấu hao xe + lương tài xế mặc định) ⇒ Σ phân bổ khớp `fixedCost` tháng.
- Mẫu số = số chuyến COMPLETED của xe trong tháng. Xe không có chuyến → không phân bổ (vẫn nằm trong tổng tháng).
- Làm tròn từng phần độc lập với thứ tự dòng → có thể lệch vài đồng khi không chia hết; **tổng tháng là số chuẩn**.

Surface: `salaryAllocated` / `depreciationAllocated` / `profitAfterFixed` (+ `fixedTripCount`) ở `listTruckFinanceTrips` và `getTruckTripBreakdown`. **`profit` (chỉ biến đổi) giữ nguyên** → Excel export + màn review lập báo cáo **không đổi số**.

UI: bảng Chi phí & LN thêm cột "CP cố định phân bổ" (tách Lương/KH), cột Lợi nhuận = sau phân bổ; Chi tiết chuyến thêm 2 dòng phân bổ + chú thích "chia cho N chuyến trong tháng". i18n vi/en/ko.

## 4. Verify trên staging (ảnh đã gửi KH)
- Phân bổ/xe: 6.000.000÷2 = **3.000.000**, KH 500.000÷2 = **250.000** — khớp Sheet3.
- Σ lương **38.000.000** ✓ · Σ khấu hao **4.000.000** ✓ · tổng **42.000.000** ✓ (khớp cả Sheet3 lẫn KPI tháng của app).
- LN/chuyến: TR-3021 5.500.000−325.000−3.250.000 = **1.925.000** ✓; TR-3020 **6.575.000** ✓; TR-3022 **1.550.000** ✓.
- So Sheet3 Chuyến 3 ↔ TR-3022: lương/KH/DT/cầu đường/phát sinh khớp tuyệt đối; **chênh đúng 300.000 tiền xăng** vì xe 50E-60125 trên staging chưa đặt định mức/giá.
- typecheck + lint sạch (5/5 package).

## 5. Còn lại
- **Đặt định mức + giá xăng cho 5 xe còn lại** (hiện chỉ 50D-32938 có) → khớp Sheet3 100%. Đang chờ KH xác nhận.
- Cầu đường lệch 50.000 giữa app (950.000) và Sheet3 (900.000) — **lệch dữ liệu nhập**, không phải logic.
