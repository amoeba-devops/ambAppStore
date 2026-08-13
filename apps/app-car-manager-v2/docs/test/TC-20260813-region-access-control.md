# TC-20260813 — Region Access Control (Truck)

> Test cho [REQ-20260813-region-access-control](../analysis/REQ-20260813-region-access-control.md) + [PLN-20260813](../plan/PLN-20260813-region-access-control.md). Model: **allow-list ghi đè** — 0 row = tất cả khu vực (mặc định); ADMIN gán 1+ khu vực → user bị thu hẹp. Áp dụng MANAGER + DRIVER, cả 6 màn TRUCK.

## Setup

- `npm run db:push` (dev Neon) để sync schema mới `car_user_region_access`; staging áp `0026_truck_region_access.sql` tay trước khi test staging.
- dev-login: `/app-car-manager-v2/dev-login?role=ADMIN|MANAGER|MEMBER` (`DEMO_AUTO_LOGIN=true`).
- Seed tối thiểu: 1 entity có ≥3 xe TRUCK, mỗi xe 1 khu vực khác nhau (HCM/DONG_NAI/BAIKSAN), mỗi khu vực có ≥1 trip + report + fuel-invoice + month-close để verify data thực sự bị lọc (không chỉ dropdown).
- User test: `admin1` (ADMIN), `mgr1`/`mgr2` (MANAGER, có `car_user_fleet_access` TRUCK), `drv1` (DRIVER, có TRUCK access).

## A. DB + Auth resolver (`resolveRegionAccess` / `requireRegion`)

| # | Mô tả | Tiền điều kiện | Bước | Kỳ vọng |
|---|---|---|---|---|
| TC-01 | Default mở — chưa gán gì | `mgr1` 0 row region-access | `resolveRegionAccess(mgr1)` | trả `'ALL'` (không phải mảng rỗng) |
| TC-02 | ADMIN luôn full | role=ADMIN, 0 row | `resolveRegionAccess(admin1)` | `'ALL'`, implicit, không query bảng |
| TC-03 | Gán 1 khu vực | `mgr1` chưa có row | `grantRegionAccessAction({userId:mgr1, regions:['HCM']})` | INSERT 1 row; `resolveRegionAccess(mgr1)` → `['HCM']` (thu hẹp) |
| TC-04 | Gán nhiều khu vực | `mgr1` chưa có row | `grantRegionAccessAction({userId:mgr1, regions:['HCM','DONG_NAI']})` | 2 row INSERT; `resolveRegionAccess` → `['HCM','DONG_NAI']` |
| TC-05 | Thu hẹp chặn khu vực khác | `mgr1` chỉ có `['HCM']` | `requireRegion(mgr1, 'BAIKSAN')` | ném `CAR-E0403` |
| TC-06 | Trong phạm vi thì pass | `mgr1` chỉ có `['HCM']` | `requireRegion(mgr1, 'HCM')` | không throw |
| TC-07 | Đổi set khu vực (bớt) | `mgr1` có `['HCM','DONG_NAI']` | `grantRegionAccessAction({userId:mgr1, regions:['HCM']})` | `DONG_NAI` soft-deleted; `resolveRegionAccess` → `['HCM']` |
| TC-08 | Revoke hết → quay lại mở | `mgr1` có `['HCM']` | `revokeAllRegionAccessAction({userId:mgr1})` | tất cả row soft-deleted; `resolveRegionAccess` → `'ALL'` |
| TC-09 | Grant idempotent | `mgr1` đã có `['HCM']` | gọi lại `grantRegionAccessAction({regions:['HCM']})` | không tạo row trùng (unique index còn 1 row live) |
| TC-10 | Re-grant sau revoke | `HCM` đã revoke cho `mgr1` | grant lại `['HCM']` | INSERT row mới (unique index chỉ tính row live) thành công |
| TC-11 | DRIVER — cùng cơ chế | `drv1` 0 row | `resolveRegionAccess(drv1)` rồi grant `['BAIKSAN']` | y hệt hành vi MANAGER (TC-01, TC-03) |
| TC-12 | `allowedRegions` cho dropdown | `mgr1` có `['HCM']`; `admin1` 0 row | `allowedRegions(mgr1)` / `allowedRegions(admin1)` | `mgr1` → `['HCM']`; `admin1` → cả 3 (`TRUCK_REGIONS`) |
| TC-13 | Non-ADMIN gọi grant/revoke | role=MANAGER | gọi `grantRegionAccessAction` | `CAR-E0102` forbidden (requireRole ADMIN) |
| TC-14 | Grant cho user không có TRUCK fleet access | user chỉ có CAR fleet access | `listRegionAccessMembers(entId)` | user đó KHÔNG xuất hiện trong danh sách quản lý |

## B. Enforcement trên 6 màn (mỗi màn: 3 kịch bản)

