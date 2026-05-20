# REQ-20260520 — Driver Shell Split

> **Tag**: [요구사항] / architecture refactor
> **Date**: 2026-05-20
> **Owner**: dev@amoeba.group
> **Branch**: `feat/car-v2-driver-shell`
> **Predecessor**: REQ-20260519-driver-ux-refactor (delivered driver-only UI tweaks within shared shell)

## Context

REQ-20260519 đã refactor UI driver **trong** shared shell (cùng sidebar + bottom-tab cho mọi role). User feedback: cần tách giao diện cho driver hoàn toàn — driver chỉ thấy nghiệp vụ của họ (chuyến, chi phí, profile), không thấy dashboard/vehicles/drivers/users/reports/audit/settings tenant. Admin và Manager dùng chung "console shell" (giao diện hiện tại).

## 1. 요구사항 요약

| # | Requirement | Type |
|---|---|---|
| R1 | Driver có shell riêng (`DriverShellClient`) không sidebar, header gọn | Frontend |
| R2 | Admin + Manager dùng chung `ConsoleShellClient` (đổi tên `AppShellClient` hiện tại) | Frontend |
| R3 | Middleware redirect driver khỏi route không thuộc nghiệp vụ → `/today` | Frontend (middleware) |
| R4 | `/trips` driver mode: card list "Chuyến của tôi", default filter "ongoing", tab phụ "Đã hoàn tất", không có table desktop, không có FAB new | Frontend |
| R5 | `/settings/me` route mới: profile + locale + logout + app info | Frontend |
| R6 | Driver-specific bottom tab labels: **Hôm nay** / **Chuyến của tôi** / **Chi phí** / **Tôi** (label "trips" ko hợp ngữ cảnh driver) | Frontend + i18n |
| R7 | `<DriverPageHeader>` compact: title + back button, không breadcrumb | Frontend |
| R8 | Cùng design tokens, không tạo palette mới — chỉ adjust density (padding compact hơn) | Design system |
| R9 | URL chung cho mọi role (không split prefix `/driver/*`) — chỉ shell branch theo role | Routing |

## 2. AS-IS 현황 분석

### 2.1 Shell hiện tại
- [app-shell.tsx](../../apps/web/src/components/layout/app-shell.tsx): server wrapper resolve `getCurrentUser()` rồi pass role xuống client
- [app-shell-client.tsx](../../apps/web/src/components/layout/app-shell-client.tsx): render SidebarNav (md+) + BottomTabNav (mobile) + InstallPrompt + Toaster
- Cùng layout cho mọi role

### 2.2 Nav items theo role
- [nav-items.ts](../../apps/web/src/components/layout/nav-items.ts) (cần kiểm tra): có filter `navItemsForRole(role)` — driver KHÔNG nên thấy items như Vehicles/Drivers/Users/Reports/Audit/Settings nhưng vẫn render sidebar
- [bottom-tab-nav.tsx](../../apps/web/src/components/layout/bottom-tab-nav.tsx): hardcode 4 tabs `today/trips/costs/settings` — không branch theo role

### 2.3 Middleware
- [middleware.ts](../../apps/web/src/middleware.ts): chỉ xử lý JWT auth, KHÔNG có role-based route guard
- Driver có thể type URL `/users` hoặc `/vehicles` và vào được page (data sẽ filtered server-side, nhưng vẫn render UI lạ)

### 2.4 Routes hiện tại + driver access map
| Route | Driver được thấy? | Hiện tại |
|---|---|---|
| `/` | Redirect to /today | ✅ (chung) |
| `/today` | ✅ — driver landing | ✅ |
| `/trips` | ✅ — filtered to assigned only | ⚠️ UI dày, table desktop, table headers driver-irrelevant |
| `/trips/[id]` | ✅ — DriverView active | ✅ (REQ-20260519) |
| `/trips/new` | ❌ — driver không tạo trip | ⚠️ button hidden nhưng URL access được |
| `/trips/[id]/edit` | ❌ | ⚠️ |
| `/costs` | ❌ — admin approval queue | ⚠️ accessible |
| `/expenses/new` | ✅ — submit expense (REQ-20260519) | ✅ |
| `/vehicles*` | ❌ | ⚠️ accessible |
| `/drivers*` | ❌ | ⚠️ accessible |
| `/users` | ❌ | ⚠️ accessible |
| `/reports*` | ❌ | ⚠️ accessible |
| `/audit` | ❌ | ⚠️ accessible |
| `/settings` | ❌ (tenant settings) | ⚠️ accessible |
| `/settings/me` | ✅ (PROPOSED NEW) | ❌ doesn't exist |

