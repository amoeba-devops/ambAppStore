# PLN-20260904 — Truck: Menu "Bảo trì" + chặn tạo chuyến + cộng chi phí bảo trì vào dashboard

> Kèm [REQ-20260904-truck-maintenance.md](../analysis/REQ-20260904-truck-maintenance.md). Kế hoạch viết theo **khuyến nghị Q1–Q8** của REQ (một nguồn `computeTruckPnl`; hạch toán tháng bắt đầu; chặn cứng BR-7; không phân bổ theo chuyến). Nếu người dùng chốt khác → cập nhật §2 tương ứng trước khi code.

## 1. Hiện trạng phát triển liên quan

- Stack: Next 15 App Router + Drizzle/Neon, standalone Turborepo `apps/app-car-manager-v2`; UI `@car-v2/ui` (Card/Table/Select/Input/Badge/toast), pattern trang list = `truck/fleet/page.tsx`, form = `truck-vehicle-form.tsx`, hàng thao tác = `components/list-row-actions.tsx` (`kind: 'vehicle'|'driver'|'trip'`).
- Công thức tháng: [truck-pnl.service.ts](../../packages/core/src/truck/truck-pnl.service.ts) `computeTruckPnl` (fixedCost = salary + depreciation, về 0 khi 0 chuyến); nguồn cố định [truck-fixed-monthly.ts](../../packages/core/src/truck/truck-fixed-monthly.ts); phân bổ theo chuyến [truck-fixed-allocation.ts](../../packages/core/src/truck/truck-fixed-allocation.ts) (**không đụng**).
- Guard tạo chuyến: [`_guard-helpers.ts`](../../apps/web/src/server/actions/_guard-helpers.ts) (mềm, `CONFIRM_REQUIRED_CODE = CAR-E1012`), `assertTruckMonthOpen` ([truck-finance.queries.ts](../../apps/web/src/server/queries/truck-finance.queries.ts)). Mã lỗi đã dùng (grep 2026-09-04): E1001–E1006, E1009, E1012 → mã mới **`CAR-E1013`** (chưa dùng).
- 6 đường tạo/sửa chuyến (REQ §2.4): `truck-trip.actions.ts` (5 action) + `imports/import.actions.ts`.
- Nav: [nav-items.ts](../../apps/web/src/components/layout/nav-items.ts) (`NavKey` union, `NAV_ITEMS`, section), mobile overflow tự động theo thứ tự mảng.
- Migration mới nhất: `0029_truck_report_fixed_alloc.sql` → kế tiếp **`0030_truck_maintenance.sql`** (áp tay, idempotent).
- Report: `truck-report-export.queries.ts` (`ReportVehiclePnlRow`, `totals`) + `truck-monthly-summary-workbook.ts` (dòng 19–24 mục B, dòng 24 = `lineOther` = bảo hiểm = 0).
- Stale badge: `truck-report.queries.ts › getTruckReportStatus` (trips max updated + fixed costs last updated).

## 2. Kế hoạch theo Phase

### Phase A — DB

- **A1** Schema `packages/db/src/schema/truck-maintenance.schema.ts` — bảng `car_truck_maintenances`:

  | Cột | Kiểu | Ghi chú |
  |---|---|---|
  | `tmn_id` | CHAR(36) PK | |
  | `ent_id` | CHAR(36) NOT NULL | multi-tenant |
  | `cvh_id` | CHAR(36) NOT NULL → `car_vehicles.cvh_id` | xe TRUCK (kiểm tra ở action) |
  | `tmn_start_date` | DATE NOT NULL | |
  | `tmn_end_date` | DATE NOT NULL | `≥ start` (zod) |
  | `tmn_month` | VARCHAR(7) NOT NULL | `= start 'YYYY-MM'` (BR-1), derive lúc ghi |
  | `tmn_cost` | DECIMAL(14,2) NOT NULL DEFAULT 0 | VND, quy ước như `tfc_*` |
  | `tmn_created_by` / `tmn_created_at` | CHAR(36) / TIMESTAMPTZ NOT NULL DEFAULT now() | "Ngày" trong list |
  | `tmn_updated_by` / `tmn_updated_at` | CHAR(36) / TIMESTAMPTZ | "Cập nhật bởi" / "Cập nhật" (fallback created_*) |
  | `tmn_deleted_at` | TIMESTAMPTZ | soft delete |

  Index: `idx_car_truck_maintenances_ent_vehicle_range (ent_id, cvh_id, tmn_start_date, tmn_end_date) WHERE tmn_deleted_at IS NULL` (tra chặn chuyến); `idx_car_truck_maintenances_ent_month (ent_id, tmn_month)` (P&L).
  - └─ Side-impact: bảng độc lập, không đụng bảng cũ.
- **A2** `packages/db/src/schema/index.ts` export thêm.
- **A3** Migration `packages/db/migrations/0030_truck_maintenance.sql` (mục 5). Áp local → staging → prod theo checklist `pre-deploy-check`.

### Phase B — Core + Zod (pure, không `next/*`)

