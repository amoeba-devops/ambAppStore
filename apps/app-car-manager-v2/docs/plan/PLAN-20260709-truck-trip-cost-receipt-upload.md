# PLAN-20260709 — Đính kèm hóa đơn/biên lai cho chi phí chuyến đi (Truck)

> REQ: [REQ-20260709-truck-trip-cost-receipt-upload](../analysis/REQ-20260709-truck-trip-cost-receipt-upload.md)

## 1. Hiện trạng hệ thống (tóm tắt — chi tiết ở REQ §2)

- Next.js 15 App Router + Drizzle + Neon Postgres + S3 (presigned PUT).
- Pattern attachment đã kiểm chứng ở module Expense (`car_expense_attachments` + `/api/v1/expenses/upload-presigned`), nhưng giới hạn dung lượng bị hard-code lệch ở 2 nơi (`expense.actions.ts`, `receipt-camera-input.tsx`).
- Truck trip cost (`fuel_liters`, `toll_fee`, `car_trip_extra_costs`) chưa có khái niệm attachment.

## 2. Kế hoạch triển khai theo Phase

### Phase 1 — Định nghĩa giới hạn dung lượng riêng cho Truck (50MB) [làm trước, vì Phase 2/3 phụ thuộc]
> Không chạm module Expense của car (`expense.actions.ts`, `receipt-camera-input.tsx`, `S3_MAX_UPLOAD_BYTES`) — chỉ đọc để tham khảo pattern. Đây là feature độc lập, dùng env var riêng để không phụ thuộc/ảnh hưởng config car.
- **Step 1.1**: Thêm env mới `TRUCK_S3_MAX_UPLOAD_BYTES` vào `.env.example` (default `52428800` = 50MB) + đọc trong `env.ts` (key mới, không sửa `S3_MAX_UPLOAD_BYTES` hiện có).
  └─ Sida impact: chỉ thêm biến mới, `S3_MAX_UPLOAD_BYTES`/module Expense không đổi.
- **Step 1.2**: Khai báo hằng số client-side `TRUCK_COST_ATTACHMENT_MAX_BYTES = 50 * 1024 * 1024` trực tiếp trong `truck-trip.zod.ts` và `cost-receipt-input.tsx` (không đặt ở packages/shared để tránh vô tình bị code car import).
  └─ Sida impact: không có — file/hằng số mới, phạm vi truck only.

### Phase 2 — DB schema
- **Step 2.1**: Thêm Drizzle schema `packages/db/src/schema/trip-cost-attachment.schema.ts` — bảng `car_trip_cost_attachments` (định nghĩa ở REQ §3).
  └─ Sida impact: bảng mới, không ALTER bảng cũ → an toàn.
- **Step 2.2**: Migration SQL `packages/db/migrations/00XX_trip_cost_attachments.sql` (CREATE TABLE + 3 index). Chạy `drizzle-kit generate` rồi review trước khi apply.
  └─ Sida impact: chạy trên Neon branch dev trước, sau đó staging/production theo quy trình migration thủ công của repo.

### Phase 3 — Backend (route + zod + actions)
- **Step 3.1**: Route mới `apps/web/src/app/api/v1/truck/trips/upload-presigned/route.ts` — tham khảo cấu trúc route expense (không import/gọi lại), đổi key prefix `{entId}/trips/{userId}/{uuid}-{filename}`, đọc `TRUCK_S3_MAX_UPLOAD_BYTES` riêng.
  └─ Sida impact: route độc lập, không đụng route expense.
- **Step 3.2**: `truck-trip.zod.ts` — thêm `costAttachmentSchema` dùng chung; mở rộng `createTruckTripSchema`, `updateTruckTripSchema`, `completeTruckTripSchema` với `fuel_attachments?`, `toll_attachments?`, và `extra_costs[].attachments?` (tất cả optional, max 5 file/dòng).
  └─ Sida impact: field mới optional → không phá payload cũ (backward compatible).
- **Step 3.3**: `truck-trip.actions.ts` (create/update/complete) — sau khi ghi `car_trips`/`car_trip_extra_costs`, ghi kèm rows mới `car_trip_cost_attachments` (INSERT only) tương ứng theo `tca_cost_kind`. Khi update/edit: attachment mới gửi lên → INSERT thêm; attachment bị bỏ khỏi state form → UPDATE `tca_deleted_at = now()` (soft-delete, **không** xoá cứng, **không** xoá S3 object).
  └─ Sida impact: đổi luồng ghi của 3 action chính (create/update/complete) — rủi ro cao nhất trong PR này, cần test kỹ cả trường hợp KHÔNG có attachment (regression cho toàn bộ trip hiện có).
- **Step 3.4**: Query đọc (`truck-trips.queries.ts`) — JOIN thêm `car_trip_cost_attachments WHERE tca_deleted_at IS NULL` khi lấy chi tiết trip, group theo `cost_kind`/`extra_cost_id`.
  └─ Sida impact: query trip-detail hiện có — thêm JOIN, kiểm tra không N+1/không chậm với trip nhiều extra_costs.

### Phase 4 — Frontend
- **Step 4.1**: Component mới `apps/web/src/app/(app)/truck/trips/_components/cost-receipt-input.tsx` — generalize từ `receipt-camera-input.tsx` (accept ảnh+PDF, multi-file, MAX_UPLOAD_BYTES, không có logic role-gate).
  └─ Sida impact: component mới, không sửa component Expense cũ.
