# REQ-20260623 — Truck Trip: Multi-stop Route + Driver Self-Create

## 1. Yêu cầu tóm tắt

| # | Yêu cầu | Loại |
|---|---------|------|
| R1 | Lộ trình chuyến xe tải hỗ trợ nhiều điểm dừng có thứ tự (Origin → Pickup → Waypoints → Delivery → Waypoints → Return) | Functional |
| R2 | Mỗi điểm dừng có: địa chỉ, loại điểm (Origin/Pickup/Delivery/Waypoint/Return), km tích lũy (odometer), thời gian đến, ghi chú | Functional |
| R3 | Tài xế có thể cập nhật km + thời gian đến từng điểm dừng trong thời gian thực (từ `/today`) | Functional |
| R4 | Tài xế tự tạo chuyến xe tải (driver_id = chính mình, không assign người khác) | Functional |
| R5 | Tenant cấu hình địa chỉ bãi mặc định; form pre-fill nhưng cho phép override per-chuyến | Functional |
| R6 | Tài chính (revenue) chỉ bắt buộc với manager; driver chỉ điền chi phí vận hành (xăng, phí cầu đường) | Business Rule |
| R7 | Driver-created trips xuất hiện trong danh sách manager để review và chốt sổ tháng | Functional |
| R8 | Month-close constraint áp dụng cho cả driver khi tạo chuyến | Business Rule |

---

## 2. AS-IS Hiện trạng

### 2.1 Frontend — Form tạo chuyến truck

**File**: `apps/web/src/app/(app)/truck/trips/_components/truck-trip-form.tsx`

Hiện tại chỉ có 2 trường địa chỉ:
```
trpPickupAddress  → <Input> "Điểm lấy hàng" (required)
trpDropoffAddress → <Input> "Điểm giao" (required)
```
Form **không sử dụng** `car_trip_stopovers` — không có stopover builder.

**Auth gate**: chỉ ADMIN/MANAGER được tạo (`requireRole(['ADMIN', 'MANAGER'])` trong `createTruckTripAction`).

### 2.2 Backend — Schema stopovers hiện tại

**File**: `packages/db/src/schema/trip-stopovers.schema.ts`

```ts
carTripStopovers: {
  tstId          // PK
  entId          // multi-tenancy
  tstTripId      // FK → car_trips
  tstAddress     // text, địa chỉ
  tstOrder       // smallint, thứ tự
  tstCreatedAt   // timestamp
}
```

**Thiếu**: `tst_type` (loại điểm), `tst_km` (odometer), `tst_arrived_at`, `tst_notes`.

### 2.3 Backend — Tenant settings

**File**: `packages/db/src/schema/tenant-settings.schema.ts`

Không có trường `depot_address`. Không có cách lưu địa chỉ bãi mặc định.

### 2.4 Backend — Core truck trip service

**File**: `packages/core/src/truck/truck-trip.service.ts`

`createTruckTrip(actor, input)` nhận `pickupAddress` + `dropoffAddress` nhưng không xử lý stopovers. `updateTruckTrip` tương tự.

### 2.5 Auth actions

**File**: `apps/web/src/server/actions/trips/truck-trip.actions.ts`

- `createTruckTripAction`: `requireRole(['ADMIN', 'MANAGER'])` — DRIVER bị block
- `driverCompleteTruckTripAction`: tồn tại nhưng chỉ complete, không create

### 2.6 Driver today view

**File**: `apps/web/src/app/(app)/today/_components/truck-driver-today.tsx`

Hiển thị trip list (todo/done) nhưng:
- Không có nút "Tạo chuyến mới"
- Link tới `/trips/[id]` nhưng không có stopover timeline

### 2.7 Vấn đề

- Driver không tự tạo chuyến được
- Không có multi-stop route → chỉ 1 điểm lấy + 1 điểm giao
- Không tracking km tại từng điểm dừng
- Không có địa chỉ bãi mặc định → driver/manager phải điền tay mỗi lần
- Revenue bắt buộc về mặt logic nhưng cần phân quyền rõ hơn (driver không biết doanh thu)

---

## 3. TO-BE Yêu cầu

### 3.1 AS-IS → TO-BE mapping

| Vùng | AS-IS | TO-BE |
|------|-------|-------|
| Pickup/Dropoff | 2 field flat text | Dynamic stop list (ORIGIN, PICKUP, WP*, DELIVERY, WP*, RETURN) |
| Stopover schema | address + order only | + `tst_type`, `tst_km`, `tst_arrived_at`, `tst_notes` |
| Depot address | Không có | Lưu `tns_depot_address` trong tenant settings; pre-fill form |
| Auth tạo trip | ADMIN/MANAGER only | ADMIN/MANAGER/DRIVER (driver chỉ self-assign) |
| Driver form | Không có | Simplified form (no revenue field) |
| Driver today | Xem danh sách | + Nút tạo chuyến + update km từng điểm |
| Revenue | Trong create form | Optional cho driver, manager fill để chốt sổ |

