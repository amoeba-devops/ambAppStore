# BUG-260729 — [Quay lại] ở chi tiết tài xế xe tải trả về danh sách tài xế xe con

| | |
|---|---|
| **Ngày** | 2026-07-29 |
| **Phạm vi** | Chi tiết / sửa tài xế (dùng chung 2 workspace) — `app-car-manager-v2` |
| **Mức độ** | Trung bình (UX/điều hướng) — người dùng truck bị đá về roster không chứa tài xế vừa xem |
| **Branch** | `staging-car-truck` |
| **Trạng thái** | ✅ Đã sửa |

---

## 1. Hiện tượng

Ở workspace **Xe tải** → **Tài xế** (`/truck/drivers`) → mở một tài xế (vd. Lê Hoàng) → bấm **[Quay lại]**
→ hiển thị **danh sách tài xế Xe con** (`/drivers`), không phải roster xe tải. Breadcrumb "Tài xế" cũng
trỏ về `/drivers`.

Nghiêm trọng hơn "nhảy workspace": `/drivers` gọi `listDrivers(..., 'CAR')` nên tài xế xe tải **không
hề có trong danh sách đó** — người dùng quay lại và không thấy người mình vừa xem.

## 2. Nguyên nhân (root cause)

Trang chi tiết tài xế là **dùng chung cho cả 2 phòng ban** (`/truck/drivers` cố tình link sang
`/drivers/{id}` — xem comment trong `truck/drivers/page.tsx`), nhưng đường về bị **hard-code**:

```tsx
// app/(app)/drivers/[id]/page.tsx (cũ)
breadcrumbs={[..., { label: tNav('drivers'), href: '/drivers' }, ...]}
back="/drivers"
<Link href="/drivers"><ChevronLeft />{tA('back')}</Link>
```

`/drivers` là URL **trung tính** theo `clearlyDept()` (BUG-260622), nên workspace vẫn ở lại TRUCK
(sidebar/theme màu cam) trong khi nội dung là roster CAR — đúng như ảnh QA gửi.

Cùng lỗi ở 2 chỗ nữa:
- `drivers/[id]/edit/page.tsx` — breadcrumb cha `/drivers`.
- `driver-delete-button.tsx` — `router.push('/drivers')` sau khi xoá.

## 3. Phương án sửa — roster đi theo phòng ban của chính tài xế

`/drivers` và `/truck/drivers` **phân hoạch** roster theo đúng một quy tắc (`deptPredicate`):
có membership TRUCK còn hiệu lực → chỉ nằm ở `/truck/drivers`; ngược lại → `/drivers`. Vậy trang cha
phải suy ra từ **phòng ban của tài xế**, không phải từ cookie workspace đang dính (sticky dept):
lấy theo cookie thì một tài xế xe con mở từ workspace truck lại bị đưa về roster truck — cũng là một
danh sách không chứa người đó.

Helper mới, một quy tắc duy nhất cho cả detail + edit + xoá:

```ts
// lib/driver-roster.ts
driverRosterRef(actor, driverUserId)
  → isTruckDriver(...) && hasFleet(actor, 'TRUCK')  ? { href: '/truck/drivers', dept: 'TRUCK' }
                                                    : { href: '/drivers',       dept: 'CAR' }
```

`hasFleet` clamp là cần thiết vì `/truck/*` bị gate: manager chỉ có CAR mà deep-link vào một tài xế
truck sẽ nhận nút Quay lại bị chặn ngay ở `/truck/layout.tsx`.

## 4. Nội dung sửa

| # | File | Thay đổi |
|---|---|---|
| 1 | `apps/web/src/lib/driver-roster.ts` | **Mới** — `driverRosterRef()` quyết định roster cha |
| 2 | `apps/web/src/app/(app)/drivers/[id]/page.tsx` | breadcrumb + `back` + nút "Quay lại" + `redirectTo` khi xoá dùng `roster.href`; nhãn breadcrumb `nav.truckDrivers` / `nav.drivers` |
| 3 | `apps/web/src/app/(app)/drivers/[id]/edit/page.tsx` | breadcrumb cha dùng `roster.href` / `rosterLabel` |
| 4 | `apps/web/src/app/(app)/drivers/[id]/_components/driver-delete-button.tsx` | thêm prop `redirectTo` (default `/drivers`) thay cho push cứng |
| 5 | `apps/web/src/app/(app)/trips/[id]/page.tsx` | chuyến LOG + staff có quyền TRUCK → `redirect('/truck/trips/{id}')` (xem §7) |
| 6 | `apps/web/src/app/(app)/trips/[id]/edit/page.tsx` | chuyến LOG → `redirect('/truck/trips/{id}/edit')` (hoặc về chi tiết nếu không có quyền TRUCK) |

Không cần key i18n mới (`nav.drivers`, `nav.truckDrivers` đã có ở ko/en/vi). Không có thay đổi DB.

## 5. Kiểm chứng (dev, `/dev-login` ADMIN có cả 2 phòng)

| Trường hợp | Kỳ vọng | Kết quả |
|---|---|---|
| `/drivers/{tài xế TRUCK}` — breadcrumb, mũi tên mobile, nút "Quay lại" | `/truck/drivers` | ✅ (4/4 link) |
| Click "Quay lại" từ chi tiết tài xế truck | vào `/truck/drivers`, H1 "Tài xế", 4 dòng | ✅ |
| `/drivers/{tài xế CAR}` khi cookie dept = TRUCK | vẫn `/drivers` | ✅ (không bị kéo sang truck) |
| `/drivers/{tài xế TRUCK}/edit` — breadcrumb cha | `/truck/drivers` | ✅ |
| `tsc --noEmit` | pass | ✅ |

## 6. Phòng ngừa tái diễn

