# RPT-20260914 — Truck Bảo trì: thêm Chú thích + Hoá đơn đính kèm

> Yêu cầu gốc (2026-09-14): "trong form tạo hay edit và detail của phí bảo trì thêm 2 field: (1) Chú thích dạng text, (2) Hóa đơn bảo trì dạng file Đính kèm (multiple), giống với mục đính kèm hóa đơn chứng từ khi tạo chuyến."
> Nhánh: `feature/truck-maintenance-note-attachments` (tách từ `staging` @ `ff9f377`). Trạng thái: **code xong, typecheck + lint xanh, migration `0032` đã áp Neon DEV, đã test đủ luồng trên dev.** Chưa push, chưa áp staging/prod.

## 1. Phạm vi

Bảo trì xe tải (REQ-20260904) có thêm 2 trường **thuần mô tả** — không đụng công thức tiền, không đụng quy tắc chặn chuyến:

| Trường | Kiểu | Ghi chú |
|---|---|---|
| Chú thích | text, ≤ 2000 ký tự | Nội dung sửa chữa, garage, bảo hành… Để trống = NULL |
| Hoá đơn bảo trì | nhiều tệp (ảnh/PDF), ≤ 10 | Dùng LẠI nguyên component + luồng upload của hoá đơn chuyến |

Không có màn "detail" riêng cho bảo trì — trang `/(id)/edit` đóng vai chi tiết, nên 2 trường hiển thị ở đó; danh sách bổ sung cột Chú thích + badge số hoá đơn để nhìn nhanh.

## 2. Thiết kế

- **Tái dùng tối đa**: component `CostReceiptInput` (ảnh/PDF, nhiều tệp, xem trước, xoá) và luồng presign → PUT thẳng S3 y như hoá đơn chuyến, nên trải nghiệm hai màn giống hệt nhau.
- **Bảng riêng** `car_truck_maintenance_attachments` thay vì nhét vào `car_trip_cost_attachments`: bảng kia FK tới `trp_id`. Bảng mới FK thẳng `tmn_id`, **không có cột `cost_kind`** vì một lần bảo trì chỉ có một loại chi phí.
- **Route presign riêng** `/api/v1/truck/maintenance/upload-presigned` (không dùng chung route của chuyến) để tệp nằm dưới tiền tố khoá `{entId}/maintenance/...`, tách bạch cho vòng đời lưu trữ và phạm vi IAM.
- **Hợp đồng đồng bộ tệp** giống chuyến: form gửi TOÀN BỘ tập mong muốn, server so khớp theo S3 key — key mới thì thêm, key thiếu thì **soft delete** (giữ row + object cho kiểm toán). Key trùng với row đã xoá mềm được thêm thành row MỚI, không hồi sinh row cũ, để vết xoá còn nguyên.
- **`attachments` vắng mặt ≠ mảng rỗng**: vắng = caller không quản tệp (giữ nguyên), rỗng = người dùng đã gỡ hết.

## 3. File thay đổi

| Phân loại | File | Loại |
|---|---|---|
| DB | `packages/db/migrations/0032_truck_maintenance_note_attachments.sql` | Mới |
| DB | `packages/db/src/schema/truck-maintenance.schema.ts` (`tmnNote` + bảng `carTruckMaintenanceAttachments`) | Sửa |
| Core | `packages/core/src/truck/truck-maintenance-attachment.ts` (`get` / `sync` / `count`) | Mới |
| Core | `packages/core/src/truck/index.ts` | Sửa (export) |
| Shared | `packages/shared/src/zod/truck-maintenance.zod.ts` (`note`, `attachments`, `TRUCK_MAINTENANCE_ATTACHMENT_MAX`) | Sửa |
| Backend | `apps/web/src/app/api/v1/truck/maintenance/upload-presigned/route.ts` | Mới |
| Backend | `apps/web/src/lib/truck-cost-upload.ts` (`uploadTruckMaintenanceFile`) | Sửa |
| Backend | `apps/web/src/server/actions/maintenance/truck-maintenance.actions.ts` (lưu note + sync tệp + audit) | Sửa |
| Backend | `apps/web/src/server/queries/truck-maintenance.queries.ts` (note, `attachmentCount`, `getTruckMaintenanceAttachmentsView`) | Sửa |
| Frontend | `truck/maintenance/_components/truck-maintenance-form.tsx` (2 field + upload khi submit) | Sửa |
| Frontend | `truck/maintenance/[id]/edit/page.tsx` (nạp note + tệp đã lưu) | Sửa |
| Frontend | `truck/maintenance/page.tsx` (cột Chú thích + badge kẹp giấy, cả bảng và card mobile) | Sửa |
| i18n | `apps/web/messages/{vi,en,ko}.json` (7 khoá) | Sửa |
| Script | `scripts/check-manual-migrations.mjs` (probe cho `0032`) | Sửa |

## 4. Kiểm thử trên dev (2026-09-14)

| Hạng mục | Kết quả |
|---|---|
| `npm run typecheck` (5 gói) · `npm run lint` | ✅ xanh |
| Migration `0032` áp Neon DEV, chạy 2 lần | ✅ idempotent; `check-manual-migrations.mjs dev` → 6/6 ✓ |
| Route presign bảo trì | ✅ trả khoá `{entId}/maintenance/{userId}/{uuid}-{file}`, TTL 300s |
| Upload thật lên S3 (PDF) | ✅ PUT 200 |
| Tạo bản ghi có note + 1 hoá đơn | ✅ row `tmn_note` đúng, 1 row attachment |
| Sửa: đổi note, GIỮ hoá đơn | ✅ live 1 / deleted 0 — tệp không bị đụng |
| Sửa: gỡ hết hoá đơn + xoá note | ✅ note NULL, live 0 / **deleted 1** (soft delete) |
| Sửa: đính kèm lại 2 tệp | ✅ live 2 / deleted 1 (key cũ thành row mới, đúng thiết kế) |
| Danh sách | ✅ cột Chú thích hiện nội dung, badge kẹp giấy "2" |
| Trang sửa (đóng vai detail) | ✅ note trong textarea, 2 thumbnail PDF, nút đính kèm thêm, hint "tối đa 10 tệp" |
| Tổng chi phí bảo trì theo tháng | ✅ không đổi bởi note/tệp (10/2026 = 3.800.000 do sửa `cost`, đúng) |
| i18n | ✅ đủ 7 khoá × vi/en/ko |

## 5. Chưa làm

1. Áp `0032` lên **staging** (`ep-noisy-heart`) và **production** trước khi deploy build có 2 trường này — nếu không, màn Bảo trì sẽ 500 vì thiếu cột/bảng (đúng bài học FIX-260914). Chạy `node scripts/check-manual-migrations.mjs staging|prod` để xác nhận.
2. Push nhánh + tạo PR.
3. Dọn tệp S3 mồ côi (tải lên nhưng không lưu) vẫn là nợ chung với chuyến/expense — chưa có janitor.

## 6. Dữ liệu để lại trên dev

Bản ghi bảo trì 29C-99999 ngày 05–06/10/2026, chi phí 3.800.000, có chú thích và 2 hoá đơn PDF mẫu.
