# RPT-20260915 — Một component đính kèm dùng chung cho toàn hệ thống

> Yêu cầu gốc (2026-09-15): "check các component upload trên hệ thống đều cho phép các định dạng của các file, cho phép mở to, và tải xuống, hiện tên upload" → sau khi rà soát: "tôi muốn làm consistent 1 component cho tất cả, thoả mãn các yêu cầu đã cung cấp".
> Nhánh `feature/shared-attachment-component` (tách từ `staging`). Trạng thái: **code xong, typecheck + lint xanh, migration `0033` đã áp Neon DEV, đã test trên local.** Chưa áp staging/prod, chưa deploy.

## 1. Hiện trạng trước khi sửa

Ba nơi tải tệp, mỗi nơi một kiểu — không nơi nào đủ 4 yêu cầu:

| Nơi | Định dạng | Mở to | Tải xuống | Hiện tên |
|---|---|---|---|---|
| Form chuyến + form bảo trì (`CostReceiptInput`) | ảnh, PDF | ✗ | ✗ | ✗ |
| Chi tiết chuyến (tile tự vẽ) | — | mở tab thô | ✗ | ✗ |
| Form chi phí xe con (`ReceiptCameraInput`) | **chỉ ảnh** | ✗ | ✗ | ✗ |
| Chi tiết chi phí (`AttachmentGallery`) | — | ✓ | ✓ | ✗ |

Gốc rễ của "không hiện tên": **không bảng nào lưu tên tệp gốc** — cả ba chỉ có `s3_key` / `mime` / `size_bytes`.

## 2. Đã làm

### Một hợp đồng
`packages/shared/src/zod/attachment.zod.ts` — nơi DUY NHẤT định nghĩa định dạng cho phép, giới hạn mặc định và `fileNameFromS3Key()` (tách tên từ khoá S3 cho dữ liệu cũ). Ba route presign giờ trỏ vào cùng hằng số này.

**Định dạng**: danh sách trắng gồm ảnh (mọi loại), PDF, Word, Excel, CSV, text. **Không mở hoàn toàn** — đây là kho chứng từ công ty, mở exe/script là rủi ro bảo mật không cần thiết. Muốn nới thêm chỉ sửa một hằng số.

### Hai component dùng chung
- `components/attachments/attachment-viewer.tsx` — `AttachmentGrid` (lưới ô xem trước, **có tên tệp + dung lượng**, bấm mở to, tuỳ chọn nút xoá) và `AttachmentLightbox` (toàn màn hình: tên + đếm + **tải xuống**, prev/next, phím Esc/←/→, vuốt trên mobile, khoá cuộn nền). Tệp không phải ảnh hiện icon theo họ (PDF/bảng tính/văn bản) kèm hai nút "Mở tab mới" và "Tải xuống".
- `components/attachments/attachment-input.tsx` — `AttachmentInput` thay cả `CostReceiptInput` lẫn `ReceiptCameraInput`. Giữ nguyên mọi tính năng tinh vi của luồng tài xế: chụp ảnh trực tiếp (`camera`), chuyển HEIC→JPEG, nhắc khi iOS chặn quyền máy ảnh, overlay tiến trình từng tệp. Tệp đã lưu và tệp mới chọn nằm CHUNG một lưới nên nhìn thống nhất.

### Tên tệp
Migration `0033` thêm `tca_file_name` / `tma_file_name` / `eat_file_name` và **backfill từ `s3_key`** để dữ liệu cũ cũng hiện tên. Tên đi suốt chuỗi: client → action → core → DB → query (có fallback) → UI.

### Dọn dẹp
Xoá `cost-receipt-input.tsx` (~230 dòng) và `receipt-camera-input.tsx` (~420 dòng). `AttachmentGallery` rút từ ~300 dòng còn ~48 dòng, chỉ còn là lớp bọc để 3 nơi gọi không phải đổi.

## 3. File thay đổi

| Phân loại | File | Loại |
|---|---|---|
| Shared | `packages/shared/src/zod/attachment.zod.ts` + `index.ts` | Mới / sửa |
| DB | `packages/db/migrations/0033_attachment_file_name.sql` | Mới |
| DB | `trip-cost-attachment` · `truck-maintenance` · `expenses` schema | Sửa (cột tên) |
| Core | `truck-cost-attachment.ts` · `truck-maintenance-attachment.ts` | Sửa (lưu tên) |
| Component | `components/attachments/attachment-viewer.tsx` · `attachment-input.tsx` | **Mới** |
| Component | `components/truck/cost-receipt-input.tsx` · `expenses/new/_components/receipt-camera-input.tsx` | **Xoá** |
| Component | `expenses/[id]/_components/attachment-gallery.tsx` | Viết lại thành adapter |
| Backend | 3 route `upload-presigned` · `truck-cost-upload.ts` · action chuyến/bảo trì/chi phí · query chuyến/bảo trì/chi phí | Sửa |
| Frontend | form chuyến · form bảo trì · `truck-complete-section` · form chi phí · chi tiết chuyến · 3 nơi build `AttachmentItem` | Sửa |
| i18n | `messages/{vi,en,ko}.json` — namespace `attachments` (21 khoá) | Sửa |
| Script | `check-manual-migrations.mjs` | Sửa (probe `0033`) |

## 4. Kiểm thử trên local (2026-09-15)

| Hạng mục | Kết quả |
|---|---|
| `npm run typecheck` (5 gói) · `npm run lint` | ✅ xanh |
| Migration `0033` trên DEV, chạy 2 lần | ✅ idempotent; backfill 3/3 dòng bảo trì có tên; checker 7/7 |
| **Hiện tên** — form bảo trì | ✅ "hoadon-test.pdf", "hoa-don-garage-truong-hai.pdf" + dung lượng dưới mỗi ô |
| **Mở to** — bấm ô xem trước | ✅ lightbox: tên + "69 B · 1/2" + nút đóng + mũi tên trái/phải |
| **Tải xuống** | ✅ nút tải ở góc phải + nút "Tải xuống" giữa màn cho tệp không phải ảnh |
| **Định dạng** | ✅ docx / xlsx / csv / txt / jpg đều 200; **exe bị từ chối 400** |
| Chế độ chụp ảnh (chi phí xe con) | ✅ còn nút "Chụp ảnh" + "Chọn tệp" |
| Hồi quy 16 màn (truck + car) | ✅ 200 toàn bộ, không lỗi runtime |

## 5. Chưa làm

1. Áp `0033` lên **staging** rồi **production** TRƯỚC khi deploy build này.
2. Push nhánh + tạo PR.
3. Khoá i18n cũ `truckCostReceipt` và `expenses.submit.*` liên quan input đã thành mồ côi — vô hại, dọn sau.
4. Dọn tệp S3 mồ côi vẫn là nợ chung, chưa có janitor.
