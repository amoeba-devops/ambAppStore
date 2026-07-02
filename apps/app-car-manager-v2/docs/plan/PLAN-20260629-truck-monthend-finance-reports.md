# PLAN-20260629 — Truck: mô hình tài chính cuối tháng + Chi phí&Lợi nhuận per-trip + Báo cáo

| | |
|---|---|
| **Ngày** | 2026-06-29 |
| **REQ** | [REQ-20260629](../analysis/REQ-20260629-truck-monthend-finance-reports.md) |
| **Quyết định đã chốt** | Q-A=**Tạm tính** · Q-B=**màn riêng (follow design)** · Q-C=**cột DB (làm thật)** · Q-D=**đủ 3 loại báo cáo** |
| **Migration** | `0016_truck_monthend_reports.sql` |

---

## 1. Hiện trạng phát triển (현황 분석)

- **Stack:** Next 15 App Router (RSC + Server Actions), Drizzle + Neon, S3 presigned, next-intl vi/en/ko, theme cam `#C2410C` (truck). Standalone Turborepo trong `apps/app-car-manager-v2/`.
- **Đã có (tái dùng):** `car_truck_month_close` (close/reopen + lock `CAR-E1002`), `car_truck_fuel_invoices`, `car_truck_fixed_costs`, `computeTruckPnl`, `getTruckFuelStats` (avgPrice+consumption — đang "analytics only"), `s3-client.ts`, `server/lib/excel.ts`, `api/v1/reports/export` (mẫu CAR), `audit-log.service`.
- **Migration mới nhất:** `0015` → tiếp theo **`0016`**. `car_users` prefix `usr_`.
- **Ràng buộc:** staging/prod `synchronize` OFF → SQL thủ công idempotent; áp **chỉ ep-noisy-heart** (staging-car-truck), staging chung giữ nguyên; mọi query `ent_id`; không set `trp_status` trực tiếp; i18n bắt buộc.

### IA finance (đã giải mã design)
- Sidebar "Tài chính" wire **`goProfit`** → màn **per-trip "Chi phí & Lợi nhuận"** (`isProfit`). `goMonthly` (2-tab P&L) định nghĩa nhưng **không wire** (quirk export) → vẫn build vì là nơi chốt sổ. → 2 màn riêng:
  - **`/truck/finance`** (mới) = bảng per-trip (màn chính, label "Chi phí & Lợi nhuận").
  - **`/truck/pnl`** (đổi cấu trúc) = P&L tháng 2 tab (Tổng quan + Hoá đơn & Chốt tháng), label "P&L tháng & Chốt sổ".
- Modal add/edit profit của prototype → **không clone**; sửa số liệu chuyến đi qua **trip edit form** (rows derive từ `car_trips`).

---

## 2. Kế hoạch theo pha (단계별)

### Phase A — DB + core math (P0 foundation)
- **A1.** Migration `0016`: +4 cột snapshot trên `car_truck_month_close`; bảng `car_truck_reports`; cột `car_users.usr_truck_reports_seen_at`.
  - `└─ 사이드 임팩트:` additive thuần, không phá dữ liệu cũ; tháng đã chốt trước đây → snapshot NULL.
- **A2.** Schema Drizzle: sửa `truck-month-close.schema.ts` (+4 cột), mới `truck-report.schema.ts`, sửa `users.schema.ts` (+1 cột), export `index.ts`.
- **A3.** Core `truck-cost.ts`: thêm `truckTripFuelCost({ km, consumption, avgPrice })` = `round(km × consumption × avgPrice)`. Giữ `computeTruckCost` cũ cho fallback.
- **A4.** `truck-pnl.service.ts`: khi tháng **CLOSED + có snapshot** → fuelCost/chuyến = `truckTripFuelCost(snapshot)`; else **fallback** `liters×price` (giữ số cũ). Nhận snapshot map theo tháng.
  - `└─ 사이드 임팩트:` **đổi số P&L** cho tháng đã chốt có snapshot — phải đồng bộ ở Phase B/C/E (dashboard, trips list).

### Phase B — `/truck/pnl` 2 tab + chốt-sổ-snapshot + reopen ADMIN-only (P0/P1: R3,R4,R5,R6,R7,R9)
- **B1.** `closeTruckMonthAction`: trước khi insert close-row → tính `avgPrice, consumption, totalLiters, totalKm` (từ `getTruckFuelStats`) → ghi snapshot vào close-row.
  - `└─ 사이드 임팩트:` chốt nặng hơn chút (1 query thống kê); dữ liệu nhỏ → OK.
- **B2.** `reopenTruckMonthAction`: `requireRole(['ADMIN'])` (siết từ ADMIN｜MANAGER).
  - `└─ 사이드 임팩트:` MANAGER mất quyền mở lại — thay đổi hành vi, ghi chú release.
