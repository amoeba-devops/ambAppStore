# FIX-261015 — app-car-manager-v2: Login báo "The app has not been activated for this company" dù entity đã cài app

## 1. Triệu chứng
- `https://apps.amoeba.site/app-car-manager-v2/login`, mã DN `CARGO434` (CargoRush) + email `fremd@naver.com` → redirect `/login?error=not_installed`, hiện "The app has not been activated for this company. Contact your administrator."
- Log container `next-car-manager-v2` chỉ có `[login] attempt ent=CARGO434 email=fr***@naver.com`, không có dòng lỗi nào sau đó (nhánh "không tìm thấy app" không log).

## 2. Nguyên nhân gốc
Gọi trực tiếp AMA prod (`https://ama.amoeba.site/api/v1`) bằng đúng credential:

| Bước | Kết quả |
|---|---|
| `POST /auth/email-login` | **201** — user role `MASTER`, `ACTIVE`, entity `f55fb580-7ecf-44a0-b608-a7014064bf88` |
| `GET /entity-settings/custom-apps/my` | **200** — `hscode-manager`, **`car-manager-v2`** (eca_id `0173866d-d2ff-4531-b4e6-fee192e95579`) |
| `POST /entity-settings/custom-apps/0173866d-…/token` | **201** — `appCode: "car-manager-v2"`, `role: "MASTER"` |

- `api/auth/login/route.ts` + `api/auth/refresh/route.ts` chỉ match `eca_code === 'app-car-manager-v2'` (mã trong seed script).
- CargoRush được đăng ký trên AMA với `eca_code = 'car-manager-v2'` (không prefix `app-`) — đúng như hướng dẫn ở `apps/app-car-manager-v2/CLAUDE.md` §5. Hai nguồn trong repo mâu thuẫn nhau.
- Tầng verify JWT (`packages/shared/src/auth/jwt-claims.ts`) đã chấp nhận **cả hai** mã từ trước → chỉ có bước tìm `eca_id` ở login/refresh bị lệch.

## 3. Nội dung sửa
- Thêm `apps/web/src/lib/auth/find-ama-app.ts` — `findCarAppInMyApps()` nhận cả `app-car-manager-v2` (ưu tiên) và `car-manager-v2`.
- `login/route.ts`, `refresh/route.ts` dùng helper thay vì so 1 mã cứng.
- `login/route.ts`: thêm log `[login] car-v2 not in custom-apps/my ent=… email=…` cho nhánh `not_installed` (trước đây im lặng → khó debug).

## 4. Xác minh
- `tsc --noEmit` (apps/web) — pass.
- Helper: 5/5 case (wrapped `data`, array trần, ưu tiên canonical khi có cả 2, không có app, body `null`).
- Token mint thật từ AMA cho CargoRush (`appCode=car-manager-v2`, `role=MASTER`) thỏa `amaJwtClaimsSchema` → sau khi deploy, login hoàn tất.

## 5. Thay đổi file
| File | Loại |
|---|---|
| `apps/app-car-manager-v2/apps/web/src/lib/auth/find-ama-app.ts` | Mới |
| `apps/app-car-manager-v2/apps/web/src/app/api/auth/login/route.ts` | Sửa |
| `apps/app-car-manager-v2/apps/web/src/app/api/auth/refresh/route.ts` | Sửa |
| `docs/bug-fix/FIX-261015-car-v2-login-not-installed-eca-code.md` | Mới |

## 6. Phòng tránh tái phát
- Mã app car-v2 trên AMA có 2 biến thể hợp lệ; mọi chỗ match `eca_code`/`appCode` phải đi qua `findCarAppInMyApps()` / `amaJwtClaimsSchema`, không so chuỗi cứng.
- Khi gặp `error=not_installed`: tìm log `car-v2 not in custom-apps/my` → gọi `custom-apps/my` xem `code` thực tế trước khi kết luận "entity chưa cài app".
- (Tuỳ chọn, phía AMA) `eca_url` của CargoRush đang là `https://apps.amoeba.site/apps/app-car-manager-v2` (trang catalog) — nên đổi về `https://apps.amoeba.site/app-car-manager-v2` để mở từ sidebar AMA auto-login.
