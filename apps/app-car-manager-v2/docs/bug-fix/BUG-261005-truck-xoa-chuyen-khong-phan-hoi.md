# BUG-261005 — Xoá chuyến đi không phản hồi + rà soát logic xoá

- **Ngày**: 2026-10-05
- **App**: app-car-manager-v2 — phân hệ TRUCK
- **Branch**: `fix/truck-delete-trip-no-response-261005` (từ `origin/staging`)

## 1. Triệu chứng
Bấm nút xoá chuyến (thùng rác ở danh sách `/truck/trips` hoặc nút "Xoá" ở chi tiết chuyến) không có gì xảy ra: không hộp xác nhận, không toast, chuyến vẫn còn. Mở app trực tiếp (ngoài AMA) thì chạy bình thường.

## 2. Nguyên nhân gốc — `window.confirm()` bị chặn trong iframe sandbox của AMA
- Cả 2 nút xoá chặn bằng `if (!confirm(...)) return;`.
- AMA nhúng app trong `<iframe sandbox="allow-scripts allow-same-origin allow-popups allow-forms allow-downloads">` (`ambManagement/apps/web/src/domain/custom-apps/pages/CustomAppHostPage.tsx:149`, tương tự `AppStorePage.tsx`, `EntityCustomAppsTabPage.tsx`) — **không có `allow-modals`**.
- Thiếu `allow-modals` → trình duyệt bỏ qua `confirm()/alert()/prompt()`: trả `false` ngay, không hiện gì → code `return` → "không phản hồi".

**Tái hiện có kiểm chứng** (dev server local, iframe cùng `sandbox` như AMA): `iframe.contentWindow.confirm('probe')` → `false` tức thì, không có hộp thoại.

Cùng lỗi ở mọi nút xoá phân hệ truck: danh sách chuyến / xe / tài xế / bảo trì (`ListRowActions`), chi tiết chuyến, form xe, form bảo trì.

## 3. Rà soát logic xoá — các lỗ hổng tìm thấy

| # | Vấn đề | Mức | Trạng thái |
|---|--------|-----|-----------|
| A | `confirm()` bị chặn trong iframe → mọi nút xoá truck không hoạt động | Cao | ✅ Fixed |
| B | **Badge "dữ liệu đã thay đổi, cần lập lại" không bao giờ bật theo thay đổi chuyến** (sửa hoặc xoá) ở chi tiết chuyến, Dashboard, P&L. `getTruckTripsMaxUpdatedAt` dùng `sql\`max(...)\`` thô → neon-http trả **chuỗi** `'2026-10-05 03:23:52+00'`; `chuỗi > Date` luôn `false`. (Lỗi có sẵn; hàm bảo trì tương tự đã bọc `new Date()`.) | Cao | ✅ Fixed |
| C | Xoá chuyến đã có trong báo cáo không làm báo cáo "cũ": query staleness lọc `trp_deleted_at IS NULL`, trang Tài chính chỉ so trên dòng còn sống | Trung bình | ✅ Fixed |
| D | Không kiểm tra quyền **khu vực** (REQ-20260813) trong `deleteTruckTripAction` — manager bị giới hạn HCM vẫn xoá được chuyến Đồng Nai nếu gọi action với id | Trung bình | ✅ Fixed (riêng xoá) |
| E | Lookup trong action không lọc `trp_kind='LOG'` / đã xoá; không thấy chuyến thì **bỏ qua luôn kiểm tra khoá tháng**, chỉ còn core làm chốt | Thấp | ✅ Fixed |
| F | Audit `TRUCK_TRIP.DELETE` không có mã chuyến lẫn dữ liệu trước khi xoá | Thấp | ✅ Fixed |
| G | Toast thành công ở danh sách chỉ hiện chữ "Xoá" (động từ) | Thấp | ✅ Fixed → "Đã xoá" |
| H | `updateTruckTripAction` / `completeTruckTripAction` / `assignTruckTripAction` cũng thiếu kiểm tra khu vực (như D) | Trung bình | ⚠️ Ngoài phạm vi — đề xuất task riêng |
| I | `trip-form-dialog.tsx` (huỷ thay đổi) và `sidebar-nav.tsx` (bỏ bản nháp) phía CAR cũng dùng `confirm()` → trong iframe không đóng được form đang sửa / không bỏ được nháp | Trung bình | ⚠️ Ngoài phạm vi — đề xuất task riêng |

Đã xác nhận **không** có vấn đề: dữ liệu con (chi phí phát sinh, điểm dừng, chứng từ) giữ nguyên theo soft delete và mọi query dùng chúng (hoá đơn `truck-invoice.queries`, pool nhiên liệu `truck-fuel-pool`, tài chính) đều lọc chuyến đã xoá; tháng đã chốt vẫn chặn xoá (`assertTruckMonthOpen`); DRIVER không có quyền xoá (`requireRole ADMIN/MANAGER`); bấm hai lần → lần hai trả 404 (`CAR-E1004`) có toast lỗi.

## 4. Sửa