### 2.5 PageHeader hiện tại
- [page-header.tsx](../../apps/web/src/components/layout/page-header.tsx): breadcrumb + title + subtitle + actions + optional back. Phù hợp admin nhưng dày so với mobile driver UX.

## 3. TO-BE 요구사항

### 3.1 Shell structure
```
AppShell (RSC) — resolves role
  ├─ role === DRIVER → DriverShellClient
  │     ├─ DriverTopBar (compact: brand + locale + logout)
  │     ├─ main (no sidebar reservation)
  │     ├─ DriverBottomTabNav (Today/Trips/Expenses/Me)
  │     └─ InstallPrompt + Toaster
  └─ else → ConsoleShellClient (= current AppShellClient)
        ├─ SidebarNav (md+)
        ├─ main
        ├─ BottomTabNav (mobile fallback)
        └─ InstallPrompt + Toaster
```

### 3.2 Middleware guard (R3)
Sau auth check, nếu `claims.role === MEMBER` (= DRIVER local), kiểm tra pathname:
```ts
const DRIVER_ALLOWED_PREFIXES = ['/today', '/trips', '/expenses', '/settings/me', '/api'];
if (role === 'DRIVER' && !isDriverAllowed(pathname)) {
  return redirect('/today');
}
```
- Allow specific `/trips/[id]` subroutes nhưng block `/trips/[id]/edit` và `/trips/new` (regex match `/trips/[^/]+/edit` và `/trips/new`)
- `/api/*` allow để server actions hoạt động

### 3.3 Driver bottom tabs (R6)
| Key | Label (vi) | Label (en) | Label (ko) | Icon | Href | Match |
|---|---|---|---|---|---|---|
| `today` | Hôm nay | Today | 오늘 | CalendarClock | `/today` | exact `/today` hoặc `/` |
| `trips` | Chuyến của tôi | My trips | 내 운행 | ClipboardList | `/trips` | starts `/trips` |
| `expenses` | Chi phí | Expenses | 비용 | Receipt | `/expenses/new` | starts `/expenses` |
| `me` | Tôi | Me | 나 | User | `/settings/me` | starts `/settings/me` |

(So với BottomTabNav hiện tại: rename "expenses" target `/costs` → `/expenses/new`, "me" target `/settings` → `/settings/me`, label "trips" → "Chuyến của tôi")

### 3.4 `/trips` driver mode (R4)
- Khi `user.role === 'DRIVER'`: render `<DriverTripsList>` thay table/card admin
- Default filter: status ∈ {CONFIRMED, IN_PROGRESS, PENDING_DRIVER_CONFIRMATION}
- Tab "Ongoing" (default) / "Completed" (history)
- Card layout always (no desktop table) — driver-phone-first
- Hiển thị: ref, passenger, route, scheduled time, status badge. KHÔNG hiển thị "driver" column (chính họ) và "vehicle plate" thì merge inline với time

### 3.5 `/settings/me` page (R5)
RSC, lấy `getCurrentUser()` + `getDriverByUserId()` nếu role=DRIVER. Sections:
1. **Profile**: avatar, name, email, role badge
2. **License** (driver only): license number, class, expiry, status
3. **Language**: locale switch (reuse existing locale action)
4. **App**: PWA install hint (if not installed), version
5. **Account**: Logout button

### 3.6 `<DriverPageHeader>` (R7)
Mới, ở `apps/web/src/components/layout/driver-page-header.tsx`:
- Sticky top, h-12, bg-surface/95 backdrop-blur, border-bottom
- Layout: [optional back] | title (large, centered hoặc left) | [optional action]
- No breadcrumb, no subtitle
- Safe-area-inset-top padding

### 3.7 Visual tokens (R8)
- Driver shell sử dụng `--bg` (đã có)
- Compact padding utility class: `px-4 py-3` thay vì `px-7 py-6`
- Không tạo palette mới
- Driver primary actions tiếp tục dùng Button `size="2xl"` từ REQ-20260519

## 4. 갭 분석

### 4.1 변경 범위

| Area | Current | Change | Impact |
|---|---|---|---|
| AppShellClient | 1 client component | Tách thành 2: DriverShellClient + ConsoleShellClient (= current) | MEDIUM — refactor app-shell wrapper |
| Middleware | Chỉ auth | Thêm role-based route guard | MEDIUM — cần test admin/manager không bị redirect |
| BottomTabNav | Hardcoded 4 tabs cho mọi role | Variant theo role: Driver bottom tabs vs Console bottom tabs | LOW — branch trong cùng component hoặc 2 components |
| PageHeader | 1 component | Add DriverPageHeader, gradually swap driver pages | LOW — additive |
| `/trips` page | Mixed responsive table/card | Branch theo role, driver mode = card-only + tab Ongoing/Completed | MEDIUM |
| `/settings/me` | Doesn't exist | New RSC page | LOW — additive |
| Today page (existing) | Already has DriverTodayView | Replace PageHeader with DriverPageHeader | LOW |

