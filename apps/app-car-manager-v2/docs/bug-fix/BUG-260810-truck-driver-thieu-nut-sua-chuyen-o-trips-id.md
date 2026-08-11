# BUG-260810 — Tài xế xe tải không có nút "Sửa chuyến" khi vào chuyến qua deep-link `/trips/{id}`

| | |
|---|---|
| **Ngày** | 2026-08-10 |
| **Phạm vi** | `TruckTripDetail` (dùng ở `/trips/[id]` và `/truck/trips/[id]`) |
| **Mức độ** | Trung bình — tài xế mở chuyến từ link thông báo thì không sửa được, phải tự tìm đường về `Hôm nay` rồi mở lại chuyến |
| **Branch** | `staging-car-truck` |
| **Trạng thái** | ✅ Đã sửa — verify 2 role × 2 trạng thái chuyến, 3 độ rộng màn hình |

> Phát hiện khi rà chức năng "cho Edit sau khi hoàn thành cho tất cả các role". Kết luận của lượt rà đó: **quyền Edit đã mở cho cả 3 role và không bị chặn theo trạng thái** — lỗ duy nhất là thiếu *affordance* ở màn deep-link này.

---

## 1. Hiện tượng

Tài xế xe tải bấm link thông báo → vào `/trips/{id}` → **không có nút Sửa nào** (đo được 0 link `/edit`), cả với chuyến đang mở lẫn chuyến đã hoàn thành. Trang riêng của họ `/today/truck/{id}` thì có đủ 3 link.

Cùng họ với [BUG-260810 — mất nút Hoàn thành chuyến đi](BUG-260810-truck-driver-mat-nut-hoan-thanh-chuyen.md): affordance có ở màn này, thiếu ở màn kia.

## 2. Nguyên nhân

`TruckTripDetail` chỉ nhận `actions` và truyền vào `PageHeader`. Trang quản lý truyền `TruckTripManageActions` (Sửa/Xoá); trang `/trips/[id]` **không truyền gì** → tài xế không có nút.

Không thể chỉ truyền thêm `actions` là xong, vì **`PageHeader.actions` là desktop-only**:

- `page-header.tsx` chỉ đưa `mobileAction` vào app bar mobile, **cố ý không fallback** về `actions`;
- `TruckTripDetail` lại đặt `mobileVariant="brand"`, và `BrandHeader()` trong `mobile-page-header.tsx:57` **không nhận `back` lẫn `rightSlot`** — bỏ luôn slot hành động.

Mà tài xế chính là người duy nhất cần nút này, và họ dùng điện thoại (PWA-first). Nút trên header sẽ **vô hình với đúng người cần nó**.

Chính `page-header.tsx` cũng ghi rõ quy ước: *"Pages that just need Edit/Delete should now render those inline inside the page's primary card"*.

## 3. Nội dung sửa

### 3.1 Nút Sửa nằm trong body, không nằm header

`truck-trip-detail.tsx` — prop mới `editHref?: string`; khi có thì render nút `secondary` "Sửa chuyến" ở **cả 2 layout**:

| Trạng thái chuyến | Vị trí | Lý do |
|---|---|---|
| Đã hoàn thành | ngay dưới thẻ **Chi phí chuyến** | "số này sai" là lý do duy nhất tài xế mở lại chuyến đã xong |
| Đang mở | dưới phần **Hoàn thành chuyến đi** | thứ cấp so với chốt chuyến |

### 3.2 Chỉ chuyến của chính tài xế đó

`trips/[id]/page.tsx` truyền `editHref` khi và chỉ khi `isAssignedDriver`, trỏ tới `/today/truck/{id}/edit` — **không** phải `/truck/trips/{id}/edit`, vì layout `/truck` redirect mọi `DRIVER` về `/today` nên route đó bất khả đạt với họ.

Staff không cần: `/trips/{id}` đã redirect ADMIN/MANAGER sang `/truck/trips/{id}`, nơi đã có nút Sửa ở header.

### 3.3 Chừa chỗ cho BottomTabNav

Đo thực tế cho thấy nút mới bị **thanh tab dưới che mất nửa dưới**: nút ở `y=788..828`, thanh tab chiếm `787..844`.

App shell đã có `pb-[calc(56px+env(safe-area-inset-bottom,0px))]` trên `<main>` ([app-shell-client.tsx:160](../../apps/web/src/components/layout/app-shell-client.tsx)), **nhưng không đủ**: nội dung trang này làm `<main>` cao hơn viewport (đo được `main` cao 904px trong viewport 844px), nên phần padding đó bị đẩy ra ngoài màn hình. Container bên trong **không phải là scroller** (`scrollHeight === clientHeight`) — trang cuộn ở tầng document.

→ Thêm `pb-24 md:pb-6` cho container nội dung, đúng cách [driver-today-view.tsx:78](../../apps/web/src/app/(app)/today/_components/driver-today-view.tsx) đã làm vì cùng lý do. Desktop giữ nguyên 24px như cũ (`md:py-6` → `md:pt-6` + `md:pb-6`).

## 4. Kiểm thử

`tsc --noEmit` ✅ · `next lint` ✅

| # | Kiểm tra | Kết quả |
|---|---|---|
| 1 | Tài xế · chuyến **đang mở** · `/trips/{id}` @390px | nút hiện, `y=727..767` < `787` (thanh tab) — không bị che |
| 2 | Tài xế · chuyến **đã hoàn thành** | nút hiện, cuộn xuống đáy `y=652..692` — không bị che |
| 3 | Bấm nút | điều hướng đúng `/today/truck/{id}/edit`, form **Lưu chuyến** load được |
| 4 | `elementFromPoint` tại tâm nút | trả về chính link (không bị phần tử khác chặn) |
| 5 | Tài xế **không phải người được gán** (Tài xế Xe con) | 0 nút Sửa, 0 nút Hoàn thành ✅ |
| 6 | Quản lý `/truck/trips/{id}` (mở + đã xong) | vẫn chỉ 1 link edit ở header, **không** mọc thêm nút — không hồi quy |
| 7 | Overflow @360/390/414px | 0 |
| 8 | `pageErrors` toàn bộ lượt đo | rỗng |

## 5. Còn lại (chưa làm)

- **Quản lý trên mobile không có nút Sửa** ở `/truck/trips/{id}` — `actions` là desktop-only và `mobileVariant="brand"` bỏ slot mobile. Cùng nguyên nhân §2, khác đối tượng; chưa có yêu cầu nên không đụng.
- **`mobileVariant="brand"` trên một màn chi tiết là sai quy ước** (`page-header.tsx` ghi 'brand' chỉ dành cho route home) — hệ quả là màn này **không có chevron back trên mobile** cho mọi role. Sửa thì được cả back lẫn slot hành động, nhưng đổi header mobile của cả trang quản lý → tách riêng.
