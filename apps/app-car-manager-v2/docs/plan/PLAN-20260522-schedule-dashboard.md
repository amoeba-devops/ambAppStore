# PLAN-20260522 — `/dashboard` route (Schedule Dashboard)

**Liên kết**: [REQ-20260522-schedule-dashboard.md](../analysis/REQ-20260522-schedule-dashboard.md) · supersedes scope decisions in [REQ-20260521-trip-calendar-view.md](../analysis/REQ-20260521-trip-calendar-view.md)

**Resolved scope (REQ-2 §8 DECISIONS)**:
- Route: **`/dashboard`** (not `/schedule`)
- Event color: **by vehicle** (Cargorush-style, deterministic hash → 8-color palette)
- QuickBookForm draft persist: **YES MVP** (localStorage debounce 500ms)
- KPI strip + Filter chips: defer P1
- Sidebar icon: `LayoutDashboard`

**Mục tiêu**: implement `/dashboard` Server Component với calendar centerpiece + right-rail QuickBookForm + VehicleLegend. Refactor calendar code từ `/trips` sang `/dashboard`. Revert `/trips` calendar toggle.

---

## 1. 시스템 개발 현황 분석

### 1.1 Code state hiện tại

- REQ-1 implementation chưa commit, đang trong working tree
- 4 calendar view + utils + types + permission đã exist tại `apps/(app)/trips/_components/calendar/`
- Orchestrator `trips-calendar.tsx` đã exist tại `apps/(app)/trips/_components/`
- `listTripsForCalendar` query + `fetchTripsForCalendarAction` action + `fetchCalendarRangeSchema` Zod + `trips.calendar.*` i18n keys đã exist
- `/trips/page.tsx` có calendar branch + `ListCalendarToggle` integration

### 1.2 Sidebar location

Cần locate sidebar nav component để thêm entry "Dashboard". Path candidate: `apps/web/src/components/layout/sidebar*.tsx`. Verify trước khi modify.

### 1.3 Middleware

Cần check `apps/web/src/middleware.ts` — đã có cho JWT verify, có thể thêm landing redirect logic vào đây.

### 1.4 Constraints áp dụng (CLAUDE.md v2)

- `/dashboard` cần check role qua `getCurrentUser()` (DRIVER → redirect `/today` ngay trong page)
- Multi-tenancy: `listVehicles(entId)` + `listTripsForCalendar` đã có filter
- No direct DB từ Client: QuickBookForm + VehicleLegend là Client Component → fetch ban đầu qua Server Component, mutation qua Server Action có sẵn
- State machine: `createTripAction` đã có; không bypass
- i18n: 3 file `messages/{vi,en,ko}.json` phải sync

---

## 2. 단계별 구현 계획

> Chia 7 Phase. Mỗi Phase build xanh. Phase A (revert) + Phase B (move) làm cùng commit để không break giữa chừng.

### Phase A — Revert `/trips` calendar integration

**A-S1**: Revert `apps/(app)/trips/page.tsx` về trạng thái trước REQ-1:
- Xoá `import dynamic from 'next/dynamic'`
- Xoá `import { ListCalendarToggle }`, `import { rangeForView }`
- Xoá const `TripsCalendar = dynamic(...)`
- Xoá search param `view` khỏi `PageProps`
- Xoá entire calendar branch (block `if (viewMode === 'calendar') { ... }`)
- Xoá `<ListCalendarToggle activeView="list" ... />` khỏi filter bar

└─ 사이드 임팩트: PR diff lớn nhưng net zero (revert pure). Bookmark `/trips?view=calendar` mất hiệu lực — chưa deploy production nên OK.

**A-S2**: Delete file `apps/(app)/trips/_components/list-calendar-toggle.tsx`.
└─ 사이드 임팩트: không.

### Phase B — Move calendar code sang `/dashboard`

**B-S1**: Tạo thư mục `apps/web/src/app/(app)/dashboard/_components/calendar/` và **MOVE** 6 file (git mv style):
- `types.ts`, `utils.ts`, `permission.ts`
- `toolbar.tsx`, `month-view.tsx`, `time-grid-view.tsx`, `gantt-view.tsx`

Internal imports đã dùng relative `./types`, `./utils` → không cần đổi.

└─ 사이드 임팩트: import path từ trips/_components/calendar bị break — sẽ đề cập ở Phase A revert.