- **B1** `packages/core/src/truck/truck-maintenance.ts`:
  ```ts
  loadTruckMaintenanceMonthly(entId, months, { vehicleId?, vehicleIds? })
    → { forMonth(month): number /* Σ round(tmn_cost) trong scope */, byVehicleMonth(month, vehicleId): number }
  findVehicleMaintenanceOn(entId, vehicleId, dateIso /*YYYY-MM-DD*/, excludeId?)
    → { tmnId, startDate, endDate, plate } | null      // BR-7 predicate: start ≤ date ≤ end, live
  findTripsInMaintenanceWindow(entId, vehicleId, startIso, endIso)
    → { count, refs: string[] /* ≤3 */ }                 // BR-8 cảnh báo form
  assertVehicleNotUnderMaintenance(entId, vehicleId | null, scheduledAt: Date)
    → throw CarError('CAR-E1013', 409, 'Vehicle under maintenance …', { plate, start, end })
  ```
  So ngày bằng chuỗi `scheduledAt.toISOString().slice(0,10)` (cùng UTC với `monthKey`).
- **B2** `truck-pnl.service.ts`:
  - `TruckPnlRow` thêm `maintenanceCost: number`; `emptyRow` khởi tạo 0.
  - Sau vòng `fixedMonthly`: `row.maintenanceCost = maint.forMonth(m)` (scope = `vehicleId` / `scopedVehicleIds` — **cùng tập xe** đã resolve cho lương/KH).
  - Vòng cuối: `row.fixedCost = row.salary + row.depreciation + row.maintenanceCost`; khối zero-khi-0-chuyến **chỉ** zero lương/KH/bảo hiểm (BR-3, không đụng `maintenanceCost`).
  - └─ Side-impact: **mọi** caller `computeTruckPnl` đổi số `fixedCost`/`netProfit` → xem Phase F để thêm dòng hiển thị tương ứng, tránh "tổng ≠ Σ dòng".
- **B3** `packages/core/src/truck/index.ts` export.
- **B4** Zod `packages/shared/src/zod/truck-maintenance.zod.ts`:
  ```ts
  createTruckMaintenanceSchema = z.object({
    vehicle_id: z.string().uuid(),
    start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    end_date:   z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    cost: z.number().nonnegative().max(1_000_000_000_000),
  }).refine(d => d.end_date >= d.start_date, { path: ['end_date'] });
  updateTruckMaintenanceSchema = create.extend({ maintenance_id: uuid });
  deleteTruckMaintenanceSchema = z.object({ maintenance_id: uuid });
  ```
- **B5** `packages/shared/src/errors/` — hằng `VEHICLE_UNDER_MAINTENANCE_CODE = 'CAR-E1013'` + type guard `isMaintenanceBlockDetails(details)` (client dùng để dịch toast).

### Phase C — Server actions + queries

- **C1** `apps/web/src/server/actions/maintenance/truck-maintenance.actions.ts`:
  - `createTruckMaintenanceAction` / `updateTruckMaintenanceAction` / `deleteTruckMaintenanceAction`: `requireRole(['ADMIN','MANAGER'])` → `requireFleet('TRUCK')` → xe phải là TRUCK còn sống, `requireRegion(actor, cvh_region)` nếu xe có region (BR-13) → `isTruckMonthClosed(tmn_month, region)` **và** whole-fleet (BR-10; update kiểm tra cả tháng cũ + mới) → ghi → `logAudit({ action: 'TRUCK_MAINTENANCE.CREATE|UPDATE|DELETE', entity: 'Vehicle', entityId: cvh_id, entityRef: plate, after: { start, end, cost, overlappingTripRefs } })` → `revalidatePath` `/truck/maintenance`, `/truck/dashboard`, `/truck/pnl`, `/truck/finance`.
  - Trả về `{ id, overlappingTrips: { count, refs } }` để client toast kèm cảnh báo (BR-8).
- **C2** `apps/web/src/server/queries/truck-maintenance.queries.ts`:
  - `listTruckMaintenances(entId, { month?, vehicleId?, region?, regions? })` → join `car_vehicles` (plate, model, region) + `car_users` (`usr_name` của `updated_by ?? created_by`); sort `tmn_start_date desc`; kèm `monthTotal` cho tháng đang lọc.
  - `getTruckMaintenance(entId, id)`; `getTruckMaintenanceLastUpdated(entId, month)` = `max(coalesce(updated_at, created_at), deleted_at)` (BR-11).
  - `listVehicleMaintenanceWindows(entId, vehicleIds)` → `{ vehicleId, start, end }[]` cho form chuyến (Phase E).
- **C3** `truck-report.queries.ts › getTruckReportStatus`: stale thêm `maintenanceUpdatedAt > latest.createdAt`.
- **C4** `audit-log.service.ts` `AuditEntity` giữ `'Vehicle'` (không thêm entity mới — audit cell chỉ hiển thị `entityRef`).

### Phase D — UI: menu + danh sách + form

