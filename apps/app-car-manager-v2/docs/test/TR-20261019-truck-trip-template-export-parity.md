# TR-20261019 — Đối chiếu File mẫu (template) ↔ File Xuất Excel — Danh sách chuyến xe tải

- **Ngày**: 2026-10-19
- **App**: app-car-manager-v2 — TRUCK
- **Code kiểm tra**: `main` @ `380d1767` (đang chạy trên prod, image build 2026-10-16 09:25 UTC)
- **Phạm vi**: nút **Tải template** và **Xuất Excel** ở `/truck/trips`, cùng việc nhập lại file đó qua `/truck/import`

## 1. Kết luận

| Hạng mục | Kết quả |
|---|---|
| Cột của template = cột của file xuất bỏ cột hệ thống (tên, đơn vị, thứ tự) | ✅ Khớp 100% ở vi / en / ko |
| Import tự nhận diện cột trên header template | ✅ 22/22 cột dữ liệu map đúng ở cả 3 ngôn ngữ |
| Import tự nhận diện cột trên header file xuất | ✅ 22/22 map đúng, không cột nào bị nhận nhầm |
| Nhập lại file xuất → dữ liệu giữ nguyên | ✅ với chuyến thông thường · ⚠️ 3 trường hợp biên lệch (mục 4) |
| Mô tả "24 cột" trong i18n và hướng dẫn sử dụng | ✅ Đúng |

**Hai file đã nhất quán về cột.** Còn 3 điểm lệch khi xuất rồi nhập lại, xảy ra ở dữ liệu biên chứ không phải do lệch cột. Ngoài ra có 1 điểm về cách dùng (cột Xe/Tài xế) cần nói rõ với người dùng.

## 2. Cách kiểm tra

Kiểm tra bằng **chính code của app**, không viết lại logic bằng tay:

- `packages/shared/src/zod/truck-import.zod.ts` được transpile và chạy nguyên bản. File này chứa `TRUCK_TRIP_SHEET_COLUMNS`, `TRUCK_TEMPLATE_COLUMNS`, `TRUCK_IMPORT_ALIASES`, `parseImportDate/Time/Number`, `splitImportExtraCosts`, `parseWallClockUtc`.
- File được ghi và đọc bằng thư viện `xlsx` của repo, cùng tham số với route (`aoa_to_sheet`, `bookType: 'xlsx'`) và với panel import (`cellDates: false`, `header: 1`).
- Nhãn cột lấy từ `apps/web/messages/{vi,en,ko}.json`, ghép giống `truckTripSheetHeader()`.
- Các phần nằm trong route, panel hoặc action được chép nguyên văn: bảng giá trị ô của export, `FIELDS` cùng thuật toán auto-map của panel, và `combineDateTime` của action.
- Dữ liệu chuyến là dữ liệu giả lập (4 chuyến). Không dùng DB prod.
- Chạy trong container `node:20-alpine` tạm, không mạng, mount repo chỉ-đọc.

Dữ liệu mẫu:

| Chuyến | Đặc điểm |
|---|---|
| TR-1 | Đủ mọi cột. Khách hàng có dấu phẩy. 3 khoản phát sinh, tên có dấu phẩy và dấu hai chấm (`Bến bãi, cổng`, `Vé: phà`). Lít lẻ 85,5 |
| TR-2 | Chạy qua nửa đêm (22:00 → 02:15 hôm sau). Lít 40,25. Đơn giá lẻ 21.480,6. Một khoản phát sinh không tên |
| TR-3 | Trạng thái IN_PROGRESS (đang chạy) |
| TR-4 | Phần lớn để trống, km đầu = 0 |

## 3. Bảng cột (vi; en/ko cùng thứ tự)

| # | File xuất (30 cột) | Template (24 cột) | Import đọc? |
|---|---|---|---|
| 1 | Mã chuyến | — (hệ thống) | — |
| 2 | Ngày | #1 | ✅ |
| 3 | Xe | #2 | ❌ chọn trên màn hình |
| 4 | Tài xế | #3 | ❌ chọn trên màn hình |
| 5–14 | Khách hàng · Số BOL · Số CDF · Giờ bắt đầu · Giờ kết thúc · Điểm lấy hàng · Điểm ghé · Điểm giao hàng · Km đầu (km) · Km cuối (km) | #4–#13 | ✅ |
| 15 | Tổng km | — (tự tính) | — |
| 16–24 | Phí cầu đường (đ) · Phí vệ sinh phương tiện (đ) · Phí sửa chữa (đ) · Phí cầu phà (đ) · Phí bốc dỡ hàng hóa (đ) · Chi phí phát sinh (đ) · Ghi chú phát sinh · Đơn giá (đ/L) · Lượng nhiên liệu (L) | #14–#22 | ✅ |
| 25 | Phí nhiên liệu thực tế (đ) | — (tự tính) | — |
| 26 | Doanh thu (đ) | #23 | ✅ |
| 27–29 | Tổng chi phí theo thực tế (đ) · Lợi nhuận theo thực tế (đ) · Trạng thái | — (tự tính) | — |
| 30 | Ghi chú chuyến | #24 | ✅ |

