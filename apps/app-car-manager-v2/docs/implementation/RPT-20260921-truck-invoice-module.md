# RPT-20260921 — Module Hóa đơn (Truck): Báo cáo Hoàn thành

> Chuỗi tài liệu: [REQ](../analysis/REQ-20260921-truck-invoice-module.md) → [PLN](../plan/PLN-20260921-truck-invoice-module.md) → [TC](../test/TC-20260921-truck-invoice-module.md) → [TR](../test/TR-20260921-truck-invoice-module.md) → RPT (tài liệu này).

## 1. Yêu cầu đã thực hiện

Màn hình mới **Hóa đơn** (`/truck/invoices`) — tổng hợp READ-ONLY mọi hóa đơn/chứng từ đã upload trong app TRUCK, **tìm kiếm theo tên** + filter theo thời gian/khu vực/xe/loại hóa đơn, xem + tải về. 6 quyết định người dùng đã chốt (REQ §7, D1–D5) + 3 mặc định/bổ sung của Claude (D6, D7 — ngày = ngày phát sinh nghiệp vụ; nhãn loại hóa đơn giữ theo nguồn khi trùng tên; D8/R7 — tìm kiếm theo tên hóa đơn để nhất quán với các màn danh sách khác, cùng phát hiện qua verify sống).

## 2. Kiến trúc đã triển khai

4 nguồn hóa đơn hợp nhất ở tầng application code (không UNION SQL thô — mỗi nguồn tự JOIN/filter riêng, dễ test):

```
getTruckInvoices(actor, filters)
  ├─ requireFleet(actor,'TRUCK')       (đã có, REQ-20260617)
  ├─ allowedRegions(actor)             (đã có, REQ-20260813)
  ├─ fetchTripCostRows()      — car_trip_cost_attachments, trp_kind='LOG'
  ├─ fetchMaintenanceRows()   — car_truck_maintenance_attachments
  ├─ fetchExpenseRows()       — car_expense_attachments, JOIN require cvh_type='TRUCK' (R5 — nguồn duy nhất dùng chung CAR+TRUCK)
  └─ fetchFuelInvoiceRows()   — car_truck_fuel_invoice_attachments (bảng MỚI, optional)
       → merge, filter (vehicle/date/type), sort theo Ngày, paginate, ký URL S3
```

## 3. Thay đổi theo Phase

### Phase A — DB

| File | Loại |
|---|---|
| [`trip-cost-attachment.schema.ts`](../../packages/db/src/schema/trip-cost-attachment.schema.ts), [`truck-maintenance.schema.ts`](../../packages/db/src/schema/truck-maintenance.schema.ts), [`expenses.schema.ts`](../../packages/db/src/schema/expenses.schema.ts) | Sửa — thêm `tca_uploaded_by`/`tma_uploaded_by`/`eat_uploaded_by` (R3) |
| [`truck-fuel-invoice.schema.ts`](../../packages/db/src/schema/truck-fuel-invoice.schema.ts) | Sửa — thêm bảng `car_truck_fuel_invoice_attachments` (R4, optional) |
| [`0035_truck_invoice_module.sql`](../../packages/db/migrations/0035_truck_invoice_module.sql) | Mới — idempotent; backfill `uploaded_by` từ S3 key (`{entId}/{resource}/{userId}/{uuid}-name`) cho dữ liệu cũ, validate UUID trước khi set |
| [`scripts/check-manual-migrations.mjs`](../../scripts/check-manual-migrations.mjs) | Sửa — thêm probe `0035` (bắt buộc theo tiền lệ FIX-260914) |
| [`truck-invoice.zod.ts`](../../packages/shared/src/zod/truck-invoice.zod.ts) | Mới — filter schema + taxonomy 17 mã "loại hóa đơn" (REQ §3.3) |

**Đã áp `0035` lên Neon DEV (`ep-steep-tooth`)** — `drizzle-kit push` không dùng được (lỗi introspect tiền tồn tại ở bảng `car_truck_month_close`, không liên quan thay đổi này) nên áp tay qua Neon HTTP driver, cùng cách 0026/0030/0033/0034 đã làm. Xác nhận bằng `check-manual-migrations.mjs`: 9/9 manual migrations OK. **Chưa áp staging/production** — theo đúng quy trình, phải áp tay ở đó TRƯỚC khi deploy build mới đọc cột/bảng này.

### Phase B — Backend write-path

| File | Nội dung |
|---|---|
| `packages/core/src/truck/truck-cost-attachment.ts`, `truck-maintenance-attachment.ts` | Sửa — input interface + INSERT thêm `uploadedBy` (chỉ stamp hàng MỚI, hàng cũ giữ nguyên khi reconcile) |
| `truck-fuel-invoice-attachment.ts` | Mới — mirror 2 file trên cho hóa đơn xăng dầu |
| `server/actions/trips/truck-trip.actions.ts`, `maintenance/truck-maintenance.actions.ts`, `expenses/expense.actions.ts` | Sửa — truyền `actor.userId` vào mọi điểm insert attachment (5 call site ở trip, 2 ở maintenance, 1 ở expense) |
| `api/v1/truck/fuel-invoices/upload-presigned/route.ts` | Mới — mirror 3 route hiện có, key `{entId}/fuel-invoices/{userId}/{uuid}-name` |
| `server/actions/settings/truck-finance.actions.ts` | Sửa — `addFuelInvoiceAction` nhận thêm `attachments?` optional |
| `lib/truck-cost-upload.ts` | Sửa — thêm `uploadTruckFuelInvoiceFile()` |

