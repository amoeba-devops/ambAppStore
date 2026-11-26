# FIX-261126 — Truck: thống nhất tên, thứ tự và kiểu dữ liệu cột giữa Danh sách chuyến đi ↔ File xuất ↔ File mẫu

## Triệu chứng
Sau PR #212 (bảng tách 5 cột phí + cột Tổng chi phí), đối chiếu bảng **Danh sách chuyến đi (Truck)**
với **Xuất Excel** (`/truck/trips/export`) và **Tải file mẫu** (`/truck/import/template`) thấy:

| # | Chỗ lệch | Bảng (trước) | File xuất (trước) |
|---|---|---|---|
| 1 | Vị trí cột Phí nhiên liệu thực tế | trước "Phí cầu đường" | sau "Ghi chú phát sinh · Đơn giá · Lượng nhiên liệu" |
| 2 | Tên cột Tổng chi phí / Lợi nhuận | "Tổng chi phí" | "Tổng chi phí theo thực tế (đ)" / "Lợi nhuận theo thực tế (đ)" |
| 3 | Chữ trạng thái | "Đã hoàn thành / Chưa hoàn thành" | "Hoàn tất / Đang di chuyển / Đã xác nhận…" |
| 4 | Tên cột Khách hàng | "Khách hàng · BOL" (key riêng `thCustomer`) | "Khách hàng" + "Số BOL" |

User yêu cầu: cùng một trường thì tên không được khác nhau; file mẫu phải khớp cả tên cột lẫn kiểu dữ liệu.

Kiểu dữ liệu (trước):
- File xuất ghi **Ngày / Giờ dạng chữ** ("2026-11-26", "08:30"), tiền là số thô không định dạng.
- File mẫu chỉ có dòng tiêu đề, **không định dạng cột** → người dùng gõ 26/11/2026 thành ngày thật của Excel
  (khác kiểu với file xuất), gõ BOL "0123" bị Excel đổi thành số 123 (mất số 0).
- Màn Nhập Excel: bảng xem trước dùng key nhãn riêng (`screens.truckImport.colDate/colCustomer/f.revenue`);
  bộ `f.*` còn tên cũ ("Đồng hồ đầu", "Phát sinh khác"…) lệch glossary.

File mẫu ↔ file xuất vốn đã khớp (cùng `TRUCK_TRIP_SHEET_COLUMNS`), chỉ lệch giữa bảng và file.

## Nguyên nhân
- Bảng tự xếp thứ tự cột chi phí, không theo `TRUCK_TRIP_SHEET_COLUMNS`.
- `truckTripSheetHeader()` đặc cách Tổng chi phí / Lợi nhuận dùng key `exportContent.truckTrips.colTotalCost/colProfit`
  thay vì glossary `columns.truck` như mọi cột khác.
- File xuất in trạng thái bằng `exportContent.status.*` (theo enum), còn bảng dùng `screens.truckTrips.statusDone/statusOpen`.
- Header Khách hàng trên bảng dùng key riêng thay vì ghép từ glossary.

## Sửa
1. **Bảng** (`truck/trips/page.tsx`): cột chi phí theo đúng thứ tự file xuất —
   Phí cầu đường → 4 phí cố định → Chi phí phát sinh → **Phí nhiên liệu thực tế** → Tổng chi phí
   (bảng desktop + thẻ mobile). Header Khách hàng = `columns.truck.customer · columns.truck.bol`
   → "Khách hàng · Số BOL".
2. **File xuất**: Tổng chi phí / Lợi nhuận dùng glossary + đơn vị như mọi cột
   (`unit: 'unitMoney'` trong `TRUCK_TRIP_SHEET_COLUMNS`) → "Tổng chi phí (đ)", "Lợi nhuận (đ)".
   Xoá key không còn dùng `exportContent.truckTrips.colTotalCost/colProfit` (vi/en/ko).
3. **File xuất**: cột Trạng thái in đúng chữ của bảng (`screens.truckTrips.statusDone/statusOpen`).
4. **Import**: `TRUCK_IMPORT_COMPLETED_STATUS` thêm `'đã hoàn thành'` (giữ `'hoàn tất'` cho file xuất cũ)
   → nhập lại file xuất mới vẫn nhận đúng dòng hoàn tất; "Chưa hoàn thành / Open / 미완료" bị bỏ qua như trước.

