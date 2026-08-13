# PLN-20260813 — Truck: Phân quyền User theo Khu vực (Region Access Control)

> Kèm [REQ-20260813-region-access-control.md](../analysis/REQ-20260813-region-access-control.md). Model: **allow-list ghi đè** — 0 row gán = thấy tất cả khu vực (giữ nguyên AS-IS); ADMIN gán 1+ khu vực → user bị thu hẹp còn đúng khu vực đó. Áp dụng MANAGER + DRIVER, cả 6 màn TRUCK, cùng 1 đợt.

## 1. Hiện trạng phát triển

- Stack: Next 15 App Router + Drizzle/Neon, standalone Turborepo (`apps/app-car-manager-v2`).
- Precedent trực tiếp: `car_user_fleet_access` (REQ-20260617) — bảng membership + guard `requireFleet`/`resolveFleetAccess` (`lib/auth/fleet-access.ts`) theo model **"cần cấp quyền mới thấy"**. Region-access **đảo ngược** model này (mặc định mở, gán mới thu hẹp) nên KHÔNG tái dùng file, chỉ tái dùng *shape* (bảng + resolver + cache + guard).
- Khu vực (`TRUCK_REGIONS = ['HCM','DONG_NAI','BAIKSAN']`, `vehicle.zod.ts:10`) lưu dưới dạng `varchar(40)` (KHÔNG phải Postgres enum) ở 3 bảng: `car_vehicles.cvh_region`, `car_truck_reports.trr_region`, `car_truck_fuel_invoice.tfi_region`, `car_truck_month_close.tmc_region` — bảng ACL mới dùng cùng kiểu `varchar(40)` để nhất quán, không tạo enum mới.
- 6 màn cần bọc ACL (đọc `region` qua query-param, không kiểm tra quyền hiện tại):
  1. Fleet — `app/(app)/truck/fleet/page.tsx`
  2. Trips — `server/queries/truck-trips.queries.ts` + trang list
  3. Dashboard — `app/(app)/truck/dashboard/page.tsx`
  4. Reports — `server/queries/truck-report.queries.ts`, `truck/reports/**`, `report-region-step.tsx`
  5. Finance/PNL — `server/queries/truck-finance.queries.ts`, `truck/finance`, `truck/pnl`
  6. Month-close — `truck-month-close.schema.ts` liên quan queries/actions
- Migration journal car-v2 lệch (drizzle journal chỉ tới 0007, 0008+ áp tay) — theo đúng pattern hiện có, không đổi.
- Migration kế tiếp: `0026_truck_region_access.sql` (file mới nhất hiện tại là `0025_truck_cost_rate_history.sql`).

## 2. Kế hoạch theo Phase

### Phase A — DB + Auth (nền tảng)

- **A1** Schema mới `packages/db/src/schema/user-region-access.schema.ts`: bảng `car_user_region_access` (`ura_id` PK, `ent_id`, `usr_id` FK `car_users`, `ura_region varchar(40)`, `ura_granted_by`, `ura_granted_at`, `ura_deleted_at`). Unique index có điều kiện `(ent_id, usr_id, ura_region) WHERE ura_deleted_at IS NULL`; index `(ent_id, usr_id)`.
  - └─ Side-impact: bảng mới độc lập, không đụng bảng cũ.
- **A2** `packages/db/src/schema/index.ts` — export thêm.
- **A3** Migration SQL thủ công `0026_truck_region_access.sql` (mirror cấu trúc `0011_fleet_access.sql`, idempotent `IF NOT EXISTS`/`DO $$ EXCEPTION`). Áp local (`ep-steep-tooth`) → staging (`ep-noisy-heart`) sau khi duyệt. **Không đụng** `ep-gentle-rain`.
  - └─ Side-impact: nếu quên áp staging trước deploy → query cột thiếu → 500. Checklist bắt buộc.
- **A4** Zod `packages/shared/src/zod/region-access.zod.ts` — input grant/revoke `{ userId, regions: TruckRegion[] }`.
- **A5** Guard mới `apps/web/src/lib/auth/region-access.ts`:
  ```ts
  resolveRegionAccess(actor): Promise<TruckRegion[] | 'ALL'>
    // ADMIN → 'ALL'
    // khác → query rows; rows.length === 0 → 'ALL' (default mở, D1)
    //         rows.length > 0  → rows.map(r => r.uraRegion) (thu hẹp)
  hasRegion(actor, region): Promise<boolean>   // 'ALL' → true; else → includes
  requireRegion(actor, region): Promise<void>  // throw CAR-E0403 nếu !hasRegion
  allowedRegions(actor): Promise<readonly TruckRegion[]>
    // 'ALL' → toàn bộ TRUCK_REGIONS (dùng để render dropdown)
  ```
  Cache theo request bằng React `cache()` (mirror `resolveFleetAccessCached`).
  - └─ Side-impact: file mới, không sửa `fleet-access.ts` — 2 tầng ACL (department, region) độc lập, dùng cùng lúc (`requireFleet('TRUCK')` rồi `requireRegion(region)`).

