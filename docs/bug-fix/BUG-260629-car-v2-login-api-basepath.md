# BUG-260629 — car-manager-v2 login lỗi `PLT-E9999 Cannot POST /api/auth/login`

## 증상 (Triệu chứng)
Đăng nhập tại car-manager-v2 trên `https://apps.amoeba.site/app-car-manager-v2/login` trả về:

```json
{"success":false,"data":null,"error":{"code":"PLT-E9999","message":"Cannot POST /api/auth/login"},"timestamp":"2026-06-29T10:16:34.046Z"}
```

`PLT-E9999` là mã lỗi của **platform BFF** (`bff-platform`), không phải của car-manager-v2 → request login đã đi nhầm backend.

## 원인 분석 (Phân tích nguyên nhân)
- App build với `BASE_PATH=/app-car-manager-v2` (xem `docker-compose.app-car-manager-v2.yml`, `.env`), nên phục vụ dưới `/app-car-manager-v2/...` và route handler login nằm ở `/app-car-manager-v2/api/auth/login` (`src/app/api/auth/login/route.ts`).
- Form login lại hardcode path tuyệt đối từ root: `<form action="/api/auth/login">`.
- **Next.js chỉ tự prepend `basePath` cho `<Link>` / router / `<Image>`, KHÔNG cho `<form action>` thô hay `fetch()`.** → trình duyệt POST tới `https://apps.amoeba.site/api/auth/login` (thiếu basePath).
- nginx `apps.amoeba.site.conf`: `location /api/` proxy thẳng tới `bff-platform:3100`. Platform không có route đó → 404 `PLT-E9999 Cannot POST /api/auth/login`.
- Lý do bug chỉ xảy ra trên apps.amoeba.site (không trên Render/dev): ở đó basePath rỗng nên `/api/auth/login` tình cờ đúng.

Cùng lớp lỗi với `BUG-260524-car-v2-logout-api-route-not-found.md`.

## 수정 내용 (Nội dung sửa)
Thêm helper basePath-aware client+server safe và áp cho mọi URL viết tay trỏ route nội bộ.

- **Thêm** `apps/web/src/lib/base-path.ts` → `apiPath(path)` prepend `NEXT_PUBLIC_BASE_PATH` (inline lúc build qua `next.config.mjs` `env`; rỗng trên Render/dev nên tương thích ngược).
- Sửa 5 chỗ dùng path root thiếu basePath:

| File | Trước | Sau |
|---|---|---|
| `app/login/page.tsx` | `action="/api/auth/login"` | `action={apiPath('/api/auth/login')}` |
| `app/(app)/settings/me/_components/me-push-card.tsx` | `fetch('/api/v1/push/subscribe')` | `fetch(apiPath(...))` |
| `app/(app)/settings/me/_components/me-push-card.tsx` | `fetch('/api/v1/push/unsubscribe')` | `fetch(apiPath(...))` |
| `components/inputs/address-autocomplete.tsx` | `fetch('/api/v1/places/autocomplete')` | `fetch(apiPath(...))` |
| `app/(app)/expenses/new/_components/expense-submit-form.tsx` | `fetch('/api/v1/expenses/upload-presigned')` | `fetch(apiPath(...))` |

## 변경 파일 (File thay đổi)
- `apps/app-car-manager-v2/apps/web/src/lib/base-path.ts` (mới)
- `apps/app-car-manager-v2/apps/web/src/app/login/page.tsx`
- `apps/app-car-manager-v2/apps/web/src/app/(app)/settings/me/_components/me-push-card.tsx`
- `apps/app-car-manager-v2/apps/web/src/components/inputs/address-autocomplete.tsx`
- `apps/app-car-manager-v2/apps/web/src/app/(app)/expenses/new/_components/expense-submit-form.tsx`

## 테스트 / 배포 (Test / Deploy)
- Type-trivial (`apiPath` trả `string`). Verify đầy đủ ở bước `next build` lúc deploy (host không có node toolchain).
- Build-time: bắt buộc build qua script chuẩn với `BASE_PATH`/`NEXT_PUBLIC_BASE_PATH=/app-car-manager-v2` (NEXT_PUBLIC_* inline lúc build).
- Cô lập: chỉ rebuild + restart container `next-car-manager-v2`, không ảnh hưởng app khác.
- Sau deploy kiểm tra: login OK, push subscribe/unsubscribe, address autocomplete, upload receipt presigned trên `apps.amoeba.site/app-car-manager-v2`.

## 재발 방지 (Phòng tái phát)
- Mọi URL viết tay (`<form action>`, `fetch`, `<a href>` dạng absolute) trỏ route nội bộ phải đi qua `apiPath()`.
- Cân nhắc lint rule cấm literal `"/api/` trong `action=`/`fetch(` để chặn từ gốc.
