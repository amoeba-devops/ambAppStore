# REQ-20260813 — Truck: Phân quyền User theo Khu vực (Region Access Control)

```yaml
document_id: V2-REQ-20260813-REGION-ACCESS
version: 1.1.0
status: Draft (decisions resolved — ready for PLAN)
created: 2026-08-13
updated: 2026-08-13
author: Claude (dev@amoeba.group)
scope: apps/app-car-manager-v2 (TRUCK department)
precedent: docs/analysis/REQ-20260617-fleet-access.md (car_user_fleet_access — department ACL)
related: packages/db/migrations/0018_truck_region.sql (region field origin)
```

> **Model đã chốt (xem §7 Decision Log)**: đây là ACL kiểu **"allow-list ghi đè"**, KHÔNG phải kiểu "cần cấp quyền mới thấy" như `car_user_fleet_access`.
> - 0 row gán cho user → mặc định thấy **TẤT CẢ** khu vực (giữ nguyên hành vi AS-IS, không breaking khi rollout).
> - ADMIN gán 1+ khu vực cụ thể cho user → user đó bị **thu hẹp** chỉ còn đúng các khu vực được gán.
> - Áp dụng cho cả MANAGER và DRIVER (ADMIN luôn full, không cần gán).

> Nguồn yêu cầu: dòng requirement khách hàng — "Phân quyền user theo khu vực … Chưa phân quyền user theo khu vực … Phân quyền user theo khu vực, chỉ có Admin mới có quyền quản lý TẤT CẢ các khu vực".

---

## 1. Tóm tắt Yêu cầu (요구사항 요약)

| # | Yêu cầu | Loại |
|---|---|---|
| R1 | Bổ sung ACL theo **khu vực** (HCM / DONG_NAI / BAIKSAN) cho user trong app TRUCK — hiện khu vực chỉ là **filter dropdown**, không giới hạn quyền xem/thao tác | Chức năng |
| R2 | **ADMIN** mặc định quản lý **TẤT CẢ** khu vực (không cần gán) | Nghiệp vụ |
| R3 | **MANAGER và DRIVER**: mặc định thấy toàn bộ khu vực (giống hiện tại); khi ADMIN gán cụ thể → chỉ còn thấy đúng (các) khu vực được gán. ADMIN có thể gán **nhiều khu vực** cho 1 user | Chức năng |
| R4 | Không phá vỡ luồng CAR hiện tại (region chỉ tồn tại ở TRUCK — `cvh_region` luôn NULL cho xe CAR) | Phi chức năng |
| R5 | ACL áp dụng nhất quán trên **cả 6 màn** TRUCK đang lọc theo khu vực: Fleet, Trips, Dashboard, Reports, Finance/PNL, Month-close — cùng 1 đợt, không chia phase | Chức năng |

---

## 2. AS-IS Hiện trạng Phân tích

### 2.1 Khu vực hiện là dữ liệu, KHÔNG phải quyền hạn

