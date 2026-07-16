# PLAN-20260616 — Fleet đa loại xe (Car + Truck) & Driver mở rộng

> **Mục tiêu**: Phát triển hệ thật từ 2 prototype — `prototype/car-truck-manager` (web admin/manager) và `prototype/driver-app` (driver PWA) — bằng cách **mở rộng `app-car-manager-v2` thành "Fleet" đa loại xe (CAR + TRUCK)**, driver nằm trong chính app này.
>
> **Quyết định kiến trúc đã chốt (2026-06-16):**
> 1. Truck **gộp vào `app-car-manager-v2`** (không tách app riêng) → 1 app Fleet, phân biệt theo loại xe.
> 2. Driver experience **nằm trong app** (mở rộng driver PWA `/today` sẵn có), không tách app driver riêng.

---

## 1. Hiện trạng phát triển (AS-IS)

### 1.1 `app-car-manager-v2` (đang chạy MVP, Post-MVP phase)
- **Stack**: Next.js 15 (App Router, RSC + Server Actions) · Drizzle + Neon Postgres · S3 · jose JWT · next-intl (vi/en/ko) · Tailwind 3 · Render.com.
- **Domain hiện có (car-only, passenger dispatch)**:
  - `car_vehicles`, `car_drivers`, `car_trips`, `car_trip_stopovers`, `car_expenses`, `car_expense_attachments`, `car_inspections`, `car_notifications`, `car_audit_logs`, `car_approval_rules`, `car_users`.
  - **Trip state machine** (PRD §9.1): `PENDING_ASSIGNMENT → PENDING_DRIVER_CONFIRMATION → CONFIRMED → IN_PROGRESS → COMPLETED` (+ REJECTED/CANCELLED). Driver Accept/Reject/Start/End.
  - **Expense**: 8 loại, approval rule + auto-approve threshold, S3 chứng từ.
  - **Driver PWA** (`/today`): hero next-trip + later today + my vehicles + recent; action bar Accept/Reject/Start/End; trip detail in-cab.
  - **Nav** (`nav-items.ts`): role-based (Admin/Manager/Driver). Driver: today · tripsMine · expensesNew · me.
  - i18n đầy đủ vi/en/ko (`messages/{vi,en,ko}.json`).
- **Không có** bất kỳ khái niệm Truck nào (grep `truck` = rỗng).

