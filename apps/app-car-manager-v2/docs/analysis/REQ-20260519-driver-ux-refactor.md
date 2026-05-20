# REQ-20260519 — Driver UI/UX Refactor

> **Tag**: [요구사항] / refactor
> **Date**: 2026-05-19
> **Owner**: dev@amoeba.group
> **Scope**: Frontend UI/UX + design system tokens. **Không đụng** state machine, DB schema, business logic.

## 1. 요구사항 요약 (Requirement Summary)

| # | Requirement | Type |
|---|---|---|
| R1 | Driver có Home view riêng (`/today`) — state-aware, single CTA, thumb-zone | UI |
| R2 | Trip detail (driver view) — sticky bottom action bar, info-density giảm, tap-to-call | UI |
| R3 | Driver có flow submit expense từ PWA (Fuel/Toll/Meal/Parking/Repair/Oil/Inspection/Accident) | UI shell + stub action |
| R4 | Design system: Button size mới `2xl` (~56px) cho driver primary actions | Tokens |
| R5 | Reusable `<DriverActionBar>` (sticky bottom + safe-area) + `<BottomSheet>` preset | Components |
| R6 | i18n đầy đủ vi/en/ko cho mọi text mới (namespace `today.driver`, `expenses.submit`) | i18n |
| R7 | Accessibility: tap target ≥48px, contrast ≥4.5:1 trên status gradient | A11y |

## 2. AS-IS 현황 분석

### 2.1 Driver persona context
- PRD §1.3: Driver là **PWA-only persona**. 3 nhiệm vụ chính:
  1. Confirm trip schedule (Accept / Reject — state `PENDING_DRIVER_CONFIRMATION` → `CONFIRMED|REJECTED_BY_DRIVER`)
  2. Update trip status (Start / End — state `CONFIRMED → IN_PROGRESS → COMPLETED`)
  3. Record trip expenses (8 loại expense, FUEL/OIL/MEAL/REPAIR/PARKING/TOLL/ACCIDENT/INSPECTION)
- PRD §1.2: "Driver 3-second tap, one-handed use" — chưa được thỏa mãn ở UI hiện tại.

### 2.2 Frontend hiện tại

| File | Hiện trạng | Vấn đề cho Driver |
|---|---|---|
| `apps/web/src/app/(app)/today/page.tsx:42-126` | Một view chung cho mọi role (NextTripHero + laterToday list). | Driver phải scroll qua subtitle, badge, avatar trước khi thấy CTA. CTA "Open trip" đẩy sang trang detail mới có action. → 2-step thay vì 1-step. |
| `apps/web/src/app/(app)/trips/[id]/_components/driver-view.tsx` | Có "in-cab mode" với map hero 50vh + accent panel. | TripActions inline, không sticky → có thể bị scroll khuất. Info-density vẫn cao (passenger email, audit footer, driver phone). Reject/Cancel dùng Dialog modal (mobile-unfriendly). |
| `apps/web/src/app/(app)/trips/[id]/trip-actions.tsx:122-158` | Action buttons có gating đúng theo role + state. | Dùng size `md` (h-9 = 36px) — dưới ngưỡng 48px của a11y guideline cho mobile primary. |
| `apps/web/src/app/(app)/costs/page.tsx` | Split-pane approval queue (Admin view) — **sample data only**, không có server action. | Không có entry point cho Driver submit expense. Đây là **biggest gap** so với PRD. |
| `packages/ui/src/components/button.tsx:25-29` | Size range sm/md/lg/xl/icon (max h-11 = 44px). | Thiếu size cho driver primary CTA (cần ≥48px, prefer 56px). |
| `packages/ui/src/components/sheet.tsx` | Sheet có side="bottom" với rounded-t-xl. | Chưa có preset thumb-zone height, chưa có safe-area-inset-bottom. |
| `apps/web/messages/{vi,en,ko}.json` | Có namespace `today`, `trips.detail`, `trips.actions`. | Thiếu `today.driver.*` và `expenses.submit.*`. |