- **D1** Nav `nav-items.ts`: `NavKey` thêm `'truckMaintenance'`; item `{ key:'truckMaintenance', href:'/truck/maintenance', Icon: Wrench, group:'workspace', section:'operations', roles: STAFF, fleet:'TRUCK' }` đặt **ngay sau `truckDrivers`** → desktop hiện cuối nhóm Vận hành; mobile rơi vào sheet "Thêm" (thanh dưới giữ Chuyến · Đội xe · Tài xế). `activeKeyFor` không cần sửa (prefix dài nhất).
- **D2** Trang list `app/(app)/truck/maintenance/page.tsx` (server component, mirror `truck/fleet/page.tsx`): `resolveRegionFilter` + `resolveVehicleScope`; filter `MonthPicker` (mặc định tháng hiện tại; cho phép "tất cả" = bỏ param), `ParamSelect region`, `ParamSelect vehicle`; desktop `Table`, mobile card list; `EmptyState`; hàng click → `/truck/maintenance/[id]/edit`.
- **D3** `components/list-row-actions.tsx`: thêm `kind: 'maintenance'` → `deleteTruckMaintenanceAction({ maintenance_id })`.
- **D4** Trang `new/page.tsx`, `[id]/edit/page.tsx` + `_components/truck-maintenance-form.tsx` (client): Select xe (trucks trong scope, label `plate · model`), `Input type="date"` ×2 (Kết thúc tự = Bắt đầu khi trống/nhỏ hơn), `MoneyInput` chi phí; hint tháng hạch toán + khoảng chặn chuyến; **preview xung đột** qua server action read-only `previewTruckMaintenanceConflictsAction` (debounce 300 ms, chạy ngay khi mở trang sửa và mỗi khi đổi xe/ngày — **Q5 chốt**): xe có chuyến trong khoảng → **disable** trong Select (hậu tố "(có N chuyến trong khoảng)"), xe đang chọn có chuyến → banner đỏ liệt kê mã chuyến + **khoá nút Lưu**; bản ghi bảo trì khác của cùng xe trùng khoảng → banner vàng (mềm); `locked` khi tháng chốt; toast success/err theo pattern hiện có; nút Xoá trên trang sửa (`confirm()`).
- **D5** Chip trạng thái dẫn xuất (UI-only, không lưu): `Sắp tới` (today < start) · `Đang bảo trì` (start ≤ today ≤ end) · `Đã xong` (today > end) — theo ngày UTC.

### Phase E — Chặn tạo chuyến (BR-7, BR-9)

- **E1** `truck-trip.actions.ts` (**Q6 chốt: không cho phép sửa chuyến trong khoảng bảo trì**):
  - `createTruckTripAction`: sau `assertTruckMonthOpen`, trước `ensureAssignmentConfirmed` → `assertVehicleNotUnderMaintenance(entId, dto.vehicle_id, new Date(dto.scheduled_at))`.
  - `assignTruckTripAction`: với `asgTrip.trpScheduledAt` + `dto.vehicle_id`.
  - `updateTruckTripAction` / `driverUpdateTruckTripAction`: kiểm tra **cả** (xe, ngày) đang lưu **và** (xe, ngày) mới — bất kể field nào đổi.
  - `completeTruckTripAction` / `driverCompleteTruckTripAction` / `patchTruckTripCostsAction`: kiểm tra (xe, ngày) đang lưu.
- **E2** `import.actions.ts`: sau vòng `months` lock, pre-scan `for (i, iso of dates)` → nếu `findVehicleMaintenanceOn(entId, dto.vehicle_id, iso)` → `CarError('CAR-E1013', 409, 'Row {i+2}: vehicle {plate} under maintenance {start}–{end}')` **trước khi ghi bất kỳ chuyến nào** (cùng chiến lược BUG-260824).
- **E3** Form chuyến `truck-trip-form.tsx`: prop mới `maintenanceWindows?: { vehicleId, start, end }[]`; option xe có hậu tố `(bảo trì dd/MM–dd/MM)` và `disabled` khi `f.scheduledAt` ∈ khoảng; nếu đổi ngày làm xe đang chọn rơi vào khoảng → hiện dòng cảnh báo đỏ dưới Select (server vẫn là nguồn chặn). Truyền prop từ `truck/trips/new`, `truck/trips/[id]/edit`, `today/truck/new`, `today/truck/[id]/edit`.
- **E4** `lib/format-action-error.ts`: `CAR-E1013` + details → `t('guard.VEHICLE_UNDER_MAINTENANCE', { plate, start, end })` (định dạng ngày theo locale).

### Phase F — Cộng chi phí bảo trì vào các màn (Q1 = mọi màn)

