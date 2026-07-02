# PLAN-20260623 — Truck Trip: Multi-stop Route + Driver Self-Create

## 1. Phân tích hiện trạng

### Cấu trúc liên quan
```
packages/
  db/src/schema/
    trip-stopovers.schema.ts    ← thiếu type/km/arrived_at/notes
    tenant-settings.schema.ts   ← thiếu depot_address
  core/src/truck/
    truck-trip.service.ts       ← không xử lý stopovers
  shared/src/zod/
    truck-trip.zod.ts           ← thiếu stopovers + updateStopover schemas

apps/web/src/
  server/actions/trips/
    truck-trip.actions.ts       ← DRIVER bị block, không có stopover logic
  app/(app)/truck/trips/
    _components/truck-trip-form.tsx  ← flat pickup/dropoff chỉ, không dùng stopovers
    new/page.tsx                ← MANAGER only
  app/(app)/today/
    _components/truck-driver-today.tsx ← không có "tạo chuyến" button
```

### Ràng buộc kỹ thuật
- Neon HTTP: no interactive txn → stopovers dùng delete-then-insert (idempotent)
- `drizzle-kit` journal quản lý 0000–0007; từ 0008+ dùng manual SQL → migration 0014
- Month-close (`assertTruckMonthOpen`) phải áp dụng cho DRIVER
- Backward compat: trip cũ không có stopovers → UI fallback về pickup→dropoff display

---

## 2. Kế hoạch triển khai theo Phase

### Phase A — DB Migration (SQL thủ công)
**File**: `migrations/0014_truck_multispot.sql`

**Step A-1**: Thêm enum + columns vào `car_trip_stopovers`
```
└─ Sideimpact: trip cũ sẽ có rows stopovers = 0 (không bị lỗi — backward compat OK)
```

**Step A-2**: Thêm `tns_depot_address` vào `car_tenant_settings`
```
└─ Sideimpact: Không ảnh hưởng settings hiện tại (nullable column)
```

---

### Phase B — Schema + Shared types

**Step B-1**: Update `trip-stopovers.schema.ts`
- Thêm `pgEnum('car_stop_type', ['ORIGIN','PICKUP','DELIVERY','WAYPOINT','RETURN'])`
- Thêm columns: `tst_type`, `tst_km`, `tst_arrived_at`, `tst_notes`
- Export `CarStopType`
```
└─ Sideimpact: Drizzle infer types thay đổi — queries có `select stopovers` sẽ có thêm fields (additive, không break)
```

**Step B-2**: Update `tenant-settings.schema.ts`
- Thêm `tnsDepotAddress: text('tns_depot_address')`
```
└─ Sideimpact: `CarTenantSettings` type có thêm field (additive)
```

**Step B-3**: Update `packages/shared/src/zod/truck-trip.zod.ts`
- Thêm `stopoverInputSchema` (address, type, km?, arrivedAt?, notes?)
- Thêm `stopovers` array vào `createTruckTripSchema` (optional, max 20)
- Thêm `updateStopoverSchema` (trip_id, stopover_id, km, arrived_at, notes)
- Thêm `driverCreateTruckTripSchema` (extends create, omits revenue)
```
└─ Sideimpact: Các consumer của createTruckTripSchema không bị break (stopovers là optional)
```

**Step B-4**: Update `packages/shared/src/zod/tenant-settings.zod.ts`
- Thêm `depot_address` field vào update schema
```
└─ Sideimpact: Không có
```

---

### Phase C — Core service

**Step C-1**: Update `truck-trip.service.ts`
- `CreateTruckTripInput` thêm `stopovers?: StopoverInput[]`
- Hàm `upsertStopovers(entId, tripId, stops)` — delete-then-insert
- `createTruckTrip`: sau insert trip, gọi `upsertStopovers` nếu stops không rỗng
- `updateTruckTrip`: gọi `upsertStopovers` với stops mới (replace toàn bộ)
```
└─ Sideimpact: Caller không truyền stopovers → hàm skip upsert (backward compat)
```

**Step C-2**: Export `upsertStopovers` từ `packages/core/src/truck/index.ts` (nếu cần dùng nơi khác)

---

### Phase D — Server Actions + Queries

**Step D-1**: Update `createTruckTripAction`
- Bỏ `requireRole(['ADMIN', 'MANAGER'])` → cho phép DRIVER
- Nếu actor là DRIVER: enforce `driver_id = actor.driverRecord.drvId` (fetch `getDriverByUserId`)
- Nếu actor là DRIVER: ignore `revenue` field (strip trước khi pass vào core)
- Pass `stopovers` vào `createTruckTrip`
```
└─ Sideimpact: DRIVER giờ có thể create — cần test quyền kỹ (không tạo cho người khác)
```

