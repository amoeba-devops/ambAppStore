# TC-20260921 — Truck: Module Hóa đơn (Invoice Aggregation)

> Test cho [REQ-20260921-truck-invoice-module](../analysis/REQ-20260921-truck-invoice-module.md) + [PLN-20260921](../plan/PLN-20260921-truck-invoice-module.md). Màn tổng hợp READ-ONLY 4 nguồn (trip-cost/maintenance/expense-TRUCK-only/fuel-invoice), scope TRUCK only, 2 tầng ACL (fleet department + khu vực).

## Setup

- `npm run db:push` (dev Neon) để sync 3 cột mới + bảng `car_truck_fuel_invoice_attachments`; staging áp `0035_truck_invoice_module.sql` tay trước khi test staging; chạy `node scripts/check-manual-migrations.mjs staging` để xác nhận đã áp.
- dev-login: `/app-car-manager-v2/dev-login?role=ADMIN|MANAGER|MEMBER` (`DEMO_AUTO_LOGIN=true`).
- Seed tối thiểu:
  - 3 xe TRUCK, mỗi xe 1 khu vực khác nhau (HCM/DONG_NAI/BAIKSAN).
  - Mỗi xe TRUCK: 1 trip `trp_kind='LOG'` đã COMPLETED có ≥1 attachment (rải đủ vài loại trong 7 `cost_kind`), 1 job bảo trì có attachment, 1 expense TRUCK (`exp_vehicle_id` hoặc qua trip) có attachment.
  - 2 hóa đơn xăng dầu tháng: 1 CÓ attachment, 1 KHÔNG (test R4 optional).
  - 1 xe CAR + 1 expense CAR có attachment (`exp_vehicle_id` → xe CAR) — dùng để test R5 (phải KHÔNG xuất hiện).
  - `mgr1` (MANAGER, có TRUCK fleet access, region-access thu hẹp còn `['HCM']` — tái dùng cơ chế REQ-20260813).
  - `admin1` (ADMIN), `drv1` (DRIVER, có TRUCK fleet access nhưng bị chặn ở layout).
  - ≥1 attachment "hàng cũ" có `s3_key` đúng layout `{entId}/{resource}/{userId}/{uuid}-name` và ≥1 hàng có `s3_key` lệch format (test backfill §B).

## A. Aggregation logic (`getTruckInvoices`)

| # | Mô tả | Tiền điều kiện | Bước | Kỳ vọng |
|---|---|---|---|---|
| TC-01 | Hợp nhất đủ 4 nguồn | Seed đầy đủ, actor=`admin1` | `getTruckInvoices(admin1, {})` | Danh sách chứa ≥1 row mỗi nguồn (TRIP_COST/MAINTENANCE/EXPENSE/FUEL_INVOICE) |
| TC-02 | Loại xe CAR khỏi kết quả (R5) | Expense CAR có attachment đã seed | `getTruckInvoices(admin1, {})` | Row của expense CAR **không** xuất hiện, kể cả không filter gì |
| TC-03 | Trip cost chỉ tính `trp_kind='LOG'` | (edge case) 1 attachment gắn vào trip DISPATCH nếu tạo được | query | Row đó không xuất hiện (defense-in-depth, không dựa hoàn toàn vào UI) |
| TC-04 | "Ngày" đúng theo nguồn | 4 nguồn đã seed với ngày khác nhau | So sánh field `date` trả về | Trip→`COALESCE(trp_ended_at,trp_scheduled_at)`; Maintenance→`tmn_start_date`; Expense→`exp_occurred_at`; Fuel→`tfi_date` |
| TC-05 | "Khu vực" đúng theo nguồn | Expense TRUCK chỉ có `exp_trip_id` (không có `exp_vehicle_id`) | query | Khu vực resolve qua `trip.trp_vehicle_id → cvh_region`, không NULL sai |
| TC-06 | Nhãn "Loại hóa đơn" đúng mapping | 1 mẫu mỗi (nguồn, subtype) trong bảng REQ §3.3 | query | Nhãn hiển thị khớp đúng bảng, phân biệt được nguồn khi trùng tên (VD REPAIR) |
| TC-07 | Sort + pagination | Seed > 1 trang dữ liệu | Lấy page 1 rồi page 2 | Sort giảm dần theo Ngày; không trùng/thiếu record giữa 2 trang |
| TC-08 | Filter thời gian | — | `{from, to}` bao 1 phần dữ liệu | Chỉ trả row có Ngày nằm trong khoảng |
| TC-09 | Filter theo xe | — | `{vehicleId}` | Chỉ trả row của xe đó, xuyên suốt cả 4 nguồn |
| TC-10 | Filter theo loại hóa đơn | — | `{type}` = 1 nhãn cụ thể | Chỉ trả đúng nguồn/subtype tương ứng nhãn đó |
| TC-11 | Fuel invoice KHÔNG có file (R4 optional) | Hóa đơn xăng dầu không attachment | query + render | **Row KHÔNG xuất hiện trong danh sách Hóa đơn** — màn này liệt kê CHỨNG TỪ (1 row = 1 file, giống 3 nguồn khác), không phải liệt kê nghiệp vụ; ledger vẫn đầy đủ ở màn Tài chính. Sửa lại so với đặc tả ban đầu sau khi phát hiện qua verify sống 2026-09-21 (xem TR §Ghi chú) |
| TC-12 | Fuel invoice CÓ file | Hóa đơn xăng dầu có attachment mới | query + render | Action Xem/Tải về hoạt động bình thường |

