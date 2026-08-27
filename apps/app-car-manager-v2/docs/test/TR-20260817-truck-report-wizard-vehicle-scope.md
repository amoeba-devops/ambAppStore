# TR-20260817 — Truck: Cho phép chọn xe khi Lập báo cáo chính thức (Wizard chốt sổ)

> Kết quả thực thi [TC-20260817](TC-20260817-truck-report-wizard-vehicle-scope.md) cho [REQ-20260817](../analysis/REQ-20260817-truck-report-wizard-vehicle-scope.md) / [PLN-20260817](../plan/PLN-20260817-truck-report-wizard-vehicle-scope.md).

```yaml
executed: 2026-08-17
environment: local dev (localhost:3001) + Neon DEV branch ep-steep-tooth
branch: feature/truck-report-multi-vehicle
executor: Claude (dev@amoeba.group)
status: Build/typecheck/lint xanh · BL-1 verify bằng dữ liệu synthetic thật · Round-trip "Lập báo cáo" THẬT đã bấm qua UI (tab hoạt động), file Excel xuất ra đã đối chiếu — PASS
```

## 1. Đã làm và verify được

| # | Nội dung | Phương pháp | Kết quả |
|---|---|---|---|
| 1 | `tsc --noEmit` toàn bộ 5 package | `npm run typecheck` | **PASS** — 5/5 |
| 2 | `next lint` | `npm run lint` | **PASS** — chỉ cảnh báo cũ có sẵn, không có warning/error mới |
| 3 | `next build` | `npm run build` | **PASS** — `/truck/reports/new` build thành công (9.87 kB) |
| 4 | Migration 0027 áp lên Neon DEV | Script trực tiếp qua `@neondatabase/serverless`, xác nhận host = `ep-steep-tooth` trước khi chạy | **PASS** — cột `trr_vehicle_ids jsonb` tồn tại, xác nhận qua `information_schema.columns` |
| 5 | Bước 2 (khu vực) vẫn render đúng | Fetch SSR `/truck/reports/new?month=2026-08` | **PASS** |
| 6 | **Bước 3 (Chọn xe) MỚI hiện đúng khi chọn 1 khu vực cụ thể** | Fetch SSR `?regions=HCM` | **PASS** — hiện `29C-99999` + `51C-458.32` (2 xe HCM), **không** hiện `60C-311.07` (xe Đồng Nai) |
| 7 | **Khu vực "Tất cả" (ALL) bỏ qua hẳn Bước 3** | Fetch SSR `?regions=ALL` | **PASS** — không có heading "Chọn xe", đi thẳng vào Review — đúng thiết kế GĐ-1 (REQ §7), không hồi quy R03 (REQ-20260814) |
| 8 | Chọn tập con xe → Review chỉ hiện đúng tập đó | Fetch SSR với `vf=HCM:<idA>` (xe không có chuyến) và `vf=HCM:<idB>` (xe có chuyến) | **PASS** — chọn xe A (0 chuyến) → Review rỗng; chọn xe B (có chuyến) → Review hiện đúng xe B, không lẫn xe A |
| 9 | **BL-1 — report tập con không xoá số của xe khác** | Chèn trực tiếp 2 row `car_truck_reports` synthetic vào Neon DEV: R1 (toàn khu vực, phủ xe A+B, costPerKm=1000 cả hai) sinh trước; R2 (chỉ xe B, costPerKm=1500) sinh sau. Biên dịch `packages/core` sang JS (`tsc` không `--noEmit`) và gọi trực tiếp `loadTruckRegionSnapshots` thật (không mock) | **PASS** — sau khi fold: xe A vẫn `costPerKm=1000` (giữ nguyên từ R1, không bị R2 xoá); xe B cập nhật thành `costPerKm=1500` (từ R2); `isReported` = true cho cả 2 xe (A qua R1 toàn khu vực, B qua cả R1 lẫn R2) — **đúng chính xác điều REQ-20260817 BL-1 phải giải quyết** |
| 10 | Dọn dữ liệu test | Xoá 2 row synthetic + xoá script tạm | **Đã dọn sạch**, không còn dấu vết trên Neon DEV |

## 2. Round-trip "Lập báo cáo" thật — verify qua UI thật (2026-08-17, sau khi xác định 1 tab của Browser pane render được)