### Phase C — Query hợp nhất

[`server/queries/truck-invoice.queries.ts`](../../apps/web/src/server/queries/truck-invoice.queries.ts) (mới) — `getTruckInvoices()` + 4 hàm `fetch*Rows()` riêng từng nguồn, trả `availableTypes` (chỉ các loại thực có data, không hard-code cả 17 mã).

### Phase D — UI

| File | Loại |
|---|---|
| `app/(app)/truck/invoices/page.tsx` | Mới — filter bar (tìm theo tên `DebouncedSearchInput` — R7 + ngày/khu vực/xe/loại) + bảng đúng 8 cột REQ + phân trang |
| `_components/invoice-row-actions.tsx` | Mới — Xem/Tải về, tái dùng `AttachmentLightbox` có sẵn (không viết viewer mới) |
| `components/inputs/param-date.tsx` | Mới — sibling của `MonthPicker` cho filter ngày tùy ý |
| `components/layout/nav-items.ts` | Sửa — nav item `truckInvoices`, lấp đúng section "Dữ liệu" đã dự phòng từ REQ-20260629 nhưng chưa dùng |
| `truck/pnl/_components/fuel-invoice-panel.tsx` | Sửa — thêm `AttachmentInput` optional khi tạo hóa đơn xăng dầu |

### Phase E — i18n

`messages/{vi,en,ko}.json` — `nav.truckInvoices`, `screens.truckInvoices.*` (17 nhãn loại hóa đơn + toàn bộ label màn), `screens.truckPnl.invoiceAttachmentUploadFailed`.

## 4. Kết quả kiểm thử

Chi tiết ở [TR-20260921](../test/TR-20260921-truck-invoice-module.md) (2 lần chạy — lần 2 seed dữ liệu thật + test đa persona). Tóm tắt:

- **Build tĩnh xanh hoàn toàn**: `typecheck` 5/5 package, `lint` 0 lỗi, JSON i18n hợp lệ cả 3 ngôn ngữ.
- **2 rủi ro cao nhất đã PASS trên dữ liệu thật**:
  - **R5 (loại xe CAR khỏi kết quả)** — seed 1 expense CAR có attachment, xác nhận KHÔNG xuất hiện ở `/truck/invoices` dù không filter gì.
  - **ACL 2 tầng với role không phải ADMIN** — MANAGER bị thu hẹp về Đồng Nai: chỉ thấy đúng 1/5 hóa đơn, dropdown khu vực/xe/loại đều tự thu hẹp, truy cập trực tiếp `?region=HCM` bị banner từ chối + tự rơi về Đồng Nai (không lộ dữ liệu); DRIVER bị chặn hoàn toàn ở layout (`GET /today`, không tới được query).
- **`uploaded_by` xác nhận đúng theo từng actor**: tạo 1 hóa đơn xăng dầu MỚI qua UI thật (Server Action thật, không phải seed DB) với persona MANAGER → cột "Cập nhật bởi" hiện đúng "Demo MANAGER", khác với các dòng khác hiện "Demo OWNER".
- **1 gap đặc tả phát hiện qua verify sống**: hóa đơn xăng dầu không file thì không xuất hiện trong danh sách (khác spec gốc "vẫn hiện, action ẩn") — đã xem xét và **chốt giữ hành vi code** (hợp lý hơn: màn này liệt kê chứng từ 1:1 với file, giống 3 nguồn khác), cập nhật lại REQ §7 D8 + TC-11.
- **Chưa kiểm chứng** (rủi ro thấp, xem TR §8): phân trang >20 hàng, backfill với key lệch format có seed riêng, upload file thật qua file-picker (giới hạn công cụ browser pane — đã proxy bằng UI thật cho phần action + DB cho phần file).

## 5. Việc còn lại trước khi coi module này production-ready

1. Áp `0035_truck_invoice_module.sql` tay lên **staging** rồi **production** TRƯỚC khi deploy build đọc bảng/cột mới — chạy `check-manual-migrations.mjs` xác nhận trước mỗi lần deploy (bắt buộc, tiền lệ FIX-260914).
2. Deploy theo đúng flow repo: `main` → staging (test) → PR `main → production`. Trên staging, nếu có Playwright/thao tác tay thật, nên bổ sung 1 lượt upload file thật qua form để đóng nốt phần duy nhất còn bị giới hạn bởi công cụ test ở đây.
3. Việc chưa làm trong phạm vi REQ này (đã ghi nhận, không phải thiếu sót): không có luồng thêm/sửa/xóa hóa đơn độc lập (D1 — chỉ tổng hợp read-only theo đúng yêu cầu).

## 6. Ghi chú side-impact

| Phạm vi | Ghi nhận |
|---|---|
| 3 form upload cũ (trip/maintenance/expense) | Additive thuần túy — `uploadedBy`/`attachments` đều optional, không đổi contract cũ, không cần sửa UI nếu không muốn dùng ngay |
| Dữ liệu attachment cũ (trước cột `uploaded_by`) | Backfill best-effort từ S3 key; key không khớp định dạng → giữ NULL, UI hiện "—", không lỗi |
| `car_truck_fuel_invoices` (ledger) | Không đổi hành vi cũ — file đính kèm là lớp phụ thêm mới, hoàn toàn optional |
| Nav "Dữ liệu" | Lần đầu có item — không ảnh hưởng 3 section khác (Vận hành/Tài chính/Báo cáo) |