### 3.2 Enum loại điểm dừng mới

```sql
ALTER TYPE ... -- Thêm enum giá trị vào car_trip_stopovers
tst_type: 'ORIGIN' | 'PICKUP' | 'DELIVERY' | 'WAYPOINT' | 'RETURN'
```

Label UI (vi): Xuất phát · Lấy hàng · Giao hàng · Điểm ghé · Về bãi

### 3.3 Cấu trúc stopover mới

```ts
// Mỗi stopover trong form:
{
  type: StopType;          // loại điểm
  address: string;         // địa chỉ
  km?: number;             // odometer tại điểm (optional khi tạo, fill khi thực hiện)
  arrivedAt?: string;      // ISO datetime (optional)
  notes?: string;          // ghi chú
}
```

### 3.4 Cấu trúc lộ trình

Form stop list (thứ tự cố định):
1. **ORIGIN** — pre-fill từ `tns_depot_address`, editable (có thể để trống)
2. **PICKUP** — required, type = PICKUP
3. **[+ Thêm ghé]** — WAYPOINT (0-N stops)
4. **DELIVERY** — required, type = DELIVERY
5. **[+ Thêm ghé]** — WAYPOINT (0-N stops)
6. **RETURN** — pre-fill từ `tns_depot_address`, editable (có thể để trống)

ORIGIN + RETURN không bắt buộc (trip có thể không xuất phát từ bãi).

### 3.5 Phân quyền điền liệu

| Trường | Manager | Driver |
|--------|---------|--------|
| Lộ trình (stops) | ✓ | ✓ |
| Xe (vehicle) | Chọn bất kỳ | Chọn bất kỳ xe TRUCK |
| Tài xế (driver) | Chọn bất kỳ | Bắt buộc = chính mình |
| Xăng (liters), Phí cầu | ✓ | ✓ |
| Giá xăng (price/liter) | ✓ | ✓ |
| Doanh thu (revenue) | ✓ | ✗ (hidden) |
| BOL/CDF | ✓ | ✓ |
| Chốt sổ tháng | ✓ | ✗ |

### 3.6 Business rule driver self-create

- Driver tạo trip → `driver_id` bắt buộc = `actor.userId` driver record
- Trip có đủ driver+vehicle → auto-`CONFIRMED` (giống flow hiện tại)
- `assertTruckMonthOpen` áp dụng cho driver
- Driver không điền revenue → `trp_revenue = null` cho đến khi manager cập nhật
- Driver có thể update stopover km real-time trong `/today/truck/[tripId]` khi trip `IN_PROGRESS` hoặc `CONFIRMED`

### 3.7 Depot settings UI

Trang `/settings` (truck section): thêm field "Địa chỉ bãi mặc định" — admin/manager save vào `tns_depot_address`.

---

## 4. Phân tích Gap

### 4.1 Bảng thay đổi

| Vùng | Hiện tại | Thay đổi | Độ ảnh hưởng |
|------|---------|---------|------------|
| DB: `car_trip_stopovers` | 6 cols | +4 cols (type, km, arrived_at, notes) | Migration cần |
| DB: `car_tenant_settings` | Không có depot | +1 col (`tns_depot_address`) | Migration cần |
| Drizzle schema | trip-stopovers.schema.ts | Update + new enum | Low |
| Drizzle schema | tenant-settings.schema.ts | +1 column | Low |
| Core: `truck-trip.service.ts` | No stopover CRUD | Thêm upsertStopovers | Medium |
| Shared Zod: `truck-trip.zod.ts` | No stopovers | + `stopovers` array + `updateStopoverSchema` | Low |
| Action: `createTruckTripAction` | ADMIN/MANAGER | + DRIVER (self-only) | Medium |
| Action: NEW `updateStopoverAction` | Không có | DRIVER update km/time tại stop | Medium |
| Action: `updateTenantDepotAction` | Không có | Save depot address | Low |
| Frontend: `TruckTripForm` | pickup+dropoff flat | Dynamic stop builder | High |
| Frontend: `TruckDriverToday` | List only | + New trip button + stop km update | Medium |
| Frontend: `/truck/trips/new` | ADMIN/MANAGER page | + Driver access | Low |
| Frontend: Truck trip detail | Pickup→Dropoff | Stopover timeline | Medium |
| i18n | Không có stop labels | + stopType labels, driver form strings | Low |

### 4.2 File thay đổi

**DB / Schema:**
- `packages/db/src/schema/trip-stopovers.schema.ts` — sửa
- `packages/db/src/schema/tenant-settings.schema.ts` — sửa

**Core:**
- `packages/core/src/truck/truck-trip.service.ts` — sửa (upsertStopovers)

