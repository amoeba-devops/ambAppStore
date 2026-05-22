# BUG-260522 — app-car-manager-v2 logout redirect ra trang trắng (staging)

## 1. Triệu chứng

Trên môi trường staging (`https://stg-apps.amoeba.site/app-car-manager-v2/...`):

- User click nút **Logout** (sidebar avatar dropdown HOẶC Settings → Me).
- Trình duyệt điều hướng tới một trang trắng / gần trắng.
- URL trên thanh địa chỉ trở thành `https://stg-apps.amoeba.site/session-expired` (KHÔNG có prefix `/app-car-manager-v2`).
- Không có lỗi network, response 200 nhưng body chỉ ~460 bytes.

Trên Render direct (`car-manager-v2.onrender.com`) — không bị (vì `BASE_PATH` rỗng).

## 2. Root cause

Hai handler logout cùng pattern (`me-logout-card.tsx:22`, `sidebar-nav.tsx:96`):

```ts
await logoutAction();
window.location.href = '/session-expired';
```

`window.location.href` là **raw browser navigation** — KHÔNG biết về Next.js `basePath`. Trên staging `BASE_PATH=/app-car-manager-v2`:

| Cái client gọi | Cái trình duyệt thực sự đi tới | Endpoint xử lý |
|---|---|---|
| `window.location.href = '/session-expired'` | `https://stg-apps.amoeba.site/session-expired` | Nginx route `/` → `web-platform:5200` (platform SPA) |

Platform SPA index.html (`460 bytes`) không có route `/session-expired` → React Router fall-through → blank.

Đường đúng phải là `https://stg-apps.amoeba.site/app-car-manager-v2/session-expired` (Next.js page, `~61 KB`).

### Verify bằng curl

```bash
$ curl -sf -w "%{http_code}\n" -o /dev/null https://stg-apps.amoeba.site/session-expired
200                                                 # platform fall-through
$ curl -s https://stg-apps.amoeba.site/session-expired | wc -c
460                                                 # platform SPA index, blank

$ curl -sf -w "%{http_code}\n" -o /dev/null https://stg-apps.amoeba.site/app-car-manager-v2/session-expired
200
$ curl -s https://stg-apps.amoeba.site/app-car-manager-v2/session-expired | wc -c
61980                                               # Next.js full page
```

### Vì sao chưa bị trên Render?

`render.yaml` để `BASE_PATH` rỗng → `/session-expired` cũng là đường đúng. Bug chỉ phát sinh khi mount dưới nginx prefix `/app-car-manager-v2/` của ambAppStore.

## 3. Phương án fix (chọn A — server-side redirect)

| Option | Mô tả | Quyết định |
|---|---|---|
| A | Server-side `redirect('/session-expired')` trong `logoutAction` — Next.js tự prepend basePath | **CHỌN** |
| B | Prepend `process.env.NEXT_PUBLIC_BASE_PATH` ở từng client handler | Bỏ — phải nhớ pattern mỗi nút logout |
| C | postMessage out of iframe + redirect parent | Bỏ scope lần này — tách issue riêng |

### Tại sao A an toàn

- `redirect()` từ `next/navigation` trong Server Action throw `NEXT_REDIRECT` → Next.js framework xử lý, gửi 303 + Location về client → soft client-side navigation tới đường đã prepend basePath.
- Middleware (`middleware.ts:7-23`) đã có `/session-expired` trong `PUBLIC_PATHS` → không có vòng lặp redirect.
- Comment hiện tại lo ngại "soft refresh sẽ giữ React tree stale" — không áp dụng ở đây vì đích đến là **trang khác** (`/session-expired`), không có RSC cache cho trang đó.

## 4. Diff thực hiện

### `apps/web/src/server/actions/auth/auth.actions.ts`
- Thêm `import { redirect } from 'next/navigation'`.
- Sau khi xóa cookie, gọi `redirect('/session-expired')`.
- Đổi return type `Promise<void>` → `Promise<never>` (redirect throws).
- Cập nhật JSDoc.

### `apps/web/src/app/(app)/settings/me/_components/me-logout-card.tsx`
- Bỏ dòng `window.location.href = '/session-expired';` (không bao giờ chạy vì action throw redirect).
- Bỏ comment giải thích hard-nav (đã không còn cần thiết).

### `apps/web/src/components/layout/sidebar-nav.tsx`
- Bỏ dòng `window.location.href = '/session-expired';`.

## 5. Test plan

| # | Kịch bản | Kết quả mong đợi |
|---|----------|-------------------|
| 1 | Staging — click logout trong avatar dropdown | Điều hướng `…/app-car-manager-v2/session-expired`, page Next.js render đầy đủ |
| 2 | Staging — click logout trong Settings → Me | Như trên |
| 3 | Render — click logout | Điều hướng `…/session-expired` (basePath rỗng), trang render |
| 4 | Local dev (`npm run dev` ở `apps/web/`, BASE_PATH rỗng) | Điều hướng `localhost:3001/session-expired`, trang render |
| 5 | Sau logout, refresh trang protected | Middleware redirect lại `/session-expired` (cookie đã clear) — không vòng lặp |

## 6. Out of scope (tách issue sau)

- **2-way logout sync**: platform `clearAuth` (`apps/platform/frontend/src/components/Header.tsx`) chỉ xóa `localStorage.ama_token`, không thông báo iframe car-v2 → car-v2 session còn sống cho tới khi cookie expire. Cần postMessage broadcast giữa shell và child app.
- **Iframe-aware logout UX**: thay vì hiển thị `/session-expired` trong iframe, có thể postMessage cho parent đóng app và quay về catalog. Phụ thuộc vào cách platform render car-v2 (iframe trong `AppDetailPage` vs full-page redirect).
