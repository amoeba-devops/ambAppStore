# REQ-20260522 — Dashboard Revision (Trip Dialog + List Panel + Highlight + P2 Polish)

**Yêu cầu gốc**:
> "Tạo chuyến mới không cần đặt mặc định trong dashboard, chỉ cần nút đơn giản và thì hiển thị dialog tạo lên, và edit cũng vậy, khi update hoặc tạo thành công thì realtime update hiển thị trỏ vào chuyến mới cập nhật hoặc tạo trên UI, và tôi cần thay thế bằng chuyến đi list tất cả được get theo limit phù hợp với kích cỡ UI, hãy scan lại phần calendar thiếu gì không để cải thiện."

**Tag**: `[요구사항]` — delta workflow REQ → PLAN → TC → Impl → TR → RPT.

**Liên kết**:
- Supersedes UI parts of [REQ-20260522-schedule-dashboard.md](REQ-20260522-schedule-dashboard.md) (Phase C-S3 QuickBookForm → replaced).
- Reuses calendar foundations từ [REQ-20260521-trip-calendar-view.md](REQ-20260521-trip-calendar-view.md).

---

## 1. 요구사항 요약

| # | 요구사항 | 유형 | Priority |
|---|----------|------|----------|
| R1 | Bỏ `<QuickBookForm>` always-visible trong right rail của `/dashboard` | UI | MUST |
| R2 | Thêm nút "+ Tạo chuyến" trong `PageHeader` → mở `<TripFormDialog>` | UI | MUST |
| R3 | Edit trip qua `<TripFormDialog>` (cùng component), KHÔNG navigate `/trips/[id]/edit`. Footer dialog có link "Mở form đầy đủ →" cho power user | UX | MUST |
| R4 | Click ô trống trên calendar → mở `<TripFormDialog>` create mode với prefill `scheduledAt` (+ `vehicleId` nếu Gantt) | UX | MUST |
| R5 | Right rail mới = **`<VehicleLegend>`** (giữ) + **`<TripsListPanel>`** (thay QuickBookForm) | UI | MUST |
| R6 | `<TripsListPanel>` hiển thị mọi trip non-deleted của tenant theo scope role, sort `scheduledAt DESC`, limit 12, badge "pending" cho PENDING_*, click row → peek drawer | UI | MUST |
| R7 | Sau create/edit thành công → URL update `/dashboard?highlight=<trpId>`, calendar event chip được highlight (ring + pulse 3s), TripsListPanel row tương tự | UX | MUST |
| R8 | Auto-anchor jump: nếu `?highlight` trỏ tới trip có `scheduledAt` ngoài view hiện tại → `setAnchor(trip.scheduledAt)` để user thấy được event | UX | MUST |
| R9 | Now indicator (vạch cam ngang/dọc) **tick mỗi 60s** thay vì static lúc render | UX | SHOULD (P2) |
| R10 | Time-grid Week/Day mount tự scroll xuống "now" line nếu `isToday(anchor)` | UX | SHOULD (P2) |
| R11 | Sau drag-reschedule → `router.refresh()` để VehicleLegend count + TripsListPanel cập nhật | Realtime | SHOULD (P2) |
| R12 | Dialog đóng khi user click outside / Esc / Cancel; data form clear khi switch mode | UX | MUST |

---

## 2. AS-IS 현황 분석

### 2.1 Dashboard sau REQ-20260522-schedule-dashboard

[apps/(app)/dashboard/_components/dashboard-shell.tsx](../../apps/web/src/app/(app)/dashboard/_components/dashboard-shell.tsx) — Client wrapper:

```
┌── DashboardShell ────────────────────────────────────────────┐
│ <DashboardView                                                 │
│   onSlotSelect → setPrefill                                    │
│ />                                                             │
│ aside:                                                         │
│   <VehicleLegend />                                            │
│   <QuickBookForm prefill={prefill} />  ← always visible 360px  │
└────────────────────────────────────────────────────────────────┘
```