### 2.3 Backend / DB hiện tại (cho Phase D)

| Item | Trạng thái | Note |
|---|---|---|
| `car_expenses` schema | ❌ KHÔNG có (chỉ có `trips`, `drivers`, `vehicles`, `users`, `audit-logs`, `notifications`, `trip-stopovers`) | CLAUDE.md ghi P2 "done" nhưng schema chưa được tạo |
| `expense.actions.ts` server action | ❌ KHÔNG có | |
| S3 presigned upload endpoint | ❌ KHÔNG có | |
| Approval rules table `car_approval_rules` | ❌ KHÔNG có | |

→ **Phase D scope điều chỉnh**: build UI shell + form + camera-capture input **không kết nối backend thật**. Server action `submitExpenseAction` là stub (chỉ toast success + log payload). Backend P2 sẽ là REQ riêng sau.

### 2.4 Role mapping
- AMA `MEMBER` → app `DRIVER` (CLAUDE.md §4.6)
- Role lấy qua `getCurrentUser().role` ở Server Component
- Không có middleware route guard — page nào cũng accessible, gating ở UI conditional + server-side query filter

### 2.5 Trip state machine (CLAUDE.md §4.7)
```
PENDING_ASSIGNMENT
  └─► PENDING_DRIVER_CONFIRMATION
        ├─► CONFIRMED ──► IN_PROGRESS ──► COMPLETED
        ├─► REJECTED_BY_DRIVER
        └─► CANCELLED
```
Driver có thể trigger: Accept, Reject, Start, End — đã có ở `trip-actions.tsx`. Không thay đổi.

## 3. TO-BE 요구사항

### 3.1 AS-IS → TO-BE mapping

| Aspect | AS-IS | TO-BE |
|---|---|---|
| Driver home (`/today`) | Generic hero + list, CTA "Open trip" | `<DriverTodayView>` state-aware: hero + sticky action panel (Accept/Reject/Start/End trực tiếp), không cần navigate sang detail |
| Primary CTA size | Button `size="md"` (36px) | Button `size="2xl"` (56px) cho driver primary actions |
| Primary CTA position | Inline trong content | `<DriverActionBar>` sticky bottom với `pb-[max(env(safe-area-inset-bottom),16px)]` |
| Reject / Cancel input | Dialog modal | `<BottomSheet>` side="bottom" trên mobile |
| Map "Open fullscreen" | Đã ok (PWA-safe deep link `OpenInMapsLink`) | Không thay đổi |
| Passenger contact | Email only | Email + Phone (tap-to-call `tel:`) |
| Notes / audit info | Inline | `<details>` "More details" fold, default closed |
| Expense submission | ❌ Không có | New route `/expenses/new` (driver) + FAB ở `/today` + entry point trong trip detail. Form 1 màn: ExpenseType chip grid → Amount numpad → Date → Note → Receipt camera-first input |

### 3.2 New components

| Component | Location | Purpose |
|---|---|---|
| `<DriverActionBar>` | `apps/web/src/components/layout/driver-action-bar.tsx` | Sticky bottom container, safe-area-inset-bottom, blur backdrop, max 2 buttons |
| `<BottomSheet>` preset | `apps/web/src/components/ui/bottom-sheet.tsx` | Wrapper trên `@car-v2/ui` Sheet với side="bottom", safe-area, max-h-[80vh] |
| `<DriverTodayView>` | `apps/web/src/app/(app)/today/_components/driver-today-view.tsx` | Driver-specific Today screen, state-aware |
| `<DriverNextTripCard>` | `apps/web/src/app/(app)/today/_components/driver-next-trip-card.tsx` | Card chuyến tiếp theo, embedded action panel |
| `<ExpenseSubmitForm>` | `apps/web/src/app/(app)/expenses/new/_components/expense-submit-form.tsx` | Form submit expense (UI shell, stub action) |
| `<ExpenseTypeChipGrid>` | same dir | 8-chip grid với icon + màu cho ExpenseType |
| `<AmountInput>` | same dir | Numpad-optimised currency input (inputMode="decimal") |
| `<ReceiptCameraInput>` | same dir | `<input type="file" accept="image/*" capture="environment">` với preview |