- **F1** Dashboard `truck/dashboard/page.tsx`: `acc` thêm `maintenanceCost`; donut thêm lát `{ name: tPnl('maintenance'), value: acc.maintenanceCost, color: 'hsl(var(--c5))' }` (giữ nguyên nguyên tắc "mọi thành phần của `totalCost` là 1 lát"); `CostSplit` cố định thêm dòng "Bảo trì" + ghi chú nhỏ "không phân bổ theo chuyến"; i18n `kpiCostSub`, `tooltipCost`, `tooltipProfit` thêm "chi phí bảo trì". KPI Tổng chi phí / LN ròng / delta **tự đúng** qua `fixedCost`.
- **F2** P&L `truck/pnl/page.tsx`: `METRICS` thêm `{ key:'maintenanceCost', labelKey:'maintenance' }` **giữa `depreciation` và `fixedCost`**; `CostCard` cố định thêm dòng; `fixedHint` giữ ("Cố định hàng tháng, không phụ thuộc số chuyến").
- **F3** P&L export `truck/pnl/export/route.ts`: thêm `{ labelKey:'lineMaintenance', pick: r => r.maintenanceCost }` cùng vị trí.
- **F4** Finance `truck/finance/page.tsx`: card `sumFixed` thêm `note` = `t('sumFixedMaintNote', { x })` khi `summary.maintenanceCost > 0`; `thFixedAllocHint` bổ sung câu "Chi phí bảo trì không phân bổ theo chuyến".
- **F5** Review BC `getTruckReportReview`: `v.fixedCost` từ `computeTruckPnl` tự cộng; `totals.fixedCost/net` tự đúng. Wizard hiển thị "Chi phí cố định" từng xe — kiểm tra label (nếu có breakdown lương/KH thì thêm dòng bảo trì).
- **F6** Template BC tháng (**Q2 chốt: "Chi phí khác" ≠ "Chi phí bảo trì"**): `ReportVehiclePnlRow` thêm `maintenance: number` (= `p.maintenanceCost`); `totals` thêm `maintenance`; workbook **giữ dòng 24 "Chi phí khác"**, **thêm dòng 25 `lineMaintenance`**, Σ chuyển xuống dòng 26 = `SUM(C19:C25)`, mục C → 28–30 (LN gộp `C16−C26`, margin `C29/C16`), mục D → 32–35, mục E header 37–38, dòng xe từ 39; bảng `heights` dịch tương ứng. Sheet từng xe `costTotal`/`net` tự cộng (đã dùng `p.fixedCost`/`p.netProfit`) → mục B, mục C, mục E **cân nhau**. `includeIdle` totals reduce thêm `maintenance`.
- **F7** `truck-report.actions.ts`: không đổi (`trr_fixed_alloc` không chứa bảo trì — BR-6).

### Phase G — i18n (vi/en/ko)

| Key | vi (mẫu) |
|---|---|
| `nav.truckMaintenance` | Bảo trì |
| `screens.truckMaintenance.title/subtitle` | Bảo trì · `{count} lần bảo trì` |
| `…monthTotal` | Tổng chi phí bảo trì tháng {month}: {amount} |
| `…add / newTitle / editTitle / newCrumb / editCrumb` | Thêm bảo trì / Thêm bảo trì / Sửa bảo trì / Thêm mới / Sửa |
| `…thStt/thDate/thVehicle/thPeriod/thCost/thUpdatedBy/thUpdated/thActions` | STT / Ngày / Phương tiện / Thời gian bảo trì / Chi phí / Cập nhật bởi / Cập nhật / Hành động |
| `…days` | `{n} ngày` |
| `…status.UPCOMING/ACTIVE/DONE` | Sắp tới / Đang bảo trì / Đã xong |
| `…form.vehicle/startDate/endDate/cost/save/cancel/delete` | Phương tiện / Bắt đầu / Kết thúc / Chi phí (₫) / Lưu / Huỷ / Xoá |
| `…form.monthHint` | Hạch toán vào tháng {month} (theo ngày bắt đầu). Trong {start}–{end} không thể tạo chuyến mới cho xe này. |
| `…form.overlapWarning` | Xe có {count} chuyến trong khoảng này: {refs}. Các chuyến này giữ nguyên; chỉ chặn tạo chuyến mới. |
| `…form.overlapMaintenanceWarning` | Xe đã có bản ghi bảo trì trùng khoảng ({start}–{end}). |
| `…form.lockedHint` | Tháng đã chốt sổ — không thể chỉnh sửa. |
| `…form.createdToast/updatedToast/deletedToast/deleteConfirm` | Đã thêm bảo trì cho {plate} / Đã cập nhật bảo trì {plate} / Đã xoá bản ghi bảo trì / Xoá bản ghi bảo trì này? |
| `…emptyTitle/emptyDesc` | Chưa có bản ghi bảo trì / Thêm bản ghi để ghi chi phí và chặn tạo chuyến trong thời gian bảo trì. |
| `guard.VEHICLE_UNDER_MAINTENANCE` | Xe {plate} đang bảo trì từ {start} đến {end}. Không thể tạo chuyến trong thời gian này. |
| `screens.truckTrips.form.vehicleMaintenanceSuffix` | (bảo trì {start}–{end}) |
| `screens.truckPnl.maintenance` | Bảo trì |
| `screens.truckDashboard.kpiCostSub` | Nhiên liệu · cầu đường · phát sinh · lương tài xế · khấu hao · bảo trì |
| `screens.truckDashboard.tooltipCost/tooltipProfit` | … + Khấu hao xe + Chi phí bảo trì |
| `screens.truckDashboard.fixedMaintNote` | Bảo trì tính theo tháng, không phân bổ theo chuyến |
| `screens.truckFinance.sumFixedMaintNote` | gồm bảo trì {x} — không phân bổ theo chuyến |
| `exportContent.truckPnl.lineMaintenance` | Chi phí bảo trì |
| `exportContent.truckMonthlySummary.lineMaintenance` | Chi phí bảo trì (thay `lineOther` ở dòng 24 — Q2) |

### Phase H — Test + tài liệu

