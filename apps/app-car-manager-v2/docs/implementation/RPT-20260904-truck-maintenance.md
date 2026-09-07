# RPT-20260904 — Truck: Menu "Bảo trì" + chặn chuyến hai chiều + chi phí bảo trì vào phí cố định

> REQ: [REQ-20260904](../analysis/REQ-20260904-truck-maintenance.md) · PLN: [PLN-20260904](../plan/PLN-20260904-truck-maintenance.md) · TC: [TC-20260904](../test/TC-20260904-truck-maintenance.md) · TR: [TR-20260904](../test/TR-20260904-truck-maintenance.md)
> Trạng thái: **code xong, typecheck + lint xanh; migration `0030` đã áp lên Neon DEV (`ep-steep-tooth`); đã kiểm tra UI trực tiếp trên dev (TR §1b) — menu, list, tạo, chặn 2 chiều, dashboard/P&L/finance đều đúng.** Chưa áp staging (`ep-noisy-heart`), chưa deploy, chưa commit.

## 1. Tóm tắt

Thêm workspace truck menu **Bảo trì** (`/truck/maintenance`): danh sách + tạo/sửa/xoá bản ghi bảo trì (xe · bắt đầu · kết thúc · chi phí). Chi phí bảo trì là **thành phần thứ 3 của chi phí cố định** ở cấp tháng (không phân bổ theo chuyến), được cộng ở **một nguồn** (`computeTruckPnl`) nên dashboard, P&L, finance, review báo cáo, export và template báo cáo tháng cùng một con số. Trong khoảng bảo trì **không thể tạo/gán/sửa/hoàn thành/import chuyến** cho xe (`CAR-E1013`); ngược lại **không thể ghi bảo trì lên ngày xe đã có chuyến** (`CAR-E1014`) — hai chiều loại trừ, chặn cứng, không có "Vẫn tiếp tục".

## 2. Quy tắc đã cài (đối chiếu REQ §3 + §9)

| Quy tắc | Cài ở |
|---|---|
| Tháng hạch toán = tháng bắt đầu, 100 % (Q3) | `tmn_month` ghi lúc create/update (`start_date.slice(0,7)`) |
| `fixedCost = salary + depreciation + maintenanceCost`; bảo trì **không** zero khi 0 chuyến (Q7) | `computeTruckPnl` (`truck-pnl.service.ts`) |
| Không phân bổ theo chuyến (Q1) | `loadTruckFixedAllocation` / `computeTruckFixedAllocRows` / `trr_fixed_alloc` **không đổi** |
| Chặn chuyến ↔ bảo trì (BR-7, Q6) | `assertVehicleNotUnderMaintenance` gọi ở 7 action chuyến + import pre-scan |
| Chặn bảo trì ↔ chuyến (BR-8, Q5) | `assertNoTripsInMaintenanceWindow` ở create/update; form preview + disable + khoá Lưu |
| Khoá tháng chốt sổ | `assertMonthOpen` (whole-fleet + khu vực xe; update kiểm tra cả tháng cũ/mới) |
| Badge "dữ liệu đã thay đổi" sau CRUD bảo trì | `getTruckReportStatus` + finance page: thêm `getTruckMaintenanceLastUpdated` |
| Template BC: "Chi phí khác" giữ, **thêm** "Chi phí bảo trì" (Q2) | workbook dòng 25 mới, Σ dòng 26, mục C/D/E dịch 1 dòng |
| Region ACL | list/form qua `resolveVehicleScope`; action `requireRegion(cvh_region)` |
| "Ngày" = ngày ghi nhận (Q4) | cột `tmn_created_at` |

## 3. Danh sách file

