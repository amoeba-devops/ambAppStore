# PLN-20260821 — Đóng băng phân bổ CP cố định theo báo cáo (phương án B, không UI)

> REQ: [REQ-20260821-truck-freeze-allocation-until-report.md](../analysis/REQ-20260821-truck-freeze-allocation-until-report.md)
> Quyết định chốt: **không thêm UI**, CRUD chuyến giữ nguyên, chỉ thêm cơ chế freeze tại lập BC + đọc frozen-first.

## 1. Hiện trạng hệ thống liên quan

- Coverage/freeze đã có cho **nhiên liệu**: `loadTruckRegionSnapshots` ([truck-fuel-snapshot.ts](../../packages/core/src/truck/truck-fuel-snapshot.ts)) đọc `car_truck_reports` (live, asc `trr_created_at`), fold whole-region đè cả scope / subset chỉ đè xe nó phủ, expose `fuelForTrip(month, vehicle, km, changedAt)` + `isReported(...)` + `reportedAt`.
- Phân bổ CP cố định tính live 100%: `loadTruckFixedAllocation` ([truck-fixed-allocation.ts](../../packages/core/src/truck/truck-fixed-allocation.ts)) — `forTrip(month, vehicleId)` không biết coverage.
- 2 điểm đọc per-trip: [truck-finance.queries.ts:432](../../apps/web/src/server/queries/truck-finance.queries.ts) (`listTruckFinanceTrips`) và [truck-trips.queries.ts:88](../../apps/web/src/server/queries/truck-trips.queries.ts) (`getTruckTripBreakdown`) — cả hai đã load `snapshots` song song.
- Điểm ghi BC: `generateOneTruckReport` ([truck-report.actions.ts](../../apps/web/src/server/actions/truck-report.actions.ts)) — 1 INSERT `car_truck_reports` (Neon HTTP, không transaction) rồi build workbook, lỗi → retract (`trr_deleted_at`).
- Workbook/report-export: tính tại thời điểm generate — không đổi.

## 2. Kế hoạch từng bước

### Step 1 — Migration + schema: cột `trr_fixed_alloc`
- `packages/db/migrations/0029_truck_report_fixed_alloc.sql`:
  `ALTER TABLE car_truck_reports ADD COLUMN IF NOT EXISTS trr_fixed_alloc jsonb;`
- [truck-report.schema.ts](../../packages/db/src/schema/truck-report.schema.ts): thêm `trrFixedAlloc: jsonb('trr_fixed_alloc').$type<TruckReportFixedAlloc[] | null>()` — shape `{ vehicleId, salary, depreciation, tripCount }` (số tháng + mẫu số tại thời điểm lập; share suy ra khi đọc bằng đúng `Math.round` của live path).
- └─ Sai số/side impact: cột nullable — build cũ đang chạy không SELECT * qua Drizzle vào cột mới (Drizzle chỉ SELECT cột nó biết) → an toàn deploy-order; dữ liệu cũ NULL = fallback live (grandfather).

### Step 2 — Ghi freeze khi lập BC
- `generateOneTruckReport`: trước INSERT, gọi `loadTruckFixedMonthly(entId, [month], {vehicleIds scope})` + đếm chuyến COMPLETED/LOG per vehicle trong tháng (đúng nguồn + filter của `loadTruckFixedAllocation` — tách helper `computeTruckFixedAllocRows(entId, month, vehicleIds?)` trong core để không lệch nguồn).
- Ghi mảng vào `trrFixedAlloc` ngay trong câu INSERT hiện có (1 statement — không thêm điểm dở dang).
- Freeze cả xe `tripCount = 0` trong scope (salary/dep tháng, tripCount 0) để đọc phân biệt "BC đã phủ xe này nhưng không có chuyến".
- └─ Side impact: PNL type `'PNL'` legacy vẫn đi qua đường này → cũng được freeze (vô hại, cùng semantics).

