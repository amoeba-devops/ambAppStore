# RPT-20260521 — Trip Calendar View Implementation Report

**Workflow chain**:
- [REQ-20260521-trip-calendar-view.md](../analysis/REQ-20260521-trip-calendar-view.md)
- [PLAN-20260521-trip-calendar-view.md](../plan/PLAN-20260521-trip-calendar-view.md)
- [TC-20260521-trip-calendar-view.md](../test/TC-20260521-trip-calendar-view.md)
- [TR-20260521-trip-calendar-view.md](../test/TR-20260521-trip-calendar-view.md)

**Status**: ✅ **Build verified · Awaiting staging smoke test**

---

## 1. Tóm tắt

Implement calendar view cho `/trips` (Admin/Manager) với 4 sub-view (Month / Week / Day / By Vehicle Gantt). Toggle List ↔ Calendar persist localStorage. Drag-to-reschedule (HTML5 DnD) cho PENDING trips, reuse `updateTripAction`. Custom-built bằng Tailwind + date-fns — không phụ thuộc thư viện calendar bên ngoài.

**Bối cảnh**: PRD §5.3 + FR-3.1 từng yêu cầu calendar view; P3 đã implement nhưng commit `fdfc336` xoá toàn bộ Module 3. REQ-20260521 re-add calendar nhưng neo vào `/trips` (không restore Module 3).

---

## 2. Files changed

### New files

| Path | Purpose | LOC |
|---|---|---|
| `apps/web/src/app/(app)/trips/_components/trips-calendar.tsx` | Client orchestrator + state + drag handler | ~155 |
| `apps/web/src/app/(app)/trips/_components/list-calendar-toggle.tsx` | Tiny toggle (Link) persist localStorage | ~45 |
| `apps/web/src/app/(app)/trips/_components/calendar/toolbar.tsx` | Prev/today/next + 4-view picker | ~60 |
| `apps/web/src/app/(app)/trips/_components/calendar/month-view.tsx` | 7×6 grid + multi-day event bars + "+N more" | ~190 |
| `apps/web/src/app/(app)/trips/_components/calendar/time-grid-view.tsx` | Week (7 cột) + Day (1 cột), giờ 06–22, overlap lanes | ~200 |
| `apps/web/src/app/(app)/trips/_components/calendar/gantt-view.tsx` | Vehicle rows × 24h + "Unassigned" row | ~180 |
| `apps/web/src/app/(app)/trips/_components/calendar/utils.ts` | date-fns helpers, lane assignment, locale, color tokens, `tripToCalendarEvent` | ~155 |
| `apps/web/src/app/(app)/trips/_components/calendar/types.ts` | `CalendarEvent`, `CalendarViewType`, `CalendarVehicle` | ~25 |
| `apps/web/src/app/(app)/trips/_components/calendar/permission.ts` | `canDragTrip(role, userId, ev)` mirror `updateTripAction` | ~20 |

### Modified files

| Path | Change |
|---|---|
| `apps/web/src/app/(app)/trips/page.tsx` | + `?view=calendar` branch (Admin/Manager), + `<ListCalendarToggle>` ở list view, + dynamic import `<TripsCalendar>` |
| `apps/web/src/server/queries/trips.queries.ts` | + `listTripsForCalendar(entId, role, userId, rangeStart, rangeEnd)` với soft cap 500 → throw `CAR-E0413` |
| `apps/web/src/server/actions/trips/trip.actions.ts` | + `fetchTripsForCalendarAction(input)` wrap `listTripsForCalendar` qua `runAction` |
| `packages/shared/src/zod/trip.zod.ts` | + `fetchCalendarRangeSchema` |
| `apps/web/messages/vi.json` · `en.json` · `ko.json` | + namespace `trips.calendar` (13 keys × 3) |
| `apps/web/package.json` | + `date-fns@^4.1.0` |

### Workflow docs

