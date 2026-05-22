# PLAN-20260521 — Trip Calendar View

**Liên kết**: [REQ-20260521-trip-calendar-view.md](../analysis/REQ-20260521-trip-calendar-view.md)

**Mục tiêu**: implement calendar view (Month/Week/Day/Gantt) cho `/trips`, không touch DB schema, không touch state machine.

---

## 1. 시스템 개발 현황 분석

### 1.1 Directory structure liên quan

```
apps/app-car-manager-v2/
├── apps/web/
│   ├── src/
│   │   ├── app/(app)/trips/
│   │   │   ├── page.tsx                        (Server Component, AS-IS list)
│   │   │   ├── new/                            (form tạo trip)
│   │   │   ├── [id]/                           (trip detail + edit)
│   │   │   └── _components/
│   │   │       ├── trip-peek-drawer.tsx        ← reuse for click event
│   │   │       └── driver-trips-list.tsx       ← không đụng tới
│   │   ├── server/
│   │   │   ├── queries/trips.queries.ts        ← thêm listTripsForCalendar
│   │   │   ├── queries/vehicles.queries.ts     ← reuse listVehicles
│   │   │   └── actions/trips/trip.actions.ts   ← reuse updateTripAction
│   │   └── lib/auth/get-current-user.ts        ← reuse
│   ├── messages/{vi,en,ko}.json                ← thêm trips.calendar.*
│   └── package.json                            ← thêm date-fns
└── packages/db/src/schema/trips.schema.ts      ← KHÔNG đổi
```

### 1.2 Tech stack đã chốt (CLAUDE.md §2)

- Next.js 15 App Router + RSC + Server Actions — calendar = Client Component (`'use client'`) wrap bên trong Server Page.
- next-intl `useTranslations()` (client) + `useLocale()` cho locale string.
- Tailwind 3 + `@car-v2/ui` primitives (Button, Card, Badge).
- date-fns thêm mới — versions tree-shake friendly, ESM only.

### 1.3 Constraints áp dụng (CLAUDE.md §4, §8)

- ✅ Multi-tenancy: `listTripsForCalendar` MUST filter `ent_id`.
- ✅ Visibility: Admin/Manager/Driver theo PRD R-3 — clone từ `listTrips`.
- ✅ No direct DB call từ Client — calendar fetch ban đầu qua Server Page (RSC), drag mutation qua Server Action.
- ✅ No `trp_status` direct mutation — drag chỉ đổi `scheduled_at` qua `updateTripAction`.
- ✅ Audit log: `updateTripAction` đã log `TRIP.UPDATE` → không code thêm.
- ✅ i18n cấm hardcode text.

### 1.4 Available primitives reuse

- `TripPeekDrawer` — đã có, click event sẽ set `?peek=<id>` để mở.
- `PageHeader`, `Button`, `Badge` — `@car-v2/ui`.
- `STATUS_TONE` map trong `page.tsx` (line 28-36) — copy logic, thêm bg/border tokens.

---

## 2. 단계별 구현 계획

> Chia 4 Phase. Mỗi Phase commit độc lập, build xanh. Drag-drop ở Phase cuối (an toàn nhất).

### Phase 1 — Foundation (date-fns + utilities + types)

**P1-S1**: Cài `date-fns@^4.1.0` vào `apps/web/package.json`, chạy `npm install` trong `apps/app-car-manager-v2/`.
└─ 사이드 임팩트: bundle JS apps/web tăng ~10kb gz. Không ảnh hưởng features khác.

**P1-S2**: Tạo `apps/web/src/app/(app)/trips/_components/calendar/types.ts` — export `CalendarEvent`, `CalendarViewType = 'month' | 'week' | 'day' | 'gantt'`, `CalendarColor`.
└─ 사이드 임팩트: không.

**P1-S3**: Tạo `apps/web/src/app/(app)/trips/_components/calendar/utils.ts` — pure functions:
- `resolveDateFnsLocale(locale: string): Locale` (vi/ko/enUS)
- `statusColor(status: CarTripStatus): CalendarColor` (Tailwind class names, không hex)
- `buildMonthMatrix(anchor: Date): Date[][]`
- `buildWeekDays(anchor: Date): Date[]`
- `assignLanes(events): Map<string, number>` (greedy interval graph coloring)
- `eventsInWeek`, `clipToWeek`, `moveAnchor`, `formatHeaderTitle`
- `tripToCalendarEvent(trip: TripListItem): CalendarEvent` — tính `end = scheduled + (duration ?? 60min)`

