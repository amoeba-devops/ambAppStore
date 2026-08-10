# BUG-260810 — App Truck, view Tài xế: mất chức năng "Hoàn thành chuyến đi"

| | |
|---|---|
| **Ngày** | 2026-08-10 |
| **Phạm vi** | `/today/truck/[id]` (màn chi tiết chuyến của tài xế xe tải) |
| **Mức độ** | **Cao** — tài xế không có cách nào chốt chuyến của mình; chuyến kẹt ở `CONFIRMED` vĩnh viễn, kéo theo doanh thu/chi phí không vào được báo cáo tháng |
| **Branch** | `staging-car-truck` |
| **Trạng thái** | ✅ Đã sửa — verify E2E trên local (Playwright, 1/1 pass) |

> **Báo cáo của người dùng (2026-08-10)**: *"app Truck hiện tại view Tài xế - bị mất function Hoàn thành chuyến đi"*

---

## 1. Hiện tượng

Đăng nhập bằng tài khoản **tài xế xe tải** → `Hôm nay` hoặc `Chuyến của tôi` → mục **"Cần hoàn thành"** → chạm vào một chuyến.
Màn chi tiết chỉ có **"Sửa chuyến"** và **"Cập nhật chi phí"** — **không có nút "Hoàn thành chuyến đi"**.

Tài xế nhập đủ số liệu qua "Cập nhật chi phí" rồi lưu, chuyến vẫn hiển thị badge **"Cần hoàn thành"** và vẫn nằm trong danh sách chờ.

---

## 2. Nguyên nhân gốc

**Chức năng chưa từng bị xoá — backend còn nguyên. Cái mất là đường đi tới nó.**

Nút nằm trong component `TruckCompleteSection`, và component này **chỉ được render ở duy nhất một nơi**: màn chi tiết chuyến dùng chung `/trips/[id]`
([truck-trip-detail.tsx:253](../../apps/web/src/app/(app)/trips/[id]/_components/truck-trip-detail.tsx)).

Điều kiện hiển thị ở `/trips/[id]/page.tsx` vẫn cho phép tài xế:

```ts
const canComplete = !completed
  && (isStaffUser || isAssignedDriver)
  && (trip.trpStatus === 'CONFIRMED' || trip.trpStatus === 'IN_PROGRESS');
```

Vấn đề nằm ở **điều hướng**:

| Màn hình | Link thẻ chuyến trỏ tới | Có nút Hoàn thành? |
|---|---|---|
| `/today` (tài xế xe tải) → `TruckDriverToday` | `/today/truck/{id}` | ❌ trang này không import `TruckCompleteSection` |
| `/trips` (tài xế xe tải) → **cùng** `TruckDriverToday` | `/today/truck/{id}` | ❌ |
| `/trips/{id}` | — | ✅ nhưng **không có link nào trong app dẫn tới** |
| `/truck/trips/{id}` (quản lý) | — | ✅ nhưng `/truck/*` layout redirect `DRIVER` → `/today` |

Tài xế chỉ tới được `/trips/{id}` bằng deep-link từ thông báo. Trong app, nút là **bất khả đạt**.

### Commit gây ra

Truy vết `href` của thẻ chuyến trong `truck-driver-today.tsx`:

| Commit | Ngày | href |
|---|---|---|
| `7315f1e` | 2026-06-18 | `/trips/{id}` — ✅ còn nút |
| `664c4bd` | 2026-06-18 | `/trips/{id}` — ✅ còn nút |
| **`73d16ab`** | **2026-06-23** | `/today/truck/{id}` — ❌ **mất nút** |
| `73218fb` → HEAD | — | `/today/truck/{id}` |

→ **`73d16ab`** ("feat: truck multi-stop route + driver self-create, REQ-20260623") chuyển hướng thẻ chuyến sang trang cập nhật điểm dừng mới, nhưng trang mới không mang theo phần hoàn thành chuyến.

**`6a7f99b` không phải thủ phạm.** Commit đó chỉ thêm slot hành động (Sửa chuyến / Cập nhật chi phí) vào trang này — làm sự thiếu vắng lộ rõ hơn, không tạo ra nó.

### Vì sao "Cập nhật chi phí" không cứu được

