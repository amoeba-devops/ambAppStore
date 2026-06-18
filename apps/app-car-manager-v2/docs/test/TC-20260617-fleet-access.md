# TC-20260617 — Fleet Access (Department × Role)

> Test cho [REQ-20260617-fleet-access](../analysis/REQ-20260617-fleet-access.md). Phase này: backend (DB + auth + actions). FE TC bổ sung khi UI được build.

## Setup
- `npm run db:push` (dev Neon) để sync schema; chạy backfill trong `0011_fleet_access.sql` (steps 5).
- dev-login: `/app-car-manager-v2/dev-login?role=OWNER|MANAGER|MEMBER` (gated `DEMO_AUTO_LOGIN=true`).

| # | Mô tả | Tiền điều kiện | Bước | Kỳ vọng |
|---|---|---|---|---|
| TC-01 | Backfill car MVP | Có car_users cũ | Chạy backfill | Mỗi user live có đúng 1 membership CAR; không trùng |
| TC-02 | ADMIN có cả 2 | role=ADMIN | `resolveFleetAccess` | `['CAR','TRUCK']` dù không có row |
| TC-03 | MANAGER 1 phòng | seed chỉ CAR | `requireFleet(actor,'TRUCK')` | ném `CAR-E0403` |
| TC-04 | MANAGER request | role=MANAGER, chưa có TRUCK | `requestFleetAccessAction({vehicleType:'TRUCK'})` | far PENDING; admins được notify |
| TC-05 | Request trùng | đã có 1 PENDING TRUCK | request lại TRUCK | `CAR-E0409` pending exists |
| TC-06 | Request khi đã có | manager đã có TRUCK | request TRUCK | `CAR-E0409` already have |
| TC-07 | ADMIN approve | có far PENDING | `decideFleetAccessAction({decision:'APPROVED'})` | INSERT membership; far APPROVED; requester notify |
| TC-08 | Approve idempotent | re-run approve | gọi lại decide | không tạo membership trùng; báo already decided |
| TC-09 | Sau approve | manager re-login | `resolveFleetAccess` | `['CAR','TRUCK']` |
| TC-10 | ADMIN reject | có far PENDING | decide REJECTED | far REJECTED; KHÔNG có membership |
| TC-11 | Grant driver 1 phòng | DRIVER chưa có | grant CAR | OK |
| TC-12 | Driver giới hạn 1 | DRIVER đã có CAR | grant TRUCK | `CAR-E0409` driver 1 department |
| TC-13 | Grant trùng | user đã có CAR | grant CAR | `CAR-E0409` already has |
| TC-14 | Revoke | user có TRUCK | revoke TRUCK | membership soft-deleted; `resolveFleetAccess` bỏ TRUCK |
| TC-15 | Revoke không có | không membership | revoke | `CAR-E0404` not found |
| TC-16 | Non-admin gọi decide | role=MANAGER | decide | `CAR-E0102` forbidden |
| TC-17 | Embedded vs independent | — | lặp TC-03/07 qua Render URL | kết quả y hệt (đồng nhất lối vào) |
| TC-18 | withFleetScope rỗng | depts=[] | build query | predicate `false` → trả 0 dòng (không leak) |

## Regression
| # | Mô tả | Kỳ vọng |
|---|---|---|
| RG-01 | Car vehicle CRUD | cvh_type default 'CAR'; flow car nguyên vẹn |
| RG-02 | Car action không gọi requireFleet | không thêm query, không 403 |
| RG-03 | Typecheck db/shared/web | `tsc --noEmit` exit 0 cả 3 |