└─ 사이드 임팩트: không (pure utilities, no React, no DB).

**P1-S4**: Tạo `apps/web/src/app/(app)/trips/_components/calendar/permission.ts` — hàm `canDragTrip(role, userId, trip): boolean` clone logic từ `updateTripAction` (REQ §3.3).
└─ 사이드 임팩트: nếu logic trong `updateTripAction` thay đổi sau này → cần đồng bộ tay. Mitigation: comment trỏ tới `updateTripAction:209-226`.

### Phase 2 — Backend query

**P2-S1**: Thêm `listTripsForCalendar` vào `apps/web/src/server/queries/trips.queries.ts`:
```ts
export async function listTripsForCalendar(args: {
  entId: string;
  role: LocalRole;
  userId: string;
  rangeStart: Date;
  rangeEnd: Date;
}): Promise<TripListItem[]>
```
- Where: `entId`, `trpDeletedAt IS NULL`, `trpScheduledAt >= rangeStart`, `trpScheduledAt < rangeEnd`
- Visibility: Admin all / Manager own+passenger / Driver assigned
- Order by `trpScheduledAt ASC`
- Soft cap 500: nếu `rows.length === 500`, throw `CarError('CAR-E0413', 413, 'Range too large')`
- Joins giống `listTrips`

└─ 사이드 임팩트: query mới, không đụng `listTrips`. Index `idx_car_trips_ent_status_scheduled` đã cover (cols `ent_id` + `trp_scheduled_at`).

**P2-S2**: Thêm error code `CAR-E0413` vào `packages/shared/src/errors/car-error.ts` (nếu chưa có).
└─ 사이드 임팩트: nếu enum error codes là exhaustive → cần thêm. Check trước khi commit.

### Phase 3 — UI components (read-only)

**P3-S1**: Tạo `apps/web/src/app/(app)/trips/_components/calendar/toolbar.tsx` (Client Component):
- Props: `anchor`, `view`, `onView`, `onPrev`, `onNext`, `onToday`
- Layout: `[‹] [Today] [›]  {title}  [Month|Week|Day|Gantt]`
- Dùng `@car-v2/ui` `Button` variant `secondary` cho switcher, `accent` cho active state
- i18n keys: `trips.calendar.{today,month,week,day,gantt}`

└─ 사이드 임팩트: không.

**P3-S2**: Tạo `month-view.tsx` — 7×6 grid:
- `buildMonthMatrix(anchor)` → 6 weeks
- Mỗi week row: position relative, render day cells (grid-cols-7) + overlay event bars absolute
- Event bar: `clipToWeek` → `left%/width%` theo day index 0-6, `top` theo lane
- Max 3 lane visible, dư → "+N more" link → click navigate `?peek=`...? Hay show modal? **Decision: "+N more" → set anchor = ngày đó, switch view = 'day'** (UX rõ ràng hơn modal)
- Click ô trống → call prop `onSlotClick(date)`
- Click event → call prop `onEventClick(eventId)`
- Drag-related props nhận `onEventDrop?` — Phase 4 mới wire

└─ 사이드 임팩트: không.

**P3-S3**: Tạo `time-grid-view.tsx` (parametric `dayCount: 1 | 7`):
- Header: weekday + date number
- Body: hour gutter 06:00–22:00 (16 hours, `HOUR_HEIGHT = 44px`), grid cells per day per hour
- Event positioned absolute trong day column: `top = (startMin - 360min) / 60 * 44px`, height theo duration
- Overlap algorithm: cluster overlapping events, assign lanes, width = `100% / lanes`
- Now indicator: vạch cam ngang ở cột today
- Click empty: snap 15 phút theo offsetY
- Click event: prop callback

└─ 사이드 임팩트: không.

**P3-S4**: Tạo `gantt-view.tsx`:
- Y-axis: rows = vehicles (từ `listVehicles` truyền vào) + 1 row "Unassigned" cuối
- X-axis: 24 hours, `HOUR_WIDTH = 56px`
- Row container scroll horizontal trong wrapper
- Event positioned absolute trong vehicle row theo time
- Drag chỉ trong cùng row (không support drag-change-vehicle)

└─ 사이드 임팩트: không.

