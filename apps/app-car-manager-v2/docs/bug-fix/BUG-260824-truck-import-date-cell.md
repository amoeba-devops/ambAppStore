# BUG-260824 — Import Excel: ô ngày và ô số dạng text bị đọc sai

## 1. Triệu chứng

Người dùng thả file Excel ở màn **Import Excel** (staging), preview hiện "1 dòng hợp lệ" với ngày
`24/08/2026`, bấm **Nhập 1 dòng** → toast đỏ **`CAR-E0500 — Lỗi hệ thống — vui lòng thử lại sau`**,
không chuyến nào được tạo.

Trong lúc điều tra phát hiện thêm một lỗi **âm thầm** nghiêm trọng hơn (không báo gì cả).

## 2. Nguyên nhân

Cả hai đều nằm ở hàm `dateStr` của `truck-import-panel.tsx` — nơi đọc ô "Ngày" từ sheet:

```ts
const dateStr = (v: unknown): string => {
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  return String(v ?? '').trim();          // ← trả nguyên chuỗi
};
```

**Lỗi A — ô ngày là TEXT (`24/08/2026`) → CAR-E0500.** Khi cột được định dạng Text (hoặc người dùng
gõ dấu nháy đầu), `xlsx` trả về chuỗi chứ không phải `Date`, nên chuỗi `dd/MM/yyyy` được gửi thẳng
xuống server. Ở đó `new Date('24/08/2026')` = **Invalid Date** → `.toISOString()` ném
`RangeError: Invalid time value` → `runAction` bọc thành CAR-E0500. Reproduce trên local, log server:

```
[action] Unexpected CAR-E0500 { message: 'Invalid time value', name: 'RangeError' }
RangeError: Invalid time value  at Date.toISOString
```

Comment sẵn trong `import.actions.ts` (`// unparseable rows fail later, as before`) cho thấy hành vi
này đã được biết nhưng để nguyên.

**Lỗi B — ô ngày là DATE thật → lùi 1 ngày, không báo lỗi.** `xlsx` (với `cellDates: true`) dựng
`Date` ở **nửa đêm giờ địa phương**; đọc lại bằng `toISOString()` ở múi giờ dương sẽ tụt về hôm
trước. Kiểm chứng ở GMT+7:

```
raw: Mon Aug 24 2026 00:00:00 GMT+0700
toISOString().slice(0,10) = 2026-08-23   ← sai
local components          = 2026-08-24   ← đúng
```

Đây là đường đi của **file Excel bình thường** (cột định dạng Date), nên mọi chuyến import đều lùi 1
ngày; chuyến ngày 1 của tháng rơi sang **tháng trước** → sai luôn báo cáo tháng. Không hề có cảnh báo.

## 3. Cách sửa

| File | Thay đổi |
|---|---|
| `packages/shared/src/zod/truck-import.zod.ts` | Thêm `parseImportDate(value)` dùng chung: `Date` → đọc **local components**; text `dd/MM/yyyy` (và `-`, `.`, năm 2 số) → đảo về ISO; ISO giữ nguyên; **serial number** Excel (mốc 1899-12-30) → ISO; ngày không có thật (31/02) hoặc không đọc được → `null` |
| `apps/web/.../truck-import-panel.tsx` | `dateStr` gọi helper; không đọc được → `''` → dòng bị đánh dấu **lỗi** và không được gửi |
| `apps/web/src/server/actions/imports/import.actions.ts` | Chuẩn hoá **toàn bộ** ngày trước vòng lặp; dòng nào hỏng → `CAR-E0001` kèm **số dòng** và gợi ý định dạng, **không ghi gì cả** (trước đây nổ giữa chừng sau khi đã tạo vài chuyến). Vòng lặp dùng ngày đã chuẩn hoá cho cả `scheduledAt` lẫn giờ bắt đầu/kết thúc |

Quy ước: text đọc **ngày trước tháng** (`dd/MM/yyyy`) — đúng locale của template và của người dùng VN.

## 4. Kiểm chứng (local, qua UI thật)