en: `Date · Vehicle · Driver · Customer · BOL No. · … · Revenue (VND) · Trip notes`
ko: `날짜 · 차량 · 기사 · 고객 · BOL 번호 · … · 매출 (VND) · 운행 메모`

Header file mẫu cũ 18 cột (`TRUCK_IMPORT_HEADERS`) vẫn tự map được, chỉ trừ "Xe (biển số)" (đúng thiết kế).

## 4. Điểm lệch khi xuất → nhập lại

| # | Trường hợp | Gốc | Sau khi nhập lại | Mức | Nguyên nhân |
|---|---|---|---|---|---|
| L1 | **Chuyến qua nửa đêm** | Kết thúc 07/08 02:15 | Kết thúc **06/08** 02:15, tức trước giờ bắt đầu | Trung bình | File chỉ có `HH:mm`. Import ghép giờ vào **Ngày** của chuyến (`combineDateTime`), nên mất ngày kết thúc |
| L2 | **Chuyến chưa hoàn tất** (đang chạy / chờ) có trong file xuất | IN_PROGRESS | **COMPLETED** | Trung bình | Import luôn tạo chuyến COMPLETED. File xuất không lọc trạng thái nếu người dùng không chọn bộ lọc |
| L3 | **Lít / đơn giá lẻ** | 40,25 L × 21.480,6 = 864.594 đ | 40,3 L × 21.481 = 865.684 đ (+1.090 đ) | Thấp | Export làm tròn lít 1 chữ số và đơn giá về số nguyên |
| L4 | Khoản phát sinh không tên | `Ăn đêm` 100.000 + (không tên) 40.000 | 1 khoản `Ăn đêm: 100.000` = 140.000 | Rất thấp | Ghi chú bỏ khoản không tên nên tổng không khớp và không tách lại được. Form/zod bắt buộc tên (`min(1)`), nên thực tế gần như không xảy ra |

TR-1 (tên có dấu phẩy và dấu hai chấm) và TR-4 (ô trống, km = 0) nhập lại **khớp 100%**.

## 5. Điểm cần lưu ý cho người dùng

- **Cột Xe / Tài xế trong template không được đọc.** Xe và tài xế chọn một lần trên màn Import cho **cả file**. File có nhiều xe sẽ dồn hết vào chiếc xe đã chọn. Hướng dẫn sử dụng đã ghi "chỉ để tham khảo", nhưng nên nhắc "mỗi file một xe".
- **Tên nút không thống nhất.** Danh sách chuyến có nút "Tải template" (en "Template", ko "양식"), màn Import có nút "Tải file mẫu" (en "Download template", ko "템플릿 다운로드"). Cùng một file nhưng hai tên. Chỉ là chữ, không ảnh hưởng số liệu.
- **Ghi chú phát sinh luôn định dạng số kiểu vi-VN** (`70.000`), kể cả file xuất bằng en/ko. Import đọc được bình thường.

## 6. Đề xuất

> **Cập nhật**: D1–D4 đã sửa ở `docs/bug-fix/FIX-261019-truck-template-export-roundtrip.md` (branch `fix/truck-trip-sheet-roundtrip-261019`). D5 chưa làm.

| # | Đề xuất | Giải quyết |
|---|---|---|
| D1 | Khi nhập, nếu giờ kết thúc < giờ bắt đầu thì cộng thêm 1 ngày cho thời điểm kết thúc | L1 |
| D2 | Bỏ hoặc cảnh báo dòng có cột Trạng thái khác "Hoàn tất" khi nhập lại file xuất. Hoặc mặc định xuất kèm `status=complete` khi dùng để nhập lại | L2 |
| D3 | Xuất lít 2 chữ số thập phân và giữ nguyên đơn giá (không làm tròn) | L3 |
| D4 | Thống nhất nhãn nút "Tải file mẫu" ở cả 2 màn hình | Nhãn |
| D5 | (Tuỳ chọn) Cho import đọc cột Xe theo từng dòng | File nhiều xe |

D1–D3 chạm logic import/export nên cần làm theo quy trình REQ → PLN → TC trước khi sửa.

## 7. Bằng chứng

- Script và kết quả: `/tmp/claude-1000/-home-ec2-user-ambAppStore/fdf5f399-37ec-404a-b87b-8b5f945e5361/scratchpad/parity/` (`run.mjs`, `result.json`, `out/template-{vi,en,ko}.xlsx`, `out/export-{vi,en,ko}.xlsx`)
- File code liên quan:
  - `packages/shared/src/zod/truck-import.zod.ts` — layout cột, alias, các hàm parse
  - `apps/web/src/server/lib/truck-trip-sheet.ts` — header dùng chung
  - `apps/web/src/app/(app)/truck/import/template/route.ts` — template
  - `apps/web/src/app/(app)/truck/trips/export/route.ts` — file xuất
  - `apps/web/src/app/(app)/truck/import/_components/truck-import-panel.tsx` — auto-map, đọc dòng
  - `apps/web/src/server/actions/imports/import.actions.ts` — tạo chuyến, `combineDateTime`, `splitImportExtraCosts`