**Vấn đề**:
- Right rail bị chiếm dụng bởi form lúc nào cũng nhìn thấy → user mặc định ít dùng + chiếm không gian list trip
- Edit trip phải nav `/trips/[id]/edit` (out of dashboard context)
- Sau create → `router.refresh()` nhưng KHÔNG highlight → user không biết chuyến mới chỗ nào trên grid 7×6

### 2.2 Calendar event highlight

[apps/(app)/dashboard/_components/calendar/*-view.tsx]:
- Event chip có `bg`, `borderL`, `text` từ `eventColor(ev, colorMode)`
- KHÔNG có khái niệm "highlighted" event
- Click chip → set `?peek=<id>` (đã có)

### 2.3 Existing pattern tham khảo

| Pattern | Reference | Reuse cho |
|---|---|---|
| Highlight CSS class `ccms-row-highlight` | [`apps/web/src/app/globals.css`](../../apps/web/src/app/globals.css) (tìm) hoặc Tailwind animate | Calendar event highlight |
| URL `?highlight=<id>` redirect-after-action | [`/trips/new/new-trip-form.tsx:184`](../../apps/web/src/app/(app)/trips/new/new-trip-form.tsx#L184) `router.push(/trips?...&highlight=${id})` | Dashboard sau create/edit |
| Dialog component | `@car-v2/ui` `Dialog`/`DialogContent`/`DialogTrigger` | TripFormDialog |
| Inline edit form pattern | [`/trips/[id]/edit/edit-trip-form.tsx`](../../apps/web/src/app/(app)/trips/[id]/edit/edit-trip-form.tsx) | Edit mode of TripFormDialog |
| Pending badge | `Badge tone="warning"` trong `/trips` list | TripsListPanel |

### 2.4 Calendar event chip — current draggable/click behavior

Trong [month-view.tsx](../../apps/web/src/app/(app)/dashboard/_components/calendar/month-view.tsx), [time-grid-view.tsx], [gantt-view.tsx]:
- `<button>` với class `colors.bg + colors.text + colors.borderL`
- KHÔNG có prop `highlighted` để thêm ring + animation

### 2.5 Hiện trạng "Improvements" (audit)

| # | Item | Hiện trạng |
|---|------|------------|
| A1 | Highlight system | ❌ Chưa có trên `/dashboard` |
| A2 | Auto-anchor jump | ❌ Chưa có |
| A3 | Now indicator tick | ❌ Static at render time |
| A4 | Scroll to current time time-grid | ❌ Mount luôn ở 6am top |
| A9 | VehicleLegend refresh sau drag | ❌ Chỉ refresh sau create (router.refresh) |

---

## 3. TO-BE 요구사항

### 3.1 Right rail layout mới

```
┌── DashboardShell (revised) ──────────────────────────────────┐
│ <DashboardView                                                 │
│   highlightId={sp.highlight}                                   │
│   onSlotClick → openDialog('create', { scheduledAt, ... })     │
│   onEventEdit → openDialog('edit', trip)                       │
│ />                                                             │
│ aside (lg:w-[360px]):                                          │
│   <VehicleLegend />                                            │
│   <TripsListPanel                                              │
│     trips={recentTrips}                                        │
│     highlightId={sp.highlight}                                 │
│     onCreateClick → openDialog('create', {})                   │
│   />                                                           │
│ <TripFormDialog                                                │
│   open mode trip onClose onSuccess                             │
│ /> ← controlled by shell                                       │
└────────────────────────────────────────────────────────────────┘
```

### 3.2 `<TripFormDialog>` spec

| Prop | Type | Note |
|---|---|---|
| `open` | `boolean` | Controlled |
| `onOpenChange` | `(b: boolean) => void` | Esc / outside click |
| `mode` | `'create' \| 'edit'` | |
| `trip` | `TripDetail \| null` | Required if `mode === 'edit'` |
| `prefill` | `{ scheduledAt?: Date; vehicleId?: string }` | For create from calendar slot |
| `passengers`, `drivers`, `vehicles` | option lists | Reuse từ shell |
| `currentUserId` | `string` | |
| `onSuccess` | `(trpId: string) => void` | Shell calls `router.push('?highlight=' + id)` |

**Fields**: same as QuickBookForm (passenger, pickup, dropoff, scheduledAt, duration, vehicle, driver, purpose, notes). Compact 1-column layout.

**Action calls**:
- `mode === 'create'`: `createTripAction(payload)`
- `mode === 'edit'`: `updateTripAction(trip.trpId, payload)`

**Footer**:
- "Cancel" button (left)
- "Tạo / Lưu" button (right) — text theo mode
- Link nhỏ "Mở form đầy đủ →" navigate `/trips/new?...` (create) hoặc `/trips/[id]/edit` (edit) — fallback cho stopovers, map preview

**Behavior**:
- Open → focus pickup input
- Submit success → `onClose()` + `onSuccess(trpId)` → URL `?highlight=trpId`
- Submit fail → toast lỗi, dialog vẫn mở, data giữ
- Cancel / Esc / outside click → `onClose()`, data discard (KHÔNG persist draft localStorage cho dialog — khác với QuickBookForm cũ)

### 3.3 `<TripsListPanel>` spec

| Prop | Note |
|---|---|
| `trips: TripListItem[]` | Limit 12, sorted DESC `scheduledAt` |
| `highlightId?: string \| null` | Apply ring + scroll into view |
| `onCreateClick: () => void` | Header "+ Tạo" button → trigger dialog |
| `currentUserRole: LocalRole` | (Reserved cho future filter, MVP unused) |

**Layout**:
```
┌── Card "Chuyến đi" ─────────────────────────────┐
│ Header: "Chuyến đi"            [+ Tạo]          │
├──────────────────────────────────────────────────┤
│ ┌─ TR-1234 · CONFIRMED · 14:30 ─────┐           │
│ │ Anh Tuấn · 51A-12345              │           │
│ │ Q1 → Sân bay TSN                  │           │
│ └───────────────────────────────────┘           │
│ ┌─ TR-1233 · PENDING (highlight) ───┐           │
│ │ ...                               │ ← ring    │
│ └───────────────────────────────────┘           │
│ ...                                              │
│ [Xem tất cả →]                                   │
└──────────────────────────────────────────────────┘
max-height: ~calc(100vh - 280px) overflow-auto
```

- Click row → set `?peek=<id>` mở drawer (KHÔNG open dialog edit — edit từ drawer)
- Row của highlighted trip: thêm `ring-2 ring-accent` + auto-scrollIntoView khi mount
- Footer link "Xem tất cả →" navigate `/trips`

### 3.4 Highlight system

**CSS**: tận dụng class `ccms-row-highlight` đã có (verify trong `globals.css`), hoặc thêm mới:

```css
@keyframes highlight-pulse {
  0%, 100% { box-shadow: 0 0 0 0 hsl(var(--accent) / 0.6); }
  50%      { box-shadow: 0 0 0 6px hsl(var(--accent) / 0); }
}
.ccms-event-highlight {
  animation: highlight-pulse 1s ease-out 3;
  outline: 2px solid hsl(var(--accent));
  outline-offset: 1px;
}
```

**Wire**:
1. URL `?highlight=<trpId>` → `searchParams` in `/dashboard/page.tsx`
2. Pass `highlightId` xuống `<DashboardShell>` → `<DashboardView>` → 4 view component + `<TripsListPanel>`
3. Mỗi event chip: `className={cn(..., ev.id === highlightId && 'ccms-event-highlight')}`
4. Sau 3s (server-driven via `?highlight` removal): trên client useEffect, `setTimeout(() => router.replace('/dashboard', { scroll: false }), 3000)` để xoá param khỏi URL

**Auto-anchor jump**:
- `<DashboardView>` useEffect: nếu `highlightId` present và trip với `id === highlightId` có `scheduled` ngoài `rangeForView(anchor, view)` → `setAnchor(trip.scheduled)`. Lần đầu chỉ.

### 3.5 P2 Improvements

#### A3 — Now indicator tick 60s

Trong `<CalendarTimeGridView>` và `<CalendarGanttView>`:
```tsx
const [nowTick, setNowTick] = useState(0);
useEffect(() => {
  const id = setInterval(() => setNowTick((t) => t + 1), 60_000);
  return () => clearInterval(id);
}, []);
const now = useMemo(() => new Date(), [nowTick]);
// dùng `now` thay `today` cũ
```

#### A4 — Scroll to current time on mount (time-grid only)

`<CalendarTimeGridView>` useEffect mount:
```tsx
const gridRef = useRef<HTMLDivElement>(null);
useEffect(() => {
  if (!isSameDay(anchor, new Date())) return;
  if (!gridRef.current) return;
  /* scroll so the "now" line is ~1/3 from top */
  gridRef.current.scrollTop = Math.max(0, nowTopPx - 100);
}, []); // mount only
```

#### A9 — Refresh count sau drag

Trong `<DashboardView>` `handleEventDrop`:
```ts
if (res.success) {
  toast.success(...);
  router.refresh(); // sync VehicleLegend + TripsListPanel
}
```

### 3.6 Click ô trống calendar behavior

| View | Click empty → | Prefill |
|---|---|---|
| Month | Open dialog create | `scheduledAt = clicked day @ 00:00` |
| Week / Day | Open dialog create | `scheduledAt = clicked slot snap 15min` |
| Gantt | Open dialog create | `scheduledAt = clicked time snap 15min`, `vehicleId = row's id` |