### UI (A, G)
- Hook mới `src/components/dialogs/use-confirm.tsx`: `const { confirm, dialog } = useConfirm(); if (!(await confirm(msg))) return;` — Promise-based, render `ConfirmDeleteDialog` sẵn có của app (Radix Dialog, chạy được trong iframe sandbox).
- Thay `confirm()` ở: `list-row-actions.tsx` (chuyến/xe/tài xế/bảo trì), `truck-trip-manage-actions.tsx`, `truck-vehicle-form.tsx`, `truck-maintenance-form.tsx`.
- i18n mới (vi/en/ko): `actions.confirmDeleteTitle` ("Xác nhận xoá"), `actions.deleted` ("Đã xoá").

### Server (B–F)
- `getTruckTripsMaxUpdatedAt`: `return row?.u ? new Date(row.u) : null;` và **tính cả chuyến đã xoá** (`deleteTruckTrip` đóng dấu `trp_updated_at` = lúc xoá → xoá sau báo cáo ⇒ cũ; xoá trước báo cáo ⇒ không báo nhầm).
- Trang Tài chính: thêm điều kiện staleness từ `getTruckTripsMaxUpdatedAt`.
- `deleteTruckTripAction`: tìm chuyến LOG còn sống (404 nếu không), `requireRegion` theo khu vực xe, khoá tháng luôn được kiểm tra, audit có `entityRef` + `before` (status, ngày, xe, tài xế, khách, doanh thu, khu vực), revalidate thêm `/today`.

## 5. File thay đổi
| Khu vực | File | Loại |
|---|---|---|
| web | `src/components/dialogs/use-confirm.tsx` | mới |
| web | `src/components/list-row-actions.tsx` | sửa |
| web | `src/app/(app)/truck/trips/_components/truck-trip-manage-actions.tsx` | sửa |
| web | `src/app/(app)/truck/fleet/_components/truck-vehicle-form.tsx` | sửa |
| web | `src/app/(app)/truck/maintenance/_components/truck-maintenance-form.tsx` | sửa |
| web | `src/server/actions/trips/truck-trip.actions.ts` | sửa |
| web | `src/server/queries/truck-finance.queries.ts` | sửa |
| web | `src/app/(app)/truck/finance/page.tsx` | sửa |
| i18n | `messages/{vi,en,ko}.json` | sửa (+2 key) |

Không có migration DB.

## 6. Kiểm chứng (dev server local, DB dev ep-steep-tooth)
- `tsc --noEmit` pass; lint không có warning mới.
- Iframe với đúng `sandbox` của AMA:
  - `confirm('probe')` → `false` (chứng minh nguyên nhân).
  - Chi tiết chuyến tạm `TR-DEL-TEST` → bấm "Xoá" → dialog "Xác nhận xoá / Xoá chuyến này?" hiện → xác nhận → toast "Đã xoá chuyến", về `/truck/trips`, chuyến biến mất. DB: `trp_deleted_at` có giá trị; audit `TRUCK_TRIP.DELETE` có `aud_entity_ref='TR-DEL-TEST'` và `aud_before` đầy đủ.
  - Danh sách → thùng rác dòng `TR-DEL-TEST2` → dialog hiện, **không** mở nhầm trang chi tiết → toast "Đã xoá", dòng biến mất.
- Staleness (soft-delete TR-3004 — chuyến hoàn thành đã nằm trong báo cáo tháng 9 — rồi khôi phục nguyên trạng):
  - Trước: badge "Đã lập BC · 15:50 17/09/2026".
  - Sau xoá: Tài chính, P&L, chi tiết TR-3003 đều "… — dữ liệu đã thay đổi, cần lập lại".
  - Sau khôi phục: về lại "Đã lập BC · 15:50 17/09/2026".
- Probe drizzle + neon-http: `max(trp_updated_at)` → `typeof 'string'`; `u > report` = `false`, `new Date(u) > report` = `true`.

Hai chuyến tạm `TR-DEL-TEST`, `TR-DEL-TEST2` để lại trên DB dev ở trạng thái đã xoá mềm (quy tắc dự án cấm xoá cứng chuyến).

## 7. Phòng tái phát
1. **Không dùng `window.confirm/alert/prompt`** trong app nhúng iframe — dùng `useConfirm()` / Dialog.
2. Aggregate viết bằng `sql\`…\`` thô **không** qua mapper của Drizzle → timestamp là chuỗi; luôn `new Date()` (hoặc `.mapWith`) trước khi so sánh.
3. Mọi Server Action truck nhận id bản ghi phải kiểm tra khu vực (`requireRegion`), không chỉ dựa vào việc UI không hiển thị.
4. "Đã thay đổi kể từ báo cáo" phải tính cả bản ghi bị xoá mềm.

---

## 8. Bổ sung — Cảnh báo tác động chéo khi xoá + fix cập nhật điểm dừng (branch `fix/truck-delete-trip-impact-warnings-261005`)

