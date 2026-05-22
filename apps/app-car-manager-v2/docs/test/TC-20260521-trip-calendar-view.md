# TC-20260521 — Trip Calendar View Test Cases

Based on [PLAN-20260521-trip-calendar-view.md](../plan/PLAN-20260521-trip-calendar-view.md). Manual test cases (no Vitest suite yet per CLAUDE.md §6 P6).

**Pre-conditions**:
- Staging: `stg-apps.amoeba.site/app-car-manager-v2` deployed sau merge `staging-car`.
- Seed data: ít nhất 5 trip ở các status khác nhau, ≥2 trip có cùng ngày, ≥1 trip overlap giờ trong cùng 1 ngày, ≥2 trip cho cùng 1 vehicle.
- 3 user test: 1 ADMIN, 1 MANAGER, 1 DRIVER.
- 2 vehicle active.

---

## TC-1: Toggle List/Calendar (Admin)

| Step | Action | Expected |
|---|---|---|
| 1.1 | Login ADMIN, vào `/trips` | Default render List view. Toggle button `List | Calendar` hiển thị bên phải filter chips |
| 1.2 | Click "Calendar" | URL → `/trips?view=calendar`. Filter chips (pending/all/active/completed) ẩn đi. Calendar Month view render |
| 1.3 | F5 reload | Vẫn ở Calendar view |
| 1.4 | Click "List" | URL → `/trips`. List view như cũ. Filter chips hiện lại |
| 1.5 | DevTools → Application → Local Storage | Key `trips.viewMode` = `'calendar'` hoặc `'list'` tương ứng |

---

## TC-2: Sub-view switching (Month/Week/Day/Gantt)

| Step | Action | Expected |
|---|---|---|
| 2.1 | Ở Calendar Month, click "Tuần" | View → Week, 7 cột × giờ 06-22 |
| 2.2 | Click "Ngày" | View → Day, 1 cột × giờ 06-22 |
| 2.3 | Click "Theo xe" | View → Gantt, mỗi vehicle 1 dòng + dòng "Chưa phân xe" cuối |
| 2.4 | F5 reload | Vẫn ở sub-view đang chọn (localStorage `trips.calendar.subView`) |
| 2.5 | Click "Hôm nay" sau khi đã nav prev/next | Anchor về `new Date()`, render tháng/tuần/ngày hiện tại |
| 2.6 | Click `‹` `›` | Anchor lùi/tới 1 tháng (Month), 1 tuần (Week/Gantt), 1 ngày (Day) |

---

## TC-3: Visibility theo role

| Step | Action | Expected |
|---|---|---|
| 3.1 | ADMIN: Calendar render | Thấy mọi trip non-deleted của tenant (kể cả của Manager/Driver khác) |
| 3.2 | MANAGER: Calendar render | Chỉ thấy trip MANAGER là creator HOẶC passenger |
| 3.3 | DRIVER: vào `/trips` | KHÔNG thấy toggle Calendar. Render DriverTripsList 2-tab như cũ |
| 3.4 | DRIVER: gõ tay URL `/trips?view=calendar` | Page vẫn render DriverTripsList (server ignore `?view` cho driver) |

---

## TC-4: Event rendering Month view

| Step | Action | Expected |
|---|---|---|
| 4.1 | Trip status PENDING_ASSIGNMENT trong tháng hiện tại | Chip hiển thị nền accent (cam nhạt), border accent-600 |
| 4.2 | Trip CONFIRMED | Chip nền success (xanh lá), border success-600 |
| 4.3 | Trip COMPLETED | Chip nền neutral (xám), không draggable |
| 4.4 | 4+ trip cùng 1 ngày | Hiện 3 chip + "+1 khác" link ở dưới |
| 4.5 | Click "+1 khác" | Anchor = ngày đó, view switch sang Day → thấy đủ trip |
| 4.6 | Trip có `duration=null` | Render với end = scheduledAt + 60min (fallback) |
| 4.7 | Ngày hôm nay | Số ngày tô tròn cam |
| 4.8 | Ngày Chủ Nhật (cột cuối Mon-Sun) | Header CN màu đỏ; Thứ 7 màu xanh |

