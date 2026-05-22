# TR-20260522 — Schedule Dashboard Test Report

**Liên kết**: [TC-20260522-schedule-dashboard.md](TC-20260522-schedule-dashboard.md) · [PLAN-20260522-schedule-dashboard.md](../plan/PLAN-20260522-schedule-dashboard.md) · [REQ-20260522-schedule-dashboard.md](../analysis/REQ-20260522-schedule-dashboard.md)

**Trạng thái tổng**: 🟢 **Build verified · Manual UI testing pending on staging**

---

## Automated test results (local)

### Typecheck
```bash
$ npm run typecheck
> tsc --noEmit
(exit 0 — zero errors)
```
✅ **PASS**

### Lint
```bash
$ npm run lint
✔ No ESLint warnings or errors
```
✅ **PASS** (no errors, no warnings — clean lint sau khi sửa rules-of-hooks ở REQ-1)

### Production build
```bash
$ npm run build
✓ Compiled successfully in 33.1s
✓ Generating static pages (21/21)

Route (app)                                 Size  First Load JS
├ ƒ /dashboard                           25.1 kB         340 kB    ← MỚI
├ ƒ /trips                                5.68 kB         317 kB    ← REVERT (giảm từ 25.8kB)
├ ƒ /today                                 863 B         312 kB
└ ... (28 routes khác)
```
✅ **PASS** — Next 15.1.3 build, 21 pages generated.

**Bundle observation**: `/dashboard` 25.1kB (calendar + shell + form + legend), `/trips` giảm về 5.68kB sau revert. Cân đối tốt.

---

## Manual UI test status

| TC | Title | Status | Notes |
|---|---|---|---|
| TC-D1 | Landing redirect | ⏳ Pending staging | Code path verified: `app/(app)/page.tsx` line 17 → `/dashboard` cho STAFF |
| TC-D2 | Sidebar nav | ⏳ Pending staging | `nav-items.ts` thêm entry, icon `LayoutDashboard` |
| TC-D3 | `/dashboard` route access control | ⏳ Pending staging | Page-level `redirect('/today')` cho DRIVER |
| TC-D4 | Calendar (reuse REQ-1) | ⏳ Pending staging | 4 view + drag-drop unchanged |
| TC-D5 | Color by vehicle (NEW) | ⏳ Pending staging | `vehicleColor()` deterministic hash 8 palette, toggle persist localStorage (I1) |
| TC-D6 | VehicleLegend (NEW) | ⏳ Pending staging | Right rail, color match calendar, status counts từ derived `activeByVehicle` |
| TC-D7 | QuickBookForm (NEW) | ⏳ Pending staging | Reuse `createTripSchema` + `createTripAction`, validation parity với `/trips/new` |
| TC-D8 | Click empty slot → form prefill (NEW) | ⏳ Pending staging | `<DashboardShell>` lift state pattern, useEffect pre-fill |
| TC-D9 | Click event → peek drawer trên `/dashboard` | ⏳ Pending staging | URL pattern `?peek=` mount drawer trong page.tsx |
| TC-D10 | Form draft localStorage | ⏳ Pending staging | Reuse `useFormDraft` hook có sẵn — key `dashboard:quick-book` |
| TC-D11 | `/trips` revert | ⏳ Pending staging | Đã xoá calendar branch + toggle khỏi page.tsx (Phase A) |
| TC-D12 | Mobile responsive | ⏳ Pending staging | `grid-cols-1 lg:grid-cols-[1fr_360px]` — stack vertical < lg |
| TC-D13 | i18n cross-locale | ⏳ Pending staging | Namespace `dashboard.*` × vi/en/ko sync, typecheck pass |
| TC-D14 | Build & lint | ✅ PASS | (xem trên) |
| TC-D15 | Edge cases | ⏳ Pending staging | Tenant 0 trip, 500-cap (`CAR-E0413`), Safari private mode |
| TC-D16 | Multi-tenancy guard | ⏳ Pending staging | `listTripsForCalendar` + `listVehicles` filter `ent_id` |

---

## Code review self-checklist

