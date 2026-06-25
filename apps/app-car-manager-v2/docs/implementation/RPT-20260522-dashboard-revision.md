# RPT-20260522 — Dashboard Revision Implementation Report

**Workflow chain**:
- [REQ-20260522-dashboard-revision.md](../analysis/REQ-20260522-dashboard-revision.md)
- [PLAN-20260522-dashboard-revision.md](../plan/PLAN-20260522-dashboard-revision.md)
- [TC-20260522-dashboard-revision.md](../test/TC-20260522-dashboard-revision.md)
- [TR-20260522-dashboard-revision.md](../test/TR-20260522-dashboard-revision.md)

**Related prior work**: [REQ-20260522-schedule-dashboard.md](../analysis/REQ-20260522-schedule-dashboard.md) (REQ-2) — this revision supersedes the QuickBookForm + always-visible right rail design.

**Status**: ✅ **Build verified · Awaiting staging smoke test**

---

## 1. Tóm tắt

Iteration 2 của Schedule Dashboard:
- **Bỏ** `<QuickBookForm>` always-visible (right rail luôn chiếm 360px form).
- **Thêm** `<TripFormDialog>` overlay cho cả create + edit, trigger qua: "+ Tạo" button trong PageHeader, click ô trống calendar, hoặc nút "Edit" trong peek drawer.
- **Thay** right rail bằng `<TripsListPanel>` (12 trip recent với badge pending, scroll trong panel).
- **Wire** highlight system: URL `?highlight=<trpId>` → CSS pulse 3× trên event chip + list row + auto-anchor jump nếu trip ngoài view + URL cleanup sau 3s.
- **P2 polish**: now indicator tick 60s, scroll-to-now mount time-grid, refresh sau drag-reschedule.

Calendar audit trong REQ-delta phát hiện 12 items; P1+P2 (5 items) impl, P3+defer (7 items) doc trong follow-up.

---

## 2. Files changed

### New (2)
| Path | LOC |
|---|---|
| `apps/(app)/dashboard/_components/trip-form-dialog.tsx` | ~285 |
| `apps/(app)/dashboard/_components/trips-list-panel.tsx` | ~125 |

### Modified (10)
| Path | Change |
|---|---|
| `apps/(app)/dashboard/page.tsx` | + searchParams.highlight, + listTrips fetch (limit 12), build peek context, move PageHeader + drawer mount vào shell |
| `apps/(app)/dashboard/_components/dashboard-shell.tsx` | Full rewrite: state for dialog + peek mount + PageHeader, replace QuickBookForm với TripsListPanel, handleSuccess push highlight + refresh |
| `apps/(app)/dashboard/_components/dashboard-view.tsx` | + `highlightId` prop + auto-anchor jump useEffect + URL cleanup setTimeout + `onSlotCreate` callback + `router.refresh()` sau drag + sync trips with initialTrips prop |
| `apps/(app)/dashboard/_components/calendar/month-view.tsx` | + `highlightId` prop xuống WeekRow + apply `ccms-event-highlight` class |
| `apps/(app)/dashboard/_components/calendar/time-grid-view.tsx` | + `highlightId` + now-tick (60s setInterval) + scroll-to-now mount via scrollIntoView |
| `apps/(app)/dashboard/_components/calendar/gantt-view.tsx` | + `highlightId` + now-tick |
| `apps/(app)/trips/_components/trip-peek-drawer.tsx` | + `usePathname()` for path-aware close, + optional `onEdit` prop with Edit button, + i18n `peek.edit` |
| `apps/web/src/app/globals.css` | + `@keyframes ccms-event-highlight-pulse` + `.ccms-event-highlight` rule |
| `apps/web/messages/vi.json` · `en.json` · `ko.json` | + 9 keys `dashboard.form.{titleCreate, titleEdit, submitCreate, submitEdit, successUpdate, cancel, fullFormCreate, fullFormEdit, errUpdate}` + 5 keys `dashboard.tripsList.*` + 1 key `trips.peek.edit` |

### Deleted (1)
| Path | Lý do |
|---|---|
| `apps/(app)/dashboard/_components/quick-book-form.tsx` | Refactored thành TripFormDialog overlay |

**Tổng**: ~410 LOC mới, ~280 LOC modify, ~270 LOC removed.

---

## 3. Architecture decisions

| Decision | Rationale |
|---|---|
| **Dialog overlay cho cả create + edit** | UX flat, không rời context dashboard. Edit "Quick edit"; power user vẫn có "Mở form đầy đủ →" link xuống `/trips/[id]/edit` cho stopovers + map preview |
| **PageHeader move vào shell** | "+ Tạo" button cần trigger dialog state — render trong cùng Client Component cleanest, không cần Context / event-bus |
| **Peek drawer mount cũng move vào shell** | Drawer's "Edit" button trigger dialog state thuộc shell, share state cleanly |
| **TripPeekDrawer path-aware close** (`usePathname`) | Drawer dùng chung `/trips` + `/dashboard` — không hardcode close → `/trips` nữa |
| **`onEdit` optional prop** trên TripPeekDrawer | Backward compat: `/trips` không truyền → legacy navigate behavior; `/dashboard` truyền → dialog flow |
| **URL `?highlight=<id>` + setTimeout cleanup** | Simple, RSC-friendly. `router.replace` (not push) → không bloat history. 3s match animation duration |
| **Auto-anchor jump once-per-highlight** (jumpedRef) | Tránh re-jump nếu user manually navigate sau khi highlight hiện |
| **`router.refresh()` sau create/edit/drag** | Server re-fetch trips + vehicle counts. Trade-off: 1 network round trip, gains: legend/list panel sync |
| **`scrollIntoView` for scroll-to-now** | Works across nested scroll containers (page-level, panel-level, etc.) — không cần biết scroll container layout |
| **`eslint-disable-next-line` cho nowTick dep** | Intentional pattern — `nowTick` trigger re-eval của `new Date()`. Lint không nhìn thấy implicit dep |
| **TripsListPanel limit 12 + "Xem tất cả →"** | Trade-off UI compact vs visibility — 12 vừa viewport, link dẫn `/trips` cho full list |
| **NO draft localStorage cho dialog** | Khác QuickBookForm cũ — UX nhanh hơn, không persist intermediate state, simpler |