**P3-S5**: Tạo `trips-calendar.tsx` (orchestrator, Client Component):
- Props: `initialTrips: TripListItem[]`, `vehicles: {id, plate}[]`, `currentUser: {role, userId}`, `initialAnchor: Date`, `initialView`
- State: `view`, `anchor` (sync với `localStorage` key `trips.calendar.subView`)
- Khi `anchor` change, gọi Server Action mới `fetchTripsForCalendarAction(rangeStart, rangeEnd)` để refetch — KHÔNG navigate URL (avoid full page reload)

└─ 사이드 임팩트: cần tạo action mới `fetchTripsForCalendarAction` wrap `listTripsForCalendar`. Lý do: query là `server-only`, Client Component không gọi trực tiếp được.

**P3-S6**: Tạo Server Action `fetchTripsForCalendarAction(input)` trong `server/actions/trips/trip.actions.ts`:
- Input: `{ range_start: string, range_end: string }` (Zod schema mới `fetchCalendarRangeSchema`)
- Output: `ActionResult<TripListItem[]>`
- Internally: `getCurrentUser()` + `listTripsForCalendar`
- No revalidatePath (read-only)

└─ 사이드 임팩트: action mới — không đụng các action khác. Cần thêm Zod schema `fetchCalendarRangeSchema` vào `packages/shared/src/zod/trip.zod.ts`.

**P3-S7**: Modify `apps/web/src/app/(app)/trips/page.tsx`:
- Đọc `?view` searchParam (default `'list'`)
- Khi `view === 'calendar'` và `user.role !== 'DRIVER'`:
  - Compute initial range = current month ± 7 days
  - Parallel fetch: `listTripsForCalendar` + `listVehicles`
  - Render `<TripsCalendar initialTrips=... vehicles=... currentUser=... />` thay cho table
  - Hide filter chips (pending/all/active/completed)
- Khi `view === 'list'` (default): không đổi, render như cũ
- Thêm toggle button `List | Calendar` ngay sau filter chips (toggle ẩn cho DRIVER)
- Toggle persist: chỉ qua URL `?view=`, không local state (vì SC). LocalStorage sync ở Client Component (Toggle là tiny client component `'use client'` wrap quanh `<Link>`)

└─ 사이드 임팩트: 
- URL pattern thêm `?view=calendar`. Bookmark cũ `/trips?status=pending` vẫn work (default view=list).
- `?page=` và `?status=` ignored khi `view=calendar`. Documented trong code comment.

### Phase 4 — Drag-to-reschedule

**P4-S1**: Wire drag handler trong 3 view (month/time-grid/gantt):
- `onDragStart`: gọi `canDragTrip(role, userId, trip)` (từ P1-S4) → nếu false, `event.preventDefault()`. Set `dataTransfer.setData('application/x-trip-id', trip.id)` + cursor `grabbing`.
- `onDragOver` ô cell: nếu `dataTransfer.types.includes('application/x-trip-id')` → `e.preventDefault()` (allow drop)
- `onDrop`: tính newStart (Month: snap day; Week/Day/Gantt: snap 15min). Gọi prop `onEventDrop(eventId, newStart)`.

└─ 사이드 임팩트: HTML5 DnD trên touch device hỏng → MVP disable drag khi `window.matchMedia('(pointer: coarse)').matches`. Touch user vẫn click peek/empty hoạt động.

**P4-S2**: Wire `onEventDrop` trong `trips-calendar.tsx`:
- `updateTripAction(tripId, { scheduled_at: newStart.toISOString() })`
- Optimistic: update local state ngay (event di chuyển trên UI)
- Nếu server trả error → revert local state + toast error (i18n `trips.calendar.dragError`)
- Nếu success → `revalidatePath('/trips')` (đã có trong action), local state vẫn đúng

└─ 사이드 임팩트:
- Race condition: nếu 2 admin drag cùng 1 trip → server xử lý tuần tự, ai sau thắng. Không lock cần thiết — last-write-wins OK cho reschedule.
- Audit log: mỗi drag = 1 row `TRIP.UPDATE` audit (kể cả không thực sự đổi giờ). Mitigation: client check `newStart.getTime() === trip.scheduledAt.getTime()` → skip action.

**P4-S3**: Toast i18n + error handling:
- Success toast: `trips.calendar.rescheduled` ("Đã đổi giờ chuyến {ref}")
- Error toast theo CarError code (`CAR-E1005` → permission; `CAR-E1006` → status không cho phép)

└─ 사이드 임팩트: toast system phải sẵn có. Check `useToast` hook đã export từ đâu (sử dụng pattern hiện tại của settings auto-save — xem REQ-20260521-settings-auto-save §3.3).

### Phase 5 — i18n + polish