### 3.3 Design tokens

| Token | Value | Where |
|---|---|---|
| Button `size="2xl"` | `h-14 px-6 text-md` + icon h-5 w-5 | `packages/ui/src/components/button.tsx` |
| Driver action area padding bottom | `pb-[max(env(safe-area-inset-bottom),16px)]` | Tailwind utility class trong component |
| Status hero gradient text | `font-bold` + `tracking-wide` để đọc rõ ngoài trời | Existing classes |

### 3.4 i18n keys (3 ngôn ngữ)

```
today.driver.activeNow            "Đang chạy"
today.driver.startsIn             "Bắt đầu trong {n} phút"
today.driver.upNext               "Tiếp theo"
today.driver.waitingConfirm       "Chờ xác nhận của bạn"
today.driver.nothingToday         "Không có chuyến nào hôm nay"
today.driver.recordExpense        "Ghi nhận chi phí"
today.driver.callPassenger        "Gọi {name}"

expenses.submit.title             "Ghi nhận chi phí"
expenses.submit.typeLabel         "Loại chi phí"
expenses.submit.amountLabel       "Số tiền"
expenses.submit.dateLabel         "Ngày phát sinh"
expenses.submit.noteLabel         "Ghi chú (tùy chọn)"
expenses.submit.receiptLabel      "Ảnh hóa đơn"
expenses.submit.receiptCamera     "Chụp ảnh"
expenses.submit.receiptGallery    "Chọn từ thư viện"
expenses.submit.tripLink          "Liên kết chuyến đi (tùy chọn)"
expenses.submit.submit            "Gửi"
expenses.submit.submittedToast    "Đã gửi chi phí. Đang chờ duyệt."
expenses.submit.draftSavedNote    "Đang ở chế độ thử nghiệm — chi phí chưa được lưu vào hệ thống."
```

## 4. 갭 분석 (Gap Analysis)

### 4.1 변경 범위

| Area | Current | Change | Impact |
|---|---|---|---|
| Design system (Button) | 5 sizes | +1 size `2xl` | LOW — additive, không break existing |
| New components (4) | — | New | LOW — đứng riêng, không thay file khác |
| `/today` page | Generic view | Branch theo role | MEDIUM — refactor logic role-check, không thay query |
| Trip detail driver view | Inline actions | Sticky actions + details fold | LOW — chỉ thay layout, không thay logic |
| Trip actions (Reject/Cancel dialog) | Dialog | BottomSheet trên mobile, Dialog desktop | LOW — wrap behind responsive helper |
| New route `/expenses/new` | — | New page + form | MEDIUM — route mới, stub action |
| i18n | Existing keys | +2 namespaces × 3 langs | LOW — additive |

### 4.2 File changes

**Modify (5 files)**:
- `packages/ui/src/components/button.tsx` — add `2xl` size variant
- `apps/web/src/app/(app)/today/page.tsx` — branch by role, call DriverTodayView
- `apps/web/src/app/(app)/trips/[id]/_components/driver-view.tsx` — move actions to sticky bar, fold details
- `apps/web/src/app/(app)/trips/[id]/trip-actions.tsx` — responsive Dialog→BottomSheet, swap size `md`→`2xl` cho driver buttons
- `apps/web/messages/{vi,en,ko}.json` — add `today.driver.*`, `expenses.submit.*` keys

