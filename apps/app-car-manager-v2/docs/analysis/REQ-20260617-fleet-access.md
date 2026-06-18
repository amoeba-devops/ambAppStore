# REQ-20260617 — Fleet đa phòng ban (CAR/TRUCK): Department × Role Access Control

> Lát cắt access-control của [PLAN-20260616-fleet-truck-driver](../plan/PLAN-20260616-fleet-truck-driver.md).
> Master plan tích hợp: `~/.claude/plans/deep-prancing-diffie.md` (đã duyệt 2026-06-17).

## 1. Yêu cầu

| # | Yêu cầu | Loại |
|---|---|---|
| R1 | Phân quyền theo **2 phòng ban** CAR / TRUCK trong cùng 1 app | Chức năng |
| R2 | User vào **qua AMA (embedded)** hoặc **độc lập** đều nhận đúng quyền phòng ban | Chức năng |
| R3 | ADMIN → cả 2 phòng ban; MANAGER → 1 hoặc 2; DRIVER → đúng 1 | Nghiệp vụ |
| R4 | MANAGER tự **request** phòng ban thứ 2 → ADMIN **approve** | Chức năng |
| R5 | Không phá vỡ car MVP đang chạy production | Phi chức năng |
| R6 | Thiết kế sẵn để **hội tụ** với AMA department model khi AMA build | Phi chức năng |

## 2. AS-IS

- **Auth**: AMA JWT **frozen** ([INTEGRATION.md §7](../../INTEGRATION.md)) — chỉ mang 1 `role` toàn cục (`OWNER|MASTER|MANAGER|MEMBER`) + `ent_id`. **Không có department**.
- **Role mapping**: [`mapAmaRoleToLocal`](../../packages/shared/src/auth/jwt-claims.ts) → ADMIN/MANAGER/DRIVER, cache ở `car_users.usr_local_role`.
- **Scope**: chỉ `ent_id` (multi-tenancy) qua `withEnt` + `eq(entId)`. Không có khái niệm phòng ban/department/team.
- **AMA department model** (`amb_departments`, `amb_user_dept_roles`): [chỉ là Draft, "Not yet built"](../../../../reference/amb-access-control-policy.md §12) → **không dùng được làm data source**.
- **Entry points**: embedded (AMA sidebar) và independent (Render URL) **dùng chung 1 JWT identity** → cùng đi qua middleware → headers → `getCurrentUser`.
- **Vehicle**: không có discriminator loại xe (`grep truck` = rỗng).

## 3. TO-BE

| AS-IS | TO-BE |
|---|---|
| Vehicle không phân loại | `car_vehicles.cvh_type` ENUM(CAR,TRUCK) DEFAULT CAR |
| Không có department membership | Bảng `car_user_fleet_access` (user × department, app-owned) |
| Không có request/approve | Bảng `car_fleet_access_requests` (PENDING→APPROVED/REJECTED) |
| AuthContext chỉ role | `resolveFleetAccess(actor)` → departments accessible; `requireFleet()` guard |
| — | `withFleetScope(typeColumn, depts)` ràng buộc list query theo department |

**Nguyên tắc cốt lõi (chứng minh tính khả thi)**: vì embedded + independent dùng chung JWT identity và cùng `getCurrentUser`, một access model **app-owned** áp dụng đồng nhất cho cả 2 lối vào — **không đụng JWT frozen, không chờ AMA**.

**Role đồng nhất**: role (ADMIN/MANAGER/DRIVER) lấy từ `usr_local_role`, giống nhau trên mọi phòng ban user thuộc về. Membership chỉ quyết định *được vào phòng nào*:
- ADMIN → cả 2 (implicit, không cần row).
- MANAGER → 1–2 rows (row thứ 2 qua request/approve).
- DRIVER → đúng 1 row active (validate ở application layer).

## 4. Gap analysis

| Khu vực | Hiện tại | Thay đổi | Ảnh hưởng |
|---|---|---|---|
| DB schema | 12 bảng car_* | +2 bảng + cột cvh_type + 1 enum | Thấp (nullable/default) |
| Auth | requireRole | +requireFleet/resolveFleetAccess | Thấp (car action không bắt buộc dùng) |
| Server actions | — | +4 action (request/decide/grant/revoke) | Mới, độc lập |
| FE | nav role-based | (defer) switcher + nav fleet-filter | Chờ truck pages tồn tại |

**File đã thay đổi (Phase này):**
- DB: `vehicles.schema.ts` (sửa), `user-fleet-access.schema.ts` + `fleet-access-request.schema.ts` (mới), `schema/index.ts`, `migrations/0011_fleet_access.sql`, `lib/with-fleet-scope.ts`, `db/index.ts`.
- Auth: `apps/web/src/lib/auth/fleet-access.ts` (mới).
- BE: `apps/web/src/server/actions/fleet-access/fleet-access.actions.ts` (mới), `shared/src/zod/fleet-access.zod.ts` (mới) + index.
- FE/i18n: **defer** (xem §6).

**DB migration**: dev `db:push` từ schema; staging/prod chạy tay `0011_fleet_access.sql` (pattern 0009/0010, không vào drizzle journal). Backfill: mọi `car_users` live → 1 membership CAR (idempotent) ⇒ car MVP nguyên trạng.

## 5. User flow

```
MANAGER (chỉ CAR) muốn TRUCK
  └─ requestFleetAccessAction({vehicleType:'TRUCK'}) → far PENDING + notify admins
ADMIN
  └─ decideFleetAccessAction({requestId, decision:'APPROVED'})
       ├─ INSERT car_user_fleet_access(TRUCK) (idempotent)
       └─ far → APPROVED + notify requester
MANAGER (request kế tiếp)
  └─ resolveFleetAccess = ['CAR','TRUCK'] → truck routes/list mở khoá

ADMIN onboarding DRIVER
  └─ grantFleetAccessAction({userId, vehicleType}) — chặn nếu driver đã có 1 phòng khác
```

## 6. Phạm vi & sequencing (quan trọng)

- **Phase này (đã impl)**: DB + auth guard + 4 server actions + zod. Đủ để enforce access ở backend, verify được qua dev-login.
- **Defer — department switcher + nav fleet-filter**: chỉ có ý nghĩa khi **truck pages tồn tại** (master plan Phase 2). Hiện chưa có gì để "switch" sang. Sẽ làm cùng truck admin UI.
- **Defer — admin grant/revoke UI + manager request UI + i18n vi/en/ko**: làm tiếp sau khi chốt vị trí UX (đề xuất: trang `/settings/fleet-access`). Backend actions đã sẵn sàng để FE gọi.

## 7. Ràng buộc kỹ thuật

- neon-http **không có interactive transaction** → decide-action dùng thứ tự forgiving (insert membership idempotent → update request); re-run an toàn.
- `requireFleet` ném `CAR-E0403`; conflict (đã có/đang pending/driver-limit) ném `CAR-E0409`.
- Notifications: in-app stub (event `FLEET.ACCESS_*` + title/body fallback English); template i18n bổ sung sau.
