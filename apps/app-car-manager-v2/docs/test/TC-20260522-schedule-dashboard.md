# TC-20260522 — Schedule Dashboard Test Cases

Based on [PLAN-20260522-schedule-dashboard.md](../plan/PLAN-20260522-schedule-dashboard.md). Manual test cases.

**Pre-conditions**:
- Staging deployed after merge `staging-car`.
- Seed: ≥3 vehicles (Available/InUse/Maintenance mix), ≥6 trips across statuses, ≥1 trip overlap, ≥1 trip unassigned (no `trpVehicleId`).
- 3 test users: ADMIN, MANAGER, DRIVER.

---

## TC-D1: Landing redirect

| Step | Action | Expected |
|---|---|---|
| 1.1 | ADMIN gõ `/` (root) | Redirect → `/dashboard`. URL bar update |
| 1.2 | MANAGER gõ `/` | Redirect → `/dashboard` |
| 1.3 | DRIVER gõ `/` | Redirect → `/today` (giữ PWA-first view) |
| 1.4 | Unauth user gõ `/` | Flow auth thường (không bị redirect lạ) |
| 1.5 | ADMIN gõ `/today` trực tiếp | KHÔNG redirect, render `/today` như cũ (backward compat) |

---

## TC-D2: Sidebar nav

| Step | Action | Expected |
|---|---|---|
| 2.1 | ADMIN/MANAGER mở app | Sidebar có entry "Dashboard" (icon `LayoutDashboard`) ngay sau "Hôm nay" |
| 2.2 | Click sidebar "Dashboard" | URL → `/dashboard`, page load |
| 2.3 | DRIVER mở app | Sidebar KHÔNG có entry Dashboard |
| 2.4 | Locale=vi/en/ko | Label đổi theo: "Bảng điều khiển" / "Dashboard" / "대시보드" |

---

## TC-D3: `/dashboard` route access control

| Step | Action | Expected |
|---|---|---|
| 3.1 | ADMIN navigate `/dashboard` | Page render: PageHeader + Calendar + right rail |
| 3.2 | MANAGER navigate `/dashboard` | Page render — chỉ thấy own trips trên calendar |
| 3.3 | DRIVER gõ tay `/dashboard` | Redirect `/today` (không 403) |

---

## TC-D4: Calendar (reuse REQ-1 functionality)

| Step | Action | Expected |
|---|---|---|
| 4.1 | Month/Week/Day/Gantt view switching | Hoạt động giống TC-2 của REQ-1 |
| 4.2 | Prev/Next/Today navigation | Hoạt động |
| 4.3 | Drag PENDING trip → ngày khác | `updateTripAction` gọi, toast success, audit log mới |
| 4.4 | Drag COMPLETED trip | Cursor not-allowed, không network call |
| 4.5 | Click "+N more" trong Month | Switch sang Day view, anchor = ngày đó |
| 4.6 | Trip không có vehicle | Hiển thị màu xám fallback với border dashed |
| 4.7 | F5 reload | Sub-view persist (localStorage) |

---

## TC-D5: Event color by vehicle (NEW)

| Step | Action | Expected |
|---|---|---|
| 5.1 | Mặc định mở `/dashboard` | Event color theo vehicle (Cargorush style). Xe A = màu 1, xe B = màu 2, xe C = màu 3 |
| 5.2 | Cùng 1 vehicle, nhiều trip ở các status | Tất cả trip cùng vehicle = cùng màu (background + border-l) |
| 5.3 | Trip không có vehicle | Màu xám neutral, border-l dashed |
| 5.4 | Click toggle "Theo trạng thái" trên toolbar | Color đổi sang theo status (PENDING vàng, CONFIRMED xanh, etc.) |
| 5.5 | F5 reload sau toggle | KHÔNG persist color mode — về mặc định "Theo xe" |
| 5.6 | Color của xe X trên calendar | Khớp với color chip của xe X trong VehicleLegend (visual mapping) |

---

