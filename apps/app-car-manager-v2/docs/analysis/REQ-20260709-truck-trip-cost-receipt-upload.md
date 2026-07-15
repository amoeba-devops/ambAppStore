# REQ-20260709 — Đính kèm hóa đơn/biên lai cho chi phí chuyến đi (Truck)

> Nguồn: yêu cầu khách hàng (spreadsheet tracking) — "Lưu hóa đơn, biên lai" — mục "Danh sách chuyến đi".
> Xác nhận với KH: hỗ trợ ảnh **và** PDF.

## 1. Yêu cầu

| # | Yêu cầu | Loại |
|---|---|---|
| R1 | Cho phép đính kèm hóa đơn/biên lai/chứng từ (ảnh + PDF) khi nhập chi phí **nhiên liệu**, **toll**, **extra cost** trên form tạo/sửa chuyến đi | Chức năng |
| R2 | Hỗ trợ cả 1 file và nhiều file cho mỗi dòng chi phí | Chức năng |
| R3 | Đính kèm là **tùy chọn** (optional), không bắt buộc để lưu chi phí | Chức năng |
| R4 | Cả Manager/Admin (tạo/sửa trip) và Driver (complete trip) đều nhập được — trường file thông thường, không phân quyền theo role | Chức năng |
| R5 | Nâng giới hạn dung lượng upload lên 50MB **cho riêng tính năng truck này** — không đổi/ảnh hưởng module Expense của app car (chỉ tham khảo pattern, không sửa code car) | Phi chức năng |

## 2. AS-IS

**Vị trí thực tế**: tính năng truck nằm ở `apps/app-car-manager-v2` (Next.js/Drizzle/S3), không phải app-car-manager cũ.

**Form chi phí chuyến đi** ([truck-trip.zod.ts:39-44](../../packages/shared/src/zod/truck-trip.zod.ts)):
```ts
fuel_liters: z.number().nonnegative().optional();      // scalar trên car_trips, không có attachment
toll_fee: z.number().nonnegative().optional();          // scalar trên car_trips, không có attachment
extra_costs: z.array({ name, amount }).max(50).optional(); // → car_trip_extra_costs (tec_name, tec_amount)
```
Không có cột/field nào cho file ở cả 3 loại chi phí trên. Dùng ở 2 nơi: `truck-trip-form.tsx` (Manager tạo/sửa) và `truck-complete-section.tsx` (Driver complete trip) — cả hai đều cần bổ sung.

**Hạ tầng upload đã có (module Expense, P2 MVP)** — pattern tái dùng được:
- `car_expense_attachments` (1 expense → N attachment): `eat_s3_key`, `eat_mime`, `eat_size_bytes` ([expenses.schema.ts:109](../../packages/db/src/schema/expenses.schema.ts))
- Route `/api/v1/expenses/upload-presigned`: presigned S3 PUT, chấp nhận `image/*` + `application/pdf` + `application/octet-stream` fallback ([route.ts:23](../../apps/web/src/app/api/v1/expenses/upload-presigned/route.ts))
- Rule cứng CLAUDE.md: **không lưu BLOB vào DB, chỉ lưu S3 key**

**Giới hạn dung lượng — 3 nơi, KHÔNG đồng bộ:**
| Nơi | Giá trị | Đọc từ env? |
|---|---|---|
| `.env.example` `S3_MAX_UPLOAD_BYTES` | 10485760 (10MB) | — (đây là nguồn) |
| `upload-presigned/route.ts:62` | đọc `env.S3_MAX_UPLOAD_BYTES` | ✅ có |
| `expense.actions.ts:52` `attachmentSchema.size_bytes` | `.max(10 * 1024 * 1024)` | ❌ **hard-code** |
| `receipt-camera-input.tsx:14` `MAX_BYTES` (client) | `10 * 1024 * 1024` | ❌ **hard-code** |

