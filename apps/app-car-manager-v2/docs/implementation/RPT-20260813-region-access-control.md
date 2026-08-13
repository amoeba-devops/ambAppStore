# RPT-20260813 — Region Access Control: Báo cáo Hoàn thành

> Chuỗi tài liệu: [REQ](../analysis/REQ-20260813-region-access-control.md) → [PLN](../plan/PLN-20260813-region-access-control.md) → [TC](../test/TC-20260813-region-access-control.md) → [TR](../test/TR-20260813-region-access-control.md) → RPT (tài liệu này).

## 1. Yêu cầu đã thực hiện

Phân quyền user theo khu vực cho app TRUCK. Trước đây khu vực (HCM / DONG_NAI / BAIKSAN) chỉ là **filter dữ liệu** — mọi user vào được TRUCK đều thấy cả 3 khu vực. Nay khu vực trở thành **quyền hạn**.

Model đã chốt (4 quyết định của người dùng, xem REQ §7): **allow-list ghi đè** —
- 0 row gán → thấy **tất cả** khu vực (giữ nguyên hành vi cũ, không breaking, không cần backfill)
- ≥1 row → **thu hẹp** còn đúng các khu vực đó
- ADMIN → luôn toàn bộ khu vực (implicit, không cần row)
- Áp cho cả MANAGER và DRIVER; gán được **nhiều** khu vực; áp **cả 6 màn** cùng đợt

## 2. Kiến trúc đã triển khai

Tái dùng shape của `car_user_fleet_access` (REQ-20260617) nhưng **đảo ngược ngữ nghĩa**: fleet-access là "cần cấp mới vào được", region-access là "mặc định mở, gán mới thu hẹp". Hai tầng độc lập, dùng đồng thời:

```
JWT (AMA) → middleware → getCurrentUser()
                              ├─ requireRole()      role tier (có sẵn)
                              ├─ requireFleet()     CAR/TRUCK department (REQ-20260617)
                              └─ requireRegion()    khu vực (REQ này) ⭐ MỚI
```

API của guard mới ([`lib/auth/region-access.ts`](../../apps/web/src/lib/auth/region-access.ts)):

| Hàm | Vai trò |
|---|---|
| `resolveRegionAccess(actor)` | `'ALL'` (ADMIN hoặc 0 row) hoặc `TruckRegion[]`; cache theo request bằng React `cache()` |
| `allowedRegions(actor)` | Danh sách khu vực để render dropdown/picker |
| `hasRegion` / `requireRegion` | Kiểm tra 1 khu vực; `requireRegion` ném `CAR-E0403` |
| `requireTruckRegion(actor, region?)` | Gộp `requireFleet('TRUCK')` + `requireRegion` — dùng cho màn truck mới để không quên 1 trong 2 |
| `resolveRegionFilter(actor, raw)` | Chuẩn hoá `?region=`: hợp lệ+được phép → dùng; vắng/không hợp lệ → `undefined`; hợp lệ nhưng bị từ chối → **ném 403** (không im lặng mở rộng) |

## 3. Thay đổi theo Phase

### Phase A — DB + Auth

| File | Loại |
|---|---|
[`packages/db/src/schema/user-region-access.schema.ts`](../../packages/db/src/schema/user-region-access.schema.ts) | Mới — bảng `car_user_region_access`, unique index có điều kiện `WHERE ura_deleted_at IS NULL` |
[`packages/db/migrations/0026_truck_region_access.sql`](../../packages/db/migrations/0026_truck_region_access.sql) | Mới — idempotent, **không** cần backfill |
| `packages/db/src/schema/index.ts` | Sửa — export |
[`packages/shared/src/zod/region-access.zod.ts`](../../packages/shared/src/zod/region-access.zod.ts) | Mới — `setRegionAccessSchema` (regions = **tập đích**, không phải delta) |
| `packages/shared/src/zod/index.ts` | Sửa — export |
[`apps/web/src/lib/auth/region-access.ts`](../../apps/web/src/lib/auth/region-access.ts) | Mới — guard/resolver |

`ura_region` dùng `varchar(40)` (không tạo pg enum) để đồng bộ với `cvh_region` / `trr_region` / `tfi_region` / `tmc_region` sẵn có.

### Phase B — Server actions + queries

| File | Nội dung |
|---|---|
[`server/actions/region-access/region-access.actions.ts`](../../apps/web/src/server/actions/region-access/region-access.actions.ts) | `setRegionAccessAction` (đồng bộ tập khu vực: insert phần thiếu → soft-delete phần bỏ; thứ tự forgiving vì neon-http không có transaction — fail giữa chừng để user **rộng hơn**, không khoá nhầm), `revokeAllRegionAccessAction`. Chặn gán cho ADMIN (`CAR-E0409` — sẽ là no-op vô nghĩa). Audit `REGION.ACCESS_SET` / `REGION.ACCESS_CLEARED` + notify user. |
[`server/queries/region-access.queries.ts`](../../apps/web/src/server/queries/region-access.queries.ts) | `listRegionAccessMembers` — chỉ liệt kê user có TRUCK access (ADMIN implicit), kèm cờ `unrestricted` / `implicit` |

### Phase C — Enforcement (6 màn + điểm ghi)

**Đọc (lọc theo scope + validate param):** `truck/fleet`, `truck/dashboard` (gồm breakdown per-region: loop theo `permittedRegions` thay vì `TRUCK_REGIONS`), `truck/trips`, `truck/finance`, `truck/pnl`, `truck/reports` (+ `reports/new` 3 bước).

