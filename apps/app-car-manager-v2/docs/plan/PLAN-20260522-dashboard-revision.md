# PLAN-20260522 — Dashboard Revision

**Liên kết**: [REQ-20260522-dashboard-revision.md](../analysis/REQ-20260522-dashboard-revision.md)

---

## 1. 시스템 개발 현황

- Dashboard hiện có: page.tsx (Server), dashboard-shell.tsx (Client wrapper), dashboard-view.tsx (calendar orchestrator), 4 calendar views, quick-book-form.tsx (sẽ delete), vehicle-legend.tsx.
- Trip CRUD actions có sẵn: `createTripAction`, `updateTripAction`.
- Peek drawer: `apps/(app)/trips/_components/trip-peek-drawer.tsx` — render `/trips` và `/dashboard` đều dùng chung.
- `useFormDraft`, `AddressAutocomplete`, `DraftRestoreBanner` reusable.
- `Dialog` từ `@car-v2/ui` đã có (xem index.ts line 22).

---

## 2. 단계별 구현 계획

### Phase A — Build TripFormDialog (Client Component)

**A-S1**: Tạo `apps/(app)/dashboard/_components/trip-form-dialog.tsx`:
- Props: `{ open, onOpenChange, mode, trip?, prefill?, passengers, drivers, vehicles, currentUserId, onSuccess }`
- Dialog wrapper từ `@car-v2/ui`
- Form fields: passenger select, pickup autocomplete, dropoff autocomplete, datetime-local, duration, vehicle select, driver select, purpose, notes
- Reset form khi `open` đổi từ false → true (mount fresh) HOẶC khi `mode/trip` đổi
- Effect prefill: nếu `mode === 'edit'`, populate từ `trip`; nếu `prefill.scheduledAt`, set scheduledAt
- Submit:
  - create: `createTripAction(payload)`
  - edit: `updateTripAction(trip.trpId, payload)`
- On success: `onOpenChange(false)` + `onSuccess(result.data.trpId)` + toast
- On fail: toast với formatActionError, dialog vẫn mở
- Cancel: `onOpenChange(false)` discard data
- Link footer: "Mở form đầy đủ →" → `/trips/new` (create) hoặc `/trips/<id>/edit` (edit)

└─ 사이드 임팩트: dialog không persist draft localStorage (khác QuickBookForm). User mất data nếu close dialog accidentally. Acceptable cho UX nhanh hơn.

### Phase B — Build TripsListPanel

**B-S1**: Tạo `apps/(app)/dashboard/_components/trips-list-panel.tsx`:
- Props: `{ trips: TripListItem[]; highlightId?: string; onCreateClick: () => void }`
- Card với CardHeader (title + "+ Tạo" button) + CardContent (list)
- Mỗi row: ref + status badge + scheduledAt + passenger + plate + route snippet
- Click row → `router.push('/dashboard?peek=<id>')`
- Row highlight: nếu `tr.trpId === highlightId` → ring + scrollIntoView
- max-height: `calc(100vh - 320px)` overflow-y-auto
- Empty state: "Chưa có chuyến nào" + link Tạo
- Footer: Link "Xem tất cả →" → `/trips`

└─ 사이드 임팩트: viewport calc dùng vh — nếu PageHeader chiếm space khác trên mobile, scroll height có thể không khớp. Test mobile.

### Phase C — Highlight CSS + URL handling

**C-S1**: Thêm vào `apps/web/src/app/globals.css`:
```css
@keyframes highlight-pulse {
  0%, 100% { box-shadow: 0 0 0 0 hsl(var(--accent) / 0.7); }
  50%      { box-shadow: 0 0 0 8px hsl(var(--accent) / 0); }
}
.ccms-event-highlight {
  position: relative;
  z-index: 5;
  outline: 2px solid hsl(var(--accent));
  outline-offset: 1px;
  animation: highlight-pulse 1s ease-out 3;
}
```

└─ 사이드 임팩트: `position: relative` + `z-index: 5` cho event chip để outline không bị clip bởi cell border.

**C-S2**: Trong `dashboard/page.tsx`: đọc `sp.highlight` → pass xuống DashboardShell.

**C-S3**: Trong `<DashboardShell>`: pass `highlightId` xuống DashboardView + TripsListPanel.

