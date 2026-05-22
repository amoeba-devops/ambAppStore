# RPT-20260522 — Schedule Dashboard Implementation Report

**Workflow chain**:
- [REQ-20260522-schedule-dashboard.md](../analysis/REQ-20260522-schedule-dashboard.md)
- [PLAN-20260522-schedule-dashboard.md](../plan/PLAN-20260522-schedule-dashboard.md)
- [TC-20260522-schedule-dashboard.md](../test/TC-20260522-schedule-dashboard.md)
- [TR-20260522-schedule-dashboard.md](../test/TR-20260522-schedule-dashboard.md)

**Related prior work**: [REQ-20260521-trip-calendar-view.md](../analysis/REQ-20260521-trip-calendar-view.md) (REQ-1) → superseded by re-locating calendar work to `/dashboard`.

**Status**: ✅ **Build verified · Awaiting staging smoke test**

---

## 1. Tóm tắt

Implement Schedule Dashboard — calendar-centric hub cho ADMIN/MANAGER tại route `/dashboard`. Layout 2 cột:
- **Trái (70%)**: Calendar với 4 sub-view (Month/Week/Day/By Vehicle Gantt) + toolbar (prev/today/next + view switch + color-mode toggle).
- **Phải (30%, sticky)**: `<VehicleLegend>` (status counts) + `<QuickBookForm>` (inline booking với draft persist).

Default landing cho STAFF chuyển từ `/trips` sang `/dashboard` (DRIVER giữ `/today`). `/trips` revert pure list. Event color **by vehicle** (Cargorush-style) mặc định, toggle sang **by status** tùy chọn.

---

## 2. Files changed (summary)

### New files (9)

| Path | Purpose | LOC |
|---|---|---|
| `apps/web/src/app/(app)/dashboard/page.tsx` | Server Component, parallel fetch (trips + vehicles + drivers + users + peek), DRIVER redirect | ~120 |
| `apps/web/src/app/(app)/dashboard/_components/dashboard-shell.tsx` | Client wrapper, lift state (`prefill`) giữa calendar và form | ~55 |
| `apps/web/src/app/(app)/dashboard/_components/dashboard-view.tsx` | Calendar orchestrator (rename + refactor từ trips-calendar.tsx) | ~170 |
| `apps/web/src/app/(app)/dashboard/_components/quick-book-form.tsx` | Inline booking form right-rail (reuse `useFormDraft` + `AddressAutocomplete`) | ~270 |
| `apps/web/src/app/(app)/dashboard/_components/vehicle-legend.tsx` | Right rail vehicle status panel | ~70 |
| `apps/web/src/app/(app)/dashboard/_components/calendar/{toolbar,month-view,time-grid-view,gantt-view,utils,types,permission}.{ts,tsx}` | Moved + refactored từ `/trips/_components/calendar/` (REQ-1) | ~970 (no logic change, ~+50 cho colorMode/vehicleColor) |

### Modified files (8)

| Path | Change |
|---|---|
| `apps/web/src/app/(app)/page.tsx` | Redirect `/` → `/dashboard` cho STAFF (was `/trips`) |
| `apps/web/src/app/(app)/trips/page.tsx` | REVERT REQ-1: xoá calendar branch, dynamic import, ListCalendarToggle |
| `apps/web/src/server/actions/trips/trip.actions.ts` | Thêm `requireRole(['ADMIN', 'MANAGER'])` cho `fetchTripsForCalendarAction` (I2 defense) |
| `apps/web/src/components/layout/nav-items.ts` | + `dashboard` NavKey, + entry với icon `LayoutDashboard`, đổi STAFF fallback từ `trips` → `dashboard` |
| `apps/web/messages/vi.json` · `en.json` · `ko.json` | RENAME `trips.calendar.*` → `dashboard.calendar.*`, + `dashboard.colorMode/legend/form/title/subtitle.*`, + `nav.dashboard` (giữ `nav.schedule` deprecated cho rollback) |

### Deleted files (1)

| Path | Lý do |
|---|---|
| `apps/web/src/app/(app)/trips/_components/list-calendar-toggle.tsx` | Toggle không còn cần |

---

## 3. Architecture decisions