→ Đây chỉ là quan sát để rút kinh nghiệm khi thiết kế phần mới (tránh lặp lại lỗi "sync thủ công 3 nơi"). **Không nằm trong scope REQ này** — không sửa `expense.actions.ts`/`receipt-camera-input.tsx`/`S3_MAX_UPLOAD_BYTES` của module car Expense. Yêu cầu ban đầu chỉ liên quan chi phí chuyến đi **truck** (`fuel_liters`/`toll_fee`/`car_trip_extra_costs`); app car (module Expense: `car_expenses`, 8 loại chi phí FUEL/OIL/ACCIDENT/MEAL/REPAIR/PARKING/TOLL/INSPECTION) là domain khác, chỉ dùng làm **tham khảo pattern** (cấu trúc attachment 1:N, route presign S3, accept ảnh+PDF).

## 3. TO-BE

| Chi phí | AS-IS | TO-BE |
|---|---|---|
| Nhiên liệu (`fuel_liters`) | scalar trên `car_trips` | + N attachment (FUEL) |
| Toll (`toll_fee`) | scalar trên `car_trips` | + N attachment (TOLL) |
| Extra cost (`car_trip_extra_costs`) | `{name, amount}` | + N attachment / dòng (EXTRA), khớp "Chi phí - Tên chi phí - Đính kèm" |

**DB — bảng mới `car_trip_cost_attachments`** (giống pattern `car_expense_attachments`):
```
tca_id            char(36) PK
ent_id            char(36) NOT NULL
trp_id            char(36) NOT NULL FK -> car_trips.trp_id
tca_cost_kind     enum('FUEL','TOLL','EXTRA') NOT NULL
tca_extra_cost_id char(36) NULL FK -> car_trip_extra_costs.tec_id   -- chỉ set khi cost_kind=EXTRA
tca_s3_key        text NOT NULL
tca_mime          varchar(64) NOT NULL
tca_size_bytes    bigint NOT NULL
tca_uploaded_at   timestamptz DEFAULT now() NOT NULL
tca_deleted_at    timestamptz NULL          -- soft delete: giữ lại phục vụ audit, chỉ ẩn khỏi UI
```
Index: `idx_car_trip_cost_attachments_trip (trp_id)`, `idx_car_trip_cost_attachments_extra (tca_extra_cost_id)`, `idx_car_trip_cost_attachments_ent_trip (ent_id, trp_id)`.

**Route upload mới**: `/api/v1/truck/trips/upload-presigned` (route độc lập, chỉ tham khảo cấu trúc code của route expense — key layout riêng `{entId}/trips/{userId}/{uuid}-{filename}`) — đọc giới hạn từ env riêng `TRUCK_S3_MAX_UPLOAD_BYTES` (mới, default 52428800 = 50MB), **không liên quan `S3_MAX_UPLOAD_BYTES`** của module Expense.

**Zod** (`truck-trip.zod.ts`): thêm shape dùng chung trong file này (không đặt ở packages/shared để tránh vô tình bị import bởi code car)
```ts
const TRUCK_COST_ATTACHMENT_MAX_BYTES = 50 * 1024 * 1024;
const costAttachmentSchema = z.object({ s3_key: z.string().min(1), mime: z.string().min(1).max(64), size_bytes: z.number().int().min(1).max(TRUCK_COST_ATTACHMENT_MAX_BYTES) }).array().max(5);
fuel_attachments?: costAttachmentSchema
toll_attachments?: costAttachmentSchema
extra_costs: [{ name, amount, attachments?: costAttachmentSchema }]
```
Server route đọc `TRUCK_S3_MAX_UPLOAD_BYTES` từ env làm nguồn thật; hằng số client-side trong zod chỉ để validate UX sớm, phải khớp giá trị nhưng là 2 hằng số tách biệt theo đúng pattern hiện có của route expense (client + server tự khai báo riêng).

**UI**: component mới `cost-receipt-input.tsx` — **viết mới cho truck**, chỉ tham khảo cấu trúc UX của `receipt-camera-input.tsx` (accept ảnh+PDF, multi-file, thông báo lỗi) — không import/sửa file đó. Giới hạn 50MB, không giới hạn role. Gắn cạnh field Nhiên liệu, Toll, và trong mỗi dòng Extra cost, ở cả `truck-trip-form.tsx` (Manager) và `truck-complete-section.tsx` (Driver).