**Step D-2**: Update `updateTruckTripAction`
- Pass `stopovers` vào `updateTruckTrip`
- Nếu actor là DRIVER: chỉ cho phép update trip của chính mình; không thay đổi revenue
```
└─ Sideimpact: Manager flow không đổi (stopovers trong payload → replace)
```

**Step D-3**: Tạo `apps/web/src/server/actions/trips/stopover.actions.ts`
- `updateStopoverAction(input)` — DRIVER chỉ update stop của trip mình
  - Validate: trip owner = actor's driver record
  - Chỉ update: `tst_km`, `tst_arrived_at`, `tst_notes` (không thay đổi type/address)
  - Không cần month-open check (chỉ operational data, không financial)
```
└─ Sideimpact: Không ảnh hưởng flow manager
```

**Step D-4**: Tạo `apps/web/src/server/queries/stopovers.queries.ts`
- `getTripStopovers(entId, tripId)` → trả stopovers ordered by `tst_order`

**Step D-5**: Update tenant settings action — thêm `depot_address` save

---

### Phase E — Frontend: Stop Builder Component

**Step E-1**: Tạo `apps/web/src/app/(app)/truck/trips/_components/stop-builder.tsx`
- Props: `stops: StopField[]`, `onChange`, `depotAddress?: string`
- Renders danh sách stops có thứ tự
- ORIGIN (index 0) + RETURN (last) luôn hiển thị; editable address; type locked
- PICKUP + DELIVERY: type locked, address required
- WAYPOINT: address required, type editable label "Điểm ghé"
- Nút "Thêm điểm ghé" (sau PICKUP / sau DELIVERY)
- Nút xóa waypoint (trái X)
- Mỗi stop: address input + type badge + km field (optional)
```
└─ Sideimpact: Pure UI component, không có side effect
```

**Step E-2**: Update `truck-trip-form.tsx`
- Replace `pickup` + `dropoff` inputs với `<StopBuilder>`
- State: `stops: StopField[]` (init từ depot + 1 PICKUP + 1 DELIVERY + 1 RETURN)
- Truyền `depotAddress` vào form props từ page
- Form gửi `stopovers` array trong payload
- Manager version: revenue field giữ nguyên
- Driver version: revenue field hidden (`role === 'DRIVER'`)
```
└─ Sideimpact: Breaking change — form không còn flat pickup/dropoff; edit trip cần parse stopovers vào stops state
```

**Step E-3**: Update `apps/web/src/app/(app)/truck/trips/new/page.tsx`
- Fetch depot address từ `getTenantSettings`
- Pass `depotAddress` + `role` vào `TruckTripForm`
- Allow DRIVER access (middleware đã cho phép route `/truck/trips/new` nếu DRIVER có TRUCK access — kiểm tra)
```
└─ Sideimpact: Cần check middleware truck layout guard
```

**Step E-4**: Update edit trip page
- `[id]/edit/page.tsx`: fetch stopovers → transform thành `StopField[]` → pass vào `initial`

---

### Phase F — Frontend: Truck Trip Detail (stopover timeline)

**Step F-1**: Thêm stopover timeline vào `TruckTripDetail` component
- Fetch stopovers trong detail page
- Render danh sách stops với icon loại (MapPin, PackageOpen, Truck, etc.), address, km, arrived_at
- Nếu `stopovers.length === 0` → hiển thị pickup→dropoff như cũ (backward compat)

---

### Phase G — Frontend: Driver Today (create + stop update)

**Step G-1**: Update `truck-driver-today.tsx`
- Thêm nút "Tạo chuyến mới" → link `/truck/trips/new`

**Step G-2**: Tạo `apps/web/src/app/(app)/today/truck/[id]/page.tsx`
- Driver stop-update page: danh sách stops của trip
- Mỗi stop: hiện địa chỉ + type + current km/time
- Button "Cập nhật km tại đây" → inline form: km input + thời gian (default now)
- Submit → `updateStopoverAction`
- Breadcrumb về `/today`

---

### Phase H — Settings: Depot Address

**Step H-1**: Thêm depot address field vào settings page
- Trong `truck/settings` hoặc `/settings` admin section
- Text input "Địa chỉ bãi mặc định"
- Save → `updateTenantDepotAction`

---

### Phase I — i18n

Thêm keys vào vi/en/ko:
- `stopType.ORIGIN`, `stopType.PICKUP`, `stopType.DELIVERY`, `stopType.WAYPOINT`, `stopType.RETURN`
- `truckTrips.form.stops.*` (addStop, removeStop, depotHint, kmAtStop, arrivedAt)
- `today.truck.newTrip`
- `settings.truck.depot.*`

---

## 3. Bảng file thay đổi

