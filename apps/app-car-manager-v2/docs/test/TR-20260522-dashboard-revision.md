# TR-20260522 — Dashboard Revision Test Report

**Liên kết**: [TC-20260522-dashboard-revision.md](TC-20260522-dashboard-revision.md) · [PLAN](../plan/PLAN-20260522-dashboard-revision.md) · [REQ](../analysis/REQ-20260522-dashboard-revision.md)

**Status**: 🟢 **Build verified · Manual UI testing pending on staging**

---

## Automated test results

### Typecheck
```
$ npm run typecheck  →  exit 0 (zero errors)
```
✅ PASS

### Lint
```
$ npm run lint  →  ✔ No ESLint warnings or errors
```
✅ PASS — initial run flagged 2 react-hooks/exhaustive-deps warnings on `useMemo(() => new Date(), [nowTick])`; resolved with targeted `eslint-disable-next-line` (intentional pattern — `nowTick` is the trigger for periodic re-eval).

### Production build
```
$ npm run build  →  ✓ Compiled successfully
Route /dashboard:  27.4 kB · First Load 341 kB    (+2.3 kB vs prior 25.1)
Route /trips:       5.88 kB                       (unchanged from revert)
```
✅ PASS

---

## Manual UI test status

| TC | Title | Status |
|---|---|---|
| TC-R1 | Right rail layout | ⏳ Pending staging |
| TC-R2 | PageHeader + Tạo button → Dialog | ⏳ Pending |
| TC-R3 | Create trip via dialog → highlight | ⏳ Pending |
| TC-R4 | Click empty slot → dialog with prefill | ⏳ Pending |
| TC-R5 | Edit via dialog (peek "Edit" button) | ⏳ Pending |
| TC-R6 | TripsListPanel render + interactions | ⏳ Pending |
| TC-R7 | Highlight + auto-anchor jump | ⏳ Pending |
| TC-R8 | Drag-reschedule + sync legend | ⏳ Pending |
| TC-R9 | Now indicator tick 60s | ⏳ Pending |
| TC-R10 | Scroll-to-now mount | ⏳ Pending |
| TC-R11 | Dialog edge cases | ⏳ Pending |
| TC-R12 | TripPeekDrawer onEdit prop (/trips legacy, /dashboard new) | ⏳ Pending |
| TC-R13 | i18n cross-locale | ⏳ Pending |
| TC-R14 | Build & lint | ✅ PASS |

---

## Code review self-checklist

- [x] `<QuickBookForm>` removed (file deleted)
- [x] `<TripFormDialog>` handles both create + edit via `mode` prop
- [x] `<TripsListPanel>` reuses `listTrips` query (no new query)
- [x] Highlight CSS `.ccms-event-highlight` added to globals.css with 3× pulse
- [x] `?highlight=<id>` cleaned via `router.replace` after 3s
- [x] Auto-anchor jump runs once per highlight change
- [x] `<TripPeekDrawer>` modified additively: `onEdit?` optional → `/trips` behavior unchanged
- [x] Drawer close path-aware (`usePathname()`) → works on both `/trips` and `/dashboard`
- [x] `router.refresh()` after drag-reschedule (A9)
- [x] Now indicator ticks 60s (A3) — verified via setInterval + eslint-disable for intentional dep
- [x] Scroll-to-now on mount via `scrollIntoView({ block: 'center' })` (A4) — once-only via `didScrollRef`
- [x] PageHeader moved into shell so "+ Create" button shares dialog state
- [x] 3 locale JSON files synced (vi/en/ko) for all new keys
- [x] No DB migration

---

## Improvements applied

| # | Source | Notes |
|---|---|---|
| A1 (highlight) | REQ §1 R7 | Wire via URL + CSS + components |
| A2 (auto-anchor) | REQ §1 R8 | useEffect jumpedRef guard |
| A3 (now-tick) | REQ §1 R9 | setInterval 60s + eslint-disable for intentional dep |
| A4 (scroll-to-now) | REQ §1 R10 | `scrollIntoView({ block: 'center' })` on nowIndicator ref |
| A9 (refresh after drag) | REQ §1 R11 | `router.refresh()` in handleEventDrop success path |

---

## Known limitations

| # | Item | Severity | Plan |
|---|---|---|---|
| K1 | Dialog không persist draft localStorage (khác QuickBookForm cũ) | 🟢 Minor | Trade-off UX nhanh hơn |
| K2 | TripsListPanel limit 12 — tenant > 12 trip phải dùng "Xem tất cả →" | 🟢 Acceptable | Per REQ §1 R6 |
| K3 | Highlight pulse 3s fixed — không config | 🟢 Minor | Acceptable |
| K4 | `scrollIntoView` mount auto-scroll có thể scroll page-level container | 🟢 Acceptable | `block: 'center'` minimizes jarring |
| K5 | `nowTick` lint disable comments | 🟢 Minor | Intentional pattern |

---

## Verification commands

```bash
cd apps/app-car-manager-v2/apps/web
npm run typecheck && npm run lint && npm run build

# Local dev
npm run dev    # http://localhost:3001/dashboard
```

---

## Sign-off

- **Build**: ✅ Next 15.1.3 production build pass, 21 pages
- **Author**: Claude Code session 2026-05-22
- **Next**: Manual UI verification on staging following TC-R1..TC-R14