---

## TC-5: Event rendering Week/Day view

| Step | Action | Expected |
|---|---|---|
| 5.1 | 2 trip overlap giờ trong 1 ngày | Chia 2 lane, mỗi chip width 50% |
| 5.2 | Trip duration 30 phút | Chip height tương ứng (~22px @ HOUR_HEIGHT=44) |
| 5.3 | Trip start 14:23, duration 67min | Chip top tương ứng 14:23, không bị snap |
| 5.4 | Now indicator vạch cam ngang | Hiện ở cột ngày hôm nay, không hiện ở ngày khác |
| 5.5 | Time range trip ngoài 06-22 (vd 04:00) | Chip clip về top=0 (visible top of viewport) |

---

## TC-6: Gantt view

| Step | Action | Expected |
|---|---|---|
| 6.1 | View Gantt anchor = hôm nay | Mỗi vehicle 1 row, trục X = 24h, trip nằm trong row của vehicle được assign |
| 6.2 | Trip chưa có `trpVehicleId` | Nằm trong row "Chưa phân xe" cuối |
| 6.3 | Vehicle không có trip nào | Row vẫn render trống |
| 6.4 | Tenant có 0 vehicle | Chỉ row "Chưa phân xe" (nếu có trip unassigned) hoặc empty grid |
| 6.5 | Now indicator vạch cam dọc | Hiện ở mọi row khi anchor = hôm nay |

---

## TC-7: Click interactions

| Step | Action | Expected |
|---|---|---|
| 7.1 | Click event chip | URL thêm `?peek=<trpId>`. Peek drawer mở (component có sẵn) |
| 7.2 | Esc / click outside drawer | URL bỏ `?peek=`, drawer đóng. Calendar giữ nguyên |
| 7.3 | Click ô trống Month view | URL → `/trips/new?scheduledAt=<ISO ngày đó>` (form preset date 00:00) |
| 7.4 | Click ô trống Week view giờ 14:23 | URL → `/trips/new?scheduledAt=<ISO 14:15>` (snap 15 phút) |
| 7.5 | Click ô trống Gantt row vehicle X | URL → `/trips/new?scheduledAt=...&vehicleId=<X>` (preset xe) |
| 7.6 | Tạo trip xong → quay về list | Redirect về `/trips?view=calendar` (giữ context), không phải `/trips` |

---

## TC-8: Drag-to-reschedule (Admin)

| Step | Action | Expected |
|---|---|---|
| 8.1 | Hover lên trip PENDING_ASSIGNMENT | Cursor → grab |
| 8.2 | Drag sang ngày khác (Month view) | Network: `POST` Server Action `updateTripAction` với `scheduled_at` mới (giữ HH:mm cũ, chỉ đổi date). Toast "Đã đổi giờ chuyến TR-XXXX" |
| 8.3 | DB check | `car_trips.trp_scheduled_at` updated; `car_audit_logs` có row mới `action='TRIP.UPDATE'`, `after.fields=['trpScheduledAt']` |
| 8.4 | Drag trong Week view 14:23 → 15:42 | Snap 15min → 15:45. Action gọi với `scheduled_at` = ngày đó T15:45 |
| 8.5 | Drag trip COMPLETED | Cursor → not-allowed. Không trigger drag. Không network call |
| 8.6 | Drag trip về cùng vị trí cũ | Client skip action (newTime === oldTime). Không network call, không toast |
| 8.7 | Drag trip CANCELLED | Cursor → not-allowed (Admin chỉ edit ≠ COMPLETED, nhưng CANCELLED edit có ý nghĩa gì? — check `updateTripAction:222`: Admin **được phép** edit CANCELLED. Test: cursor → grab, drag được) |

---

## TC-9: Drag-to-reschedule (Manager)

| Step | Action | Expected |
|---|---|---|
| 9.1 | MANAGER login, vào Calendar | Chỉ thấy own trips |
| 9.2 | Drag own trip status PENDING_ASSIGNMENT | Success như Admin |
| 9.3 | Drag own trip status PENDING_DRIVER_CONFIRMATION | Success |
| 9.4 | Drag own trip status CONFIRMED | Cursor → not-allowed. Network không call |
| 9.5 | Drag own trip IN_PROGRESS | Cursor → not-allowed |
| 9.6 | Edge case: bypass UI bằng cách edit DOM `draggable=true` | Server vẫn reject với `CAR-E1006`, toast `Không thể đổi giờ chuyến này` |

