# RPT-20260822 — Tách "Phí nhiên liệu thực tế" vs "Phí nhiên liệu (phân bổ)"

> REQ: [REQ-20260822](../analysis/REQ-20260822-truck-fuel-actual-vs-allocated.md)

## 1. Thay đổi

| # | File | Nội dung |
|---|------|----------|
| 1 | `apps/web/src/server/queries/truck-trips.queries.ts` | `TruckTripRow` thêm `fuelActualLiters/Price/Cost` (= số của chính chuyến, không pool); `getTruckTripBreakdown` thêm `fuelActualCost` |
| 2 | `apps/web/src/app/(app)/truck/trips/page.tsx` | Cột (desktop + card mobile) đọc `fuelActualCost`; header dùng `thFuelActual` + tooltip `thFuelActualHint` |
| 3 | `apps/web/src/app/(app)/truck/trips/export/route.ts` | Export của trip-log dùng bộ actual (đơn giá/lít/phí + tổng chi phí + lợi nhuận theo actual) để file khớp màn hình |
| 4 | `apps/web/src/app/(app)/trips/[id]/_components/truck-trip-detail.tsx` | Thêm dòng "Nhiên liệu thực tế" (chỉ khi > 0) + đổi nhãn dòng cũ thành "Nhiên liệu phân bổ"; Tổng chi phí/Lợi nhuận vẫn dùng phân bổ |
| 5 | `apps/web/src/app/(app)/truck/trips/[id]/page.tsx`, `apps/web/src/app/(app)/trips/[id]/page.tsx` | Truyền `fuelActualCost` xuống component detail |
| 6 | `apps/web/messages/{vi,en,ko}.json` | Key mới `truckTrips.thFuelActual` + `thFuelActualHint`, `truckTripDetail.fuelActual` + `fuelActualNote` + `fuelAllocated`; đổi text `truckFinance.thFuel` → "Phí nhiên liệu (phân bổ)" và viết lại `thFuelHint` để trỏ sang khái niệm còn lại |

**Không đụng**: công thức pool, freeze theo báo cáo (REQ-20260821), phân bổ CP cố định, báo cáo tháng, P&L, dashboard, DB.

## 2. Kết quả kiểm chứng (local, fixture giống staging TR-3019)

Fixture 1 xe / tháng 2026-10: A (10 km, 10 L × 30.000 = 300.000) · B (20 km, không bơm dầu) · C (20 km, 5 L × 50.000 = 250.000).
Pool = 550.000 ₫ ÷ 50 km = 11.000 đ/km.

| Màn | Header | A | B | C | Σ |
|---|---|---|---|---|---|
| Danh sách chuyến đi | `PHÍ NHIÊN LIỆU THỰC TẾ` | 300.000 | 0 | 250.000 | **550.000** = tiền thật ✔ |
| Chi phí & Lợi nhuận | `PHÍ NHIÊN LIỆU (PHÂN BỔ)` | 110.000 | 220.000 | 220.000 | **550.000** ✔ |

Chi tiết chuyến A: `Nhiên liệu thực tế 300.000 ₫` (ghi chú "Số lít × đơn giá chuyến này nhập") ·
`Nhiên liệu phân bổ 110.000 ₫` + chip `Tạm tính` + `10 km × 11.000 ₫/km` · `Tổng chi phí 110.000 ₫` (giữ theo phân bổ,
khớp màn tài chính) · `Lợi nhuận 9.890.000 ₫`.

`turbo run typecheck` 5/5 · `turbo run lint` pass. Fixture đã dọn sau khi test.

## 3. Lưu ý vận hành

- Hai con số **được phép khác nhau** — đó là mục đích. Đối chiếu đúng: tổng cột "Phí nhiên liệu thực tế" của xe trong tháng
  = tổng cột "Phí nhiên liệu (phân bổ)" của xe trong tháng.
- Chuyến không bơm dầu hiện `0 ₫` ở Danh sách chuyến đi nhưng vẫn có phí phân bổ > 0 ở Chi phí & Lợi nhuận (nó tiêu
  dầu do chuyến khác trả) — đúng nghiệp vụ, và giờ nhãn đã nói rõ nên không còn gây nhầm.
- File export của Danh sách chuyến đi giờ mang số thực tế (kể cả Tổng chi phí/Lợi nhuận trong file đó); ai cần số phân
  bổ thì dùng "Xuất Excel" ở màn Chi phí & Lợi nhuận hoặc báo cáo tháng.