**Phạm vi car Expense**: KHÔNG đụng tới `expense.actions.ts`, `receipt-camera-input.tsx`, `S3_MAX_UPLOAD_BYTES`, `.env.example` (dòng car) — những file này chỉ đọc để hiểu pattern, giữ nguyên 100%.

## 4. Gap & phạm vi

| Vùng | Hiện tại | Thay đổi | Ảnh hưởng |
|---|---|---|---|
| DB | không có bảng | + `car_trip_cost_attachments`, migration mới | Thấp (bảng mới, không đụng bảng cũ) |
| Backend zod/action | `fuel_liters/toll_fee/extra_costs` không có file | + `*_attachments` optional + route presign mới | Trung bình |
| Backend Expense (app car) | hard-code 10MB ở 2 nơi | **KHÔNG đổi — ngoài scope**, chỉ tham khảo pattern | Không có (không chạm code) |
| Frontend truck-trip-form | 3 field chi phí không attachment | + input file mỗi dòng | Trung bình |
| Frontend truck-complete-section (Driver) | tương tự | + input file mỗi dòng | Trung bình |
| i18n | — | + key: nút đính kèm, lỗi quá dung lượng/sai định dạng (vi/en/ko) | Thấp |

**Migration**: file mới `packages/db/migrations/00XX_trip_cost_attachments.sql` — chỉ CREATE TABLE + INDEX, không ALTER bảng hiện có → an toàn, không cần backfill.

## 5. User Flow

```
Manager/Driver mở form (tạo/sửa trip HOẶC complete trip)
  └─ Nhập fuel_liters / toll_fee / thêm dòng extra_cost {name, amount}
       └─ [tùy chọn] bấm "Đính kèm" cạnh dòng chi phí
            ├─ Chọn ảnh hoặc PDF (có thể chọn nhiều)
            ├─ > 50MB hoặc sai định dạng → lỗi UI ngay, không gọi server
            ├─ Client gọi POST /api/v1/truck/trips/upload-presigned → PUT trực tiếp S3
            └─ key trả về, gắn vào state form (chưa lưu DB)
  └─ Submit form → server action ghi car_trips/car_trip_extra_costs + car_trip_cost_attachments (theo key đã upload)
       └─ Nếu submit thất bại sau khi đã upload S3 → object orphan (rủi ro đã biết, chấp nhận như module Expense — janitor job riêng, ngoài scope)
Xem chi tiết trip → mỗi dòng chi phí hiển thị (n) file đính kèm (chỉ file chưa xoá), click xem/tải
Sửa trip → thêm attachment tự do; xoá = soft-delete (set tca_deleted_at, giữ row + S3 object cho audit, chỉ ẩn khỏi UI) — không phân quyền theo role
Mất mạng (Driver, PWA) → nút "Đính kèm" bị disable + thông báo "cần mạng để đính kèm" (bản đầu làm đơn giản, chưa hỗ trợ queue offline)
```

## 6. Ràng buộc kỹ thuật

- Không lưu file BLOB vào DB (rule cứng CLAUDE.md) — chỉ S3 key.
- Multi-tenancy: `car_trip_cost_attachments.ent_id` bắt buộc, mọi query qua `withEnt`.
- **Không chạm module Expense của car** (`expense.actions.ts`, `receipt-camera-input.tsx`, `S3_MAX_UPLOAD_BYTES`) — feature này độc lập hoàn toàn về code + env var (`TRUCK_S3_MAX_UPLOAD_BYTES` riêng), tránh mọi rủi ro hồi quy lên production car Expense.
- `S3_PRESIGN_EXPIRY_SECONDS` giữ 300s — file 50MB trên mạng di động chậm cần theo dõi thực tế; nếu lỗi timeout giữa chừng thì tăng TTL là fix riêng, không block REQ này.
- i18n 3 ngôn ngữ bắt buộc cho toàn bộ text mới.
