# BUG-260810 — Màn "Hôm nay" của tài xế xe tải: badge trạng thái bị cắt trên điện thoại

| | |
|---|---|
| **Ngày** | 2026-08-10 |
| **Phạm vi** | `TruckDriverToday` — dùng ở `/today` và `/trips` (view tài xế xe tải) |
| **Mức độ** | Trung bình — không mất dữ liệu, nhưng tài xế không đọc được trạng thái chuyến và mũi tên điều hướng trên màn hình chính của họ (app dành cho mobile) |
| **Branch** | `staging-car-truck` |
| **Trạng thái** | ✅ Đã sửa — đo 0 overflow ở 360 / 390 / 414 px |

> Phát hiện khi rà 4 persona truck ở dev mode sau [BUG-260810 — mất nút Hoàn thành chuyến đi](BUG-260810-truck-driver-mat-nut-hoan-thanh-chuyen.md). **Lỗi có sẵn**, không do bản sửa đó.

---

## 1. Hiện tượng

Tài xế xe tải mở `Hôm nay` trên điện thoại (390 px) → thẻ chuyến ở mục **"Cần hoàn thành"** rộng **430 px** trong cột **358 px** → phần bên phải bị cắt:

- badge trạng thái *"Chờ hoàn thành" / "Đang chạy"* mất một nửa,
- mũi tên `>` biến mất.

`document.scrollWidth = 390` — **không có thanh cuộn ngang**, nên người dùng cũng không kéo sang xem được.

---

## 2. Nguyên nhân gốc

Container là `grid gap-6 lg:grid-cols-3` — **chỉ khai báo số cột ở breakpoint `lg`**. Dưới `lg` không có `grid-template-columns`, nên track là **implicit `auto`**, và sàn của track `auto` là **min-content của item**.

Min-content của thẻ chuyến bị đẩy lên ~380–430 px bởi dòng lộ trình:

```jsx
<div className="mt-2 flex min-w-0 items-center gap-1.5 ...">
  <span className="truncate">{tr.trpPickupAddress}</span>
  <ArrowRight ... />
  <span className="truncate">{tr.trpDropoffAddress}</span>
</div>
```

`truncate` = `white-space: nowrap` → **min-content của mỗi span là toàn bộ chiều dài địa chỉ** (163 px + 125 px trong dữ liệu thật). Grid track `auto` phải nở theo sàn đó → tràn khỏi container 358 px.

**`min-w-0` không cứu được** — đã thử trực tiếp trên trang, chiều rộng đứng nguyên 430 px. `min-width` chỉ hạ *sàn co* của flex item, **không hạ min-content contribution** mà track `auto` dùng để tính sàn.

| Thử nghiệm đo trên trang thật (390 px) | `<section>` | Thẻ chuyến |
|---|---|---|
| Hiện trạng | 430 px | 430 px |
| `min-width: 0` trên `<section>` | 430 px ❌ | 430 px |
| `grid-template-columns: minmax(0, 1fr)` | **358 px** ✅ | 358 px |

---

## 3. Nội dung sửa

`apps/web/src/app/(app)/today/_components/truck-driver-today.tsx`:

```diff
-<div className="grid gap-6 lg:grid-cols-3 lg:items-start">
+<div className="grid grid-cols-1 gap-6 lg:grid-cols-3 lg:items-start">
```

Tailwind sinh `grid-cols-1` thành `repeat(1, minmax(0, 1fr))` — **số `0` trong `minmax` chính là thứ cần**: nó bỏ sàn min-content, thẻ co lại vừa cột, và hai địa chỉ tự cắt bằng dấu `…` đúng như `truncate` định làm.

Đã thêm comment giải thích tại chỗ để lần sau không ai xoá `grid-cols-1` vì tưởng là thừa.

---

## 4. Kiểm thử

`tsc --noEmit` ✅ · `next lint` ✅

| # | Kiểm tra | Kết quả |
|---|---|---|
| 1 | `/today` @ 360 px — số phần tử tràn | 0 (trước: 5) |
| 2 | `/today` @ 390 px | 0 · thẻ 358 px · mép phải badge 329 < 390 |
| 3 | `/today` @ 414 px | 0 · thẻ 382 px |
| 4 | Desktop 1440 px — bố cục 2/3 + 1/3 giữ nguyên | ✅ `365px 365px 365px`, section 755 px, rail 365 px |
| 5 | Rà toàn bộ 18 route truck (tài xế + QT Xe tải) @ 390 px | không còn overflow do layout |

### Các trường hợp tràn còn lại — **không phải lỗi**

| Route | Phần tử | Kết luận |
|---|---|---|
| `/truck/finance`, `/truck/pnl` | `<table>` 1278 px / 503 px | Nằm trong wrapper `overflow-x: auto` → **cuộn ngang được**, đúng thiết kế bảng dữ liệu |
| `/truck/dashboard` | `span.pointer-events-none.absolute` | Tooltip ẩn, `pointer-events-none` |

---

## 5. Phòng tái phát

**Grid responsive phải luôn khai báo cột ở breakpoint gốc.** `grid lg:grid-cols-3` là một cái bẫy: dưới `lg` nó rơi về track `auto` lấy sàn min-content, nên bất kỳ nội dung `nowrap`/`truncate` nào bên trong cũng làm tràn — mà lại tràn **âm thầm** (không có thanh cuộn, chỉ bị cắt). Viết `grid grid-cols-1 lg:grid-cols-3`.

Các chỗ còn cùng dạng, **hiện chưa tràn** (nội dung ngắn hơn) nhưng cùng rủi ro tiềm ẩn, nên gộp xử lý khi có dịp đụng tới:

| File | Class |
|---|---|
| `app/(app)/today/truck/[id]/page.tsx` | `grid gap-5 lg:grid-cols-3` |
| `app/(app)/trips/[id]/_components/truck-trip-detail.tsx` | `grid gap-5 lg:grid-cols-3` |
| `app/(app)/truck/dashboard/page.tsx`, `truck/pnl/page.tsx` | `grid gap-3 sm:grid-cols-2` |
| `app/(app)/trips/[id]/_components/manager-view.tsx` | `grid lg:grid-cols-2`, `grid md:grid-cols-2` |
