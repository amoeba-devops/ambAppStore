# RPT-20260709 — Đính kèm hóa đơn/biên lai cho chi phí chuyến đi (Truck)

> REQ: [REQ-20260709](../analysis/REQ-20260709-truck-trip-cost-receipt-upload.md) · PLAN: [PLAN-20260709](../plan/PLAN-20260709-truck-trip-cost-receipt-upload.md) · TC: [TC-20260709](../test/TC-20260709-truck-trip-cost-receipt-upload.md)

## 1. Tóm tắt

Cho phép đính kèm hóa đơn/biên lai/chứng từ (ảnh + PDF, nhiều file, tùy chọn) cho 3 loại chi phí chuyến đi truck: **nhiên liệu (FUEL)**, **cầu đường (TOLL)**, **phí phát sinh (EXTRA)**. Có ở cả form Manager (tạo/sửa) và form Driver (hoàn thành chuyến). Xoá = soft-delete (giữ audit). Offline → nút đính kèm bị vô hiệu. Không chạm module Expense của car.

## 2. Quyết định thiết kế quan trọng (khác so với REQ ban đầu)

| Điểm | REQ ban đầu | Thực tế triển khai | Lý do |
|---|---|---|---|
| Liên kết attachment ↔ extra cost | FK `tca_extra_cost_id` → `car_trip_extra_costs.tec_id` | **Bỏ FK**, chỉ tag `tca_cost_kind` (FUEL/TOLL/EXTRA) ở cấp trip | `car_trip_extra_costs` bị **delete+reinsert** mỗi lần sửa/hoàn thành ([truck-trip.service.ts:241,332](../../packages/core/src/truck/truck-trip.service.ts)) → FK theo tec_id sẽ orphan mỗi lần lưu. Gom theo bucket sống sót qua mọi lần sửa, vẫn giữ đúng "chứng từ thuộc khoản chi phí nào". |
| Ngữ nghĩa reconcile | array = tập mong muốn | `undefined` = "không đụng", array (kể cả rỗng) = tập mong muốn đầy đủ (rỗng = xoá hết) | Bảo vệ chống caller không quản lý attachment vô tình xoá sạch. Cả 2 form đều gửi full array. |

## 3. Files thay đổi

**Backend / shared / db (7)**
| File | Loại |
|---|---|
| [apps/web/src/lib/env.ts](../../apps/web/src/lib/env.ts) | Sửa — thêm `TRUCK_S3_MAX_UPLOAD_BYTES` + `getTruckUploadMaxBytes()` |
| [packages/shared/src/zod/truck-trip.zod.ts](../../packages/shared/src/zod/truck-trip.zod.ts) | Sửa — `tripCostAttachmentSchema`, hằng số 50MB/10-file, `cost_attachments` vào create/update/complete |
| [packages/db/src/schema/trip-cost-attachment.schema.ts](../../packages/db/src/schema/trip-cost-attachment.schema.ts) | Mới — bảng `car_trip_cost_attachments` (soft-delete) |
| [packages/db/src/schema/index.ts](../../packages/db/src/schema/index.ts) | Sửa — export schema mới |
| [packages/db/migrations/0022_trip_cost_attachments.sql](../../packages/db/migrations/0022_trip_cost_attachments.sql) | Mới — SQL idempotent, **áp thủ công** |
| [packages/core/src/truck/truck-cost-attachment.ts](../../packages/core/src/truck/truck-cost-attachment.ts) | Mới — `syncTripCostAttachments` (diff theo s3_key), `getTripCostAttachments` |
| [packages/core/src/truck/index.ts](../../packages/core/src/truck/index.ts) | Sửa — export |
| [apps/web/src/app/api/v1/truck/trips/upload-presigned/route.ts](../../apps/web/src/app/api/v1/truck/trips/upload-presigned/route.ts) | Mới — presign S3 riêng cho truck |
| [apps/web/src/server/actions/trips/truck-trip.actions.ts](../../apps/web/src/server/actions/trips/truck-trip.actions.ts) | Sửa — `maybeSyncAttachments` trong create/update/complete/driverComplete |
| [apps/web/src/server/queries/truck-trips.queries.ts](../../apps/web/src/server/queries/truck-trips.queries.ts) | Sửa — `getTripCostAttachmentsView` (ký signed GET URL) |

