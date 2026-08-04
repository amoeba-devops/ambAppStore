# BUG-260804 — Nhập số tiền bằng bàn phím tiếng Việt bị nhân số

| | |
|---|---|
| **Ngày** | 2026-08-04 |
| **Phạm vi** | `components/inputs/money-input.tsx` → 7 ô tiền: lương tài xế, giá xăng, phí cầu đường (×2), doanh thu (×2) |
| **Mức độ** | **Cao** — sai dữ liệu tài chính mà không có thông báo lỗi nào; người dùng phải phát hiện bằng mắt |
| **Branch** | `staging-car-truck` |
| **Trạng thái** | ✅ Đã sửa (repro bằng IME thật của Chromium + verify, 13/13 check) |

> **Báo cáo của người dùng (2026-08-04)**: *"Khi để bàn phím tiếng việt, nhập số sẽ bị nhảy số lỗi — chị nhập
> 10000, mà nó hiển thị 110.000 (dùng bàn phím tiếng anh thì không bị)"*

---

## 1. Hiện tượng

Bật bàn phím tiếng Việt (layout Telex/VNI của Windows) → vào ô tiền bất kỳ, ví dụ **Lương cố định** ở
`/truck/drivers/new` → gõ `10000` → ô hiển thị số khác, nhiều hơn số đã gõ. Không có toast, không có lỗi —
số sai được lưu thẳng vào DB.

Repro trên Chromium (driving IME thật qua CDP `Input.imeSetComposition`), **trước khi sửa**:

| Gõ | Hiển thị |
|---|---|
| `1` | `1` ✅ |
| `10` | `10` ✅ |
| `100` | `100` ✅ |
| `1000` | `10.001.000` ❌ |
| `10000` | `10.001.000.010.000` ❌ |

Ngưỡng đúng là **4 chữ số** — tức đúng lúc dấu phân cách nghìn đầu tiên xuất hiện. Số nhỏ hơn 1.000 không bao
giờ sai, nên lỗi trông như thất thường.

Con số người dùng thấy (`110.000`) nhẹ hơn kết quả repro vì IME thật xả buffer sớm hơn kịch bản test (test giữ
một composition dài suốt 5 phím). Cùng một cơ chế, khác độ dài buffer.

## 2. Nguyên nhân

`MoneyInput` là controlled input **có định dạng lại ngay khi gõ**:

```tsx
const display = Number(value).toLocaleString('vi-VN');   // "10000" → "10.000"
<Input value={display} onChange={(e) => onChange(e.target.value.replace(/[^\d]/g, ''))} />
```

Bàn phím tiếng Việt của Windows là một **IME**: mọi phím đi vào một *composition* đang mở, vì trong Telex/VNI
**chữ số cũng là phím dấu** (`a1` → á, `d9` → đ, `o7` → ơ…) nên IME phải giữ buffer để chờ xem chữ số đó là số
hay là dấu.

IME neo buffer của nó vào đúng đoạn text đang có trong ô. Khi React ghi lại `input.value` (`1000` → `1.000`)
**giữa lúc composition còn mở**, buffer của IME lệch khỏi thực tế; phím tiếp theo làm nó commit lại **toàn bộ**
buffer vào ô → text nhân lên.

Đây cũng là lý do:

| Điều kiện | Vì sao không lỗi |
|---|---|
| Bàn phím tiếng Anh | Không có composition → React ghi lại value lúc nào cũng an toàn |
| Số < 1.000 | `withSeparators('100') === '100'` → text không đổi → React **không** ghi vào DOM → IME không lệch |
| Ô `<input type="number">` (số lít, odometer) | Không định dạng lại nên không ghi đè giữa composition |

Cùng cơ chế sẽ đánh vào **mọi** bàn phím có composition (gồm cả IME tiếng Hàn của bản `ko`), không riêng
tiếng Việt.

## 3. Cách sửa

Không bỏ dấu phân cách — chỉ **không ghi lại DOM khi composition còn mở**. Trong lúc đó component "soi gương"
lại đúng text của ô làm `value`, nên React không có gì để ghi; đóng composition thì mới định dạng:

```tsx
const [composing, setComposing] = useState<string | null>(null);  // text verbatim khi IME đang mở
const isComposing = useRef(false);                                // cờ đọc được đồng bộ

const display = composing ?? withSeparators(value);

onCompositionStart → isComposing.current = true; setComposing(giá trị hiện tại)
onChange           → nếu đang composing: setComposing(text); luôn onChange(digitsOnly(text))
onCompositionEnd   → isComposing.current = false; setComposing(null); onChange(digitsOnly(text))
```

Hai chi tiết cố ý:

- **`useRef` cho cờ, `useState` cho text.** `onChange` là một event riêng, không thể chờ re-render của
  `compositionstart`, nên cờ phải đọc được ngay.
- **`onChange(digitsOnly(...))` chạy cả khi đang composing.** State của form luôn đúng theo thời gian thực;
  chỉ phần *hiển thị* bị hoãn định dạng.

## 4. Kiểm chứng

Script Playwright điều khiển IME thật của Chromium (`Input.imeSetComposition` để dựng composition tăng dần từng
ký tự, `Input.insertText` để commit) trên form thật `/truck/drivers/new`. Chạy cùng một script trước và sau khi
sửa:

| Check | Trước | Sau |
|---|---|---|
| IME: `10000` → `10.000` | ❌ `10.001.000.010.000` | ✅ |
| IME: `1000000` → `1.000.000` | ❌ | ✅ |
| IME: `13500000` → `13.500.000` | ❌ | ✅ |
| IME: `7` → `7` | ✅ | ✅ |
| IME: `0` → `0` | ✅ | ✅ |
| Bàn phím thường vẫn định dạng | ✅ | ✅ |
| IME: thêm 1 chữ số vào số đã có dấu phân cách | ❌ | ✅ `2.500.000` |
| IME: gõ lẫn chữ → bị loại khi commit | ❌ `12.123.123` | ✅ `123` |
| **Lưu vào DB đúng `10000`, không phải `110000`** | ❌ | ✅ |
| Dòng `car_truck_cost_rates` cũng mang `10000` | ❌ | ✅ |
| Không có console error | ✅ | ✅ |

**5/13 → 13/13.** `tsc --noEmit` và `next lint` sạch. Dữ liệu test trên nhánh dev đã soft-delete lại.

## 5. Phòng ngừa

| Nguyên tắc | Ghi chú |
|---|---|
| Controlled input **định dạng lại khi gõ** phải chặn composition | Người dùng chính của app là VN/KR — cả hai đều dùng IME. Bất kỳ ô nào format-as-you-type (tiền, số điện thoại, biển số…) đều phải có `onCompositionStart/End`, hoặc chỉ format lúc `blur` |
| Test bằng bàn phím tiếng Anh không chứng minh được gì | Cả class bug này vô hình với `keyboard.type()`. Dùng CDP `Input.imeSetComposition` để test đường IME |
| `MoneyInput` là chỗ duy nhất trong repo format-as-you-type | Đã soát: các ô số còn lại dùng `<input type="number">` (không format) nên không bị. Thêm ô format mới thì tái dùng `MoneyInput`, đừng viết lại |
