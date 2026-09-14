# PLN-20260907 — Truck: Trạng thái Phương tiện (Sẵn sàng · Bảo trì tự động · Ngừng sử dụng)

> Kèm [REQ-20260907-truck-vehicle-status.md](../analysis/REQ-20260907-truck-vehicle-status.md). Viết theo **khuyến nghị Q1–Q5** (dẫn xuất khi đọc; chặn theo ngày chuyến; nhãn riêng truck; giữ xe ngừng trong báo cáo; bỏ "Đang sử dụng"). Nếu chốt khác → sửa §2 trước khi code.

## 1. Hiện trạng phát triển liên quan

- Stack: Next 15 App Router + Drizzle/Neon (`apps/app-car-manager-v2`), UI `@car-v2/ui`, i18n next-intl 3 ngôn ngữ, Turborepo `typecheck`/`lint`. Core domain truck ở `packages/core/src/truck/*` (pure, không `next/*`).
- Trạng thái xe: enum `car_vehicle_status` 4 giá trị dùng chung CAR/TRUCK ([vehicles.schema.ts](../../packages/db/src/schema/vehicles.schema.ts)); form xe tải **không có** select trạng thái; chuyến LOG không đổi `cvh_status`; core chỉ từ chối `RETIRED` ([truck-trip.service.ts](../../packages/core/src/truck/truck-trip.service.ts) `assertTruckVehicle`).
- Bảo trì (REQ-20260904, đã code, chưa commit): bảng `car_truck_maintenances`, helper [truck-maintenance.ts](../../packages/core/src/truck/truck-maintenance.ts) (`findVehicleMaintenanceOn`, `listVehicleMaintenanceWindows`, `utcDateKey`), form chuyến đã nhận `maintenanceWindows` và làm mờ xe theo ngày ([truck-trip-form.tsx](../../apps/web/src/app/(app)/truck/trips/_components/truck-trip-form.tsx) dòng 449–458).
- Nơi đọc `cvh_status` cho truck (REQ §2.3): fleet list, dashboard card, picker chuyến/import/bảo trì, report export queries.
- Migration mới nhất `0030_truck_maintenance.sql` → kế tiếp **`0031`** (áp tay, idempotent, chỉ dữ liệu).
- Ràng buộc: multi-tenant `ent_id`; ACL khu vực (`resolveVehicleScope`, `resolveRegionFilter`); không hard-code text; ngày UTC.

## 2. Kế hoạch theo Phase

### Phase A — Core (pure) — `packages/core/src/truck/truck-vehicle-status.ts` (mới)

- **A1** `export type TruckVehicleStatus = 'AVAILABLE' | 'MAINTENANCE' | 'RETIRED'`; `export const TRUCK_VEHICLE_STATUSES` (thứ tự hiển thị).
  └─ Side impact: không — type mới.
- **A2** `resolveTruckVehicleStatus(stored: CarVehicleStatus, active: MaintenanceWindow | null): TruckVehicleStatus` — RETIRED → RETIRED; active → MAINTENANCE; còn lại (AVAILABLE/IN_USE/MAINTENANCE thô) → AVAILABLE. Pure, có JSDoc nêu BR-2/BR-4.
  └─ Side impact: `MAINTENANCE` thô bị đọc thành Sẵn sàng cho tới khi có bản ghi → đúng ý BR-11; migration 0031 làm sạch dữ liệu.
- **A3** `loadActiveMaintenanceByVehicle(entId, dateIso, vehicleIds?): Promise<Map<vehicleId, MaintenanceWindow>>` — 1 query `car_truck_maintenances` live, `start ≤ date ≤ end`, join `car_vehicles` (plate); nhiều bản ghi chồng ngày → giữ bản có `end_date` xa nhất.
  └─ Side impact: thêm 1 query/trang ở các màn truck có danh sách xe (nhẹ, có index).
- **A4** `export * from './truck-vehicle-status.js'` trong `index.ts`.

### Phase B — Query + Action (web)

