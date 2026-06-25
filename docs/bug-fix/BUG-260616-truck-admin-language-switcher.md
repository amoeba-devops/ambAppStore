# BUG-260616 — Truck Admin (prototype) lỗi chuyển ngôn ngữ: giật lag & không hiện menu ở sidebar

- **Ngày:** 2026-06-16
- **Phạm vi:** `prototype/car-truck-manager/` (Truck Admin prototype)
- **File liên quan:** `prototype/car-truck-manager/mobile-i18n.js`, `prototype/car-truck-manager/support.js`, `prototype/car-truck-manager/index.html`
- **Mức độ:** Medium (prototype/demo)

## 1. Triệu chứng
1. Chuyển ngôn ngữ bị **giật/lag**, chữ dịch chập chờn (đổi rồi quay lại tiếng Việt).
2. **Không hiện** menu chuyển ngôn ngữ ở **sidebar (desktop)**. (Nút đổi ngôn ngữ trên mobile header vẫn hoạt động.)

## 2. Nguyên nhân gốc (root cause)
`support.js` là **dc-runtime dựa trên React**:
- `index.html` chứa template trong `<x-dc>…</x-dc>` (gồm `<aside>` sidebar tĩnh ở dòng 32).
- Khi chạy, `support.js` thay thế `<x-dc>` bằng `<div id="dc-root">` (`support.js:161-163`) và **render toàn bộ UI bằng React** (`ReactDOM.createRoot(hostEl).render(...)` — `support.js:184`). CSS `x-dc{display:none!important}` ẩn template gốc (`support.js:1383`).
- Runtime **re-render** lại cây React khi: tải xong gọi `fetch(location.href)` rồi `runtime.updateHtml` (`support.js:155-157`), và khi state/subscribers đổi (`entry.subs` → `setTick`, `support.js:172-180`).

`mobile-i18n.js` xử lý i18n theo kiểu **thao tác DOM thuần**, xung đột với React:
- **Menu desktop** được chèn vào `<aside>` của React: `sidebar.insertBefore(wrapper, userSection)` (`mobile-i18n.js:851-858`). Khi React re-render, nó **reconcile và loại bỏ** node lạ này → menu biến mất. (Mobile header/bottom-nav được `document.body.appendChild` nên không bị — đó là lý do chỉ switcher desktop hỏng.)
- **Dịch** bằng cách ghi đè `textContent` và **cache tham chiếu text node** (`scanAndStoreTexts` → `originalTexts`, `mobile-i18n.js:684-722`). Sau khi React render lại, các node cache trở thành **stale** và chữ bị **revert** về template → hiện tượng giật/lag, dịch không "dính".

## 3. Cách khắc phục
### Fix A — Menu chuyển ngôn ngữ (desktop) không bị React xoá
Gắn switcher vào `document.body` với `position:fixed` (góc dưới-trái, rộng 248px trùng sidebar) thay vì chèn vào `<aside>` của React. Quản lý ẩn/hiện theo desktop/mobile trong `applyResponsiveLayout()`. (Cùng cách mobile header/bottom-nav đang dùng nên bền vững qua re-render.)

### Fix B — Dịch không bị revert & bớt giật
Thêm `MutationObserver` theo dõi `#dc-root`: khi React re-render (và đang dùng ngôn ngữ khác `vi`), **re-scan + áp lại bản dịch** (debounce bằng `requestAnimationFrame`, **ngắt observer trong lúc tự ghi DOM** để không lặp vô hạn). `scanAndStoreTexts()` được `clear()` map trước mỗi lần quét để không tích luỹ node stale. Khi đang ở tiếng Việt (mặc định) thì observer bỏ qua → không tốn chi phí.

## 4. File thay đổi
| File | Thay đổi |
|------|----------|
| `prototype/car-truck-manager/mobile-i18n.js` | Switcher desktop gắn vào `body` (fixed) + ẩn/hiện theo responsive; thêm MutationObserver re-apply i18n sau re-render; `scanAndStoreTexts` clear map. |

## 5. Kiểm thử (cần xác minh trên trình duyệt)
- [ ] Desktop: menu chuyển ngôn ngữ hiện ở góc dưới-trái sidebar và **không biến mất** sau khi trang tải xong / re-render.
- [ ] Đổi VI ↔ EN ↔ KO: chữ đổi ngay, **không revert**, không giật.
- [ ] Mobile (≤1024px): switcher desktop ẩn, nút ngôn ngữ trên mobile header vẫn chạy.
- [ ] Mở/đóng dropdown, click ra ngoài để đóng — hoạt động bình thường.

## 6. Ghi chú
Đây là bản vá tương thích cho prototype (i18n thuần + dc-runtime React). Hướng đúng về lâu dài: đưa i18n **vào trong template x-dc/React** (binding `{{ }}`) thay vì thao tác DOM ngoài.
