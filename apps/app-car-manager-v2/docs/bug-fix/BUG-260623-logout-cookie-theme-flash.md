# BUG-260623 — Logout Cookie Leak + Truck Theme SSR Flash

## 1. Nguyên nhân

### Bug A — Logout không xóa `ccms.fleet.dept` cookie
- **File:** `apps/web/src/app/api/auth/logout/route.ts`
- `doLogout()` chỉ xóa 3 cookies (`amb_session`, `amb_ama_access`, `amb_ama_refresh`) nhưng bỏ sót `ccms.fleet.dept` (sticky workspace cookie, max-age 1 năm).
- **Hậu quả:** Sau khi logout, cookie vẫn tồn tại trong browser → user tiếp theo login vào cùng browser sẽ thấy workspace TRUCK (nếu user cũ đang ở đó), dù user mới không có quyền TRUCK.

### Bug B — Middleware "invalid JWT" branch cũng thiếu
- **File:** `apps/web/src/middleware.ts` (nhánh xử lý JWT invalid signature / malformed)
- Cùng vấn đề: xóa 3 auth cookies nhưng không xóa `ccms.fleet.dept`.

### Bug C — SSR theme flash (orange truck theme chưa áp dụng trước first paint)
- **File:** `apps/web/src/components/layout/dept-theme-effect.tsx`
- `DeptThemeEffect` set `data-dept='truck'` trên `<html>` thông qua `useEffect` — chạy **sau** khi JS hydrate.
- Kết quả: trang truck ban đầu render màu xanh (CAR theme) rồi mới đổi sang cam — visible flash khi load lần đầu.
- Thêm: `DeptThemeEffect` cleanup `() => { delete root.dataset.dept }` chạy vô điều kiện, gây flash thêm ở React Strict Mode (double-invoke: mount → cleanup → re-mount).

## 2. Phương án sửa

### Fix A + B — Thêm cookie delete vào cả 2 nơi
```ts
// logout/route.ts + middleware.ts (nhánh invalid JWT)
res.cookies.delete('ccms.fleet.dept');
```

### Fix C — Server-side pre-render data-dept để tránh flash
Thêm vào `app/layout.tsx`:
```tsx
const jar = await cookies();
const dataDept = jar.get('ccms.fleet.dept')?.value === 'TRUCK' ? 'truck' : undefined;
// ...
<html ... data-dept={dataDept} suppressHydrationWarning>
```
`suppressHydrationWarning` đã có sẵn trên `<html>` → React không cảnh báo khi client state diverge.
`DeptThemeEffect` vẫn giữ để sync sau client navigation.

### Fix C2 — Sửa DeptThemeEffect cleanup
```tsx
// Trước:
return () => { delete root.dataset.dept; };
// Sau (chỉ undo những gì mình đã set):
return () => { if (dept === 'TRUCK') delete root.dataset.dept; };
```

### Bug D — Root redirect gửi TRUCK-only manager đến sai trang
- **File:** `apps/web/src/app/(app)/page.tsx`
- Root page redirect chỉ check `role === 'DRIVER'`, tất cả role còn lại đều về `/dashboard` (CAR calendar).
- **Hậu quả:** QT Xe tải (MANAGER chỉ TRUCK) landing trên `/dashboard` — trang xe con — thay vì `/truck/dashboard`. `clearlyDept('/dashboard')` trả `'CAR'` nên `DeptProvider` không gọi `persist()` → cookie không bao giờ được set → mỗi lần reload đều flash.

### Bug E — SSR flash trên first visit đến `/truck/*` (no cookie)
- **Root:** `layout.tsx` đọc cookie → set `data-dept` SSR. Nhưng lần đầu login chưa có cookie → SSR render `<html>` không có `data-dept` → blue flash trước khi React hydrate và `DeptThemeEffect` chạy.

