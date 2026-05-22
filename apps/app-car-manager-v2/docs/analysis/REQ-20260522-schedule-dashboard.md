# REQ-20260522 — Schedule Dashboard (`/schedule` route)

**Yêu cầu gốc**: "Xây dựng giao diện **Dashboard** quản lý và đăng ký lịch sử dụng xe công vụ dạng **Lịch (Calendar View)**."

**Tag**: `[요구사항]` — workflow REQ → PLAN → TC → Impl → TR → RPT.

**Mối quan hệ với REQ trước**:
- [REQ-20260521-trip-calendar-view.md](REQ-20260521-trip-calendar-view.md) đã build calendar view dưới dạng **toggle trong `/trips`**. REQ-20260522 này **promote calendar lên Dashboard route riêng** + thêm **right-rail booking form** + **landing redirect** — tức là REQ-1 đặt sai chỗ, REQ-2 đặt lại đúng chỗ.
- ~95% code calendar từ REQ-1 sẽ **reuse trực tiếp** (4 view component, utils, types, permission, query, action, i18n keys); chỉ thay đổi wiring layer.

**Bối cảnh quyết định (2026-05-22 chat)**: Cargorush + G-SABIS reference screenshot cho thấy "Reservation Dashboard" là **top-level surface**, không phải view-mode của list. i18n key `nav.schedule = "Lịch trình"` đã có sẵn trong `messages/vi.json` từ trước → routing intent đã được plan.

---

## 1. 요구사항 요약

| # | 요구사항 | 유형 | 우선순위 |
|---|----------|------|---------|
| R1 | Tạo route mới `apps/(app)/schedule/page.tsx` — primary surface, Server Component | Functional | **MUST** |
| R2 | Sidebar nav: thêm entry "Lịch trình" (icon `Calendar` từ lucide) — đứng sau "Hôm nay", trước "Chuyến đi" | UI | **MUST** |
| R3 | Default landing: Admin/Manager `/` → redirect `/schedule`. Driver giữ `/today`. | UX | **MUST** |
| R4 | Layout 2 cột (desktop): **trái = Calendar 70%**, **phải = Right rail 30%** (sticky-top) | UI | **MUST** |
| R5 | Right rail có **`<QuickBookForm>` luôn visible** — compact form tạo trip không cần navigate | Functional | **MUST** |
| R6 | Right rail có **`<VehicleLegend>`** — list xe + status counts + color key | UI | **MUST** |
| R7 | Calendar reuse 4 sub-view (Month/Week/Day/Gantt) từ REQ-1 | Refactor | **MUST** |
| R8 | Drag-to-reschedule + click peek drawer + i18n — reuse từ REQ-1 | Functional | **MUST** |
| R9 | Revert `/trips` toggle Calendar/List — `/trips` quay lại pure list (như trước REQ-1) | Cleanup | **MUST** |
| R10 | Mobile responsive: calendar trên, right rail dưới (collapsible) | UX | **MUST** |
| R11 | KPI strip header: today count / week count / pending count | UX | SHOULD |
| R12 | Filter chips trên Dashboard: my-trips / all / by-vehicle / by-driver | UX | SHOULD |
| R13 | Conflict warning banner khi tạo qua `<QuickBookForm>` | Functional | COULD (chờ Gap B P4) |
| R14 | Export `.ics` từ calendar | Functional | COULD |

---

## 2. AS-IS 현황 분석

### 2.1 Route structure hiện tại

```
apps/(app)/
├── audit/
├── drivers/
├── expenses/
├── inbox/
├── settings/
├── today/             ← Landing hiện tại (single-day overview)
├── trips/             ← REQ-1 vừa thêm calendar toggle
├── users/
└── vehicles/
```

| Route | Vai trò hiện tại | Phù hợp với "Dashboard" requirement? |
|---|---|---|
| `/today` | Cá nhân, single-day. Admin/Manager landing. Driver có PWA-first view riêng. | ❌ Semantic "today" sai cho multi-day calendar |
| `/trips` | List/table với pagination + filter. + Calendar toggle (REQ-1). | ❌ Toggle không phải "Dashboard" — đặt sai chỗ |
| `/vehicles`, `/drivers` | Entity management | ❌ Không phải booking surface |

### 2.2 Sidebar nav

