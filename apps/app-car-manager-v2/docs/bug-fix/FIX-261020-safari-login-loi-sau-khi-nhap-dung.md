# FIX-261020 — Safari: đăng nhập lỗi dù nhập đúng Org ID + email

## Triệu chứng
Trên Safari (iPhone iOS 17/18, Mac), nhập đúng mã DN + email ở `/app-car-manager-v2/login`
→ bấm Đăng nhập → trang lỗi `400 Bad Request` hoặc quay lại form, không vào được app.

## Bằng chứng (nginx `apps.amoeba.site-access.log`, 15/10/2026)
```
POST /app-car-manager-v2/api/auth/login          307   ← login OK, redirect về "/"
POST /app-car-manager-v2/                         400   ← browser RE-POST form body sang trang
POST /app-car-manager-v2/login?error=invalid      400   ← cả nhánh lỗi cũng bị replay POST
```
Mọi request POST sau redirect của `/api/auth/login` đều đến từ iPhone/Mac Safari (WebKit).

## Nguyên nhân
`NextResponse.redirect(url)` mặc định trả **307 Temporary Redirect**. Theo RFC 9110, 307
bắt browser **giữ nguyên method + body** → sau khi form `POST /api/auth/login` thành công,
browser gửi tiếp `POST` (kèm `ent_code`, `email`, `remember`) tới trang `/`.
Trang App Router không nhận POST thường (Next coi là Server Action request không hợp lệ) →
400/500. Safari replay POST nghiêm ngặt nên lỗi lộ rõ; cookie đã được set nhưng user thấy
trang lỗi.

## Sửa
Đổi tất cả redirect trong `POST /api/auth/login` và `/api/auth/logout` sang
**303 See Other** → browser luôn chuyển sang `GET` trang đích, không mang body.

## File thay đổi
- `apps/web/src/app/api/auth/login/route.ts` — 12 redirect → 303 + comment giải thích
- `apps/web/src/app/api/auth/logout/route.ts` — redirect → 303 (logout cũng nhận POST)

## Kiểm chứng sau deploy
- nginx log: `POST .../api/auth/login 303` rồi `GET /app-car-manager-v2/ ...` (không còn `POST /app-car-manager-v2/`)
- Safari iOS: đăng nhập đúng → vào app; sai → `/login?error=invalid` hiển thị message.

## Phòng tái phát
Route Handler nhận form POST rồi redirect sang trang → **luôn truyền status 303**
(`NextResponse.redirect(url, 303)`). Không dùng default 307.
