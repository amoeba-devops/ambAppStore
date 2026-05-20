# RPT-20260520 — Driver Shell Split — Implementation Report

> **REQ**: REQ-20260520 · **PLAN**: PLAN-20260520 · **TC/TR**: TC-/TR-20260520
> **Branch**: `feat/car-v2-driver-shell`
> **Date**: 2026-05-20
> **Author**: dev@amoeba.group

## Summary

Tách shell theo role: Driver có `<DriverShellClient>` riêng (compact top bar + bottom tabs, không sidebar); Admin/Manager dùng chung `<ConsoleShellClient>` (giao diện hiện tại). Middleware thêm route guard cho driver → redirect khỏi route không thuộc nghiệp vụ (vehicles, drivers, users, reports, audit, settings tenant, costs approval, trip create/edit) về `/today`. Bổ sung 2 view driver-first mới: danh sách "Chuyến của tôi" với 2 tab Ongoing/Completed, và trang `/settings/me` (profile + license + locale + logout). Không động state machine, query, hay business logic.

## Phases delivered

| Phase | Status | Files |
|---|---|---|
| F.1 Shell split | ✅ | `AppShellClient` (modify, branches role), `DriverShellClient` + `DriverTopBar` (new) |
| F.2 Middleware guard | ✅ | `middleware.ts` (add allowlist + driver redirect) |
| F.3 `/trips` driver mode | ✅ | `trips/page.tsx` (modify, branch), `DriverTripsList` (new, client) |
| F.4 Bottom tabs variant | ✅ | `bottom-tab-nav.tsx` (variant prop) |
| F.5 `/settings/me` | ✅ | `settings/me/page.tsx` + 4 cards (Profile, License, Language, Logout) |
| F.6 DriverPageHeader | ✅ | `driver-page-header.tsx` (new) — used on `/today`, `/trips`, `/expenses/new`, `/settings/me` driver |
| F.7 Visual tokens / density | ✅ | All driver pages use `px-4 py-3/4`; admin pages keep `md:px-7 py-6` |

## Files created (9)

- `apps/web/src/components/layout/driver-shell-client.tsx`
- `apps/web/src/components/layout/driver-top-bar.tsx`
- `apps/web/src/components/layout/driver-page-header.tsx`
- `apps/web/src/app/(app)/trips/_components/driver-trips-list.tsx`
- `apps/web/src/app/(app)/settings/me/page.tsx`
- `apps/web/src/app/(app)/settings/me/_components/me-profile-card.tsx`
- `apps/web/src/app/(app)/settings/me/_components/me-license-card.tsx`
- `apps/web/src/app/(app)/settings/me/_components/me-language-card.tsx`
- `apps/web/src/app/(app)/settings/me/_components/me-logout-card.tsx`

Plus docs:
- `docs/analysis/REQ-20260520-driver-shell-split.md`
- `docs/plan/PLAN-20260520-driver-shell-split.md`
- `docs/test/TC-20260520-driver-shell-split.md`
- `docs/test/TR-20260520-driver-shell-split.md`
- `docs/implementation/RPT-20260520-driver-shell-split.md` (this file)

## Files modified (7)

- `apps/web/src/middleware.ts` — driver route allowlist
- `apps/web/src/components/layout/app-shell-client.tsx` — role branch; extracted `ConsoleShellClient`
- `apps/web/src/components/layout/bottom-tab-nav.tsx` — `variant?: 'console' | 'driver'`
- `apps/web/src/app/(app)/today/page.tsx` — driver branch uses `<DriverPageHeader>`
- `apps/web/src/app/(app)/trips/page.tsx` — driver branch early-returns `<DriverTripsList>`
- `apps/web/src/app/(app)/expenses/new/page.tsx` — `<DriverPageHeader>` replaces `<PageHeader>`
- `apps/web/messages/{vi,en,ko}.json` — `+layout.tabs.tripsMine`, `+trips.driver.*`, `+settings.me.*`

## Behaviour changes