**B-S2**: MOVE + RENAME `trips/_components/trips-calendar.tsx` → `dashboard/_components/dashboard-view.tsx`:
- Class/function `TripsCalendar` → `DashboardView`
- Click event chip `?peek=...` URL base đổi từ `/trips` sang `/dashboard` (để peek drawer mount trên `/dashboard`)
- Click empty slot vẫn navigate `/trips/new?scheduledAt=...` (không có form fullscreen ở `/dashboard`)
- Remove `useRouter` push to `/trips/new` — Sửa: nếu user click empty slot, **không navigate** mà **fill QuickBookForm trên rail** (xem Phase C-S3 onSlotSelect callback)
- Click "+N more" trong Month view → setAnchor + setView('day') (giữ như REQ-1)

└─ 사이드 임팩트: orchestrator giờ phải accept callbacks `onSlotSelect` để truyền data sang `<QuickBookForm>` thay vì navigate.

**B-S3**: i18n rename trong `messages/{vi,en,ko}.json`:
- Namespace `trips.calendar.*` → `dashboard.calendar.*`
- Thêm key `nav.dashboard` (giữ `nav.schedule` deprecated cho backward compat 1 sprint)
- Update mọi `useTranslations('trips.calendar')` → `useTranslations('dashboard.calendar')` trong 6 file moved

└─ 사이드 임팩트: 3 file JSON phải sync; build fail nếu thiếu key 1 locale.

### Phase C — Build `/dashboard` route + layout

**C-S1**: Tạo `apps/(app)/dashboard/page.tsx` (Server Component):
- `getCurrentUser()` — if `role === 'DRIVER'` → `redirect('/today')` (`next/navigation` redirect)
- Parallel fetch:
  - `listTripsForCalendar(entId, role, userId, currentMonthRange.start, currentMonthRange.end)`
  - `listVehicles(entId)`
  - `peek` trip nếu `?peek=<id>` có (giống `/trips/page.tsx`)
- Render layout 2 cột:

```tsx
<>
  <PageHeader title={tD('title')} subtitle={tD('subtitle', { count })} breadcrumbs={...} actions={...} />
  <div className="flex-1 overflow-auto px-4 md:px-7 py-4 md:py-5">
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-4">
      <section className="min-w-0">
        <DashboardView initialTrips={...} vehicles={...} currentUser={...} />
      </section>
      <aside className="space-y-3 lg:sticky lg:top-4 lg:self-start">
        <VehicleLegend vehicles={...} />
        <QuickBookForm vehicles={...} drivers={...} currentUser={...} />
      </aside>
    </div>
  </div>
  {peekTrip && <TripPeekDrawer trip={peekTrip} ... />}
</>
```

└─ 사이드 임팩트: pattern peek drawer phải làm parallel với `/trips/page.tsx` — bảo trì đôi.

**C-S2**: Tạo `apps/(app)/dashboard/_components/vehicle-legend.tsx` (Client Component):
- Props: `vehicles: CalendarVehicle[]`, `tripsToday: number[]` (count per vehicle)
- Render Card với list xe:
  - Color chip (deterministic màu, xem Phase D-S1)
  - Plate number (font-mono)
  - Status badge: "Available" / "In Use (N)" / "Maintenance" (Badge tone)
  - Click row (P1 SHOULD) → filter calendar — MVP: chỉ visual highlight, no action
- Footer link "Quản lý xe →" navigate `/vehicles`

└─ 사이드 임팩트: count realtime "In Use" cần re-fetch khi user reschedule. MVP: chỉ hiện count tại thời điểm page load; không sync realtime với calendar drag. Doc rõ.

**C-S3**: Tạo `apps/(app)/dashboard/_components/quick-book-form.tsx` (Client Component):
- Props: `vehicles`, `drivers`, `currentUser`, `prefilledScheduledAt?: Date`, `prefilledVehicleId?: string`
- Form fields theo REQ-2 §3.3:
  - Passenger Select (Admin only — manager fixed = self)
  - Pickup Input (Google Places autocomplete — reuse hook nếu có)
  - Dropoff Input (same)
  - Date + Time picker
  - Duration NumberInput
  - Vehicle Select
  - Driver Select (paired với vehicle)
  - Purpose Input
  - Notes Textarea
  - Submit Button "Tạo chuyến" + Reset
- Validation: same Zod schema `createTripSchema` (đã có)
- Submit handler: gọi `createTripAction(formData)`
  - Success: toast `Đã tạo chuyến TR-XXXX`, clear draft localStorage, reset form, refresh parent (gọi `router.refresh()`)
  - Error: toast lỗi, giữ form data
- Footer link: "Cần điểm ghé / proxy? Mở form đầy đủ →" `Link href="/trips/new"`