**P5-S1**: Thêm namespace `trips.calendar` vào 3 file `messages/{vi,en,ko}.json`:

```jsonc
"calendar": {
  "toggleList": "Danh sách" / "List" / "목록",
  "toggleCalendar": "Lịch" / "Calendar" / "캘린더",
  "today": "Hôm nay" / "Today" / "오늘",
  "month": "Tháng" / "Month" / "월",
  "week": "Tuần" / "Week" / "주",
  "day": "Ngày" / "Day" / "일",
  "gantt": "Theo xe" / "By Vehicle" / "차량별",
  "unassigned": "Chưa phân xe" / "Unassigned" / "미배정",
  "moreEvents": "+{count} khác" / "+{count} more" / "+{count}개 더보기",
  "dragHint": "Kéo thả để đổi giờ" / "Drag to reschedule" / "끌어서 일정 변경",
  "rescheduled": "Đã đổi giờ chuyến {ref}" / "Rescheduled {ref}" / "{ref} 일정 변경됨",
  "dragError": "Không thể đổi giờ chuyến này" / "Cannot reschedule this trip" / "이 일정을 변경할 수 없습니다",
  "rangeTooLarge": "Khoảng thời gian quá lớn, vui lòng thu nhỏ" / "Date range too large, please narrow" / "기간이 너무 큽니다"
}
```

└─ 사이드 임팩트: build sẽ fail nếu thiếu key ở 1 locale (next-intl strict). Phải sync 3 file cùng PR.

**P5-S2**: Lazy-load `TripsCalendar` qua `next/dynamic`:
- `const TripsCalendar = dynamic(() => import('./_components/trips-calendar'), { ssr: false })`
- Ý nghĩa: user mặc định ở List view → không load calendar bundle ngay. Khi switch sang calendar → fetch chunk.

└─ 사이드 임팩트: First click sang calendar có ~200ms loading state. Acceptable.

**P5-S3**: Disable drag trên mobile/touch:
- `useEffect` detect `window.matchMedia('(pointer: coarse)').matches` → set `draggable={false}` cho mọi event chip.

└─ 사이드 임팩트: Touch user phải dùng edit form để reschedule. Document trong tooltip.

### Phase 6 — Verify

**P6-S1**: `npm run build` trong `apps/app-car-manager-v2/apps/web` — TypeScript + Next build phải pass.
└─ 사이드 임팩트: nếu strict mode catch unused vars / types → fix immediate.

**P6-S2**: Smoke test theo TC-20260521-*.md (next step).
└─ 사이드 임팩트: nếu test fail → fix + re-run, KHÔNG mark task done.

---

## 3. 변경 파일 목록

| 구분 | File | 변경 | LOC ước tính |
|---|---|---|---|
| FE | `apps/web/package.json` | Modify (add date-fns) | +1 |
| FE | `apps/web/src/app/(app)/trips/page.tsx` | Modify (read `?view`, branch render) | +30 |
| FE | `apps/web/src/app/(app)/trips/_components/trips-calendar.tsx` | New (orchestrator) | ~120 |
| FE | `apps/web/src/app/(app)/trips/_components/calendar/toolbar.tsx` | New | ~70 |
| FE | `apps/web/src/app/(app)/trips/_components/calendar/month-view.tsx` | New | ~180 |
| FE | `apps/web/src/app/(app)/trips/_components/calendar/time-grid-view.tsx` | New | ~190 |
| FE | `apps/web/src/app/(app)/trips/_components/calendar/gantt-view.tsx` | New | ~170 |
| FE | `apps/web/src/app/(app)/trips/_components/calendar/utils.ts` | New (pure helpers) | ~140 |
| FE | `apps/web/src/app/(app)/trips/_components/calendar/types.ts` | New | ~30 |
| FE | `apps/web/src/app/(app)/trips/_components/calendar/permission.ts` | New | ~25 |
| FE | `apps/web/src/app/(app)/trips/_components/list-calendar-toggle.tsx` | New (tiny client toggle) | ~40 |
| BE | `apps/web/src/server/queries/trips.queries.ts` | Modify (add `listTripsForCalendar`) | +60 |
| BE | `apps/web/src/server/actions/trips/trip.actions.ts` | Modify (add `fetchTripsForCalendarAction`) | +30 |
| BE | `packages/shared/src/zod/trip.zod.ts` | Modify (add `fetchCalendarRangeSchema`) | +10 |
| BE | `packages/shared/src/errors/car-error.ts` | Modify (add `CAR-E0413` if missing) | +1 |
| i18n | `apps/web/messages/vi.json` | Modify (add `trips.calendar.*` 12 keys) | +14 |
| i18n | `apps/web/messages/en.json` | Modify | +14 |
| i18n | `apps/web/messages/ko.json` | Modify | +14 |
| DB | — | KHÔNG đổi | 0 |

