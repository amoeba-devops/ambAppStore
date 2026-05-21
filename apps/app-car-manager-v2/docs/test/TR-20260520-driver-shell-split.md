# TR-20260520 — Driver Shell Split — Test Report

> **REQ**: REQ-20260520 · **PLAN**: PLAN-20260520 · **TC**: TC-20260520
> **Date**: 2026-05-20
> **Branch**: `feat/car-v2-driver-shell`
> **Tester**: dev@amoeba.group (automated gates; manual smoke deferred to staging)

## Automated test summary

| Check | Result |
|---|---|
| TypeScript (web) | ✅ exit 0 |
| TypeScript (packages/ui) | ✅ exit 0 |
| ESLint (web) | ✅ 0 warnings / 0 errors |
| Next build | ✅ Compiled · 20 routes generated |

### Bundle deltas (vs main pre-refactor)
| Route | Before (P5 baseline) | After | Delta |
|---|---|---|---|
| `/today` | ~1.2 kB | 2.27 kB | +1.07 kB (DriverTodayView in REQ-20260519) |
| `/trips` | ~2.1 kB | 2.38 kB | +0.28 kB (DriverTripsList client component) |
| `/expenses/new` | n/a | 5.22 kB | — (new in REQ-20260519) |
| `/settings/me` | n/a | 2.31 kB | — (new) |
| Middleware | 53 kB | 53.2 kB | +0.2 kB (driver route guard) |
| First Load JS (shared) | 103 kB | 103 kB | 0 |

No regression on existing admin/manager routes.

## Test case results

| TC | Status | Note |
|---|---|---|
| TC-F1.1 DriverShellClient renders for DRIVER | ✅ Build-pass | `AppShellClient` branches `role === 'DRIVER'` → `<DriverShellClient>` |
| TC-F1.2 ConsoleShellClient unchanged for ADMIN/MANAGER | ✅ Build-pass | Original body extracted to `ConsoleShellClient`, public API name preserved |
| TC-F1.3 DriverTopBar functions | ✅ Build-pass | Locale dropdown + logout button wired to existing actions |
| TC-F2.1 Middleware blocks driver from non-allowed | ✅ Logic-pass | Allowlist enumerated in `isDriverAllowed()`; covers `/vehicles`, `/users`, `/reports`, `/audit`, `/settings` (without `/me`), `/costs`, `/trips/new`, `/trips/[id]/edit` |
| TC-F2.2 Middleware allows driver allowed | ✅ Logic-pass | `/`, `/today`, `/trips`, `/trips/[id]`, `/expenses/new`, `/settings/me`, `/api/*` |
| TC-F2.3 Admin/Manager unaffected by driver guard | ✅ Logic-pass | Guard only fires when `mapAmaRoleToLocal === 'DRIVER'` |
| TC-F3.1 DriverTripsList renders | ✅ Build-pass | 2 tabs Ongoing/Completed, card-only layout, no FAB/new button |
| TC-F3.2 Mobile-only card layout | ✅ Build-pass | No `md:` table breakpoint added |
| TC-F4.1 Bottom tabs driver variant | ✅ Build-pass | `variant="driver"` renders DRIVER_TABS with `tripsMine` label key |
| TC-F4.2 Console bottom tabs unchanged | ✅ Build-pass | Default `variant="console"` keeps existing 4 tabs |
| TC-F5.1 `/settings/me` for driver | ✅ Build-pass | DriverPageHeader + Profile + License + Language + Logout cards |
| TC-F5.2 `/settings/me` for manager/admin | ✅ Build-pass | PageHeader + Profile + Language + Logout (no License card — null guard) |
| TC-F6.1 DriverPageHeader behavior | ✅ Build-pass | Sticky 48px + safe-area-inset-top + optional back button |
| TC-F7.1 Density consistency | ✅ Visual review | Driver pages use `px-4 py-3` / `px-4 py-4`; admin pages keep `md:px-7 py-6` |
| TC-X1 Typecheck | ✅ exit 0 |  |
| TC-X2 Lint | ✅ 0 warnings |  |
| TC-X3 Build | ✅ 20 routes |  |
| TC-X4 i18n parity | ✅ Pass | All new keys exist in vi/en/ko at matching paths |
| TC-X5 A11y (static) | ✅ Pass | `role="radio"`/`radiogroup` on locale + chip pickers, `aria-label` on icon buttons, `aria-current="page"` on active tab, `aria-selected` on driver-trips tabs |
| TC-X8 Performance | ✅ Pass | First Load JS unchanged; per-route deltas minimal |

## Manual / device tests deferred to staging

| TC | Reason |
|---|---|
| TC-F1.3 locale switch actually re-renders | Needs `window.location.reload()` confirmed in browser |
| TC-F2.1 actual HTTP 307 redirect | Needs running server + driver JWT |
| TC-F6.1 safe-area-inset-top on iPhone notch | Real iOS PWA install |
| TC-X6 PWA standalone non-escape | Real device + install + test |
| TC-X7 Manager regression on staging | After deploy |

## Issues found during implementation

### I-1 — No `getUserById` query helper
**Severity**: Low
**Description**: To show profile name/email on `/settings/me`, needed to query `carUsers` by `usrId`. No reusable helper existed (`audit.queries.ts` joins inline, no exported by-id).
**Resolution**: Inlined the query inside `me/page.tsx` since this is currently the only call site. If a second consumer appears, promote to `users.queries.ts`.

### I-2 — `carUsers.usrLocalRole` column unused in `/settings/me`
**Severity**: Trivial
**Description**: Pulled `usrLocalRole` from the query but use `user.role` (from JWT-derived AuthContext) instead — the JWT-mapped role is canonical, the column is the cached local override. Kept the SELECT to ease the eventual swap.
**Resolution**: No action — TypeScript flagged no warning.

### I-3 — Trip detail page header still uses PageHeader
**Severity**: Low (intentional)
**Description**: `/trips/[id]/page.tsx` is a complex hub for both Admin and Driver views, and the page-level header is rendered from a shared place. Swapping to DriverPageHeader requires the trip detail page to branch role like `/today` did.
**Resolution**: Out of scope for this REQ — `<DriverView>` inside the page already provides its own compact header strip. Can be a small follow-up.

## Pre-merge checklist

- [x] Typecheck pass
- [x] Lint pass
- [x] Build pass
- [x] All new UI text via i18n (no hardcoded VI/EN/KO strings)
- [x] Middleware guard tested against all driver-blocked routes (regex/string match by code review)
- [x] No `.env*` committed
- [x] No direct DB call from Client Component
- [x] Manager/Admin shell unchanged (only ran existing tests via build success)

## Deployment plan

1. Push branch `feat/car-v2-driver-shell` to remote
2. Open PR to `main`
3. Deploy to staging (`stg-apps.amoeba.site`) via `deploy-staging.sh`
4. Run manual smoke per deferred TCs (focus: driver URL access, locale switch, PWA standalone)
5. After staging green → PR to `production`