### Mới
| File | Nội dung |
|---|---|
| `packages/db/src/schema/truck-maintenance.schema.ts` | Bảng `car_truck_maintenances` (prefix `tmn_`), 2 index |
| `packages/db/migrations/0030_truck_maintenance.sql` | DDL idempotent + CHECK `end ≥ start` |
| `packages/shared/src/errors/maintenance-guard.ts` | `CAR-E1013`, `CAR-E1014`, type guard details |
| `packages/shared/src/zod/truck-maintenance.zod.ts` | create/update/delete/preview schemas (`end_date ≥ start_date`, `cost ≥ 0`) |
| `packages/core/src/truck/truck-maintenance.ts` | `loadTruckMaintenanceMonthly`, `findVehicleMaintenanceOn`, `assertVehicleNotUnderMaintenance`, `listVehicleMaintenanceWindows`, `listBusyVehiclesInWindow`, `assertNoTripsInMaintenanceWindow`, `listOverlappingMaintenances`, `getTruckMaintenanceLastUpdated`, `utcDateKey` |
| `apps/web/src/server/actions/maintenance/truck-maintenance.actions.ts` | create / update / delete / `previewTruckMaintenanceConflictsAction` |
| `apps/web/src/server/queries/truck-maintenance.queries.ts` | `listTruckMaintenances` (join xe + người cập nhật), `getTruckMaintenance` |
| `apps/web/src/app/(app)/truck/maintenance/page.tsx` | Danh sách (lọc tháng/khu vực/xe, tổng tháng, chip trạng thái, mobile cards) |
| `apps/web/src/app/(app)/truck/maintenance/new/page.tsx` · `[id]/edit/page.tsx` | Trang tạo / sửa (`locked` khi tháng chốt) |
| `apps/web/src/app/(app)/truck/maintenance/_components/truck-maintenance-form.tsx` | Form client: preview xung đột debounce, disable xe có chuyến, banner đỏ/vàng, khoá Lưu |
| `docs/analysis/REQ-…`, `docs/plan/PLN-…`, `docs/test/TC-…`, `docs/test/TR-…`, `docs/implementation/RPT-…` | Tài liệu |

### Sửa
| File | Thay đổi |
|---|---|
| `packages/db/src/schema/index.ts` · `packages/shared/src/{errors,zod}/index.ts` · `packages/core/src/truck/index.ts` | export module mới |
| `packages/core/src/truck/truck-pnl.service.ts` | `TruckPnlRow.maintenanceCost`; cộng vào `fixedCost`; không zero khi 0 chuyến |
| `apps/web/src/server/actions/trips/truck-trip.actions.ts` | 7 điểm gọi `assertVehicleNotUnderMaintenance` (create / assign / complete / driverComplete / update (cũ+mới) / driverUpdate (cũ+mới) / patchCosts) |
| `apps/web/src/server/actions/imports/import.actions.ts` | Pre-scan mọi dòng theo khoảng bảo trì trước khi ghi (lỗi nêu số dòng) |
| `apps/web/src/server/queries/truck-report.queries.ts` | stale badge thêm nguồn bảo trì |
| `apps/web/src/server/queries/truck-report-export.queries.ts` | `ReportVehiclePnlRow.maintenance`, `totals.maintenance` (cả 2 nhánh) |
| `apps/web/src/server/lib/truck-monthly-summary-workbook.ts` | Dòng 25 "Chi phí bảo trì"; Σ → 26 (`SUM(C19:C25)`); C → 28–30; D → 32–35; E → 37/38, xe từ 39; `heights`; doc comment |
| `apps/web/src/app/(app)/truck/dashboard/page.tsx` | `acc.maintenanceCost`; lát donut "Bảo trì" (`--c5`); dòng + ghi chú ở card Tổng phí cố định (`CostSplit.note`) |
| `apps/web/src/app/(app)/truck/pnl/page.tsx` · `pnl/export/route.ts` | Dòng "Bảo trì" giữa Khấu hao và Tổng phí cố định; CostCard cố định thêm dòng |
| `apps/web/src/app/(app)/truck/finance/page.tsx` | Ghi chú dưới card Chi phí cố định; stale badge thêm nguồn bảo trì |
| `apps/web/src/app/(app)/truck/trips/_components/truck-trip-form.tsx` | prop `maintenanceWindows`; option xe disable + hậu tố "(bảo trì …)"; dòng đỏ; chặn submit client |
| `truck/trips/new`, `truck/trips/[id]/edit`, `today/truck/new`, `today/truck/[id]/edit` pages | Truyền `listVehicleMaintenanceWindows` |
| `apps/web/src/components/layout/nav-items.ts` | `NavKey` + item `truckMaintenance` (sau `truckDrivers`, section Vận hành) |
| `apps/web/src/components/list-row-actions.tsx` | `kind: 'maintenance'` |
| `apps/web/src/lib/format-action-error.ts` | Dịch `CAR-E1013` (+ biến thể dòng import) và `CAR-E1014` |
| `apps/web/messages/{vi,en,ko}.json` | `nav.truckMaintenance`, `screens.truckMaintenance.*`, `guard.VEHICLE_UNDER_MAINTENANCE[_ROW]`, `guard.MAINTENANCE_HAS_TRIPS`, `screens.truckTrips.form.vehicleMaintenance*`, `screens.truckPnl.maintenance`, `screens.truckDashboard.{kpiCostSub,tooltipCost,tooltipProfit,fixedMaintNote}`, `screens.truckFinance.{sumFixedMaintNote,thFixedAllocHint}`, `exportContent.{truckPnl,truckMonthlySummary}.lineMaintenance` |

