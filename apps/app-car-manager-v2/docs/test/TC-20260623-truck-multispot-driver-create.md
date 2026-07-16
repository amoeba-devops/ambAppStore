# TC-20260623 — Truck Trip: Multi-stop Route + Driver Self-Create

## TC-01: Manager tạo chuyến với đầy đủ stops

**Precondition**: Tenant settings có `depot_address = "Bãi CargoRush, Q.12, TP.HCM"`. Manager có TRUCK access.

| # | Bước | Kết quả kỳ vọng |
|---|------|----------------|
| 1 | Manager vào `/truck/trips/new` | Form mở với ORIGIN pre-fill = "Bãi CargoRush, Q.12, TP.HCM" và RETURN pre-fill = tương tự |
| 2 | Chỉnh sửa ORIGIN address | Address update; type vẫn = ORIGIN |
| 3 | Điền PICKUP stop: "Kho Bình Dương" | Stop type = PICKUP, required |
| 4 | Nhấn "+ Thêm điểm ghé" (sau PICKUP) | Thêm 1 WAYPOINT stop với address rỗng |
| 5 | Điền WAYPOINT: "Xưởng Nam Sài Gòn" | Waypoint address filled |
| 6 | Điền DELIVERY stop: "Cảng Cát Lái" | Stop type = DELIVERY, required |
| 7 | Nhấn "+ Thêm điểm ghé" (sau DELIVERY) | Thêm WAYPOINT sau delivery |
| 8 | Xóa waypoint vừa thêm | Waypoint biến mất; RETURN vẫn đứng cuối |
| 9 | Điền revenue, xe, tài xế | Fields populated |
| 10 | Nhấn Save | Trip tạo thành công. DB: `car_trip_stopovers` có 4 rows (ORIGIN, PICKUP, WAYPOINT, DELIVERY, RETURN=5 nếu return set); route summary hiển thị đúng |

---

## TC-02: Driver tự tạo chuyến (self-assign)

**Precondition**: User `drv-truck` (DRIVER, TRUCK access) đăng nhập.

| # | Bước | Kết quả kỳ vọng |
|---|------|----------------|
| 1 | Driver vào `/today` | Thấy nút "Tạo chuyến mới" |
| 2 | Nhấn nút → `/truck/trips/new` | Form mở, field "Tài xế" = tên driver (locked, không chọn được người khác) |
| 3 | Revenue field | Không hiển thị (hidden) |
| 4 | Điền xe, lộ trình (stops), xăng, phí | OK |
| 5 | Nhấn Save | Trip tạo thành công. `trp_driver_id = actor.drvId`. `trp_revenue = null`. Trip status = CONFIRMED (có xe + driver). Trip xuất hiện trong `/today` "Cần hoàn thành" |

---

## TC-03: Driver cố gán tài xế khác (security)

**Precondition**: Driver `drv-truck` đang test.

| # | Bước | Kết quả kỳ vọng |
|---|------|----------------|
| 1 | Driver gửi API call `createTruckTripAction` với `driver_id = drvId_khác` | Server trả lỗi `CAR-E0403 Forbidden` (driver không thể assign cho người khác) |
| 2 | Trip không được tạo | DB không có row mới |

---

## TC-04: Driver cập nhật km real-time tại điểm dừng

**Precondition**: Trip `T-001` thuộc `drv-truck`, status = CONFIRMED, có 4 stops.

| # | Bước | Kết quả kỳ vọng |
|---|------|----------------|
| 1 | Driver vào `/today/truck/T-001` | Danh sách 4 stops hiển thị theo thứ tự; km = null cho mỗi stop |
| 2 | Tap stop #2 (PICKUP) → điền km = 12500 | Field populated |
| 3 | Submit "Cập nhật" | `tst_km = 12500`, `tst_arrived_at ≈ now()` lưu vào DB |
| 4 | Tải lại trang | Stop #2 hiển thị km = 12,500 km + giờ đến |
| 5 | Tap stop #4 (DELIVERY) → km = 12850 | Submit OK; `tst_km = 12850` |

---

## TC-05: Driver cố update stop của trip người khác (security)

| # | Bước | Kết quả kỳ vọng |
|---|------|----------------|
| 1 | `drv-truck` gửi `updateStopoverAction` với `trip_id` của `drv-car` | Lỗi `CAR-E0403 Not your trip` |

---

## TC-06: Month-close block driver create

**Precondition**: Tháng 5/2026 đã closed (có `car_truck_month_close` row). Driver cố tạo trip ngày 15/05/2026.

| # | Bước | Kết quả kỳ vọng |
|---|------|----------------|
| 1 | Driver submit create trip với `scheduled_at = 2026-05-15` | Lỗi "Tháng đã đóng sổ" (CAR-E1010 hoặc tương đương) |
| 2 | Cố tạo trip ngày hôm nay (tháng đang mở) | Tạo thành công |