### Step 3 — Đọc frozen-first
- Mở rộng select trong `loadTruckRegionSnapshots` thêm `trrFixedAlloc`; fold **cùng vòng lặp + cùng semantics** với `trr_vehicle_fuel` (whole-region đè mọi xe của scope; subset chỉ đè xe nó phủ; asc created order) → map `${month}|${vehicleId}` → `{salary, depreciation, tripCount, at}`.
- Expose `fixedShareForTrip(month, vehicleId, changedAt?): TruckTripFixedShare | null` — trả share đóng băng (`Math.round(salary/tripCount)`, tripCount>0) khi trip được phủ (`changedAt ≤ at`, cùng rule fuel); ngược lại `null`.
- 2 query đọc đổi thành: `snapshots.fixedShareForTrip(...) ?? fixedAlloc.forTrip(...)` (fallback live y nguyên hôm nay).
- `loadTruckFixedAllocation` giữ nguyên chữ ký (generator + fallback dùng) — **không** đụng UI component nào.
- └─ Side impact: chuyến sửa sau BC rơi về live cho CẢ fuel lẫn phân bổ (một rule coverage duy nhất — không có trạng thái nửa chốt).

### Step 4 — Test + tài liệu
- E2E (dev :3001, Playwright, pattern `truck-trip-receipt-upload.spec.ts`): seed → lập BC → tạo chuyến → assert 3 dòng cũ bất biến; lập lại BC → assert chia lại; xoá chuyến → dòng còn lại vẫn frozen. Fallback: tháng không BC + BC legacy (NULL) → số y hệt live.
- `tsc --noEmit` + `next lint` 5/5 package.
- TR + RPT theo workflow.

## 3. Danh sách file thay đổi

| Khu vực | File | Loại |
|---|---|---|
| DB | `packages/db/migrations/0029_truck_report_fixed_alloc.sql` | Mới |
| DB | `packages/db/src/schema/truck-report.schema.ts` | Sửa |
| Core | `packages/core/src/truck/truck-fixed-allocation.ts` (helper `computeTruckFixedAllocRows`) | Sửa |
| Core | `packages/core/src/truck/truck-fuel-snapshot.ts` (fold + `fixedShareForTrip`) | Sửa |
| Action | `apps/web/src/server/actions/truck-report.actions.ts` | Sửa |
| Query | `apps/web/src/server/queries/truck-finance.queries.ts` | Sửa (1 dòng resolution) |
| Query | `apps/web/src/server/queries/truck-trips.queries.ts` | Sửa (1 dòng resolution) |
| Test | `apps/web/e2e/truck-fixed-alloc-freeze.spec.ts` | Mới |
| UI / i18n | — | **Không đổi (quyết định user)** |

## 4. Phân tích side impact

| Phạm vi | Rủi ro | Ghi chú |
|---|---|---|
| Màn Chi phí & LN + chi tiết chuyến | Thấp | Chỉ đổi NGUỒN số (frozen-first), không đổi render |
| Báo cáo Excel / review wizard | Không | Generate-time compute, đã là "tính khi lập BC" |
| P&L tháng / dashboard / export | Không | Cấp tháng, không dùng per-trip share |
| BC subset xe (REQ-20260817) | Trung bình | Phải copy đúng fold semantics của `trr_vehicle_fuel` — có TC riêng |
| Σshare ≠ tổng tháng giữa 2 lần BC | Chấp nhận | Theo quyết định user; badge cam sẵn có |
| Deploy order | Thấp | Cột mới nullable; migrate DB trước deploy build (theo [DROP-COLUMN lesson](../bug-fix/) ngược lại: ADD an toàn cả 2 chiều với Drizzle named-select) |

## 5. DB migration

```sql
-- 0029_truck_report_fixed_alloc.sql (staging/prod chạy tay, synchronize off)
ALTER TABLE car_truck_reports ADD COLUMN IF NOT EXISTS trr_fixed_alloc jsonb;
```
Không backfill: BC lịch sử NULL → fallback live; lập lại BC là có freeze.