**Create (9 files)**:
- `apps/web/src/components/layout/driver-action-bar.tsx`
- `apps/web/src/components/ui/bottom-sheet.tsx`
- `apps/web/src/app/(app)/today/_components/driver-today-view.tsx`
- `apps/web/src/app/(app)/today/_components/driver-next-trip-card.tsx`
- `apps/web/src/app/(app)/expenses/new/page.tsx`
- `apps/web/src/app/(app)/expenses/new/_components/expense-submit-form.tsx`
- `apps/web/src/app/(app)/expenses/new/_components/expense-type-chip-grid.tsx`
- `apps/web/src/app/(app)/expenses/new/_components/amount-input.tsx`
- `apps/web/src/app/(app)/expenses/new/_components/receipt-camera-input.tsx`
- `apps/web/src/server/actions/expenses/expense.actions.ts` — **STUB** chỉ log + return success

### 4.3 DB migration

**Không có**. Phase D dùng stub action — không insert/update DB. Backend P2 thật là REQ riêng.

### 4.4 Backend / state-machine changes

**Không có**. Driver state transitions (Accept/Reject/Start/End) đã có ở `trip.actions.ts`, không refactor.

## 5. User flow

### 5.1 Driver — Accept then Start trip
```
[PWA mở] → /today
   ↓
[DriverTodayView state-aware]
   ↓ trip status = PENDING_DRIVER_CONFIRMATION
[Hero card: passenger, route, time]
[Sticky bottom: <Reject> <Accept> — size 2xl]
   ↓ tap Accept
[Server action acceptTripAction] → toast success → re-render
   ↓ trip status = CONFIRMED
[Sticky bottom: <Start trip> — size 2xl, accent]
   ↓ tap Start (khi đến giờ)
[Server action startTripAction] → toast → re-render
   ↓ trip status = IN_PROGRESS
[Sticky bottom: <End trip> — size 2xl, primary]
```

### 5.2 Driver — Submit expense
```
[/today với active trip]
   ↓ tap FAB (góc dưới phải) hoặc "Record expense" trong trip detail
[/expenses/new?tripId=... ]
   ↓
[Form 1 màn]
   ├─ ExpenseTypeChipGrid (8 chips)
   ├─ AmountInput (numpad)
   ├─ Date picker (default today)
   ├─ Note (optional textarea)
   ├─ ReceiptCameraInput (camera-first)
   ↓ tap Submit (sticky bottom)
[Stub action submitExpenseAction]
   → toast "Đã gửi. Đang chờ duyệt." + note "Chế độ thử nghiệm"
   → router.back() hoặc /today
```

### 5.3 Reject với reason (mobile)
```
[Trip detail driver view]
   ↓ tap Reject (sticky bottom)
[BottomSheet slide up from bottom]
   ├─ Title "Lý do từ chối"
   ├─ Textarea (required, min 3 chars)
   ↓ tap Confirm
[Server action rejectTripAction({reason})] → toast → close sheet
```

## 6. 기술 제약사항

- **PWA standalone mode**: mọi link nội bộ phải dùng `next/link` (đã fix ở P5). Mọi link ngoài (mailto, tel, https) phải biết cách hành xử đúng — đã có `OpenInMapsLink` cho Maps.
- **Safe area**: iPhone notch + home indicator → mọi sticky element phải có `env(safe-area-inset-*)` padding.
- **One-handed**: thumb-zone ở 1/3 dưới màn (200–300px từ đáy). Primary action nằm trong vùng đó.
- **Touch target**: WCAG 2.5.5 AA = 24×24px min, AAA = 44×44px. Apple HIG = 44pt. Material = 48dp. Chọn **48px min cho secondary, 56px cho primary** driver actions.
- **Contrast**: status gradient có text trắng trên bg-accent (Toss blue) → kiểm tra >= 4.5:1.
- **next-intl**: thêm key mới ở 3 files vi/en/ko, không break existing namespace.
- **Server Components first**: DriverTodayView là RSC (render trên server, lấy dữ liệu). Sticky `<DriverActionBar>` cần `'use client'` cho transitions. Expense form là client component cho file input + form state.
- **No backend dependency**: Phase D stub action không gọi DB → đảm bảo build pass dù P2 backend chưa làm.
