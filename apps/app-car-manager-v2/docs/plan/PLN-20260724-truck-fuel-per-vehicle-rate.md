# PLN-20260724 — Phí nhiên liệu theo định mức + giá của XE

> Kèm [REQ-20260724-truck-fuel-per-vehicle-rate.md](../analysis/REQ-20260724-truck-fuel-per-vehicle-rate.md). Model: `km × (cvh_fuel_quota/100) × cvh_fuel_price` làm **mặc định**, giữ bình quân theo hoá đơn đè lên.

## 1. Hiện trạng phát triển
- Stack: Next 15 App Router + Drizzle/Neon. Core thuần ở `packages/core/src/truck`. Choke point công thức lặp ở 5 nơi (xem REQ §4).
- `cvh_fuel_quota` (L/100km) đã có, chưa dùng tính; chưa có field giá xe.
- Migration journal car-v2 lệch → SQL thủ công + baseline (theo tiền lệ).

## 2. Kế hoạch theo Phase

### Phase A — DB + Core (nền tảng)
- **A1** Schema: thêm `cvhFuelPrice` (`cvh_fuel_price numeric(14,2)` NULL) vào `vehicles.schema.ts`.
  - └─ Side-impact: mọi select `carVehicles` tự có cột mới (nullable → an toàn).
- **A2** Migration SQL thủ công (drizzle generate → file mới) + áp local (ep-steep-tooth). Staging áp sau khi duyệt, TRƯỚC khi deploy.
  - └─ Side-impact: nếu quên áp staging → query cột thiếu → 500. Checklist bắt buộc trước deploy.
- **A3** Core `truck-cost.ts`: thêm `truckTripFuelCostByVehicleRate({km, quotaPer100Km, price})` = `km≤0||!quota||!price ? 0 : round(km × quota/100 × price)`.
- **A4** `truck-fuel-snapshot.ts`: `loadTruckRegionSnapshots` nạp thêm `quota`+`price` theo vehicleId (đang đã query `carVehicles` cho `vehicleRegion` — chỉ thêm 2 cột + map `vehicleRate: Map<id,{quota,price}>`). Thêm helper `vehicleRate(vehicleId)`.
  - └─ Side-impact: 1 query đã có, thêm cột — không tăng round-trip.

### Phase B — Áp công thức 3 nhánh (mọi nơi tính phí)
Thứ tự nhánh: `snap → vehicleRate → 0`. Sửa tại:
- **B1** `truck-pnl.service.ts:184-192`
- **B2** `truck-finance.queries.ts:336-342` (+ preview `497-512`)
- **B3** `truck-trips.queries.ts:60-83, 264-268`
- **B4** `truck-report-export.queries.ts:235-240, 323-324`
  - └─ Side-impact chung: cột "Lít"/"Đơn giá" hiển thị suy ra (km×quota/100, giá xe) thay số nhập tay — đồng bộ ở finance list, trip detail, export. Phải sửa cả 3 chỗ hiển thị lít/đơn giá kèm phí.
- **B5** Trạng thái nhiên liệu → enum 3 giá trị (`AVERAGED | VEHICLE_RATE | UNSET`) thay `fuelReconciled:boolean`. Cập nhật `getTruckTripBreakdown`, `listTruckFinanceTrips`, `computeTruckPnl` (đếm theo nhánh), `truck-trip.actions.ts` (toast).

### Phase C — UI
- **C1** Xe: `truck-vehicle-form.tsx` + `vehicle.actions.ts` (+zod) — thêm ô "Giá xăng (đ/L)"; `fleet/page.tsx` hiển thị.
- **C2** Badge: `fuel-reconciliation-badge.tsx` — thêm state `vehicle-rate` (🔵 "Theo định mức") + `unset` (🟡 "Chưa đặt định mức xe"); i18n vi/en/ko (label+tooltip). Cập nhật mọi nơi gọi badge (finance/pnl/trip-detail).
- **C3** Form chuyến `truck-trip-form.tsx` + `truck-complete-section.tsx`: theo §3.4 REQ (chờ xác nhận) — Lít/Đơn giá → read-only suy ra, hoặc giữ giá override.
- **C4** Toast lưu chuyến: 3 nhánh mô tả (đã có khung từ commit 2cdd344).