- [x] Mọi text qua `useTranslations('dashboard.*')` — không hardcode
- [x] `listTripsForCalendar` MUST filter `ent_id` — verified, unchanged từ REQ-1
- [x] `fetchTripsForCalendarAction` **gate role** với `requireRole(['ADMIN', 'MANAGER'])` (I2 fix) — DRIVER không call được nữa
- [x] Driver redirect: page-level `redirect('/today')` + middleware deflect đã sẵn
- [x] `<QuickBookForm>` reuse `createTripAction` (đã có), không tạo path mới
- [x] State machine không bị bypass — drag-reschedule chỉ đổi `scheduled_at`, create đi qua action có sẵn
- [x] Audit log inherit (TRIP.UPDATE qua `updateTripAction`, TRIP.CREATE qua `createTripAction`)
- [x] Soft delete trip không xuất hiện (query filter `trpDeletedAt IS NULL`)
- [x] Multi-tenancy: legend + form options đều scope `entId`
- [x] localStorage key per-tenant phù hợp:
  - `dashboard.calendar.subView` — view persist (không cần per-tenant, browser-level pref)
  - `dashboard.calendar.colorMode` — same (I1 fix)
  - `dashboard:quick-book` (qua useFormDraft prefix `ccms-draft:`) — không có entId prefix, **dùng chung cross-tenant cùng browser**. Acceptable cho MVP vì draft chỉ chứa user input thông thường, không có sensitive entity references

- [x] 3 locale file sync cùng commit (vi/en/ko cùng namespace + keys)
- [x] Calendar chunk lazy-loaded (`dynamic()` import, kế thừa pattern REQ-1)
- [x] Click event chip → peek drawer trên `/dashboard` (URL `?peek=`), không navigate sang `/trips`
- [x] Click empty slot → fill form rail, KHÔNG navigate

---

## Improvements applied trong khi implement

| # | Improvement | Lý do |
|---|---|---|
| I1 | Persist `colorMode` localStorage | Reload không reset state. Per-tenant unnecessary — đây là display pref |
| I2 | Role gate trên `fetchTripsForCalendarAction` | Defense in depth — DRIVER không bypass UI |
| Discovery | Reuse `useFormDraft` (đã exist) | Phase E giảm từ "build hook" → "integrate". Tiết kiệm ~50 LOC |
| Discovery | Reuse `DraftRestoreBanner`, `AddressAutocomplete`, `formatActionError` | Form code clean hơn, ít duplication |

---

## Known limitations / regressions

| # | Item | Severity | Plan |
|---|---|---|---|
| L1 | Mobile BottomTabNav mất entry "Me" cho STAFF (`/dashboard` chiếm slot 1, chỉ 4 slots) | 🟡 Minor | "Me" vẫn truy cập qua avatar dropdown trên desktop. Mobile STAFF cần workaround — defer fix sang follow-up |
| L2 | `VehicleLegend` "In Use ({count})" không sync realtime sau drag-reschedule | 🟡 Minor | Count compute server-side at page load. `router.refresh()` sau create sẽ refresh; sau drag không refresh full page. P1 |
| L3 | `useFormDraft` localStorage không prefix `entId` → cross-tenant cùng browser share draft | 🟢 Acceptable | Existing pattern in v2. Draft chỉ có user input plain, không có entity refs sensitive |
| L4 | Vehicle color 8 palette wrap nếu tenant > 8 xe | 🟢 Known | PRD §1.1 = 3 xe. Doc trong utils.ts comment |
| L5 | Resize event (kéo cạnh đổi duration) chưa support | 🟢 Known | REQ-2 §6 out-of-scope |
| L6 | Drag-change-vehicle trên Gantt chưa support | 🟢 Known | REQ-2 §6 out-of-scope |
| L7 | Conflict warning banner trong QuickBookForm | 🟢 Known | Chờ Gap B P4 (`trip-conflict.service.ts`) |
| L8 | KPI strip + filter chips trên Dashboard | 🟢 Defer | P1 SHOULD per REQ-2 §1 |

---

## Verification commands

```bash
# Local dev
cd apps/app-car-manager-v2/apps/web
npm run dev    # http://localhost:3001/dashboard

# Verify chain
npm run typecheck && npm run lint && npm run build

# Smoke test sau deploy staging
curl https://stg-apps.amoeba.site/app-car-manager-v2/api/v1/health
# Browser: visit /dashboard (auto redirect từ /)
```

---

## Sign-off

- **Build**: ✅ Next 15.1.3 production build pass, 21 pages
- **Author**: Claude Code session 2026-05-22
- **Next**: Awaiting manual UI verification on staging following TC-D1..TC-D16