## B. `uploaded_by` (R3)

| # | Mô tả | Tiền điều kiện | Bước | Kỳ vọng |
|---|---|---|---|---|
| TC-13 | Upload mới — trip cost | actor=`mgr1` | Upload receipt qua trip completion form | `tca_uploaded_by = mgr1.usrId`; "Cập nhật bởi" hiện tên `mgr1` |
| TC-14 | Upload mới — maintenance | actor=`admin1` | Upload invoice qua maintenance form | `tma_uploaded_by` đúng |
| TC-15 | Upload mới — expense | actor=driver bất kỳ | Submit expense kèm receipt | `eat_uploaded_by` đúng |
| TC-16 | Backfill từ S3 key hợp lệ | Hàng cũ, key đúng layout | Chạy `0035` migration | `*_uploaded_by` được set đúng bằng userId nhúng trong key |
| TC-17 | Backfill key lệch format | Hàng cũ, key không khớp regex UUID | Chạy `0035` migration | `*_uploaded_by` giữ NULL; UI hiện "—", không lỗi |
| TC-18 | Reconcile không đè hàng cũ | Trip đã có 1 attachment với `uploaded_by=userA`; `userB` sửa trip, giữ nguyên file đó + thêm 1 file mới | `syncTripCostAttachments` | File cũ vẫn `uploaded_by=userA` (không bị đổi thành `userB`); file mới `uploaded_by=userB` |

## C. ACL — 2 tầng (kế thừa REQ-20260813 + REQ-20260617)

| # | Mô tả | Tiền điều kiện | Bước | Kỳ vọng |
|---|---|---|---|---|
| TC-19 | DRIVER bị chặn hoàn toàn | actor=`drv1` | Vào `/truck/invoices` | Redirect `/today` (layout gate — giống mọi màn `/truck/*` khác) |
| TC-20 | MANAGER không có TRUCK fleet access | actor không có `car_user_fleet_access` TRUCK | Vào `/truck/invoices` | Redirect `/dashboard` |
| TC-21 | MANAGER bị thu hẹp khu vực | `mgr1` region-access = `['HCM']` | Vào `/truck/invoices` không truyền `region` | Chỉ thấy hóa đơn khu vực HCM, **ở cả 4 nguồn** — không riêng dropdown, data thật cũng lọc |
| TC-22 | Truy cập trực tiếp khu vực ngoài quyền | `mgr1` chỉ có `['HCM']` | `?region=BAIKSAN` | 403 hoặc danh sách rỗng — không lộ dữ liệu BAIKSAN |
| TC-23 | ADMIN không bị ảnh hưởng | `admin1`, 0 row region-access | Vào `/truck/invoices` | Thấy đủ cả 3 khu vực, hành vi như AS-IS |