- Danh sách khu vực cố định: `TRUCK_REGIONS = ['HCM', 'DONG_NAI', 'BAIKSAN']` — [`packages/shared/src/zod/vehicle.zod.ts:10`](../../packages/shared/src/zod/vehicle.zod.ts#L10).
- Cột lưu khu vực (varchar, nullable — KHÔNG phải ACL):
  - `car_vehicles.cvh_region` — [`vehicles.schema.ts:74`](../../packages/db/src/schema/vehicles.schema.ts#L74), index `idx_car_vehicles_ent_type_region` (dòng 109).
  - `car_truck_reports.trr_region` — `truck-report.schema.ts`.
  - `car_truck_fuel_invoice.tfi_region` — `truck-fuel-invoice.schema.ts`.
  - `car_truck_month_close.tmc_region` — `truck-month-close.schema.ts`.
  - Trip **không** có cột region riêng — kế thừa qua xe được gán (`trp_vehicle_id` → `cvh_region`).
- Khu vực chỉ dùng làm **filter query-param** phía client, KHÔNG có kiểm tra quyền:
  - Fleet list: `apps/(app)/truck/fleet/page.tsx:66,72` — đọc `?region=` rồi filter mảng, ai cũng filter được cả 3 khu vực.
  - Dashboard: `truck/dashboard/page.tsx:126-208` — tương tự, cộng breakdown "tất cả khu vực" luôn tính đủ 3 mã bất kể user là ai.
  - Report/finance queries (`truck-report.queries.ts`) dùng `region` chỉ để filter WHERE, không có `requireRegion`/ACL nào bọc quanh.
- **Kết luận AS-IS**: bất kỳ user nào có quyền vào TRUCK (`car_user_fleet_access.ufaVehicleType = 'TRUCK'`, xem §2.2) đều thấy và filter được **cả 3 khu vực** — không phân biệt MANAGER phụ trách 1 khu vực hay ADMIN.

### 2.2 Precedent đã có: ACL theo phòng ban (KHÔNG phải theo khu vực) — mẫu để tái dùng

Từ [REQ-20260617-fleet-access.md](REQ-20260617-fleet-access.md), app đã có sẵn 1 tầng ACL tương tự nhưng ở cấp **department** (CAR/TRUCK), có thể nhân bản logic cho **region**:

| Thành phần | File | Vai trò |
|---|---|---|
| Bảng membership | [`user-fleet-access.schema.ts`](../../packages/db/src/schema/user-fleet-access.schema.ts) | `car_user_fleet_access(ent_id, usr_id, ufa_vehicle_type, ufa_granted_by, ufa_granted_at, ufa_deleted_at)` — 1 row live / (user, department), unique index có điều kiện `WHERE ufa_deleted_at IS NULL` |
| Guard/resolver | [`lib/auth/fleet-access.ts`](../../apps/web/src/lib/auth/fleet-access.ts) | `resolveFleetAccess(actor)` (ADMIN → tất cả, khác → query rows), `hasFleet()`, `requireFleet()` ném `CAR-E0403` |
| Server actions | `server/actions/fleet-access/fleet-access.actions.ts` | request/decide/grant/revoke |
| UI quản lý (ADMIN-only) | `app/(app)/settings/fleet-access/page.tsx` | Danh sách member + grant/revoke + queue duyệt request |

Role hiện tại (`car_users.usr_local_role`: `ADMIN`/`MANAGER`/`DRIVER`) **không đổi** — khu vực chỉ là một chiều scoping mới, độc lập, đặt cạnh (không thay thế) fleet-department scoping.

### 2.3 Vấn đề cụ thể cần giải quyết

1. Không có bảng lưu "user X được xem khu vực nào".
2. Không có hàm `requireRegion`/`resolveRegionAccess` guard nào ở server actions/queries của Fleet, Trips, Dashboard, Reports, Finance, Month-close.
3. UI dropdown chọn khu vực (`RegionFilter`/`report-region-step.tsx`...) hiện luôn render đủ 3 option cho mọi user.
4. Không có màn hình cho ADMIN gán khu vực cho MANAGER.

---

## 3. TO-BE Yêu cầu

### 3.1 Mapping AS-IS → TO-BE

| AS-IS | TO-BE |
|---|---|
| Khu vực = filter tự do, không ACL | Khu vực = ACL — MANAGER chỉ thấy/thao tác khu vực được gán; ADMIN luôn thấy cả 3 |
| Không có bảng membership khu vực | Bảng mới `car_user_region_access` (mirror `car_user_fleet_access`, `ufa_vehicle_type` → `ura_region`) |
| Không có guard | `resolveRegionAccess(actor)`, `hasRegion()`, `requireRegion()` trong `lib/auth/region-access.ts` (mirror `fleet-access.ts`) |
| Query khu vực không lọc theo quyền | Mọi query/list/dashboard/report TRUCK filter theo `resolveRegionAccess()` khi role ≠ ADMIN — không chỉ theo `?region=` param người dùng gõ |
| Không có UI gán khu vực | Trang mới `settings/region-access` (ADMIN-only) — chọn MANAGER, tick 1..3 khu vực, lưu |

### 3.2 Entity/Bảng mới

`car_user_region_access` (theo đúng DB naming convention của app — xem `apps/app-car-manager-v2/CLAUDE.md §4.3`):

| Cột | Kiểu | Ghi chú |
|---|---|---|
| `ura_id` | CHAR(36) PK | UUID |
| `ent_id` | CHAR(36) NOT NULL | multi-tenancy |
| `usr_id` | CHAR(36) NOT NULL FK → `car_users.usr_id` | |
| `ura_region` | VARCHAR(40) NOT NULL | 1 trong `TRUCK_REGIONS` |
| `ura_granted_by` | CHAR(36) | ADMIN thực hiện gán |
| `ura_granted_at` | TIMESTAMPTZ DEFAULT NOW() | |
| `ura_deleted_at` | TIMESTAMPTZ NULL | soft delete = revoke |

- Unique index có điều kiện `(ent_id, usr_id, ura_region) WHERE ura_deleted_at IS NULL` — 1 row live / (user, khu vực), cho phép re-grant sau revoke (giống `uniq_car_user_fleet_access_ent_usr_type`).
- Index `(ent_id, usr_id)` phục vụ resolver.

### 3.3 Business logic (model "allow-list ghi đè" — đã chốt)

- **ADMIN**: implicit toàn bộ `TRUCK_REGIONS`, không cần row nào (giống `resolveFleetAccess` khi `role === 'ADMIN'`).
- **MANAGER / DRIVER**:
  - **0 row** trong `car_user_region_access` → mặc định thấy **TẤT CẢ** khu vực (= hành vi AS-IS, không breaking khi rollout, không cần backfill).
  - **≥1 row** → bị **thu hẹp**, chỉ còn thấy đúng các khu vực có row live. ADMIN có thể gán nhiều khu vực cùng lúc (checkbox, không phải chọn 1).
  - Áp dụng đồng nhất cho cả MANAGER và DRIVER — không phân biệt role khi resolve (chỉ ADMIN là ngoại lệ implicit-all).
- Áp dụng ACL tại **cả 6 màn** cùng lúc: Fleet list, Trips list, Dashboard (bao gồm breakdown "tất cả khu vực"), Reports (tạo/xem báo cáo theo khu vực), Finance/PNL, Month-close.
- Dropdown chọn khu vực ở mọi màn trên chỉ render các khu vực nằm trong `resolveRegionAccess(actor)` (thay vì cứng `TRUCK_REGIONS` toàn bộ).
- Server action/query nào nhận `region` qua query-param phải validate: nếu `region` không nằm trong tập được phép (khi user đã bị thu hẹp) → 403 `CAR-E0403` (không phải chỉ ignore param).
- Trip kế thừa khu vực từ xe được gán — nếu MANAGER/DRIVER bị thu hẹp còn khu vực X, chỉ thấy trip của xe thuộc khu vực X.

### 3.4 UI mới

Trang `settings/region-access/page.tsx` (mirror cấu trúc `settings/fleet-access/page.tsx`):
- ADMIN-only (redirect như `FleetAccessPage` dòng 33-35).
- Danh sách user có `usr_local_role ∈ {MANAGER, DRIVER}` (và có TRUCK fleet access) + checkbox multi-select 3 khu vực + nút Save (grant/revoke tương ứng thêm/bớt row).
- Hiển thị rõ trạng thái "Tất cả khu vực (mặc định)" khi user chưa có row nào, để ADMIN phân biệt với "đã bị thu hẹp còn N khu vực".
- Không cần luồng request/approve như fleet-access (R2 nói rõ "chỉ Admin mới có quyền quản lý" — MANAGER/DRIVER không tự xin khu vực) → đơn giản hơn: chỉ có `grantRegionAccessAction`/`revokeRegionAccessAction`, không có bảng `*_requests`.

---

## 4. Gap Analysis (갭 분석)

### 4.1 Bảng phạm vi thay đổi

| Khu vực | Hiện tại | Thay đổi | Ảnh hưởng |
|---|---|---|---|
| DB schema | Không có bảng khu vực-ACL | +1 bảng `car_user_region_access` + unique/idx | Thấp — bảng mới, không đụng bảng cũ |
| Auth | `resolveFleetAccess`/`requireFleet` (department) | +`resolveRegionAccess`/`requireRegion` (region), độc lập file mới `lib/auth/region-access.ts` | Thấp |
| Server actions | — | +2 action (`grantRegionAccessAction`, `revokeRegionAccessAction`) | Mới |
| Server queries (Fleet/Trips/Dashboard/Reports/Finance/Month-close) | Query nhận `region` param tự do | Bọc thêm check `requireRegion`/filter theo `resolveRegionAccess` | **Trung bình** — sửa nhiều điểm đọc dữ liệu TRUCK, rủi ro bỏ sót 1 màn |
| FE dropdown chọn khu vực | Luôn render `TRUCK_REGIONS` cứng | Render theo quyền user | Trung bình — nhiều component dùng chung `TRUCK_REGIONS` cần đổi sang lấy từ actor |
| UI mới | — | `settings/region-access` page + component | Mới, độc lập |
| i18n | — | namespace `screens.regionAccess.*` (vi/en/ko) | Thấp |

### 4.2 File dự kiến thay đổi/tạo (khảo sát sơ bộ — chốt chi tiết ở PLAN)

**DB (mới):**
- `packages/db/src/schema/user-region-access.schema.ts` (mới, mirror `user-fleet-access.schema.ts`)
- `packages/db/src/schema/index.ts` (export thêm)
- `packages/db/migrations/00XX_truck_region_access.sql` (chạy tay staging/prod, theo pattern 0018/0019 — KHÔNG vào drizzle journal, xem [reference_carv2_migration_journal])

**Auth (mới):**
- `apps/web/src/lib/auth/region-access.ts` (mới, mirror `fleet-access.ts`)

**Server actions (mới):**
- `apps/web/src/server/actions/region-access/region-access.actions.ts`
- `packages/shared/src/zod/region-access.zod.ts`

**Server queries (sửa — bọc ACL):**
- `apps/web/src/server/queries/truck-report.queries.ts`
- `apps/web/src/server/queries/truck-finance.queries.ts`
- `apps/web/src/server/queries/truck-trips.queries.ts`
- Truy vấn fleet/dashboard trong các `page.tsx` liên quan (`truck/fleet`, `truck/dashboard`, `truck/reports`, `truck/finance`, `truck/pnl`)

**FE (sửa):**
- `apps/web/src/app/(app)/truck/fleet/page.tsx`
- `apps/web/src/app/(app)/truck/dashboard/page.tsx`
- `apps/web/src/app/(app)/truck/reports/_components/report-region-step.tsx`
- Component filter khu vực dùng chung (nếu có) — cần audit thêm mọi nơi `import { TRUCK_REGIONS }`

**FE (mới):**
- `apps/web/src/app/(app)/settings/region-access/page.tsx`
- `apps/web/src/app/(app)/settings/region-access/_components/region-member-controls.tsx`

**i18n:** `messages/{vi,en,ko}.json` — thêm `screens.regionAccess.*`, `nav.regionAccess`.

### 4.3 DB Migration Strategy

- Dev: `drizzle-kit push` từ schema mới.
- Staging/Production: chạy tay `00XX_truck_region_access.sql` (theo pattern 0018/0019 hiện có — `apply-truck-0011-0022-idempotent.sql` là ví dụ script idempotent áp dụng nhiều migration liền, có thể gộp vào cùng script).
- Backfill: KHÔNG cần backfill bắt buộc — bảng rỗng ban đầu nghĩa là mọi MANAGER hiện tại bị **thu hẹp quyền về 0 khu vực** cho tới khi ADMIN gán lại (xem rủi ro §7.1 — cần thông báo trước khi deploy).

---

## 5. User Flow (사용자 플로우)

### 5.1 ADMIN gán khu vực cho MANAGER

```
ADMIN vào /settings/region-access
  └─ thấy danh sách MANAGER (có TRUCK fleet access)
  └─ tick "HCM" + "DONG_NAI" cho Manager Lan → Save
       └─ grantRegionAccessAction({userId, regions:['HCM','DONG_NAI']})
            ├─ INSERT car_user_region_access (idempotent theo unique index) cho từng region mới
            └─ revoke (soft-delete) region bị bỏ tick
  └─ Manager Lan lần vào tiếp theo: resolveRegionAccess = ['HCM','DONG_NAI']
       → dropdown Fleet/Dashboard/Reports chỉ còn 2 khu vực
       → BAIKSAN: 403 nếu cố truyền `?region=BAIKSAN` trực tiếp qua URL
```

### 5.2 MANAGER chưa được gán khu vực nào (edge case)

```
Manager Bình (0 row region-access) vào /truck/dashboard
  └─ resolveRegionAccess = [] (rỗng)
  └─ Dashboard hiện banner "Chưa được gán khu vực — liên hệ Admin"
  └─ Danh sách xe/trip/báo cáo: rỗng (không lộ dữ liệu khu vực khác)
```

### 5.3 ADMIN thao tác (không đổi)

```
ADMIN vào bất kỳ màn TRUCK nào
  └─ resolveRegionAccess = ['HCM','DONG_NAI','BAIKSAN'] (implicit, không cần row)
  └─ Toàn bộ dropdown, breakdown, export đều đủ 3 khu vực — hành vi giống AS-IS
```

---

## 6. Ràng buộc Kỹ thuật (기술 제약사항)

1. **Không phá CAR flow**: `car_vehicles` loại CAR không set `cvh_region` → ACL khu vực chỉ có ý nghĩa khi user đang thao tác trong ngữ cảnh TRUCK (đã có `hasFleet(actor,'TRUCK')` từ REQ-20260617). Region-access không thay thế, chỉ **thêm lớp lọc phụ** bên trong TRUCK.
2. **neon-http không có interactive transaction** (đã ghi nhận ở REQ-20260617 §7) — action grant/revoke nhiều khu vực trong 1 lần cần thứ tự forgiving (insert idempotent trước, sau đó revoke) để re-run an toàn nếu fail giữa chừng.
3. **Performance**: `resolveRegionAccess` nên cache theo request bằng React `cache()` giống `resolveFleetAccessCached` (`fleet-access.ts:25`) — tránh N query lặp lại trong 1 request có nhiều component đọc quyền.
4. **Backward compatibility / rollout**: nhờ model "0 row = tất cả khu vực" (§3.3, đã chốt D1), bảng mới rỗng ban đầu **không** làm mất quyền của ai — không cần backfill/seed. Rủi ro rollout coi như không còn.
5. **Error code**: tái dùng `CAR-E0403` (Forbidden) cho vi phạm region-access, nhất quán với `requireFleet` (`fleet-access.ts:58`).
6. **i18n**: label khu vực đã có sẵn namespace `region.*` (dùng ở `truck/fleet/page.tsx:56`) — tái dùng, không tạo namespace label khu vực mới, chỉ thêm `screens.regionAccess.*` cho UI quản lý.

---

## 7. Quyết định đã chốt (Decision Log)

| # | Quyết định | Ghi chú |
|---|---|---|
| D1 | **Default khi chưa gán khu vực = TẤT CẢ** (giống AS-IS) | Không cần backfill/seed; loại bỏ rủi ro rollout. ADMIN gán cụ thể mới **thu hẹp** quyền. |
| D2 | **Áp dụng cho cả MANAGER và DRIVER** | Mặc định cả hai đều thấy toàn bộ khu vực; ADMIN có thể tinh chỉnh thu hẹp riêng từng user sau. Không phân biệt cơ chế theo role (trừ ADMIN luôn implicit-all). |
| D3 | **Áp dụng cả 6 màn cùng 1 đợt** | Fleet, Trips, Dashboard, Reports, Finance/PNL, Month-close — không chia phase. |
| D4 | **Một user có thể được gán nhiều khu vực cùng lúc** | UI dùng checkbox multi-select (3 khu vực), không phải radio 1 chọn. |

→ Không còn câu hỏi mở. Sẵn sàng chuyển sang **Work Plan** (`docs/plan/PLN-20260813-region-access-control.md`).