### 1.2 Prototype `prototype/car-truck-manager/index.html` (web admin/manager)
- 1 file HTML, dept switch **Xe con (xanh #0369A1) / Xe tải (cam #C2410C)**.
- **Truck domain** thể hiện: Dashboard, Trips (nhật ký chuyến), Trucks, Drivers, **Chi phí & Lợi nhuận tháng (P&L)**, Import Excel (tải template `.xlsx` + 17 cột chuẩn `CR-Vietnam-Truck-v1`), Users, Audit.
- Đã rút gọn: bỏ menu Cài đặt & Báo cáo (theo yêu cầu trước), Import chỉ còn tải template.

### 1.3 Prototype `prototype/driver-app/index.html` (driver PWA)
- Mobile-first, theme car/truck, i18n vi/en/ko, deep-link demo.
- **Car driver**: giữ workflow dispatch (Chờ xác nhận → Chấp nhận/Từ chối → Bắt đầu → Kết thúc) — khớp v2 hiện tại.
- **Truck driver** (đã chốt UX):
  - **Bỏ workflow status** (admin assign = auto-approve). Trạng thái chỉ "Cần hoàn thành" / "Đã hoàn thành".
  - Menu 3 tab: Hôm nay · Chuyến của tôi · Tôi (bỏ tab Ghi nhận chi phí).
  - **Form HOÀN THÀNH CHUYẾN ĐI** (mở từ màn chi tiết, không hiện ở Home): Giờ bắt đầu, Giờ kết thúc, Số km đồng hồ lúc kết thúc, Lượng nhiên liệu tiêu thụ (lít), Phí cầu đường, **Chi phí phát sinh khác = list {tên khoản + số tiền} có nút "+"**.
  - Chi tiết chuyến đã hoàn thành: hiển thị **breakdown chi phí + tổng** (read-only).

### 1.4 Khác biệt domain Car vs Truck (cốt lõi của plan)
| Khía cạnh | CAR (dispatch) | TRUCK (trip log) |
|---|---|---|
| Mô hình chuyến | Đón/trả khách, pickup/dropoff/passenger | Chở hàng: from/to, khách hàng, **BOL/CDF** |
| Vòng đời | State machine 6 trạng thái, driver Accept/Reject | **Auto-confirm khi assign** → driver **hoàn thành** |
| Chi phí | 8 loại, approval, ad-hoc | Nhập **khi kết thúc chuyến**: km, nhiên liệu (lít), phí cầu đường, **chi phí khác có cấu trúc** |
| Báo cáo | Dashboard lịch/booking | **P&L tháng** (doanh thu − biến đổi − cố định: lương/khấu hao/bảo hiểm), định mức nhiên liệu |
| Nhập liệu | Form tạo chuyến | **Import Excel** (1 file = 1 xe, 1 sheet = 1 tháng) |

---

## 2. TO-BE: Mô hình Fleet đa loại xe

### 2.1 Nguyên tắc
- **Discriminator `vehicle_type` (CAR | TRUCK)** xuyên suốt: vehicle, trip, driver-scope.
- **Tái sử dụng tối đa** hạ tầng v2 (auth, ent_id multi-tenancy, S3, audit, notification, i18n, UI tokens).
- **Tách nhánh hành vi** ở Service layer theo `vehicle_type`/`trp_kind` — KHÔNG nhồi logic truck vào service car hiện có (giữ car MVP an toàn).
- **Không phá vỡ car MVP đang chạy production**: thêm cột nullable, default `CAR`, migration cộng dồn (không destructive).

### 2.2 Mô hình dữ liệu (đề xuất)
- `car_vehicles`: thêm `cvh_type ENUM('CAR','TRUCK') DEFAULT 'CAR'` + cột truck nullable: `cvh_tonnage`, `cvh_fuel_quota` (L/km).
- `car_trips`: thêm `trp_kind ENUM('DISPATCH','LOG') DEFAULT 'DISPATCH'` + cột truck-log nullable: `trp_customer`, `trp_bol`, `trp_cdf`, `trp_odo_start`, `trp_odo_end`, `trp_fuel_liters`, `trp_toll_fee`, `trp_revenue`, `trp_started_at`, `trp_finished_at`.
  - Truck trip bỏ qua `PENDING_DRIVER_CONFIRMATION` → khi assign chuyển thẳng `CONFIRMED`; driver hoàn thành → `COMPLETED`.
- **Bảng mới `car_trip_extra_costs`** (chi phí phát sinh khác có cấu trúc): `tec_id`, `ent_id`, `trp_id` (FK), `tec_name`, `tec_amount`, `tec_created_at`. → thống kê được theo tên/khoản.
- **Bảng mới `car_truck_fixed_costs`** (chi phí cố định tháng/xe): `tfc_id`, `ent_id`, `cvh_id`, `tfc_month`, `tfc_salary`, `tfc_depreciation`, `tfc_insurance`.
- **Bảng mới `car_imports`** (lịch sử import Excel): `imp_id`, `ent_id`, `imp_file_name`, `imp_vehicle_id`, `imp_row_count`, `imp_status`, `imp_created_by`, `imp_created_at`.
- (Tùy chọn) `car_drivers`: thêm `drv_vehicle_type` nếu cần giới hạn tài xế theo loại xe.

> **Lưu ý**: tất cả cột mới NULLABLE + có default → migration an toàn cho dữ liệu car hiện hữu. DB staging/prod `synchronize=false` → viết **SQL migration thủ công** (Drizzle migration files).

### 2.3 Phân quyền & ngữ cảnh loại xe
- Thêm khái niệm "context loại xe" ở UI (dept switch như prototype) cho Admin/Manager.
- Driver: xác định luồng theo `vehicle_type` của xe được giao (CAR → dispatch UI; TRUCK → completion UI).

---

## 3. Kế hoạch theo Phase (mỗi Phase = 1 chu trình [요구사항]: REQ → PLAN → TC → impl → TR → RPT)

> Mỗi Phase nên có REQ/TC riêng trong `docs/analysis` & `docs/test` trước khi code (theo convention root CLAUDE.md). Plan này là **master plan** điều phối các Phase.

### Phase 0 — Nền tảng & Schema (BE)
- Thiết kế & chốt schema đa loại xe (mục 2.2); viết Drizzle schema + **migration SQL thủ công**.
- Seed loại xe, cập nhật `cvh_type='CAR'` cho dữ liệu hiện có.
- `vehicle-type` helper + guard ở service layer.
- └─ **Side impact**: chạm `car_vehicles`, `car_trips` (production) → migration phải reversible, test trên Neon branch dev trước.

### Phase 1 — Truck domain backend (BE)
- Truck trip lifecycle service (`truck-trip.service.ts`): assign → auto-CONFIRMED → complete (ghi metrics + extra costs).
- Completion service: validate 7 trường, ghi `car_trip_extra_costs`, tính tổng chi phí chuyến.
- Cost aggregation + P&L service (`truck-pnl.service.ts`): doanh thu − (nhiên liệu + cầu đường + phát sinh) − cố định (lương/khấu hao/bảo hiểm prorate theo tháng).
- Fuel quota check + alert.
- └─ **Side impact**: `trip-state-machine.service` phải nhánh theo `trp_kind` (không phá transition car).

### Phase 2 — Web Admin/Manager Truck (FE + BE API)
- Dept switch (CAR/TRUCK) + theme (xanh/cam) — port từ prototype `car-truck-manager`.
- Truck Vehicles CRUD (tonnage, fuel quota).
- Truck Trips: list (nhật ký), create/assign, detail.
- **Import Excel**: tải template `.xlsx` (đã prototype) + upload/parse 17 cột + preview + lưu (`car_imports`).
- **Reports**: P&L tháng, tiêu hao nhiên liệu vs định mức.
- Settings truck: định mức nhiên liệu, chi phí cố định tháng, quy tắc vận hành.
- └─ **Side impact**: nav-items.ts thêm mục theo loại xe; tránh lộ menu truck cho ngữ cảnh car.

### Phase 3 — Driver PWA mở rộng (FE)
- `/today` & trip detail **nhánh theo `vehicle_type`**:
  - CAR → giữ nguyên dispatch (Accept/Reject/Start/End).
  - TRUCK → "Cần hoàn thành"/"Đã hoàn thành"; **Form Hoàn thành chuyến đi** (port từ prototype driver-app: 7 trường + chi phí phát sinh khác dạng {tên+số tiền} có "+").
- Truck driver: menu 3 tab (bỏ tab Ghi nhận chi phí); nút Hoàn thành chỉ ở màn chi tiết (không ở Home).
- Chi tiết chuyến đã hoàn thành: breakdown chi phí + tổng.
- i18n vi/en/ko cho toàn bộ chuỗi truck mới.
- └─ **Side impact**: `nav-items.ts` driver tabs động theo loại xe; `trip-actions.tsx` & driver views phải branch.

### Phase 4 — Reports & Dashboard tổng hợp
- Dashboard P&L đa xe; cảnh báo vượt định mức nhiên liệu; export Excel/PDF (reuse cơ chế car).

### Phase 5 — Hardening, Test, Deploy
- Playwright/Vitest cho truck flow; kiểm thử hồi quy car MVP; deploy staging trước, test, rồi production.

---

## 4. Danh sách thay đổi file (tổng quan — chi tiết hoá ở PLAN từng Phase)

| Khu vực | File (tiêu biểu) | Loại |
|---|---|---|
| DB | `packages/db/src/schema/vehicle.schema.ts`, `trip.schema.ts` (+ cột mới) | Sửa |
| DB | `…/schema/trip-extra-cost.schema.ts`, `truck-fixed-cost.schema.ts`, `import.schema.ts` | Mới |
| DB | `packages/db/migrations/00xx_fleet_truck.sql` | Mới |
| BE | `server/services/truck-trip.service.ts`, `truck-pnl.service.ts`, `truck-import.service.ts` | Mới |
| BE | `server/services/trip-state-machine.service.ts` (nhánh `trp_kind`) | Sửa |
| BE | `server/actions/trips/*`, `server/actions/imports/*` | Sửa/Mới |
| FE | `app/(app)/…` màn truck (vehicles/trips/import/reports/settings) | Mới |
| FE | `app/(app)/today/_components/*`, `trips/[id]/_components/*` (nhánh loại xe) | Sửa |
| FE | `components/layout/nav-items.ts` (mục theo loại xe) | Sửa |
| i18n | `messages/{vi,en,ko}.json` (namespace truck) | Sửa |

## 5. DB Migration (chiến lược)
- Tất cả cột mới **NULLABLE + DEFAULT** → không phá dữ liệu car.
- Viết **SQL migration thủ công** (Drizzle `drizzle-kit generate` rồi review tay), áp trên **Neon branch dev** → staging → production.
- Backfill: `UPDATE car_vehicles SET cvh_type='CAR'`, `UPDATE car_trips SET trp_kind='DISPATCH'`.
- Bảng mới đều có `ent_id` (multi-tenancy) + index `idx_*_ent_*`.

## 6. Sided impact & Rủi ro
| Phạm vi | Rủi ro | Giảm thiểu |
|---|---|---|
| Car MVP production | Trộn 2 domain vào 1 app có thể hồi quy car | Branch service theo `trp_kind`; test hồi quy; feature-flag truck |
| Trip state machine | Truck bỏ confirmation dễ phá transition car | Nhánh riêng, single source of truth giữ nguyên cho car |
| Migration | Chạm bảng production lớn | Cột nullable, test Neon branch, rollback script |
| Nav/role | Lộ menu truck cho user car | Lọc theo `vehicle_type`/context |
| i18n | Thiếu chuỗi → fallback sai | Thêm đủ vi/en/ko mỗi Phase |

## 7. Đề xuất thứ tự & quy trình
1. Chốt plan này → tạo **REQ-20260616-fleet-truck** (phân tích chi tiết AS-IS/TO-BE từng màn).
2. Lần lượt Phase 0 → 5, mỗi Phase: REQ (nếu cần) → TC → impl → TR → RPT, deploy **staging trước**.
3. Giữ 2 prototype làm "visual + interaction reference" (không phải spec) — bám PRD/REQ khi có mâu thuẫn.

---

**Tham chiếu**: `prototype/car-truck-manager/index.html`, `prototype/driver-app/index.html`, `app-car-manager-v2/PRD.md`, `app-car-manager-v2/CLAUDE.md`.
