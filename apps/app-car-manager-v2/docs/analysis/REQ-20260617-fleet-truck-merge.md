# REQ-20260617 — Merge Truck vào car-manager-v2 (Manager + Driver surfaces)

> Master plan đã duyệt: `~/.claude/plans/deep-prancing-diffie.md` (2026-06-17).
> Tham chiếu: [PLAN-20260616-fleet-truck-driver](../plan/PLAN-20260616-fleet-truck-driver.md), [REQ-20260617-fleet-access](REQ-20260617-fleet-access.md).
> Prototype nguồn: `prototype/car-truck-manager/index.html`, `prototype/driver-app/index.html`.

## 1. Yêu cầu

| # | Yêu cầu | Loại |
|---|---|---|
| R1 | Số hóa quản lý xe tải nội bộ (trip-log, P&L, import Excel) | Chức năng |
| R2 | Gộp TRUCK vào `app-car-manager-v2` — 1 app, 2 surface (manager desktop+mobile, driver mobile PWA) | Kiến trúc |
| R3 | Manager: dept switch CAR/TRUCK theo prototype; giữ màn CAR đang chạy | Chức năng |
| R4 | Driver: car giữ dispatch; truck = "hoàn thành chuyến" (form 7 trường + extra costs) | Chức năng |
| R5 | Logic dùng chung → `packages/core` (services thuần + queries) | Kiến trúc |
| R6 | Không phá car MVP production; access theo department (fleet-access đã build) | Phi chức năng |

## 2. AS-IS

- **App**: Next.js 15 monorepo (`apps/web` + `packages/{db,shared,ui}`). Driver experience đã là PWA (sw.js `fleet-v5`, manifest, web push) — routes `/today`, `/trips` (nhánh driver), `/expenses`, `/settings/me`.
- **Trip**: chỉ DISPATCH (đón/trả khách), state machine 6 trạng thái ([trip-state-machine.service.ts](../../apps/web/src/server/services/trip-state-machine.service.ts)). Driver Accept/Reject/Start/End.
- **Money**: `decimal(14,2)` string (vd `car_expenses.exp_amount`).
- **Không có** khái niệm truck (trip-log, P&L, import, định mức nhiên liệu).
- **Access**: ent_id + role; fleet-access (CAR/TRUCK membership) **đã build** turn trước (xem REQ-fleet-access).

## 3. TO-BE (đã impl P-A — DB foundation)

**Discriminator + truck-log** trên `car_trips`: `trp_kind` (DISPATCH|LOG) + nullable `trp_customer/bol/cdf/fuel_liters/fuel_price/toll_fee/revenue` (tái dụng pickup/dropoff, started/ended_at, odometer).
**Truck attrs** `car_vehicles`: `cvh_tonnage`, `cvh_fuel_quota` (cvh_type đã có).
**Bảng mới**: `car_trip_extra_costs` (other costs {tên+tiền}), `car_truck_fixed_costs` (salary/depreciation/insurance theo xe/tháng), `car_imports` (lịch sử Excel).
**Migration** `0012_fleet_truck.sql` (nullable+default, backfill DISPATCH).

**Truck lifecycle** (P-B): assign → auto-CONFIRMED (bỏ confirmation) → driver complete → COMPLETED. Branch state machine theo `trp_kind`, giữ nguyên DISPATCH.

**P&L**: net = revenue − (fuel+toll+extra) − (salary+depreciation+insurance). Auto-aggregate variable từ trip-log.

**Import Excel**: 17 cột `CR-Vietnam-Truck-v1` (date, vehicle, start/end time, customer, pickup, delivery, odo start/end, fuel qty, fuel price, toll, other, note, BOL, CDF, revenue).

## 4. Gap & phạm vi (theo §8 master plan)

| Phase | Nội dung | Trạng thái |
|---|---|---|
| P-A | DB truck schema + migration 0012 | ✅ done |
| P-B | packages/core + truck services + state-machine branch | ⭐ next (rủi ro cao nhất) |
| P-C | Manager dept switch + theming + nav + fleet-access UI | pending |
| P-D | Manager truck screens (Dashboard/Trip Log/Fleet/P&L/Import/Settings) | pending |
| P-E | Driver truck flow (3-tab, complete-form, breakdown) | pending |
| P-F | i18n vi/en/ko + hardening + verify | pending |

## 5. Rủi ro chính
- Hồi quy car MVP khi branch trip-state-machine / extract core → nhánh riêng `trp_kind`, migrate cơ học + test hồi quy, ADMIN bypass fleet.
- Migration chạm bảng prod → nullable+default, test Neon branch, backfill idempotent.
- PWA cache cũ → bump SW version mỗi release.

## 6. Ràng buộc
- Money `decimal(14,2)`; i18n bắt buộc (vi/en/ko), backend English-fixed.
- neon-http không có interactive transaction → ghi tuần tự forgiving/idempotent.
- AMA: 1 registration, role-routing nội bộ + fleet-access; JWT frozen.
