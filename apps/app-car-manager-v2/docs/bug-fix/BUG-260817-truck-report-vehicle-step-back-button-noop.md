# BUG-260817 — Nút "Quay lại" ở bước Chọn xe (lập báo cáo) không có tác dụng

| | |
|---|---|
| **Ngày** | 2026-08-17 |
| **Phạm vi** | Wizard `/truck/reports/new` — Bước 3 "Chọn xe" (`ReportVehicleStep`) |
| **Mức độ** | Thấp — không sai số liệu, chỉ chặn điều hướng lùi trong wizard |
| **Branch** | `staging` |
| **Trạng thái** | ✅ Đã sửa (repro + verify bằng UI thật) |

> **Báo cáo của người dùng (2026-08-17)**: *"nút quay lại dưới mục lập báo cáo các xe đang bị lỗi không bấm được"*

---

## 1. Hiện tượng

`/truck/reports/new` → chọn tháng → chọn khu vực (vd HCM) → **Bước 3 · Chọn xe** → bấm **"Quay lại"** → không có gì xảy ra, màn hình vẫn ở nguyên "Bước 3 · Chọn xe" của cùng khu vực đó.

## 2. Nguyên nhân

Nút không thực sự "vô tác dụng" — nó có điều hướng, nhưng điều hướng **về lại chính trang đang đứng**.

[report-vehicle-step.tsx:57](../../apps/web/src/app/(app)/truck/reports/_components/report-vehicle-step.tsx#L57) (trước sửa):

```ts
const backHref = `/truck/reports/new?month=${month}&regions=${regionsCsv}${vfDone ? `&vf=${encodeURIComponent(vfDone)}` : ''}`;
```

`vfDone` chỉ chứa các entry của những khu vực đã **XONG** bước chọn xe TRƯỚC khu vực hiện tại — khu vực đang đứng chưa có entry (đó chính là lý do server route nó vào Bước 3 cho khu vực này). `backHref` giữ nguyên `vfDone` và `regions` — tức là gửi lại ĐÚNG cái state đã đưa người dùng tới trang này.

Ở `new/page.tsx` ([:70-74](../../apps/web/src/app/(app)/truck/reports/new/page.tsx#L70)):

```ts
const pendingVehicleRegion = !allScope ? regions.find((r) => !vehicleScope.has(r)) : undefined;
```

Vì `vf` không đổi, `pendingVehicleRegion` resolve lại về **đúng khu vực đang đứng** → server render lại y hệt Bước 3 hiện tại. Với đúng 1 khu vực được chọn (trường hợp phổ biến nhất), `vfDone` luôn rỗng ở bước đầu tiên → bấm "Quay lại" **không bao giờ** chạm tới Bước 2 (chọn khu vực) được.

## 3. Phương án sửa

`backHref` phải lùi về state TRƯỚC — tức bỏ (pop) đúng 1 entry cuối của `vfDone` (khu vực xử lý ngay trước khu vực hiện tại):

- Còn entry để pop → giữ `regions`, `vf` = phần còn lại → server resolve `pendingVehicleRegion` về đúng khu vực TRƯỚC đó (đúng ý "Quay lại").
- Không còn entry nào (đang ở khu vực ĐẦU TIÊN của wizard) → bỏ hẳn `regions` khỏi URL → rơi xuống nhánh Bước 2 (chọn khu vực) của `page.tsx`.

```ts
const doneEntries = vfDone ? vfDone.split(';').filter(Boolean) : [];
const backHref =
  doneEntries.length > 0
    ? `/truck/reports/new?month=${month}&regions=${regionsCsv}&vf=${encodeURIComponent(doneEntries.slice(0, -1).join(';'))}`
    : `/truck/reports/new?month=${month}`;
```

## 4. File thay đổi

| File | Loại | Nội dung |
|---|---|---|
| `apps/web/src/app/(app)/truck/reports/_components/report-vehicle-step.tsx` | sửa | `backHref` pop 1 entry cuối của `vfDone` thay vì giữ nguyên |

## 5. Kiểm chứng (UI thật, không phải suy luận code)

Click thật qua Browser pane (hydration cục bộ đã hoạt động trở lại phiên này): Tháng 8/2026 → khu vực **HCM** (1 khu vực, `vfDone` rỗng ngay từ đầu — trường hợp phổ biến nhất) → Bước 3 Chọn xe → bấm **Quay lại**.

| | Trước sửa | Sau sửa |
|---|---|---|
| Kết quả | Vẫn "Bước 3 · Chọn xe (HCM)" | **"Bước 2 · Chọn khu vực"** ✅ |

Trường hợp nhiều khu vực (pop về khu vực NGAY TRƯỚC thay vì Bước 2) chưa có dữ liệu chuyến ở 2 khu vực cùng lúc trên dev để click-test trực tiếp, nhưng logic server (`pendingVehicleRegion = regions.find(r => !vehicleScope.has(r))`) không đổi — chỉ bớt đúng 1 entry ở cuối `vf` sẽ resolve đúng về khu vực liền trước, cùng cơ chế đã verify ở trường hợp 1 khu vực.

`tsc --noEmit` exit 0.

## 6. Chống tái phát

| Vấn đề | Quy tắc |
|---|---|
| "Quay lại" tính bằng cách build lại chính URL hiện tại | Nút back trong 1 wizard nhiều bước lặp (loop theo danh sách, ví dụ theo khu vực) phải **bớt đi state của bước hiện tại**, không phải giữ nguyên rồi gửi lại — giữ nguyên = tự quay vòng tại chỗ. |
| Bug chỉ lộ rõ ở trường hợp ÍT bước nhất (1 khu vực) | Test nút "Quay lại" của 1 bước lặp phải thử cả trường hợp **chỉ có 1 vòng lặp** (dễ code sai vì tưởng luôn có "bước trước" để lùi về) lẫn nhiều vòng lặp. |