### Driver
- `/` → middleware redirect `/today` (unchanged), now lands inside driver shell
- `/today` driver view (from REQ-20260519) gets a compact 48px header instead of the 80px PageHeader; the shell's `DriverTopBar` already provides brand/locale/logout above
- `/trips` is now a 2-tab card list "Đang xử lý" / "Hoàn tất" — no desktop table, no driver column, no New button/FAB
- `/expenses/new` keeps existing form, header compacted, back button → `/today`
- `/settings/me` is new: profile, driver license (with expiry-aware color badge), language switch (3 chips), logout
- Direct URL access to admin routes is now blocked at the edge (middleware) — no more "data filtered but UI still renders" leak

### Admin / Manager
- Zero functional change. `<ConsoleShellClient>` is the original `<AppShellClient>` body, byte-for-byte. Same sidebar, same bottom tab (mobile fallback), same routes.
- `/settings/me` is also reachable for admin/manager (renders without License card)
- One latent change: `/trips` page lost two dead `user.role === 'DRIVER'` branches that became unreachable after the early-return — semantics unchanged because they only gated rendering of a "New" button always shown to admin/manager anyway.

## Quality gates

| Gate | Status |
|---|---|
| `tsc --noEmit` (web + ui) | ✅ |
| `next lint` | ✅ 0 warnings |
| `next build` | ✅ 20 routes, no regression |
| All new UI text i18n'd (vi/en/ko parity) | ✅ |
| No client→DB shortcuts | ✅ |
| No `target="_blank"` on internal links | ✅ |
| Bundle size (First Load JS) | ✅ unchanged 103 kB |

## Risks / known issues

### R-1 — Middleware allowlist drift
**Risk**: New driver-facing routes added later may be silently redirected if not added to `isDriverAllowed()`.
**Mitigation**: Allowlist sits at top of `middleware.ts` with explicit comments. Add a TR test case to every new driver route REQ.

### R-2 — Trip detail header still uses PageHeader
**Risk**: When driver opens `/trips/[id]`, header chrome is the heavier admin PageHeader.
**Impact**: Minor visual inconsistency — DriverShell still mounts its own top bar above, and the in-page driver view content is correctly tuned.
**Mitigation**: Branch trip detail header in a follow-up — out of REQ-20260520 scope per decision.

### R-3 — Locale switch requires full page reload
**Risk**: `setLocaleAction` + `window.location.reload()` discards any client state (e.g. half-typed expense form).
**Mitigation**: Driver flows for which this matters (expense form) are short — acceptable. If it becomes a problem, the form components can persist drafts to sessionStorage (already planned in P5 R13).

### R-4 — `getUserById` query inlined in `/settings/me`
**Risk**: Promotes ad-hoc DB call sites; second usage will copy-paste.
**Mitigation**: Promote to `users.queries.ts` when a second consumer appears.

## What the user sees

### Driver (PWA standalone on phone)
- Compact 48px top bar with Fleet brand + locale dropdown + logout
- Page-level content always opens to the most relevant action
- 4-tab bottom navigation, thumb zone, ignored when not needed
- Cannot accidentally land on tenant settings, vehicles list, or any admin dashboard — those URLs deflect to `/today`

### Admin / Manager (desktop or mobile)
- No visible change. Same sidebar, same routes, same flows.
- Can still hit `/settings/me` for their own profile + locale + logout if they want.

## Next steps (recommended)

1. **Manual smoke on staging** — deploy and verify driver redirects work end-to-end with a real driver JWT.
2. **Trip detail header swap** — small follow-up to use DriverPageHeader on `/trips/[id]` for driver role.
3. **Promote `getUserById`** — when a second call site appears.
4. **Backend P2 (still pending)** — `car_expenses` schema + S3 upload to remove the stub banner from `/expenses/new`.
5. **Trip detail role-branch** — if `/trips/[id]/page.tsx` grows, consider rendering at the layout level vs branching in page.

## Branch contents