└─ 사이드 임팩트: form duplicate logic với `/trips/new` — nguy cơ drift. Mitigation: cả hai dùng cùng `createTripSchema` + `createTripAction`; UI khác nhưng business logic single source.

**C-S4**: Bridge `<DashboardView>` ↔ `<QuickBookForm>` qua context hoặc lift state:
- Khi user click ô trống trên calendar → cần pre-fill `scheduledAt` vào form trên rail
- Cách 1: Lift state to `page.tsx` (Server Component không hold client state) → KHÔNG được
- Cách 2: Client Component wrapper `<DashboardShell>` quản state `prefilledScheduledAt`, render cả `<DashboardView>` (passing `onSlotSelect`) và `<QuickBookForm>` (passing `prefilledScheduledAt`)
- Cách 3: Custom React Context `<DashboardContext>` cung cấp `prefilledScheduledAt` + setter
- **Decision**: Cách 2 (DashboardShell wrapper). Đơn giản, không cần context.

```tsx
// apps/(app)/dashboard/_components/dashboard-shell.tsx
'use client';
export function DashboardShell({ initialTrips, vehicles, drivers, currentUser }) {
  const [prefill, setPrefill] = useState<{ scheduledAt?: Date; vehicleId?: string }>({});
  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-4">
      <section>
        <DashboardView ... onSlotSelect={(when, vId) => setPrefill({ scheduledAt: when, vehicleId: vId })} />
      </section>
      <aside>
        <VehicleLegend vehicles={vehicles} />
        <QuickBookForm vehicles={vehicles} drivers={drivers} currentUser={currentUser} prefill={prefill} />
      </aside>
    </div>
  );
}
```

└─ 사이드 임팩트: page.tsx phải pass drivers list (thêm 1 query `listDrivers`). Update C-S1 fetch parallel.

### Phase D — Event color by vehicle (Cargorush style)

**D-S1**: Thêm color assignment trong `dashboard/_components/calendar/utils.ts`:
- Function `vehicleColor(vehicleId: string | null): { bg, text, borderL }`
- Algorithm: hash `vehicleId` → index 0-7 → màu từ `chartColors` palette (`packages/ui/src/tokens.ts`)
- Fallback (vehicleId null): neutral gray với `border-l-dashed`
- Export deterministic — cùng `vehicleId` luôn ra cùng màu

**D-S2**: Thêm prop `colorMode: 'vehicle' | 'status'` vào `DashboardView` + 4 view component:
- MVP default = `'vehicle'`
- Khi `colorMode === 'vehicle'`: dùng `vehicleColor(ev.vehicleId)` thay vì `statusClasses(ev.status)`
- Toggle button trong toolbar (P1 — defer? Hay MVP tiny toggle?): **MVP có toggle nhỏ trên toolbar** "Theo xe | Theo trạng thái" — chỉ 2 button

└─ 사이드 임팩트: VehicleLegend phải dùng cùng `vehicleColor()` để user map mắt. Nếu user toggle sang status mode, legend giữ vehicle color (independent).

### Phase E — QuickBookForm draft localStorage

**E-S1**: Implement save draft trong `quick-book-form.tsx`:
- localStorage key: `dashboard.quickBook.draft.<entId>` (per-tenant để cross-tenant không leak)
- Hook `useFormDraft(key, debounceMs = 500)`:
  - useEffect mount: read localStorage → restore form state qua `react-hook-form` `reset(savedData)`
  - useEffect watch form values: debounce 500ms → write localStorage
  - Clear on submit success

└─ 사이드 임팩트: 
- Nếu DB schema thay đổi sau khi user save draft cũ → restore có thể fail (vd: field mới). Mitigation: wrap restore trong try/catch + Zod parse, fail silent.
- Concern PII: draft chứa pickup/dropoff/notes ở localStorage — không sync server, không leak qua network. OK với security model.

### Phase F — Sidebar nav + middleware redirect

**F-S1**: Locate sidebar component (TBD — đọc `apps/web/src/components/layout/sidebar.tsx` hoặc tương tự). Thêm entry "Dashboard":
- Icon: `LayoutDashboard` từ lucide
- href: `/dashboard`
- Label: `t('nav.dashboard')`
- Position: ngay sau "Hôm nay", trước "Chuyến đi"
- Visible: ADMIN + MANAGER only (DRIVER không thấy — sidebar component thường có role gate sẵn)

└─ 사이드 임팩트: nếu sidebar có order/permission map cứng → phải edit map.