- **H1** TC `docs/test/TC-20260904-truck-maintenance.md`: CRUD; validate `end ≥ start`; cost 0; BR-7 trên 6 đường (kể cả import, kể cả "ghi chuyến đã xong"); sửa chuyến không đổi xe/ngày → cho; tháng chốt → E1002; dashboard: `Tổng chi phí` tăng đúng Σ, donut Σ lát = tâm, card cố định Σ dòng = tổng, LN ròng giảm đúng Σ; P&L Σ dòng = subtotal; finance ghi chú; export P&L + template dòng 24; badge cam sau CRUD bảo trì trong tháng đã BC; tháng 0 chuyến giữ bảo trì; ACL khu vực; mobile "Thêm" có mục Bảo trì.
- **H2** E2E `apps/web/e2e/truck-maintenance.spec.ts` (pattern `truck-fixed-alloc-freeze.spec.ts`): tạo bảo trì → tạo chuyến trong khoảng bị E1013 → ngoài khoảng OK → dashboard số; import file có dòng trùng bị từ chối toàn file.
- **H3** `tsc --noEmit` + `next lint` toàn workspace; `TR-20260904-*`, `RPT-20260904-*`.

## 3. Danh sách file thay đổi

| Vùng | File | Loại |
|---|---|---|
| DB | `packages/db/src/schema/truck-maintenance.schema.ts` | Mới |
| DB | `packages/db/src/schema/index.ts` | Sửa |
| DB | `packages/db/migrations/0030_truck_maintenance.sql` | Mới |
| Core | `packages/core/src/truck/truck-maintenance.ts` | Mới |
| Core | `packages/core/src/truck/truck-pnl.service.ts` | Sửa (field + fixedCost) |
| Core | `packages/core/src/truck/index.ts` | Sửa |
| Shared | `packages/shared/src/zod/truck-maintenance.zod.ts`, `zod/index.ts` | Mới / Sửa |
| Shared | `packages/shared/src/errors/maintenance-guard.ts`, `errors/index.ts` | Mới / Sửa |
| Action | `apps/web/src/server/actions/maintenance/truck-maintenance.actions.ts` | Mới |
| Action | `apps/web/src/server/actions/trips/truck-trip.actions.ts` | Sửa (4 action) |
| Action | `apps/web/src/server/actions/imports/import.actions.ts` | Sửa (pre-scan) |
| Query | `apps/web/src/server/queries/truck-maintenance.queries.ts` | Mới |
| Query | `apps/web/src/server/queries/truck-report.queries.ts` | Sửa (stale) |
| Query | `apps/web/src/server/queries/truck-report-export.queries.ts` | Sửa (maintenance field/totals) |
| Lib | `apps/web/src/server/lib/truck-monthly-summary-workbook.ts` | Sửa (dòng 24) |
| Lib | `apps/web/src/lib/format-action-error.ts` | Sửa (E1013) |
| Nav | `apps/web/src/components/layout/nav-items.ts` | Sửa |
| UI | `apps/web/src/components/list-row-actions.tsx` | Sửa (kind maintenance) |
| UI | `apps/web/src/app/(app)/truck/maintenance/page.tsx` | Mới |
| UI | `apps/web/src/app/(app)/truck/maintenance/new/page.tsx`, `[id]/edit/page.tsx` | Mới |
| UI | `apps/web/src/app/(app)/truck/maintenance/_components/truck-maintenance-form.tsx` | Mới |
| UI | `apps/web/src/app/(app)/truck/trips/_components/truck-trip-form.tsx` | Sửa (windows prop) |
| UI | `truck/trips/new`, `truck/trips/[id]/edit`, `today/truck/new`, `today/truck/[id]/edit` pages | Sửa (truyền windows) |
| UI | `apps/web/src/app/(app)/truck/dashboard/page.tsx` | Sửa (donut/card/tooltip) |
| UI | `apps/web/src/app/(app)/truck/pnl/page.tsx`, `pnl/export/route.ts` | Sửa (dòng bảo trì) |
| UI | `apps/web/src/app/(app)/truck/finance/page.tsx` | Sửa (ghi chú) |
| i18n | `apps/web/messages/{vi,en,ko}.json` | Sửa |
| Test | `apps/web/e2e/truck-maintenance.spec.ts`, `docs/test/TC-…`, `TR-…` | Mới |

## 4. Sai số / side-impact

| Phạm vi | Rủi ro | Giảm thiểu |
|---|---|---|
| Mọi màn đọc `computeTruckPnl` | `fixedCost`/`netProfit` đổi số ngay sau deploy cho tháng có bảo trì | Không có dữ liệu bảo trì cũ → số **không đổi** cho tới khi nhập bản ghi đầu tiên; Phase F thêm dòng ở mọi màn để "tổng = Σ dòng" |
| Template BC khách (dòng 24) | Đổi nhãn "Chi phí khác" → "Chi phí bảo trì" | Q2 chờ chốt; vị trí/công thức không đổi |
| Σ LN theo chuyến ≠ LN tháng | Lệch đúng bằng Σ bảo trì (thiết kế) | Ghi chú card finance + tooltip cột (F4) |
| Import Excel | Trước đây không guard xe → file cũ có ngày trùng bảo trì sẽ bị từ chối | Thông điệp nêu số dòng + khoảng bảo trì; pre-scan không ghi dở |
| So ngày UTC | Form gửi `YYYY-MM-DD` → UTC 00:00; máy VN (UTC+7) không lệch ngày vì không có giờ | Chuẩn hoá 1 helper `utcDateKey(d)`; TC có case ngày biên (start = end = ngày chuyến) |
| Migration staging thiếu | Query bảng mới → 500 ở dashboard | Áp `0030` trước deploy (skill `pre-deploy-check`) |
| Region ACL | User thu hẹp thấy bảo trì xe khu vực khác | List/CRUD qua `resolveVehicleScope` + `requireRegion(cvh_region)`; TC riêng |
| Guard mềm `VEHICLE_MAINTENANCE` (status) | 2 thông điệp "bảo trì" | BR-9 thứ tự; i18n 2 câu khác nhau ("đang bảo dưỡng" vs "đang bảo trì từ … đến …") |