---

## 4. Tech invariants honored

| Constraint | Status |
|---|---|
| Multi-tenancy `ent_id` filter | ✅ Reuse existing queries |
| No direct DB từ Client | ✅ Dialog → `createTripAction` / `updateTripAction` |
| State machine intact | ✅ `updateTripAction` validation unchanged |
| Audit log inherit | ✅ TRIP.UPDATE / TRIP.CREATE via existing actions |
| i18n no hardcode | ✅ Mọi text qua `useTranslations('dashboard.*')` |
| Soft delete | ✅ `listTrips` filter `trpDeletedAt IS NULL` |
| Error code | ✅ Reuse existing |

---

## 5. Build artifacts

```
Route /dashboard:   27.4 kB · First Load 341 kB    (+2.3 kB vs prior 25.1 kB)
Route /trips:        5.88 kB · First Load 317 kB   (unchanged from REQ-2 revert)
Total pages:         21 generated
Build time:          ~33s
TypeScript errors:   0
ESLint errors:       0
ESLint warnings:     0  (after eslint-disable for intentional nowTick deps)
```

Bundle delta hợp lý: dialog + list panel + highlight handlers add ~10 KB minified.

---

## 6. Deployment plan

1. Atomic commit/PR vào `staging-car`.
2. `bash platform/scripts/deploy-staging.sh`.
3. Smoke test TC-R1..TC-R14 trên `stg-apps.amoeba.site/app-car-manager-v2/dashboard`.
4. Xanh → PR `staging-car` → `production`.

---

## 7. Known limitations & follow-ups

| # | Item | Severity | Follow-up |
|---|---|---|---|
| K1 | Dialog không có draft persist | 🟢 Minor | Acceptable trade-off |
| K2 | TripsListPanel limit 12 cố định | 🟢 Acceptable | Defer config |
| K3 | "Now indicator" lint disable cần (intentional) | 🟢 Minor | Acceptable |
| K4 | scroll-to-now có thể trigger page-level scroll | 🟢 Acceptable | `block: 'center'` |
| K5 | router.refresh() sau drag = extra network | 🟢 Acceptable | Drag không dồn dập |
| K6 | Calendar audit P3 (tooltip rich, drop-zone visual, keyboard nav, search filter) | 🟢 Defer | Future REQ |
| K7 | Bulk edit / drag-resize | 🟢 Defer | Per REQ-2 §6 |

---

## 8. Files NOT touched (verification)

- ❌ DB schema — không đổi
- ❌ Server actions `createTripAction`, `updateTripAction` — reuse existing
- ❌ `listTripsForCalendar` query — reuse REQ-1
- ❌ `useFormDraft` hook — reuse existing (chỉ dùng từ `/trips/new`, dialog không persist draft)
- ❌ Middleware — không đổi (DRIVER deflect đã có)
- ❌ Sidebar nav-items — không đổi (Dashboard entry đã add ở REQ-2)

---

## 9. Acceptance criteria status

(from REQ §7)

- ✅ Right rail = VehicleLegend + TripsListPanel (no QuickBookForm)
- ✅ PageHeader có button "+ Tạo chuyến"
- ✅ TripsListPanel header có button "+ Tạo"
- ✅ Click button → TripFormDialog mở create mode (code path verified)
- ✅ Click ô trống calendar → TripFormDialog mở với prefill (onSlotCreate wired)
- ✅ Click peek drawer "Edit" → TripFormDialog mở edit mode (onEdit prop wired)
- ⏳ Submit create → success → highlight new trip 3s + auto-anchor (cần staging test)
- ⏳ Submit edit → success → highlight updated trip (cần staging test)
- ✅ Drag-reschedule → `router.refresh()` để sync (verified in code)
- ✅ Now indicator tick mỗi 60s (verified — setInterval 60_000)
- ✅ Time-grid Week/Day mount scroll xuống "now" (scrollIntoView block:center)
- ⏳ Esc / outside click đóng dialog (cần staging test)
- ✅ i18n 3 ngôn ngữ keys synced
- ✅ Typecheck + lint + build pass

---

## 10. Lessons learned

1. **Move client-heavy chrome into Client Component**: khi PageHeader cần share state với dialog/drawer, render PageHeader bên trong shell tránh được Context/event-bus complexity.
2. **`usePathname()` cho components shared cross-route**: TripPeekDrawer original chỉ hardcode `/trips` cho close URL — path-aware close là pattern cần áp dụng cho mọi reusable layout component.
3. **`scrollIntoView` > computed `scrollTop`**: với nested scroll containers, scrollIntoView trên element handles "find the actual scroll parent" tự động.
4. **`router.refresh()` + push `?param`** = lightweight realtime: không cần WebSocket cho user-driven update; Next 15 streams nhanh đủ cho UX feel realtime.

---

**Author**: Claude Code session 2026-05-22

**Reviewer**: _pending_

**Approval**: _pending_