---

## TC-10: Edge cases

| Step | Action | Expected |
|---|---|---|
| 10.1 | Tenant 0 trip | Calendar grid trống, không EmptyState card |
| 10.2 | Range fetch trả 500 trip | Server throw `CAR-E0413`. UI hiện toast `Khoảng thời gian quá lớn, vui lòng thu nhỏ` |
| 10.3 | Đổi anchor sang tháng quá khứ xa (vd 2020-01) | Query vẫn chạy, render đúng (nếu có trip cũ) hoặc grid trống. Không crash |
| 10.4 | Đổi ngôn ngữ giữa chừng (vi → en) | Header "Tháng 5 2026" → "May 2026"; weekday "T2..CN" → "Mon..Sun"; toolbar button label đổi |
| 10.5 | Trip xoá soft trong DB (`trpDeletedAt` set) | KHÔNG hiện trên calendar (query filter `IS NULL`) |

---

## TC-11: Mobile / touch device

| Step | Action | Expected |
|---|---|---|
| 11.1 | iPhone Safari / Chrome DevTools mobile emulation | Calendar render. Toggle visible. Click peek work. Click ô trống work |
| 11.2 | Long-press trip chip | KHÔNG kích hoạt drag (disabled). Native context menu mặc định |
| 11.3 | Gantt view trên mobile | Horizontal scroll work. Vehicle label column sticky-left không bắt buộc MVP |

---

## TC-12: i18n cross-locale

| Step | Action | Expected |
|---|---|---|
| 12.1 | locale=vi | "Lịch · Hôm nay · Tháng · Tuần · Ngày · Theo xe · Chưa phân xe" |
| 12.2 | locale=en | "Calendar · Today · Month · Week · Day · By Vehicle · Unassigned" |
| 12.3 | locale=ko | "캘린더 · 오늘 · 월 · 주 · 일 · 차량별 · 미배정" |
| 12.4 | F5 sau khi đổi locale | Giữ locale (cookie `NEXT_LOCALE`) |
| 12.5 | Toast `rescheduled` | "Đã đổi giờ chuyến TR-1234" / "Rescheduled TR-1234" / "TR-1234 일정 변경됨" |

---

## TC-13: Build & lint

| Step | Action | Expected |
|---|---|---|
| 13.1 | `npm run build` trong `apps/app-car-manager-v2/apps/web` | TypeScript pass, Next build pass |
| 13.2 | `npm run lint` | No ESLint errors |
| 13.3 | Bundle analyzer (nếu setup) | Calendar bundle lazy chunk ~50kb gz, không vào initial bundle |

---

## TC-14: Audit log invariants

| Step | Action | Expected |
|---|---|---|
| 14.1 | Mỗi successful drag = 1 row audit | DB `car_audit_logs` count tăng đúng 1 |
| 14.2 | Drag no-change (skip client) | DB audit count KHÔNG tăng |
| 14.3 | Drag fail server-side | DB audit count KHÔNG tăng (action throw trước khi insert) |
| 14.4 | Audit row `audAfter.fields` | Chứa `['trpScheduledAt']` (đúng 1 field) |

---

## TC-15: Multi-tenancy guard

| Step | Action | Expected |
|---|---|---|
| 15.1 | User tenant A query calendar | Chỉ thấy trip `ent_id = A`, không thấy trip tenant B |
| 15.2 | URL hack: thử inject `entId` qua header / body | Server ignore — entId từ JWT, không từ request |

---

## Definition of Done

- ✅ All 15 TC pass trên staging.
- ✅ Build + lint xanh.
- ✅ Smoke test ADMIN + MANAGER + DRIVER roles.
- ✅ 3 ngôn ngữ test ít nhất 1 view.
- ✅ Test record vào `TR-20260521-trip-calendar-view.md`.