- **Step 4.2**: `truck-trip-form.tsx` (Manager tạo/sửa) — gắn `cost-receipt-input` cạnh Nhiên liệu, Toll, và trong mỗi row extra-cost.
  └─ Sida impact: form đang chạy — thêm field UI, giữ nguyên field cũ, test lại toàn bộ submit flow (create + edit).
- **Step 4.3**: `truck-complete-section.tsx` (Driver complete trip) — tương tự Step 4.2. Bổ sung: disable nút "Đính kèm" khi `navigator.onLine === false` (hoặc tương đương), tooltip/toast "cần mạng để đính kèm" — bản đầu làm đơn giản, **không** implement queue/background sync khi offline.
  └─ Sida impact: form driver-facing PWA, test trên mobile viewport + camera capture (giống receipt-camera-input đã làm cho Expense) + test riêng trạng thái offline.
- **Step 4.4**: Trip detail view — hiển thị danh sách attachment/dòng chi phí (view/download), theo pattern `attachment-gallery.tsx` (Expense) generalize hoặc tái dùng trực tiếp nếu props đủ chung.
  └─ Sida impact: màn trip detail hiện có, thêm section mới không phá layout cũ.

### Phase 5 — i18n
- **Step 5.1**: Thêm key vào `messages/{vi,en,ko}.json`: nút "Đính kèm", label "Hóa đơn/biên lai", lỗi quá dung lượng (50MB), lỗi sai định dạng, số file đã đính kèm.
  └─ Sida impact: chỉ thêm key, không sửa key cũ.

## 3. Danh sách file thay đổi

| Khu vực | File | Loại |
|---|---|---|
| Shared | `packages/shared/src/zod/truck-trip.zod.ts` | Sửa |
| Backend | `apps/web/src/lib/env.ts` (thêm `TRUCK_S3_MAX_UPLOAD_BYTES`) | Sửa |
| Backend | `apps/web/src/app/api/v1/truck/trips/upload-presigned/route.ts` | Mới |
| Backend | `apps/web/src/server/actions/trips/truck-trip.actions.ts` | Sửa |
| Backend | `apps/web/src/server/queries/truck-trips.queries.ts` | Sửa |
| DB | `packages/db/src/schema/trip-cost-attachment.schema.ts` | Mới |
| DB | `packages/db/migrations/00XX_trip_cost_attachments.sql` | Mới |
| Frontend | `apps/web/src/app/(app)/truck/trips/_components/cost-receipt-input.tsx` | Mới |
| Frontend | `apps/web/src/app/(app)/truck/trips/_components/truck-trip-form.tsx` | Sửa |
| Frontend | `apps/web/src/app/(app)/trips/[id]/_components/truck-complete-section.tsx` | Sửa |
| Frontend | trip detail view (component hiện có hiển thị chi phí) | Sửa |
| i18n | `apps/web/messages/{vi,en,ko}.json` | Sửa |
| Env | `.env.example` | Sửa |

## 4. Phân tích sida impact

| Phạm vi | Rủi ro | Giải thích |
|---|---|---|
| Module Expense (app car) | Không có | Ngoài scope hoàn toàn — không có file nào của Expense bị sửa, chỉ dùng làm tham khảo pattern khi thiết kế |
| `truck-trip.actions.ts` create/update/complete | **Trung bình-cao** | Đổi luồng ghi chính của trip — test kỹ case KHÔNG đính kèm gì (phải y hệt hành vi cũ) |
| DB | Thấp | Chỉ thêm bảng mới, không ALTER bảng hiện có |
| UI Manager/Driver form | Trung bình | Thêm field UI, không đổi field cũ |
| PWA offline (Driver) | Thấp-trung bình | Upload cần mạng — cần xử lý UX khi driver offline chọn file (queue hay disable nút?) — **cần xác nhận thêm với KH nếu driver hay complete trip offline** |

## 5. DB Migration

Thủ công theo quy trình repo (staging/production không dùng `synchronize`):
```sql
CREATE TABLE "car_trip_cost_attachments" (
  tca_id CHAR(36) PRIMARY KEY,
  ent_id CHAR(36) NOT NULL,
  trp_id CHAR(36) NOT NULL REFERENCES car_trips(trp_id),
  tca_cost_kind VARCHAR(10) NOT NULL, -- FUEL|TOLL|EXTRA
  tca_extra_cost_id CHAR(36) REFERENCES car_trip_extra_costs(tec_id),
  tca_s3_key TEXT NOT NULL,
  tca_mime VARCHAR(64) NOT NULL,
  tca_size_bytes BIGINT NOT NULL,
  tca_uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  tca_deleted_at TIMESTAMPTZ NULL
);
CREATE INDEX idx_car_trip_cost_attachments_trip ON car_trip_cost_attachments (trp_id);
CREATE INDEX idx_car_trip_cost_attachments_extra ON car_trip_cost_attachments (tca_extra_cost_id);
CREATE INDEX idx_car_trip_cost_attachments_ent_trip ON car_trip_cost_attachments (ent_id, trp_id);
```
Áp dụng Neon dev branch trước ([[reference_truck_db_branches]] — `ep-steep-tooth`=local, `ep-noisy-heart`=staging-car-truck), verify, rồi mới apply staging.