**Shared:**
- `packages/shared/src/zod/truck-trip.zod.ts` — sửa (stopovers array, updateStopover)
- `packages/shared/src/zod/tenant-settings.zod.ts` — sửa (depot_address)

**Server Actions:**
- `apps/web/src/server/actions/trips/truck-trip.actions.ts` — sửa (DRIVER role, stopovers)
- `apps/web/src/server/actions/trips/stopover.actions.ts` — **MỚI**
- `apps/web/src/server/actions/settings/tenant-settings.actions.ts` — sửa (depot)
- `apps/web/src/server/queries/stopovers.queries.ts` — **MỚI**
- `apps/web/src/server/queries/tenant-settings.queries.ts` — sửa

**Frontend:**
- `apps/web/src/app/(app)/truck/trips/_components/truck-trip-form.tsx` — sửa toàn bộ
- `apps/web/src/app/(app)/truck/trips/_components/stop-builder.tsx` — **MỚI**
- `apps/web/src/app/(app)/truck/trips/new/page.tsx` — sửa (load depot, allow driver)
- `apps/web/src/app/(app)/truck/trips/[id]/page.tsx` — sửa (stopovers)
- `apps/web/src/app/(app)/today/_components/truck-driver-today.tsx` — sửa (new trip btn)
- `apps/web/src/app/(app)/today/truck/[id]/page.tsx` — **MỚI** (driver stop-update)
- `apps/web/src/app/(app)/trips/[id]/_components/truck-trip-detail.tsx` — sửa (stopover timeline)
- `apps/web/src/app/(app)/truck/settings/page.tsx` hoặc settings section — sửa (depot field)

**i18n:**
- `apps/web/messages/vi.json`, `en.json`, `ko.json` — thêm keys

### 4.3 DB migration strategy

Staging (Neon) và Production đều dùng manual SQL migration (drizzle-kit journal chỉ quản lý 0000–0007). File migration: `0014_truck_multispot.sql`.

---

## 5. User Flow

### 5.1 Manager tạo chuyến với lộ trình nhiều điểm

```
Manager → /truck/trips/new
  → Form mở với ORIGIN pre-fill = depot address (editable)
  → Chọn xe / tài xế
  → Điền PICKUP stop (required)
  → [+ Thêm ghé] → Waypoint stop
  → Điền DELIVERY stop (required)
  → [+ Thêm ghé] → Waypoint stop sau giao
  → RETURN pre-fill = depot address (editable)
  → Điền thông tin tài chính (revenue, xăng, phí)
  → Save → Trip CONFIRMED (nếu có driver+vehicle)
  → Driver nhận notification → thấy trong /today
```

### 5.2 Driver tự tạo chuyến

```
Driver → /today → Nút "Tạo chuyến mới"
  → /truck/trips/new (form driver version)
  → Tài xế = chính mình (locked)
  → Chọn xe TRUCK
  → Điền lộ trình (stops)
  → Điền xăng / phí cầu đường (optional tại thời điểm tạo)
  → Save → Trip CONFIRMED
  → Trip hiện trong /today "Cần hoàn thành"
```

### 5.3 Driver cập nhật km real-time

```
Driver đang chạy → /today
  → Tap vào trip → /today/truck/[id]
  → Thấy danh sách stops theo thứ tự
  → Tap stop đang ở → điền km hiện tại + giờ đến
  → Save → tst_km + tst_arrived_at được cập nhật
  → Đến điểm tiếp → lặp lại
  → Hoàn tất chuyến → fill end odometer, fuel liters → Complete
```

### 5.4 Manager chốt sổ

```
Manager → /truck/trips (danh sách)
  → Thấy trips do driver tạo (status = CONFIRMED hoặc COMPLETED)
  → Click trip → xem chi tiết + stopover timeline + km từng điểm
  → Nếu driver chưa fill revenue → Manager edit trip → thêm revenue
  → Cuối tháng → /truck/pnl → Chốt sổ tháng
```

---

## 6. Ràng buộc kỹ thuật

- **Neon HTTP driver**: không có interactive transactions — stopovers insert/update là delete-then-insert batch (idempotent, đã có precedent ở `completeTruckTrip`)
- **Month close**: `assertTruckMonthOpen` áp dụng cho cả DRIVER khi create/update trip
- **DRIVER self-assign**: server action phải verify `actor.driverRecord.drvId === dto.driver_id` — không để driver assign trip cho người khác
- **Stop ordering**: `tst_order` dùng cho sort, từ 1 → N; ORIGIN = 1, RETURN = N (max)
- **Backward compat**: trip hiện tại không có stopovers — detail page cần handle `stopovers.length === 0` → hiển thị pickup→dropoff như cũ
- **Drizzle migration**: cần generate migration 0014 sau khi update schema files
- **i18n parity**: tất cả key mới phải đủ 3 ngôn ngữ vi/en/ko