- **B1** `apps/web/src/server/queries/truck-vehicles.queries.ts` (mới):
  `listTrucksWithStatus(entId)` = `listVehicles(entId, 'active', 'TRUCK')` + A3 hôm nay (`utcDateKey(new Date())`) + A2 → mỗi xe kèm `status: TruckVehicleStatus`, `maintenanceUntil: string | null`.
  `listDispatchableTrucks(entId, keepId?)` = xe `status !== 'RETIRED'` ∪ xe `keepId` (cho trang sửa).
  └─ Side impact: các trang picker đổi import sang hàm này (B4).
- **B2** `vehicle.actions.ts › updateVehicleAction`: sau khi lấy `existing`, nếu xe là TRUCK (`existing.cvhType === 'TRUCK'` hoặc `data.vehicle_type === 'TRUCK'`) và `data.status` ∉ {AVAILABLE, RETIRED} → `throw new CarError('CAR-E1001', 400, 'Truck status must be AVAILABLE or RETIRED')`.
  └─ Side impact: form xe con sửa một xe TRUCK sang MAINTENANCE bị từ chối — đúng ý; CAR không ảnh hưởng.
- **B3** `truck-maintenance.actions.ts › requireTruck`: select thêm `cvhStatus`; nếu `RETIRED` → `throw new CarError('CAR-E1002', 409, 'Vehicle is retired')` (áp create + update).
  └─ Side impact: sửa bản ghi cũ của xe đã ngừng mà **không đổi xe**: `update` gọi `requireTruck(dto.vehicle_id)` → cũng bị chặn. Chấp nhận (BR-4: không sửa bảo trì cho xe đã ngừng); xoá vẫn được.
- **B4** Picker loại RETIRED: `truck/trips/new`, `today/truck/new` → `listDispatchableTrucks(entId)`; `truck/trips/[id]/edit`, `today/truck/[id]/edit` → `listDispatchableTrucks(entId, trip.trpVehicleId)`; `truck/import` → `listDispatchableTrucks(entId)`; `truck/maintenance/new|[id]/edit` → lọc `trucks.filter(v => v.cvhStatus !== 'RETIRED')` (edit giữ xe hiện tại) trên kết quả `resolveVehicleScope`.
  └─ Side impact: xe RETIRED biến mất khỏi picker (trước đây hiện rồi server từ chối) — hành vi tốt hơn, không đổi server.
- **B5** `truck-report-export.queries.ts`: sau khi lấy `scopeVehicles`, gọi A3 với `ids` + hôm nay và gán `status = resolveTruckVehicleStatus(v.status, active.get(id) ?? null)`; các đoạn `=== 'MAINTENANCE'` (dòng 363, 433) giữ nguyên vì shape không đổi.
  └─ Side impact: KPI "Xe bảo dưỡng" và dòng "Bảo trì" mục E giờ theo bản ghi (tại thời điểm lập) thay vì trạng thái tay; snapshot cũ không bị đụng.

### Phase C — UI Phương tiện

- **C1** `truck/fleet/page.tsx`: đổi `listVehicles` → `listTrucksWithStatus`; `VEHICLE_STATUSES` → `TRUCK_VEHICLE_STATUSES` (3); lọc `?status=` theo `v.status`; badge `tStatus(v.status)` với `tStatus = getTranslations('screens.truckFleet.status')`; khi `MAINTENANCE` thêm dòng muted `t('maintUntil', { date })` (bảng: dưới badge; mobile: sau badge); `title` trên badge = `statusDesc.{s}` (R5).
  └─ Side impact: URL `?status=IN_USE` cũ → bỏ qua (hiện tất cả).
- **C2** `truck/fleet/[id]/edit/page.tsx`: lấy `active = (await loadActiveMaintenanceByVehicle(entId, today, [v.cvhId])).get(v.cvhId)`; truyền `initial.status = v.cvhStatus === 'RETIRED' ? 'RETIRED' : 'AVAILABLE'` và prop `maintenanceUntil`.
- **C3** `truck-vehicle-form.tsx`: thêm `status` vào `EMPTY` (`'AVAILABLE'`); field "Trạng thái" **chỉ khi `vehicleId`** (sửa): `Select` 2 item (Sẵn sàng / Ngừng sử dụng) + hint `form.statusHint`; nếu `maintenanceUntil` → `InfoNote` `form.statusMaintenanceNote {date}` + link `/truck/maintenance?vehicle={id}`; payload gửi `status` chỉ khi sửa.
  └─ Side impact: `createVehicleAction` không nhận `status` (schema create không có) → không gửi khi tạo.