## 4. Quyết định kiến trúc đáng lưu ý

- **Bảng riêng** thay vì thêm cột vào `car_truck_fixed_costs`: bảo trì là danh sách sự kiện có khoảng ngày, nhiều lần/tháng, phải chặn chuyến theo ngày → cần bảng riêng. `car_maintenance_alerts` (cảnh báo dầu/đăng kiểm CAR) và `cvh_status = MAINTENANCE` giữ nguyên, không đồng bộ.
- **Một nguồn số**: cộng trong `computeTruckPnl` thay vì chỉ ở dashboard, để "Tổng phí cố định" trùng nhau ở mọi màn (REQ C2). Hệ quả có chủ ý: Σ lợi nhuận theo chuyến ≠ lợi nhuận tháng đúng bằng tiền bảo trì — đã ghi chú trên UI (dashboard card + finance card + tooltip cột phân bổ).
- **Hai chiều BLOCK** (không dùng pattern guard mềm `CONFIRM_REQUIRED`): theo quyết định Q5/Q6. Kiểm tra ở mọi đường sửa chuyến là phòng thủ vì trạng thái "chuyến trong khoảng bảo trì" không thể phát sinh qua UI.
- **Template BC thêm dòng** thay vì đổi nhãn: theo Q2. Công thức Excel dịch theo; mục E/TỔNG vẫn cân với mục B/C vì cùng đọc `p.fixedCost`/`p.netProfit`.
- So ngày bằng chuỗi `YYYY-MM-DD` UTC (cùng `monthKey`) — không lệch ngày với giờ VN vì `scheduled_at` luôn là 00:00Z.

## 5. Triển khai

1. **Migration trước, deploy sau**: `0030_truck_maintenance.sql` (idempotent) trên Neon dev → staging → prod. Build mới đọc bảng ngay ở dashboard/P&L → thiếu bảng = 500.
2. Deploy staging → chạy TC nhóm A–D (đặc biệt C2/C3/C6/C9, B4/B11).
3. Không cần backfill; không đổi dữ liệu cũ. Bản ghi bảo trì đầu tiên mới làm số thay đổi.
4. Báo cáo tháng đã lập trước đó (file Excel cũ) không đổi; lập lại mới có dòng 25.

## 6. Còn lại / đề xuất

- E2E Playwright chưa viết (chưa có môi trường chạy) — xem TR §3.
- Nếu muốn card "Tình trạng đội xe" trên dashboard đếm cả xe đang trong khoảng bảo trì theo bản ghi (không chỉ `cvh_status`), làm REQ riêng (ngoài phạm vi, BR-12).
- Trường ghi chú bảo trì: chưa có theo Q8; thêm sau cần 1 cột nullable + 1 field form.