| Ô "Ngày" trong file | Trước | Sau |
|---|---|---|
| Text `24/08/2026` | **CAR-E0500**, 0 chuyến | ✅ chuyến ngày `2026-08-24` |
| Date thật (24/08/2026) | ⚠️ lưu `2026-08-23` (lùi 1 ngày) | ✅ `2026-08-24` |
| Text `2026-08-24` (ISO) | ✅ đúng | ✅ đúng |
| Serial number `46258` | ✅ đúng | ✅ đúng |
| Text `hôm qua` | "1 dòng hợp lệ" rồi nổ | ✅ "1 dòng lỗi", nút Nhập bị khoá |

`turbo run typecheck` 5/5 · `turbo run lint` pass. Dữ liệu test đã dọn.

## 5. Phòng tái diễn

- **Không dùng `toISOString()` để lấy ngày-lịch từ một `Date` do `xlsx` dựng** — nó là mốc giờ địa
  phương; phải đọc `getFullYear/getMonth/getDate`. Quy tắc này áp cho mọi chỗ đọc ô ngày Excel sau này.
- Mọi giá trị từ file người dùng phải được **chuẩn hoá và validate trước khi vào vòng ghi DB**; helper
  dùng chung client+server để hai phía không lệch nhau.
- Với import nhiều dòng: validate **cả file trước**, đừng để lỗi dòng thứ N làm dở dang N-1 dòng đã ghi.

---

## 6. Lỗi thứ ba — ô SỐ dạng text bị đọc sai (phát hiện khi test kỹ 2026-08-24)

Sau khi vá phần ngày, chạy bộ test 11 case cho import thì lộ tiếp một lỗi **im lặng** cùng loại,
ở hàm `num()` của panel:

```ts
const n = Number(String(v).replace(/[,\s]/g, ''));   // chỉ bỏ dấu phẩy + khoảng trắng
```

Người Việt viết `2.500.000` (chấm = nghìn) và `10,5` (phẩy = thập phân) — ngược hoàn toàn quy ước
en-US mà `Number()` giả định. Với ô **text** (cột định dạng Text hoặc dán từ nơi khác):

| Ô trong file | Trước | Đúng phải là |
|---|---|---|
| Đơn giá `25.000` | **25** (sai 1000 lần) | 25 000 |
| Lượng dầu `10,5` | **105** (sai 10 lần) | 10,5 |
| Doanh thu `2.500.000` | **null** (mất trắng) | 2 500 000 |
| Cầu đường `120 000` | 120 000 ✔ | 120 000 |

Không có cảnh báo nào — chuyến vẫn được tạo, chỉ là sai số tiền.

**Sửa:** thêm `parseImportNumber()` vào `packages/shared` (cạnh `parseImportDate`) và dùng cho `num()`:
có cả `.` và `,` → dấu đứng sau là thập phân; một dấu, nhiều hơn hai nhóm → nghìn; một dấu, đúng 3
chữ số phía sau → nghìn (quy ước vi); còn lại → thập phân. Bỏ khoảng trắng (kể cả NBSP), ký hiệu `₫`
và dấu âm/ngoặc. Ô numeric thật đi thẳng, không đổi.

## 7. Bộ test import (11 case, chạy qua UI thật trên local)

| # | Case | Kết quả |
|---|---|---|
| 1 | Happy path đủ 18 cột, 3 dòng — kiểm từng field trong DB | PASS |
| 1b | "Chi phí khác" → line item `car_trip_extra_costs` | PASS |
| 1c | "Điểm ghé" → 3 stopover PICKUP → WAYPOINT → DELIVERY | PASS |
| 2 | Đảo thứ tự cột, tiêu đề khác → tự map theo từ khoá | PASS |
| 3 | Số text kiểu VN `2.500.000` / `10,5` / `25.000` / `120 000` | PASS (sau khi vá) |
| 3b | Biến thể `1,234.5` · `30 000 ₫` · `12,000,000` | PASS |
| 4 | Trộn dòng lỗi + dòng tốt → chỉ nhập dòng tốt | PASS |
| 5 | Chỉ có cột Ngày, mọi cột khác trống | PASS |
| 6 | File nhiều sheet → chỉ nhập sheet đang chọn | PASS |
| 7 | Tháng đã khoá sổ → chặn bằng CAR-E1002, không ghi gì | PASS |
| 8 | Ghi `car_imports` (COMPLETED + số dòng) và audit `TRUCK_IMPORT.RUN` | PASS |

Cộng 5 case định dạng ngày ở §4. `turbo run typecheck` 5/5 · `turbo run lint` pass.