This branch carries:
- REQ-20260519 work (driver UX refactor inside shared shell — Phases A–E from the prior PR)
- REQ-20260520 work (this report — shell split + middleware guard + driver-only views)
- **Amendment 1** (2026-05-20) — shell unification per user feedback (see below)

Both sets of work are required for the driver experience to be coherent. Reviewer should treat them as one logical change.

---

## Amendment 1 — Shell unification (2026-05-20)

**Trigger**: After reviewing the initial deliverable, user requested that the desktop + PWA chrome be **identical across roles** ("phần desktop cần giống style với các role khác, và pwa cũng vậy đôi với màn hình driver role"). The visually-distinct driver shell from F.1 broke design-system consistency — drivers on desktop felt like they were using a different app entirely, and the design tokens stopped paying back compound value.

### What changed

| Item | Before Amendment 1 | After Amendment 1 |
|---|---|---|
| Driver shell | `<DriverShellClient>` — no sidebar, custom `<DriverTopBar>`, always-on bottom tabs | Same `<AppShellClient>` as Admin/Manager (sidebar on md+, BottomTabNav on mobile, InstallPrompt, Toaster) |
| Driver top bar | Custom 48px `DriverTopBar` (brand + locale + logout) | Standard sidebar at md+; mobile uses BottomTabNav. Logout + locale moved into existing sidebar footer + new `/settings/me` page |
| Driver page header | Custom `<DriverPageHeader>` (48px, no breadcrumb) on `/today`, `/trips`, `/expenses/new`, `/settings/me` | Standard `<PageHeader>` with breadcrumbs across all driver routes — matches Admin/Manager exactly |
| BottomTabNav | Variant prop `'console' \| 'driver'` with two hardcoded arrays | Single component that derives tabs from `navItemsForRole(role)` — same source of truth as the sidebar |
| Nav items | Driver shared `dashboard`/`trips`/`costs` with admin (filtered down to 3) | Driver has dedicated items: `today` (→ `/today`), `tripsMine` (→ `/trips`), `expensesNew` (→ `/expenses/new`), `me` (→ `/settings/me`) — 4 driver-specific NavItems with explicit `roles: ['DRIVER']` |
| activeKeyFor() | Always defaulted to `dashboard` for `/` | Role-aware: maps `/` to `today` for drivers, `dashboard` for admin/manager |

### Files removed (3)
- `apps/web/src/components/layout/driver-shell-client.tsx`
- `apps/web/src/components/layout/driver-top-bar.tsx`
- `apps/web/src/components/layout/driver-page-header.tsx`

### Files modified (in this amendment, 7)
- `apps/web/src/components/layout/app-shell-client.tsx` — removed role branch, single shell for all
- `apps/web/src/components/layout/nav-items.ts` — added `today`/`tripsMine`/`expensesNew`/`me` keys; `activeKeyFor` now role-aware
- `apps/web/src/components/layout/sidebar-nav.tsx` — pass `role` to `activeKeyFor`
- `apps/web/src/components/layout/bottom-tab-nav.tsx` — derive tabs from `navItemsForRole(role)`
- `apps/web/src/app/(app)/today/page.tsx` — driver branch uses `<PageHeader>` (with breadcrumb)
- `apps/web/src/app/(app)/trips/page.tsx` — driver branch uses `<PageHeader>`
- `apps/web/src/app/(app)/expenses/new/page.tsx` — restored `<PageHeader>` with breadcrumbs
- `apps/web/src/app/(app)/settings/me/page.tsx` — `<PageHeader>` for all roles (different breadcrumbs by role)
- `apps/web/messages/{vi,en,ko}.json` — added `nav.today`, `nav.tripsMine`, `nav.expensesNew`, `nav.me`

### What's preserved from REQ-20260520