**Ghi (chặn tại action — không chỉ ở UI):**
| Action | Chặn |
|---|---|
| `generateTruckReportAction` | Khu vực ngoài quyền; và `region=null` (báo cáo hợp nhất) khi user bị thu hẹp |
| `generateAllRegionsTruckReportsAction` | Validate từng khu vực explicit; scope implicit "mọi khu vực có dữ liệu" bị lọc theo quyền |
| `addFuelInvoiceAction` / `deleteFuelInvoiceAction` | Không ghi/xoá hoá đơn nhiên liệu khu vực khác |
| `createVehicleAction` / `updateVehicleAction` | Không đặt xe vào khu vực ngoài quyền; sửa xe cần quyền **cả** khu vực cũ và mới |

**Route handler (status thật):** `truck/trips/export` → 403; `truck/reports/[id]/download` → 403 cho báo cáo khu vực khác **và** báo cáo hợp nhất (`trr_region NULL`).

**Mở rộng query (thêm filter nhiều khu vực, mặc định giữ nguyên hành vi):**
- `computeTruckPnl` (core): thêm `regions?`; `regions: []` → trả rows rỗng, **không** bao giờ nới thành "không filter"
- `listTruckTrips`, `listTruckFinanceTrips`, `listTruckReports`: cùng pattern

**UI dropdown/picker chỉ render khu vực được phép:** `trip-filters.tsx`, `report-region-step.tsx` (ẩn luôn option "Tất cả khu vực" khi bị thu hẹp), `truck-vehicle-form.tsx`, ParamSelect ở fleet/finance/pnl, pill filter ở dashboard.

### Phase D — UI quản lý + nav + i18n

| File | Nội dung |
|---|---|
[`settings/region-access/page.tsx`](../../apps/web/src/app/(app)/settings/region-access/page.tsx) | ADMIN-only; bảng thành viên TRUCK |
[`_components/region-member-controls.tsx`](../../apps/web/src/app/(app)/settings/region-access/_components/region-member-controls.tsx) | Multi-select 3 khu vực + nút Lưu (chỉ hiện khi có thay đổi) + badge "Tất cả khu vực (mặc định)" |
| `components/layout/nav-items.ts` | Nav mới `regionAccess` (ADMIN, `fleet: 'TRUCK'`) |
| `messages/{vi,en,ko}.json` | `nav.regionAccess` + `screens.regionAccess.*`; nhãn khu vực tái dùng `region.*` |

## 4. Kết quả test

**37/37 check server-side PASS + 5/5 test UI (Playwright, Chromium thật) PASS** — chi tiết ở [TR-20260813](../test/TR-20260813-region-access-control.md). Typecheck exit 0 ở cả 4 package. Migration đã áp vào **local/dev**; DB đã khôi phục nguyên trạng sau test.

**1 defect UX phát hiện khi test UI và đã sửa**: khu vực ngoài quyền trước đây hiện **trang lỗi chung** ("Đã có lỗi xảy ra") vì `resolveRegionFilter` ném `CarError` trong Server Component. Nay page **redirect** về chính nó với `?region_denied=<code>` + banner giải thích ([`region-denied-notice.tsx`](../../apps/web/src/components/truck/region-denied-notice.tsx), i18n 3 ngôn ngữ) — khớp cách app xử lý authorization miss ở page. Action/route handler vẫn trả 403 (`CAR-E0403`) như trước.

Điểm đáng lưu ý về **phương pháp đo** (đã ghi rõ ở TR §2): status code trong Next App Router không phản ánh ACL (redirect ở tầng RSC → 200; CarError → error boundary 200), và **React dev flight stream serialize giá trị trả về của server function** khiến HTML thô ở dev vẫn chứa dữ liệu chưa lọc. Lần chạy đầu vì vậy báo 14 FAIL giả. Sau khi strip `<script>` và assert theo nội dung, kết quả sạch; route handler (`export`) cho status thật 403/200 là bằng chứng độc lập rằng guard chạy đúng.

## 5. Việc còn lại trước khi lên production

1. **Áp `0026_truck_region_access.sql` vào staging** (`ep-noisy-heart`) **TRƯỚC** khi deploy code — nếu thiếu sẽ 500 khi đọc bảng mới. Local/dev (`ep-steep-tooth`) đã áp. **Không** đụng `ep-gentle-rain`.
2. **Xác nhận bản build production** không phát flight payload chứa dữ liệu chưa lọc (dự kiến không, vì đó là dev instrumentation).
3. Kiểm tra thêm trên **mobile viewport** (test local scope vào bảng desktop, chưa kiểm danh sách card mobile).
4. Deploy theo đúng flow repo: staging trước → test → mới lên production.

## 6. Ghi chú side-impact

| Phạm vi | Ghi nhận |
|---|---|
| Xe chưa gán khu vực (`cvh_region` NULL) | Với user bị thu hẹp thì bị ẩn (không thuộc khu vực nào). Giữ nguyên AS-IS, không sửa trong scope này. |
| Báo cáo hợp nhất (`trr_region` NULL) | User bị thu hẹp không tạo, không xem, không tải được — đúng chủ đích vì báo cáo này bao trùm mọi khu vực. |
| DRIVER | Cùng cơ chế với MANAGER; mặc định vẫn thấy tất cả nên không ảnh hưởng gì tới driver hiện tại. |
| Rollout | Bảng rỗng ban đầu = không ai mất quyền. Enforcement chỉ kích hoạt khi ADMIN gán khu vực cụ thể cho một user. |
