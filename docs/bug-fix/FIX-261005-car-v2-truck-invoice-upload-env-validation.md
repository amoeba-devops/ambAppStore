# FIX-261005 — app-car-manager-v2: Upload hóa đơn truck thất bại do env validation

## 1. Triệu chứng
- Trên `apps.amoeba.site/app-car-manager-v2`, upload file hóa đơn / chứng từ ở module Truck (trip cost, maintenance, fuel invoice) báo lỗi, không tạo được presigned URL.
- Log container `next-car-manager-v2`:
```
[env] invalid environment variables: {
  RESEND_API_KEY: [ 'String must contain at least 1 character(s)' ],
  EMAIL_REPLY_TO: [ 'Invalid email' ],
  APP_URL: [ 'String must contain at least 1 character(s)' ]
}
[truck upload-presigned] unexpected error: Error: Invalid environment configuration — see server logs
```

## 2. Nguyên nhân gốc
- `apps/web/src/app/api/v1/truck/trips/upload-presigned/route.ts` gọi `getEnv()` (lấy `S3_PRESIGN_EXPIRY_SECONDS`).
- `apps/web/src/lib/env.ts` validate toàn bộ `process.env` bằng Zod; lỗi ở **bất kỳ** key nào cũng ném exception → route trả 500.
- Các key `APP_URL`, `RESEND_API_KEY`, `EMAIL_REPLY_TO` khai báo `.optional()`, nhưng Zod `.optional()` chỉ chấp nhận `undefined`, **không chấp nhận chuỗi rỗng**.
- `.env` trên server có 3 dòng `APP_URL=`, `RESEND_API_KEY=`, `EMAIL_REPLY_TO=` để trống. Docker `env_file` inject chúng vào container dưới dạng `""` → validate fail.
- AWS S3 config đầy đủ; S3 không liên quan. Code `env.ts` không đổi từ 2026-07-16, `.env` không đổi từ 2026-08-12 → lỗi tồn tại từ trước, không do build lại ngày 2026-10-05.

## 3. Nội dung sửa (đã áp trên server apps.amoeba.site, 2026-10-05)
File: `apps/app-car-manager-v2/.env` (backup: `.env.bak-20261005`)
| Key | Trước | Sau |
|---|---|---|
| `APP_URL` | `` (rỗng) | `https://apps.amoeba.site` |
| `RESEND_API_KEY` | `` (rỗng) | comment out (unset) |
| `EMAIL_REPLY_TO` | `` (rỗng) | comment out (unset) |

Restart: `bash platform/scripts/deploy-staging.sh restart car-manager-v2` (không cần rebuild — biến runtime).

## 4. Kiểm chứng
- Container env: `APP_URL=https://apps.amoeba.site`, `RESEND_API_KEY`/`EMAIL_REPLY_TO` unset.
- Health `GET /app-car-manager-v2/api/v1/health` → `status: ok`.
- `POST /truck/trips/upload-presigned` không auth → 307 (redirect login), không còn 500.
- Log sau restart không còn dòng `[env] invalid environment variables`.
- Rà toàn bộ key trong schema `env.ts` so với `.env`: không còn key nào rỗng hoặc sai format.
- Chưa test upload thật qua UI (cần phiên đăng nhập AMA) → người dùng xác nhận.

## 5. Tái phát / Việc còn lại
1. **Hardening code (đã làm, branch `fix/car-v2-env-empty-string-optional`):** `env.ts` thêm `stripEmptyValues()` lọc mọi giá trị rỗng/whitespace khỏi `process.env` trước `safeParse`, nên dòng `KEY=` rỗng được coi là "chưa cấu hình" đúng như `.optional()` mong đợi; giá trị sai format vẫn bị từ chối. Đã verify: zod behaviour test (3 key rỗng PASS, email sai vẫn FAIL), `tsc --noEmit` OK, `next lint` OK. `.env.example` ghi chú blank là hợp lệ. Sau khi merge `main` cần rebuild image v2 (code thay đổi).
2. Áp cùng 3 thay đổi `.env` cho mọi môi trường khác chạy v2 bằng Docker `env_file` (staging) nếu `.env` ở đó cũng có key rỗng.
3. Quy tắc `.env`: **không để `KEY=` rỗng** cho các key optional có rule Zod — comment dòng đó thay vì để trống. Thêm ghi chú này vào `.env.example`.
4. `CRON_SECRET` hiện vẫn là giá trị placeholder (`replac…`) — nên thay bằng secret thật.

## 6. File thay đổi
- `apps/app-car-manager-v2/.env` (server, không trong git)
- `apps/app-car-manager-v2/apps/web/src/lib/env.ts` (sửa — stripEmptyValues trước safeParse)
- `apps/app-car-manager-v2/.env.example` (sửa — ghi chú)
- `docs/bug-fix/FIX-261005-car-v2-truck-invoice-upload-env-validation.md` (mới)