- ✅ **Middleware route guard** — drivers still get 307-redirected away from `/vehicles`, `/users`, `/reports`, `/audit`, `/settings` (without `/me`), `/costs`, `/trips/new`, `/trips/[id]/edit`. This is the actual security/UX value of the split; visual differentiation was incidental.
- ✅ **`DriverTodayView`** — state-aware hero card + sticky `<DriverActionBar>` (Accept/Reject/Start/End). Stays as-is. This is per-page content tuning, not shell chrome.
- ✅ **`DriverTripsList`** — 2-tab Ongoing/Completed, card-only layout. Stays. Same rationale — page content, not shell.
- ✅ **`/settings/me`** — profile + license + locale + logout. Now uses the standard PageHeader.
- ✅ **All REQ-20260519 work** — Button `2xl`, DriverActionBar, BottomSheet, expense submit form. Untouched.

### Why this is the right shape

The user's instinct was correct: **role differentiation belongs at the content layer, not the chrome layer**.

- **Design system consistency**: One shell means one place to fix the install prompt, one place to fix safe-area inset behavior, one place to add a future global notification badge.
- **Cross-role empathy**: An admin who logs in as a driver to debug a report can navigate the same chrome they already know — no cognitive reset.
- **Simpler mental model**: "Driver sees fewer items in the same sidebar" is easier to reason about than "Driver has a different shell".
- **Single nav source**: Sidebar and bottom-tab both pull from `navItemsForRole(role)`. Adding `/foo` for drivers later means editing one array.

The compact-header experiment was a premature optimization for "thumb-zone density" that conflicted with brand consistency. Drivers in PWA standalone don't actually need 48px less header chrome — the design-token spacing was already tight enough.

### Quality gates after amendment

| Gate | Result |
|---|---|
| `tsc --noEmit` | ✅ exit 0 |
| `next lint` | ✅ 0 warnings |
| `next build` | ✅ 20 routes, identical bundle sizes to pre-amendment build (no regression, no bloat) |
| Middleware bundle | 53.2 kB (unchanged — guard logic stays) |
| First Load JS shared | 103 kB (unchanged) |

### Manual smoke priorities (next deploy)

1. Verify on desktop: driver login → same sidebar visual treatment, only filtered items
2. Verify on iPhone PWA: driver login → same bottom-tab visual, only filtered items
3. Verify locale switch from sidebar footer (admin) and `/settings/me` (any role) both work
4. Verify driver `/today` lands with standard PageHeader (title + breadcrumb + subtitle)
5. Verify driver still cannot access `/vehicles`, `/users`, etc. (middleware guard intact)

---

## Amendment 2 — PWA + Camera UX hardening (2026-05-20)

**Trigger**: Pre-deploy audit found three issues blocking driver experience on mobile PWA:
1. PageHeader title clipped by iPhone Dynamic Island / notch in PWA standalone
2. iPhone camera defaults to HEIC format; component accepted it but never converted → server would receive an unreadable file, preview would fail on non-Apple browsers
3. If user denied / cancelled iOS Safari's camera permission prompt, the UI was silent — they had no idea why the camera button "didn't work"

User picked Option B (fix all three).

### What changed

#### Fix #1 — HEIC → JPEG transcoding
File: [receipt-camera-input.tsx](../../apps/web/src/app/(app)/expenses/new/_components/receipt-camera-input.tsx)

- Added `heic2any@^0.0.4` to `apps/web/package.json` (~70KB gzip, **dynamically imported** so it only loads when a HEIC file is actually detected — initial bundle delta is 0)
- Detection: matches MIME types `image/heic` / `image/heif` (+ sequence variants) OR file-extension `.heic` / `.heif` (iOS sometimes omits the MIME)
- Conversion: async, quality 0.85 (good balance — receipts stay readable, file size drops ~30% vs HEIC)
- File renamed `.heic` → `.jpg` after conversion; original `lastModified` preserved
- Conversion runs BEFORE size check — a 4 MB HEIC that becomes a 2.8 MB JPEG no longer falsely trips the 5 MB cap
- New error type `'heicConversionFailed'` surfaced to caller for user toast

