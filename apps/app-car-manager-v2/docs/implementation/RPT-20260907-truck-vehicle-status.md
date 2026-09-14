# RPT-20260907 — Truck: Trạng thái Phương tiện (Sẵn sàng · Bảo trì tự động · Ngừng sử dụng)

> REQ: [REQ-20260907-truck-vehicle-status.md](../analysis/REQ-20260907-truck-vehicle-status.md) · PLN: [PLN-20260907-truck-vehicle-status.md](../plan/PLN-20260907-truck-vehicle-status.md) · TC: [TC-20260907-truck-vehicle-status.md](../test/TC-20260907-truck-vehicle-status.md) · TR: [TR-20260907-truck-vehicle-status.md](../test/TR-20260907-truck-vehicle-status.md)
> Trạng thái: **code xong, typecheck + lint xanh; migration `0031` đã áp Neon DEV (`ep-steep-tooth`, UPDATE 2 → chạy lại 0) và STAGING truck (`ep-noisy-heart`, 20:1x 07/09/2026, UPDATE 0 — 3 xe đều AVAILABLE); đã kiểm tra trên dev theo TC (xem TR §A–I).** Code đã push nhánh `feature/truck-maintenance-vehicle-status` (commit `e35f396`, gộp cùng REQ-20260904) — chờ PR + deploy staging + smoke test.

## 1. Quyết định đã chốt (người dùng, 2026-09-07)

| Q | Chốt |
|---|---|
| Q1 | Bảo trì **dẫn xuất khi đọc** từ `car_truck_maintenances` (start ≤ hôm nay UTC ≤ end); không lưu, không cron |
| Q2 | Chặn tạo chuyến khi bảo trì **theo ngày chuyến** (BR-7 REQ-20260904, đã có) |
| Q3 | Chỉ xe tải; xe con không đổi |
| Q4 | Xe Ngừng sử dụng vẫn trong scope báo cáo tháng |
| Q5 | **Phương án A** — 3 trạng thái, bỏ "Đang sử dụng" khỏi màn xe tải |

## 2. Nội dung đã triển khai

- **Core** `packages/core/src/truck/truck-vehicle-status.ts` (mới): `TruckVehicleStatus`, `TRUCK_VEHICLE_STATUSES`, `TRUCK_STORED_STATUSES`/`isTruckStoredStatus`, `resolveTruckVehicleStatus(stored, activeWindow)` (RETIRED > MAINTENANCE > AVAILABLE), `loadActiveMaintenanceByVehicle(entId, dateIso, ids?)` (1 query, nhiều bản ghi chồng ngày → giữ `end_date` xa nhất). Export qua `index.ts`.
- **Query web** `apps/web/src/server/queries/truck-vehicles.queries.ts` (mới): `listTrucksWithStatus` (status hiệu lực + `maintenanceUntil`), `listDispatchableTrucks(entId, keepId?)` (loại RETIRED, giữ xe hiện tại khi sửa).
- **Guard**: `updateVehicleAction` từ chối `MAINTENANCE`/`IN_USE` cho xe TRUCK → `CAR-E1001`; `truck-maintenance.actions.ts › loadTruck` từ chối xe RETIRED → `CAR-E1002 409`.
- **UI Phương tiện** `/truck/fleet`: bộ lọc 3 trạng thái, badge theo status hiệu lực + tooltip mô tả (`title`) + dòng "đến dd/mm/yyyy" khi Bảo trì (bảng + mobile). Form sửa (`truck-vehicle-form.tsx`): field "Trạng thái" 2 lựa chọn (chỉ khi sửa) + hint; hộp ⓘ "Xe đang bảo trì đến … — gán tự động" + link `/truck/maintenance?vehicle=…` khi xe đang trong khoảng bảo trì. Form tạo không có field (mặc định Sẵn sàng).
- **Dashboard** card "Tình trạng đội xe": 3 dòng theo status hiệu lực; dòng Bảo trì là link tới `/truck/maintenance`.
- **Picker** loại xe RETIRED: `truck/trips/new`, `truck/trips/[id]/edit`, `today/truck/new`, `today/truck/[id]/edit`, `truck/import`, `truck/maintenance/new|[id]/edit` (trang sửa giữ xe hiện tại). Cơ chế mờ theo ngày bảo trì (REQ-20260904) giữ nguyên.
- **Báo cáo tháng** `truck-report-export.queries.ts`: `scopeVehicles.status` = status hiệu lực tại thời điểm lập (KPI "xe bảo dưỡng" + dòng mục E).
- **i18n** vi/en/ko: `screens.truckFleet.status.*`, `statusDesc.*`, `maintUntil`, `form.status`, `form.statusHint`, `form.statusMaintenanceNote`, `form.statusMaintenanceLink`. `vehicles.status.*` (CAR) không đổi.
- **DB** `packages/db/migrations/0031_truck_vehicle_status_normalize.sql`: TRUCK `MAINTENANCE|IN_USE` → `AVAILABLE` (dữ liệu, idempotent). Dev: 43C-201.55 (MAINTENANCE tay) và 60C-311.07 (IN_USE tay) → AVAILABLE.