| Decision | Rationale |
|---|---|
| **Route `/dashboard`** (không `/schedule`, `/booking`, `/calendar`) | Khớp đúng từ "Dashboard" trong requirement gốc, ngữ nghĩa rõ ràng nhất với user |
| **`<DashboardShell>` lift state** thay vì React Context | Đơn giản hơn cho 2 component giao tiếp. Context overkill cho 1 prop |
| **Reuse `useFormDraft` hook có sẵn** | Tiết kiệm 50+ LOC. Pattern đồng nhất với `/trips/new` |
| **Reuse `AddressAutocomplete`, `DraftRestoreBanner`, `formatActionError`** | Tránh duplicate code. UX nhất quán với `/trips/new` |
| **`router.refresh()` sau create** thay vì `useOptimistic` | Đơn giản. Server re-fetch toàn page, calendar pick up trip mới. Trade-off: 1 round-trip. Acceptable cho action ít tần suất |
| **Color by vehicle deterministic hash → 8-color palette** | Match Cargorush style; reproducible across sessions; collision OK với fleet ≤ 8 (PRD §1.1 = 3 xe) |
| **Color mode persist localStorage** (I1) | UX — reload không reset user preference |
| **Role gate `fetchTripsForCalendarAction`** (I2) | Defense in depth — DRIVER không bypass UI |
| **Click event → peek drawer trên `/dashboard`** (không navigate) | Giữ context dashboard, drawer overlay = UX flat hơn |
| **Click empty slot → fill form rail** (không navigate `/trips/new`) | Đúng UX dashboard hub — không rời page |
| **Mobile responsive: stack vertical < lg** | Calendar ưu tiên trên hẹp; form/legend xuống dưới |
| **Sidebar STAFF order: dashboard → trips → vehicles → drivers** | Dashboard primary surface, list = drill-down phụ |

---

## 4. Tech invariants honored (CLAUDE.md v2 compliance)

| Constraint | Status | Evidence |
|---|---|---|
| §4.1 Multi-tenancy `ent_id` filter | ✅ | `listTripsForCalendar`, `listVehicles`, `listDrivers` đều filter `entId` |
| §4.2 Layer separation | ✅ | Server Page → Server Action → Query → Drizzle. Client components không gọi Drizzle |
| §4.4 snake_case request body | ✅ | `createTripAction` payload `scheduled_at`, `pickup_address`, etc. |
| §4.7 No direct `trp_status` mutation | ✅ | Drag chỉ đổi `scheduled_at`; create đi qua action |
| §8 No hardcoded text | ✅ | Mọi text qua `useTranslations('dashboard.*')` |
| §8 No commit `.env` | ✅ | Không touch |
| §8 Audit log invariant | ✅ | TRIP.CREATE + TRIP.UPDATE đã có trong actions tương ứng |
| §8 Soft delete | ✅ | Query filter `trpDeletedAt IS NULL` |
| §4.4 Error code format | ✅ | `CAR-E0413` cho range overflow (kế thừa từ REQ-1) |
| §4.5 File naming kebab-case | ✅ | Tất cả file mới follow convention |
| §8 Role check | ✅ | `requireRole(['ADMIN', 'MANAGER'])` cho `fetchTripsForCalendarAction` (I2) |

---

## 5. Build artifacts

```
Route /dashboard:    25.1 kB route bundle · 340 kB First Load JS
Route /trips:         5.68 kB (sau revert, giảm ~20kB so với REQ-1)
Total pages:          21 generated
Build time:           33.1s
TypeScript errors:    0
ESLint errors:        0
ESLint warnings:      0
```

**Bundle observation**: `/dashboard` nặng hơn `/trips` vì chứa calendar + form + legend + shell. Acceptable. First Load JS shared 103kB không đổi.

---

## 6. Deployment plan

1. **Code review** PR vào `staging-car` (atomic — tất cả phase A→H trong 1 PR).
2. **Merge → staging deploy**:
   ```bash
   ssh ambAppStore@stg-apps.amoeba.site \
     "cd ~/ambAppStore && git pull origin staging-car && bash platform/scripts/deploy-staging.sh"
   ```
3. **Verify Neon index**:
   ```sql
   SELECT indexname FROM pg_indexes
   WHERE tablename='car_trips'
     AND indexname='idx_car_trips_ent_status_scheduled';
   ```
4. **Smoke test** TC-D1..TC-D16 trên `stg-apps.amoeba.site/app-car-manager-v2/dashboard`. Log vào TR-2.
5. **Nếu xanh → PR `staging-car` → `production`**. KHÔNG deploy thẳng prod.