## 5. Migration (draft)

```sql
-- 0030_truck_maintenance.sql — REQ-20260904 Truck maintenance records.
-- Bản ghi bảo trì theo xe + khoảng ngày + chi phí. Hạch toán 100% vào tháng bắt đầu
-- (tmn_month). Dùng để (1) cộng vào fixedCost của computeTruckPnl (không phân bổ theo
-- chuyến) và (2) chặn tạo chuyến LOG cho xe trong [start, end]. Idempotent, áp tay mọi nhánh.

CREATE TABLE IF NOT EXISTS car_truck_maintenances (
  tmn_id          CHAR(36) PRIMARY KEY,
  ent_id          CHAR(36) NOT NULL,
  cvh_id          CHAR(36) NOT NULL REFERENCES car_vehicles(cvh_id),
  tmn_start_date  DATE NOT NULL,
  tmn_end_date    DATE NOT NULL,
  tmn_month       VARCHAR(7) NOT NULL,          -- to_char(tmn_start_date,'YYYY-MM')
  tmn_cost        DECIMAL(14,2) NOT NULL DEFAULT 0,
  tmn_created_by  CHAR(36),
  tmn_created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  tmn_updated_by  CHAR(36),
  tmn_updated_at  TIMESTAMPTZ,
  tmn_deleted_at  TIMESTAMPTZ,
  CONSTRAINT chk_car_truck_maintenances_range CHECK (tmn_end_date >= tmn_start_date)
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_car_truck_maintenances_ent_vehicle_range
  ON car_truck_maintenances (ent_id, cvh_id, tmn_start_date, tmn_end_date)
  WHERE tmn_deleted_at IS NULL;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_car_truck_maintenances_ent_month
  ON car_truck_maintenances (ent_id, tmn_month);
```

## 6. Hình ảnh giao diện (wireframe)

### 6.1 Sidebar truck (desktop) · thanh dưới (mobile)

```
┌ VẬN HÀNH ──────────────────┐        Mobile (≤ md) — KHÔNG đổi:
│ ▦  Bảng điều khiển          │        ┌──────────┬──────────┬───(▦)───┬──────────┬──────────┐
│ ≡  Danh sách chuyến đi      │        │  Chuyến  │  Đội xe  │  Bảng   │  Tài xế  │  Thêm •  │
│ 🚚 Phương tiện              │        └──────────┴──────────┴─────────┴──────────┴──────────┘
│ 🪪 Tài xế                   │        Sheet "Thêm":  VẬN HÀNH › 🔧 Bảo trì   ← MỚI
│ 🔧 Bảo trì            ← MỚI │                        TÀI CHÍNH › Chi phí & Lợi nhuận
├ TÀI CHÍNH ─────────────────┤                        BÁO CÁO   › Lập báo cáo · Danh sách báo cáo
│ ¤  Chi phí & Lợi nhuận      │
├ BÁO CÁO ───────────────────┤
│ +  Lập báo cáo              │
│ ▤  Danh sách báo cáo        │
└────────────────────────────┘
```

### 6.2 `/truck/maintenance` — danh sách (desktop)

```
┌──────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ Công ty › Bảo trì                                                                                     │
│ Bảo trì                                                                          [ + Thêm bảo trì ]  │
│ 3 lần bảo trì · Tổng chi phí bảo trì tháng 09/2026: 12.500.000 ₫                                      │
├──────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ [ Tháng 09/2026 ▾ ]  [ Tất cả khu vực ▾ ]  [ Tất cả xe ▾ ]                                            │
├────┬────────────┬────────────────────┬──────────────────────────┬──────────────┬─────────────┬──────────────┬───────────┤
│STT │ Ngày       │ Phương tiện        │ Thời gian bảo trì        │      Chi phí │ Cập nhật bởi│ Cập nhật     │ Hành động │
├────┼────────────┼────────────────────┼──────────────────────────┼──────────────┼─────────────┼──────────────┼───────────┤
│ 1  │ 03/09/2026 │ 50E-32407          │ 05/09/2026 – 08/09/2026  │  7.500.000 ₫ │ Nguyễn Văn A│ 03/09 14:20  │  ✎   🗑   │
│    │            │ Dongfeng 4.5T · HCM│ 4 ngày · ● Sắp tới       │              │             │              │           │
│ 2  │ 02/09/2026 │ 51C-11111          │ 01/09/2026 – 01/09/2026  │  5.000.000 ₫ │ Trần Thị B  │ 02/09 09:01  │  ✎   🗑   │
│    │            │ Hino 3.5T · Đồng Nai│ 1 ngày · ● Đã xong      │              │             │              │           │
│ 3  │ 01/09/2026 │ 50E-32407          │ 30/08/2026 – 02/09/2026  │          0 ₫ │ Nguyễn Văn A│ 01/09 08:10  │  ✎   🗑   │
│    │            │ Dongfeng 4.5T · HCM│ 4 ngày · ● Đã xong  (hạch toán tháng 08/2026 — không tính vào tổng 09) │           │
└────┴────────────┴────────────────────┴──────────────────────────┴──────────────┴─────────────┴──────────────┴───────────┘
  • "Ngày" = ngày ghi nhận (created_at) · "Cập nhật" = updated_at (fallback created_at) · hàng click → trang sửa
  • Lọc tháng theo tmn_month (tháng bắt đầu) → dòng 3 KHÔNG hiện khi lọc 09/2026 (minh hoạ trên chỉ để giải thích)
```