### Phase B — Server actions quản lý (ADMIN)

- **B1** `apps/web/src/server/actions/region-access/region-access.actions.ts`:
  - `grantRegionAccessAction({ userId, regions })` — `requireRole(['ADMIN'])`, upsert idempotent từng region trong `regions`, soft-delete region bị bỏ khỏi danh sách (đồng bộ set — giống Save 1 lần cho toàn bộ 3 checkbox của user đó).
  - `revokeAllRegionAccessAction({ userId })` — soft-delete hết row → quay lại mặc định "Tất cả khu vực".
  - neon-http không có transaction — thứ tự forgiving: insert trước, revoke sau (như D-nguyên tắc ở REQ-20260617 §7).
- **B2** Query đọc cho trang quản lý: `apps/web/src/server/queries/region-access.queries.ts` — `listRegionAccessMembers(entId)` trả user (MANAGER/DRIVER + TRUCK fleet access) kèm regions hiện tại (rỗng = "Tất cả").

### Phase C — Bọc ACL vào 6 màn (áp dụng cùng đợt)

Nguyên tắc chung mỗi điểm sửa: (a) validate `?region=` param qua `requireRegion` nếu có; (b) khi KHÔNG truyền `region` (xem "tất cả"), filter theo `allowedRegions(actor)` thay vì `TRUCK_REGIONS` cứng; (c) dropdown chọn khu vực chỉ render `allowedRegions(actor)`.

- **C1** Fleet — `truck/fleet/page.tsx:56-110` (đang dùng `TRUCK_REGIONS` cứng ở dòng 60, filter dòng 66/72).
- **C2** Trips — `server/queries/truck-trips.queries.ts` (điểm nhận `region` filter) + trang list liên quan.
- **C3** Dashboard — `truck/dashboard/page.tsx:122-208` (bao gồm breakdown "tất cả khu vực" ở dòng ~191 hiện luôn loop đủ `TRUCK_REGIONS` — đổi sang loop `allowedRegions`).
- **C4** Reports — `server/queries/truck-report.queries.ts`, `truck/reports/new/page.tsx`, `report-region-step.tsx` (bước chọn khu vực khi tạo báo cáo — chỉ cho chọn khu vực được phép).
- **C5** Finance/PNL — `server/queries/truck-finance.queries.ts`, `truck/finance/page.tsx`, `truck/pnl/page.tsx`.
- **C6** Month-close — queries/actions liên quan `truck-month-close.schema.ts`.
  - └─ Side-impact chung (C1-C6): rủi ro bỏ sót 1 điểm đọc `region` param nào đó → lộ dữ liệu khu vực bị thu hẹp. Cần checklist grep `TRUCK_REGIONS` + `region` toàn bộ `truck/**` trước khi coi Phase C xong.

### Phase D — UI quản lý (ADMIN)

- **D1** `app/(app)/settings/region-access/page.tsx` (mirror `settings/fleet-access/page.tsx`) — ADMIN-only redirect, `PageHeader`, danh sách member.
- **D2** `_components/region-member-controls.tsx` — checkbox multi-select 3 khu vực/user + badge "Tất cả khu vực (mặc định)" khi rỗng.
- **D3** Nav: thêm mục `settings/region-access` vào sidebar ADMIN (`nav.regionAccess` i18n key), cạnh mục `fleetAccess` hiện có.
- **D4** i18n `messages/{vi,en,ko}.json` — namespace `screens.regionAccess.*` (tái dùng `region.*` cho label khu vực đã có).

### Phase E — Test + docs

- **E1** TC `docs/test/TC-20260813-region-access-control.md` — case cho D1-D4 (default mở, thu hẹp, ADMIN bypass, 6 màn, multi-region).
- **E2** Verify trên staging (theo tiền lệ — local dev không hydrate ổn định).
- **E3** TR + RPT sau khi test xong.

## 3. Bảng file thay đổi

