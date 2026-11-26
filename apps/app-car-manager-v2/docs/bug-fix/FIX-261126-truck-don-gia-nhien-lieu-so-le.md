# FIX-261126 — Truck: ô Đơn giá nhiên liệu không nhận số lẻ, sửa chuyến có đơn giá lẻ thì giá bị nhân ×10 / ×100

Phát hiện khi chạy [TR-261126](../test/TR-261126-truck-trips-ten-cot-thong-nhat.md) (OBS-1). Lỗi đã có từ trước, không do branch thống nhất tên cột gây ra.
Đã sửa trên cùng branch `fix/car-v2-truck-trips-consistent-names`.
Ảnh và script nhắc dưới đây (`TR-261126-evidence/…`) lưu trên máy test, không commit (repo không lưu file nhị phân trong `docs/`).

## Triệu chứng
Form **Tạo chuyến / Sửa chuyến** Truck (`/truck/trips/new`, `/truck/trips/:id/edit`, cũng là form tài xế tự tạo ở `/today/truck/...`):

- Không nhập được đơn giá lẻ. Gõ `21350,5` hoặc `21350.5` đều thành **213.505**.
- Chuyến có đơn giá lẻ (đến từ Nhập Excel, DB lưu `numeric(14,2)`) mở form sửa thấy "21.350,5". Gõ thêm 1 chữ số thì ô thành **2.135.050** và "Chi phí nhiên liệu" nhảy từ 859.358 lên 85.935.763 đ. Bấm Lưu là ghi giá sai khoảng ×100 vào DB. Ảnh: `TR-261126-evidence/09-OBS1-don-gia-nhan-100.png`.
- Màn **Hoàn thành chuyến đi** (`TruckCompleteSection`, cho nhân viên và tài xế): ô Đơn giá là `type="number" step="1"`, gõ 21350.5 bị trình duyệt đánh dấu không hợp lệ (`stepMismatch`).

Trong khi đó DB, file mẫu và file xuất (`#,##0.00`) cùng màn Nhập Excel đều giữ 2 số lẻ. Chỉ riêng form là không giữ được.

## Nguyên nhân
- `truck-trip-form.tsx` dùng `MoneyInput` cho Đơn giá. `MoneyInput` chuyển chữ trong ô về giá trị bằng `digitsOnly = text.replace(/[^\d]/g, '')`, tức bỏ cả `,` lẫn `.`. Ô hiển thị "21.350,5", người dùng gõ thêm "0" thành "21.350,50" → `digitsOnly` → `2135050`.
- `truck-complete-section.tsx` đặt `step="1"` cho Đơn giá.

## Sửa
1. **`apps/web/src/lib/decimal-input.ts` (mới)** — hàm thuần, không phụ thuộc React:
   - `formatDecimalRaw("21350.5")` → `"21.350,5"`. Theo kiểu vi-VN: dấu nghìn chỉ cho phần nguyên, "," cho phần thập phân. Giữ nguyên dấu thập phân và số 0 cuối đang gõ dở ("21.350,", "21.350,50").
   - `parseDecimalText(text, prevText, decimals)` → giá trị thô `"21350.5"`. So chữ mới với chữ ngay trước để biết người dùng vừa gõ hay dán gì:
     - Phím "." hoặc "," vừa gõ là dấu thập phân.
     - Các dấu "." đã có sẵn trong ô là dấu nghìn. Nhờ vậy xoá 1 chữ số của "21.350" ra "21.35" vẫn hiểu là 2.135, không phải 21,35.
     - Đoạn dán vào được đọc theo hình dạng: có cả "." và "," thì dấu đứng sau cùng là dấu thập phân. Chỉ có một loại dấu thì xét xem có xếp đúng kiểu dấu nghìn không (nhóm đầu 1–3 chữ số, các nhóm sau đúng 3 chữ số): "21.350" là nghìn, "21350.5" / "21350,5" / "21350.555" là thập phân.
     - Chỉ một dấu thập phân, tối đa `decimals` chữ số sau dấu, bỏ số 0 thừa ở đầu.
   - `canonicalDecimalRaw("21350.50")` → `"21350.5"`. Dùng khi mở form sửa để ô hiện "21.350,5" thay vì "21.350,50".
