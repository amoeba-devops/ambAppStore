# BUG-260524 — app-car-manager-v2 logout `/api/auth/logout` 404 trên staging-AMA mount

## 1. Triệu chứng

Trên staging mount qua AMA shell (`https://stg-ama.amoeba.site/apps/app-car-manager-v2/...`):

- User click **Logout** ở sidebar avatar (admin/manager) HOẶC link "Đổi tài xế" trong `/today` (driver).
- Response JSON:

```json
{
  "success": false,
  "data": null,
  "error": { "code": "PLT-E9999", "message": "Cannot GET /api/auth/logout" },
  "timestamp": "2026-05-23T17:18:47.409Z"
}
```

- 3 cookie auth (`amb_session`, `amb_ama_access`, `amb_ama_refresh`) KHÔNG được clear → session vẫn còn sống.

## 2. Root cause

Hai chỗ điều hướng tới `/api/auth/logout` bằng raw browser navigation, KHÔNG biết Next.js `basePath`:

| File | Dòng | Code |
|---|---|---|
| `apps/web/src/components/layout/sidebar-nav.tsx` | 121 (cũ) | `window.location.href = '/api/auth/logout'` |
| `apps/web/src/app/(app)/today/page.tsx` | 84 (cũ) | `<a href="/api/auth/logout">Đổi tài xế</a>` |

Khi app mount dưới basePath `/app-car-manager-v2` (staging Docker) hoặc `/apps/app-car-manager-v2` (AMA shell), raw URL `/api/auth/logout` đi tới **platform BFF gốc** chứ không tới route handler của car-v2 → platform trả `PLT-E9999`.

Lưu ý: cùng kiểu lỗi BUG-260522 nhưng target khác:
- BUG-260522: `window.location.href = '/session-expired'` (đã fix bằng server-side `redirect()`).
- BUG-260524: `/api/auth/logout` (route handler) — không thể dùng server `redirect()` vì cần chạy route handler đó để clear 3 cookies + best-effort gọi AMA `/auth/logout`.

## 3. Fix

Prepend basePath ở cả client component lẫn server component:

### `apps/web/src/components/layout/sidebar-nav.tsx` (client)
```ts
const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? '';
window.location.href = `${basePath}/api/auth/logout`;
```

`NEXT_PUBLIC_BASE_PATH` đã được mirror trong `next.config.mjs` (Step 31) → inline vào client bundle tại build time.

### `apps/web/src/app/(app)/today/page.tsx` (server)
```tsx
<a href={`${process.env.BASE_PATH ?? ''}/api/auth/logout`}>Đổi tài xế</a>
```

Plain `<a>` KHÔNG được Next.js tự prefix basePath (chỉ `<Link>` của `next/link` mới prefix). Server component đọc trực tiếp `process.env.BASE_PATH`.

### Vì sao không đổi sang `<Link>`?
`<Link>` sẽ làm client-side navigation, không trigger route handler. Cần raw `<a>` (full reload) để hit route handler logout.

## 4. Test plan

| # | Môi trường | Hành động | Kết quả mong đợi |
|---|---|---|---|
| 1 | staging-AMA (`stg-ama.amoeba.site/apps/app-car-manager-v2`) | Admin/Manager click logout trong sidebar | Redirect tới `/apps/app-car-manager-v2/login`, 3 cookies cleared |
| 2 | staging-AMA | Driver click "Đổi tài xế" trên `/today` | Tương tự #1 |
| 3 | staging-apps (`stg-apps.amoeba.site/app-car-manager-v2`) | Tương tự #1 | Redirect tới `/app-car-manager-v2/login` |
| 4 | Render direct (basePath empty) | Logout | Redirect tới `/login`, hoạt động như cũ |
| 5 | Local dev | Logout | Redirect `localhost:3001/login` |

## 5. Out of scope

- `logoutAction` chỉ clear `amb_session` (không clear 2 cookies AMA). Đó là lý do sidebar dùng `/api/auth/logout` route thay vì server action. Có thể refactor `logoutAction` để clear cả 3 + best-effort AMA call → bỏ raw nav hoàn toàn, nhưng tách issue riêng.
