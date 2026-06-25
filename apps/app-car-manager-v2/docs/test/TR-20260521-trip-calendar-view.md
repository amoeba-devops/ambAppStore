# TR-20260521 — Trip Calendar View Test Report

**Liên kết**: [TC-20260521-trip-calendar-view.md](TC-20260521-trip-calendar-view.md) · [PLAN-20260521-trip-calendar-view.md](../plan/PLAN-20260521-trip-calendar-view.md) · [REQ-20260521-trip-calendar-view.md](../analysis/REQ-20260521-trip-calendar-view.md)

**Trạng thái tổng**: 🟡 **Build verified · Manual UI testing pending on staging**

---

## Automated test results (local)

### Typecheck

```bash
$ cd apps/app-car-manager-v2/apps/web && npm run typecheck
> tsc --noEmit
(exit 0)
```
✅ **PASS** — zero TypeScript errors across new files + modifications.

### Lint

```bash
$ npm run lint
(exit 0 — only warnings, no errors)
```
✅ **PASS** — initial run flagged 2 react-hooks/rules-of-hooks errors in `month-view.tsx` (early return before useMemo); fixed by reordering hooks. Final pass shows only deprecation notice from `next lint` itself (Next 16 will replace with ESLint CLI).

### Build

```bash
$ npm run build
✓ Compiled successfully
Route (app)                              Size     First Load JS
├ ƒ /trips                               25.8 kB  337 kB    (+~20 kB vs baseline)
```
✅ **PASS** — Next.js production build succeeds. Calendar bundle lazy-loaded (`dynamic()` import). Initial fix: `ssr: false` removed from `dynamic()` call because Server Components don't allow it; chunk still ships on-demand via Next chunking.

---

## Manual UI test status

| TC | Status | Notes |
|----|--------|-------|
| TC-1 Toggle List/Calendar (Admin) | ⏳ Pending | Cần test trên `stg-apps.amoeba.site` |
| TC-2 Sub-view switching | ⏳ Pending | localStorage persist code in place |
| TC-3 Visibility theo role | ⏳ Pending | Query reuses `listTrips` visibility logic — high confidence |
| TC-4 Event rendering Month | ⏳ Pending | Color tokens dùng Tailwind `*-soft` — cần check tokens.css |
| TC-5 Event rendering Week/Day | ⏳ Pending | Now indicator + lane assignment cần check trên data thật |
| TC-6 Gantt view | ⏳ Pending | "Unassigned" row chỉ hiện khi có data |
| TC-7 Click interactions | ⏳ Pending | Peek drawer URL pattern reuse `?peek=` đã có |
| TC-8 Drag Admin | ⏳ Pending | Wire xong qua HTML5 DnD + `updateTripAction` |
| TC-9 Drag Manager | ⏳ Pending | Permission clone qua `permission.ts` |
| TC-10 Edge cases | ⏳ Pending | 500-row cap throw `CAR-E0413` |
| TC-11 Mobile / touch | ⏳ Pending | `matchMedia('(pointer: coarse)')` detect, drag disabled |
| TC-12 i18n cross-locale | ⏳ Pending | 3 file `messages/*.json` đã sync |
| TC-13 Build & lint | ✅ PASS | (xem trên) |
| TC-14 Audit log invariants | ⏳ Pending | `updateTripAction` đã log `TRIP.UPDATE`; client skip no-op để tránh spam |
| TC-15 Multi-tenancy guard | ⏳ Pending | `listTripsForCalendar` filter `ent_id` từ JWT, không từ input |

---

## Code review checklist (self-review)

- [x] Mọi text UI qua `useTranslations('trips.calendar')` — không hardcode
- [x] `listTripsForCalendar` MUST filter `ent_id` ✅ (line 1 của where filters)
- [x] Visibility filter giống `listTrips` ✅ (cloned Admin/Manager/Driver logic)
- [x] `fetchTripsForCalendarAction` qua `runAction` wrap — error trả ActionResult format
- [x] No direct DB call từ Client Component — calendar fetch qua Server Action
- [x] `updateTripAction` reused — không tạo update path mới, state machine không bypass
- [x] Audit log inherit từ `updateTripAction` (`TRIP.UPDATE` đã log sẵn)
- [x] Drag permission UI mirror server (defense-in-depth, server vẫn enforce)
- [x] Touch device disable drag (HTML5 DnD broken iOS)
- [x] `?view=calendar` không phá bookmark cũ `/trips?status=pending`
- [x] Calendar chunk lazy-load qua `next/dynamic`
- [x] 3 locale file sync cùng commit
- [x] Soft delete trip không xuất hiện (query filter `trpDeletedAt IS NULL`)

---

## Known limitations (defer)

| Item | Lý do defer |
|---|---|
| Resize event (kéo cạnh đổi duration) | Out of scope MVP per REQ §6.6 |
| Drag-change-vehicle trong Gantt | Out of scope — chỉ MOVE time, không đổi xe |
| Filter by vehicle/driver trên calendar | Defer |
| Conflict warning trên calendar | Chờ Gap B P4 wire xong (`trip-conflict.service.ts`) |
| Notification khi reschedule | `updateTripAction` chưa notify ai; PRD R4 follow-up |
| DriverTripsList tích hợp calendar | Q1 default = không có; có thể P5 PWA |
| Preset form từ `?scheduledAt`/`?vehicleId` | Trang `/trips/new` hiện chưa đọc các query này — separate REQ |

---

## Deployment readiness

- [x] Build green local
- [x] Workflow docs (REQ, PLAN, TC, TR) đầy đủ
- [ ] Manual smoke test trên staging (cần deploy trước)
- [ ] Verify index `idx_car_trips_ent_status_scheduled` tồn tại trên Neon prod (PLAN §5 SQL check)
- [ ] PR review

**Đề xuất**: merge `staging-car` → deploy staging → chạy manual test theo TC-1 đến TC-15 → log lại trong TR này → nếu xanh thì PR `staging-car` → `production`.

---

## Reproducer commands

```bash
# Local dev
cd apps/app-car-manager-v2/apps/web
npm run dev    # http://localhost:3001/trips

# Switch to calendar manually
# → http://localhost:3001/trips?view=calendar

# Type/lint/build check
npm run typecheck && npm run lint && npm run build
```

---

## Sign-off

- **Build artifacts**: production build `apps/app-car-manager-v2/apps/web/.next/` generated successfully (Next 15.1.3).
- **Author**: Claude Code session 2026-05-21
- **Next**: Awaiting manual UI verification on staging.