**F-S2**: Middleware update — redirect `/` based on role:
- Đọc `apps/web/src/middleware.ts` để xem có handler `/` chưa
- Nếu chưa: thêm logic:
  ```ts
  if (request.nextUrl.pathname === '/') {
    const user = await readUserFromCookie(request);
    if (!user) return NextResponse.next();
    return NextResponse.redirect(new URL(
      user.role === 'DRIVER' ? '/today' : '/dashboard',
      request.url,
    ));
  }
  ```
- Cẩn thận: middleware chạy trên Edge runtime — KHÔNG được dùng node API.

└─ 사이드 임팩트: bookmark cũ `/` → ai đó đang ở `/` sẽ bị redirect bất ngờ. Acceptable vì `/` thường không phải landing thường.

### Phase G — i18n keys mới

**G-S1**: Thêm namespace `dashboard.*` vào `messages/{vi,en,ko}.json`:

```jsonc
"dashboard": {
  "title": "Bảng điều khiển" / "Dashboard" / "대시보드",
  "subtitle": "{count} chuyến đang theo dõi · vai trò {role}" / ...,
  "calendar": { ... (moved từ trips.calendar) },
  "form": {
    "title": "Tạo chuyến mới",
    "passenger": "Người sử dụng",
    "pickup": "Điểm đón",
    "dropoff": "Điểm đến",
    "datetime": "Thời gian",
    "duration": "Thời lượng (phút)",
    "vehicle": "Xe",
    "driver": "Tài xế",
    "purpose": "Mục đích",
    "notes": "Ghi chú",
    "submit": "Tạo chuyến",
    "reset": "Đặt lại",
    "fullFormLink": "Cần điểm ghé / nâng cao? Mở form đầy đủ →",
    "draftRestored": "Đã khôi phục bản nháp",
    "successCreate": "Đã tạo chuyến {ref}"
  },
  "legend": {
    "title": "Phương tiện",
    "available": "Sẵn sàng",
    "inUse": "Đang sử dụng",
    "inUseCount": "Đang sử dụng ({count})",
    "maintenance": "Bảo trì",
    "manageLink": "Quản lý xe →"
  },
  "colorMode": {
    "byVehicle": "Theo xe",
    "byStatus": "Theo trạng thái"
  }
}
```

Sync 3 file: vi, en, ko.

└─ 사이드 임팩트: next-intl strict — thiếu key 1 file = runtime error. CI phải catch.

**G-S2**: Thêm `nav.dashboard` key (3 file). Deprecate `nav.schedule` (giữ key cho rollback, marked DEPRECATED comment).

### Phase H — Verify

**H-S1**: `npm run typecheck && npm run lint && npm run build` trong `apps/app-car-manager-v2/apps/web` — phải pass.

**H-S2**: Smoke test theo TC-20260522 (next step).

---

## 3. 변경 파일 목록

### Delete

| Path | Lý do |
|---|---|
| `apps/(app)/trips/_components/list-calendar-toggle.tsx` | Không còn toggle |

### Move (Phase B)

| From | To |
|---|---|
| `apps/(app)/trips/_components/calendar/*` (7 files) | `apps/(app)/dashboard/_components/calendar/*` |
| `apps/(app)/trips/_components/trips-calendar.tsx` | `apps/(app)/dashboard/_components/dashboard-view.tsx` (rename) |

### Modify (revert)

| Path | Change |
|---|---|
| `apps/(app)/trips/page.tsx` | Xoá calendar branch + ListCalendarToggle (revert REQ-1 wiring) |

### Modify (refactor)

| Path | Change |
|---|---|
| `apps/(app)/dashboard/_components/dashboard-view.tsx` (after move) | Rename class, đổi peek URL base, accept `onSlotSelect` callback |
| `apps/(app)/dashboard/_components/calendar/utils.ts` (after move) | Thêm `vehicleColor()` function |
| `apps/(app)/dashboard/_components/calendar/{month,time-grid,gantt}-view.tsx` | Thêm prop `colorMode`, conditional color resolver |
| `apps/(app)/dashboard/_components/calendar/toolbar.tsx` | Thêm toggle nhỏ "By Vehicle / By Status" |
| `apps/web/middleware.ts` | + landing redirect `/` |
| `apps/web/src/components/layout/sidebar*.tsx` | + nav entry "Dashboard" |
| `apps/web/messages/{vi,en,ko}.json` | Rename `trips.calendar` → `dashboard.calendar`, + `dashboard.form/legend/colorMode/*`, + `nav.dashboard` |

### Create