| Loại | File | Thay đổi |
|------|------|---------|
| **DB Migration** | `migrations/0014_truck_multispot.sql` | MỚI |
| **Schema** | `packages/db/src/schema/trip-stopovers.schema.ts` | Sửa (+enum +4 cols) |
| **Schema** | `packages/db/src/schema/tenant-settings.schema.ts` | Sửa (+1 col) |
| **Core** | `packages/core/src/truck/truck-trip.service.ts` | Sửa (upsertStopovers) |
| **Shared** | `packages/shared/src/zod/truck-trip.zod.ts` | Sửa (stopovers, updateStopover) |
| **Shared** | `packages/shared/src/zod/tenant-settings.zod.ts` | Sửa (depot_address) |
| **Action** | `apps/web/src/server/actions/trips/truck-trip.actions.ts` | Sửa (DRIVER, stopovers) |
| **Action** | `apps/web/src/server/actions/trips/stopover.actions.ts` | MỚI |
| **Query** | `apps/web/src/server/queries/stopovers.queries.ts` | MỚI |
| **Frontend** | `apps/web/src/app/(app)/truck/trips/_components/stop-builder.tsx` | MỚI |
| **Frontend** | `apps/web/src/app/(app)/truck/trips/_components/truck-trip-form.tsx` | Sửa (stop builder) |
| **Frontend** | `apps/web/src/app/(app)/truck/trips/new/page.tsx` | Sửa (depot, driver access) |
| **Frontend** | `apps/web/src/app/(app)/truck/trips/[id]/page.tsx` | Sửa (fetch stopovers) |
| **Frontend** | `apps/web/src/app/(app)/truck/trips/[id]/edit/page.tsx` | Sửa (stopovers initial) |
| **Frontend** | `apps/web/src/app/(app)/today/_components/truck-driver-today.tsx` | Sửa (new trip btn) |
| **Frontend** | `apps/web/src/app/(app)/today/truck/[id]/page.tsx` | MỚI (stop update) |
| **Frontend** | `apps/web/src/app/(app)/trips/[id]/_components/truck-trip-detail.tsx` | Sửa (timeline) |
| **Frontend** | Settings page (truck section) | Sửa (depot field) |
| **i18n** | `messages/vi.json`, `en.json`, `ko.json` | Sửa (+keys) |

---

## 4. Side Impact Analysis

| Vùng | Rủi ro | Mức | Mô tả |
|------|--------|-----|-------|
| DB schema | Backward compat | Thấp | Cols thêm vào nullable, default WAYPOINT — trip cũ không bị lỗi |
| `TruckTripForm` | Breaking change UI | Cao | Form thay đổi hoàn toàn; edit form cần parse stopovers đúng |
| Auth DRIVER create | Security | Cao | Phải enforce `driver_id = self` nghiêm ngặt trong action |
| Month-close | Business rule | Trung | DRIVER cũng bị block khi tháng đóng — cần test edge case |
| Truck detail page | Regression | Thấp | Stopovers = 0 → fallback hiển thị cũ |
| `/today/truck/[id]` route | New surface | Trung | Route mới cần middleware check (chỉ DRIVER TRUCK có quyền) |
| Import flow | Không ảnh hưởng | Không | Import không xử lý stopovers |
| PnL / month-close | Không ảnh hưởng | Không | Chốt sổ dựa trên trip-level fields, không stopovers |

---

## 5. DB Migration SQL (0014_truck_multispot.sql)

```sql
-- 0014_truck_multispot.sql
-- Apply manually on staging and production.
-- Idempotent-safe via DO $$ / IF NOT EXISTS blocks.

BEGIN;

-- 1. Stop type enum
DO $$ BEGIN
  CREATE TYPE car_stop_type AS ENUM ('ORIGIN', 'PICKUP', 'DELIVERY', 'WAYPOINT', 'RETURN');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 2. Add columns to car_trip_stopovers
ALTER TABLE car_trip_stopovers
  ADD COLUMN IF NOT EXISTS tst_type car_stop_type NOT NULL DEFAULT 'WAYPOINT',
  ADD COLUMN IF NOT EXISTS tst_km INTEGER,
  ADD COLUMN IF NOT EXISTS tst_arrived_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS tst_notes TEXT;

-- 3. Add depot address to car_tenant_settings
ALTER TABLE car_tenant_settings
  ADD COLUMN IF NOT EXISTS tns_depot_address TEXT;

-- 4. Index for stopover type queries
CREATE INDEX IF NOT EXISTS idx_car_trip_stopovers_type
  ON car_trip_stopovers (tst_trip_id, tst_type);

COMMIT;
```

---

## Thứ tự implement (recommended)

```
A (DB migration) → B (schema) → C (core) → D (actions) → E (stop builder + form) → F (detail) → G (today) → H (settings) → I (i18n)
```

Phase A+B chạy song song. Phase C phụ thuộc B. Phase D phụ thuộc C. Phase E–I có thể song song sau D xong.