## D. UI

| # | Mô tả | Bước | Kỳ vọng |
|---|---|---|---|
| TC-24 | Cột bảng đúng thứ tự | Mở `/truck/invoices` | STT / Ngày / Khu vực / Phương tiện / Loại hóa đơn / Tên hóa đơn / Cập nhật bởi / Action |
| TC-25 | "Xem" mở lightbox | Bấm Xem trên 1 row ảnh + 1 row PDF | Ảnh hiện inline; PDF hiện glyph + nút "mở tab mới"/"tải về" — tái dùng đúng `AttachmentLightbox`, không regression so với các màn khác |
| TC-26 | "Tải về" đúng tên file | Bấm Tải về | File lưu với tên gốc (`fileName`), không phải UUID |
| TC-27 | Nav item "Hóa đơn" | Đăng nhập ADMIN/MANAGER có TRUCK access | Sidebar mục "Hóa đơn" trong section "Dữ liệu" | Xuất hiện đúng vị trí; ẩn khi context CAR hoặc role DRIVER |
| TC-28 | i18n 3 ngôn ngữ | Đổi locale vi/en/ko | Mở `/truck/invoices` | Toàn bộ label dịch đúng, không hardcode |
| TC-31 | Tìm kiếm theo Tên hóa đơn (R7) | ≥2 hóa đơn tên khác nhau | Gõ 1 phần tên vào ô tìm kiếm | Debounce 300ms → `?q=` cập nhật → chỉ còn hóa đơn tên khớp (không phân biệt hoa/thường); nút "Xoá lọc" xuất hiện khi có giá trị, bấm vào trả về danh sách đầy đủ |
| TC-29 | Form hóa đơn xăng dầu — attachment optional | Tạo hóa đơn xăng dầu KHÔNG chọn file | Submit | Thành công như hiện tại (không bắt buộc file) — regression check |
| TC-30 | Form hóa đơn xăng dầu — có attachment | Tạo hóa đơn xăng dầu kèm 1-2 ảnh | Submit rồi mở `/truck/invoices` | Hóa đơn xuất hiện với Action Xem/Tải về hoạt động |

## Regression

| # | Mô tả | Kỳ vọng |
|---|---|---|
| RG-01 | 6 màn TRUCK hiện có (Fleet/Trips/Dashboard/Reports/Finance/Month-close) | Không đổi hành vi, không đổi số liệu |
| RG-02 | CAR flow (expense/dashboard/costs) | Không đổi — expense CAR vẫn hoạt động y hệt AS-IS, chỉ không lộ ra ở màn Hóa đơn mới |
| RG-03 | 3 form upload cũ (trip/maintenance/expense) khi không set `uploadedBy` | Vẫn hoạt động, không lỗi (param optional, chỉ set NULL) |
| RG-04 | Typecheck | `tsc --noEmit` exit 0 ở `packages/db`, `packages/core`, `packages/shared`, `apps/web` |
| RG-05 | Soft-delete nguyên tắc | Không có hàng nào bị `DELETE` cứng bởi migration hoặc code mới — chỉ `UPDATE`/`INSERT` |
| RG-06 | `check-manual-migrations.mjs` | Probe `0035` FAIL rõ ràng nếu staging chưa áp SQL (đúng mục đích cảnh báo, không silent-pass) |
| RG-07 | Fleet-access / region-access hiện có | `requireFleet`/`resolveRegionAccess` không bị đổi hành vi bởi thay đổi lần này |

## Cổng duyệt (User Approval Gate)

**Chưa code.** Sau khi bạn xác nhận TC này đủ/đúng phạm vi → bắt đầu implement theo PLN Phase A→F, verify theo checklist TC ở trên (ưu tiên chạy trên staging vì local dev không hydrate ổn định — ghi nhận từ các REQ trước).