### 3.7 Edit trip flow

| Trigger | Behavior |
|---|---|
| Click event chip trên calendar | URL `?peek=<id>` → mở peek drawer (giữ nguyên) |
| Trong peek drawer, click "Edit" | Đóng drawer + mở `<TripFormDialog>` edit mode với trip data |
| Trong TripsListPanel, click row | Mở peek drawer (drawer có button "Edit") |
| Trực tiếp double-click event chip (UX bonus) | KHÔNG MVP — defer |

**Cần modify**: `<TripPeekDrawer>` thêm prop `onEdit?: (trip: TripDetail) => void` để khi nó render trên `/dashboard`, button "Edit" KHÔNG navigate mà gọi callback. Trên `/trips`, behavior giữ nguyên (navigate).

---

## 4. 갭 분석

### 4.1 Summary

| Area | Hiện tại | TO-BE | Impact |
|---|---|---|---|
| Right rail layout | VehicleLegend + QuickBookForm | VehicleLegend + TripsListPanel | 🔴 High (xoá form, thêm list) |
| Trip create UX | Inline form luôn visible | Button + Dialog | 🔴 High |
| Trip edit UX | Navigate `/trips/[id]/edit` | Dialog overlay (cùng component create) | 🟡 Med |
| Calendar highlight | Không có | Wire URL + CSS + auto-jump | 🟡 Med |
| Now indicator | Static | Tick 60s | 🟢 Low |
| Time-grid scroll | Top 6am | Scroll to now if today | 🟢 Low |
| Refresh after drag | Local state only | + router.refresh() | 🟢 Low |
| TripPeekDrawer | Edit button → navigate | Add `onEdit` callback prop | 🟢 Low (additive) |