| Path | Purpose | LOC ước tính |
|---|---|---|
| `apps/(app)/dashboard/page.tsx` | Server Component, parallel fetch + layout 2 cột | ~120 |
| `apps/(app)/dashboard/_components/dashboard-shell.tsx` | Client wrapper, lift state cho prefill | ~50 |
| `apps/(app)/dashboard/_components/quick-book-form.tsx` | Booking form right-rail + draft localStorage | ~280 |
| `apps/(app)/dashboard/_components/vehicle-legend.tsx` | Vehicle status panel right-rail | ~100 |
| `apps/(app)/dashboard/_hooks/use-form-draft.ts` | Generic hook save/restore form draft | ~50 |

**Tổng**: ~600 LOC mới, ~200 LOC modify, ~870 LOC moved (no logic change).

---

## 4. 사이드 임팩트 분석

| # | 범위 | 위험도 | 설명 | Mitigation |
|---|---|---|---|---|
| SI-1 | `/trips` UX | 🟢 Low | Revert calendar toggle → user mất feature mới | Feature chưa deploy production, không có dependency user |
| SI-2 | Landing redirect | 🟡 Med | User bookmark `/` lạ với behavior mới | Bookmark cụ thể như `/today`, `/trips` không đổi; chỉ root đổi |
| SI-3 | Sidebar overcrowding | 🟢 Low | 10 items thay vì 9 | Có thể nhóm sau, MVP không cần |
| SI-4 | `<DashboardShell>` client boundary | 🟢 Low | Wrap nhiều client component | Standard pattern, không impact perf |
| SI-5 | `<QuickBookForm>` draft cross-tenant | 🟢 Low | localStorage key per-`entId` đã prefix | OK |
| SI-6 | `<QuickBookForm>` draft schema drift | 🟡 Med | DB schema đổi → draft restore fail | try/catch + Zod parse silent fail, drop stale draft |
| SI-7 | Vehicle color collision (>8 vehicles) | 🟢 Low | Hash modulo 8 → 2 xe cùng màu | MVP scope 3 xe, acceptable. Doc rõ |
| SI-8 | VehicleLegend "in use" count realtime | 🟡 Med | Server-side count at page load, không sync với drag mid-session | MVP: doc rõ; P1: server action refetch sau drag |
| SI-9 | Middleware Edge runtime | 🔴 High | Đọc cookie JWT cần lib edge-compatible | Reuse `jose` đã có (Edge OK) |
| SI-10 | next-intl strict missing keys | 🔴 Build-fail | Build fail nếu thiếu key | CI catch + manual sync 3 file |
| SI-11 | Peek drawer mount 2 chỗ | 🟢 Low | Drawer component shared (`/trips` + `/dashboard`) — duplicate JSX boilerplate | Acceptable, drawer là pure presentational |
| SI-12 | createTripAction từ form gọi parent refresh | 🟢 Low | `router.refresh()` re-fetch toàn page (tốn round-trip) | Acceptable — alternative là dùng `useOptimistic` + manual append, defer |

---

## 5. DB 마이그레이션

**Không cần.** Reuse query + schema từ REQ-1. Index `idx_car_trips_ent_status_scheduled` đã cover.

---

## 6. Deployment plan

1. PR vào `staging-car` — tất cả file mới + revert + move + i18n cùng commit (atomic).
2. SSH staging: `bash platform/scripts/deploy-staging.sh` (KHÔNG `docker compose build` thẳng).
3. Smoke test theo TC-20260522 trên `stg-apps.amoeba.site/app-car-manager-v2/dashboard`.
4. Nếu xanh → PR `staging-car` → `production`.

---

## 7. Acceptance criteria

- [ ] `/dashboard` route accessible cho ADMIN + MANAGER
- [ ] DRIVER vào `/dashboard` → redirect `/today`
- [ ] `/` redirect: ADMIN/MANAGER → `/dashboard`, DRIVER → `/today`
- [ ] Sidebar có entry "Dashboard" (ADMIN/MANAGER thấy)
- [ ] Calendar Month/Week/Day/Gantt hoạt động (reuse REQ-1)
- [ ] Event color by vehicle mặc định; toggle sang by status hoạt động
- [ ] `<QuickBookForm>` tạo trip → toast success → calendar update
- [ ] Click ô trống calendar → form rail pre-fill `scheduledAt`
- [ ] `<VehicleLegend>` hiển thị status counts
- [ ] Click event chip trên calendar → peek drawer mở overlay `/dashboard` (không navigate)
- [ ] Drag-to-reschedule vẫn work
- [ ] `/trips` không còn calendar toggle (revert)
- [ ] QuickBookForm draft persist khi reload (localStorage)
- [ ] Mobile (< lg): stack vertical, calendar trên, rail dưới (collapsed)
- [ ] Build + lint + typecheck pass
- [ ] i18n 3 ngôn ngữ verify