**Frontend (6)**
| File | Loại |
|---|---|
| [apps/web/src/lib/truck-cost-upload.ts](../../apps/web/src/lib/truck-cost-upload.ts) | Mới — client helper presign→PUT |
| [apps/web/src/components/truck/cost-receipt-input.tsx](../../apps/web/src/components/truck/cost-receipt-input.tsx) | Mới — input ảnh+PDF, multi-file, offline-disable |
| [apps/web/src/app/(app)/truck/trips/_components/truck-trip-form.tsx](../../apps/web/src/app/(app)/truck/trips/_components/truck-trip-form.tsx) | Sửa — 3 bucket state + upload on submit + render |
| [apps/web/src/app/(app)/trips/[id]/_components/truck-complete-section.tsx](../../apps/web/src/app/(app)/trips/[id]/_components/truck-complete-section.tsx) | Sửa — quản lý existing + upload + render |
| [apps/web/src/app/(app)/trips/[id]/_components/truck-trip-detail.tsx](../../apps/web/src/app/(app)/trips/[id]/_components/truck-trip-detail.tsx) | Sửa — card hiển thị chứng từ (read-only) |
| [apps/web/src/app/(app)/truck/trips/[id]/edit/page.tsx](../../apps/web/src/app/(app)/truck/trips/[id]/edit/page.tsx) + [truck/trips/[id]/page.tsx](../../apps/web/src/app/(app)/truck/trips/[id]/page.tsx) + [trips/[id]/page.tsx](../../apps/web/src/app/(app)/trips/[id]/page.tsx) | Sửa — load + truyền attachments |

**i18n (3)**: `messages/{vi,en,ko}.json` — namespace `truckCostReceipt` + keys `screens.truckTrips.form.*` + `screens.truckTripDetail.*`.
**Env**: `.env.example` — `TRUCK_S3_MAX_UPLOAD_BYTES=52428800`.

## 4. Kiểm thử đã chạy

| Hạng mục | Kết quả |
|---|---|
| `tsc --noEmit` web app | ✅ 0 lỗi |
| `tsc --noEmit` packages shared/core/db | ✅ 0 lỗi |
| JSON parse vi/en/ko | ✅ hợp lệ |
| **E2E Playwright** ([truck-trip-receipt-upload.spec.ts](../../apps/web/e2e/truck-trip-receipt-upload.spec.ts)) | ✅ **4/4 PASS** (52s) |

**E2E chi tiết** (chromium, dev :3001, S3 mock để không ghi bucket thật, dữ liệu test dọn sạch):
1. Trường đính kèm hiển thị + nhận ảnh & PDF (thumbnail) — PASS
2. Ngoại tuyến vô hiệu hóa nút đính kèm — PASS
3. Trang chi tiết hiển thị chứng từ nhóm theo chi phí — PASS
4. Tạo chuyến kèm chứng từ → ghi dòng `car_trip_cost_attachments` (write path) — PASS

**Bug phát hiện & sửa trong lúc chạy E2E**: `cost-receipt-input.tsx` lưu object-URL preview vào `useRef` + set trong effect → không re-render → thumbnail ảnh không hiện. Sửa sang `useMemo` (URL có ngay trong render đầu). Không ảnh hưởng module car (component riêng của truck).

**PDF báo cáo** (ảnh chụp E2E + highlight phần đã implement): `C:\tmp\REQ-20260709-truck-receipt-upload.pdf`.

> Xác minh trực quan qua preview MCP không khả dụng ("skeleton wedge" [[reference_preview_skeleton_wedge]]) — nhưng Playwright chạy chromium riêng, hydrate bình thường, nên đã chụp được ảnh thật từ E2E.

## 5. Việc cần làm trước khi lên staging/prod

1. ✅ **Migration `0022`** đã áp trên **LOCAL (ep-steep-tooth) + STAGING (ep-noisy-heart)** ngày 2026-07-09 (verified). Còn **PRODUCTION** thì áp khi deploy prod.
2. **Set env** `TRUCK_S3_MAX_UPLOAD_BYTES=52428800` trên staging/prod (`.env` server). Thiếu → fallback code 50MB.
3. **AWS S3** phải cấu hình (đã có sẵn cho Expense) — dùng chung bucket, prefix key `{entId}/trips/...`.
4. Test theo TC-20260709 (TC1–TC16), đặc biệt TC3 (không đính kèm → hành vi cũ), TC9 (soft-delete), TC11 (Expense không bị ảnh hưởng).
5. **Code chưa push** — cần commit + push `staging-car-truck` để staging server (Render) build & deploy code dùng bảng này.