### 4.2 File changes detail

**New**:
| Path | LOC |
|---|---|
| `apps/(app)/dashboard/_components/trip-form-dialog.tsx` | ~300 |
| `apps/(app)/dashboard/_components/trips-list-panel.tsx` | ~120 |

**Modify**:
| Path | Change |
|---|---|
| `apps/(app)/dashboard/page.tsx` | + fetch `listTrips` (limit 12), pass to shell; + `highlightId` from searchParams |
| `apps/(app)/dashboard/_components/dashboard-shell.tsx` | Bỏ QuickBookForm. Thêm TripFormDialog + state `{ dialogState }`. Pass props mới |
| `apps/(app)/dashboard/_components/dashboard-view.tsx` | + prop `highlightId`, + `onCreateAtSlot` callback (replace `onSlotSelect`); auto-anchor jump useEffect; pass `highlightId` xuống 4 view |
| `apps/(app)/dashboard/_components/calendar/month-view.tsx` | + prop `highlightId`, apply `ccms-event-highlight` class |
| `apps/(app)/dashboard/_components/calendar/time-grid-view.tsx` | + `highlightId`; + nowTick useEffect; + scroll-to-now mount; + apply class |
| `apps/(app)/dashboard/_components/calendar/gantt-view.tsx` | + `highlightId`; + nowTick useEffect; + apply class |
| `apps/(app)/dashboard/_components/quick-book-form.tsx` | **DELETE** (logic moved into TripFormDialog) |
| `apps/(app)/trips/_components/trip-peek-drawer.tsx` | + optional `onEdit` prop (additive — `/trips` không truyền → behavior cũ) |
| `apps/web/messages/{vi,en,ko}.json` | + `dashboard.tripsList.*`, + `dashboard.form.titleCreate/titleEdit/submitCreate/submitEdit`, + `dashboard.form.fullFormCreate/fullFormEdit` (rename `fullFormLink`) |
| `apps/web/src/app/globals.css` | + `@keyframes highlight-pulse` + `.ccms-event-highlight` rule |

