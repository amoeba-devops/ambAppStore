# PLAN-20260519 — Driver UI/UX Refactor

> **REQ ref**: [REQ-20260519-driver-ux-refactor.md](../analysis/REQ-20260519-driver-ux-refactor.md)
> **Date**: 2026-05-19
> **Branch**: `feat/car-v2-p5-pwa-setup` (đang stage P5 PWA — work này nối vào P5 vì driver là PWA-only persona)

## 1. 시스템 개발 현황 분석

### 1.1 Repo structure relevant
```
apps/app-car-manager-v2/
├── apps/web/src/
│   ├── app/(app)/
│   │   ├── today/page.tsx                       ← MODIFY (branch by role)
│   │   ├── today/_components/                   ← NEW (driver-today-view, driver-next-trip-card)
│   │   ├── trips/[id]/_components/driver-view.tsx ← MODIFY (sticky bar, fold)
│   │   ├── trips/[id]/trip-actions.tsx          ← MODIFY (responsive sheet, 2xl size)
│   │   ├── expenses/new/                        ← NEW route + components
│   │   └── costs/page.tsx                       ← unchanged (admin approval queue)
│   ├── components/
│   │   ├── layout/driver-action-bar.tsx         ← NEW
│   │   └── ui/bottom-sheet.tsx                  ← NEW
│   ├── server/actions/
│   │   └── expenses/expense.actions.ts          ← NEW (stub)
│   └── ...
├── packages/ui/src/components/button.tsx        ← MODIFY (add 2xl size)
└── apps/web/messages/{vi,en,ko}.json            ← MODIFY (add 2 namespaces)
```

### 1.2 Tech stack constraints
- Next.js 15 App Router + RSC default
- `'use client'` chỉ khi cần (forms, state, transitions, file input)
- next-intl v3 — `useTranslations()` client, `getTranslations()` server
- Tailwind 3 + design tokens trong `tokens.css`
- `@car-v2/ui` cho primitives — KHÔNG bypass

### 1.3 Existing patterns to reuse
- `getCurrentUser()` từ `@/lib/auth/get-current-user` — RSC-safe
- `getDriverByUserId(entId, userId)` từ `@/server/queries/drivers.queries` — đã có cho /today
- `listTripsForDriver(entId, drvId, n)` — đã có
- `TripActions` props `role`, `isAssignedDriver`, `isCreator` — giữ nguyên interface
- `OpenInMapsLink` cho map deep link
- `toast.success` / `toast.error` từ `@car-v2/ui`

### 1.4 Constraints (anti-patterns to avoid)
- ❌ Hard-code UI text → must use i18n
- ❌ Direct DB call from Client Component → must go through Server Action
- ❌ Set `trp_status` directly → must go through `trip-state-machine.service`
- ❌ Insert/update DB cho expense (vì backend P2 chưa có) → stub action chỉ log

## 2. 단계별 구현 계획 (Phased Implementation)

### Phase A — Design system foundation
**Mục tiêu**: tạo primitives reusable trước khi build feature.

#### A.1 — Button size `2xl`
- File: `packages/ui/src/components/button.tsx:24-30`
- Change: thêm `2xl: 'h-14 px-6 text-md [&_svg]:h-5 [&_svg]:w-5'`
- Sample usage: `<Button variant="accent" size="2xl">Accept</Button>` → 56px tall
- └─ 사이드 임팩트: không có (additive, không thay default)

#### A.2 — `<DriverActionBar>` component
- File: `apps/web/src/components/layout/driver-action-bar.tsx` (NEW)
- Props: `children: React.ReactNode`, `className?: string`
- Structure:
  ```tsx
  <div className="sticky bottom-0 z-30 -mx-4 md:mx-0 bg-bg/90 backdrop-blur border-t border-border
                  px-4 py-3 pb-[max(env(safe-area-inset-bottom),12px)]
                  flex flex-col gap-2">
    {children}
  </div>
  ```
- └─ 사이드 임팩트: không có (component mới đứng riêng)

#### A.3 — `<BottomSheet>` wrapper
- File: `apps/web/src/components/ui/bottom-sheet.tsx` (NEW)
- Wraps `@car-v2/ui` Sheet với defaults: `side="bottom"`, max-h-[80vh], rounded-t-2xl, safe-area-inset-bottom
- Re-export `BottomSheet`, `BottomSheetTrigger`, `BottomSheetHeader`, `BottomSheetContent`, `BottomSheetFooter`, `BottomSheetTitle`, `BottomSheetDescription`
- └─ 사이드 임팩트: không có (wrapper, không thay base Sheet)

### Phase B — `/today` Driver mode