`updateTruckTrip` **cố ý giữ nguyên `trpStatus`** ([truck-trip.service.ts:308-310](../../packages/core/src/truck/truck-trip.service.ts)) — đúng thiết kế (đây là đường sửa, không phải đường chốt). Nên không có đường nào khác đưa chuyến sang `COMPLETED`.

---

## 3. Sai lệch dữ liệu phát hiện thêm khi sửa

Đưa nút Hoàn thành về cạnh đường "Cập nhật chi phí" làm lộ một đường **mất dữ liệu có thật**:

`completeTruckTrip` **xoá rồi ghi lại toàn bộ** danh sách chi phí phát sinh ([truck-trip.service.ts:243-258](../../packages/core/src/truck/truck-trip.service.ts)):

```ts
await db.delete(carTripExtraCosts).where(...);
if (input.extraCosts.length > 0) { await db.insert(...) }
```

Trước đây form hoàn thành luôn mở ra **rỗng**. Từ khi tài xế tự sửa được chi phí (`6a7f99b`) và tự tạo chuyến kèm chi phí, kịch bản sau làm mất sạch dữ liệu:

> Tài xế nhập "Bốc xếp 300.000 đ" + "Phí lưu ca 180.000 đ" qua *Cập nhật chi phí* → bấm *Hoàn thành chuyến đi* → form rỗng → *Xác nhận* → **hai khoản phí biến mất**.

(Các cột vô hướng — nhiên liệu, cầu đường, km — **không** bị: core có fallback `input.x ?? trip.x`. Chỉ danh sách chi phí phát sinh bị xoá trắng.)

Đã xử lý cùng lượt: form hoàn thành nay **nạp sẵn** số liệu đang có trên chuyến, nên "thấy gì lưu nấy". Áp dụng cho cả 3 màn (tài xế, `/trips/[id]`, `/truck/trips/[id]`).

---

## 4. Nội dung sửa

### 4.1 Trả nút về màn của tài xế (sửa chính)

`app/(app)/today/truck/[id]/page.tsx` — render `TruckCompleteSection` (mode `driver`) khi chuyến còn mở:

```ts
const canComplete = !completed
  && (trip.trpStatus === 'CONFIRMED' || trip.trpStatus === 'IN_PROGRESS');
```

Quyền sở hữu đã được chốt sẵn ở đầu trang (`notFound()` nếu `trip.trpDriverId !== driver.drvId`), khớp đúng cổng mà core enforce trong `completeTruckTrip`.

**Chọn cách này thay vì trỏ link ngược về `/trips/{id}`**: đổi link sẽ làm tài xế mất trang cập nhật điểm dừng mà `73d16ab` xây riêng cho họ.

Bố cục: phần hoàn thành đứng **trên** thẻ chi phí (kể cả trên điện thoại) vì với chuyến đang mở, chốt chuyến mới là việc chính. Nút "Cập nhật chi phí" hạ xuống `secondary` khi chuyến còn mở để chỉ còn một hành động chính.

### 4.2 Chuyển `TruckCompleteSection` thành component dùng chung

`app/(app)/trips/[id]/_components/` → `components/truck/` (đã có `cost-receipt-input`, `fuel-toast`, `report-status-badge`). Giờ có 2 route dùng, để trong `_components` của route khác là sai chỗ.

### 4.3 Nạp sẵn số liệu vào form hoàn thành

- Prop mới `initial?: CompleteSectionInitial` (chi phí phát sinh + giờ + km + nhiên liệu + cầu đường).
- Helper mới `lib/truck-complete-initial.ts` → `completeInitialOf(trip)`, ép kiểu `numeric` (Drizzle trả string) và loại `NaN`.
- Giờ được format sang giờ **trình duyệt** cho `<input type="datetime-local">`; chỉ chạy sau hydration (form đang thu gọn ở lần render đầu) nên không lệch múi giờ SSR.

### 4.4 Bổ sung `revalidatePath` thiếu

`driverCompleteTruckTripAction` revalidate `/today`, `/trips`, `/trips/{id}` nhưng **không** revalidate `/today/truck/{id}` — đúng nơi tài xế submit. Đã thêm. (`driverUpdateTruckTripAction` đã có sẵn dòng này — action hoàn thành là cái lọt.)

