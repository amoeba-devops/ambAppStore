# PLAN-20260520 — Driver Shell Split

> **REQ**: REQ-20260520 · **Branch**: `feat/car-v2-driver-shell` · **Date**: 2026-05-20

## 1. 시스템 개발 현황 분석

### 1.1 Repo structure relevant
```
apps/app-car-manager-v2/apps/web/src/
├── middleware.ts                                       ← MODIFY (driver route guard)
├── components/layout/
│   ├── app-shell.tsx                                   ← keep (server wrapper)
│   ├── app-shell-client.tsx                            ← MODIFY (role branch)
│   ├── sidebar-nav.tsx                                 ← unchanged
│   ├── bottom-tab-nav.tsx                              ← MODIFY (driver vs console variant)
│   ├── nav-items.ts                                    ← unchanged
│   ├── page-header.tsx                                 ← unchanged
│   ├── driver-shell-client.tsx                         ← NEW
│   ├── driver-top-bar.tsx                              ← NEW
│   └── driver-page-header.tsx                          ← NEW
├── app/(app)/
│   ├── today/page.tsx                                  ← MODIFY (use DriverPageHeader for driver)
│   ├── trips/
│   │   ├── page.tsx                                    ← MODIFY (branch driver → DriverTripsList)
│   │   └── _components/
│   │       └── driver-trips-list.tsx                   ← NEW
│   └── settings/me/
│       ├── page.tsx                                    ← NEW
│       └── _components/
│           ├── me-profile-card.tsx                     ← NEW
│           ├── me-license-card.tsx                     ← NEW
│           └── me-language-card.tsx                    ← NEW
└── messages/{vi,en,ko}.json                            ← MODIFY (+layout.tabs + settings.me)
```

### 1.2 Existing constraints
- Middleware runs on **Edge runtime** — can use `jose` (already does), cannot use Node `fs`/`crypto`.
- `mapAmaRoleToLocal()` is in `@car-v2/shared/auth` — already isomorphic, safe in middleware.
- `next-intl` server vs client — DriverShellClient is `'use client'`, must call `useTranslations()` not `getTranslations()`.
- AMA JWT shape: `role` ∈ `OWNER/MASTER/MANAGER/MEMBER`; MEMBER → DRIVER local.

## 2. 단계별 구현 계획

### Phase F.1 — Split AppShellClient

#### F.1.1 — Rename current AppShellClient guts → ConsoleShellClient
- File: `apps/web/src/components/layout/app-shell-client.tsx`
- Change: keep export `AppShellClient` as the public API, but branch internally:
  ```tsx
  export function AppShellClient({ role, children }: AppShellClientProps) {
    if (role === 'DRIVER') return <DriverShellClient>{children}</DriverShellClient>;
    return <ConsoleShellClient role={role}>{children}</ConsoleShellClient>;
  }
  // ConsoleShellClient = exactly the current body of AppShellClient
  ```
- └─ 사이드 임팩트: `<AppShell>` server wrapper không thay đổi — vẫn pass `role` xuống. Tests cho admin/manager phải vẫn pass.

#### F.1.2 — DriverShellClient
- File: `apps/web/src/components/layout/driver-shell-client.tsx` (NEW)
- Structure:
  ```tsx
  <div className="flex flex-col min-h-dvh bg-bg text-text">
    <DriverTopBar />
    <main className="flex-1 min-w-0 flex flex-col pb-[64px]">
      {children}
    </main>
    <BottomTabNav variant="driver" />
    <InstallPrompt />
    <Toaster />
  </div>
  ```
- No sidebar, no CollapseHandle.
- └─ 사이드 임팩트: cùng pb-[64px] để chừa tab bar. Reuse InstallPrompt + Toaster.

#### F.1.3 — DriverTopBar
- File: `apps/web/src/components/layout/driver-top-bar.tsx` (NEW, client)
- Sticky top, h-12, bg-surface/95 backdrop-blur, safe-area-inset-top
- Brand initial + appName + locale dropdown + logout button
- └─ 사이드 임팩트: locale switcher cần reuse `setLocaleAction` (đã có)

### Phase F.2 — Middleware driver route guard

#### F.2.1 — Helper isDriverAllowed(pathname)
- File: `apps/web/src/middleware.ts`
- Add inline helper at top:
  ```ts
  /* Paths a DRIVER role can hit directly. Anything else → /today.
   * Order matters for the `/trips/[id]/edit` block: deny pattern checked first. */
  function isDriverAllowed(pathname: string): boolean {
    if (pathname === '/' || pathname === '/today') return true;
    if (pathname === '/trips' || /^\/trips\/[^/]+$/.test(pathname)) return true;
    // Block /trips/new and /trips/[id]/edit
    if (pathname === '/trips/new') return false;
    if (/^\/trips\/[^/]+\/edit$/.test(pathname)) return false;
    if (pathname === '/expenses/new' || pathname.startsWith('/expenses/new')) return true;
    if (pathname === '/settings/me' || pathname.startsWith('/settings/me')) return true;
    if (pathname.startsWith('/api/')) return true;
    // Default deny
    return false;
  }
  ```

