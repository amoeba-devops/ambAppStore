# FIX-261126 — Truck: file Xuất Excel chuyến đi thiếu cột "Khu vực"

## Triệu chứng
Trang **Danh sách chuyến đi (Truck)** hiển thị cột **Khu vực**, nhưng file **Xuất Excel**
(`/truck/trips/export`) không có cột này → xuất nhiều khu vực cùng lúc thì không phân biệt
được chuyến nào thuộc khu vực nào. User báo "file tải về không khớp các field ở bảng".

## Kiểm tra đối chiếu (bảng ↔ file mẫu ↔ file xuất)
Trang có 2 file tải về: **Tải file mẫu** (`/truck/import/template`, 24 cột) và **Xuất Excel**
(30 cột → 31 sau sửa). Cả hai cắt từ cùng một layout `TRUCK_TRIP_SHEET_COLUMNS` (BUG-261015).

- File mẫu ↔ file xuất: khớp — cùng thứ tự, cùng nhãn/đơn vị; file xuất chỉ thêm các cột
  hệ thống tính (Mã chuyến, Khu vực, Tổng km, Phí nhiên liệu thực tế, Tổng chi phí, Lợi nhuận,
  Trạng thái).
- Bảng là bản rút gọn (cố ý): gộp 5 phí thành "Phí cố định & phát sinh", ẩn CDF/giờ/điểm/odo/
  đơn giá/lít/doanh thu/ghi chú. Cột chỉ có trên bảng: STT, Cập nhật, Hành động (UI).
- Chênh lệch thật duy nhất: **Khu vực** có trên bảng, không có trong file xuất.

Đã xác nhận bundle đang chạy (container `next-car-manager-v2`, build 2026-10-20) có cùng layout
cột với `main`.

## Nguyên nhân
Cột Khu vực (QA P2, `cvh_region`) được thêm vào bảng nhưng không được thêm vào
`TRUCK_TRIP_SHEET_COLUMNS`, nên file xuất không có.

## Sửa
- Thêm `{ key: 'region', input: false }` ngay sau `vehicle` trong `TRUCK_TRIP_SHEET_COLUMNS`.
  `input: false` → chỉ có ở file xuất; **file mẫu không đổi** (khu vực đi theo xe chọn khi nhập).
- Export route điền ô bằng nhãn i18n `region.*` (giống bảng); mã lạ in nguyên văn.
- Nhãn cột dùng `columns.truck.region` đã có sẵn ở vi/en/ko (Khu vực / Region / 지역).

## Kiểm tra
- `tsc --noEmit` cho `packages/shared` và `apps/web`: OK.
- Mô phỏng auto-map của màn Nhập Excel (`TRUCK_IMPORT_ALIASES`, so khớp chuỗi con + danh sách
  `not`) trên tiêu đề file mẫu và file xuất ở cả vi/en/ko: mọi trường nhập đều map đúng cột,
  cột "Khu vực / Region / 지역" không bị bắt nhầm → file xuất vẫn nhập lại được.

## File thay đổi
- `packages/shared/src/zod/truck-import.zod.ts` — thêm cột `region` (export-only)
- `apps/web/src/app/(app)/truck/trips/export/route.ts` — giá trị ô `region`

## Phòng tái phát
Cột mới trên bảng danh sách chuyến đi mà có ý nghĩa dữ liệu → thêm vào
`TRUCK_TRIP_SHEET_COLUMNS` (kiểu `Record` trong export route bắt buộc phải có giá trị ô),
và kiểm tra alias import không bắt nhầm nhãn mới ở cả 3 ngôn ngữ.