#### B.1 — Branch `/today/page.tsx` theo role
- File: `apps/web/src/app/(app)/today/page.tsx:42-126`
- Change: sau khi resolve `user.role`, nếu DRIVER → return `<DriverTodayView trips={myTrips} t={t}>`. Manager/Admin giữ logic hiện tại.
- └─ 사이드 임팩트: Manager/Admin view không bị ảnh hưởng (early-return pattern)

#### B.2 — `<DriverTodayView>` state-aware
- File: `apps/web/src/app/(app)/today/_components/driver-today-view.tsx` (NEW)
- State buckets:
  - `IN_PROGRESS` trip → "Active" mode: full-bleed status banner + ETA + `<DriverActionBar>` "End trip"
  - `PENDING_DRIVER_CONFIRMATION` trip → "Confirm" mode: hero card + `<DriverActionBar>` "Reject" + "Accept"
  - `CONFIRMED` trip starting soon (≤ 60min) → "Ready" mode: countdown + `<DriverActionBar>` "Start trip"
  - Empty → EmptyState với CTA "Browse my trips" → `/trips?driver=me`
- Bottom-right FAB: "Record expense" → `/expenses/new`
- └─ 사이드 임팩트: `TripActions` được embed lại trong DriverActionBar — phải đảm bảo cùng tripId / status truyền đúng

#### B.3 — `<DriverNextTripCard>` reusable card
- File: `apps/web/src/app/(app)/today/_components/driver-next-trip-card.tsx` (NEW)
- Props: `trip: TripListItem`, `mode: 'active' | 'confirm' | 'ready'`
- Renders: gradient header (status), passenger avatar+name, pickup→dropoff route, scheduled time, vehicle plate
- └─ 사이드 임팩트: không có (component mới)

### Phase C — Trip detail driver view

#### C.1 — Move TripActions to sticky bar
- File: `apps/web/src/app/(app)/trips/[id]/_components/driver-view.tsx:93-117`
- Change: gỡ `<section>` chứa TripActions khỏi nội dung. Thêm `<DriverActionBar>` ở cuối JSX (sau notes/details), bên trong chứa TripActions.
- Adjust padding bottom của container chính: `pb-32` để không bị che bởi sticky bar.
- └─ 사이드 임팩트: Map hero hiện 50vh có thể che ActionBar nếu user chưa scroll. → giảm map hero xuống `35vh md:50vh` để route timeline xuất hiện trên fold.

#### C.2 — Fold passenger/notes/driver-phone vào `<details>`
- File: same
- Change: gom passenger card + notes + driver phone footer vào 1 `<details>` "More details", default closed. Status/route/map/action vẫn ở top.
- └─ 사이드 임팩트: không có (chỉ DOM grouping, không thay logic)

#### C.3 — Tap-to-call passenger
- File: same
- Need: `trip.passengerPhone` field — check `TripDetail` type
- Nếu có: thêm `<a href="tel:{phone}">` button ngang với email
- Nếu không: skip C.3, ghi trong RPT
- └─ 사이드 임팩트: nếu schema chưa có passenger phone, skip này.

#### C.4 — Reject / Cancel dialog → BottomSheet on mobile
- File: `apps/web/src/app/(app)/trips/[id]/trip-actions.tsx:300-350` (`ReasonDialog`)
- Change: dùng `useMediaQuery('(max-width: 768px)')` hoặc Tailwind responsive — keep Dialog as fallback, render BottomSheet < md.
- Simpler approach: tất cả ReasonDialog đổi sang dùng `<BottomSheet>` wrapper (đã có rounded corner, safe-area). BottomSheet trên desktop vẫn ổn (slide up from bottom).
- └─ 사이드 임팩트: AssignDialog (admin) cũng đổi → cần test admin flow vẫn ok.

#### C.5 — Swap driver action button sizes to `2xl`
- File: `apps/web/src/app/(app)/trips/[id]/trip-actions.tsx:125-154`
- Change: conditionally pass `size={role === 'DRIVER' ? '2xl' : 'md'}` cho Accept/Reject/Start/End
- └─ 사이드 임팩트: Admin "Assign" và Manager "Cancel" giữ size `md` — không ảnh hưởng

### Phase D — Driver expense submission (UI shell + stub)

#### D.1 — Stub server action
- File: `apps/web/src/server/actions/expenses/expense.actions.ts` (NEW)
- Export: `submitExpenseAction(input: ExpenseSubmitInput): Promise<ActionResult<{ id: string }>>`
- Input shape: `{ type, amount, occurredAt, note?, tripId?, receiptFiles? }`
- Behavior:
  - Validate input bằng Zod schema (vào file riêng `expense.zod.ts`)
  - Log payload to console.info với prefix `[STUB submitExpenseAction]`
  - Return `{ success: true, data: { id: 'stub-' + crypto.randomUUID() } }`