#### F.2.2 — Apply guard after JWT verify
- After `verifyAmaJwt`, compute `localRole = mapAmaRoleToLocal(claims.role)`. If `localRole === 'DRIVER' && !isDriverAllowed(pathname)` → redirect `/today`.
- └─ 사이드 임팩트: Admin/Manager bypass guard. Test với manager hitting `/users` (should still get redirect of admin gating elsewhere, but not the driver redirect).

### Phase F.3 — `/trips` driver mode

#### F.3.1 — DriverTripsList component
- File: `apps/web/src/app/(app)/trips/_components/driver-trips-list.tsx` (NEW, client)
- Props: `trips: TripListItem[]`, `t: translations`
- Renders:
  - 2 tabs: "Đang xử lý" (default) + "Hoàn tất" — use `useState` for active tab
  - Card list filtered by tab:
    - ongoing: status ∈ {CONFIRMED, IN_PROGRESS, PENDING_DRIVER_CONFIRMATION}
    - completed: status ∈ {COMPLETED, CANCELLED, REJECTED_BY_DRIVER}
  - Each card: ref + scheduled time + vehicle plate (inline header), passenger + pickup→dropoff, status badge
- Empty state per tab

#### F.3.2 — Branch trips/page.tsx
- File: `apps/web/src/app/(app)/trips/page.tsx`
- Change: after `getCurrentUser()`, if role===DRIVER, fetch trips via `listTripsForDriver()` (already exists) + render `<DriverTripsList>` instead of the table/card structure. Manager/Admin keep AS-IS.
- └─ 사이드 임팩트: query already filters by drvId — no security risk

### Phase F.4 — Bottom tabs driver variant

#### F.4.1 — Variant prop on BottomTabNav
- File: `apps/web/src/components/layout/bottom-tab-nav.tsx`
- Add `variant?: 'console' | 'driver'` (default `'console'`)
- For `driver`: tabs become Today / TripsMine / Expenses-new / Me-settings
- Use new i18n key `layout.tabs.tripsMine` ("Chuyến của tôi")
- └─ 사이드 임팩트: ConsoleShellClient passes default variant; DriverShellClient passes `'driver'`

### Phase F.5 — `/settings/me` page

#### F.5.1 — Page RSC
- File: `apps/web/src/app/(app)/settings/me/page.tsx` (NEW)
- Resolves: `getCurrentUser()`, optional `getDriverByUserId()` if role=DRIVER (gets license info)
- Layout: DriverPageHeader (if driver) or PageHeader (admin/manager fallback) + cards stack

#### F.5.2 — MeProfileCard
- File: `apps/web/src/app/(app)/settings/me/_components/me-profile-card.tsx` (NEW, RSC)
- Shows: avatar, name, email, role badge

#### F.5.3 — MeLicenseCard (driver only)
- File: `apps/web/src/app/(app)/settings/me/_components/me-license-card.tsx` (NEW, RSC)
- Shows: license number, class, expiry date, status (color-coded if expiring <30d)

#### F.5.4 — MeLanguageCard
- File: `apps/web/src/app/(app)/settings/me/_components/me-language-card.tsx` (NEW, client)
- 3 chips VI/EN/KO, calls existing `setLocaleAction`
- Active chip highlighted, rest selectable

#### F.5.5 — Logout button section
- Reuse `logoutAction` (exists)
- Danger button `size="lg"` for driver, `size="md"` desktop

### Phase F.6 — DriverPageHeader

#### F.6.1 — Component
- File: `apps/web/src/components/layout/driver-page-header.tsx` (NEW, server-safe — uses ReactNode props)
- Props: `title: string`, `back?: string | undefined`, `action?: ReactNode`
- Layout:
  ```tsx
  <header className="sticky top-0 z-20 bg-surface/95 backdrop-blur border-b border-border
                     h-12 px-3 flex items-center gap-2
                     pt-[max(env(safe-area-inset-top),0px)]">
    {back ? <BackButton href={back} /> : <Spacer />}
    <h1 className="flex-1 text-md font-semibold text-text truncate text-center">{title}</h1>
    {action ?? <Spacer />}
  </header>
  ```
- BackButton is a small Link with `<ChevronLeft className="h-5 w-5" />`

