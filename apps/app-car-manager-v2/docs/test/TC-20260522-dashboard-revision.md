# TC-20260522 — Dashboard Revision Test Cases

Based on [PLAN-20260522-dashboard-revision.md](../plan/PLAN-20260522-dashboard-revision.md).

**Pre-conditions**: same as TC-20260522-schedule-dashboard.

---

## TC-R1: Right rail layout

| Step | Action | Expected |
|---|---|---|
| 1.1 | ADMIN mở `/dashboard` | Right rail: VehicleLegend top, **TripsListPanel bottom (no QuickBookForm)** |
| 1.2 | Inspect DOM | KHÔNG có `<QuickBookForm>` component |

## TC-R2: PageHeader + Tạo

| Step | Action | Expected |
|---|---|---|
| 2.1 | Click "+ Tạo chuyến" trong PageHeader | TripFormDialog mở, focus pickup input, fields trống |
| 2.2 | Esc | Dialog đóng, data discard |
| 2.3 | Click outside | Dialog đóng |
| 2.4 | Click "Cancel" trong dialog | Dialog đóng |

## TC-R3: Tạo trip qua dialog

| Step | Action | Expected |
|---|---|---|
| 3.1 | Click "+ Tạo" → nhập pickup/dropoff/datetime → click "Tạo chuyến" | createTripAction gọi |
| 3.2 | Success | Toast `Đã tạo chuyến TR-XXXX`. Dialog đóng. URL update `?highlight=<id>` |
| 3.3 | Calendar | Event chip có outline + pulse 3s |
| 3.4 | TripsListPanel | Row trip mới ở top (sort DESC scheduledAt) + ring |
| 3.5 | Sau 3s | `?highlight=` xoá khỏi URL (router.replace) |
| 3.6 | Validation fail (pickup trống) | Toast error, dialog vẫn mở |

## TC-R4: Tạo từ click ô trống calendar