| Path | Purpose |
|---|---|
| `docs/analysis/REQ-20260521-trip-calendar-view.md` | Requirement analysis (14 R, 7 sections) |
| `docs/plan/PLAN-20260521-trip-calendar-view.md` | 6 Phase plan, 18 file change list, side-impact |
| `docs/test/TC-20260521-trip-calendar-view.md` | 15 manual test cases |
| `docs/test/TR-20260521-trip-calendar-view.md` | Test report (this PR's state) |
| `docs/implementation/RPT-20260521-trip-calendar-view.md` | This document |

---

## 3. Architecture decisions

| Decision | Rationale |
|---|---|
| **Custom-built** thay vì FullCalendar/react-big-calendar | License-free cho mọi view (incl. Vehicle Gantt). Bundle nhẹ (~20kB). UI khớp Tailwind tokens. Logic pure (~155 LOC utils) test được. |
| **`date-fns@4.x`** (chứ không `dayjs`/`moment`) | Tree-shake friendly, ESM-first, locale `vi/ko/enUS` có sẵn, immutable functions. |
| **Server Action `fetchTripsForCalendarAction`** thay vì Route Handler | Client Component không gọi được query `server-only`. Action giữ `getCurrentUser` + Zod validate + cấu trúc `ActionResult<T>` đồng nhất. |
| **Optimistic UI cho drag-drop** | UX mượt — event bay sang vị trí mới ngay, revert nếu server reject. |
| **Skip update khi `newTime === oldTime`** | Tránh audit log spam khi user vô tình drag-and-drop lại đúng chỗ cũ (SI-4 mitigation). |
| **`ssr: false` removed from `dynamic()`** | Server Components không cho phép flag này. Chunk vẫn lazy-load, chỉ thiếu micro-optimization của bỏ qua SSR initial render. |
| **"+N more" → switch sang Day view** thay vì popup modal | UX rõ ràng hơn, không cần component mới. |
| **Touch device disable drag** | HTML5 DnD broken iOS Safari. Edit form vẫn là escape hatch. |
| **Permission clone client-side** | UX (cursor + draggable flag) — không trust client, server vẫn enforce qua `updateTripAction:209-226`. |
| **3 locale file sync cùng commit** | next-intl strict — thiếu key 1 locale → runtime error. CI sẽ catch sớm. |

---

## 4. Tech invariants honored (CLAUDE.md compliance)

| Constraint | Status | Evidence |
|---|---|---|
| §4.1 Multi-tenancy `ent_id` filter | ✅ | `listTripsForCalendar` line 1 of filters: `eq(carTrips.entId, entId)` |
| §4.2 Layer separation | ✅ | Client → Server Action → Query → Drizzle. No direct DB call from Client. |
| §4.4 API convention snake_case request | ✅ | `fetchCalendarRangeSchema` keys `range_start`, `range_end` |
| §4.7 No direct `trp_status` mutation | ✅ | Drag chỉ đổi `scheduled_at`; status không touch |
| §8 No hardcoded text | ✅ | Mọi text qua `useTranslations('trips.calendar')` |
| §8 No commit `.env` | ✅ | Không touch env |
| §8 Audit log invariant | ✅ | `TRIP.UPDATE` inherit từ `updateTripAction`; INSERT only (audit table) |
| §8 Soft delete | ✅ | Query filter `isNull(carTrips.trpDeletedAt)` |
| Error code format `CAR-E{4 digits}` | ✅ | `CAR-E0413` cho range overflow |
| File naming (kebab-case `.action.ts`/`.zod.ts`) | ✅ | All new files follow convention |

---

## 5. Build artifacts

```
Route /trips:    25.8 kB route bundle · 337 kB First Load JS
Calendar chunk: lazy-loaded via dynamic() — only ships when ?view=calendar requested

date-fns tree-shaken delta: ~10 kB gz
Calendar components delta: ~20 kB gz (4 view files + orchestrator)
```

---

## 6. Deployment plan

1. **Code review** — peer review của PR `staging-car`.
2. **Merge → staging deploy**:
   ```bash
   ssh ambAppStore@stg-apps.amoeba.site \
     "cd ~/ambAppStore && git pull origin staging-car && bash platform/scripts/deploy-staging.sh"
   ```
   ⚠️ **KHÔNG** chạy `docker compose build` trực tiếp (per root CLAUDE.md).
3. **Verify Neon index** (PLAN §5 SQL):
   ```sql
   SELECT indexname FROM pg_indexes
   WHERE tablename = 'car_trips'
     AND indexname = 'idx_car_trips_ent_status_scheduled';
   ```
4. **Smoke test** theo TC-1..TC-15 trên `stg-apps.amoeba.site/app-car-manager-v2/trips?view=calendar`. Log lại vào TR.
5. Nếu xanh → PR `staging-car` → `production`. **Không deploy thẳng prod**.

---

## 7. Follow-ups recommended (separate REQ)

| # | Item | Lý do |
|---|---|---|
| F1 | `/trips/new` đọc `?scheduledAt` + `?vehicleId` query | Click ô trống calendar → form preset (hiện chưa preset) |
| F2 | Conflict warning trên calendar (banner đỏ khi 2 trip cùng xe overlap) | Wire khi `trip-conflict.service.ts` của Gap B P4 sẵn sàng |
| F3 | Filter by vehicle/driver trên calendar toolbar | UX cho tenant nhiều xe (>5) |
| F4 | Resize event để đổi `trpDurationMinutes` | Hiện chỉ MOVE, không RESIZE |
| F5 | Driver calendar (giản lược, mobile-first) | PRD Q1 default = không; có thể P5 PWA |
| F6 | Notification (push/email) khi reschedule | Hiện `updateTripAction` không notify; PRD R4 |
| F7 | Sync sub-view qua URL `?sub=month` thay vì localStorage | Share-link include sub-view |

---

## 8. Acceptance criteria (from PLAN §7)

- ✅ `npm run build` pass trong `apps/app-car-manager-v2/apps/web`
- ⏳ `/trips?view=calendar` render calendar (cần test staging)
- ⏳ `/trips` (no view) render list như cũ (cần test staging — code path đã verify visually trên page.tsx diff)
- ⏳ Admin drag PENDING_ASSIGNMENT trip → DB updated + audit log
- ⏳ Manager drag own pre-confirm trip → success
- ⏳ Driver login `/trips` không thấy toggle Calendar (code branch early return DriverTripsList)
- ⏳ Switch ngôn ngữ → header tháng/tuần đổi locale
- ⏳ localStorage `trips.calendar.subView` + URL `?view=calendar` persist sau F5
- ⏳ Mobile touch: drag disabled, click peek/empty hoạt động
- ⏳ Range > 500 trip → toast + log `CAR-E0413`

---

## 9. Files NOT touched (verification)

- ❌ `packages/db/src/schema/trips.schema.ts` — không đổi
- ❌ `apps/web/src/server/services/trip-state-machine.service.ts` — không đổi
- ❌ `apps/web/src/app/(app)/trips/_components/trip-peek-drawer.tsx` — không đổi (reuse 100%)
- ❌ `apps/web/src/app/(app)/trips/_components/driver-trips-list.tsx` — không đổi (DRIVER role không thấy calendar)
- ❌ DB migration — không cần (index `idx_car_trips_ent_status_scheduled` đã đủ)

---

**Author**: Claude Code session 2026-05-21 (REQ + PLAN + TC + Impl + TR + RPT in one session)

**Reviewer**: _pending_

**Approval**: _pending_
