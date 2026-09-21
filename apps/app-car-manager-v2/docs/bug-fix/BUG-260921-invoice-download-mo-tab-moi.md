# BUG-260921 — Nút "Tải xuống" ở Hóa đơn mở tab mới thay vì tải file về

## 1. Triệu chứng

Màn **Xe tải → Hóa đơn** (`/truck/invoices`). Bấm icon ⬇ **Tải xuống** ở một dòng hóa đơn →
trình duyệt **mở tab mới hiển thị file** (PDF render inline, ảnh hiện trên tab) chứ **không tải
file về máy**. Người dùng phải bấm tiếp nút Save của trình duyệt mới có file.

Cùng triệu chứng ở nút "Tải xuống" trong lightbox xem chứng từ (chi phí, chuyến xe tải, bảo dưỡng) —
cùng một component.

## 2. Nguyên nhân

Nút tải là thẻ `<a>` trỏ thẳng vào **presigned URL của S3**:

```tsx
// invoice-row-actions.tsx (trước khi sửa)
<a href={item.url} download={item.name} target="_blank" rel="noopener noreferrer">
```

Hai điểm cộng lại thành lỗi:

1. **`download` bị trình duyệt bỏ qua khi href khác origin.** Theo HTML spec, thuộc tính `download`
   chỉ có hiệu lực với same-origin (hoặc `blob:`/`data:`). Ở đây app chạy ở
   `localhost:3001` / `apps.amoeba.site` còn file nằm ở
   `ama-car-manager.s3.ap-southeast-1.amazonaws.com` → attribute bị vô hiệu hoàn toàn.
2. **URL được ký không có `Content-Disposition`.** `getSignedGetUrl(key, 900)` ký URL "xem"
   (giữ nguyên `Content-Type: application/pdf`), nên S3 trả file ở chế độ inline.

Kết quả: `<a>` trở thành một link điều hướng bình thường, `target="_blank"` mở tab mới, S3 trả
inline → **trình duyệt hiển thị file thay vì tải**.

Chỗ duy nhất trong app tải đúng từ trước là export báo cáo
(`truck/reports/[id]/download/route.ts`) — vì nó ký kèm `downloadFilename`, tức
`Content-Disposition: attachment`. Cơ chế đã có sẵn, chỉ là màn hóa đơn/lightbox chưa dùng.

## 3. Cách sửa

Tách **hai URL cho cùng một file**, vì hai nhu cầu xung khắc nhau:

| URL | Ký kèm | Dùng cho |
|---|---|---|
| `signedUrl` | (không) → inline | `<img>`, "Mở tab mới", preview PDF |
| `downloadUrl` | `Content-Disposition: attachment; filename*=UTF-8''…` | nút Tải xuống |

- Thêm helper `getSignedUrlPair(key, fileName, expiresIn)` ở `lib/s3-client.ts` — ký cả hai trong
  một lần gọi (ký là HMAC cục bộ, không gọi mạng, nên rẻ).
- `AttachmentViewItem` / `StoredAttachment` / `AttachmentItem` nhận thêm field tùy chọn
  `downloadUrl`; nút tải dùng `downloadUrl ?? url` (file đang chọn chưa upload vẫn dùng `blob:`
  same-origin — `download` hoạt động bình thường).
- **Bỏ `target="_blank"` ở nút tải.** Với `Content-Disposition: attachment`, điều hướng cùng tab
  không rời trang mà chỉ kích hoạt tải; giữ `_blank` sẽ nháy một tab rỗng vô nghĩa.
  Nút "Mở tab mới" vẫn giữ `target="_blank"` + URL inline như cũ.
- Các query trả chứng từ (`truck-invoice`, `truck-trips`, `truck-maintenance`) và 3 trang chi phí
  đổi sang `getSignedUrlPair`, dùng luôn fallback tên file `eatFileName ?? fileNameFromS3Key(...)`
  để bản ghi cũ (chưa lưu tên) vẫn tải về có tên tử tế.

## 4. File thay đổi

| # | File | Sửa gì |
|---|---|---|
| 1 | `apps/web/src/lib/s3-client.ts` | + `getSignedUrlPair()` |
| 2 | `apps/web/src/components/attachments/attachment-viewer.tsx` | + `downloadUrl` vào `AttachmentViewItem`; 2 nút tải dùng URL attachment, bỏ `target="_blank"` |
| 3 | `apps/web/src/app/(app)/truck/invoices/_components/invoice-row-actions.tsx` | nút ⬇ dùng `downloadUrl`, bỏ `target="_blank"` |
| 4 | `apps/web/src/app/(app)/truck/invoices/page.tsx` | truyền `downloadUrl` (mobile + desktop) |
| 5 | `apps/web/src/server/queries/truck-invoice.queries.ts` | ký cặp URL |
| 6 | `apps/web/src/server/queries/truck-trips.queries.ts` | ký cặp URL |
| 7 | `apps/web/src/server/queries/truck-maintenance.queries.ts` | ký cặp URL |
| 8 | `apps/web/src/components/attachments/attachment-input.tsx` | `StoredAttachment.downloadUrl` → grid |
| 9 | `apps/web/src/app/(app)/expenses/[id]/_components/attachment-gallery.tsx` | `AttachmentItem.downloadUrl` |
| 10 | `apps/web/src/app/(app)/costs/page.tsx`, `expenses/page.tsx`, `expenses/[id]/page.tsx` | ký cặp URL |
| 11 | `trips/[id]/_components/truck-trip-detail.tsx`, `today/truck/[id]/page.tsx` | truyền `downloadUrl` xuống grid |
| 12 | `today/truck/[id]/edit/page.tsx`, `truck/trips/[id]/edit/page.tsx`, `truck-trip-form.tsx`, `truck-complete-section.tsx` | mang `downloadUrl` qua form |

Không đụng DB, không đụng i18n.

## 5. Kiểm chứng (dev, localhost:3001)

1. `tsc --noEmit` — pass.
2. `/truck/invoices`: 4 link tải, **tất cả** đều có `response-content-disposition=attachment`,
   `target` = none, `download` = đúng tên file. Không còn link S3 nào mang `target="_blank"` ở nút tải.
3. `curl -I` vào chính URL của nút tải:
   ```
   HTTP/1.1 200 OK
   Content-Type: application/pdf
   Content-Disposition: attachment; filename="hoadon-test.pdf"; filename*=UTF-8''hoadon-test.pdf
   ```
4. Nút 👁 Xem vẫn mở lightbox bình thường; trong lightbox "Mở tab mới" vẫn dùng URL inline
   (không có disposition), "Tải xuống" dùng URL attachment. Console không có lỗi.

## 6. Chống tái diễn

- **Không bao giờ dựa vào `<a download>` cho href cross-origin.** File nằm ở S3 → bắt buộc phải ký
  `Content-Disposition: attachment` phía server.
- Mọi chỗ mới cần nút tải chứng từ: dùng `getSignedUrlPair()` và truyền `downloadUrl` vào
  `AttachmentViewItem`, đừng ký lại bằng `getSignedGetUrl()` trần.
- Khi test nút tải: chỉ nhìn UI không đủ (tab mới trông cũng "có gì đó xảy ra") — kiểm tra header
  `Content-Disposition` của URL trong href.
