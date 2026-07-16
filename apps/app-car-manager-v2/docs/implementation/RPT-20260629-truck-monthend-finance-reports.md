# RPT-20260629 — Truck: mô hình tài chính cuối tháng + Chi phí&Lợi nhuận per-trip + Báo cáo

| | |
|---|---|
| **Ngày** | 2026-06-29 |
| **Tài liệu** | [REQ](../analysis/REQ-20260629-truck-monthend-finance-reports.md) · [PLAN](../plan/PLAN-20260629-truck-monthend-finance-reports.md) · [TC](../test/TC-20260629-truck-monthend-finance-reports.md) · [TR](../test/TR-20260629-truck-monthend-finance-reports.md) |
| **Trạng thái** | Code xong + typecheck + smoke PASS. Chờ nghiệm thu local + chưa commit/push. |

## 1. Mục tiêu đã đạt

Chuyển mô hình tài chính xe tải sang **cuối tháng** đúng SRS khách hàng (`netcost.txt`), bổ sung màn per-trip Chi phí&Lợi nhuận và module Báo cáo cho truck ADMIN/MANAGER. Thay thế quyết định REQ-20260623 P1/P3 (xem REQ §0).

## 2. Triển khai theo pha

- **A — DB + core**: migration `0016` (4 cột snapshot trên `car_truck_month_close`, bảng `car_truck_reports`, cột `car_users.usr_truck_reports_seen_at`); `truckTripFuelCost()`; `computeTruckPnl` dùng snapshot khi tháng chốt, else fallback `liters×price`.
- **B — P&L 2 tab**: `closeTruckMonthAction` tính + đóng băng snapshot (giá BQ = mean đơn giá hoá đơn; định mức = Σlít hoá đơn ÷ Σkm chuyến COMPLETED); `reopenTruckMonthAction` siết **ADMIN-only**; `/truck/pnl` tách 2 tab + card biến-đổi/cố-định + card tổng hợp cuối tháng + banner tạm tính + lịch sử điều chỉnh.
- **C — Per-trip finance**: `/truck/finance` (bảng Tạm tính/Đã chốt + summary cards + lọc xe + export Excel); nav `truckFinance`, đổi nhãn `truckPnl` → "P&L tháng & Chốt sổ".
- **D — Báo cáo**: `generateTruckReportAction` 3 loại (PNL/TRIP_LOG/VEHICLE) → Excel → S3 → `car_truck_reports`; `/truck/reports` (list group tháng + badge "Mới"), `/truck/reports/new` (stepper chọn tháng+loại), `/truck/reports/[id]/download` (presigned); badge "Mới" DB-backed nối qua app-shell → SidebarNav (chỉ query cho staff có TRUCK).
- **E — Đồng bộ**: `listTruckTrips` snapshot-aware (+`finalized`) → LN nhất quán giữa trips list / dashboard / finance; badge "Tạm tính" ở trips list; banner tạm tính ở dashboard.

## 3. File thay đổi (~25)

**DB** — `migrations/0016_truck_monthend_reports.sql` (new); `schema/{truck-month-close,users}.schema.ts` (sửa), `schema/truck-report.schema.ts` (new), `schema/index.ts`.
**Core** — `truck/truck-cost.ts` (`truckTripFuelCost`), `truck/truck-pnl.service.ts` (snapshot+fallback).
**Queries** — `truck-finance.queries.ts` (snapshot fix + `getTruckMonthCloseInfo`, `listTruckMonthAdjustments`, `listTruckFinanceTrips`), `truck-trips.queries.ts` (snapshot-aware + `finalized`), `truck-report.queries.ts` (new).
**Actions** — `settings/truck-finance.actions.ts` (close snapshot · reopen ADMIN), `truck-report.actions.ts` (new); `services/audit-log.service.ts` (+`TruckReport`).
**Pages/UI** — `truck/pnl/page.tsx` + `_components/{month-close-controls,fuel-invoice-panel}.tsx`; `truck/finance/{page,export/route}.tsx` + components (new); `truck/reports/{page,new/page,[id]/download/route}.tsx` + `_components/*` (new); `truck/trips/page.tsx`, `truck/dashboard/page.tsx`; `components/layout/{nav-items,app-shell,app-shell-client,sidebar-nav}.tsx`; `lib/s3-client.ts` (`putObject`).
**i18n** — `messages/{vi,en,ko}.json`: `screens.truckPnl` (+16), `screens.truckFinance` (+28), `screens.truckReports` (+23), `screens.truckTrips.provisional`, nav (truckFinance/truckReports/truckReportCreate + relabel truckPnl).

## 4. Quyết định chốt
- Q-A **Tạm tính** (hiển thị số tạm tính + badge, không ẩn) · Q-B màn per-trip **route riêng** `/truck/finance` · Q-C badge "Mới" **DB-backed** (`usr_truck_reports_seen_at`) · Q-D **đủ 3 loại** báo cáo.
- Snapshot lưu trên `car_truck_month_close` → tính phí xăng/chuyến khi đọc (deterministic, recompute được, không migrate `car_trips`).
- Chốt không hoá đơn → snapshot NULL → fallback (không zero hoá). Tháng chốt trước 0016 → fallback (số cũ nguyên).

## 5. Migration & deploy
- `0016` đã apply **local** (ep-steep-tooth). **Chưa** apply ep-noisy-heart / ep-gentle-rain.
- Deploy staging-car-truck: apply `0016` vào **ep-noisy-heart** (idempotent), **KHÔNG** ep-gentle-rain.
- Verify deploy: bật màn `/truck/pnl`, `/truck/finance`, `/truck/reports`.

## 6. Việc còn lại
- Nghiệm thu local theo TC-01..12 (dữ liệu thật).
- Review diff → commit → push (chờ OK).
- (Tùy chọn tương lai) PDF báo cáo; định mức/giá BQ theo từng xe (hiện fleet-level theo tháng).