## TC-D6: VehicleLegend (NEW)

| Step | Action | Expected |
|---|---|---|
| 6.1 | Right rail trên cùng | `<VehicleLegend>` Card hiển thị 3 xe + status |
| 6.2 | Vehicle A status=AVAILABLE | Row: color chip + plate + Badge "Sẵn sàng" tone success |
| 6.3 | Vehicle B status=IN_USE, có 2 trip đang chạy | Badge "Đang sử dụng (2)" tone info |
| 6.4 | Vehicle C status=MAINTENANCE | Badge "Bảo trì" tone warning |
| 6.5 | Click "Quản lý xe →" footer link | Navigate `/vehicles` |
| 6.6 | Tenant 0 vehicle | Card hiển thị empty state |

---

## TC-D7: QuickBookForm (NEW)

| Step | Action | Expected |
|---|---|---|
| 7.1 | Right rail dưới | `<QuickBookForm>` Card hiển thị: passenger / pickup / dropoff / datetime / duration / vehicle / driver / purpose / notes / submit + reset |
| 7.2 | ADMIN: Passenger Select hoạt động (chọn user khác) | OK |
| 7.3 | MANAGER: Passenger field locked = self | Field disabled, value=self |
| 7.4 | Submit pickup="" | Validation error "Required" |
| 7.5 | Submit hợp lệ | `createTripAction` gọi, toast "Đã tạo chuyến TR-XXXX", calendar refresh, form reset |
| 7.6 | Submit fail (vd: time in past cho Manager) | Toast lỗi, form data giữ nguyên |
| 7.7 | Click "Reset" | Form clear, draft cũng clear |
| 7.8 | Click "Cần điểm ghé? Mở form đầy đủ →" | Navigate `/trips/new?...` carry over hiện tại của form |

---

## TC-D8: Click empty slot → form prefill (NEW)

