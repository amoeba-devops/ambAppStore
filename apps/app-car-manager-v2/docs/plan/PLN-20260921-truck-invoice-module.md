# PLN-20260921 — Truck: Module Hóa đơn (Invoice Aggregation)

> Kèm [REQ-20260921-truck-invoice-module.md](../analysis/REQ-20260921-truck-invoice-module.md). Màn **tổng hợp, read-only** 4 nguồn hóa đơn (chi phí chuyến / bảo trì / expense TRUCK-only / hóa đơn xăng dầu). Thêm `*_uploaded_by` cho 3 bảng attachment hiện có + bảng attachment mới (optional) cho hóa đơn xăng dầu. Scope TRUCK only.

## 1. Hiện trạng phát triển

- Stack: Next 15 App Router + Drizzle/Neon, standalone Turborepo (`apps/app-car-manager-v2`).
- 3 nguồn attachment hiện có, cùng shape, viết qua **service layer thuần** (`packages/core/src/truck/*`, không import `next/*`):
  - Trip cost: `syncTripCostAttachments(entId, tripId, desired)` — [truck-cost-attachment.ts](../../packages/core/src/truck/truck-cost-attachment.ts), gọi từ [truck-trip.actions.ts:135](../../apps/web/src/server/actions/trips/truck-trip.actions.ts#L135).
  - Maintenance: `syncMaintenanceAttachments(entId, maintenanceId, desired)` — [truck-maintenance-attachment.ts](../../packages/core/src/truck/truck-maintenance-attachment.ts), gọi từ [truck-maintenance.actions.ts:138,202](../../apps/web/src/server/actions/maintenance/truck-maintenance.actions.ts#L138).
  - Expense: viết trực tiếp trong [expense.actions.ts](../../apps/web/src/server/actions/expenses/expense.actions.ts) (không có service riêng ở `packages/core`).
- Cả 3 diff-theo-S3-key (INSERT file mới / soft-delete file bị bỏ) — pattern "post FULL desired set, server tự diff" — **giữ nguyên pattern này**, chỉ thêm field `uploadedBy` vào input interface.
- Fuel-invoice ledger: `addInvoice` action trong [truck-finance.actions.ts](../../apps/web/src/server/actions/settings/truck-finance.actions.ts), form [fuel-invoice-panel.tsx](../../apps/web/src/app/(app)/truck/pnl/_components/fuel-invoice-panel.tsx) — KHÔNG có attachment, cần thêm mới hoàn toàn (route + core service + input UI).
- ACL 2 tầng tái dùng nguyên trạng: `requireFleet('TRUCK')` ([fleet-access.ts](../../apps/web/src/lib/auth/fleet-access.ts)) đã bọc sẵn ở [truck/layout.tsx](../../apps/web/src/app/(app)/truck/layout.tsx); `resolveRegionAccess`/`allowedRegions` ([region-access.ts](../../apps/web/src/lib/auth/region-access.ts), REQ-20260813).
- Migration mới nhất hiện tại: `0034_truck_trip_fixed_cost_types.sql` → migration kế tiếp `0035_truck_invoice_module.sql`.
- Migration journal lệch (drizzle journal chỉ tới 0007, còn lại áp tay) — theo đúng pattern hiện có, không đổi. **Bắt buộc** thêm probe vào [scripts/check-manual-migrations.mjs](../../scripts/check-manual-migrations.mjs) (tiền lệ FIX-260914: 0026/0030 quên áp staging → 500 production).
- Nav: `NavSection = 'data'` đã định nghĩa ở [nav-items.ts:52](../../apps/web/src/components/layout/nav-items.ts#L52) nhưng chưa có item nào — dùng đúng slot này.

## 2. Kế hoạch theo Phase

### Phase A — DB (schema + migration + tooling)

- **A1** Thêm cột vào 3 schema hiện có:
  - `packages/db/src/schema/trip-cost-attachment.schema.ts` — `tcaUploadedBy: char('tca_uploaded_by', {length:36})`
  - `packages/db/src/schema/truck-maintenance.schema.ts` — `tmaUploadedBy: char('tma_uploaded_by', {length:36})`
  - `packages/db/src/schema/expenses.schema.ts` — `eatUploadedBy: char('eat_uploaded_by', {length:36})`
  - └─ Side-impact: cột nullable, không ảnh hưởng code đọc hiện có (Drizzle select thêm field mới tự động là optional ở type).
- **A2** Bảng mới `carTruckFuelInvoiceAttachments` — thêm vào cuối [truck-fuel-invoice.schema.ts](../../packages/db/src/schema/truck-fuel-invoice.schema.ts) (mirror `carTruckMaintenanceAttachments`): `tfa_id` PK, `ent_id`, `tfi_id` FK → `car_truck_fuel_invoices.tfi_id`, `tfa_s3_key/mime/size_bytes/file_name/uploaded_by/uploaded_at/deleted_at`. Index `(ent_id, tfi_id)`.
  - └─ Side-impact: bảng mới độc lập, không đụng bảng cũ.
- **A3** `packages/db/src/schema/index.ts` — export thêm `carTruckFuelInvoiceAttachments`.
- **A4** Migration thủ công `packages/db/migrations/0035_truck_invoice_module.sql` (idempotent — xem §5 draft): `ALTER ... ADD COLUMN IF NOT EXISTS` ×3, `CREATE TABLE IF NOT EXISTS` + FK + index cho bảng mới, backfill `*_uploaded_by` từ S3 key (regex UUID) cho 3 bảng cũ.
  - └─ Side-impact: backfill chỉ khớp được key đúng layout `{entId}/{resource}/{userId}/{uuid}-name` — key cũ/lệch format giữ NULL, không lỗi.
- **A5** `scripts/check-manual-migrations.mjs` — thêm probe `0035_truck_invoice_module.sql` (`hasColumn('car_trip_cost_attachments','tca_uploaded_by')` + `hasTable('car_truck_fuel_invoice_attachments')`).
  - └─ Side-impact: **bắt buộc** — quên bước này thì staging/prod có thể 500 khi deploy build đọc cột/bảng mới mà chưa áp SQL (đúng sự cố FIX-260914).
- **A6** Zod mới `packages/shared/src/zod/truck-invoice.zod.ts`:
  - `truckInvoiceSourceSchema = z.enum(['TRIP_COST','MAINTENANCE','EXPENSE','FUEL_INVOICE'])`
  - `truckInvoiceFilterSchema` — `{ from?, to?, region?, vehicleId?, type? , page? }`
  - Mapping nhãn "Loại hóa đơn" theo (source, subtype) — bảng ở REQ §3.3, dùng chung cho query + i18n key lookup.

### Phase B — Backend: set `uploaded_by` khi upload mới + fuel-invoice attachment (optional)

- **B1** `TripCostAttachmentInput` (`truck-cost-attachment.ts`) — thêm `uploadedBy?: string | null`; `syncTripCostAttachments` set `tcaUploadedBy` khi INSERT (không set lại cho row untouched). Caller `truck-trip.actions.ts:135` truyền `actor.userId`.
- **B2** `MaintenanceAttachmentInput` (`truck-maintenance-attachment.ts`) — tương tự, `tmaUploadedBy`; caller `truck-maintenance.actions.ts:138,202` truyền `actor.userId`.
- **B3** `expense.actions.ts` — set `eatUploadedBy: actor.userId` tại điểm insert `carExpenseAttachments` hiện có.
- **B4** Route mới `apps/web/src/app/api/v1/truck/fuel-invoices/upload-presigned/route.ts` — mirror 3 route hiện có (cùng `ATTACHMENT_CONTENT_TYPE_RE`, key layout `{entId}/fuel-invoices/{userId}/{uuid}-{filename}`).
- **B5** Core service mới `packages/core/src/truck/truck-fuel-invoice-attachment.ts` — `syncFuelInvoiceAttachments(entId, tfiId, desired)`, cùng pattern diff-theo-S3-key như B1/B2 (bao gồm `uploadedBy`).
- **B6** `truck-finance.actions.ts` — `addInvoice` nhận thêm `attachments?: AttachmentMetaDto[]` (optional — R4), gọi `syncFuelInvoiceAttachments` sau khi insert ledger row. Thứ tự forgiving (ledger trước, attachment sau — neon-http không có transaction).
  - └─ Side-impact chung Phase B: additive thuần túy, không đổi contract cũ của 3 action hiện có (param mới đều optional) — trip/maintenance/expense form không cần sửa nếu chưa muốn hiện UI mới ngay.

### Phase C — Query hợp nhất

- **C1** `apps/web/src/server/queries/truck-invoice.queries.ts` — `getTruckInvoices(actor, filters)`:
  - Gọi `requireFleet(actor,'TRUCK')` (defense-in-depth — layout đã chặn nhưng query nên tự đứng vững).
  - `resolveRegionAccess(actor)` → áp filter khu vực lên cả 4 sub-query (không chỉ dropdown).
  - 4 sub-query độc lập, mỗi cái tự JOIN vehicle (+ user cho `uploadedBy` → `usr_name`):
    - Trip cost: JOIN `car_trips` (lọc `trp_kind='LOG'`) → `car_vehicles` (region).
    - Maintenance: JOIN `car_truck_maintenances` → `car_vehicles`.
    - Expense: JOIN `car_expenses`, resolve vehicle qua `COALESCE(exp_vehicle_id, trip.trp_vehicle_id)`, **require `cvh_type='TRUCK'`** (R5 — nguồn duy nhất cần lọc tường minh vì bảng dùng chung CAR+TRUCK).
    - Fuel invoice: JOIN `car_truck_fuel_invoices` (đã TRUCK-only theo thiết kế) + LEFT JOIN attachment mới.
  - Map cả 4 về 1 shape `TruckInvoiceRow` chung (§3.4 REQ) — set `invoiceTypeLabel` qua bảng mapping ở A6.
  - Merge (concat) → sort theo "Ngày" giảm dần → paginate trong bộ nhớ.
  - └─ Side-impact: nếu quên áp `cvh_type='TRUCK'` ở nhánh Expense → lộ hóa đơn xe CAR (vi phạm R5 trực tiếp) — checklist bắt buộc khi review.

### Phase D — UI

- **D1** `apps/web/src/app/(app)/truck/invoices/page.tsx` — Server Component đọc `searchParams` (q/from/to/region/vehicleId/type/page), gọi `getTruckInvoices`. Filter bar tái dùng pattern từ `truck/reports` hoặc `truck/fleet` (dropdown khu vực chỉ render `allowedRegions(actor)`, giống C-phase REQ-20260813) + `DebouncedSearchInput` (tìm theo Tên hóa đơn, `?q=` — R7, cùng component đã dùng ở `truck/fleet`/`truck/trips`/`truck/finance`/`users`, không cần code mới).
- **D2** Bảng: STT (index theo trang) / Ngày / Khu vực / Phương tiện (plate) / Loại hóa đơn / Tên hóa đơn / Cập nhật bởi (`usr_name`, fallback "—" nếu NULL) / Action.
- **D3** Action "Xem" → tái dùng `AttachmentLightbox`/`AttachmentGrid` ([attachment-viewer.tsx](../../apps/web/src/components/attachments/attachment-viewer.tsx)) — cần 1 endpoint/server action nhỏ trả signed GET URL theo `(source, id)` nếu chưa có sẵn dạng tổng quát (kiểm tra lúc code; các trang hiện tại lấy signed URL theo từng domain riêng — có thể cần 1 hàm `getSignedDownloadUrl(s3Key)` chung trong `s3-client.ts` nếu chưa có).
- **D4** Nav: thêm `truckInvoices` vào [nav-items.ts](../../apps/web/src/components/layout/nav-items.ts) — `{ key:'truckInvoices', href:'/truck/invoices', Icon: Receipt, group:'workspace', section:'data', roles: STAFF, fleet:'TRUCK' }`; cập nhật `NavKey` union + `activeKeyFor` không cần sửa (prefix-match tự hoạt động).
- **D5** `fuel-invoice-panel.tsx` — thêm `AttachmentInput` optional (component input hiện có, cùng họ với `AttachmentGrid`) khi tạo/sửa hóa đơn xăng dầu; submit kèm `attachments` vào `addInvoice`.
  - └─ Side-impact D1-D5: màn mới không đổi hành vi 6 màn TRUCK khác; D5 là sửa nhỏ, optional, không bắt buộc nhập.

### Phase E — i18n

- **E1** `apps/web/messages/{vi,en,ko}.json`:
  - `nav.truckInvoices`
  - `screens.truckInvoices.*` (title, filter labels, table headers, empty state, action labels — tái dùng `attachments.*` cho Xem/Tải về nếu key đã có)
  - Nhãn "Loại hóa đơn" hợp nhất: tái dùng `receiptsSection.*` (7 loại chi phí chuyến) + thêm mới cho Bảo trì / Expense-TRUCK (hậu tố phân biệt nguồn) / Hóa đơn xăng dầu.

### Phase F — Test + docs

- **F1** TC — [docs/test/TC-20260921-truck-invoice-module.md](../test/TC-20260921-truck-invoice-module.md).
- **F2** Verify trên staging (local dev không hydrate ổn định — ghi nhận từ các REQ trước).
- **F3** TR + RPT sau khi test xong.

## 3. Bảng file thay đổi

| Vùng | File | Loại |
|---|---|---|
| DB | `packages/db/src/schema/trip-cost-attachment.schema.ts` | Sửa |
| DB | `packages/db/src/schema/truck-maintenance.schema.ts` | Sửa |
| DB | `packages/db/src/schema/expenses.schema.ts` | Sửa |
| DB | `packages/db/src/schema/truck-fuel-invoice.schema.ts` | Sửa (+bảng attachment mới) |
| DB | `packages/db/src/schema/index.ts` | Sửa |
| DB | `packages/db/migrations/0035_truck_invoice_module.sql` | Mới |
| Tooling | `scripts/check-manual-migrations.mjs` | Sửa |
| Zod | `packages/shared/src/zod/truck-invoice.zod.ts` | Mới |
| Core | `packages/core/src/truck/truck-cost-attachment.ts` | Sửa |
| Core | `packages/core/src/truck/truck-maintenance-attachment.ts` | Sửa |
| Core | `packages/core/src/truck/truck-fuel-invoice-attachment.ts` | Mới |
| Route | `apps/web/src/app/api/v1/truck/fuel-invoices/upload-presigned/route.ts` | Mới |
| Action | `apps/web/src/server/actions/trips/truck-trip.actions.ts` | Sửa (truyền `uploadedBy`) |
| Action | `apps/web/src/server/actions/maintenance/truck-maintenance.actions.ts` | Sửa (truyền `uploadedBy`) |
| Action | `apps/web/src/server/actions/expenses/expense.actions.ts` | Sửa (`eatUploadedBy`) |
| Action | `apps/web/src/server/actions/settings/truck-finance.actions.ts` | Sửa (`addInvoice` + attachments) |
| Query | `apps/web/src/server/queries/truck-invoice.queries.ts` | Mới |
| Lib | `apps/web/src/lib/s3-client.ts` | Sửa (nếu cần hàm signed-URL chung — xác nhận lúc code) |
| UI | `apps/web/src/app/(app)/truck/invoices/page.tsx` | Mới |
| UI | `apps/web/src/app/(app)/truck/invoices/_components/*` | Mới |
| UI | `apps/web/src/app/(app)/truck/pnl/_components/fuel-invoice-panel.tsx` | Sửa |
| Nav | `apps/web/src/components/layout/nav-items.ts` | Sửa |
| i18n | `apps/web/messages/{vi,en,ko}.json` | Sửa |

## 4. Sai số / rủi ro (side-impact)

| Phạm vi | Rủi ro | Giảm thiểu |
|---|---|---|
| Migration staging thiếu | 500 khi đọc cột/bảng mới | `scripts/check-manual-migrations.mjs` probe + chạy TRƯỚC deploy (A5, tiền lệ FIX-260914) |
| Expense attachment lộ dữ liệu CAR | Vi phạm R5 nếu quên `cvh_type='TRUCK'` ở nhánh Expense | Test case riêng (TC) seed cả CAR + TRUCK expense, assert CAR không xuất hiện |
| Backfill `uploaded_by` sai định dạng key cũ | Set nhầm giá trị không phải UUID hợp lệ | Regex chặt `^[0-9a-fA-F]{8}-...{12}$` trước khi UPDATE; không khớp → NULL, không lỗi |
| 2 tầng ACL (fleet + region) quên bọc ở query mới | Lộ dữ liệu khu vực bị thu hẹp | `getTruckInvoices` gọi cả `requireFleet` + `resolveRegionAccess` ngay đầu hàm, không phụ thuộc hoàn toàn vào layout redirect |
| Trùng nhãn "Loại hóa đơn" giữa nguồn (REPAIR ở cả trip-cost và expense) | Dropdown filter gây nhầm "chọn 1 trong 2 nghĩa khác nhau nhưng tên giống" | Hậu tố phân biệt nguồn trong nhãn hiển thị (REQ §3.3) — review lại nhãn cụ thể khi làm i18n |
| `addInvoice` mở rộng tham số | Callers cũ không truyền `attachments` vẫn phải hoạt động y hệt | Param optional, default `[]`, không đổi behavior khi không truyền |
| Trip/maintenance attachment cũ (trước REQ-20260915) không có `file_name` lẫn `uploaded_by` | Hàng cũ hiện "—" ở cả 2 cột thay vì lỗi | Đã là pattern chấp nhận được từ REQ-20260915 (file_name cũng vậy) — nhất quán |

## 5. Migration (draft — chi tiết hoá khi code)

```sql
-- 0035_truck_invoice_module.sql — REQ-20260921 truck-invoice-module
-- (1) Thêm uploaded_by cho 3 bảng attachment hiện có + backfill best-effort từ S3 key.
-- (2) Bảng mới car_truck_fuel_invoice_attachments (optional, 0..n file / hóa đơn xăng dầu).
-- Thủ công (không vào drizzle journal) — idempotent. Nhớ thêm probe vào
-- scripts/check-manual-migrations.mjs.

ALTER TABLE car_trip_cost_attachments
  ADD COLUMN IF NOT EXISTS tca_uploaded_by CHAR(36);
ALTER TABLE car_truck_maintenance_attachments
  ADD COLUMN IF NOT EXISTS tma_uploaded_by CHAR(36);
ALTER TABLE car_expense_attachments
  ADD COLUMN IF NOT EXISTS eat_uploaded_by CHAR(36);

-- Backfill: segment thứ 3 của s3_key `{entId}/{resource}/{userId}/{uuid}-name`
-- là userId thật (route ghi actor.userId vào đúng vị trí này). Validate dạng
-- UUID trước khi set — key lệch format thì để NULL (UI fallback "—").
UPDATE car_trip_cost_attachments t
   SET tca_uploaded_by = split_part(t.tca_s3_key, '/', 3)
 WHERE t.tca_uploaded_by IS NULL
   AND split_part(t.tca_s3_key, '/', 3)
       ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$';

UPDATE car_truck_maintenance_attachments t
   SET tma_uploaded_by = split_part(t.tma_s3_key, '/', 3)
 WHERE t.tma_uploaded_by IS NULL
   AND split_part(t.tma_s3_key, '/', 3)
       ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$';

UPDATE car_expense_attachments t
   SET eat_uploaded_by = split_part(t.eat_s3_key, '/', 3)
 WHERE t.eat_uploaded_by IS NULL
   AND split_part(t.eat_s3_key, '/', 3)
       ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$';

CREATE TABLE IF NOT EXISTS "car_truck_fuel_invoice_attachments" (
  "tfa_id"          char(36) PRIMARY KEY NOT NULL,
  "ent_id"          char(36) NOT NULL,
  "tfi_id"          char(36) NOT NULL,
  "tfa_s3_key"      text NOT NULL,
  "tfa_mime"        varchar(64) NOT NULL,
  "tfa_size_bytes"  bigint NOT NULL,
  "tfa_file_name"   varchar(255),
  "tfa_uploaded_by" char(36),
  "tfa_uploaded_at" timestamptz NOT NULL DEFAULT now(),
  "tfa_deleted_at"  timestamptz
);
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "car_truck_fuel_invoice_attachments"
    ADD CONSTRAINT "car_truck_fuel_invoice_attachments_tfi_id_fk"
    FOREIGN KEY ("tfi_id") REFERENCES "public"."car_truck_fuel_invoices"("tfi_id")
    ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_car_truck_fuel_invoice_attachments_ent_tfi"
  ON "car_truck_fuel_invoice_attachments" USING btree ("ent_id", "tfi_id");
```

Dev: `db:push`. Staging/prod: áp file tay (synchronize tắt) + chạy `check-manual-migrations.mjs` để xác nhận trước deploy.

## 6. Cổng duyệt (User Approval Gate)

**Chưa code.** Theo quy trình chuẩn: cần bạn duyệt PLAN này (hoặc góp ý điều chỉnh phase/scope) → sau đó viết Test Case (`docs/test/TC-20260921-truck-invoice-module.md`) → chờ bạn xác nhận tiếp → mới bắt đầu code theo Phase A→F.