Mobile (≤ md): card / bản ghi

```
┌────────────────────────────────────────┐
│ 50E-32407                  ● Sắp tới   │
│ Dongfeng 4.5T · HCM                    │
│ 05/09 – 08/09/2026 · 4 ngày            │
│ 7.500.000 ₫            Nguyễn Văn A · 03/09 │
└────────────────────────────────────────┘
```

### 6.3 `/truck/maintenance/new` · `/[id]/edit` — form

```
┌ Thông tin bảo trì ─────────────────────────────────────────────────────────┐
│ Phương tiện *      [ 50E-32407 · Dongfeng 4.5T                        ▾ ]  │
│ Bắt đầu *          [ 05/09/2026 ]        Kết thúc *   [ 08/09/2026 ]       │
│ Chi phí (₫)        [ 7.500.000                                        ₫ ]  │
│                                                                            │
│ ⓘ Hạch toán vào tháng 09/2026 (theo ngày bắt đầu).                         │
│   Trong 05/09–08/09/2026 không thể tạo chuyến mới cho xe này.              │
│ ⚠ Xe có 2 chuyến trong khoảng này: TR-3011, TR-3012.                       │
│   Các chuyến này giữ nguyên; chỉ chặn tạo chuyến mới.                      │
│ ─────────────────────────────────────────────────────────────────────────  │
│ [ Xoá ]                                              [ Huỷ ]   [ Lưu ]     │
└────────────────────────────────────────────────────────────────────────────┘
Tháng đã chốt sổ → mọi field disabled + banner vàng "Tháng đã chốt sổ — không thể chỉnh sửa."
Lưu OK → toast "Đã thêm bảo trì cho 50E-32407" → về /truck/maintenance
```

### 6.4 Form chuyến khi xe đang bảo trì (quản lý + tài xế)

```
Ngày *          [ 06/09/2026 ]
Phương tiện *   [ ▾ ]  ┌───────────────────────────────────────────────┐
                       │ 50E-32407 · Dongfeng 4.5T  (bảo trì 05/09–08/09) │ ← disabled theo Ngày đã chọn
                       │ 51C-11111 · Hino 3.5T                          │
                       └───────────────────────────────────────────────┘
Đổi Ngày sau khi đã chọn xe → dòng đỏ dưới Select:
  ⛔ Xe 50E-32407 đang bảo trì 05/09–08/09/2026 — chọn ngày khác hoặc xe khác.
Vẫn gửi → server CAR-E1013 → toast đỏ (không có "Vẫn tiếp tục"):
  "CAR-E1013 — Xe 50E-32407 đang bảo trì từ 05/09/2026 đến 08/09/2026. Không thể tạo chuyến trong thời gian này."
Import Excel → "CAR-E1013 — Dòng 7: xe 50E-32407 đang bảo trì 05/09–08/09/2026" (không ghi dòng nào)
```

### 6.5 Bảng điều khiển — thay đổi

```
┌ DOANH THU        ┐ ┌ TỔNG CHI PHÍ ⓘ                         ┐ ┌ LỢI NHUẬN RÒNG ⓘ ┐ ┌ SỐ CHUYẾN ┐
│ 150.000.000 ₫    │ │ 98.500.000 ₫                             │ │ 51.500.000 ₫     │ │ 42        │
│ ▲ 12% so kỳ trước│ │ Nhiên liệu · cầu đường · phát sinh ·     │ │ ▲ 4% so kỳ trước │ │ Tổng hợp… │
│                  │ │ lương tài xế · khấu hao · bảo trì  ← MỚI │ │                  │ │           │
└──────────────────┘ └──────────────────────────────────────────┘ └──────────────────┘ └───────────┘
 tooltip ⓘ: Tổng chi phí = Phí nhiên liệu + Phí cầu đường + Chi phí phát sinh + Lương tài xế + Khấu hao xe + Chi phí bảo trì
 tooltip ⓘ: Lợi nhuận ròng = Tổng doanh thu − Tổng chi phí (… + khấu hao + bảo trì)

┌ Cơ cấu chi phí ───────────────────────────────┐
│        ◔                 ■ Nhiên liệu  50.000.000 │
│   98.500.000 ₫           ■ Cầu đường   10.000.000 │
│                          ■ Phát sinh    6.000.000 │
│                          ■ Lương       15.000.000 │
│                          ■ Khấu hao     5.000.000 │
│                          ■ Bảo trì     12.500.000 │ ← lát MỚI (Σ lát = tâm)
└───────────────────────────────────────────────┘

┌ ■ Tổng phí biến đổi        67% · theo chuyến ┐ ┌ ■ Tổng phí cố định           33% · theo tháng ┐
│ 66.000.000 ₫                                 │ │ 32.500.000 ₫                                  │
│ Nhiên liệu                       50.000.000  │ │ Lương tài xế                       15.000.000  │
│ Cầu đường                        10.000.000  │ │ Khấu hao                            5.000.000  │
│ Phát sinh                         6.000.000  │ │ Bảo trì                            12.500.000  │ ← MỚI
│                                              │ │ ⓘ Bảo trì tính theo tháng, không phân bổ theo chuyến │
└──────────────────────────────────────────────┘ └───────────────────────────────────────────────┘
 Card "Tình trạng đội xe" (theo cvh_status) và "Chuyến gần đây" (chi phí biến đổi theo chuyến) — KHÔNG đổi.
```