| Step | Action | Expected |
|---|---|---|
| 8.1 | Calendar Month, click ô ngày 25/5 | KHÔNG navigate `/trips/new`. Form rail field "Date" auto-fill 25/5/2026, "Time" = 00:00 (hoặc default) |
| 8.2 | Calendar Week, click slot 25/5 14:23 | Form rail "Date"=25/5, "Time"=14:15 (snap 15') |
| 8.3 | Calendar Gantt, click row vehicle A trên 14:00 | Form rail "Date"=hôm nay, "Time"=14:00, **"Vehicle"=A pre-selected** |
| 8.4 | User submit form sau prefill | Trip tạo với data prefill, calendar update |

---

## TC-D9: Click event → peek drawer trên `/dashboard` (NEW)

| Step | Action | Expected |
|---|---|---|
| 9.1 | ADMIN click event chip | URL update `/dashboard?peek=<tripId>`. Drawer mở overlay TRÊN `/dashboard` (không navigate `/trips`) |
| 9.2 | Esc / click outside | URL bỏ `?peek=`, drawer đóng. Calendar giữ nguyên anchor + view |
| 9.3 | Drawer click "Mở trang chi tiết đầy đủ" | Navigate `/trips/<id>` |
| 9.4 | Drawer click "Approve" (ADMIN, status PENDING_ASSIGNMENT) | Action chạy, drawer close, calendar refresh status |

---

## TC-D10: Form draft localStorage (NEW)

| Step | Action | Expected |
|---|---|---|
| 10.1 | Nhập pickup="ABC", dropoff="XYZ" rồi F5 reload | Form khôi phục giá trị (pickup="ABC", dropoff="XYZ") + toast "Đã khôi phục bản nháp" |
| 10.2 | DevTools → localStorage | Key `dashboard.quickBook.draft.<entId>` chứa JSON form data |
| 10.3 | Submit thành công | localStorage key xoá. Reload sau đó: form trống |
| 10.4 | Click "Reset" | Form clear + localStorage key xoá |
| 10.5 | 2 user khác `ent_id` cùng browser | Mỗi user có draft riêng (key prefix khác `entId`) — không leak |
| 10.6 | Draft chứa field DB schema không còn tồn tại (Zod parse fail) | Silent fallback: drop stale draft, form khởi tạo trống. KHÔNG crash |

---

## TC-D11: `/trips` revert (NEW)

| Step | Action | Expected |
|---|---|---|
| 11.1 | ADMIN navigate `/trips` | Render list view như trước REQ-1. KHÔNG có nút "Calendar" toggle |
| 11.2 | `/trips?view=calendar` (URL cũ) | Param `view` ignored, render list |
| 11.3 | `/trips?status=pending` (URL cũ) | Hoạt động như cũ |
| 11.4 | Bookmark cũ của user | Tất cả các URL `/trips?*` không calendar đều backward-compat |

---

## TC-D12: Mobile responsive (NEW)

| Step | Action | Expected |
|---|---|---|
| 12.1 | iPhone Safari emulation (< lg breakpoint) | Layout stack vertical: Calendar top, VehicleLegend giữa, QuickBookForm bottom |
| 12.2 | QuickBookForm mặc định trên mobile | Collapsed accordion. Tap header expand |
| 12.3 | Drag chip trên touch device | Disabled (REQ-1 đã handle). Click peek + click empty (prefill) vẫn work |
| 12.4 | Gantt view mobile | Horizontal scroll work |
| 12.5 | Sidebar thu gọn trên mobile (hamburger) | Entry "Dashboard" trong menu xổ |

---

## TC-D13: i18n cross-locale

| Step | Action | Expected |
|---|---|---|
| 13.1 | locale=vi | "Bảng điều khiển" / "Phương tiện" / "Tạo chuyến mới" / "Theo xe" |
| 13.2 | locale=en | "Dashboard" / "Vehicles" / "Create new trip" / "By Vehicle" |
| 13.3 | locale=ko | "대시보드" / "차량" / "새 운행 만들기" / "차량별" |
| 13.4 | Toast "Đã tạo chuyến TR-1234" | Per locale: rescheduled-style toast |
| 13.5 | F5 sau đổi locale | Giữ locale (cookie NEXT_LOCALE) |

---

## TC-D14: Build & lint

| Step | Action | Expected |
|---|---|---|
| 14.1 | `npm run typecheck` | Pass |
| 14.2 | `npm run lint` | Pass (warnings OK, errors không) |
| 14.3 | `npm run build` | Pass |
| 14.4 | Bundle: `/dashboard` route size | `< 100kb` route bundle (so với baseline 100kb shared) |

---

## TC-D15: Edge cases

| Step | Action | Expected |
|---|---|---|
| 15.1 | Tenant 0 trip | Calendar grid trống; right rail VehicleLegend + QuickBookForm vẫn render |
| 15.2 | Range > 500 trip | Toast "Khoảng thời gian quá lớn" + log `CAR-E0413` |
| 15.3 | localStorage disabled (Safari private mode) | Form vẫn hoạt động, không crash; draft skip silently |
| 15.4 | Concurrent edit: User A drag trip X, User B đang xem | A success → revalidatePath → B refresh sees mới giờ |
| 15.5 | Vehicle bị xoá soft sau khi seed legend | Vehicle không hiển thị legend; nhưng nếu có trip với vehicleId đó → trip vẫn render với màu fallback |

---

## TC-D16: Multi-tenancy guard

| Step | Action | Expected |
|---|---|---|
| 16.1 | User tenant A query `/dashboard` | Chỉ thấy trip + vehicle tenant A |
| 16.2 | localStorage draft của tenant A → switch user sang tenant B cùng browser | Draft tenant B blank (key prefix khác `entId`) |

---

## Definition of Done

- ✅ TC-D1..TC-D16 pass trên staging
- ✅ Build + lint + typecheck xanh
- ✅ Smoke test 3 role × 3 locale × Month/Week/Day/Gantt
- ✅ Test record vào `TR-20260522-schedule-dashboard.md`