#### F.6.2 — Swap PageHeader in driver pages
- `/today` page driver branch — use DriverPageHeader (no breadcrumb)
- `/trips` page driver branch — DriverPageHeader title "Chuyến của tôi"
- `/expenses/new` — already uses PageHeader; swap to DriverPageHeader
- `/trips/[id]` — keep PageHeader (server component branching is complex; can swap in follow-up)

### Phase F.7 — Visual tokens + density

#### F.7.1 — Driver content density
- Driver pages use `px-4 py-3` for content container instead of `px-7 py-6`
- Already done in `/today` driver view, `/expenses/new` form, `/trips/[id]` driver view

#### F.7.2 — No new tokens
- Reuse existing palette. Documentation only.

## 3. 변경 파일 목록

| # | Area | File | Change | Reason |
|---|---|---|---|---|
| 1 | Middleware | `apps/web/src/middleware.ts` | MODIFY | F.2 driver route guard |
| 2 | Shell | `apps/web/src/components/layout/app-shell-client.tsx` | MODIFY | F.1 split |
| 3 | Shell | `apps/web/src/components/layout/driver-shell-client.tsx` | NEW | F.1 |
| 4 | Shell | `apps/web/src/components/layout/driver-top-bar.tsx` | NEW | F.1 |
| 5 | Shell | `apps/web/src/components/layout/bottom-tab-nav.tsx` | MODIFY | F.4 variant |
| 6 | Header | `apps/web/src/components/layout/driver-page-header.tsx` | NEW | F.6 |
| 7 | Page | `apps/web/src/app/(app)/today/page.tsx` | MODIFY | F.6 swap header |
| 8 | Page | `apps/web/src/app/(app)/trips/page.tsx` | MODIFY | F.3 branch |
| 9 | List | `apps/web/src/app/(app)/trips/_components/driver-trips-list.tsx` | NEW | F.3 |
| 10 | Page | `apps/web/src/app/(app)/settings/me/page.tsx` | NEW | F.5 |
| 11 | Card | `apps/web/src/app/(app)/settings/me/_components/me-profile-card.tsx` | NEW | F.5 |
| 12 | Card | `apps/web/src/app/(app)/settings/me/_components/me-license-card.tsx` | NEW | F.5 |
| 13 | Card | `apps/web/src/app/(app)/settings/me/_components/me-language-card.tsx` | NEW | F.5 |
| 14 | i18n | `apps/web/messages/vi.json` | MODIFY | +keys |
| 15 | i18n | `apps/web/messages/en.json` | MODIFY | +keys |
| 16 | i18n | `apps/web/messages/ko.json` | MODIFY | +keys |
| 17 | i18n | `apps/web/src/app/(app)/expenses/new/page.tsx` | MODIFY | swap to DriverPageHeader |

## 4. 사이드 임팩트

| Scope | Risk | Description | Mitigation |
|---|---|---|---|
| Middleware route guard | 🟡 Medium | Misregex blocks legitimate admin/manager access | Default-allow for non-DRIVER; allowlist for DRIVER explicitly enumerated |
| AppShellClient split | 🟡 Medium | Refactor of shared shell — affects all routes | Keep public API `<AppShellClient>` unchanged, only branch internally |
| BottomTabNav variant | 🟢 Low | Pure additive prop with default | — |
| Trips page driver mode | 🟡 Medium | Different list shape than admin | Server query unchanged (already role-filtered); client just different render |
| `/settings/me` route | 🟢 Low | New route, isolated | — |
| DriverPageHeader | 🟢 Low | New component, opt-in per page | — |
| i18n missing key | 🟢 Low | next-intl falls back to key | Add all 3 langs before commit |

## 5. DB 마이그레이션
Không có. Pure frontend.

## 6. Implementation order

1. F.1 — Split shell (DriverShellClient + DriverTopBar + branch in AppShellClient)
2. F.4 — Bottom tab variant (needed by DriverShellClient)
3. F.6 — DriverPageHeader (needed by F.5 and used in F.5, /today, /trips)
4. F.2 — Middleware guard (now safe because shell + tabs handle deflection if user makes it through)
5. F.3 — `/trips` driver mode
6. F.5 — `/settings/me` page
7. F.7 — Visual polish pass (verify consistent density)
8. i18n keys (all 3 langs)
9. Typecheck + lint + build
10. TR + RPT

## 7. Out of scope (deferred)

- `/expenses` driver history list (decision 5B)
- Backend P2 (car_expenses schema)
- Manager-specific UI variant (uses ConsoleShellClient with admin)
- Push notification opt-in (P4 territory)
- Trip detail header swap (keep current — can be follow-up)