- Note clear trong file comment: "STUB — backend P2 chưa có. Replace khi `car_expenses` schema có sẵn."
- └─ 사이드 임팩트: không có (file mới)

#### D.2 — `/expenses/new` page
- File: `apps/web/src/app/(app)/expenses/new/page.tsx` (NEW)
- RSC: lấy `getCurrentUser()`, optional query param `?tripId=...`
- Render `<PageHeader title='expenses.submit.title' breadcrumb />` + `<ExpenseSubmitForm tripId={...} />`
- └─ 사이드 임팩트: thêm route mới, sidebar nav có thể cần thêm entry (defer — driver dùng FAB)

#### D.3 — `<ExpenseSubmitForm>`
- File: `apps/web/src/app/(app)/expenses/new/_components/expense-submit-form.tsx` (NEW, client)
- React Hook Form + Zod (cùng schema với action)
- Fields:
  1. `<ExpenseTypeChipGrid>` — required
  2. `<AmountInput>` — required, VND format
  3. `<Input type="date" defaultValue={today}>` — required
  4. `<Textarea note>` — optional
  5. `<ReceiptCameraInput>` — optional, max 5 files
  6. Hidden `tripId` field nếu có query param
- Submit handler:
  - call `submitExpenseAction(values)`
  - on success → toast + `router.push('/today')`
- Bottom sticky `<Button size="2xl" variant="accent">Submit</Button>` trong `<DriverActionBar>`
- └─ 사이드 임팩트: react-hook-form đã có trong project — không thêm dep mới

#### D.4 — `<ExpenseTypeChipGrid>`
- File: `apps/web/src/app/(app)/expenses/new/_components/expense-type-chip-grid.tsx` (NEW)
- Grid 4 cột × 2 hàng, mỗi chip: icon (Fuel/Droplet/Receipt/Wrench/Square/Coins/Shield/ClipboardCheck từ lucide) + label
- Selected state: ring-2 ring-accent + bg-accent-soft
- Props: `value`, `onChange`
- └─ 사이드 임팩트: không có

#### D.5 — `<AmountInput>`
- File: `apps/web/src/app/(app)/expenses/new/_components/amount-input.tsx` (NEW)
- `<input type="text" inputMode="decimal" pattern="[0-9]*">` để mobile bung numpad
- Display formatted VND: 1.250.000₫ (parse out separators)
- Props: `value`, `onChange` (số)
- └─ 사이드 임팩트: không có

#### D.6 — `<ReceiptCameraInput>`
- File: `apps/web/src/app/(app)/expenses/new/_components/receipt-camera-input.tsx` (NEW)
- 2 button: "📷 Chụp ảnh" (`<input type="file" accept="image/*" capture="environment">`), "🖼 Chọn từ thư viện" (`<input type="file" accept="image/*">`)
- Preview grid: thumbnails với X để remove
- Stub mode: KHÔNG upload S3 (chỉ giữ trong `File[]` state, log size khi submit)
- Max 5 files, mỗi file ≤ 5MB (client-side check)
- └─ 사이드 임팩트: file không thực sự upload — clarify trong note "Chế độ thử nghiệm"

#### D.7 — FAB "Record expense" ở `/today`
- File: `apps/web/src/app/(app)/today/_components/driver-today-view.tsx`
- Component: `<Link href="/expenses/new" className="fixed bottom-24 right-4 ...">` (above DriverActionBar — `bottom-24` để không đè)
- Icon: `Receipt` + tooltip / aria-label "Ghi nhận chi phí"
- └─ 사이드 임팩트: position fixed có thể overlap nếu user mở keyboard — chỉ là minor concern

### Phase E — i18n + a11y

#### E.1 — Add keys to `messages/{vi,en,ko}.json`
- Namespaces: `today.driver.*`, `expenses.submit.*`, `expenses.types.*` (re-use existing nếu có)
- 3 ngôn ngữ song hành — vi base, en/ko mirror
- └─ 사이드 임팩트: không có (additive)

#### E.2 — A11y verification
- Mọi sticky button có `aria-label` rõ ràng
- Mọi chip có `role="radio"` trong group `role="radiogroup"` (ExpenseTypeChipGrid)
- Mọi `<input type="file">` có `<label>` associate
- Status gradient → kiểm tra contrast với devtools (manual)
- └─ 사이드 임팩트: không có

## 3. 변경 파일 목록

