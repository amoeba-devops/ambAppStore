# BUG-261015 — File mẫu import chuyến xe tải không khớp file Xuất Excel

- **Ngày**: 2026-10-15
- **App**: app-car-manager-v2, phân hệ TRUCK
- **Branch**: `fix/truck-import-template-export-parity-261015` (từ `origin/staging` 126e30c)

## 1. Triệu chứng
File mẫu tải ở `/truck/import` ("Tải file mẫu chuẩn 18 cột") không cùng bộ cột với file **Xuất Excel** của Danh sách chuyến:

| # | Lệch | Hệ quả |
|---|------|--------|
| 1 | Template **thiếu 4 phí cố định** (vệ sinh, sửa chữa, cầu phà, bốc dỡ, REQ-20260916) và **Ghi chú chuyến**. Import cũng không đọc các cột này. | Nhập lại file xuất bị **mất 4 khoản phí + ghi chú**, nên tổng chi phí và lợi nhuận sai. |
| 2 | **Thứ tự cột khác nhau** (template: Ngày, Xe, Giờ BĐ…; export: Mã, Ngày, Xe, Tài xế, Khách, BOL, CDF…). | Không copy được dòng từ file xuất sang file mẫu. |
| 3 | **Đơn vị không thống nhất**: template ghi "Phí cầu đường", "Chi phí phát sinh", "Doanh thu" không kèm "(đ)", còn export có kèm. Template dùng "Xe (biển số)", export dùng "Xe". | Cùng một cột nhưng 2 file đặt tên khác nhau. |
| 4 | Export ghi "Ghi chú phát sinh" theo dạng `Tên: số tiền, Tên: số tiền`. Import lại gộp cả chuỗi làm **1 khoản** mang tên dài. | Mỗi lần xuất rồi nhập lại thì ghi chú dài thêm (`…: 70.000: 150.000`), chi tiết từng khoản bị mất. |

## 2. Nguyên nhân
- Template (`truck/import/template/route.ts`, theo `TRUCK_TEMPLATE_ORDER`) và export (`truck/trips/export/route.ts`, header viết tay) là **2 danh sách cột độc lập**. Khi REQ-20260916 thêm 4 phí vào export, template và import không được cập nhật theo.
- Export dựng header và dòng dữ liệu bằng 2 mảng song song. Thêm cột phải sửa đúng vị trí ở cả hai, rất dễ lệch.

## 3. Sửa
**Một nguồn layout duy nhất**: `TRUCK_TRIP_SHEET_COLUMNS` (`packages/shared/src/zod/truck-import.zod.ts`) — key i18n + đơn vị + `input:false` cho cột hệ thống.
- **Export** (30 cột, nội dung không đổi, đã kiểm tra trùng khớp 100% với bản cũ): header dựng từ spec, giá trị lấy theo **key** qua `Record<key, fn>`. TypeScript bắt buộc mọi cột đều có giá trị, nên header và dữ liệu không thể lệch nhau.
- **Template** (24 cột) = spec bỏ 6 cột hệ thống tự tính (Mã chuyến, Tổng km, Phí nhiên liệu thực tế, Tổng chi phí, Lợi nhuận, Trạng thái). Cùng tên, thứ tự và đơn vị với export. Xe/Tài xế giữ lại để tham khảo (chọn trên màn hình cho cả file, như trước).
- Helper `server/lib/truck-trip-sheet.ts` (`truckTripSheetHeader`) được cả 2 route dùng chung.
- **Import** đọc thêm `cleaning_fee`, `repair_fee`, `ferry_fee`, `loading_fee`, `notes` (zod + panel + action → `completeTruckTrip` / `createTruckTrip`, core đã hỗ trợ sẵn). Panel ánh xạ cột theo đúng thứ tự template.
- Alias nhận diện header (3 ngôn ngữ) cho 5 cột mới. Thêm `not: ['상하차']` cho cột Điểm giao để "상하차비" (phí bốc dỡ, ko) không bị nhận nhầm.
- `splitImportExtraCosts`: ghi chú dạng `Tên: số tiền, …` **mà tổng khớp** cột Chi phí phát sinh thì tách lại thành từng khoản. Không khớp thì giữ 1 khoản như cũ, nên file nhập tay không bị hiểu sai.
- i18n `templateDesc` "18 cột" → "24 cột" (vi/en/ko). Hướng dẫn sử dụng truck (nguồn `build-truck-guide.content.mjs` + HTML vi/ko) cập nhật mô tả cột.

## 4. File thay đổi
| Khu vực | File | Loại |
|---|---|---|
| shared | `packages/shared/src/zod/truck-import.zod.ts` | sửa |
| web | `src/server/lib/truck-trip-sheet.ts` | mới |
| web | `src/app/(app)/truck/import/template/route.ts` | sửa |
| web | `src/app/(app)/truck/trips/export/route.ts` | sửa (refactor, output không đổi) |
| web | `src/app/(app)/truck/import/_components/truck-import-panel.tsx` | sửa |
| web | `src/server/actions/imports/import.actions.ts` | sửa |
| i18n | `messages/{vi,en,ko}.json` | sửa (`templateDesc`) |
| guide | `scripts/build-truck-guide.content.mjs`, `public/docs/user-guide/{vi,ko}/truck-manager/11-import-excel.html` | sửa |

Không có migration DB (các cột `trp_*_fee`, `trp_notes`, `car_trip_extra_costs` đã có).

## 5. Kiểm chứng (dev server local, DB dev ep-steep-tooth)
- `tsc --noEmit` web + shared pass. Lint không có cảnh báo mới.
- Tải thật template + export (tháng 09/2026) ở **vi/en/ko**:
  - Template 24 cột = export 30 cột bỏ 6 cột hệ thống, **cùng nhãn, cùng thứ tự** ở cả 3 ngôn ngữ.
  - Mô phỏng tự map của panel trên header template **và** header export: 22/22 trường map đúng, không trùng cột.
- Export trước và sau refactor (vi, 09/2026): **nội dung giống hệt**.
- Round-trip qua UI `/truck/import`: lấy file xuất, đổi sang tháng nháp 11/2026, sửa phí sửa chữa/cầu phà/bốc dỡ + ghi chú chuyến, nhập lại rồi xuất lại.
  - Mọi cột người dùng nhập khớp 1:1 (ngày, giờ, km, 5 loại phí, phát sinh, đơn giá, lít, doanh thu, ghi chú chuyến). Chỉ mã chuyến và các cột tự tính thay đổi.
  - DB: `trp_cleaning/repair/ferry/loading_fee`, `trp_notes` có giá trị. `car_trip_extra_costs` = 3 khoản riêng (50.000 / 30.000 / 70.000), không còn 1 khoản gộp.
- Chuyến test TR-3005, TR-3006 (khách `RT-261015`) đã xoá mềm. Odometer xe không đổi.

## 6. Lưu ý
- **Positional fallback** (chỉ dùng khi hàng tiêu đề không khớp cột nào) nay theo thứ tự 24 cột mới. File cũ **có tiêu đề** vẫn map theo alias như trước.
- File mẫu cũ 18 cột vẫn nhập được (map theo tiêu đề). Chỉ là không có 4 phí + ghi chú chuyến.

## 7. Phòng tái phát
Thêm cột vào file chuyến xe tải thì chỉ sửa `TRUCK_TRIP_SHEET_COLUMNS`. TypeScript sẽ báo lỗi ở export route cho tới khi cột mới có giá trị. Cột người dùng nhập (không có `input:false`) tự động vào template. Cần thêm alias + field import tương ứng.
