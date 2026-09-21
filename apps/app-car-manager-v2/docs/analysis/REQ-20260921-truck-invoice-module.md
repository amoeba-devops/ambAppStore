# REQ-20260921 — Truck: Module Hóa đơn (Invoice Aggregation)

```yaml
document_id: V2-REQ-20260921-INVOICE-MODULE
version: 1.0.0
status: Decisions resolved — ready for PLAN
created: 2026-09-21
updated: 2026-09-21
author: Claude (dev@amoeba.group)
scope: apps/app-car-manager-v2 (TRUCK department only)
precedent: REQ-20260915 (attachment contract chung), REQ-20260813 (region access), REQ-20260617 (fleet access)
```

> **Model đã chốt (xem §7 Decision Log)**: màn hình **tổng hợp, READ-ONLY**. KHÔNG có luồng "thêm hóa đơn độc lập" — mọi hóa đơn vẫn được tạo từ đúng nghiệp vụ gốc của nó (chi phí chuyến/bảo trì xe/chi phí phát sinh/hóa đơn xăng dầu tháng); màn mới chỉ **liệt kê + filter + xem/tải** những gì đã upload ở 4 nơi đó.

> Nguồn yêu cầu: dòng requirement khách hàng — "Thêm module Hóa đơn để quản lý hóa đơn, filter theo thời gian, khu vực, xe, loại hóa đơn. Cho phép xem và tải về. Bảng hóa đơn (Số thứ tự/ Ngày/ Khu vực/ Phương tiện/ Loại hóa đơn/ Tên hóa đơn/ Cập nhật bởi/ Action (Xem, Tải về))".

---

## 1. Tóm tắt Yêu cầu

| # | Yêu cầu | Loại |
|---|---|---|
| R1 | Màn mới **Hóa đơn** (`/truck/invoices`) tổng hợp toàn bộ hóa đơn/chứng từ đã upload trong app TRUCK — filter theo thời gian, khu vực, xe, loại hóa đơn | Chức năng |
| R2 | Bảng: STT / Ngày / Khu vực / Phương tiện / Loại hóa đơn / Tên hóa đơn / Cập nhật bởi / Action (Xem, Tải về) | Chức năng |
| R3 | Bổ sung cột **người upload** cho 3 bảng đính kèm hiện có (hiện chỉ lưu thời điểm, không lưu người) | Chức năng (audit) |
| R4 | Bổ sung khả năng đính kèm file (ảnh/PDF) cho "Hóa đơn xăng dầu tháng" — **optional**, không bắt buộc khi nhập | Chức năng |
| R5 | Phạm vi: **TRUCK only** — không gồm chi phí của xe CAR | Phi chức năng |
| R6 | Áp dụng nhất quán ACL khu vực (`resolveRegionAccess`, REQ-20260813) + ACL phòng ban (`requireFleet('TRUCK')`, REQ-20260617) — màn Hóa đơn là **màn thứ 7** cần 2 tầng ACL này | Phi chức năng |
| R7 | Tìm kiếm tự do theo "Tên hóa đơn" (`?q=`, debounce) — bổ sung sau khi rà soát để nhất quán với 7/9 màn danh sách khác trong app đều có `DebouncedSearchInput` (VD `truck/fleet`, `truck/trips`, `truck/finance`, `users`) | Chức năng (bổ sung 2026-09-21, không thuộc yêu cầu gốc khách hàng) |

---

## 2. AS-IS Hiện trạng Phân tích

### 2.1 Chưa có màn tổng hợp — hạ tầng upload đang RỜI RẠC ở 3 nơi

Đã audit lại toàn bộ (grep `upload-presigned` + toàn bộ file schema có Attachment/Invoice) — xác nhận **chỉ đúng 3** route presigned-upload hóa đơn/chứng từ trong app, không có route thứ 4 nào bị bỏ sót:

| # | Nghiệp vụ | Bảng | Route upload | Cột hiện có |
|---|---|---|---|---|
| 1 | Chi phí chuyến (Fuel/Toll/Cleaning/Repair/Ferry/Loading/Extra) | `car_trip_cost_attachments` ([trip-cost-attachment.schema.ts](../../packages/db/src/schema/trip-cost-attachment.schema.ts)) | [`api/v1/truck/trips/upload-presigned/route.ts`](../../apps/web/src/app/api/v1/truck/trips/upload-presigned/route.ts) | `tca_s3_key/mime/size_bytes/file_name/uploaded_at` — **không có người upload** |
| 2 | Bảo trì xe | `car_truck_maintenance_attachments` ([truck-maintenance.schema.ts](../../packages/db/src/schema/truck-maintenance.schema.ts)) | [`api/v1/truck/maintenance/upload-presigned/route.ts`](../../apps/web/src/app/api/v1/truck/maintenance/upload-presigned/route.ts) | tương tự — **không có người upload** |
| 3 | Chi phí phát sinh (Expense, 8 loại) | `car_expense_attachments` ([expenses.schema.ts](../../packages/db/src/schema/expenses.schema.ts)) | [`api/v1/expenses/upload-presigned/route.ts`](../../apps/web/src/app/api/v1/expenses/upload-presigned/route.ts) | tương tự — **không có người upload**; bảng này dùng CHUNG cho cả CAR và TRUCK |

Cả 3 route dùng **1 contract chung** ([attachment.zod.ts](../../packages/shared/src/zod/attachment.zod.ts), REQ-20260915) và **1 key layout nhất quán**: `{entId}/{resource}/{userId}/{uuid}-{filename}` (resource = `trips`/`maintenance`/`expenses`) — quan trọng cho §6.3 (backfill). UI xem/tải dùng chung 1 component [attachment-viewer.tsx](../../apps/web/src/components/attachments/attachment-viewer.tsx) (`AttachmentGrid` + `AttachmentLightbox`), đã có sẵn nút Download + tên file.

### 2.2 Nguồn thứ 4 — "Hóa đơn xăng dầu tháng" — tên là hóa đơn nhưng KHÔNG có file

`car_truck_fuel_invoices` ([truck-fuel-invoice.schema.ts](../../packages/db/src/schema/truck-fuel-invoice.schema.ts)) — nhập liệu tay (trạm/lít/giá) qua [`fuel-invoice-panel.tsx`](../../apps/web/src/app/(app)/truck/pnl/_components/fuel-invoice-panel.tsx) + action `addInvoice` trong [truck-finance.actions.ts](../../apps/web/src/server/actions/settings/truck-finance.actions.ts). Đây là **ledger số liệu thuần túy** — không có cột S3 key nào. Nếu khách muốn xem/tải ảnh hóa đơn xăng dầu thật, tính năng này **chưa tồn tại**, phải bổ sung mới (R4).

### 2.3 Hạ tầng tái dùng được (đã xác nhận qua audit)