---

## TC-07: Backward compat — trip cũ không có stopovers

**Precondition**: Trip `OLD-001` được tạo trước migration (không có stopover rows).

| # | Bước | Kết quả kỳ vọng |
|---|------|----------------|
| 1 | Manager xem `/truck/trips/OLD-001` | Detail page render bình thường; section route hiển thị "Pickup → Dropoff" (fallback) thay vì stopover timeline |
| 2 | Không có error | Không có 404 hay runtime error |

---

## TC-08: Depot address settings

**Precondition**: Admin vào settings.

| # | Bước | Kết quả kỳ vọng |
|---|------|----------------|
| 1 | Vào Cài đặt → Xe tải → Địa chỉ bãi | Field rỗng (chưa set) |
| 2 | Điền "Bãi CargoRush, Q.12" → Save | Lưu vào `tns_depot_address` |
| 3 | Manager vào `/truck/trips/new` | ORIGIN = "Bãi CargoRush, Q.12", RETURN = tương tự |
| 4 | Xóa nội dung ORIGIN → Save trip | ORIGIN address = "" hoặc null; trip vẫn tạo được (optional) |

---

## TC-09: Manager review trip do driver tạo + fill revenue

**Precondition**: Driver đã tạo trip `DRV-001`, `trp_revenue = null`.

| # | Bước | Kết quả kỳ vọng |
|---|------|----------------|
| 1 | Manager vào `/truck/trips` | `DRV-001` hiển thị trong danh sách (creator = driver) |
| 2 | Click vào trip | Detail hiển thị lộ trình + km đã update + revenue = —— |
| 3 | Manager click Edit → thêm revenue = 5,000,000 | Save OK. `trp_revenue = 5000000` |
| 4 | P&L tháng | Trip `DRV-001` đóng góp vào doanh thu tháng |

---

## TC-10: Form validation — thiếu stop required

| # | Bước | Kết quả kỳ vọng |
|---|------|----------------|
| 1 | Manager để PICKUP address rỗng → Save | Form không submit; highlight PICKUP field với error |
| 2 | Manager để DELIVERY address rỗng → Save | Form không submit; highlight DELIVERY field |
| 3 | Waypoint address rỗng → Save | Form không submit; highlight waypoint field |

---

## TC-11: Số lượng stops tối đa

| # | Bước | Kết quả kỳ vọng |
|---|------|----------------|
| 1 | Manager thêm waypoints liên tục (> 18 stops) | Nút "+ Thêm điểm ghé" disabled sau khi tổng stops ≥ 20 |

---

## TC-12: Edit trip — stops hiển thị đúng

**Precondition**: Trip `T-002` có 5 stops (ORIGIN, PICKUP, WAYPOINT, DELIVERY, RETURN).

| # | Bước | Kết quả kỳ vọng |
|---|------|----------------|
| 1 | Manager vào edit trip `T-002` | Form hiển thị đúng 5 stops theo thứ tự với addresses đã lưu |
| 2 | Thay đổi PICKUP address → Save | Chỉ PICKUP address thay đổi; WAYPOINT + DELIVERY + RETURN giữ nguyên |
| 3 | Thêm 1 waypoint mới → Save | Trip có 6 stops sau khi save |

---

## TC-13: `mgr-both` persona — create truck trip, switch về car

| # | Bước | Kết quả kỳ vọng |
|---|------|----------------|
| 1 | `mgr-both` (CAR + TRUCK) tạo truck trip với stops | OK |
| 2 | Switch workspace về CAR | Sidebar đổi sang CAR (xanh); truck trips không hiện |
| 3 | Switch lại TRUCK | Trip vừa tạo hiện trong `/truck/trips` |

---

## Checklist sau implement

- [ ] DB migration 0014 apply thành công trên staging Neon
- [ ] `car_trip_stopovers` có 4 columns mới
- [ ] `car_tenant_settings` có `tns_depot_address`
- [ ] Manager tạo trip multi-stop → stopovers lưu đúng thứ tự và type
- [ ] Driver tạo trip → `trp_driver_id = self`, `trp_revenue = null`
- [ ] Driver không gán được trip cho người khác
- [ ] Driver update km tại stop → `tst_km` lưu đúng
- [ ] Driver không update stop của trip người khác
- [ ] Month-close block driver create trip tháng đóng
- [ ] Trip cũ (0 stopovers) detail page không crash
- [ ] Depot address lưu và pre-fill form đúng
- [ ] i18n 3 ngôn ngữ có đủ keys mới
- [ ] Truck detail page hiển thị stopover timeline khi có stops