5. **Kiểu dữ liệu dùng chung**: `TRUCK_TRIP_SHEET_COLUMNS` thêm `type` cho mỗi cột
   (`text | date | time | int | money | decimal`). Hàm mới `buildTruckTripWorkbook()` (ExcelJS,
   `server/lib/truck-trip-workbook.ts`) dựng **cả file mẫu lẫn file xuất**:
   - định dạng theo cột: Ngày `dd/mm/yyyy`, Giờ `hh:mm`, km `#,##0`, tiền `#,##0`, đơn giá / lít `#,##0.00`,
     cột mã/chữ (BOL, CDF, khách hàng, điểm, ghi chú…) là Text `@`; dòng tiêu đề in đậm + cố định;
   - file mẫu: dòng trống đã mang sẵn định dạng cột → gõ vào ra đúng kiểu như file xuất;
   - file xuất: ngày / giờ ghi thành giá trị ngày-giờ thật của Excel (sort / lọc được), số giữ là số.
6. **Màn Nhập Excel**: bảng xem trước dùng glossary `columns.truck`; xoá key thừa
   `screens.truckImport.colDate / colCustomer / colRevenue / f` (vi/en/ko).

Cột chỉ có trên bảng (STT, Cập nhật, Hành động) và chỉ có trong file (CDF, giờ, điểm, odo, đơn giá, lít,
doanh thu, ghi chú…) giữ nguyên — tên các cột chung giờ giống hệt nhau.

## Kiểm tra
- `tsc --noEmit` `apps/web` (container node:20-alpine): OK.
- Mô phỏng auto-map màn Nhập Excel (`TRUCK_IMPORT_ALIASES`) trên header file mẫu (24 cột) và file xuất
  (31 cột) ở vi/en/ko: 23/23 trường map đúng cột, "Tổng chi phí (đ)" / "Lợi nhuận (đ)" không bị bắt nhầm.
- Dựng file xuất mẫu (31 cột, gồm chuyến qua đêm 22:05→02:15, BOL "0123", đơn giá 21.350,5) rồi đọc lại
  đúng như màn Nhập Excel (SheetJS `cellDates: false` + parseImportDate/Time/Number): 31/31 ô khớp giá trị gốc.
- Kiểm tra XML file mẫu + file xuất: `<col style>` đúng định dạng từng cột, header cố định (`ySplit=1`).
- `statusDone` ở cả 3 ngôn ngữ (Đã hoàn thành / Completed / 완료) đều thuộc `TRUCK_IMPORT_COMPLETED_STATUS`.

## File thay đổi
- `packages/shared/src/zod/truck-import.zod.ts` — `type` từng cột; unit cho totalCost/profit; thêm 'đã hoàn thành'
- `apps/web/src/server/lib/truck-trip-sheet.ts` — bỏ đặc cách header Tổng chi phí / Lợi nhuận
- `apps/web/src/app/(app)/truck/trips/export/route.ts` — trạng thái theo chữ của bảng; dùng builder chung
- `apps/web/src/app/(app)/truck/trips/page.tsx` — thứ tự cột chi phí, header Khách hàng
- `apps/web/src/server/lib/truck-trip-workbook.ts` — **mới**: dựng .xlsx có kiểu dữ liệu theo cột
- `apps/web/src/app/(app)/truck/import/template/route.ts` — dùng builder chung (bỏ SheetJS)
- `apps/web/src/app/(app)/truck/import/_components/truck-import-panel.tsx` — header xem trước theo glossary
- `apps/web/messages/{vi,en,ko}.json` — xoá `exportContent.truckTrips.colTotalCost/colProfit`,
  `screens.truckImport.colDate/colCustomer/colRevenue/f`

## Phòng tái phát
- Header bảng / file mẫu / file xuất chỉ lấy từ glossary `columns.truck` — không thêm key nhãn riêng cho từng màn.
- Cột chung giữa bảng và file phải theo thứ tự `TRUCK_TRIP_SHEET_COLUMNS`.
- Kiểu dữ liệu của cột chỉ khai báo ở `type` trong `TRUCK_TRIP_SHEET_COLUMNS`; file mẫu và file xuất
  luôn dựng qua `buildTruckTripWorkbook()`, không tự `aoa_to_sheet` riêng.
- Đổi chữ trạng thái trên bảng → cập nhật `TRUCK_IMPORT_COMPLETED_STATUS`.