Ban đầu bị chặn bởi cùng giới hạn môi trường như TR-20260814 (browser pane không compositing ở tab mặc định, Claude in Chrome không với tới sandbox). Sau khi thử một tab preview khác trong cùng phiên, tab đó render đầy đủ (không còn kẹt skeleton) — thao tác UI thật thực hiện được:

| # | Nội dung | Kết quả |
|---|---|---|
| 11 | Bước 3 "Chọn xe (HCM)" hiển thị đúng 2 xe, mặc định "Tất cả xe (2)" | **PASS** (screenshot) |
| 12 | Bỏ chọn còn 1 xe (`51C-458.32`) → Tiếp tục → Review chỉ hiện đúng 1 xe | **PASS** |
| 13 | Chọn định dạng MONTHLY_SUMMARY → banner cảnh báo đúng nội dung `vehicleMonthlySummaryOverride` hiện ra | **PASS** |
| 14 | Đổi sang định dạng PNL → banner biến mất (đúng, PNL tôn trọng tập xe) | **PASS** |
| 15 | Bấm **"Lập báo cáo"** thật | **PASS** — toast "✓ Đã lập báo cáo · tháng 8 năm 2026", không lỗi |
| 16 | Kiểm tra row DB vừa tạo | **PASS** — `trr_name`: *"Chi phí & lợi nhuận · Khu vực HCM · 1/2 xe"*; `trr_vehicle_ids`: `["...458.32"]`; `trr_vehicle_fuel`: chỉ 1 entry đúng xe đó |
| 17 | "Danh sách báo cáo" hiển thị đúng tên + định dạng EXCEL | **PASS** (screenshot) |
| 18 | **File Excel export thật** (`BaoCao_ChiPhiLoiNhuan_T8_2026_HCM.xlsx`) — người dùng tải về, Claude đọc bằng `exceljs` | Sheet "Danh sách chuyến đi": chỉ 1 dòng, đúng xe `51C-458.32`, cột **Trạng thái = "Đã lập BC"** (đúng — `snapshots.isReported` qua `vehicleReportedAt` mới thêm hoạt động chính xác). Sheet "Lợi nhuận theo xe": chỉ 1 dòng + TỔNG khớp đúng xe đó (doanh thu 8.500.000, phí xăng 1.364.000, lợi nhuận ròng 6.476.000). Sheet "Tổng hợp P&L": số khớp 100% với 2 sheet trên. **PASS** |

**Phát hiện phụ, KHÔNG liên quan REQ-20260817** (đã xác nhận không đụng file này trong diff): sheet "Lợi nhuận theo xe" có cột "Trạng thái" RIÊNG (khác cột "Trạng thái" ở sheet trip-log) luôn hiển thị "Tạm tính" — do `truck-report-workbook.ts:224` lấy từ `isTruckMonthClosed()` (bảng `car_truck_month_close` — cơ chế "chốt sổ" cũ đã bị thay bởi report-based từ PLAN-20260707) thay vì từ report vừa tạo. Đây là nhãn sai từ trước, không phải do REQ này — đã tách thành việc riêng, xem ghi chú cuối tài liệu.

## 3. Kết luận

- Build/lint/typecheck xanh, không hồi quy 2 màn trích xuất (REQ-20260814) qua kiểm tra routing SSR.
- BL-1 fold theo xe đã verify bằng dữ liệu thật (synthetic data test #9) VÀ bằng round-trip UI thật (test #11-18) — không còn khoảng trống.
- **Round-trip "Lập báo cáo" thật đã chạy thành công qua UI thật, file Excel xuất ra đã đối chiếu khớp 100%.**
- Đề xuất: đủ điều kiện mở PR vào `staging`.

## 4. Việc phát sinh (out of scope, đã tách riêng)

Cột "Trạng thái" ở sheet "Lợi nhuận theo xe" (`buildTruckReportWorkbook`, `truck-report-workbook.ts:224`) luôn hiển thị "Tạm tính" vì đọc từ bảng `car_truck_month_close` đã ngừng dùng, thay vì phản ánh report vừa lập. Đây là lỗi nhãn có từ trước REQ-20260817, phát hiện tình cờ khi đối chiếu file export — nên xử lý bằng 1 fix riêng, không gộp vào REQ này.
