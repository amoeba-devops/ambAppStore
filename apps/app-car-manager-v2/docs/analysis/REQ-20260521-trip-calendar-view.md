# REQ-20260521 — Trip Calendar View

**Yêu cầu**: Bổ sung **calendar view** cho trang `/trips` để Admin/Manager có cái nhìn trực quan lịch chuyến đi (thay vì list dạng bảng đơn thuần). User chuyển đổi giữa **List ↔ Calendar** qua toggle ở header. Inspiration: Cargorush Reservation Dashboard + G-SABIS Fleet Manager (xem ảnh đính kèm chat 2026-05-21).

**Tag**: `[요구사항]` — workflow REQ → PLAN → TC → Impl → TR → RPT.

**Bối cảnh đặc biệt**:
- PRD §5.3 đã list calendar là **"Should have"**; FR-3.1 mô tả "calendar view (tuần / tháng) — mỗi chuyến là 1 block màu theo xe".
- P3 (Reports + Dashboard) từng implement CalendarView+Month nhưng đã bị xoá toàn bộ trong commit `fdfc336 feat(car-v2): remove Module 3 (Dashboard + Reports) entirely`. Lần này **re-implement nhưng neo vào `/trips`**, không restore Module 3.
- Stack v2 hiện hành: Next.js 15 App Router + RSC + Server Actions + Drizzle + next-intl. **Không có** React Query/SWR. Calendar phải fit pattern này.

---

## 1. 요구사항 요약 (Requirements Summary)

| # | 요구사항 | 유형 |
|---|----------|------|
| R1 | Trang `/trips` thêm toggle **List / Calendar** (persist trong `localStorage`) — Admin/Manager only | UI |
| R2 | Calendar có 4 sub-view: **Month / Week / Day / By Vehicle (Gantt)** — switch trên toolbar nội bộ | UI |
| R3 | Render mọi trip non-deleted của tenant theo scope role (Admin: all · Manager: own + as passenger · Driver: không thấy calendar — driver giữ card list hiện tại) | Functional |
| R4 | Event chip màu theo `trpStatus` (7 trạng thái), label hiển thị `vehiclePlate · passengerName` (fallback ref code) | UI |
| R5 | Trip thời lượng = `trpScheduledAt` + `trpDurationMinutes` (mặc định 60 phút nếu null) | Business |
| R6 | Click event → mở **peek drawer** (giống list hiện tại — `?peek=<tripId>`) thay vì navigate full page | UX |
| R7 | Click ô trống → điều hướng `/trips/new?scheduledAt=<ISO>` (Month: nguyên ngày; Week/Day/Gantt: snap 15 phút) | UX |
| R8 | **Drag-to-reschedule**: gọi `updateTripAction({ scheduled_at })`. Quyền theo state machine hiện tại của `updateTripAction` (xem §3.3) — không bypass logic đã có | Functional |
| R9 | Gantt view: mỗi xe 1 dòng (lấy từ `listVehicles`) + 1 dòng "Chưa phân công" cho trip chưa có `trpVehicleId` | UI |
| R10 | Toolbar: prev / next / **today** + view picker + header tháng/tuần/ngày i18n | UX |
| R11 | i18n 3 ngôn ngữ (vi/en/ko) — thêm namespace `trips.calendar.*` vào `messages/{vi,en,ko}.json` | i18n |
| R12 | "Now indicator" (vạch cam ngang/dọc) ở Week/Day/Gantt khi đang xem ngày hôm nay | UX |
| R13 | Persist sub-view (`month/week/day/gantt`) + outer toggle (`list/calendar`) vào `localStorage` | UX |
| R14 | KHÔNG đổi DB schema. KHÔNG đổi server action contracts. KHÔNG đổi state machine | Constraint |

---

## 2. AS-IS 현황 분석

### 2.1 Frontend — `/trips` page

[`apps/web/src/app/(app)/trips/page.tsx`](../../apps/web/src/app/(app)/trips/page.tsx) (Server Component, async):