- **B3.** `pnl/page.tsx` → 2 tab (`?tab=overview|invoices`): Overview = bảng P&L + card **biến đổi vs cố định** (R9) + **banner tạm tính** (R3) khi kỳ có tháng OPEN. Invoices = chip tháng + `FuelInvoicePanel` + card **Tổng hợp cuối tháng** (R5) + close/reopen + **Lịch sử điều chỉnh** (R6, đọc soft-deleted close-rows + audit).
- **B4.** `month-close-controls.tsx`: nút "Mở lại" chỉ hiện cho ADMIN.

### Phase C — Màn per-trip "Chi phí & Lợi nhuận" (P0: R1,R2)
- **C1.** Query `listTruckFinanceTrips(ent, { month|range, vehicleId?, status? })` → mỗi chuyến LOG: km, toll, extra, revenue + (CLOSED: giá BQ/lít/phí xăng/LN từ snapshot · OPEN: **null → "Tạm tính"**) + `status` Tạm tính/Đã chốt.
- **C2.** `truck/finance/page.tsx` + `_components/finance-trip-table.tsx`: summary cards (Lương TX, Doanh thu, Chi phí cố định, Cầu đường, Xăng dầu, Phát sinh, **Lợi nhuận ròng**) + bảng + lọc xe/trạng thái + export Excel. Badge **Tạm tính** (amber) / **Đã chốt** (xanh).
  - `└─ 사이드 임팩트:` thêm route + nav item; không đụng dữ liệu.

### Phase D — Module Báo cáo (P1: R8, Q-D đủ 3 loại)
- **D1.** Query/`truck-report.queries.ts` + `truck-report.actions.ts`: `generateTruckReportAction(month, type)` — sinh Excel (reuse `server/lib/excel.ts`) cho `PNL｜TRIP_LOG｜VEHICLE` → upload S3 (`truck-reports/{ent}/{month}/...`) → insert `car_truck_reports`. `markTruckReportsSeenAction` set `usr_truck_reports_seen_at`.
- **D2.** `truck/reports/page.tsx` (Danh sách: group theo tháng, badge **"Mới"** = `trr_created_at > usr_truck_reports_seen_at`, nút Tải) + `truck/reports/[id]/download/route.ts` (presigned).
- **D3.** `truck/reports/new/page.tsx` (stepper: chọn tháng → xác nhận preview per-xe → Lập báo cáo).
- **D4.** `nav-items.ts`: nhóm **Báo cáo** (Lập báo cáo + Danh sách, badge "Mới" count).
  - `└─ 사이드 임팩트:` dùng chung S3 bucket — namespace key riêng; Excel gen server-side (data nhỏ).

### Phase E — Đồng bộ hiển thị + i18n + dashboard (R9 + consistency)
- **E1.** Truck **trips list** + **dashboard KPI/recent**: chuyến thuộc tháng OPEN → LN hiển thị badge **Tạm tính** (không để số per-trip liters×price "giả chính xác" lệch với màn finance).
  - `└─ 사이드 임팩트:` **quan trọng** — nếu bỏ sót, số LN giữa dashboard/trips/finance sẽ mâu thuẫn.
- **E2.** Dashboard: card chia **biến đổi/cố định** + banner tạm tính khi kỳ có tháng OPEN.
- **E3.** i18n vi/en/ko: `screens.truckFinance`, `screens.truckReports`, bổ sung `screens.truckPnl`, `nav` (finance/reports/lập báo cáo), badge labels.

---

## 3. Danh sách file thay đổi (변경 파일)

| Khu | File | Loại |
|---|---|---|
| DB | `packages/db/migrations/0016_truck_monthend_reports.sql` | 신규 |
| DB | `packages/db/src/schema/truck-month-close.schema.ts` | 수정 (+4 cột) |
| DB | `packages/db/src/schema/truck-report.schema.ts` | 신규 |
| DB | `packages/db/src/schema/users.schema.ts` | 수정 (+1 cột) |
| DB | `packages/db/src/schema/index.ts` | 수정 (export) |
| Core | `packages/core/src/truck/truck-cost.ts` | 수정 (`truckTripFuelCost`) |
| Core | `packages/core/src/truck/truck-pnl.service.ts` | 수정 (snapshot + fallback) |
| Core | `packages/core/src/truck/index.ts` | 수정 |
| BE | `apps/web/src/server/queries/truck-finance.queries.ts` | 수정 (snapshot + per-trip rows) |
| BE | `apps/web/src/server/queries/truck-report.queries.ts` | 신규 |
| BE | `apps/web/src/server/actions/settings/truck-finance.actions.ts` | 수정 (close snapshot · reopen ADMIN) |
| BE | `apps/web/src/server/actions/truck-report.actions.ts` | 신규 |
| FE | `apps/web/src/app/(app)/truck/pnl/page.tsx` (+ `_components/*`) | 수정 (2 tab + cards + log) |
| FE | `apps/web/src/app/(app)/truck/finance/page.tsx` + `_components/finance-trip-table.tsx` | 신규 |
| FE | `apps/web/src/app/(app)/truck/reports/{page,new/page}.tsx` + `[id]/download/route.ts` + `_components/*` | 신규 |
| FE | `apps/web/src/app/(app)/truck/trips/page.tsx` + dashboard | 수정 (badge tạm tính) |
| FE | `apps/web/src/components/layout/nav-items.ts` | 수정 (Tài chính + Báo cáo) |
| i18n | `apps/web/messages/{vi,en,ko}.json` | 수정 |