| Step | Action | Expected |
|---|---|---|
| 4.1 | Month view, click ô 25/5 | Dialog mở mode='create'. Field "Thời gian" = 25/5 00:00 |
| 4.2 | Week view, click slot 14:23 | Dialog mở. Field datetime = ngày đó T14:15 (snap 15') |
| 4.3 | Gantt view, click row vehicle A | Dialog mở. Field "Xe" pre-select A |

## TC-R5: Edit qua dialog

| Step | Action | Expected |
|---|---|---|
| 5.1 | Click event chip TR-1234 trên calendar | URL `?peek=trp-1234`, peek drawer mở |
| 5.2 | Click "Edit" trong drawer | Drawer đóng. TripFormDialog mở mode='edit', fields prefilled |
| 5.3 | Sửa pickup → click "Lưu thay đổi" | updateTripAction gọi, dialog đóng, toast success |
| 5.4 | URL update `?highlight=trp-1234` | Event chip + list panel row pulse 3s |
| 5.5 | Click "Mở form đầy đủ →" (footer dialog) | Navigate `/trips/trp-1234/edit` |

## TC-R6: TripsListPanel

| Step | Action | Expected |
|---|---|---|
| 6.1 | Right rail load | Card "Chuyến đi" + "+ Tạo" button + list 12 rows sorted DESC scheduledAt |
| 6.2 | Trip PENDING_ASSIGNMENT | Badge "Đang chờ" tone accent |
| 6.3 | Click row | URL `?peek=<id>`, peek drawer mở |
| 6.4 | Empty state (tenant 0 trip) | "Chưa có chuyến nào" + link "Tạo chuyến đầu tiên" → mở dialog |
| 6.5 | Click "Xem tất cả →" footer | Navigate `/trips` |
| 6.6 | Tenant > 12 trip | Hiển thị 12 đầu tiên, link "Xem tất cả" rõ |
| 6.7 | List overflow viewport | Scroll trong panel, KHÔNG scroll page |

## TC-R7: Highlight after action

| Step | Action | Expected |
|---|---|---|
| 7.1 | Tạo trip schedule = hôm nay | Highlight pulse 3s trên Month event chip + TripsListPanel row |
| 7.2 | Tạo trip schedule = tháng sau | Calendar auto-jump anchor sang tháng sau, event visible với pulse |
| 7.3 | Edit trip thay đổi giờ | Highlight pulse trên view hiện tại; nếu giờ mới ngoài range → auto-jump |
| 7.4 | F5 reload sau 3s | `?highlight=` đã clean khỏi URL (router.replace) |

## TC-R8: Drag-reschedule sync

| Step | Action | Expected |
|---|---|---|
| 8.1 | Drag trip PENDING sang giờ khác cùng ngày | Optimistic update local; `router.refresh()` |
| 8.2 | VehicleLegend "In Use" count | Cập nhật (nếu trip IN_PROGRESS giờ khác — usually no change vì cùng ngày) |
| 8.3 | TripsListPanel | Re-sort nếu scheduledAt đổi |
| 8.4 | Toast | "Đã đổi giờ chuyến TR-XXXX" |

## TC-R9: Now indicator tick (P2 A3)

| Step | Action | Expected |
|---|---|---|
| 9.1 | Time-grid Week view, đợi 1 phút | Vạch cam ngang dịch xuống 1 nấc (≈ 44/60 px) |
| 9.2 | Gantt view, đợi 1 phút | Vạch cam dọc dịch sang phải |
| 9.3 | Tab inactive 5 phút | Tick vẫn chạy (setInterval không pause) |

## TC-R10: Scroll-to-now (P2 A4)

| Step | Action | Expected |
|---|---|---|
| 10.1 | Mount Week view, anchor=hôm nay, giờ hiện tại 15:00 | Scroll position: now line ở ~1/3 từ top viewport (gridRef.scrollTop ≈ nowTopPx - 100) |
| 10.2 | Mount Day view today | Same |
| 10.3 | Mount Week view, anchor=tuần khác | KHÔNG scroll (`isSameDay` check fail) |
| 10.4 | User scroll lên rồi switch view + back | KHÔNG re-scroll (useEffect deps `[]` mount only) |

## TC-R11: Dialog edge cases

| Step | Action | Expected |
|---|---|---|
| 11.1 | Mở dialog, nhập 1/2 fields, Esc | Dialog đóng, data DISCARD (không persist) |
| 11.2 | Mở dialog, reload trang | Dialog không tự mở lại; data trống |
| 11.3 | MANAGER edit trip CONFIRMED | Action throw `CAR-E1006`. Dialog hiển thị error toast. Form vẫn mở để user retry hoặc đóng |
| 11.4 | Dialog max-height màn 320px (very small) | Form scrollable trong dialog, không tràn |

## TC-R12: TripPeekDrawer onEdit prop

| Step | Action | Expected |
|---|---|---|
| 12.1 | `/dashboard` peek drawer click "Edit" | Drawer đóng, TripFormDialog mở edit (callback path) |
| 12.2 | `/trips` peek drawer click "Edit" | Navigate `/trips/<id>/edit` (legacy behavior — không truyền `onEdit` prop) |

## TC-R13: i18n

| Step | Action | Expected |
|---|---|---|
| 13.1 | locale=vi | Dialog title "Tạo chuyến mới" / "Sửa chuyến TR-XXX" |
| 13.2 | locale=en | "New trip" / "Edit TR-XXX" |
| 13.3 | locale=ko | "새 운행 만들기" / "운행 {ref} 편집" |
| 13.4 | TripsListPanel header per locale | "Chuyến đi" / "Trips" / "운행" |

## TC-R14: Build & lint

| Step | Action | Expected |
|---|---|---|
| 14.1 | `npm run typecheck` | Pass |
| 14.2 | `npm run lint` | Pass |
| 14.3 | `npm run build` | Pass |
| 14.4 | Bundle `/dashboard` route | < 35 kB (tăng từ 25.1 kB do dialog + list panel) |

---

## Definition of Done

- ✅ TC-R1..TC-R14 pass trên staging
- ✅ Build + lint + typecheck xanh
- ✅ Smoke test 3 role × 3 locale × Month/Week/Day/Gantt
- ✅ Test record vào TR-20260522-dashboard-revision.md
