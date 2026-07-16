# TR-20260618 — Fleet (CAR + TRUCK) merge — Test Report

> Kết quả kiểm thử cho [REQ-20260617-fleet-truck-merge](../analysis/REQ-20260617-fleet-truck-merge.md) + [REQ-20260617-fleet-access](../analysis/REQ-20260617-fleet-access.md).
> Phạm vi: access-control + manager truck workspace + driver truck flow (1 app, 2 surface).

## 1. Static verification (đã chạy, PASS)

| # | Kiểm tra | Lệnh | Kết quả |
|---|---|---|---|
| S1 | Typecheck DB package | `tsc --noEmit` (packages/db) | ✅ exit 0 |
| S2 | Typecheck shared | `tsc --noEmit` (packages/shared) | ✅ exit 0 |
| S3 | Typecheck core | `tsc --noEmit` (packages/core) | ✅ exit 0 |
| S4 | Typecheck web | `tsc --noEmit` (apps/web) | ✅ exit 0 |
| S5 | ESLint toàn app | `next lint --dir src` | ✅ No warnings or errors |
| S6 | i18n key parity vi/en/ko | flatten + so khớp | ✅ 1428 keys, ALL MATCH |
| S7 | JSON hợp lệ (vi/en/ko) | `JSON.parse` | ✅ OK |

## 2. Runtime test checklist (chạy trên staging — cần `db:push`)

> Bước chuẩn bị: `cd apps/app-car-manager-v2 && npm run db:push` (sync schema lên Neon dev) — hoặc áp `migrations/0011_fleet_access.sql` + `0012_fleet_truck.sql` trên staging/prod. Backfill: mọi `car_users` → membership CAR; `car_trips.trp_kind='DISPATCH'`. dev-login: `/app-car-manager-v2/dev-login?role=OWNER|MANAGER|MEMBER`.

### 2.1 Access control (fleet)
| # | Mô tả | Kỳ vọng |
|---|---|---|
| R-A1 | ADMIN mở `/settings/fleet-access` | Thấy queue request + bảng thành viên; ADMIN = "Toàn quyền" |
| R-A2 | ADMIN grant TRUCK cho 1 manager | Toast OK; manager có TRUCK |
| R-A3 | MANAGER chỉ CAR mở `/truck/*` | Redirect `/dashboard` (gate `hasFleet`) |
| R-A4 | MANAGER bấm "Yêu cầu quyền xe tải" (sidebar) | Tạo request PENDING; admin thấy ở queue |
| R-A5 | ADMIN approve request | Membership TRUCK thêm; manager vào được truck |
| R-A6 | DRIVER bị giới hạn 1 phòng | grant phòng thứ 2 cho driver → `CAR-E0409` |

### 2.2 Manager truck workspace
| # | Mô tả | Kỳ vọng |
|---|---|---|
| R-M1 | Dept switch (ADMIN) CAR↔TRUCK | Đổi workspace + theme cam; nav đổi |
| R-M2 | Thêm xe tải `/truck/fleet/new` | Lưu OK, xuất hiện trong đội xe (cvh_type=TRUCK) |
| R-M3 | Tạo chuyến `/truck/trips/new` | Preview lợi nhuận live; lưu → list có lợi nhuận tính đúng |
| R-M4 | Settings `/truck/settings` nhập fixed cost theo tháng | Lưu OK (upsert) |
| R-M5 | P&L `/truck/pnl` | Net = doanh thu − biến đổi (auto) − cố định; lọc theo xe |
| R-M6 | Dashboard `/truck/dashboard` | KPI tháng + chuyến gần đây |
| R-M7 | Import `/truck/import` | Tải template 17 cột; upload→preview→import→chuyến vào nhật ký + car_imports |

### 2.3 Driver truck flow
| # | Mô tả | Kỳ vọng |
|---|---|---|
| R-D1 | Driver TRUCK login | Theme cam; nav 3 tab (không có Ghi chi phí) |
| R-D2 | `/today` driver TRUCK | List "Cần hoàn thành"/"Đã hoàn thành" |
| R-D3 | Mở chi tiết chuyến chưa hoàn thành → Form Hoàn thành | 7 trường + chi phí khác {tên+tiền} có "+"; submit → COMPLETED |
| R-D4 | Chi tiết chuyến đã hoàn thành | Breakdown chi phí + tổng + lợi nhuận read-only |
| R-D5 | Ownership | Driver A không hoàn thành được chuyến của driver B (`CAR-E0403`) |

### 2.4 Regression (car MVP — phải nguyên vẹn)
| # | Mô tả | Kỳ vọng |
|---|---|---|
| RG-1 | Car driver login | Theme xanh; nav 4 tab; dispatch hero (Accept/Reject/Start/End) |
| RG-2 | Car trip lifecycle | State machine không đổi (PENDING→...→COMPLETED) |
| RG-3 | Car vehicle CRUD | Default cvh_type='CAR'; flow nguyên vẹn |
| RG-4 | PWA cache | SW `fleet-v6` → client cũ nhận bản mới |

## 2bis. Runtime smoke (đã chạy 2026-06-18, PASS)

- **Migration áp lên Neon `neondb`** (SQL thủ công 0011+0012, KHÔNG db:push): 31/31 statement OK; 5 bảng mới + 6 cột mới; backfill = 13 membership CAR + 11 trip DISPATCH. ✅
- **Production build** `next build`: exit 0, mọi route truck build dynamic. ✅
- **Render smoke** (dev server + dev-login OWNER→ADMIN, GET 14 trang): tất cả **200**, không 500 — gồm `/truck/{dashboard,fleet,fleet/new,trips,trips/new,pnl,settings,import}`, `/truck/import/template` (content-type xlsx đúng), `/settings/fleet-access`, + regression `/dashboard,/vehicles,/trips,/users`. ✅
  - Xác nhận runtime: `computeTruckPnl`, `listTruckTrips`+`computeTruckCost`, `listFleetMembers`, `getTruckFixedCostsByMonth`, template xlsx — chạy thật trên DB đã migrate, không lỗi.

## 3. Kết luận
- Static (S1–S7): **PASS**.
- Runtime render + migration (2bis): **PASS** (local dev server, DB neondb đã migrate).
- **Còn lại cần test thủ công trên UI** (write flows + driver truck): R-A2/A4/A5 (grant/request/approve), R-M2/M3/M4/M7 (tạo xe/chuyến/fixed-cost/import), R-D1..D5 (driver truck — cần seed driver có TRUCK membership + chuyến gán) — chạy khi deploy code lên staging.
- Car MVP: additive (cột nullable+default, branch `trp_kind`/`isTruckDriver`, ADMIN bypass); render regression (/dashboard,/vehicles,/trips,/users) PASS; cần xác nhận lifecycle car (RG-2) trên staging.