- **Driver branch (line 69-84)**: trả về `<DriverTripsList>` — 2-tab Ongoing/Completed, card-only. Không có toggle nào.
- **Admin/Manager branch**: render filter chips (`pending`/`all`/`active`/`completed`) + mobile card list + desktop table + pagination + peek drawer (`?peek=<id>`) + Fab "New trip".
- Trang **không có khái niệm "view mode"** — chỉ 1 cách hiển thị (list/table).
- Header có nút icon `Calendar` ([page.tsx:200](../../apps/web/src/app/(app)/trips/page.tsx#L200)) với label "thisWeek" — **chỉ là date-range hint**, không phải toggle calendar view (hiện chưa wire).

### 2.2 Backend — Trip query + actions

| Khu vực | File | Trạng thái cho calendar |
|---|---|---|
| List query | [`server/queries/trips.queries.ts:32 listTrips`](../../apps/web/src/server/queries/trips.queries.ts#L32) | ❌ Pagination 20 rows, sort desc `scheduledAt`. Không phù hợp calendar (cần fetch theo date range, không phân trang) |
| Single get | [`getTrip`](../../apps/web/src/server/queries/trips.queries.ts) | ✅ Tái dùng cho peek drawer |
| Update | [`updateTripAction`](../../apps/web/src/server/actions/trips/trip.actions.ts#L195) | ✅ Đã hỗ trợ `scheduled_at` partial update. Quyền: Admin (status ≠ COMPLETED), Manager (own + status ∈ {PENDING_ASSIGNMENT, PENDING_DRIVER_CONFIRMATION}), Driver cấm |
| Vehicle list | [`listVehicles`](../../apps/web/src/server/queries/vehicles.queries.ts) | ✅ Đã tồn tại, page.tsx hiện đã import |

### 2.3 DB schema — `car_trips`

[`packages/db/src/schema/trips.schema.ts:36-84`](../../packages/db/src/schema/trips.schema.ts#L36-L84):

| Cột | Dùng cho calendar |
|---|---|
| `trpId`, `trpRef` | Event id + label fallback |
| `trpStatus` (7 enum) | Màu chip |
| `trpScheduledAt` (`TIMESTAMPTZ NOT NULL`) | **Start time** event |
| `trpDurationMinutes` (`SMALLINT` nullable) | **End = start + duration**. Nếu null → fallback 60 phút |
| `trpDriverId`, `trpVehicleId` (nullable) | Gantt view grouping |
| `trpPassengerId` | Visibility filter cho Manager |
| `trpStartedAt`, `trpEndedAt` | Cho IN_PROGRESS/COMPLETED: dùng start/end thực tế thay vì scheduled. (Optional polish — MVP có thể chỉ dùng scheduled) |
| Index `idx_car_trips_ent_status_scheduled` | ✅ Phù hợp cho query theo date range |

### 2.4 i18n

[`apps/web/messages/{vi,en,ko}.json`](../../apps/web/messages/vi.json) — đã có namespace `trips.list`, `trips.status`, `trips.peek`, `trips.form`. **Chưa có** `trips.calendar`.

### 2.5 UI primitives sẵn dùng

[`@car-v2/ui`](../../packages/ui/src/) export sẵn `Button`, `Card`, `Badge`, `Avatar`, `Input`. Không có Calendar primitive — sẽ tự build từ Tailwind + `date-fns`.

### 2.6 Tech debt trên `staging-car`

- Old app `apps/app-car-manager/` (Vite) đã có 1 nhánh dev viết calendar bằng FullCalendar rồi đổi sang custom date-fns (chưa commit). Logic pure (date math + lane assignment) **có thể port** sang v2 dưới dạng utility functions.

---

## 3. TO-BE 요구사항

### 3.1 Mapping AS-IS → TO-BE

| Khu vực | AS-IS | TO-BE |
|---|---|---|
| `/trips` cho Admin/Manager | Chỉ list/table | + Calendar toggle (List/Calendar), default = List để không phá UX hiện tại |
| Fetch trips cho calendar | `listTrips` paginate 20 rows | Thêm `listTripsForCalendar(entId, role, userId, rangeStart, rangeEnd)` — KHÔNG pagination, KHÔNG status filter, có ent_id + visibility filter giống `listTrips` |
| Drag-reschedule | Phải mở edit form, set datetime, submit | Drag event trên grid → call `updateTripAction(id, { scheduled_at })`. Optimistic update qua `revalidatePath` |
| Vehicle context | Chỉ list dùng cho peek drawer assign | Gantt view cần full vehicle list cho rows |
| Driver experience | Card list 2-tab | Giữ nguyên — driver không có calendar |

### 3.2 New query

```ts
// server/queries/trips.queries.ts
export async function listTripsForCalendar(args: {
  entId: string;
  role: LocalRole;
  userId: string;
  rangeStart: Date;  // inclusive
  rangeEnd: Date;    // exclusive
}): Promise<TripListItem[]>
```

- Where:
  - `entId = args.entId`
  - `trpDeletedAt IS NULL`
  - `trpScheduledAt >= rangeStart` AND `trpScheduledAt < rangeEnd` (Note: nếu trip kéo dài qua boundary, chỉ cần `scheduledAt` trong range — vì sub-view sẽ tự clip render. Đơn giản hoá: lấy ±1 ngày buffer ngoài range để cover trip "spill")
  - Visibility filter giống `listTrips`
- Order by `trpScheduledAt ASC`
- No limit (cap soft tại 500 trong server, throw nếu vượt — early signal scale)
- Same joins (passenger, driver name, vehicle plate)

### 3.3 Drag permission rules (clone từ `updateTripAction`)

Event chip **draggable** khi:
- `role === 'ADMIN'` AND `trip.status !== 'COMPLETED'`
- `role === 'MANAGER'` AND `trip.trpCreatorId === userId` AND `trip.status ∈ {PENDING_ASSIGNMENT, PENDING_DRIVER_CONFIRMATION}`

Nếu user drop một event không-draggable → UI silently no-op (không gọi action). Defense-in-depth: server vẫn check quyền và trả `CarError` nếu race condition; UI hiển thị toast lỗi.

### 3.4 Color mapping (chip background / left border)

| Status | Background | Border | Note |
|---|---|---|---|
| `PENDING_ASSIGNMENT` | accent (cam nhạt) | accent-600 | Cần admin gán |
| `PENDING_DRIVER_CONFIRMATION` | warning (vàng) | warning-600 | Chờ tài xế |
| `CONFIRMED` | success (xanh lá) | success-600 | Đã chốt |
| `IN_PROGRESS` | info (xanh dương) | info-600 | Đang chạy |
| `COMPLETED` | neutral (xám) | neutral-500 | Lịch sử |
| `REJECTED_BY_DRIVER` | danger (đỏ) | danger-600 | Cần reassign |
| `CANCELLED` | neutral (xám nhạt) | neutral-400 | Bị huỷ |

Dùng Tailwind tokens đã có trong `@car-v2/ui` (`bg-accent-100`, `border-accent-600`, etc.) — KHÔNG hardcode hex.

### 3.5 UI design (key screens)

```
┌─── /trips ───────────────────────────────────────────────────────────────┐
│ PageHeader: "Chuyến đi"  ·  [Tuần này]  [Bộ lọc]  [Xuất Excel]  [+ Mới]  │
├──────────────────────────────────────────────────────────────────────────┤
│ [chờ] [tất cả] [đang đi] [đã xong]    [🔍 Tìm…]   [≡ List] [📅 Cal] ◄NEW │
├──────────────────────────────────────────────────────────────────────────┤
│ Khi View = Calendar:                                                     │
│                                                                          │
│   ┌── Calendar Toolbar ─────────────────────────────────────────┐        │
│   │ [‹] [Hôm nay] [›]  Tháng 5 2026   [Tháng|Tuần|Ngày|Theo xe] │        │
│   └────────────────────────────────────────────────────────────┘        │
│                                                                          │
│   ┌── Month view (default) ─────────────────────────────────────┐        │
│   │   T2     T3     T4     T5     T6     T7     CN              │        │
│   │  ┌───┬──────┬──────┬──────┬──────┬──────┬─────┐             │        │
│   │  │ 1 │ 2    │ 3 ●  │ 4 ●● │ 5    │ 6    │ 7   │             │        │
│   │  │   │      │ TR-12│TR-13 │      │      │     │             │        │
│   │  │   │      │      │TR-14 │      │      │     │             │        │
│   │  └───┴──────┴──────┴──────┴──────┴──────┴─────┘             │        │
│   └─────────────────────────────────────────────────────────────┘        │
└──────────────────────────────────────────────────────────────────────────┘
```

Khi click event → mở **peek drawer** giống list (URL: `?peek=<tripId>`). Drawer đã có sẵn → tái dùng 100%.

### 3.6 Khi 0 trip trong range hiện tại

- Calendar vẫn render grid trống, KHÔNG hiển thị EmptyState card. Empty grid bản thân nó là chỉ báo trực quan.

---

## 4. 갭 분석

### 4.1 Tóm tắt thay đổi

| Khu vực | Hiện tại | Thay đổi | Mức ảnh hưởng |
|---|---|---|---|
| `apps/web/src/app/(app)/trips/page.tsx` | Server Component render list | Thêm logic đọc `?view=calendar`, conditional render `<TripsCalendar>` Client Component | 🟡 Trung |
| `server/queries/trips.queries.ts` | Có `listTrips` + `getTrip` | Thêm `listTripsForCalendar` | 🟢 Thấp |
| `server/actions/trips/trip.actions.ts` | Có `updateTripAction` đầy đủ | ✅ Không đổi (reuse) | 🟢 Không |
| `messages/{vi,en,ko}.json` | Có `trips.list`, `trips.status` | Thêm namespace `trips.calendar` (~12 keys) | 🟢 Thấp |
| `_components/` mới | — | `TripsCalendar.tsx` (orchestrator) + `CalendarToolbar.tsx` + `CalendarMonthView.tsx` + `CalendarTimeGridView.tsx` + `CalendarGanttView.tsx` + `calendar-utils.ts` + `calendar-types.ts` | 🟡 Trung |
| Drizzle schema | `trips.schema.ts` | ✅ Không đổi | 🟢 Không |
| Server Actions API | snake_case | ✅ Không đổi | 🟢 Không |
| Dependencies | Không có `date-fns` | Thêm `date-fns@^4.x` vào `apps/web/package.json` | 🟢 Thấp |

### 4.2 File changes detail

| Type | Path | Action |
|---|---|---|
| Modify | `apps/web/src/app/(app)/trips/page.tsx` | Read `?view`, branch render List vs Calendar; pass initial range |
| Create | `apps/web/src/app/(app)/trips/_components/trips-calendar.tsx` | Client Component orchestrator |
| Create | `apps/web/src/app/(app)/trips/_components/calendar/toolbar.tsx` | View picker + nav |
| Create | `apps/web/src/app/(app)/trips/_components/calendar/month-view.tsx` | 7×6 grid + multi-day event bars |
| Create | `apps/web/src/app/(app)/trips/_components/calendar/time-grid-view.tsx` | Week + Day (parametric `dayCount`) |
| Create | `apps/web/src/app/(app)/trips/_components/calendar/gantt-view.tsx` | Vehicle rows × time |
| Create | `apps/web/src/app/(app)/trips/_components/calendar/utils.ts` | date-fns helpers, lane assignment, locale resolver, color tokens |
| Create | `apps/web/src/app/(app)/trips/_components/calendar/types.ts` | `CalendarEvent`, `CalendarViewType` |
| Modify | `apps/web/src/server/queries/trips.queries.ts` | Add `listTripsForCalendar` |
| Modify | `apps/web/messages/vi.json` · `en.json` · `ko.json` | Add `trips.calendar.*` keys |
| Modify | `apps/web/package.json` | Add `date-fns` dep |

### 4.3 DB migration

**Không cần.** Tái dùng schema hiện tại. Index `idx_car_trips_ent_status_scheduled` đã cover query mới.

### 4.4 Side impacts

| Khu vực | Risk | Mitigation |
|---|---|---|
| `listTrips` pagination logic | Không đổi | — |
| `updateTripAction` permission | Không đổi — drag-reschedule reuse | UI clone permission rules nhưng server vẫn enforce |
| Peek drawer flow | URL pattern `?peek=` đã có | Calendar click → set `?peek=`, drawer trigger không đổi |
| Filter chips (pending/all/active/completed) | Khi `view=calendar` thì filter chips có ý nghĩa khác (range chứ không phải status). | **Quyết định**: Calendar **bỏ qua filter chips** — luôn hiện tất cả trip non-deleted trong range. Chips ẩn khi view=calendar |
| URL state | `?status=`, `?page=`, `?peek=`, `?highlight=` đã có | Thêm `?view=` (default = `list`). Khi calendar mode, `?page=` và `?status=` ignored |
| Bundle size | date-fns thêm ~10kb gz (tree-shaken) | Acceptable |
| Driver role | Calendar không show cho driver | Code branch sớm như hiện tại — không thay đổi DriverTripsList |
| Mobile | Calendar trên screen nhỏ | MVP: Month + Week khá khó dùng trên mobile. Đề xuất: trên mobile, default Day view; Month/Week scroll horizontal. Gantt thì luôn horizontal scroll |

---

## 5. 사용자 플로우

### 5.1 Flow 1 — Admin lên lịch nhiều chuyến cùng tuần

```
[Admin mở /trips]
        │
        ▼
[Mặc định: List view, filter "pending"]
        │
        ▼
[Click toggle 📅 Calendar]
        │  → ?view=calendar, persist localStorage
        ▼
[Calendar Month view, tháng hiện tại]
        │
        ├── Click ô ngày trống ───►  /trips/new?scheduledAt=2026-05-22T00:00:00Z
        │                              (form preset date, time mặc định)
        │
        ├── Click event chip ──────►  ?peek=<tripId> → Peek drawer mở
        │                              ┌─ Click "Mở trang chi tiết đầy đủ"
        │                              │     → /trips/<id>
        │                              └─ Esc / click outside → close drawer
        │
        ├── Click [Tuần] ─────────►  Switch sub-view → Week
        │
        └── Drag PENDING event sang ngày khác
              → updateTripAction(id, { scheduled_at: new ISO })
              → server check permission (Manager: own + status pre-confirm; Admin: ≠ COMPLETED)
              → success: revalidatePath('/trips'), Drizzle update
              → fail: toast error, event revert về vị trí cũ
```

### 5.2 Flow 2 — Manager xem lịch chuyến cá nhân

```
[Manager mở /trips]
        │
        ▼
[Toggle Calendar]
        │
        ▼
[Chỉ thấy trip MANAGER tạo HOẶC trip MANAGER là passenger]
        │  (visibility filter giống listTrips)
        │
        └── Drag event:
              - PENDING_ASSIGNMENT của mình → OK
              - PENDING_DRIVER_CONFIRMATION của mình → OK
              - CONFIRMED → cursor "not-allowed", drag không kích hoạt
```

### 5.3 Flow 3 — Switch sub-view + persist

```
[User ở Month, F5 reload]
        │
        ▼
[Đọc localStorage 'trips.calendar.subView' → 'month'] → render Month
[Đọc localStorage 'trips.viewMode' → 'calendar'] → outer view = Calendar
        │
        ▼
[User click "Theo xe" (Gantt)]
        │
        ▼
[localStorage updated: subView = 'gantt']
[Render Gantt với listVehicles + listTripsForCalendar (anchor day)]
        │
        ▼
[F5 reload → vẫn ở Gantt]
```

### 5.4 Flow 4 — Lỗi quyền khi drag

```
[Manager drag trip người khác (rare — UI đã filter draggable)]
        │
        ▼
[Server: updateTripAction throws CarError('CAR-E1005', 403)]
        │
        ▼
[Client catch → toast "Bạn không có quyền chỉnh chuyến này"]
[Event UI revert về vị trí cũ qua revalidatePath]
```

---

## 6. 기술 제약사항

### 6.1 Compatibility

- **Browser**: Chrome ≥ 100, Safari ≥ 15, Firefox ≥ 100. Drag-drop dùng native HTML5 DnD API (không lib).
- **Mobile (PWA)**: HTML5 DnD trên iOS Safari có quirks → MVP **disable drag trên touch device** (`pointer: coarse` media query). Touch user vẫn click-to-peek, click-empty-to-create. Reschedule qua edit form.
- **Server Component / Client Component split**: `page.tsx` vẫn Server Component để tận dụng RSC fetch parallel. `<TripsCalendar>` là Client Component (`'use client'`) — interactive state, localStorage, drag handlers.

### 6.2 Performance

- Query range mặc định:
  - Month: rangeStart = startOfMonth(anchor) - 7 days; rangeEnd = endOfMonth(anchor) + 7 days
  - Week: rangeStart = startOfWeek; rangeEnd = endOfWeek + 1 day
  - Day: rangeStart = startOfDay; rangeEnd = endOfDay + 1 day
  - Gantt: same as Day
- Cap server: 500 trips/range. Với 3 xe × 30 ngày × avg 5 trip/day = 450 → ok. Nếu tenant scale → throw `CAR-E0413` (range too large), UI prompt narrow range.
- Bundle: date-fns tree-shaken ~10kb gz. Không dùng moment / dayjs. Lazy-load `<TripsCalendar>` qua `next/dynamic` để không impact List-only users.

### 6.3 Security & multi-tenancy

- `listTripsForCalendar` MUST include `entId` filter (CLAUDE.md §4.1 — không bypass).
- Visibility filter (Admin all / Manager own+passenger / Driver block) phải giống `listTrips`.
- `updateTripAction` đã enforce; UI clone rules chỉ để UX. **Không trust client**.

### 6.4 i18n

- Key namespace: `trips.calendar.*` (xem PLAN cho danh sách đầy đủ).
- date-fns locale: `vi`, `ko`, `enUS` — resolve từ `next-intl` `useLocale()` hook.

### 6.5 Audit log

- Drag-reschedule chui qua `updateTripAction` → audit `TRIP.UPDATE` với `after.fields = ['trpScheduledAt']` đã có sẵn. Không cần code thêm.

### 6.6 Out of scope (giai đoạn này)

- ❌ Resize event (kéo cạnh phải đổi duration) — chỉ MOVE
- ❌ Drag giữa các vehicle row trong Gantt (đổi xe assignment) — chỉ MOVE trên trục thời gian
- ❌ Filter by vehicle/driver trên calendar — defer
- ❌ Export Excel/PDF từ calendar view — defer
- ❌ Conflict warning hiển thị trên calendar — chờ Gap B của P4 (xem CLAUDE.md §6.1) wire xong rồi mới integrate
- ❌ Email/Push notification khi reschedule — `updateTripAction` chưa notify ai khi đổi giờ; defer là PRD R4 follow-up
- ❌ Restore Module 3 (Dashboard) — calendar đứng độc lập trong `/trips`

---

## 7. Open questions

| # | Câu hỏi | Default decision (nếu user không phản hồi) |
|---|---------|--------------------------------------------|
| Q1 | Driver có cần xem calendar bản giản lược không? | KHÔNG — driver giữ card list 2-tab. Có thể thêm sau ở P5 (PWA polish) |
| Q2 | Calendar hiển thị `trpStartedAt`/`trpEndedAt` thực tế cho IN_PROGRESS/COMPLETED, hay vẫn dùng `trpScheduledAt`? | MVP: luôn dùng `scheduledAt + duration`. Polish sau |
| Q3 | Khi range > 500 trip throw error, hay silent truncate + warn? | Throw `CAR-E0413` + UI prompt; rõ hơn cho user |
| Q4 | Anchor date khi mở calendar lần đầu | `new Date()` (hôm nay) — không persist anchor (chỉ persist sub-view) |
| Q5 | Drag trong Gantt: cho phép drop sang vehicle row khác không? | KHÔNG — out of scope; chỉ drag trong cùng row (đổi giờ). Đổi xe phải qua peek drawer (assign action) |