**C-S4**: Trong `<DashboardView>`:
- Prop `highlightId?: string`
- Pass xuống 4 view component
- useEffect cleanup URL: setTimeout 3000ms → `router.replace('/dashboard', { scroll: false })`
- useEffect auto-anchor: nếu `highlightId` present và trip outside range → setAnchor

**C-S5**: Trong 4 view component (month, time-grid, gantt):
- Prop `highlightId?: string`
- Trên button event chip: `className={cn(..., ev.id === highlightId && 'ccms-event-highlight')}`

### Phase D — Refactor DashboardShell + page.tsx

**D-S1**: `dashboard-shell.tsx`:
- State: `const [dialog, setDialog] = useState<{ open: boolean; mode: 'create' | 'edit'; trip?: TripDetail; prefill?: ... }>({ open: false, mode: 'create' })`
- Hàm `openCreate(prefill?)` / `openEdit(trip)`
- Render TripFormDialog với props từ state
- onSuccess: `router.push('/dashboard?highlight=' + id)`, `router.refresh()`

**D-S2**: `dashboard/page.tsx`:
- Thêm `searchParams` field `highlight?: string`
- Fetch `listTrips(entId, role, userId, limit: 12)` parallel với existing fetches
- Pass `recentTrips`, `highlightId` xuống shell
- Pass `onEdit` callback path xuống peek drawer? Actually peek drawer is rendered here directly (when `?peek`), shell doesn't own it. Need to think:
  - Option 1: Move peek drawer rendering vào shell so click "Edit" có thể trigger dialog
  - Option 2: Peek drawer "Edit" navigate `/trips/[id]/edit` (legacy behavior) — UX inconsistent
  - **Decision**: Option 1. Move `<TripPeekDrawer>` mounting vào shell.

**D-S3**: `dashboard-view.tsx`:
- Đổi prop `onSlotSelect` → `onSlotCreate(prefill)` (semantically clear)
- Click empty → `onSlotCreate(prefill)` → shell mở dialog

**D-S4**: `quick-book-form.tsx`: DELETE.

└─ 사이드 임팩트: Peek drawer rendering trước ở page.tsx (Server) → giờ ở shell (Client). Cần đảm bảo peek data fetch vẫn happen server-side, sau đó pass qua props.

### Phase E — Modify TripPeekDrawer

**E-S1**: `apps/(app)/trips/_components/trip-peek-drawer.tsx`:
- Thêm optional prop `onEdit?: (trip: TripDetail) => void`
- Nếu `onEdit` truyền vào → button "Edit" call `onEdit(trip)` thay vì navigate
- Nếu KHÔNG truyền → giữ behavior cũ (navigate `/trips/[id]/edit`)

└─ 사이드 임팩트: Trang `/trips` không truyền `onEdit` → behavior cũ. Backward compat.

### Phase F — P2 improvements

**F-S1**: A3 — Now indicator tick:
- Trong `time-grid-view.tsx` + `gantt-view.tsx`:
  - State `[, setNowTick] = useState(0)`
  - useEffect setInterval 60_000 ms `setNowTick(t => t + 1)`
  - useMemo `now = new Date()` với dep `[nowTick]`
  - Dùng `now` thay `today`

**F-S2**: A4 — Scroll to current time time-grid mount:
- `time-grid-view.tsx`: gridRef, useEffect mount only check `isSameDay(anchor, new Date())` → `gridRef.current.scrollTop = nowTopPx - 100`
- Note: gridRef phải point đến outer scroll container, không phải inner grid. Check parent structure.

**F-S3**: A9 — Refresh after drag:
- `dashboard-view.tsx` `handleEventDrop` success branch: thêm `router.refresh()`
- Note: optimistic local state update đã có; router.refresh() đảm bảo legend + list panel sync

### Phase G — i18n keys