- **Taxonomy loại hóa đơn cho chi phí chuyến đã có 7 giá trị** (không phải 3 như comment cũ trong schema): `FUEL/TOLL/CLEANING/REPAIR/FERRY/LOADING/EXTRA` — [truck-trip.zod.ts](../../packages/shared/src/zod/truck-trip.zod.ts) (`tripCostKindSchema`, mở rộng REQ-20260916), đã có i18n `receiptsSection.*` trong `vi.json`/`en.json`/`ko.json`.
- **ACL phòng ban**: `requireFleet`/`hasFleet` ([fleet-access.ts](../../apps/web/src/lib/auth/fleet-access.ts)) — toàn bộ `/truck/*` đã bị chặn ở [layout.tsx](../../apps/web/src/app/(app)/truck/layout.tsx) cho non-TRUCK và DRIVER (DRIVER bị redirect `/today` trước khi vào được `/truck/invoices` — màn mới mặc định chỉ ADMIN/MANAGER thấy, khớp PRD).
- **ACL khu vực**: `resolveRegionAccess`/`requireRegion` (REQ-20260813) — model allow-list-ghi-đè, đã áp cho 6 màn TRUCK.
- **Nav "Dữ liệu" (`section: 'data'`) đã được định nghĩa trong `NavSection` từ REQ-20260629 nhưng CHƯA có item nào dùng** — [nav-items.ts:52](../../apps/web/src/components/layout/nav-items.ts#L52). Đúng vị trí cho mục "Hóa đơn" mới, không cần thêm section mới.

### 2.4 Vấn đề cụ thể cần giải quyết

1. Không có bảng/query nào hợp nhất 4 nguồn hóa đơn.
2. 3 bảng attachment không lưu người upload → không trả lời được "Cập nhật bởi".
3. `car_truck_fuel_invoices` không có file — không đáp ứng "Xem/Tải về" cho loại này.
4. Taxonomy "loại hóa đơn" trùng tên giữa nguồn (VD `REPAIR` vừa là chi phí chuyến vừa là loại Expense) — cần nhãn hiển thị phân biệt được nguồn.
5. "Ngày" mỗi nguồn định nghĩa khác nhau (ngày phát sinh nghiệp vụ vs ngày upload).
6. `car_expense_attachments` dùng chung CAR+TRUCK — cần filter tường minh để loại CAR khỏi kết quả (R5).

---

## 3. TO-BE Yêu cầu

### 3.1 Mapping AS-IS → TO-BE

| AS-IS | TO-BE |
|---|---|
| 3 nơi upload hóa đơn rời rạc, không có màn tổng hợp | 1 màn `/truck/invoices` hợp nhất cả 4 nguồn (đọc, không viết) |
| Attachment không biết ai upload | Thêm `*_uploaded_by` ở 3 bảng; ghi từ `actor.userId` khi upload mới; backfill dữ liệu cũ từ S3 key |
| Hóa đơn xăng dầu tháng không có file | Bảng mới `car_truck_fuel_invoice_attachments` (optional, 0..n file/hóa đơn) |
| Taxonomy loại hóa đơn rời rạc, trùng tên | Bảng mapping nhãn hiển thị theo (nguồn, subtype) — §3.3 |
| Không phân biệt CAR/TRUCK ở expense attachment | Query lọc tường minh qua vehicle/trip → `cvh_type = 'TRUCK'` |
| Nav "Dữ liệu" trống | Thêm nav item `truckInvoices` vào section `data` |

### 3.2 Entity/Bảng thay đổi

**Thêm cột** (3 bảng hiện có — nullable, không backfill bắt buộc nhưng SẼ backfill best-effort §6.3):

| Bảng | Cột mới |
|---|---|
| `car_trip_cost_attachments` | `tca_uploaded_by CHAR(36)` |
| `car_truck_maintenance_attachments` | `tma_uploaded_by CHAR(36)` |
| `car_expense_attachments` | `eat_uploaded_by CHAR(36)` |

**Bảng mới** — `car_truck_fuel_invoice_attachments` (mirror đúng shape 2 bảng attachment TRUCK hiện có, đặt cùng file [truck-fuel-invoice.schema.ts](../../packages/db/src/schema/truck-fuel-invoice.schema.ts)):

| Cột | Kiểu | Ghi chú |
|---|---|---|
| `tfa_id` | CHAR(36) PK | UUID |
| `ent_id` | CHAR(36) NOT NULL | multi-tenancy |
| `tfi_id` | CHAR(36) NOT NULL FK → `car_truck_fuel_invoices.tfi_id` | |
| `tfa_s3_key` | TEXT NOT NULL | |
| `tfa_mime` | VARCHAR(64) NOT NULL | |
| `tfa_size_bytes` | BIGINT NOT NULL | |
| `tfa_file_name` | VARCHAR(255) | |
| `tfa_uploaded_by` | CHAR(36) | |
| `tfa_uploaded_at` | TIMESTAMPTZ DEFAULT NOW() | |
| `tfa_deleted_at` | TIMESTAMPTZ NULL | soft delete |

0 hoặc nhiều file/hóa đơn — KHÔNG required ở form nhập liệu (R4 "optional").

### 3.3 Taxonomy "Loại hóa đơn" thống nhất (nhãn hiển thị + filter)

| Nguồn | Subtype gốc | Nhãn hiển thị (vi) |
|---|---|---|
| Chi phí chuyến | `FUEL` | Nhiên liệu (chuyến đi) |
| Chi phí chuyến | `TOLL` | Cầu đường |
| Chi phí chuyến | `CLEANING` | Vệ sinh phương tiện |
| Chi phí chuyến | `REPAIR` | Sửa chữa (chuyến đi) |
| Chi phí chuyến | `FERRY` | Cầu phà |
| Chi phí chuyến | `LOADING` | Bốc dỡ hàng hóa |
| Chi phí chuyến | `EXTRA` | Khác (chuyến đi) |
| Bảo trì | *(duy nhất 1 loại)* | Bảo trì / sửa chữa xe |
| Expense (TRUCK-scoped) | `FUEL/OIL/MEAL/REPAIR/PARKING/TOLL/ACCIDENT/INSPECTION` | tái dùng nhãn Expense hiện có + hậu tố "(Chi phí)" khi trùng tên với nhóm Chi phí chuyến (VD "Sửa chữa (Chi phí)") để phân biệt nguồn |
| Hóa đơn xăng dầu | *(duy nhất 1 loại)* | Hóa đơn xăng dầu tháng |

Dropdown filter "Loại hóa đơn" render danh sách nhãn **thực tế có dữ liệu** (không hard-code đủ 4 nguồn nếu tenant chưa có dữ liệu loại đó).

### 3.4 Business logic hợp nhất

**TRUCK-scoping (R5) theo từng nguồn:**
- Chi phí chuyến: vốn đã TRUCK-only theo nghiệp vụ (UI chỉ render trên trip `trp_kind='LOG'`) — thêm điều kiện `trips.trp_kind = 'LOG'` ở query cho chắc (defense-in-depth, không dựa hoàn toàn vào UI).
- Bảo trì: vốn TRUCK-only (`car_truck_maintenances` không dùng cho xe CAR).
- Expense: **cần filter tường minh** — resolve vehicle qua `COALESCE(exp_vehicle_id, trip.trp_vehicle_id)` rồi require `car_vehicles.cvh_type = 'TRUCK'`.
- Hóa đơn xăng dầu: vốn TRUCK-only (`tfi_vehicle_type` default `'TRUCK'`).

**"Ngày" theo từng nguồn** (ngày phát sinh nghiệp vụ, KHÔNG phải ngày upload):
| Nguồn | Cột ngày dùng cho filter/hiển thị |
|---|---|
| Chi phí chuyến | `COALESCE(trp_ended_at, trp_scheduled_at)` |
| Bảo trì | `tmn_start_date` |
| Expense | `exp_occurred_at` |
| Hóa đơn xăng dầu | `tfi_date` |

**Khu vực**: suy ra từ xe (`cvh_region`) ở cả 4 nguồn (bảo trì/chi phí chuyến/hóa đơn xăng dầu qua vehicle trực tiếp; expense qua `COALESCE(exp_vehicle_id, trip.trp_vehicle_id)`). Áp `resolveRegionAccess(actor)` giống 6 màn hiện có — 0 row gán = thấy tất cả, ADMIN luôn full.

**Truy vấn**: 4 query riêng (mỗi nguồn tự JOIN vehicle/user, tự áp WHERE theo filter), gộp ở application layer thành 1 danh sách `TruckInvoiceRow[]` chung shape, sort theo ngày giảm dần, phân trang trong bộ nhớ. Không dùng UNION ALL SQL thô qua Drizzle (4 bảng khác cấu trúc, JOIN khác nhau) — giữ mỗi query đơn giản, dễ test độc lập, khớp phong cách hiện tại (`*.queries.ts` theo domain).

### 3.5 UI mới

- Trang `apps/web/src/app/(app)/truck/invoices/page.tsx`: filter bar (tìm theo tên hóa đơn `DebouncedSearchInput` — R7, khoảng thời gian, khu vực — chỉ render `allowedRegions(actor)`, xe, loại hóa đơn) + bảng (STT/Ngày/Khu vực/Phương tiện/Loại hóa đơn/Tên hóa đơn/Cập nhật bởi/Action) + phân trang.
- Action "Xem" mở `AttachmentLightbox` đã có sẵn; "Tải về" dùng link signed-URL có sẵn trong cùng component — **không cần component UI mới**.
- Nav item mới `truckInvoices` (`href: '/truck/invoices'`, `section: 'data'`, `roles: STAFF`, `fleet: 'TRUCK'`) vào [nav-items.ts](../../apps/web/src/components/layout/nav-items.ts) — lấp đúng section "Dữ liệu" đã dự phòng sẵn nhưng chưa dùng.
- Form "Hóa đơn xăng dầu tháng" ([fuel-invoice-panel.tsx](../../apps/web/src/app/(app)/truck/pnl/_components/fuel-invoice-panel.tsx)) — thêm `AttachmentInput` optional để đính kèm ảnh hóa đơn khi tạo/sửa.

---

## 4. Gap Analysis

### 4.1 Bảng phạm vi thay đổi

| Khu vực | Hiện tại | Thay đổi | Ảnh hưởng |
|---|---|---|---|
| DB schema | 3 bảng attachment không có người upload; fuel-invoice không có file | +3 cột `*_uploaded_by`; +1 bảng `car_truck_fuel_invoice_attachments` | Thấp — cột nullable, bảng mới độc lập |
| Query | Không có endpoint hợp nhất | +`truck-invoice.queries.ts` (4 sub-query + merge) | Mới |
| Action | Fuel-invoice action không nhận attachment | Sửa `truck-finance.actions.ts` — nhận thêm `attachments?: AttachmentMetaDto[]` | Trung bình — vẫn optional, không phá luồng cũ |
| Upload route | 3 route, thiếu route cho fuel-invoice | +1 route `api/v1/truck/fuel-invoices/upload-presigned` | Mới, mirror 3 route cũ |
| UI | Không có màn tổng hợp | +`truck/invoices/page.tsx`; sửa `fuel-invoice-panel.tsx` thêm input optional | Mới + sửa nhỏ |
| Nav | Section "data" trống | +1 nav item `truckInvoices` | Thấp |
| i18n | — | +`screens.truckInvoices.*`, `nav.truckInvoices`, nhãn loại hóa đơn hợp nhất (tái dùng tối đa `receiptsSection.*`) | Thấp |
| Migration tooling | — | Thêm probe `0035` vào `scripts/check-manual-migrations.mjs` (bắt buộc — xem FIX-260914, tiền lệ 0026/0030 quên áp staging gây 500) | Thấp nhưng **bắt buộc** trước deploy |

### 4.2 File dự kiến thay đổi/tạo

**DB (sửa — thêm cột):**
- `packages/db/src/schema/trip-cost-attachment.schema.ts` — `tcaUploadedBy`
- `packages/db/src/schema/truck-maintenance.schema.ts` — `tmaUploadedBy`
- `packages/db/src/schema/expenses.schema.ts` — `eatUploadedBy`

**DB (mới):**
- `packages/db/src/schema/truck-fuel-invoice.schema.ts` — thêm export `carTruckFuelInvoiceAttachments` (cùng file, mirror pattern `truck-maintenance.schema.ts`)
- `packages/db/src/schema/index.ts` — export thêm
- `packages/db/migrations/0035_truck_invoice_module.sql` — thủ công, idempotent (ALTER 3 bảng + CREATE bảng mới + backfill `*_uploaded_by` từ S3 key)
- `scripts/check-manual-migrations.mjs` — thêm probe cho `0035`

**Shared/Zod (mới):**
- `packages/shared/src/zod/truck-invoice.zod.ts` — filter input, `TruckInvoiceSource`, mapping nhãn loại hóa đơn (§3.3)

**Backend (mới):**
- `apps/web/src/app/api/v1/truck/fuel-invoices/upload-presigned/route.ts`
- `apps/web/src/server/queries/truck-invoice.queries.ts`

**Backend (sửa):**
- `apps/web/src/server/actions/settings/truck-finance.actions.ts` — `addInvoice` nhận thêm attachments optional
- `apps/web/src/server/actions/maintenance/truck-maintenance.actions.ts`, `apps/web/src/server/actions/expenses/expense.actions.ts`, trip cost-attachment write path (trong truck trip action) — set `*_uploaded_by = actor.userId` khi tạo mới

**FE (mới):**
- `apps/web/src/app/(app)/truck/invoices/page.tsx`
- `apps/web/src/app/(app)/truck/invoices/_components/*` (filter bar, table row nếu cần tách)

**FE (sửa):**
- `apps/web/src/components/layout/nav-items.ts` — thêm `truckInvoices`
- `apps/web/src/app/(app)/truck/pnl/_components/fuel-invoice-panel.tsx` — thêm `AttachmentInput` optional

**i18n:** `apps/web/messages/{vi,en,ko}.json` — `screens.truckInvoices.*`, `nav.truckInvoices`, nhãn loại hóa đơn hợp nhất.

### 4.3 DB Migration Strategy

- Dev: `drizzle-kit push` (schema mới đồng bộ tự động cho cột/bảng thêm).
- Staging/Production: chạy tay `0035_truck_invoice_module.sql` (theo pattern 0026/0033 hiện có — KHÔNG vào drizzle journal).
- Backfill `*_uploaded_by`: parse segment thứ 3 của `s3_key` (`{entId}/{resource}/{userId}/...` → `split_part(s3_key,'/',3)`), validate đúng dạng UUID trước khi set — khớp userId thật vì route ghi `actor.userId` vào đúng vị trí này (xem §2.1). Không khớp được → để NULL, UI hiện "—".
- **Bắt buộc**: cập nhật `scripts/check-manual-migrations.mjs` + chạy probe trên staging TRƯỚC khi deploy build đọc bảng/cột mới (tiền lệ FIX-260914 — 0026/0030 quên áp từng gây 500 production).

---

## 5. User Flow

### 5.1 Admin/Manager xem tổng hợp hóa đơn

```
ADMIN/MANAGER vào /truck/invoices (nav "Hóa đơn" trong section Dữ liệu)
  └─ Server component gọi getTruckInvoices(actor, filters)
       ├─ requireFleet(actor, 'TRUCK')          (đã bọc sẵn ở truck/layout.tsx)
       ├─ resolveRegionAccess(actor)             → giới hạn khu vực nếu bị thu hẹp
       └─ 4 sub-query (trip-cost / maintenance / expense-TRUCK-only / fuel-invoice)
            → merge + sort theo Ngày giảm dần + paginate
  └─ Bảng hiện: STT/Ngày/Khu vực/Phương tiện/Loại hóa đơn/Tên hóa đơn/Cập nhật bởi/Action
  └─ Đổi filter (thời gian/khu vực/xe/loại) → query lại, dropdown khu vực chỉ có
     khu vực được phép (giống 6 màn khác)
  └─ Bấm "Xem" → AttachmentLightbox mở file (ảnh/PDF) full-screen
  └─ Bấm "Tải về" → download qua signed URL có sẵn
```

### 5.2 MANAGER bị thu hẹp khu vực (kế thừa REQ-20260813)

```
Manager chỉ được gán khu vực HCM vào /truck/invoices
  └─ resolveRegionAccess = ['HCM']
  └─ Cả 4 nguồn dữ liệu đều lọc chỉ còn khu vực HCM (không riêng dropdown —
     data thật cũng bị lọc, tránh lộ khu vực khác qua param URL)
```

### 5.3 Nhập hóa đơn xăng dầu tháng kèm ảnh (optional, R4)

```
Admin/Manager vào Tài chính → tab "Hóa đơn & Chốt tháng" → thêm hóa đơn xăng dầu
  └─ Nhập trạm/lít/giá (như hiện tại) + (optional) đính kèm 1..n ảnh/PDF
  └─ addInvoice({...}, attachments?) → INSERT car_truck_fuel_invoices
       + INSERT car_truck_fuel_invoice_attachments (nếu có file)
  └─ Hóa đơn này giờ xuất hiện trong /truck/invoices với Action Xem/Tải về
     (không có file → Action ẩn hoặc disabled, không lỗi)
```

---

## 6. Ràng buộc Kỹ thuật

1. **neon-http không có interactive transaction** — action `addInvoice` mở rộng: insert ledger row trước, insert attachment rows sau (forgiving order, mirror nguyên tắc REQ-20260617 §7); nếu attachment insert fail giữa chừng, ledger row vẫn hợp lệ (file thiếu không phải lỗi nghiệp vụ vì R4 là optional).
2. **Performance**: 4 sub-query + merge/paginate trong application code — chấp nhận được ở quy mô hiện tại (mỗi tenant vài trăm~vài nghìn bản ghi/tháng). Không cần view/bảng tổng hợp vật lý ở giai đoạn này; revisit nếu dữ liệu lớn hơn nhiều.
3. **Bảo mật**: signed URL download dùng TTL hiện có (`S3_PRESIGN_EXPIRY_SECONDS`), không đổi. Không lộ dữ liệu khu vực bị thu hẹp qua query-param (áp dụng đúng nguyên tắc đã có ở 6 màn TRUCK khác).
4. **Tương thích ngược**: `*_uploaded_by` nullable — dữ liệu cũ không parse được từ S3 key vẫn hoạt động (hiện "—"), không cần chặn hay báo lỗi.
5. **i18n**: 3 ngôn ngữ vi/en/ko, tái dùng tối đa `receiptsSection.*` đã có cho 7 loại chi phí chuyến; thêm nhãn mới cho Bảo trì/Hóa đơn xăng dầu/hậu tố phân biệt nguồn Expense.
6. **Migration tooling**: bắt buộc thêm probe `0035` vào `scripts/check-manual-migrations.mjs` và chạy trên staging trước deploy (tiền lệ FIX-260914).
7. **Không phá luồng hiện có**: form fuel-invoice, trip cost, maintenance, expense giữ nguyên hành vi — attachment/uploaded_by là bổ sung thuần túy (additive), không đổi API contract cũ (`attachments` optional ở `addInvoice`).

---

## 7. Quyết định đã chốt (Decision Log)

| # | Quyết định | Nguồn |
|---|---|---|
| D1 | Màn Hóa đơn là **tổng hợp, read-only** — không có luồng thêm/sửa/xóa hóa đơn độc lập ngoài 4 nghiệp vụ gốc | Xác nhận user 2026-09-21 |
| D2 | Thêm `*_uploaded_by` cho 3 bảng attachment hiện có; backfill best-effort từ S3 key cho dữ liệu cũ | Xác nhận user 2026-09-21 |
| D3 | Bổ sung khả năng đính kèm file cho hóa đơn xăng dầu tháng — **optional**, bảng con mới `car_truck_fuel_invoice_attachments` (không phải cột inline) để đồng nhất shape với 2 bảng attachment TRUCK khác | Xác nhận user 2026-09-21 (bảng con vs. cột inline: đề xuất Claude cho nhất quán) |
| D4 | Phạm vi **TRUCK only** — expense attachment phải filter tường minh qua `cvh_type='TRUCK'` vì bảng đó dùng chung CAR+TRUCK | Xác nhận user 2026-09-21 |
| D5 | Đã re-audit toàn bộ điểm upload hóa đơn trong app — xác nhận đúng 4 nguồn (3 route hiện có + fuel-invoice mới), không có nguồn thứ 5 nào bị bỏ sót | Xác nhận user 2026-09-21 (yêu cầu rà soát lại) |
| D6 | "Ngày" hiển thị/filter = ngày phát sinh nghiệp vụ gốc (trip/bảo trì/expense/hóa đơn xăng dầu), KHÔNG phải ngày upload file | Đề xuất Claude (mặc định hợp lý — có thể điều chỉnh trước khi code nếu khách muốn khác) |
| D7 | Taxonomy "Loại hóa đơn" giữ nhãn theo nguồn (không gộp cứng khi trùng tên) — thêm hậu tố phân biệt khi cần (§3.3) | Đề xuất Claude (mặc định hợp lý) |
| D8 | Hóa đơn xăng dầu tháng KHÔNG có file → **không xuất hiện** trong danh sách Hóa đơn (khác với đặc tả ban đầu ở R2 phần "row vẫn hiện, action ẩn") | Phát hiện + chốt lại khi verify sống 2026-09-21 — màn này về bản chất liệt kê **chứng từ** (1 row = 1 file), khớp với 3 nguồn khác vốn đã 1:1 với attachment; hiện 1 row rỗng tên/action cho 1 ledger-entry-chưa-có-file gây khó hiểu hơn là hữu ích. Ledger vẫn đầy đủ, không mất thông tin — chỉ không lặp lại ở màn Hóa đơn khi chưa có file thật |

D6/D7/D8 là mặc định của Claude khi user chưa có ý kiến cụ thể — nêu rõ ở đây để dễ điều chỉnh, không chặn tiến độ.

→ Sẵn sàng chuyển sang **Work Plan** (`docs/plan/PLN-20260921-truck-invoice-module.md`).