**Delete**:
| Path | Lý do |
|---|---|
| `apps/(app)/dashboard/_components/quick-book-form.tsx` | Refactored thành TripFormDialog |

### 4.3 DB migration

**Không cần.** Reuse `listTrips` (đã có), `createTripAction`, `updateTripAction`.

### 4.4 Side impacts

| # | Risk | Mitigation |
|---|---|---|
| SI-1 | TripPeekDrawer modify ảnh hưởng `/trips` | Prop `onEdit` optional, default behavior giữ nguyên (navigate) |
| SI-2 | Bỏ QuickBookForm = mất draft localStorage cho user đang nhập dở | Hiếm xảy ra vì REQ-2 chưa deploy production; doc trong RPT |
| SI-3 | Dialog content overflow trên màn nhỏ | Dialog responsive: max-h-[90vh] overflow-y-auto |
| SI-4 | Highlight URL `?highlight=` lưu vào browser history → user back/forward | useEffect setTimeout removes param qua `router.replace` (không push) sau 3s |
| SI-5 | Auto-anchor jump làm user mất context view hiện tại | Chỉ jump khi highlight có VÀ trip ngoài range. Once-only per session |
| SI-6 | Now indicator tick gây re-render mỗi 60s | Acceptable. Chỉ re-render 2 component (time-grid, gantt) |
| SI-7 | Scroll-to-now mount: nếu user scroll khác rồi quay lại, lại bị scroll | useEffect dependency `[]` mount only, không re-run khi anchor đổi |
| SI-8 | TripsListPanel limit 12: nếu tenant có 100 trips, user không thấy hết từ panel | Có link "Xem tất cả →" navigate `/trips`. Acceptable cho MVP |
| SI-9 | router.refresh() sau drag = network roundtrip extra | Chấp nhận. Drag không phải hành động dồn dập |

---

## 5. 사용자 플로우

### 5.1 Flow 1 — Tạo trip qua dialog

```
[Admin ở /dashboard]
        ↓
[Click "+ Tạo" trong PageHeader hoặc TripsListPanel header]
        ↓
[<TripFormDialog mode='create' /> mở, focus pickup input]
        ↓
[Admin nhập pickup/dropoff/datetime, click "Tạo chuyến"]
        ↓
[createTripAction → success]
        ↓
[Dialog đóng]
[onSuccess(trpId): router.push('/dashboard?highlight=<id>')]
        ↓
[Page re-render với highlight]
[useEffect: nếu trip date ngoài view → setAnchor]
[Event chip + TripsListPanel row có ring + pulse 3s]
[Sau 3s: router.replace clean URL ?highlight]
```

### 5.2 Flow 2 — Tạo từ click ô trống calendar

