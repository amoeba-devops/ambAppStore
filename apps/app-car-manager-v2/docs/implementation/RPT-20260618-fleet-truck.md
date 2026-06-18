# RPT-20260618 — Fleet (CAR + TRUCK) merge — Implementation Report

> Hoàn thành build (code) cho việc gộp TRUCK vào `app-car-manager-v2` thành Fleet đa loại xe, 1 app / 2 surface (Manager desktop+mobile, Driver mobile PWA).
> Plan: `~/.claude/plans/deep-prancing-diffie.md`. REQ: [fleet-access](../analysis/REQ-20260617-fleet-access.md), [fleet-truck-merge](../analysis/REQ-20260617-fleet-truck-merge.md). Test: [TR-20260618](../test/TR-20260618-fleet-truck.md).

## 1. Tổng quan kiến trúc (đã chốt & build)
- **1 app, 2 surface theo role**: Manager (ADMIN/MANAGER) + Driver (DRIVER), route-gated. Không tách deployable, không thêm AMA registration/nginx.
- **2 department CAR/TRUCK** = `cvh_type` / `trp_kind` discriminator + access-control app-owned (JWT AMA giữ frozen).
- **`packages/core`** mới — domain thuần (trip cost/lifecycle/P&L) dùng chung, không import `next/*`. Car state machine **không đụng**.
- Theme: car xanh `#0369A1` / truck cam `#C2410C` qua `:root[data-dept='truck']`.

## 2. Phases hoàn thành
| Phase | Nội dung |
|---|---|
| Access (pre) | `car_user_fleet_access` + `car_fleet_access_requests`; `resolveFleetAccess`/`requireFleet`/`withFleetScope`; 4 actions (request/decide/grant/revoke); migration 0011 |
| P-A | DB truck: `trp_kind` + truck-log cols, `cvh_type/tonnage/fuel_quota`, 3 bảng (extra-cost/fixed-cost/import); migration 0012 |
| P-B | `packages/core` + `truck-cost` / `truck-trip.service` (LOG lifecycle) / `truck-pnl.service` |
| P-C | nav fleet infra; Admin fleet-access UI (`/settings/fleet-access`) |
| P-D | dept switch + theming; Truck workspace: Dashboard · Trip Log · Fleet · P&L · Settings · Import Excel |
| P-E | Driver truck flow: theme + 3-tab nav + Complete-Trip form + breakdown + `/today` truck + ownership action |
| P-F | i18n parity (1428 keys vi/en/ko), SW `fleet-v6`, lint+typecheck clean, TR/RPT |

## 3. File chính (đại diện)
- **DB**: `packages/db/src/schema/{vehicles,trips}.schema.ts` (sửa); `{user-fleet-access,fleet-access-request,trip-extra-cost,truck-fixed-cost,import}.schema.ts` (mới); `migrations/0011_fleet_access.sql`, `0012_fleet_truck.sql`.
- **Core**: `packages/core/src/truck/{truck-cost,truck-trip.service,truck-pnl.service}.ts`.
- **Auth**: `apps/web/src/lib/auth/fleet-access.ts`; `packages/db/src/lib/with-fleet-scope.ts`.
- **Actions**: `server/actions/fleet-access/*`, `trips/truck-trip.actions.ts`, `imports/import.actions.ts`, `settings/truck-fixed-cost.actions.ts`.
- **Queries**: `fleet-access.queries.ts`, `truck-trips.queries.ts`, `truck-fixed-cost.queries.ts`.
- **Manager FE**: `app/(app)/truck/**` (dashboard/trips/fleet/pnl/settings/import + template route), `settings/fleet-access/**`, `components/layout/{dept-switch,dept-theme-effect,nav-items}.tsx`, `packages/ui/tokens.css`.
- **Driver FE**: `trips/[id]/_components/{truck-trip-detail,truck-complete-section}.tsx`, `today/_components/truck-driver-today.tsx`, trip-detail + today LOG branches.
- **i18n**: `apps/web/messages/{vi,en,ko}.json`.
- **Zod**: `packages/shared/src/zod/{fleet-access,truck-trip,truck-fixed-cost,truck-import}.zod.ts`.

## 4. Trạng thái kiểm thử
- Static: typecheck 4 package = 0; `next lint` = no warnings/errors; i18n parity OK; JSON OK.
- Runtime: **chưa chạy** (cần `db:push` lên Neon của người dùng + deploy staging) — checklist ở TR-20260618 §2.

## 5. Bước triển khai (đề xuất)
1. **Review diff tại chỗ** (chưa commit/push).
2. **DB**: dev `npm run db:push`; staging/prod áp tay `0011_fleet_access.sql` + `0012_fleet_truck.sql` + backfill (membership CAR, trp_kind DISPATCH).
3. Chạy runtime checklist (TR §2), nhất là **regression car (RG-*)**.
4. Deploy **staging trước** (`deploy-staging.sh`), test, rồi `main→production` PR. VITE/SW: bump đã làm (fleet-v6).

## 6. Ghi chú / hạn chế đã biết
- neon-http không có interactive transaction → completion/import ghi tuần tự idempotent (best-effort, có ghi `car_imports` FAILED + count nếu lỗi giữa chừng).
- Import: 1 file = 1 xe + 1 tài xế (chọn ở UI) → mỗi dòng thành chuyến LOG COMPLETED.
- Driver giới hạn đúng 1 department (validate app-level).
- AMA convergence: `ufa_dep_id` nullable chờ AMA build `amb_departments` (chưa cần).
- Chưa làm (ngoài scope hiện tại): truck trip edit/delete UI, truck driver "Chuyến của tôi" list polish (đang dùng list chung), per-trip detail cho manager truck (đang xem qua nhật ký).