Thêm vào `messages/{vi,en,ko}.json`:
```jsonc
"dashboard.form": {
  ...existing,
  "titleCreate": "Tạo chuyến mới",
  "titleEdit": "Sửa chuyến {ref}",
  "submitCreate": "Tạo chuyến",
  "submitEdit": "Lưu thay đổi",
  "successUpdate": "Đã cập nhật {ref}",
  "fullFormCreate": "Mở form đầy đủ (có điểm ghé)→",
  "fullFormEdit": "Mở form chỉnh sửa đầy đủ →",
  "cancel": "Huỷ",
  "errUpdate": "Không thể cập nhật"
},
"dashboard.tripsList": {
  "title": "Chuyến đi",
  "createButton": "+ Tạo",
  "viewAll": "Xem tất cả →",
  "empty": "Chưa có chuyến nào",
  "emptyAction": "Tạo chuyến đầu tiên",
  "pendingBadge": "Đang chờ"
}
```

Sync 3 file vi/en/ko.

└─ 사이드 임팩트: Strict next-intl — thiếu key crash. CI catch.

### Phase H — Verify

**H-S1**: `npm run typecheck && npm run lint && npm run build`.

**H-S2**: Manual smoke test theo TC.

---

## 3. 변경 파일 목록

| 구분 | File | 변경 |
|---|---|---|
| New | `apps/(app)/dashboard/_components/trip-form-dialog.tsx` | Create (~300 LOC) |
| New | `apps/(app)/dashboard/_components/trips-list-panel.tsx` | Create (~140 LOC) |
| Modify | `apps/(app)/dashboard/page.tsx` | + searchParams.highlight, + listTrips fetch, + pass new props |
| Modify | `apps/(app)/dashboard/_components/dashboard-shell.tsx` | Refactor: bỏ QuickBookForm, thêm TripFormDialog state, TripPeekDrawer mount, TripsListPanel render |
| Modify | `apps/(app)/dashboard/_components/dashboard-view.tsx` | + `highlightId`, `onSlotCreate`, auto-anchor, A3 nowTick, F-S3 refresh after drag |
| Modify | `apps/(app)/dashboard/_components/calendar/month-view.tsx` | + `highlightId` prop + class apply |
| Modify | `apps/(app)/dashboard/_components/calendar/time-grid-view.tsx` | + `highlightId` + nowTick + scroll-to-now mount |
| Modify | `apps/(app)/dashboard/_components/calendar/gantt-view.tsx` | + `highlightId` + nowTick |
| Modify | `apps/(app)/trips/_components/trip-peek-drawer.tsx` | + optional `onEdit` prop |
| Modify | `apps/web/src/app/globals.css` | + `@keyframes highlight-pulse` + `.ccms-event-highlight` |
| Modify | `apps/web/messages/{vi,en,ko}.json` | + `dashboard.form.title*/submit*/full*`, + `dashboard.tripsList.*` |
| Delete | `apps/(app)/dashboard/_components/quick-book-form.tsx` | Refactored thành TripFormDialog |

**Tổng**: ~500 LOC new, ~250 LOC modify.

---

## 4. 사이드 임팩트 분석

| # | Risk | Mitigation |
|---|---|---|
| SI-1 | TripPeekDrawer modify ảnh hưởng `/trips` | Optional prop, default behavior unchanged |
| SI-2 | Bỏ QuickBookForm = mất draft user đang nhập | REQ-2 chưa deploy production; doc trong RPT |
| SI-3 | Dialog overflow mobile | `max-h-[90vh] overflow-y-auto` |
| SI-4 | URL `?highlight=` lưu history | useEffect setTimeout `router.replace` (không push) sau 3s |
| SI-5 | Auto-anchor jump mất context | Chỉ jump 1 lần / mount + chỉ khi trip ngoài range |
| SI-6 | Now indicator tick re-render | 60s interval, chỉ 2 component, acceptable |
| SI-7 | Scroll-to-now mount re-trigger khi user scroll khác | useEffect `[]` mount only |
| SI-8 | TripsListPanel limit 12 nếu tenant > 12 trip | Link "Xem tất cả →" /trips |
| SI-9 | router.refresh() sau drag = network round-trip | Acceptable, drag ít tần suất |
| SI-10 | Peek drawer mount move từ Server → Client wrapper | Vẫn pass peek trip data từ server fetch qua props |
| SI-11 | Dialog form không có draft persist | UX trade-off, nhanh hơn, ít persistent state |

---

## 5. DB 마이그레이션

**Không cần.**

---

## 6. Acceptance criteria

Xem REQ §7.