- Trang **dùng chung 2 workspace** không được hard-code đường về. Đường về phải suy ra từ dữ liệu
  (phòng ban của bản ghi) hoặc workspace đang hoạt động — và quy tắc đó nằm ở **một** helper.
- Cùng họ với BUG-260622 (sticky workspace) và `driverDept()`: mỗi khi một quy tắc phòng ban bị copy
  vào nhiều resolver là lúc phát sinh split-brain. `driverRosterRef()` là bản duy nhất cho "tài xế này
  thuộc danh sách nào".
- Còn nợ (ngoài phạm vi): `/truck/fleet` chưa có trang chi tiết `[id]` — hàng danh sách trỏ trực tiếp
  `[id]/edit`, nên chưa gặp vấn đề tương tự.

---

## 7. Rà soát toàn bộ nút [Quay lại] / breadcrumb / redirect sau hành động

Quét 24 chỗ khai báo `back=`, toàn bộ link `tA('back')`, breadcrumb cha, và mọi
`router.push` / `redirect` về trang danh sách.

### 7.1 Phát hiện thêm 1 lỗi cùng họ — chuyến xe tải mở ở `/trips/{id}`

`/trips/{id}` phục vụ **cả** chuyến điều xe (DISPATCH) và chuyến log xe tải (LOG). Với LOG nó render
`TruckTripDetail` nhưng **không truyền `backHref`** → mặc định `'/trips'`, trong khi danh sách
`/trips` của staff lọc `kind: 'DISPATCH'` → **không bao giờ chứa chuyến LOG**. Đường vào rất thực tế:

- bảng "Chuyến gần đây" ở chi tiết tài xế / phương tiện (`trip-history-section` → `/trips/{trpId}`),
- link thông báo (`trip-state-machine.service.ts`: `tripPath = /trips/{id}`),
- cảnh báo khi xoá tài xế (`refs → /trips/{id}`).

**Sửa**: staff có quyền TRUCK → `redirect('/truck/trips/{id}')` — trang chuẩn của workspace xe tải
(có breadcrumb truck, có nút Sửa/Xoá, back về `/truck/trips`). Cùng khuôn với `/vehicles/[id]` đã
redirect xe tải sang `/truck/fleet/[id]/edit`. **Driver không đổi**: `/trips` đúng là danh sách của họ.

Đồng thời `/trips/{id}/edit` **hoàn toàn thiếu guard LOG** — form điều xe (chọn hành khách, xe CAR,
tài xế non-truck) có thể ghi đè một chuyến xe tải nếu gõ URL. Đã redirect sang
`/truck/trips/{id}/edit`.

### 7.2 Các chỗ đã kiểm tra và **đúng** (không sửa)

| Trang / hành vi | Đích quay lại | Vì sao đúng |
|---|---|---|
| `/vehicles/[id]`, `/vehicles/[id]/edit` | `/vehicles` | Xe TRUCK đã bị `redirect('/truck/fleet/{id}/edit')` ngay từ đầu 2 trang |
| `vehicle-delete-button` | `/vehicles` | Chỉ tới được từ chi tiết xe con |
| `/vehicles/new`, `/drivers/new`, `/trips/new` | list xe con | Là cửa vào riêng của workspace Xe con; xe tải có `/truck/fleet`, `/truck/drivers/new`, `/truck/trips/new` |
| `/expenses/[id]`, `/expenses/new` | staff→`/costs`, driver→`/expenses` | `/costs` dùng `listEntityExpenses` — toàn tenant, không lọc phòng ban → chi phí luôn có trong danh sách đó |
| `/expenses`, `/inbox`, `/settings/me` | `/today` (chỉ DRIVER) | `/today` của tài xế xe tải render đúng view truck |
| `/today/truck/[id]`, `/today/truck/new` | `/today` | Bối cảnh tài xế |
| `/truck/drivers/new`, `/truck/fleet/[id]/edit`, `/truck/trips/[id]/edit`, wizard `/truck/reports/new` | đều trong `/truck/*` | Không có breadcrumb nào trong `/truck` trỏ ra trang xe con (đã grep) |
| `/users/[userId]/edit` → `/users` | `/users` | Trang dùng chung, danh sách toàn tenant |
| `/drivers/[id]/edit` → `/drivers/{id}` | chi tiết | Trang chi tiết là dùng chung, đã đúng phòng ban sau §3 |

### 7.3 Ghi nhận thêm

- **Redirect "mềm"**: shell đã stream trước khi page chạy nên Next trả 200 + `meta refresh`
  (`NEXT_REDIRECT;replace;…;307` trong payload) thay vì 307 thuần. Trình duyệt vẫn điều hướng đúng —
  giống hệt redirect xe tải sẵn có ở `/vehicles/[id]`.
- **Trường hợp biên còn để nguyên**: staff **không** có quyền TRUCK mở một chuyến LOG (chỉ bằng
  deep-link) vẫn thấy trang dùng chung với back `/trips` — họ không có roster xe tải nào để về.

### 7.4 Kiểm chứng §7

| Trường hợp | Kỳ vọng | Kết quả |
|---|---|---|
| ADMIN mở `/trips/{chuyến LOG}` | đổi sang `/truck/trips/{id}`, mọi link cha = `/truck/trips` | ✅ (browser: URL cuối `/truck/trips/d900…9001`) |
| ADMIN mở `/trips/{chuyến LOG}/edit` | `/truck/trips/{id}/edit` | ✅ |
| Tài xế xe tải (`drv-truck`) mở `/trips/{chuyến LOG}` | KHÔNG redirect, giữ view driver | ✅ |
| Chuyến DISPATCH | không đổi (guard nằm trong nhánh `kind === 'LOG'`) | ✅ |
| `tsc --noEmit` | pass | ✅ |