Rà soát phạm vi xoá (sau khi fix trên vào staging #190) tìm ra 2 tác động chéo mà người xoá không được báo trước, và 1 lỗ hổng nhỏ:

| # | Vấn đề | Xử lý |
|---|--------|-------|
| 1 | Nhiên liệu phân bổ = tiền nhiên liệu tháng của xe ÷ km tháng → xoá 1 chuyến hoàn thành thay đổi nhiên liệu phân bổ (và lợi nhuận) của **các chuyến khác cùng xe cùng tháng**. Ví dụ staging 50E-22222 tháng 9: xoá TR-3032 → TR-3030 113.636 → 166.667 đ, TR-3031 227.273 → 333.333 đ. | ✅ Cảnh báo trong hộp xác nhận, liệt kê từng chuyến bị tính lại (trước → sau) |
| 2 | Xoá chuyến hoàn thành **cuối cùng** của xe trong tháng → tháng không còn "hoạt động" → lương tài xế + khấu hao tháng đó rời khỏi lãi/lỗ của xe (quy tắc QA 2026-07-30) | ✅ Cảnh báo kèm số tiền lương + khấu hao |
| 6 | `updateStopoverAction` không lọc chuyến đã xoá → trang cũ còn mở vẫn ghi điểm dừng lên chuyến đã xoá | ✅ Lọc `trp_deleted_at IS NULL` → 404 |

### Cách tính (không nhân bản công thức)
- `loadVehicleFuelPool` / `loadTruckRegionSnapshots` nhận thêm tuỳ chọn `excludeTripIds` (chỉ tác động lên pool sống; snapshot báo cáo đã đóng băng giữ nguyên).
- Service mới `packages/core/src/truck/truck-trip-delete-impact.ts` → `getTruckTripDeleteImpact(entId, tripId)`: gọi **đúng** `fuelForTrip` mà danh sách/tài chính/P&L dùng, một lần như hiện tại và một lần loại chuyến cần xoá → chỉ liệt kê chuyến có số thay đổi (chuyến đã nằm trong báo cáo, giá trị đóng băng, tự động không bị báo nhầm). Chuyến cuối tháng: `loadTruckFixedMonthly` với tháng đang hoạt động (cùng quy tắc tài xế thay thế của `computeTruckPnl`). Chuyến chưa hoàn thành → không tác động (không vào pool/P&L).
- Action `getTruckTripDeleteImpactAction` — cùng chốt quyền với xoá (ADMIN/MANAGER, fleet TRUCK, khu vực).
- UI: `useConfirm` nhận `fetchWarnings` / `warningLabels` / `renderRefDetail` (truyền xuống `ConfirmDeleteDialog`); hook `useTruckTripDeleteWarnings()` dùng cho nút xoá ở chi tiết chuyến và ở danh sách. Lỗi khi tải cảnh báo → hiện "Không kiểm tra được ảnh hưởng — vẫn có thể xoá", không chặn xoá, không báo "không ảnh hưởng".
- i18n vi/en/ko: `screens.truckTripDetail.deleteImpact.*`.

### Kiểm chứng (dev, dữ liệu dựng lại đúng ví dụ staging, iframe sandbox như AMA)
| Kịch bản | Cảnh báo hiển thị | Thực tế sau khi xoá |
|---|---|---|
| Xe 29C-99999 tháng 10: A1 10 km + 500.000 đ, A2 20 km, A3 80 km + 750.000 đ → xoá A3 | "Nhiên liệu phân bổ của 2 chuyến khác … tháng 10/2026 sẽ được tính lại: TR-IMP-A1 113.636 → 166.667 ₫; TR-IMP-A2 227.273 → 333.333 ₫" | Chi tiết A1 = 166.667 ₫, A2 = 333.333 ₫ ✓ |
| Xe 43C-201.55 tháng 10 chỉ có B1, chi phí cố định 9.000.000 + 3.000.000 → xoá B1 (từ danh sách) | "Đây là chuyến hoàn thành cuối cùng … Lương tài xế 9.000.000 ₫ và khấu hao 3.000.000 ₫ … sẽ không còn được tính vào lãi/lỗ của xe" | P&L xe tháng 10: lương 9.000.000 → 0 ₫, khấu hao 3.000.000 → 0 ₫ ✓; toast "Đã xoá" |
| Bấm "Huỷ" | Dialog đóng | Chuyến còn nguyên ✓ |

`tsc` web + core pass; lint sạch. Dữ liệu test (TR-IMP-*) đã xoá mềm, dòng chi phí cố định tạm đã gỡ. Không có migration.

### Chưa xử lý (đã ghi nhận ở rà soát)
- Không có giao diện khôi phục chuyến đã xoá; chứng từ chuyến biến mất khỏi trang Hoá đơn.
- Thông báo "được giao chuyến" của tài xế trỏ về chuyến đã xoá → 404; tài xế không được báo khi chuyến bị xoá.
- Odometer xe không hạ lại khi xoá chuyến có km cao nhất (chỉ ảnh hưởng hiển thị trang Đội xe).
- Region ACL cho sửa/gán/hoàn thành chuyến (task riêng).