```
[Admin click ô ngày 25/5 trong Month view]
        ↓
[<TripFormDialog mode='create' prefill={ scheduledAt: 25/5 00:00 }>]
        ↓
[Form input "Thời gian" auto-fill 25/5 00:00]
        ↓
... (tiếp như Flow 1)
```

### 5.3 Flow 3 — Edit trip qua dialog

```
[Admin click event chip TR-1234]
        ↓
[URL `?peek=trp-1234`, peek drawer mở]
        ↓
[Click button "Edit" trong drawer]
        ↓
[Drawer đóng (router.replace bỏ ?peek)]
[<TripFormDialog mode='edit' trip={...}>]
        ↓
[Form prefilled với trip data]
[Admin sửa pickup, click "Lưu"]
        ↓
[updateTripAction(trp-1234, ...)]
        ↓
[onSuccess(trp-1234): router.push('?highlight=trp-1234')]
        ↓
[Event chip pulse 3s, TripsListPanel row pulse]
```

### 5.4 Flow 4 — Drag-reschedule sync legend

```
[Admin drag trip PENDING sang giờ khác]
        ↓
[updateTripAction → success]
[Optimistic local state update]
        ↓
[router.refresh()]
        ↓
[Server re-fetch listTrips + listVehicles count]
[VehicleLegend "In Use ({n})" sync nếu trip thành IN_PROGRESS giờ khác]
[TripsListPanel order có thể đổi vì sort scheduledAt]
```

### 5.5 Flow 5 — Highlight auto-anchor

```
[User ở /dashboard tháng 5]
[Tạo trip với scheduledAt = 25/6 (tháng sau)]
        ↓
[Success → router.push('?highlight=<id>')]
        ↓
[useEffect detect highlight + trip.scheduled ngoài range tháng 5]
        ↓
[setAnchor(25/6) → calendar jump sang tháng 6]
        ↓
[Trip event visible + pulse]
```

---

## 6. 기술 제약사항

### 6.1 Permissions

- Create: ADMIN + MANAGER (cùng `createTripAction` rules)
- Edit qua dialog: theo logic `updateTripAction` (Admin: ≠ COMPLETED, Manager: own + pre-confirm)
- Nếu role không cho edit → button "Edit" trong drawer disabled hoặc ẩn

### 6.2 i18n

Thêm namespace:
- `dashboard.form.titleCreate` / `titleEdit`
- `dashboard.form.submitCreate` / `submitEdit`
- `dashboard.form.fullFormCreate` / `fullFormEdit`
- `dashboard.form.successUpdate`
- `dashboard.tripsList.*` (title, empty, viewAll, pending badge, etc.)

### 6.3 Realtime

- Highlight pulse 3s + URL cleanup
- Drag → router.refresh() (server re-fetch)
- KHÔNG WebSocket / SSE — out of scope

### 6.4 Out of scope

- ❌ Double-click event → edit dialog (defer)
- ❌ Bulk edit (defer)
- ❌ Search/filter trong TripsListPanel (defer)
- ❌ Drag-resize duration (defer per REQ-2)
- ❌ Realtime cross-user sync (no WS)

---

## 7. Acceptance criteria

- [ ] Right rail = VehicleLegend + TripsListPanel (no QuickBookForm)
- [ ] PageHeader có button "+ Tạo chuyến"
- [ ] TripsListPanel header có button "+ Tạo"
- [ ] Click button → TripFormDialog mở create mode
- [ ] Click ô trống calendar → TripFormDialog mở với prefill
- [ ] Click peek drawer "Edit" → TripFormDialog mở edit mode với trip data
- [ ] Submit create → success → highlight new trip 3s + auto-anchor nếu cần
- [ ] Submit edit → success → highlight updated trip 3s
- [ ] Drag-reschedule → sync VehicleLegend + TripsListPanel
- [ ] Now indicator tick mỗi 60s
- [ ] Time-grid Week/Day mount scroll xuống "now" nếu today
- [ ] Esc / outside click đóng dialog
- [ ] i18n 3 ngôn ngữ verify
- [ ] Typecheck + lint + build pass