## 3. File thay đổi

| Phân loại | File | Loại |
|---|---|---|
| Core | `packages/core/src/truck/truck-vehicle-status.ts` | Mới |
| Core | `packages/core/src/truck/index.ts` | Sửa |
| Backend | `apps/web/src/server/queries/truck-vehicles.queries.ts` | Mới |
| Backend | `apps/web/src/server/actions/vehicles/vehicle.actions.ts` | Sửa |
| Backend | `apps/web/src/server/actions/maintenance/truck-maintenance.actions.ts` | Sửa |
| Backend | `apps/web/src/server/queries/truck-report-export.queries.ts` | Sửa |
| Frontend | `apps/web/src/app/(app)/truck/fleet/page.tsx` · `[id]/edit/page.tsx` · `_components/truck-vehicle-form.tsx` | Sửa |
| Frontend | `apps/web/src/app/(app)/truck/dashboard/page.tsx` | Sửa |
| Frontend | `truck/trips/new` · `truck/trips/[id]/edit` · `today/truck/new` · `today/truck/[id]/edit` · `truck/import` · `truck/maintenance/new` · `truck/maintenance/[id]/edit` (`page.tsx`) | Sửa |
| Frontend (lib) | `apps/web/src/lib/format-day.ts` | Mới — `DAY_FORMAT`, `formatDay(d, loc)`, `formatDayKey(iso, loc)`: một định dạng ngày `dd/mm/yyyy` cho toàn workspace TRUCK (khớp `DateTimeCell`). Bổ sung theo QA 07/09 18:5x–19:0x |
| Frontend | `truck/trips/page.tsx` · `truck/maintenance/page.tsx` · `truck/finance/page.tsx` · `truck/dashboard/page.tsx` · `truck/drivers/page.tsx` · `truck/reports/_components/report-review-step.tsx` · `today/truck/[id]/page.tsx` | Sửa — cột "Ngày"/ngày chuyến dùng `formatDay` (trước: `toLocaleDateString(loc)` → "5/9/2026") |
| Frontend | `truck/trips/_components/truck-trip-form.tsx` · `truck/maintenance/_components/truck-maintenance-form.tsx` · `truck/fleet/page.tsx` · `truck/fleet/_components/truck-vehicle-form.tsx` | Sửa — khoảng ngày bảo trì / "đến dd/mm/yyyy" dùng `formatDayKey` |
| Backend + Frontend | `server/queries/truck-finance.queries.ts` (`ReportReviewVehicle` + `salary/depreciation/maintenanceCost`) · `truck/reports/_components/report-review-step.tsx` (`Stat` nhận `sub`; thẻ "Tổng chi phí cố định" có dòng phân rã Lương · Khấu hao · Bảo trì, khoản 0 mờ, bảo trì > 0 nổi tông warning) | Sửa — QA menu Lập báo cáo 07/09 19:1x–19:3x, theo mẫu người dùng duyệt |
| Backend (lib dùng chung) | `apps/web/src/server/lib/pdf.ts` | Sửa — footer "Generated: HH:mm:ss dd/mm/yyyy" (`formatStamp`) và ô ngày trong bảng PDF dùng `formatDay`; trước đó `toLocaleString('vi-VN')` ra "7/9/2026". Ảnh hưởng mọi PDF (CAR + TRUCK), chỉ đổi đệm số 0. QA 07/09 19:5x |
| i18n | `apps/web/messages/vi.json` · `en.json` · `ko.json` (thêm `screens.truckReports.cardFixedSalary/Depreciation/Maintenance`) | Sửa |
| DB | `packages/db/migrations/0031_truck_vehicle_status_normalize.sql` | Mới |
| Docs | REQ/PLN/TC/TR/RPT-20260907 | Mới |