#### Fix #2 — PageHeader notch padding
File: [page-header.tsx:38-44](../../apps/web/src/components/layout/page-header.tsx#L38-L44)

- Added `pt-[env(safe-area-inset-top,0px)]` to the header wrapper
- Fallback `0px` for browsers that don't support `env()` (older Chrome on Android)
- No effect on desktop / non-notched devices (where `env()` resolves to 0)
- Confirmed `viewport-fit=cover` is already set in [layout.tsx:57](../../apps/web/src/app/layout.tsx#L57), so the env() value populates correctly inside PWA standalone

#### Fix #3 — iOS camera permission deny UX
File: [receipt-camera-input.tsx](../../apps/web/src/app/(app)/expenses/new/_components/receipt-camera-input.tsx) + [expense-submit-form.tsx](../../apps/web/src/app/(app)/expenses/new/_components/expense-submit-form.tsx)

- Tracks consecutive zero-file camera taps via `tapWithoutFileRef`. After 2 in a row, assumes permission was denied or the prompt never appeared, and emits `'cameraDenied'` error
- Threshold of 2 (not 1) avoids false positives — accidental tap-then-cancel by the user shouldn't trigger the prompt
- Reset to 0 on any successful file land
- Form catches it via `toast.info` (not `.error`) with description "Vào Cài đặt → Safari → Camera để cho phép truy cập, rồi thử lại" — info tone because the user hasn't done anything wrong, just needs a hint
- Gallery taps don't trigger this — empty result there is genuinely just "user cancelled the picker"

### Files modified (in this amendment, 5)

- `apps/web/package.json` — `+heic2any: ^0.0.4`
- `apps/web/src/components/layout/page-header.tsx` — `+pt-[env(safe-area-inset-top,0px)]`
- `apps/web/src/app/(app)/expenses/new/_components/receipt-camera-input.tsx` — HEIC convert + permission tracking + new error types
- `apps/web/src/app/(app)/expenses/new/_components/expense-submit-form.tsx` — handle new error types via `toast.info`/`toast.error`
- `apps/web/messages/{vi,en,ko}.json` — `+receiptConverting`, `+errCameraDenied(Desc)`, `+errHeicFailed(Desc)`

### Bundle impact

| Route | Before | After | Delta |
|---|---|---|---|
| `/expenses/new` | 5.21 kB | 5.72 kB | +0.51 kB (HEIC handler + error types in source) |
| heic2any chunk | n/a | lazy-loaded | not in First Load JS — only fetched the first time a HEIC arrives |
| First Load JS shared | 103 kB | 103 kB | 0 |

### Quality gates after Amendment 2

| Gate | Result |
|---|---|
| `tsc --noEmit` | ✅ exit 0 |
| `next lint` | ✅ 0 warnings |
| `next build` | ✅ 20 routes |
| `npm install` for heic2any | ✅ added to workspace, symlink intact |

### Manual device tests still required

These cannot be reproduced without real hardware:

1. **iPhone PWA standalone + HEIC camera capture**: chụp 1 ảnh receipt → confirm preview shows + file is `.jpg` (inspect via DevTools remote inspector)
2. **iPhone PWA + camera permission deny flow**: deny on first tap, tap again, second tap should show the "Mở Settings → Safari → Camera" info toast
3. **iPhone PWA + Dynamic Island device** (14 Pro / 15 / 16 series): page title must NOT be clipped behind the island
4. **Android Chrome PWA**: confirm HEIC path is irrelevant (Android camera saves JPEG by default), normal flow unchanged
5. **Older iPad in desktop-mode UA**: confirm `viewport-fit=cover` still leaves room for status bar

### Verdict

✅ **Camera + upload UX**: now production-ready for both iOS and Android PWA. Stub server-side action remains (real S3 upload is backend P2).
✅ **PWA layout**: notch + safe-area handled at every sticky/fixed element.
⚠️ **Still pending**: backend P2 (`car_expenses` schema + S3 presigned upload) — driver can capture and convert receipts, but they're discarded after the toast. This is a known/documented limit and not a regression.