### Phase D — Test + docs
- **D1** TC (`docs/test/TC-20260724-*.md`) — sẽ viết sau khi bạn duyệt hướng.
- **D2** Verify **trên staging** (local dev không hydrate — đã biết). Cập nhật badge/toast qua real Chrome như lần trước.
- **D3** RPT tổng kết.

## 3. Bảng file thay đổi

| Vùng | File | Loại |
|---|---|---|
| DB | `packages/db/src/schema/vehicles.schema.ts` | Sửa |
| DB | `packages/db/migrations/*` (SQL mới) | Mới |
| Core | `packages/core/src/truck/truck-cost.ts` | Sửa |
| Core | `packages/core/src/truck/truck-fuel-snapshot.ts` | Sửa |
| Core | `packages/core/src/truck/truck-pnl.service.ts` | Sửa |
| Query | `apps/web/src/server/queries/truck-finance.queries.ts` | Sửa |
| Query | `apps/web/src/server/queries/truck-trips.queries.ts` | Sửa |
| Export | `apps/web/src/server/queries/truck-report-export.queries.ts` | Sửa |
| Action | `apps/web/src/server/actions/trips/truck-trip.actions.ts` | Sửa |
| Action | `apps/web/src/server/actions/vehicles/vehicle.actions.ts` | Sửa |
| UI | `apps/web/src/app/(app)/truck/fleet/_components/truck-vehicle-form.tsx` | Sửa |
| UI | `apps/web/src/app/(app)/truck/fleet/page.tsx` + `fleet/[id]/edit/page.tsx` | Sửa |
| UI | `apps/web/src/app/(app)/truck/trips/_components/truck-trip-form.tsx` | Sửa |
| UI | `apps/web/src/app/(app)/trips/[id]/_components/truck-complete-section.tsx` | Sửa |
| UI | `apps/web/src/components/truck/fuel-reconciliation-badge.tsx` | Sửa |
| i18n | `apps/web/messages/{vi,en,ko}.json` | Sửa |
| zod | `packages/shared` (schema xe: +fuel_price) | Sửa |

## 4. Sai số / rủi ro (side-impact)

| Phạm vi | Rủi ro | Giảm thiểu |
|---|---|---|
| Migration staging thiếu | 500 khi đọc `cvh_fuel_price` | Checklist: áp SQL staging TRƯỚC deploy |
| Số cũ đổi | Chuyến chưa có báo cáo: phí đổi từ Lít×Đơn giá → km×định mức×giá | Đúng chủ đích R1; báo cáo đã freeze KHÔNG đổi |
| Xe chưa đặt định mức/giá | Phí = 0 bất ngờ | Badge "Chưa đặt định mức xe" + có thể seed định mức cho xe hiện có |
| `fuelReconciled:boolean`→enum | Vỡ chỗ gọi | tsc bắt hết; sửa đồng loạt |
| Export Excel | Template cột cố định | Chỉ đổi giá trị ô, không đổi layout |

## 5. Migration
```sql
-- car-v2 (Neon): local ep-steep-tooth + staging-car-truck ep-noisy-heart. KHÔNG đụng ep-gentle-rain.
ALTER TABLE car_vehicles ADD COLUMN cvh_fuel_price numeric(14,2) NULL;
-- (tuỳ chọn) seed định mức mặc định cho xe TRUCK chưa có, để không hiện "Chưa đặt định mức":
-- UPDATE car_vehicles SET cvh_fuel_quota = 30 WHERE cvh_type='TRUCK' AND cvh_fuel_quota IS NULL;
```
Synchronize tắt ở staging/prod → chạy SQL thủ công qua deploy script/Neon.

## 6. Cổng duyệt (User Approval Gate)
**Chưa code.** Cần bạn: (a) duyệt hướng PLAN này; (b) trả lời 3 điểm ở REQ §7 (số phận Lít/Đơn giá chuyến; fallback khi xe chưa có định mức; đơn vị L/100km). Sau khi bạn "tiến hành" → viết TC rồi implement theo Phase A→D.