---

## 7. Known limitations & follow-ups

| # | Item | Severity | Follow-up |
|---|---|---|---|
| L1 | Mobile BottomTabNav STAFF mất "Me" slot (dashboard chiếm slot 1) | 🟡 Minor | "Me" qua avatar dropdown desktop. Mobile cần thêm route alt hoặc swap tab `drivers` → `me`. Defer P1 |
| L2 | VehicleLegend "In Use ({count})" không sync sau drag (chỉ refresh on create) | 🟡 Minor | `router.refresh()` sau drag để đồng bộ. P1 |
| L3 | `useFormDraft` localStorage không prefix entId | 🟢 Acceptable | Pattern existing — chuyển sang prefix entId cho mọi form (cần refactor `useFormDraft` core). Defer |
| L4 | Vehicle color collision >8 xe | 🟢 Known | PRD §1.1 = 3 xe. Doc trong code |
| L5 | Resize event / drag-change-vehicle | 🟢 Known | REQ-2 §6 out-of-scope |
| L6 | KPI strip + filter chips | 🟢 Defer P1 | Per REQ-2 §1 |
| L7 | Conflict warning banner | 🟢 Defer | Chờ Gap B P4 (`trip-conflict.service.ts`) |
| L8 | Recurring trip / `.ics` export | 🟢 Defer | REQ-2 §1 COULD |

---

## 8. Files NOT touched (verification)

- ❌ `packages/db/src/schema/*.ts` — schema không đổi
- ❌ `apps/web/src/server/queries/trips.queries.ts` — `listTripsForCalendar` từ REQ-1 reuse y nguyên
- ❌ `apps/web/src/server/services/trip-state-machine.service.ts` — không touch
- ❌ `apps/web/src/app/(app)/trips/_components/trip-peek-drawer.tsx` — reuse 100% (cross-mount từ `/dashboard`)
- ❌ `apps/web/src/app/(app)/trips/_components/driver-trips-list.tsx` — DRIVER không thấy dashboard
- ❌ `apps/web/src/middleware.ts` — không cần update (DRIVER deflect đã có; STAFF không gate)
- ❌ DB migration — index có sẵn cover query

---

## 9. Acceptance criteria status

(from PLAN-2 §7)

- ✅ `/dashboard` route accessible cho ADMIN/MANAGER (page.tsx exist, redirect DRIVER)
- ✅ `/` redirect: ADMIN/MANAGER → `/dashboard`, DRIVER → `/today` (page.tsx line 17)
- ✅ Sidebar có entry "Dashboard" (nav-items.ts entry, icon `LayoutDashboard`)
- ⏳ Calendar 4 view hoạt động (cần test staging)
- ✅ Event color by vehicle mặc định + toggle by status (Phase D)
- ⏳ QuickBookForm tạo trip + toast + calendar refresh (cần test staging)
- ⏳ Click ô trống → form prefill (cần test staging)
- ⏳ VehicleLegend hiển thị (cần test staging)
- ⏳ Click event → peek drawer overlay (cần test staging)
- ⏳ Drag-to-reschedule (cần test staging)
- ✅ `/trips` không còn calendar toggle (Phase A revert verified)
- ⏳ Form draft localStorage (cần test staging — code wired)
- ⏳ Mobile stack vertical (cần test responsive)
- ✅ Build + lint + typecheck pass (Phase H)
- ⏳ i18n 3 ngôn ngữ (cần test runtime)

---

## 10. Lessons learned

1. **Audit before code**: Phase B move + Phase G i18n rename là phần mệt nhất — vì REQ-1 đã code vào `/trips` rồi giờ phải dời. Nếu REQ-2 nhận diện ngay từ đầu (Dashboard route, không phải toggle), tiết kiệm ~2h work.
2. **Reuse > rebuild**: Phát hiện `useFormDraft` + `AddressAutocomplete` + `DraftRestoreBanner` đã exist tiết kiệm đáng kể. Audit codebase trước khi implement luôn pay off.
3. **Phase ordering quan trọng**: Làm i18n trước (Phase G) sửa Bug B1 trước khi build phase C giúp tránh crash giữa chừng.
4. **Defense in depth**: I2 (role gate trên Server Action) — UI có thể bypass, server không.

---

**Author**: Claude Code session 2026-05-22

**Reviewer**: _pending_

**Approval**: _pending_