Với mỗi màn dưới, verify 3 kịch bản trên cùng dữ liệu seed (3 khu vực, `mgr1` bị thu hẹp còn `['HCM']`):
- **(a) Query trực tiếp URL** `?region=BAIKSAN` khi bị thu hẹp → 403 hoặc dữ liệu rỗng (không lộ khu vực khác).
- **(b) Không truyền `region`** (xem "tất cả") → chỉ trả/hiển thị dữ liệu của khu vực được phép (`HCM`), KHÔNG phải cả 3.
- **(c) ADMIN** (0 row, `'ALL'`) → hành vi y hệt AS-IS, thấy đủ cả 3 khu vực.

| # | Màn | (a) Region param ngoài quyền | (b) Không truyền region | (c) ADMIN |
|---|---|---|---|---|
| TC-15 | Fleet (`truck/fleet`) | 403 hoặc list rỗng cho BAIKSAN | Chỉ liệt kê xe khu vực HCM; dropdown chỉ có HCM | Thấy đủ 3 khu vực, dropdown đủ 3 |
| TC-16 | Trips | tương tự — trip của xe BAIKSAN không trả về | Chỉ trip của xe khu vực HCM | Đủ 3 khu vực |
| TC-17 | Dashboard (kèm breakdown "tất cả khu vực") | truy cập `?region=BAIKSAN` → chặn | Breakdown chỉ loop qua `allowedRegions` (chỉ HCM), KHÔNG loop cả 3 | Breakdown đủ 3 khu vực như hiện tại |
| TC-18 | Reports (tạo mới + `report-region-step`) | Bước chọn khu vực không cho chọn BAIKSAN | Danh sách khu vực để tạo báo cáo chỉ có HCM | Đủ 3 khu vực chọn |
| TC-19 | Finance/PNL | Query PNL theo BAIKSAN bị chặn | PNL chỉ tính khu vực HCM | Đủ 3 khu vực |
| TC-20 | Month-close | Đóng tháng khu vực BAIKSAN bị chặn | Chỉ thấy trạng thái đóng tháng của HCM | Đủ 3 khu vực |

## C. UI quản lý `settings/region-access` (ADMIN-only)

| # | Mô tả | Tiền điều kiện | Bước | Kỳ vọng |
|---|---|---|---|---|
| TC-21 | Non-ADMIN truy cập trang | role=MANAGER | vào `/settings/region-access` | redirect (giống `FleetAccessPage`: MANAGER→`/dashboard`, DRIVER→`/today`) |
| TC-22 | ADMIN xem danh sách | có `mgr1`, `mgr2`, `drv1` (TRUCK access) | vào trang | liệt kê đủ 3 user; `mgr1` hiện đúng khu vực đã gán, còn lại hiện badge "Tất cả khu vực (mặc định)" |
| TC-23 | Tick nhiều khu vực rồi Save | `mgr2` chưa gán | tick HCM + DONG_NAI, Save | `grantRegionAccessAction` gọi đúng payload; UI phản ánh lại 2 khu vực đã chọn (không phải "Tất cả") |
| TC-24 | Bỏ tick hết rồi Save | `mgr1` đang có `['HCM']` | bỏ tick, Save | quay về badge "Tất cả khu vực (mặc định)" |
| TC-25 | i18n | đổi locale vi/en/ko | mở trang | label + badge dịch đúng cả 3 ngôn ngữ, không hardcode |

## Regression

| # | Mô tả | Kỳ vọng |
|---|---|---|
| RG-01 | CAR flow không đổi | `cvh_region` luôn NULL cho xe CAR; region-access không ảnh hưởng route/action CAR |
| RG-02 | Fleet-access (department ACL) không đổi | `requireFleet('TRUCK')` vẫn hoạt động độc lập; user có TRUCK fleet access nhưng 0 region row vẫn vào được TRUCK (chỉ bị lọc dữ liệu theo khu vực nếu có row) |
| RG-03 | Trip có xe chưa gán khu vực (`cvh_region IS NULL`) | Hành vi giữ nguyên AS-IS — không thuộc scope sửa của REQ này (ghi chú side-impact PLN §4) |
| RG-04 | Không có row nào bị xoá cứng | Mọi revoke chỉ set `ura_deleted_at`, không `DELETE` |
| RG-05 | Typecheck | `tsc --noEmit` exit 0 ở `packages/db`, `packages/shared`, `apps/web` |
| RG-06 | ADMIN dashboard/report/export không đổi số liệu | So sánh output ADMIN trước/sau — phải giống hệt AS-IS (ADMIN luôn `'ALL'`) |

## Cổng duyệt (User Approval Gate)

**Chưa code.** Sau khi bạn xác nhận TC này đủ/đúng phạm vi → bắt đầu implement theo PLN Phase A→E, verify theo checklist TC ở trên (ưu tiên chạy trên staging vì local dev không hydrate ổn định — ghi nhận từ các REQ trước).
