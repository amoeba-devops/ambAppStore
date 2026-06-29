# BUG-260629 — sales-report-v2 "Session expired" (lệch hợp đồng JWT với AMA)

## 증상 (Triệu chứng)
Truy cập app từ AMA → trang **"Session expired — Please reopen this app from AMA Management to continue."** (`/session-expired`). Entity FIRGI · Sales Ops.

## 원인 분석 (Phân tích nguyên nhân)
KHÁC bug `not_installed` của car-manager — activation (eca row) OK; lỗi nằm ở tầng **verify token**.

AMA `iframe-token.service.ts` mint payload:
```
{ sub, email, role, entityId, scope, appId, appCode }   // camelCase, KHÔNG iss/aud
```
(`JwtModule` của AMA chỉ set `expiresIn`, không set issuer/audience.)

Nhưng sales-report-v2 verify sai hợp đồng:
- `verify-jwt.ts` gọi `jwtVerify(token, secret, { issuer:'amb-management', audience:'sales-report-v2' })` → jose reject vì token không có `iss`/`aud`.
- `jwt-claims.ts` (zod) yêu cầu `ent_id`, `app_code='sales-report-v2'`, `iss`, `aud` (snake/literal) — trong khi AMA gửi `entityId`, `appCode` (camelCase), không iss/aud.
- role enum thiếu `ADMIN/SUPER_ADMIN/VIEWER` (AMA có thể gửi).

→ Mọi token fail verify → không set được cookie hợp lệ → middleware redirect `/session-expired`.

**car-manager-v2 đã sửa đúng lớp này** (xem comment trong `car-manager-v2/.../verify-jwt.ts`: "AMA does not include iss/aud"). sales-report-v2 chưa được port.

`JWT_SECRET` giống hệt nhau cả 3 nơi (AMA prod, car-v2, sales-v2) → KHÔNG phải lỗi secret.

## 수정 내용 (Nội dung sửa)
Port hợp đồng auth của car-manager-v2 sang sales-report-v2:
- `packages/shared/src/auth/jwt-claims.ts` — schema nhận payload thật của AMA (`entityId`/`appCode` camelCase, `appCode` chấp nhận cả `app-sales-report-v2` lẫn `sales-report-v2`, role enum rộng, không iss/aud), transform → snake_case `ent_id`/`app_code`. `mapAmaRoleToLocal` phủ thêm ADMIN/SUPER_ADMIN/VIEWER.
- `apps/web/src/lib/auth/verify-jwt.ts` — bỏ `{ issuer, audience }` khỏi `jwtVerify`.
- `apps/web/src/app/dev-login/route.ts` — mint token theo shape AMA (`entityId`/`appCode`, bỏ setIssuer/setAudience) để dev-login đi đúng verify path.

Gộp kèm bản vá basePath redirect đang dở (để `/session-expired` & redirect sau verify không bị bật về platform catalog):
- `apps/web/src/middleware.ts` — dùng `req.nextUrl.clone()` (giữ basePath) khi strip `ama_token`.
- `apps/web/src/lib/request-origin.ts` — `absoluteUrl()` tự prepend `BASE_PATH`.

## 변경 파일 (File thay đổi)
- `apps/app-sales-report-v2/packages/shared/src/auth/jwt-claims.ts`
- `apps/app-sales-report-v2/apps/web/src/lib/auth/verify-jwt.ts`
- `apps/app-sales-report-v2/apps/web/src/app/dev-login/route.ts`
- `apps/app-sales-report-v2/apps/web/src/middleware.ts`
- `apps/app-sales-report-v2/apps/web/src/lib/request-origin.ts`

## 테스트 / 배포 (Test / Deploy)
- Verify đầy đủ ở `next build` (host không có node toolchain).
- Rebuild + restart container `next-sales-report-v2` qua compose riêng (`BASE_PATH=/app-sales-report-v2`, NEXT_PUBLIC_* inline lúc build).
- Sau deploy: mở app từ AMA (FIRGI) → vào được dashboard, không còn /session-expired.

## 재발 방지 (Phòng tái phát)
- Mọi app v2 embed phải dùng **chung 1 hợp đồng JWT của AMA** (camelCase, không iss/aud, appCode = eca_code). Cân nhắc đưa `verify-jwt` + `jwt-claims` thành package chia sẻ chung thay vì copy mỗi app.
- ⚠️ Security follow-up: `JWT_SECRET` prod đang dùng một giá trị đặt tên kiểu "staging", chia sẻ chung cho tất cả app — nên rotate sang secret mạnh và tách theo môi trường.