| # | Area | File | Change | Reason |
|---|---|---|---|---|
| 1 | UI primitive | `packages/ui/src/components/button.tsx` | MODIFY | Add `2xl` size |
| 2 | Layout component | `apps/web/src/components/layout/driver-action-bar.tsx` | NEW | Sticky bottom CTA bar |
| 3 | UI wrapper | `apps/web/src/components/ui/bottom-sheet.tsx` | NEW | Mobile-first sheet preset |
| 4 | Page (today) | `apps/web/src/app/(app)/today/page.tsx` | MODIFY | Branch by role |
| 5 | Component | `apps/web/src/app/(app)/today/_components/driver-today-view.tsx` | NEW | Driver Today screen |
| 6 | Component | `apps/web/src/app/(app)/today/_components/driver-next-trip-card.tsx` | NEW | Trip card with embedded actions |
| 7 | Trip detail | `apps/web/src/app/(app)/trips/[id]/_components/driver-view.tsx` | MODIFY | Sticky bar + details fold |
| 8 | Trip actions | `apps/web/src/app/(app)/trips/[id]/trip-actions.tsx` | MODIFY | BottomSheet + size 2xl |
| 9 | Server action stub | `apps/web/src/server/actions/expenses/expense.actions.ts` | NEW | Stub for UI shell |
| 10 | Zod | `apps/web/src/server/actions/expenses/expense.zod.ts` | NEW | Shared schema |
| 11 | Page (expense) | `apps/web/src/app/(app)/expenses/new/page.tsx` | NEW | Driver expense submit screen |
| 12 | Form | `apps/web/src/app/(app)/expenses/new/_components/expense-submit-form.tsx` | NEW | RHF form |
| 13 | Form bit | `apps/web/src/app/(app)/expenses/new/_components/expense-type-chip-grid.tsx` | NEW | 8-chip picker |
| 14 | Form bit | `apps/web/src/app/(app)/expenses/new/_components/amount-input.tsx` | NEW | Numpad currency input |
| 15 | Form bit | `apps/web/src/app/(app)/expenses/new/_components/receipt-camera-input.tsx` | NEW | Camera-first file input |
| 16 | i18n | `apps/web/messages/vi.json` | MODIFY | Add keys |
| 17 | i18n | `apps/web/messages/en.json` | MODIFY | Add keys |
| 18 | i18n | `apps/web/messages/ko.json` | MODIFY | Add keys |

**Total: 5 modify, 13 new**

## 4. 사이드 임팩트 분석

| Scope | Risk | Description | Mitigation |
|---|---|---|---|
| Button `size=2xl` | 🟢 Low | Additive, không thay default | — |
| `/today` page | 🟡 Medium | Refactor branching, có thể break Manager view nếu logic sai | Early-return pattern + giữ exact existing JSX cho non-driver path |
| `<DriverActionBar>` overlapping content | 🟡 Medium | Sticky bar che content cuối | `pb-32` trên container chính |
| BottomSheet thay Dialog (AssignDialog) | 🟡 Medium | Admin assign flow là critical path | Test thủ công Admin role với assign flow trước commit |
| Map hero giảm size | 🟢 Low | Chỉ thay class — không thay logic | — |
| Expense stub action | 🟢 Low | KHÔNG ghi DB → không có risk data corrupt | Comment rõ trong file |
| File input UX iOS | 🟡 Medium | `capture="environment"` cần HTTPS + permission | Document trong RPT — test thật trên thiết bị |
| i18n missing key | 🟢 Low | next-intl fallback to key string nếu missing | Add đủ 3 ngôn ngữ trước commit |
| PWA standalone mode | 🟢 Low | Tất cả navigation dùng `next/link` | Lint check không có `target="_blank"` trên internal links |

## 5. DB 마이그레이션

**Không có**. Phase D dùng stub action không insert/update DB. Backend P2 thật (car_expenses schema + S3 upload + approval rules) là REQ riêng sẽ làm sau.

## 6. Implementation order

1. Phase A — Build foundations (button size, action bar, bottom sheet) → 1 commit
2. Phase E.1 — Add i18n keys (do trước để các phase B/C/D dùng được) → 1 commit
3. Phase B — Driver Today view → 1 commit
4. Phase C — Trip detail driver view tweaks → 1 commit
5. Phase D — Expense submission UI shell → 1 commit
6. Phase E.2 — A11y review pass → squash vào commit cuối
7. Typecheck + lint → fix nếu fail
8. TR + RPT docs

## 7. Out of scope (explicitly deferred)

- Backend P2 thật (`car_expenses` schema, S3 presigned upload, approval rules) → REQ riêng
- Driver availability toggle (PRD §6.5 / D7 prototype) → divergence, không implement
- Offline cache cho trip detail (P5 SW phần caching) → P5 task riêng
- Push notification opt-in UI cho driver → P4 task
- Refactor sidebar/bottom-tab nav cho driver mode → defer cho đến khi PWA shell hoàn thiện