## 4. Quyết định kỹ thuật & side-impact ghi nhận

- Dẫn xuất thay vì lưu: một nguồn sự thật, không job nền; chi phí +1 query có index ở các trang có danh sách xe tải.
- `STORED_STATUSES` lặp lại trong `truck-vehicle-form.tsx` (client component) thay vì import từ core — core kéo theo `@car-v2/db/client`, không được vào bundle client.
- Sửa bản ghi bảo trì của xe đã ngừng (không đổi xe) cũng bị `CAR-E1002` (BR-4); xoá vẫn được.
- Báo cáo: status là "tại thời điểm lập" (BR-9). Ví dụ đã thấy: lập lại báo cáo 08/2026 lúc 29C đang bảo trì (07–09/09) → KPI "1 hoạt động · 1 bảo dưỡng", dòng 29C = Bảo trì mặc dù tháng 8 xe không bảo trì. Nếu muốn "bảo trì trong tháng báo cáo" → REQ khác.
- "Đang sử dụng" không còn trên màn truck (Q5-A); nếu cần "xe có chuyến hôm nay" → chỉ số riêng trên dashboard (REQ khác).

## 5. Kiểm thử

Xem [TR-20260907](../test/TR-20260907-truck-vehicle-status.md). Tóm tắt: typecheck + lint xanh; 0031 áp dev (2 → 0); A1–A7, B1–B9, C1–C3/C5–C9, D1–D2/D4(alt), E2, F1–F5 đạt trên dev; C4/C10/D5/D6/E1/E3 không chạy (không có dữ liệu phù hợp hoặc hành vi kế thừa không đổi — ghi rõ trong TR).

## 6. Dữ liệu test để lại trên dev

- Bản ghi bảo trì 29C-99999 07–09/09/2026 · 0 ₫ (để thấy badge Bảo trì "đến 09/09/2026" tới hết 09/09 UTC).
- 60C-311.07 = Ngừng sử dụng (đổi qua form; trước đó là IN_USE tay).
- Báo cáo `Tổng kết chi phí tháng · Khu vực HCM` 08/2026 tạo 18:27 07/09/2026.

## 7. Kế tiếp

1. ✅ `0030` + `0031` đã áp staging truck `ep-noisy-heart` (07/09 20:1x): bảng `car_truck_maintenances` + 3 index + check constraint; 0031 UPDATE 0. Không đụng `ep-gentle-rain` (staging chung — xem RPT-20260813 §DB staging).
2. ✅ Push nhánh `feature/truck-maintenance-vehicle-status` (61 file, `e35f396`) → người dùng tạo PR vào `staging`.
3. Sau merge: deploy staging → smoke test theo TC-20260904 + TC-20260907 → `staging → main` theo quy trình.