| Vùng | File | Loại |
|---|---|---|
| DB | `packages/db/src/schema/user-region-access.schema.ts` | Mới |
| DB | `packages/db/src/schema/index.ts` | Sửa |
| DB | `packages/db/migrations/0026_truck_region_access.sql` | Mới |
| Zod | `packages/shared/src/zod/region-access.zod.ts` | Mới |
| Auth | `apps/web/src/lib/auth/region-access.ts` | Mới |
| Query | `apps/web/src/server/queries/region-access.queries.ts` | Mới |
| Query | `apps/web/src/server/queries/truck-trips.queries.ts` | Sửa |
| Query | `apps/web/src/server/queries/truck-report.queries.ts` | Sửa |
| Query | `apps/web/src/server/queries/truck-finance.queries.ts` | Sửa |
| Query | Month-close queries (file(s) tương ứng `truck-month-close.schema.ts`) | Sửa |
| Action | `apps/web/src/server/actions/region-access/region-access.actions.ts` | Mới |
| UI | `apps/web/src/app/(app)/truck/fleet/page.tsx` | Sửa |
| UI | `apps/web/src/app/(app)/truck/dashboard/page.tsx` | Sửa |
| UI | `apps/web/src/app/(app)/truck/reports/new/page.tsx` + `_components/report-region-step.tsx` | Sửa |
| UI | `apps/web/src/app/(app)/truck/finance/page.tsx`, `truck/pnl/page.tsx` | Sửa |
| UI | `apps/web/src/app/(app)/settings/region-access/page.tsx` | Mới |
| UI | `apps/web/src/app/(app)/settings/region-access/_components/region-member-controls.tsx` | Mới |
| Nav | Sidebar config (nơi khai báo `nav.fleetAccess`) | Sửa |
| i18n | `apps/web/messages/{vi,en,ko}.json` | Sửa |

## 4. Sai số / rủi ro (side-impact)

| Phạm vi | Rủi ro | Giảm thiểu |
|---|---|---|
| Migration staging thiếu | 500 khi đọc bảng mới | Checklist: áp SQL staging TRƯỚC deploy (giống 0011/0018) |
| Bỏ sót 1 điểm đọc `region` trong 6 màn | User bị thu hẹp vẫn thấy dữ liệu khu vực khác qua 1 route quên bọc | Grep toàn bộ `TRUCK_REGIONS`/`region` trong `truck/**` trước khi đóng Phase C; checklist trong TC |
| 2 tầng ACL chồng nhau (fleet-department + region) | Dev quên gọi `requireFleet` khi thêm `requireRegion`, hoặc ngược lại | Helper `requireTruckRegion(actor, region)` gộp cả 2 check thay vì gọi rời — giảm khả năng quên |
| ADMIN gán khu vực cho user không có TRUCK fleet access | Region-access vô nghĩa (user không vào được TRUCK) | `listRegionAccessMembers` chỉ liệt kê user đã có `ufa_vehicle_type='TRUCK'` |
| Trip không có cột `region` riêng (kế thừa qua xe) | Trip của xe chưa gán khu vực (`cvh_region IS NULL`) → không thuộc khu vực nào → ẩn khỏi user bị thu hẹp | Giữ nguyên hành vi hiện tại (NULL region vẫn hiện với ADMIN); ghi chú trong TC, không thuộc scope sửa |

## 5. Migration (draft — chi tiết hoá khi code)

```sql
-- 0026_truck_region_access.sql — REQ-20260813 region-access-control
-- Model: allow-list ghi đè (0 row = tất cả khu vực). Mirror cấu trúc 0011_fleet_access.sql.
-- Không tạo enum mới — ura_region dùng varchar(40) đồng bộ với cvh_region/trr_region.

CREATE TABLE IF NOT EXISTS "car_user_region_access" (
  "ura_id"         char(36) PRIMARY KEY NOT NULL,
  "ent_id"         char(36) NOT NULL,
  "usr_id"         char(36) NOT NULL,
  "ura_region"     varchar(40) NOT NULL,
  "ura_granted_by" char(36),
  "ura_granted_at" timestamptz NOT NULL DEFAULT now(),
  "ura_deleted_at" timestamptz
);
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "car_user_region_access"
    ADD CONSTRAINT "car_user_region_access_usr_id_car_users_usr_id_fk"
    FOREIGN KEY ("usr_id") REFERENCES "public"."car_users"("usr_id")
    ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "uniq_car_user_region_access_ent_usr_region"
  ON "car_user_region_access" USING btree ("ent_id", "usr_id", "ura_region")
  WHERE "ura_deleted_at" IS NULL;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_car_user_region_access_ent_usr"
  ON "car_user_region_access" USING btree ("ent_id", "usr_id");
```
Không cần backfill (D1 — 0 row mặc định = tất cả khu vực). Dev: `db:push`. Staging/prod: áp file tay (synchronize tắt).

## 6. Cổng duyệt (User Approval Gate)

**Chưa code.** Theo quy trình chuẩn: cần bạn duyệt PLAN này (hoặc góp ý điều chỉnh phase/scope) → sau đó viết Test Case (`docs/test/TC-20260813-region-access-control.md`) → chờ bạn xác nhận tiếp → mới bắt đầu code theo Phase A→E.