---

## 5. File thay đổi

| Loại | File | Thay đổi |
|---|---|---|
| FE | `apps/web/src/app/(app)/today/truck/[id]/page.tsx` | Render phần hoàn thành + nạp `costAttachments`; hạ cấp nút "Cập nhật chi phí" |
| FE | `apps/web/src/components/truck/truck-complete-section.tsx` | **Chuyển từ** `app/(app)/trips/[id]/_components/`; thêm prop `initial` + nạp sẵn state |
| FE | `apps/web/src/lib/truck-complete-initial.ts` | **Mới** — `completeInitialOf(trip)` |
| FE | `apps/web/src/app/(app)/trips/[id]/_components/truck-trip-detail.tsx` | Prop `completeInitial`, truyền `extras` xuống form |
| FE | `apps/web/src/app/(app)/trips/[id]/page.tsx` | Truyền `completeInitial` |
| FE | `apps/web/src/app/(app)/truck/trips/[id]/page.tsx` | Truyền `completeInitial` |
| BE | `apps/web/src/server/actions/trips/truck-trip.actions.ts` | `revalidatePath('/today/truck/{id}')` trong `driverCompleteTruckTripAction` |

**Không đổi**: DB (không có migration), i18n (dùng lại `screens.truckComplete.*` đã có đủ ko/en/vi), server action & core service (logic hoàn thành + kiểm quyền giữ nguyên).

---

## 6. Kiểm thử

`tsc --noEmit` ✅ · `next lint` ✅ (chỉ còn cảnh báo cũ ở file khác)

E2E Playwright trên local (chuyến `TRK-2608-001`, tài xế `Tài xế Xe tải`) — **1/1 pass**:

| # | Kiểm tra | Kết quả |
|---|---|---|
| 1 | Chuyến `CONFIRMED` → nút "Hoàn thành chuyến đi" hiện trên `/today/truck/{id}` | ✅ |
| 2 | Mở form → nạp sẵn 2 khoản phí (Bốc xếp 300.000, Phí lưu ca 180.000) | ✅ |
| 3 | Nạp sẵn cầu đường 320.000, nhiên liệu 55 L, đơn giá 22.000 | ✅ |
| 4 | Xác nhận → toast "Đã hoàn thành chuyến đi" | ✅ |
| 5 | DB: `trp_status = COMPLETED` | ✅ |
| 6 | DB: 2 khoản chi phí phát sinh **còn nguyên** (kịch bản mất dữ liệu §3) | ✅ |
| 7 | DB: `trp_fuel_liters = 55`, `trp_toll_fee = 320000` còn nguyên | ✅ |
| 8 | Tải lại trang → nút biến mất | ✅ |
| 9 | Chuyến đã `COMPLETED` (`TRK-2608-002`) → không render nút | ✅ |

Dữ liệu seed local đã được khôi phục về `CONFIRMED` sau khi chạy.

---

## 7. Phòng tái phát

1. **Component hành động không được nằm trong `_components/` của route khác.** Nút hoàn thành "biến mất" được vì nó bị chôn trong `_components` của `/trips/[id]` — đổi link ở màn khác là mất, không có lỗi biên dịch nào báo. Hành động dùng chung → `components/truck/`.
2. **Đổi `href` của thẻ danh sách = đổi tập hành động người dùng chạm được.** Khi trỏ một danh sách sang màn chi tiết mới, phải đối chiếu hành động của màn cũ trước khi merge.
3. **Mọi action ghi dữ liệu phải revalidate đúng route mà người dùng đang đứng**, không chỉ các route "chuẩn".
4. **Ghi đè kiểu delete-then-insert cần form nạp sẵn dữ liệu hiện có** — nếu không, mọi lối vào để trống đều là một đường xoá dữ liệu ngầm.

### Đề xuất theo sau (chưa làm)

Thêm E2E cố định chặn hồi quy cho luồng này. Hiện các spec truck trong `e2e/` dùng fixture riêng (`truck-seed.ts`) và **chưa có fixture tài xế xe tải** — cần seed thêm trước khi viết test, nên tách ra khỏi lượt sửa này.