### 4.2 Files

**MODIFY (7)**:
- `apps/web/src/components/layout/app-shell.tsx` — keep
- `apps/web/src/components/layout/app-shell-client.tsx` — branch role → render new DriverShellClient or rename rest to ConsoleShellClient
- `apps/web/src/components/layout/bottom-tab-nav.tsx` — accept role prop, render driver vs console variant
- `apps/web/src/middleware.ts` — add driver route guard
- `apps/web/src/app/(app)/today/page.tsx` — driver branch uses DriverPageHeader
- `apps/web/src/app/(app)/trips/page.tsx` — driver branch uses DriverTripsList
- `apps/web/messages/{vi,en,ko}.json` — add `layout.tabs.tripsMine`, `settings.me.*` namespaces

**CREATE (7)**:
- `apps/web/src/components/layout/driver-shell-client.tsx`
- `apps/web/src/components/layout/driver-top-bar.tsx`
- `apps/web/src/components/layout/driver-page-header.tsx`
- `apps/web/src/app/(app)/trips/_components/driver-trips-list.tsx`
- `apps/web/src/app/(app)/settings/me/page.tsx`
- `apps/web/src/app/(app)/settings/me/_components/me-profile-card.tsx`
- `apps/web/src/app/(app)/settings/me/_components/me-license-card.tsx`

### 4.3 DB migration
**Không có**. Pure frontend.

## 5. User flow

### 5.1 Driver landing
```
[Driver login via AMA] → / → middleware redirect /today
[/today]
  DriverShellClient {
    DriverTopBar [Fleet | VI ▼ | 👤 logout]
    DriverTodayView (state-aware hero + sticky bottom action)
    DriverBottomTabNav [Hôm nay* | Chuyến của tôi | Chi phí | Tôi]
  }
```

### 5.2 Driver tries to access /vehicles
```
[Driver URL: /vehicles] → middleware sees role=DRIVER, pathname /vehicles
  → response: 307 redirect /today
[Driver lands on /today again]
```

### 5.3 Driver views /trips
```
[Tap "Chuyến của tôi" tab] → /trips
[DriverTripsList]
  Tab: [Đang xử lý*] [Hoàn tất]
  Cards:
    [TR-1041 · 14:30 · 51F-712.34] Lê Văn A · Q1 → Q3 · CONFIRMED
    [TR-1038 · 16:00 · 30A-556.07] Nguyễn B · Q7 → BTH · PENDING
    ...
```

### 5.4 Driver mở /settings/me
```
[Tap "Tôi" tab] → /settings/me
[DriverPageHeader: "Tôi"]
  [MeProfileCard: avatar | Park Joon-ho | dev@amoeba.group | DRIVER]
  [MeLicenseCard: B2-1234567 · class B2 · expires 2027-12-31 · AVAILABLE]
  [Language: VI / EN / KO chips]
  [App: "Cài đặt Fleet làm app" CTA nếu chưa install]
  [Logout button (danger size lg)]
```

## 6. 기술 제약사항

- **Middleware**: chạy ở Edge runtime — không import server-side Node modules. Role lấy từ JWT claim (`claims.role`), map AMA → local trong middleware (helper exists or inline).
- **Route patterns trong middleware**: regex check, không dùng dynamic segment matching. Allow list approach (default deny safer than block list).
- **PWA**: `start_url` manifest hiện là `/` — driver login redirect `/` → `/today` → middleware refresh giữ flow đúng cho cả 2 vai trò.
- **i18n parity**: 3 ngôn ngữ phải đồng bộ, tránh missing key.
- **A11y**: bottom tab `aria-current="page"` cho active, `aria-label` cho icon-only buttons.
- **SSR-safety**: DriverShellClient là `'use client'` (giống hiện tại), ConsoleShellClient cũng `'use client'`. Server wrapper chỉ resolve role.
- **Backwards compat**: link cũ trong sidebar (admin) đến `/costs` vẫn work cho admin/manager. Driver navigate `/costs` bị middleware redirect.

## 7. Out of scope

- Backend P2 thật (car_expenses schema + S3 upload) — vẫn defer
- `/expenses` driver history list — defer (per decision 5B), chỉ có `/expenses/new`
- Manager-specific UI tinh chỉnh — manager dùng chung ConsoleShellClient với admin
- Password reset / account management UI — AMA handle
- Driver availability toggle (PRD divergence D7) — không implement