### Phase D — Bảng điều khiển

- **D1** `truck/dashboard/page.tsx`: `allTrucks` ← `listTrucksWithStatus`; `statusOrder` = `TRUCK_VEHICLE_STATUSES`; đếm theo `v.status`; nhãn từ `screens.truckFleet.status`; dòng `MAINTENANCE` bọc `Link href="/truck/maintenance"` (giữ layout).
  └─ Side impact: card mất dòng "Đang sử dụng" (luôn 0 với truck). KPI/P&L không đổi (`trucks` vẫn dùng cho vùng/xe).

### Phase E — i18n (vi/en/ko) — `apps/web/messages/*.json`

| Khoá | vi | en | ko |
|---|---|---|---|
| `screens.truckFleet.status.AVAILABLE` | Sẵn sàng | Available | 이용 가능 |
| `screens.truckFleet.status.MAINTENANCE` | Bảo trì | Maintenance | 정비 중 |
| `screens.truckFleet.status.RETIRED` | Ngừng sử dụng | Retired | 사용 중지 |
| `screens.truckFleet.statusDesc.AVAILABLE` | Phương tiện sẵn sàng để tạo chuyến | Vehicle is ready for trips | 운행 등록이 가능한 차량 |
| `screens.truckFleet.statusDesc.MAINTENANCE` | Phương tiện nằm trong danh sách bảo trì · Không thể tạo chuyến mới | Listed in Maintenance · New trips cannot be created | 정비 목록에 등록됨 · 신규 운행 등록 불가 |
| `screens.truckFleet.statusDesc.RETIRED` | Phương tiện đã ngừng sử dụng · Không thể tạo chuyến mới | Vehicle retired · New trips cannot be created | 사용 중지된 차량 · 신규 운행 등록 불가 |
| `screens.truckFleet.maintUntil` | đến {date} | until {date} | {date}까지 |
| `screens.truckFleet.form.status` | Trạng thái | Status | 상태 |
| `screens.truckFleet.form.statusHint` | Chỉ chuyển giữa Sẵn sàng và Ngừng sử dụng. Trạng thái Bảo trì được gán tự động theo lịch ở menu Bảo trì. | Switch only between Available and Retired. Maintenance is set automatically from the Maintenance menu. | 이용 가능 ↔ 사용 중지만 변경할 수 있습니다. 정비 중 상태는 정비 메뉴 일정에 따라 자동 지정됩니다. |
| `screens.truckFleet.form.statusMaintenanceNote` | Xe đang bảo trì đến {date} — trạng thái Bảo trì được gán tự động. | Under maintenance until {date} — status is set automatically. | {date}까지 정비 중 — 상태가 자동 지정됩니다. |
| `screens.truckFleet.form.statusMaintenanceLink` | Xem lịch bảo trì | View maintenance schedule | 정비 일정 보기 |

  └─ Side impact: không đổi `vehicles.status.*` (CAR giữ "Đã ngừng").

### Phase F — DB

- **F1** `packages/db/migrations/0031_truck_vehicle_status_normalize.sql` (§5) — áp tay dev ngay sau code; staging/production theo lịch deploy.

### Phase G — Test + tài liệu

- **G1** `pnpm typecheck` + `pnpm lint` (web + core) xanh.
- **G2** Chạy TC-20260907 trên dev (dữ liệu: 51C có bản ghi 10–12/08 đã có; tạo bản ghi hôm nay cho 29C để thấy Bảo trì tự động; đổi 60C-311.07 sang Ngừng sử dụng rồi trả lại).
- **G3** TR-20260907, RPT-20260907, cập nhật REQ §8, log ngày.

## 3. Danh sách file thay đổi