### Bug F — `TruckDashboardPage` crash (RSC/client boundary violation → theme never appears)
- **File:** `apps/web/src/app/(app)/truck/dashboard/page.tsx` + `_components/period-select.tsx`
- `isPeriodPreset()` là pure function nhưng được export từ file `'use client'`. React 19 treat ALL exports từ `'use client'` module là client-only references — gọi từ Server Component ném `"Attempted to call isPeriodPreset() from the server"`.
- **Hậu quả:** `TruckDashboardPage` crash vào `ErrorBoundaryHandler` → React không hoàn thành hydration → `DeptThemeEffect` (là Client Component) không bao giờ mount → `data-dept='truck'` không bao giờ được set → theme luôn là màu xanh mặc định (CAR).
- **Lý do không phát hiện sớm:** Error boundary nuốt lỗi; UI vẫn render (error overlay chỉ hiện trong dev mode), sidebar dùng `DeptProvider` bên ngoài error boundary nên vẫn hiển thị truck items.

## 2. Phương án sửa (bổ sung)

### Fix D — Root redirect check fleet access
```tsx
// app/(app)/page.tsx
const [fleetAccess, jar] = await Promise.all([resolveFleetAccess(user), cookies()]);
const cookieDept = jar.get('ccms.fleet.dept')?.value;
const preferredDept =
  cookieDept === 'TRUCK' && fleetAccess.includes('TRUCK') ? 'TRUCK'
    : cookieDept === 'CAR' && fleetAccess.includes('CAR') ? 'CAR'
      : (fleetAccess[0] ?? 'CAR');
redirect(preferredDept === 'TRUCK' ? '/truck/dashboard' : '/dashboard');
```

### Fix E — Chấp nhận flash lần đầu (cookie chưa có)
Inline `<script dangerouslySetInnerHTML>` bị React 19 lọc bỏ hoàn toàn từ Server Component — không thể dùng. Trên lần đầu vào `/truck/*` với cookie chưa có, flash blue→orange vẫn xảy ra. `app/layout.tsx` đọc cookie SSR đã handle cho lần thứ 2 trở đi (cookie đã được `DeptProvider.persist()` set sau first hydration).

### Fix F — Tách pure constants ra khỏi `'use client'` boundary (CRITICAL)
```
// Tạo mới: _components/period-presets.ts  (KHÔNG có 'use client')
export const PERIOD_PRESETS = [...] as const;
export type PeriodPreset = ...;
export function isPeriodPreset(...): v is PeriodPreset { ... }

// period-select.tsx → import từ period-presets.ts thay vì tự define
// page.tsx → import isPeriodPreset từ period-presets.ts
```

## 3. Các file đã sửa
| File | Thay đổi |
|---|---|
| `apps/web/src/app/api/auth/logout/route.ts` | Thêm `res.cookies.delete('ccms.fleet.dept')` |
| `apps/web/src/middleware.ts` | Thêm `res.cookies.delete('ccms.fleet.dept')` vào invalid JWT branch |
| `apps/web/src/app/layout.tsx` | Đọc cookie server-side → `data-dept` trên `<html>` |
| `apps/web/src/components/layout/dept-theme-effect.tsx` | Fix cleanup: chỉ delete nếu ta đã set |
| `apps/web/src/app/(app)/page.tsx` | Root redirect check fleet access → `/truck/dashboard` cho TRUCK-only |
| `apps/web/src/app/(app)/truck/layout.tsx` | Xóa inline script vô hiệu (React 19 lọc bỏ); cập nhật JSDoc |
| `apps/web/src/app/(app)/truck/dashboard/_components/period-presets.ts` | **Mới** — tách pure constants/utility ra khỏi `'use client'` |
| `apps/web/src/app/(app)/truck/dashboard/_components/period-select.tsx` | Import từ period-presets.ts |
| `apps/web/src/app/(app)/truck/dashboard/page.tsx` | Import `isPeriodPreset` từ period-presets.ts |

## 4. Verify
- `tsc --noEmit` web package: clean (0 errors)
- Logout flow: sau khi logout `ccms.fleet.dept` cookie không còn trong browser
- QT Xe tải login → landing đúng `/truck/dashboard` (không còn về `/dashboard`)
- Truck theme: `document.documentElement.dataset.dept === 'truck'` sau hydration ✅
- Dashboard page render đúng (không còn RSC error boundary crash)
- Màu cam visible trên buttons, progress bars, links (accent color override working)