**Tổng**: ~1140 LOC mới (chủ yếu UI), ~140 LOC modify.

---

## 4. 사이드 임팩트 분석

| # | 범위 | 위험도 | 설명 | Mitigation |
|---|---|---|---|---|
| SI-1 | URL pattern `/trips` | 🟢 Low | Thêm `?view=`, các param cũ vẫn work. Bookmark `/trips?status=pending` không gãy. | Default `view=list` đảm bảo backward compat |
| SI-2 | Bundle size | 🟢 Low | +10kb date-fns. Calendar bundle lazy-loaded qua `next/dynamic` | next/dynamic |
| SI-3 | `updateTripAction` traffic | 🟡 Med | Drag-drop dễ làm user gọi update nhiều lần | Client skip nếu newTime === oldTime; debounce không cần (drop là discrete event) |
| SI-4 | Audit log spam | 🟡 Med | Mỗi drag = 1 audit row | Skip action khi no-change (SI-3 mitigation handle luôn) |
| SI-5 | Permission drift | 🟡 Med | `canDragTrip` clone từ `updateTripAction` — nếu logic update đổi sẽ drift | Comment cross-reference. Server enforce vẫn là final |
| SI-6 | Touch device | 🟢 Low | HTML5 DnD broken trên iOS | Disable drag, document trong dragHint i18n |
| SI-7 | Filter chips & calendar | 🟢 Low | Chips ẩn khi calendar — UX có thể bất ngờ | Hint subtle: toggle Calendar label rõ ràng |
| SI-8 | Driver experience | 🟢 None | Branch sớm — không touch DriverTripsList | — |
| SI-9 | Range > 500 trip | 🟡 Med | Tenant lớn có thể hit limit | Throw CAR-E0413; UI prompt narrow range; defer pagination cho calendar |
| SI-10 | next-intl strict missing keys | 🔴 Build-fail | Thiếu key ở 1 locale → next-intl runtime throw | Sync 3 file cùng commit; CI build check |

---

## 5. DB 마이그레이션

**KHÔNG cần.** Tái dùng schema `car_trips` + index `idx_car_trips_ent_status_scheduled` (cover cols `ent_id` + `trp_scheduled_at`).

Verify trước deploy:
```sql
-- Staging: confirm index exists
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = 'car_trips'
  AND indexname = 'idx_car_trips_ent_status_scheduled';
```

Nếu thiếu → tạo manual (KHÔNG synchronize):
```sql
CREATE INDEX IF NOT EXISTS idx_car_trips_ent_status_scheduled
  ON car_trips (ent_id, trp_status, trp_scheduled_at)
  WHERE trp_deleted_at IS NULL;
```

---

## 6. Deployment plan

1. PR vào `staging-car` (current branch) → review → merge.
2. SSH staging server: `bash platform/scripts/deploy-staging.sh` (KHÔNG `docker compose build` thẳng — per CLAUDE.md root).
3. Smoke test trên `stg-apps.amoeba.site/app-car-manager-v2/trips` (xem TC document).
4. Nếu xanh → PR `staging-car` → `production`.

⚠️ **Không deploy production trực tiếp.** CLAUDE.md §"배포 원칙".

---

## 7. Acceptance criteria (high-level)

- [ ] `npm run build` pass trong `apps/app-car-manager-v2/apps/web`.
- [ ] `/trips?view=calendar` render calendar; `/trips` (no view) render list như cũ.
- [ ] Admin drag PENDING_ASSIGNMENT trip sang ngày khác → DB updated, audit log có row, toast success.
- [ ] Manager drag own trip status pre-confirm → success. Drag trip không phải own → cursor not-allowed.
- [ ] Driver login `/trips` không thấy toggle Calendar.
- [ ] Switch ngôn ngữ → header tháng/tuần đổi locale.
- [ ] localStorage `trips.calendar.subView` + URL `?view=calendar` đồng bộ sau F5 reload.
- [ ] Mobile touch: drag bị disable, click peek/empty vẫn hoạt động.
- [ ] Range > 500 trip → toast `rangeTooLarge` + log error code `CAR-E0413`.