| Phân loại | File | Loại |
|---|---|---|
| Core | `packages/core/src/truck/truck-vehicle-status.ts` | Mới |
| Core | `packages/core/src/truck/index.ts` | Sửa (export) |
| Backend (web) | `apps/web/src/server/queries/truck-vehicles.queries.ts` | Mới |
| Backend (web) | `apps/web/src/server/actions/vehicles/vehicle.actions.ts` | Sửa (guard TRUCK status) |
| Backend (web) | `apps/web/src/server/actions/maintenance/truck-maintenance.actions.ts` | Sửa (từ chối RETIRED) |
| Backend (web) | `apps/web/src/server/queries/truck-report-export.queries.ts` | Sửa (status hiệu lực) |
| Frontend | `apps/web/src/app/(app)/truck/fleet/page.tsx` | Sửa |
| Frontend | `apps/web/src/app/(app)/truck/fleet/[id]/edit/page.tsx` | Sửa |
| Frontend | `apps/web/src/app/(app)/truck/fleet/_components/truck-vehicle-form.tsx` | Sửa |
| Frontend | `apps/web/src/app/(app)/truck/dashboard/page.tsx` | Sửa |
| Frontend | `apps/web/src/app/(app)/truck/trips/new/page.tsx` · `truck/trips/[id]/edit/page.tsx` · `today/truck/new/page.tsx` · `today/truck/[id]/edit/page.tsx` · `truck/import/page.tsx` | Sửa (picker loại RETIRED) |
| Frontend | `apps/web/src/app/(app)/truck/maintenance/new/page.tsx` · `[id]/edit/page.tsx` | Sửa (picker loại RETIRED) |
| i18n | `apps/web/messages/vi.json` · `en.json` · `ko.json` | Sửa (~11 khoá) |
| DB | `packages/db/migrations/0031_truck_vehicle_status_normalize.sql` | Mới |
| Docs | `docs/test/TC-20260907-*.md` (kèm PLN) · `TR-20260907-*.md` · `docs/implementation/RPT-20260907-*.md` · REQ §8 | Mới/Sửa |

## 4. Phân tích side-impact

| Phạm vi | Rủi ro | Mô tả / biện pháp |
|---|---|---|
| Xe con (CAR) | Thấp | Không đổi enum, form, state machine; guard B2 chỉ áp xe TRUCK. Khoá i18n riêng cho truck. |
| Xe tải có `cvh_status` tay (dev 2 xe) | Thấp | Hiện Sẵn sàng sau migration; nếu có ý ngừng thật thì Admin chuyển tay. |
| Báo cáo tháng đã lập (snapshot) | Không | Không đụng dữ liệu cũ; báo cáo mới đọc status hiệu lực. |
| Picker chuyến (REQ-20260904 mờ theo ngày) | Thấp | Giữ nguyên; chỉ loại RETIRED thêm. Trang sửa giữ xe hiện tại nên form không vỡ khi xe đã ngừng. |
| Sửa bản ghi bảo trì của xe đã ngừng | Trung bình | Bị chặn CAR-E1002 (BR-4); xoá vẫn được. Ghi rõ trong TC/RPT. |
| Hiệu năng | Thấp | +1 query có index cho các trang có danh sách xe tải. |
| Múi giờ | Thấp | Ngày UTC như D5/E1013 (đổi lúc 07:00 VN) — nêu trong REQ §6. |
| ACL khu vực | Không | Các trang vẫn đi qua `resolveVehicleScope`/`resolveRegionFilter`; A3 lọc theo `ent_id` + ids đã scope. |

## 5. Migration (áp tay, idempotent)

```sql
-- 0031_truck_vehicle_status_normalize.sql
-- REQ-20260907: xe tải chỉ lưu AVAILABLE/RETIRED; MAINTENANCE là trạng thái dẫn xuất
-- từ car_truck_maintenances (start <= hôm nay <= end). Chuẩn hoá giá trị đặt tay cũ.
UPDATE car_vehicles
   SET cvh_status = 'AVAILABLE', cvh_updated_at = now()
 WHERE cvh_type = 'TRUCK'
   AND cvh_status IN ('MAINTENANCE', 'IN_USE')
   AND cvh_deleted_at IS NULL;
```

Kiểm tra trước/sau: `SELECT cvh_status, count(*) FROM car_vehicles WHERE cvh_type='TRUCK' AND cvh_deleted_at IS NULL GROUP BY 1;` (dev kỳ vọng: AVAILABLE 5). Thứ tự áp: dev → staging (`ep-noisy-heart`, cùng lượt với `0030`) → production.