### 6.6 Chi phí & Lợi nhuận › Tổng quan P&L (bảng 3 tháng) + Theo chuyến

```
Hạng mục               │  T7/26  │  T8/26  │  T9/26
Doanh thu              │   …     │   …     │ 150.000.000
Nhiên liệu             │         │         │  50.000.000
Cầu đường              │         │         │  10.000.000
Phát sinh khác         │         │         │   6.000.000
Tổng phí biến đổi      │         │         │  66.000.000
Lương tài xế           │         │         │  15.000.000
Khấu hao               │         │         │   5.000.000
Bảo trì        ← MỚI   │         │         │  12.500.000
Tổng phí cố định       │         │         │  32.500.000   (= 3 dòng trên)
Số chuyến              │         │         │          42
Lợi nhuận ròng         │         │         │  51.500.000

Theo chuyến — card tháng:
┌ Chi phí cố định ─────────────┐   cột "CP CỐ ĐỊNH PHÂN BỔ" từng chuyến: KHÔNG đổi (lương + KH ÷ N)
│ 32.500.000 ₫                 │   cột "Lợi nhuận" từng chuyến: KHÔNG đổi (chưa trừ bảo trì)
│ gồm bảo trì 12.500.000 ₫ —   │
│ không phân bổ theo chuyến    │ ← ghi chú MỚI
└──────────────────────────────┘
```

### 6.7 Báo cáo tháng (template khách) — mục B

```
B.  CHI PHÍ
    Chi phí nhiên liệu        50.000.000
    Phí cầu đường             10.000.000
    Chi phí phát sinh          6.000.000
    Lương tài xế              15.000.000
    Khấu hao xe                5.000.000
    Chi phí bảo trì           12.500.000   ← dòng 24, thay nhãn "Chi phí khác" (đang luôn 0) — Q2
Tổng chi phí                  98.500.000   = SUM(C19:C24) (không đổi công thức)
C.  LỢI NHUẬN
Lợi nhuận gộp                 51.500.000   = C16 − C25
E.  CHI TIẾT TỪNG XE: cột "Tổng chi phí"/"Lợi nhuận" từng xe tự cộng bảo trì của xe đó → khớp mục B/C
```

## 7. Thứ tự thực thi đề xuất

A (DB) → B (core/zod) → C (actions/queries) → E (chặn chuyến) → D (menu/list/form) → F (dashboard → P&L → finance → report) → G (i18n song song từ D) → H (test/docs). Mốc kiểm tra giữa: sau E chạy `tsc` + E2E chặn chuyến; sau F đối chiếu số dashboard = P&L = finance = template trên 1 tháng seed.

---

## 8. Điều chỉnh sau khi chốt Q1–Q8 (2026-09-04)

| Mục PLN | Kế hoạch ban đầu | Sau chốt |
|---|---|---|
| B5 | 1 mã lỗi `CAR-E1013` | 2 mã: `CAR-E1013` (chuyến ↔ xe đang bảo trì) + `CAR-E1014` (bảo trì ↔ ngày xe đã có chuyến), cả hai BLOCK |
| C1 | Trả `overlappingTrips` để toast cảnh báo | `assertNoTripsInMaintenanceWindow` **chặn** trước khi ghi; preview action riêng cho form |
| D4 | Banner cảnh báo mềm, vẫn lưu | Disable xe trong Select + banner đỏ + khoá Lưu (Q5) |
| E1 | Sửa chuyến: chỉ khi đổi xe/ngày | Mọi đường sửa/hoàn thành/vá chi phí (Q6) |
| F6 | Đổi nhãn dòng 24 | Giữ dòng 24, **thêm dòng 25**, dịch layout 1 dòng (Q2) |
| §6.7 wireframe | dòng 24 = Bảo trì | dòng 24 "Chi phí khác" + dòng 25 "Chi phí bảo trì" |

**Trạng thái**: đã triển khai theo bản điều chỉnh trên — xem [RPT-20260904-truck-maintenance.md](../implementation/RPT-20260904-truck-maintenance.md).