2. **`MoneyInput`** thêm prop `decimals` (mặc định **0**, đi đúng nhánh `digitsOnly` / `withSeparators` cũ nên mọi ô tiền khác không đổi) và prop `unit` (mặc định "₫").
   - Khi `decimals > 0`: dùng các hàm trên, đặt `inputMode="decimal"` (bàn phím điện thoại có phím thập phân).
   - IME tiếng Việt (BUG-260804): một lần composition được so như một đoạn chèn, tính từ chữ lúc composition bắt đầu.
3. **`truck-trip-form.tsx`**:
   - Đơn giá: `<MoneyInput decimals={2} />`.
   - Lượng nhiên liệu: đổi từ `<Input type="number">` sang `<MoneyInput decimals={2} unit={tCol('unitLitre')} />`, để 2 ô cạnh nhau cùng cách viết ("40,25" L — "21.350,5" ₫).
   - Giá trị ban đầu của 2 ô qua `canonicalDecimalRaw`.
4. **`truck-complete-section.tsx`**: Đơn giá `step="1"` → `step="0.01"`.

Phía server không phải sửa: `fuel_price` / `fuel_liters` là `z.number().nonnegative()`, cột DB `numeric(14,2)` / `numeric(10,2)`.

## Kiểm tra
- `tsc --noEmit` apps/web: 0 lỗi. `next lint` trên 4 file đã sửa: không cảnh báo.
- `decimal-input.test.mts` (chạy chính module bằng `node --experimental-strip-types`): **45/45 case đạt**. Gồm định dạng, giá trị từ DB, gõ bằng "," và ".", chữ số thập phân thứ 3 bị bỏ, dấu thập phân thứ 2 bị bỏ, đúng kịch bản lỗi (thêm "0" vào 21350.5), xoá chữ số / dấu thập phân / dấu nghìn, chèn giữa, chọn hết rồi gõ, dán 9 kiểu, đoạn IME.
- Live trên `next dev` + DB dev, Chrome:
  - Tạo chuyến: gõ "40,25" và "21350,5" → hiện "40,25" / "21.350,5", Chi phí nhiên liệu 859.358 đ. Gõ "40.25" / "21350.75" → "40,25" / "21.350,75", 859.368 đ. Lưu → DB `trp_fuel_liters 40.25`, `trp_fuel_price 21350.50`.
  - Sửa chuyến đó: ô mở "21.350,5" / "40,25". Gõ thêm "0" → **"21.350,50"**, Chi phí nhiên liệu vẫn **859.358 đ**. Lưu → DB vẫn `21350.50`. Ảnh: `TR-261126-evidence/10-OBS1-da-sua-form-sua-chuyen.png`.
  - Ô tiền khác (Phí cầu đường): vẫn chỉ nhận số nguyên, hiện "150.000", `inputMode="numeric"`, như cũ.
  - Hoàn thành chuyến đi (mở trên chuyến TRK-9002 có sẵn, **không bấm hoàn tất**): gõ 21350.5 → `step 0.01`, `validity.valid = true`.
  - Console trình duyệt và log `next dev`: không có lỗi mới.
- Chuyến test TR-3019 (ghi chú `TEST-OBS1`) đã soft delete qua UI.

Chưa kiểm tra live với bộ gõ Telex/VNI thật (không giả lập được trong trình duyệt tự động). Logic composition đã có case trong bộ test.

## File thay đổi
- `apps/web/src/lib/decimal-input.ts` — **mới**
- `apps/web/src/components/inputs/money-input.tsx` — prop `decimals`, `unit`
- `apps/web/src/app/(app)/truck/trips/_components/truck-trip-form.tsx` — Đơn giá + Lượng nhiên liệu nhận 2 số lẻ, giá trị đầu không còn số 0 thừa
- `apps/web/src/components/truck/truck-complete-section.tsx` — `step="0.01"` cho Đơn giá

## Phòng tái phát
- Ô nhập số có phần lẻ (đơn giá, lít…) không dùng `MoneyInput` mặc định. Dùng `MoneyInput decimals={n}` với `n` = scale của cột DB.
- Số chữ số lẻ trên form phải bằng scale của cột DB và number format của file mẫu / file xuất (`TRUCK_TRIP_SHEET_COLUMNS.type`).
- Không chuyển chữ trong ô thành số bằng cách lọc chỉ giữ chữ số khi trường cho phép số lẻ.