## 6. Hình ảnh giao diện (wireframe)

### 6.1 `/truck/fleet` — danh sách (desktop)

```
Phương tiện                                                        [+ Thêm xe tải]
[🔍 Tìm biển số]  [Khu vực ▾ Tất cả]  [Trạng thái ▾ Tất cả | Sẵn sàng | Bảo trì | Ngừng sử dụng]
┌────┬────────┬────────────┬──────────────┬────────────┬──────────┬────────────┬──────────┬───────────────────┬──────────┐
│STT │ Mã     │ Biển số    │ Model        │ Tài xế     │ Khu vực  │ Khấu hao   │ Odo      │ Trạng thái        │ Hành động│
├────┼────────┼────────────┼──────────────┼────────────┼──────────┼────────────┼──────────┼───────────────────┼──────────┤
│ 1  │ —      │ 29C-99999  │ Hyundai HD320│ —          │ HCM      │ —          │ 0 km     │ ● Sẵn sàng        │ ✎  🗑    │
│ 2  │ —      │ 51C-458.32 │ Hyundai HD210│ Tài xế Xe… │ HCM      │ —          │ 0 km     │ ● Bảo trì         │ ✎  🗑    │
│    │        │            │              │            │          │            │          │   đến 12/08/2026  │          │
│ 3  │ —      │ 60C-311.07 │ Isuzu FVR 34S│ —          │ Đồng Nai │ —          │ 0 km     │ ● Ngừng sử dụng   │ ✎  🗑    │
└────┴────────┴────────────┴──────────────┴────────────┴──────────┴────────────┴──────────┴───────────────────┴──────────┘
(hover badge → tooltip: "Phương tiện nằm trong danh sách bảo trì · Không thể tạo chuyến mới")
```

### 6.2 `/truck/fleet/[id]/edit` — form sửa (phần trạng thái, đặt sau "Khu vực")

```
┌ Thông tin xe tải ───────────────────────────────────────────────────┐
│ Biển số*  [51C-458.32]        Mã  [        ]                        │
│ …                                                                   │
│ Khu vực   [HCM ▾]             Trạng thái  [Sẵn sàng ▾]              │
│                                ├ Sẵn sàng                           │
│                                └ Ngừng sử dụng                      │
│           Chỉ chuyển giữa Sẵn sàng và Ngừng sử dụng. Trạng thái Bảo │
│           trì được gán tự động theo lịch ở menu Bảo trì.            │
│ ⓘ Xe đang bảo trì đến 12/08/2026 — trạng thái Bảo trì được gán tự  │
│   động. [Xem lịch bảo trì →]                   (chỉ khi đang bảo trì)│
│ …                                                                   │
│                                              [Huỷ]  [💾 Lưu]         │
└─────────────────────────────────────────────────────────────────────┘
Form TẠO xe: không có field Trạng thái (mặc định Sẵn sàng).
```

### 6.3 Bảng điều khiển — card "Tình trạng đội xe"

```
┌ Tình trạng đội xe ───────────┐        (trước: 4 dòng, có "Đang sử dụng 0")
│ ● Sẵn sàng              3    │
│ ● Bảo trì  →/truck/maint 1   │  ← link
│ ● Ngừng sử dụng         1    │
└──────────────────────────────┘
```

### 6.4 Picker xe (tạo chuyến / import / bảo trì)

```
Xe tải  [Chọn xe tải ▾]
        ├ 29C-99999 · Hyundai HD320
        ├ 51C-458.32 · Hyundai HD210        (mờ + "đang bảo trì 10/08–12/08" khi ngày chuyến ∈ khoảng — đã có)
        └ 60C-522.18 · Hino FG8J
        (60C-311.07 Ngừng sử dụng: KHÔNG xuất hiện; trang sửa chuyến của chính xe đó vẫn giữ)
```

## 7. Thứ tự thực thi đề xuất

A (core) → B1 (query) → E (i18n) → C (fleet UI) → D (dashboard) → B2/B3 (guard action) → B4 (picker) → B5 (report) → F (migration dev) → G (typecheck/lint, TC trên dev, TR/RPT).