[`apps/web/messages/vi.json:12-24`](../../apps/web/messages/vi.json#L12-L24):

```jsonc
"nav": {
  "today": "Hôm nay",
  "trips": "Chuyến đi",
  "tripsMine": "Chuyến của tôi",
  ...
  "schedule": "Lịch trình",   ← Key đã có sẵn nhưng không route nào dùng
  ...
}
```

→ Có ai đó đã reserve i18n key này. Sidebar component cần check.

### 2.3 Calendar code đã có (từ REQ-1, working tree, chưa commit)

| Path | Status | Action trong REQ-2 |
|---|---|---|
| `apps/(app)/trips/_components/calendar/{types,utils,permission}.ts` | ✅ Pure | **MOVE** → `apps/(app)/schedule/_components/calendar/` |
| `apps/(app)/trips/_components/calendar/{toolbar,month-view,time-grid-view,gantt-view}.tsx` | ✅ Pure UI | **MOVE** sang `/schedule` cùng path |
| `apps/(app)/trips/_components/trips-calendar.tsx` | ♻️ Orchestrator | **MOVE + RENAME** → `schedule-view.tsx`, đổi `?peek=` URL base từ `/trips` sang `/schedule`, click navigate `/trips/{id}` |
| `apps/(app)/trips/_components/list-calendar-toggle.tsx` | ❌ | **DELETE** (không còn toggle) |
| `apps/(app)/trips/page.tsx` calendar branch + ListCalendarToggle | ❌ | **REVERT** (giữ list pure như trước REQ-1) |
| `server/queries/trips.queries.ts` `listTripsForCalendar` | ✅ | **KEEP** — dùng cho `/schedule` |
| `server/actions/trip.actions.ts` `fetchTripsForCalendarAction` | ✅ | **KEEP** |
| `messages/{vi,en,ko}.json` `trips.calendar.*` keys | ♻️ | **RENAME** namespace → `schedule.*` (semantic đúng) |

### 2.4 Existing patterns to reuse

| Pattern | Reference | Dùng cho |
|---|---|---|
| Compact form tách từ `/trips/new` | [`trips/new/new-trip-form.tsx`](../../apps/web/src/app/(app)/trips/new/new-trip-form.tsx) | Right rail `<QuickBookForm>` |
| `listVehicles` + `countVehiclesByStatus` | [`vehicles.queries.ts`](../../apps/web/src/server/queries/vehicles.queries.ts) | Right rail `<VehicleLegend>` |
| Peek drawer URL pattern `?peek=<id>` | [`trips/_components/trip-peek-drawer.tsx`](../../apps/web/src/app/(app)/trips/_components/trip-peek-drawer.tsx) | Click event chip trên calendar |
| Server Action wrap pattern | [`actions/_helpers.ts runAction`](../../apps/web/src/server/actions/_helpers.ts) | Mọi mutation từ Client |
| `createTripAction` | [`trip.actions.ts:33`](../../apps/web/src/server/actions/trips/trip.actions.ts#L33) | QuickBookForm submit handler |

### 2.5 Landing redirect mechanism

Hiện chưa có routing override — Next 15 mặc định `/` resolve theo `app/page.tsx`. Cần check:
- Có `app/page.tsx` không? Nếu không → redirect bằng `middleware.ts` hoặc `app/(app)/layout.tsx`
- Hoặc gắn redirect vào `apps/(app)/(redirect)/page.tsx`

---

## 3. TO-BE 요구사항

### 3.1 Route tree mới

```
apps/(app)/
├── today/             (giữ, default cho DRIVER)
├── schedule/          ← MỚI: Dashboard cho ADMIN/MANAGER
│   ├── page.tsx                          Server Component
│   └── _components/
│       ├── schedule-view.tsx             Orchestrator (rename từ trips-calendar.tsx)
│       ├── quick-book-form.tsx           Right rail booking form
│       ├── vehicle-legend.tsx            Right rail vehicle status
│       └── calendar/                     4 view + utils (move từ trips/)
│           ├── types.ts, utils.ts, permission.ts
│           ├── toolbar.tsx
│           ├── month-view.tsx
│           ├── time-grid-view.tsx
│           └── gantt-view.tsx
├── trips/             (revert: pure list, không calendar)
└── ... (other routes unchanged)
```

### 3.2 Layout `/schedule`

```
┌── PageHeader: "Lịch trình" · breadcrumbs ─────────────────────────────────┐
│                                                                            │
├──────────────────────────────────────────┬─────────────────────────────────┤
│ [KPI strip: today=3 · week=12 · pending=5] R11 SHOULD                      │
│ [Filter chips: All · My · Vehicle ▾ · Driver ▾] R12 SHOULD                 │
├──────────────────────────────────────────┼─────────────────────────────────┤
│ Calendar Toolbar:                          │ VehicleLegend (sticky top)    │
│ [‹ Today ›] May 2026  [M|W|D|Gantt]       │  🟢 51A-12345  Available      │
│                                            │  🔵 51B-67890  In Use (3)     │
│                                            │  🟡 51C-11111  Maintenance    │
│ Calendar View (Month default):             ├─────────────────────────────────┤
│                                            │ QuickBookForm                  │
│ T2 T3 T4 T5 T6 T7 CN                       │  ─────────────                 │
│ ┌──────────────────────────────┐           │  Passenger     [▾]            │
│ │ 1   2   3   4   5   6   7    │           │  Pickup        [────]         │
│ │ 8   9   10  11  12  13  14   │           │  Dropoff       [────]         │
│ │ 15  16  17  18  19  20  21   │           │  Schedule      [📅 ⏰]        │
│ │ 22  23  24  25  26  27  28   │           │  Vehicle       [▾ optional]   │
│ │ 29  30  31                   │           │  Driver        [▾ optional]   │
│ └──────────────────────────────┘           │  Purpose       [────]         │
│                                            │  Notes         [────]         │
│                                            │                                │
│                                            │  [Reset]  [✓ Tạo chuyến]     │
└──────────────────────────────────────────┴─────────────────────────────────┘
```

**Tỉ lệ cột (desktop ≥ md)**: `calendar : rail = 70 : 30` (CSS grid hoặc flex `flex-1 + w-[360px]`).

**Mobile (< md)**: stack vertical, calendar trên, rail bên dưới (collapsible accordion để không che view).

### 3.3 `<QuickBookForm>` spec

| Field | Component | Required | Default |
|---|---|---|---|
| Passenger | Select (dropdown) | ❌ (Admin có thể tạo cho user khác) | Self |
| Pickup address | Input + Google Places autocomplete (đã có) | ✅ | — |
| Dropoff address | Input + Google Places | ✅ | — |
| Scheduled date | DatePicker | ✅ | Today |
| Scheduled time | TimePicker | ✅ | +1h từ now, snap 15 min |
| Duration | NumberInput (phút) | ❌ | 60 |
| Vehicle | Select (`listVehicles`) | ❌ | None |
| Driver | Select (`listDrivers`) | ❌ (paired với vehicle) | None |
| Purpose | Input (max 255) | ❌ | — |
| Notes | Textarea (max 2000) | ❌ | — |

**Submit handler**:
- Gọi `createTripAction` (action có sẵn)
- Success → toast `Đã tạo chuyến TR-XXXX` + refresh calendar data + reset form
- Error → toast lỗi, giữ data

**Differences vs `/trips/new`**:
- Compact layout (1 cột thay vì sectioned)
- Không có stopovers (MVP) — link "Cần điểm ghé? Mở form đầy đủ →" → navigate `/trips/new?...`
- Không có proxy-as-other-user toggle (chỉ Admin dùng, hiếm dùng từ Dashboard) — defer

### 3.4 `<VehicleLegend>` spec

| Phần | Nội dung |
|---|---|
| Mỗi xe (1 row) | Avatar/color chip · Plate number · Status badge (Available / In Use × N / Maintenance) |
| Color | Random palette 8 màu hoặc gán theo `cvhId` (deterministic). Phù hợp với event chip màu trên calendar nếu chọn color-by-vehicle mode (xem R12) |
| Click row | Filter calendar theo xe đó (toggle) |
| Footer link | "Quản lý xe →" navigate `/vehicles` |

**Data source**: `listVehicles(entId)` + `listTripsForCalendar` đếm IN_PROGRESS/CONFIRMED hôm nay.

### 3.5 Landing redirect

Implement bằng `middleware.ts` (hoặc nâng cấp `apps/(app)/layout.tsx`):

```ts
// middleware.ts pseudocode
if (pathname === '/') {
  const user = await readJwtFromCookie();
  if (!user) return next(); // let unauth flow handle
  if (user.role === 'DRIVER') return redirect('/today');
  return redirect('/schedule');
}
```

**Backward compat**: bookmark cũ `/today` vẫn work cho mọi role; chỉ root `/` thay đổi target.

### 3.6 Sidebar nav update

Thêm entry `schedule` ngay sau `today`:

```
| Today (icon: Sun)
| **Schedule (icon: Calendar) ← MỚI**
| Trips (icon: Route)
| ... (rest unchanged)
```

i18n key `nav.schedule` đã có (vi/en/ko cần verify đủ).

### 3.7 Click event on calendar → peek drawer

Hiện tại trong REQ-1 implementation, click event `?peek=<id>` mở drawer **trên `/trips`**. Trong `/schedule`, ta có 2 option:

| Option | Behavior |
|---|---|
| **A: Peek inline trong `/schedule`** | Click event → drawer overlay trên `/schedule` (không navigate). Phải mount `<TripPeekDrawer>` trong page.tsx. **Recommended**. |
| B: Navigate `/trips?peek=<id>` | Rời `/schedule`. Phá vỡ UX dashboard. |

→ Chọn **A**. Mount drawer trong `/schedule/page.tsx` y như `/trips/page.tsx` đang làm.

---

## 4. 갭 분석

### 4.1 Summary

| Khu vực | Hiện tại (sau REQ-1) | Sau REQ-2 | Mức ảnh hưởng |
|---|---|---|---|
| Route `/trips` | Có calendar toggle | Pure list (revert) | 🟡 Med (revert) |
| Route `/schedule` | Không tồn tại | Dashboard 2 cột | 🔴 High (new route + 2 component) |
| Sidebar nav | 9 items | 10 items (+ Schedule) | 🟢 Low |
| Default landing | `/today` cho mọi role | Admin/Manager → `/schedule`, Driver → `/today` | 🟡 Med (middleware) |
| i18n | `trips.calendar.*` | `schedule.*` + new keys cho form/legend/KPI | 🟢 Low (rename + add) |
| Calendar code | Trong `/trips/_components/calendar/` | Trong `/schedule/_components/calendar/` | 🟢 Low (move) |
| Server actions/queries | `listTripsForCalendar`, `fetchTripsForCalendarAction` | Unchanged | 🟢 None |

### 4.2 File changes detail

**Move (giữ nguyên logic)**:
| From | To |
|---|---|
| `trips/_components/calendar/*` | `schedule/_components/calendar/*` |
| `trips/_components/trips-calendar.tsx` | `schedule/_components/schedule-view.tsx` (rename + adjust URL params) |

**Delete**:
| Path | Lý do |
|---|---|
| `trips/_components/list-calendar-toggle.tsx` | Không còn toggle |
| `trips/page.tsx` calendar branch (lines added by REQ-1) | Revert |

**Create**:
| Path | Purpose | LOC ước tính |
|---|---|---|
| `schedule/page.tsx` | Server Component, layout 2 cột | ~120 |
| `schedule/_components/quick-book-form.tsx` | Right rail booking form Client Component | ~250 |
| `schedule/_components/vehicle-legend.tsx` | Right rail vehicle status | ~80 |
| `middleware.ts` (or update) | Landing redirect logic | ~30 |
| (sidebar component file) | + 1 nav entry | ~5 |

**Modify**:
| Path | Change |
|---|---|
| `messages/{vi,en,ko}.json` | Rename `trips.calendar` → `schedule.calendar` + add `schedule.form.*`, `schedule.legend.*`, `schedule.kpi.*` (~25 keys × 3) |

### 4.3 DB migration

**Không cần.** Reuse query/action có sẵn từ REQ-1.

### 4.4 Side impacts

| # | Risk | Mitigation |
|---|---|---|
| SI-1 | Sidebar bị overcrowded (10 items) | Nhóm `today + schedule + trips` thành section "Lịch & Chuyến đi" nếu cần |
| SI-2 | Landing redirect phá UX user đã bookmark `/today` | Bookmark `/today` vẫn work; chỉ root `/` đổi target |
| SI-3 | `/trips` revert làm mất feature cho user đã dùng calendar trong list | Calendar feature mới chỉ tồn tại từ REQ-1 (chưa deploy production) → không có user dependency |
| SI-4 | `<QuickBookForm>` simplified bỏ stopovers → user phức tạp phải navigate `/trips/new` | Link rõ "Cần điểm ghé? Mở form đầy đủ →" trong form footer |
| SI-5 | `<VehicleLegend>` click-to-filter chưa hoàn chỉnh nếu filter chips R12 (SHOULD) chưa land MVP | MVP P0: legend chỉ hiển thị, không click-to-filter. Filter chip ở P1 |
| SI-6 | Right rail trên màn hình nhỏ (< 1280px) bị crowded | Breakpoint `md:` switch sang stack vertical; trên `lg+` mới 2 cột |
| SI-7 | `createTripAction` từ form → conflict với hiện trạng `/trips/new` validation | Reuse same Zod schema `createTripSchema` — không bypass |

---

## 5. 사용자 플로우

### 5.1 Flow 1 — Admin mở app, tạo trip qua Dashboard

```
[Login → JWT verified]
        ↓
[Middleware: role=ADMIN, path=/]
        ↓
[Redirect → /schedule]
        ↓
[/schedule render: Calendar Month + QuickBookForm + VehicleLegend]
        ↓
[Admin nhìn calendar → thấy ngày 25/5 trống]
        ↓
[Click ô ngày 25/5 trong calendar]
        ↓
[QuickBookForm field "Scheduled date" auto-fill 25/5/2026]
        ↓
[Admin nhập pickup/dropoff, chọn vehicle, click "Tạo chuyến"]
        ↓
[createTripAction → DB insert → audit log]
        ↓
[Toast "Đã tạo chuyến TR-1234"]
[Calendar refresh → event chip xuất hiện ở ô 25/5]
[Form reset]
```

### 5.2 Flow 2 — Manager đổi giờ chuyến qua drag

```
[Manager mở /schedule]
        ↓
[Calendar render — chỉ thấy own trips]
        ↓
[Hover event PENDING_ASSIGNMENT của mình → cursor grab]
        ↓
[Drag sang ngày khác / giờ khác]
        ↓
[updateTripAction({ scheduled_at }) → success]
        ↓
[Toast "Đã đổi giờ chuyến TR-1234" · calendar update]
```

### 5.3 Flow 3 — Driver login

```
[Login → JWT verified]
        ↓
[Middleware: role=DRIVER, path=/]
        ↓
[Redirect → /today (DriverTodayView PWA-first)]
        ↓
[Sidebar không show entry Schedule] (Schedule chỉ Admin/Manager)
```

### 5.4 Flow 4 — Admin click event → peek drawer

```
[Admin ở /schedule, click event chip]
        ↓
[URL update: /schedule?peek=trp-xyz (không rời /schedule)]
        ↓
[TripPeekDrawer mở (component shared với /trips)]
        ↓
[Đọc thông tin · click "Mở trang chi tiết" → /trips/{id}]
HOẶC
[Click "Approve" / "Assign" → action chạy → drawer close]
        ↓
[Calendar refresh nếu có thay đổi trạng thái]
```

### 5.5 Flow 5 — Mobile responsive

```
[User mở /schedule trên iPhone (< md)]
        ↓
[Stack vertical: PageHeader → Calendar → VehicleLegend → QuickBookForm]
        ↓
[Calendar Month view scroll horizontal trong viewport hẹp]
[VehicleLegend collapsed mặc định, accordion mở rộng]
[QuickBookForm accordion collapsed, expand khi user tap]
[Drag-drop DISABLED (touch device, REQ-1 đã handle)]
```

---

## 6. 기술 제약사항

### 6.1 Layer separation (CLAUDE.md §4.2)

- `/schedule/page.tsx` = Server Component, parallel fetch (`listTripsForCalendar` + `listVehicles` + `countVehiclesByStatus`)
- `<ScheduleView>`, `<QuickBookForm>`, `<VehicleLegend>` = Client Components (`'use client'`)
- `<QuickBookForm>` mutations → `createTripAction` (đã có)

### 6.2 Multi-tenancy

- Mọi query include `ent_id` từ JWT (đã enforce trong REQ-1 query layer)
- `<VehicleLegend>` data từ `listVehicles(entId)` (đã filter)

### 6.3 Permission

- Route `/schedule` chỉ ADMIN + MANAGER. DRIVER access → redirect `/today` qua middleware
- Drag-to-reschedule permission inherit từ REQ-1 (`canDragTrip`)
- `<QuickBookForm>` create: ADMIN có thể chọn passenger khác; MANAGER default = self (giống `/trips/new`)

### 6.4 Performance

- Calendar query cap 500 trips (đã có từ REQ-1)
- `<VehicleLegend>` server-side render initial counts; client refetch on calendar refresh (debounce)
- Calendar chunk lazy-loaded (REQ-1 đã có)
- Sticky right rail dùng `position: sticky` thay vì JS scroll listener

### 6.5 i18n

Namespace mới `schedule.*`:
- `schedule.title`, `schedule.subtitle`
- `schedule.calendar.*` (move từ `trips.calendar.*`)
- `schedule.form.*` (QuickBookForm labels)
- `schedule.legend.*` (Vehicle legend labels)
- `schedule.kpi.*` (KPI strip — P1 SHOULD)

### 6.6 Routing & redirects

- Middleware redirect `/` → `/schedule` cho ADMIN/MANAGER, `/today` cho DRIVER
- Existing route `/today` vẫn work cho mọi role (không xoá)
- `/trips` revert calendar branch + toggle

### 6.7 Out of scope (giai đoạn này)

- ❌ KPI strip (R11 — SHOULD, P1)
- ❌ Filter chips on Dashboard (R12 — SHOULD, P1)
- ❌ Click VehicleLegend row → filter calendar (depend on R12)
- ❌ Conflict banner trong QuickBookForm (R13 — COULD, chờ Gap B P4)
- ❌ Export `.ics` (R14 — COULD)
- ❌ Stopovers trong QuickBookForm (escape hatch link → `/trips/new`)
- ❌ Proxy-as-other-user toggle trong QuickBookForm (defer)
- ❌ Drag-to-create (drag từ rail xuống calendar cell) — defer P1

---

## 7. Acceptance criteria (high-level)

- [ ] `/schedule` route accessible cho ADMIN/MANAGER
- [ ] `/` redirect: ADMIN/MANAGER → `/schedule`, DRIVER → `/today`
- [ ] Sidebar có entry "Lịch trình" (ADMIN/MANAGER thấy, DRIVER không thấy)
- [ ] Calendar Month/Week/Day/Gantt hoạt động (reuse REQ-1)
- [ ] `<QuickBookForm>` tạo trip → toast success → calendar update
- [ ] `<VehicleLegend>` hiển thị danh sách xe + status (Available / In Use × N / Maintenance)
- [ ] Click event chip → peek drawer mở overlay trên `/schedule` (không navigate `/trips`)
- [ ] Drag-to-reschedule vẫn work như REQ-1
- [ ] `/trips` không còn calendar toggle (revert)
- [ ] Mobile (< md): layout stack vertical, calendar trên, rail collapsed dưới
- [ ] Build + lint + typecheck pass
- [ ] i18n 3 ngôn ngữ test ít nhất 1 lần

---

## 8. Open questions — DECISIONS (resolved 2026-05-22)

| # | Câu hỏi | **DECISION** |
|---|---------|--------------|
| Q1 | Route name | **`/dashboard`** (đổi từ `/schedule` per chat — match đúng từ "Dashboard" trong requirement gốc). Sidebar label: "Dashboard" (en) / "대시보드" (ko) / "Bảng điều khiển" (vi). i18n key cũ `nav.schedule` deprecate, key mới `nav.dashboard` |
| Q2 | Calendar event color | **By vehicle** (Cargorush style — đổi từ "by status") ngay từ MVP. Mỗi xe = 1 màu deterministic (hash `cvhId` → 8-color palette từ `tokens.ts chartColors`). Event không có vehicle → fallback "neutral gray" với border-l dashed. VehicleLegend hiển thị cùng màu để user map mắt |
| Q3 | KPI strip + Filter chips | **P1 SHOULD** (giữ default) — focus core P0 trước |
| Q4 | Sidebar icon | Icon `LayoutDashboard` từ lucide (đổi từ `Calendar` cho hợp semantic "Dashboard") |
| Q5 | QuickBookForm draft localStorage | **CÓ trong MVP** (đổi từ defer). Key `dashboard.quickBook.draft`. Debounce 500ms text fields, immediate cho Select/Date. Restore on form mount. Clear on submit success |
| Q6 | Mobile QuickBookForm collapse | Collapsed default — giữ default |
| Q7 | Driver vào `/dashboard` cố tình | Redirect `/today` — giữ default |
| Q8 | Anchor date persist | Không persist — giữ default (sub-view vẫn persist từ REQ-1) |

**Tác động lên scope MUST**: Q2 + Q5 thêm vào → ước tính +1 ngày work so với base.