---

## 4. Sai-impact (사이드 임팩트 분석)

| Phạm vi | Rủi ro | Mô tả / giảm thiểu |
|---|---|---|
| Hiển thị lợi nhuận toàn app | 🔴 Cao | Đổi model fuel → phải đồng bộ dashboard + trips list + finance + pnl (Phase E). Bỏ sót → số mâu thuẫn giữa màn. |
| Tháng đã chốt cũ (no snapshot) | 🟠 Vừa | Fallback `liters×price` → số cũ **không đổi**. Snapshot điền khi reopen→close lại. |
| Reopen ADMIN-only | 🟠 Vừa | MANAGER mất quyền — thay đổi hành vi, cần thông báo. |
| Reports S3 | 🟡 Thấp | Dùng chung bucket, key namespace `truck-reports/`. Presigned download. |
| `car_users` +cột | 🟢 Thấp | Additive. |
| Migration ep-noisy-heart only | 🟠 Vừa | Tuyệt đối **không** áp staging chung (ep-gentle-rain). Local trước. |

---

## 5. DB Migration (`0016_truck_monthend_reports.sql`)

```sql
-- 0016: truck month-end finance snapshot + reports module
-- snapshot giá BQ + định mức khi chốt tháng (cơ sở tính phí xăng chính thức)
ALTER TABLE car_truck_month_close ADD COLUMN IF NOT EXISTS tmc_avg_price     DECIMAL(14,2);
ALTER TABLE car_truck_month_close ADD COLUMN IF NOT EXISTS tmc_consumption   DECIMAL(10,6);
ALTER TABLE car_truck_month_close ADD COLUMN IF NOT EXISTS tmc_total_liters  DECIMAL(12,2);
ALTER TABLE car_truck_month_close ADD COLUMN IF NOT EXISTS tmc_total_km      DECIMAL(12,2);

-- báo cáo đã lập (metadata; file thật ở S3)
CREATE TABLE IF NOT EXISTS car_truck_reports (
  trr_id           CHAR(36)     PRIMARY KEY,
  ent_id           CHAR(36)     NOT NULL,
  trr_vehicle_type VARCHAR(8)   NOT NULL DEFAULT 'TRUCK',
  trr_month        VARCHAR(7)   NOT NULL,
  trr_type         VARCHAR(16)  NOT NULL,             -- PNL | TRIP_LOG | VEHICLE
  trr_format       VARCHAR(8)   NOT NULL DEFAULT 'EXCEL',
  trr_s3_key       VARCHAR(512) NOT NULL,
  trr_name         VARCHAR(200) NOT NULL,
  trr_created_by   CHAR(36),
  trr_created_at   TIMESTAMPTZ  NOT NULL DEFAULT now(),
  trr_deleted_at   TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_car_truck_reports_ent_month ON car_truck_reports (ent_id, trr_month);

-- mốc user xem báo cáo lần cuối (badge "Mới", Q-C làm thật ở DB)
ALTER TABLE car_users ADD COLUMN IF NOT EXISTS usr_truck_reports_seen_at TIMESTAMPTZ;
```

- Áp **local trước** (ep-steep-tooth) → test → **ep-noisy-heart** (staging-car-truck) khi cần authorize. **KHÔNG** áp ep-gentle-rain.
- Idempotent (`IF NOT EXISTS`) → chạy lại an toàn.

---

## 6. Thứ tự thực thi đề xuất
**A → B → C → E1(đồng bộ) → D → E2/E3.** A là nền (DB+core). B/C cho ra giá trị P0 sớm (chốt sổ thật + màn per-trip). E1 chống mâu thuẫn số. D (Báo cáo) lớn nhưng độc lập. Mỗi phase build + verify (chạy app, không chạy test) trước khi sang phase sau.
