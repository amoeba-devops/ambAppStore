# FIX-261019 — File Xuất Excel ↔ File mẫu chuyến xe tải: nhập lại không giữ nguyên dữ liệu

- **Ngày**: 2026-10-19
- **App**: app-car-manager-v2, phân hệ TRUCK
- **Branch**: `fix/truck-trip-sheet-roundtrip-261019` (từ `origin/staging` 197b48c3)
- **Liên quan**: BUG-261015 (đồng bộ cột template ↔ export), TR-20261019 (đối chiếu)

## 1. Triệu chứng

Cột của 2 file đã khớp từ BUG-261015. Nhưng khi đối chiếu lại (TR-20261019), file **Xuất Excel** nhập lại qua `/truck/import` vẫn không ra đúng chuyến ban đầu:

| # | Trường hợp | Gốc | Sau khi nhập lại |
|---|---|---|---|
| L1 | Chuyến qua nửa đêm | Kết thúc 07/08 02:15 | Kết thúc **06/08** 02:15, tức trước giờ bắt đầu |
| L2 | Chuyến chưa hoàn tất có trong file xuất | IN_PROGRESS | Thành **COMPLETED**, kèm chi phí và doanh thu vào P&L |
| L3 | Lít / đơn giá lẻ | 40,25 L × 21.480,6 = 864.594 đ | 40,3 L × 21.481 = 865.684 đ |
| L5 | Nút tải file mẫu | Danh sách chuyến: "Tải template" | Màn Import: "Tải file mẫu", tức một file mà hai tên |

## 2. Nguyên nhân

- **L1**: file chỉ có giờ `HH:mm`. `combineDateTime` (import action) ghép cả giờ bắt đầu lẫn giờ kết thúc vào **Ngày** của dòng, không xử lý trường hợp kết thúc sang ngày hôm sau.
- **L2**: import luôn tạo chuyến COMPLETED nhưng **không đọc** cột Trạng thái. File xuất lại chứa mọi trạng thái nếu danh sách không lọc.
- **L3**: export làm tròn `fuelPrice` về số nguyên và `fuelLiters` về 1 chữ số thập phân, trong khi DB lưu scale 2 (`trp_fuel_price`, `trp_fuel_liters` = `decimal(…, 2)`).
- **L5**: `screens.truckTrips.template` và `screens.truckImport.downloadTemplate` là 2 khoá i18n với chữ khác nhau.

## 3. Sửa

| # | Nơi sửa | Nội dung |
|---|---|---|
| L1 | `packages/shared/src/zod/truck-import.zod.ts` → `importTripTimes()` (mới) | Giờ kết thúc < giờ bắt đầu thì kết thúc ở **ngày hôm sau** (+24h). Thay `combineDateTime` riêng trong action. Không có giờ bắt đầu thì giữ như cũ |
| L2 | shared: alias `status` + `TRUCK_IMPORT_COMPLETED_STATUS` + `isImportableTripStatus()` · panel: trường `status` trong `FIELDS` | Panel tự map cột Trạng thái (vi/en/ko, không phụ thuộc ngôn ngữ người nhập). Dòng có trạng thái khác "Hoàn tất / Completed / 완료" bị **bỏ qua**, hiện lý do "Chưa hoàn tất — bỏ qua". Ô trống (template nhập tay) vẫn nhập bình thường |
| L3 | `apps/web/src/app/(app)/truck/trips/export/route.ts` | Xuất `Đơn giá` và `Lượng nhiên liệu` đủ 2 chữ số thập phân, đúng scale DB |
| L5 | `messages/{vi,en,ko}.json` | `screens.truckTrips.template` = "Tải file mẫu" / "Download template" / "템플릿 다운로드", giống màn Import |
| — | `messages/{vi,en,ko}.json` | `invalidRows` "{n} dòng lỗi" → "{n} dòng bỏ qua" (en "skipped", ko "제외"), vì gồm cả dòng thiếu ngày và dòng chưa hoàn tất. Thêm `rowNotCompleted` |
| — | Hướng dẫn sử dụng (`scripts/build-truck-guide.content.mjs`, HTML vi/ko trang 11) | Bổ sung 3 quy tắc trên |

**Không đổi**: bộ cột, thứ tự, nhãn của cả 2 file; công thức Phí nhiên liệu thực tế / Tổng chi phí / Lợi nhuận; dữ liệu đã có trong DB. Không có migration.

## 4. File thay đổi

| Khu vực | File | Loại |
|---|---|---|
| shared | `packages/shared/src/zod/truck-import.zod.ts` | sửa |
| web | `apps/web/src/server/actions/imports/import.actions.ts` | sửa |
| web | `apps/web/src/app/(app)/truck/import/_components/truck-import-panel.tsx` | sửa |
| web | `apps/web/src/app/(app)/truck/trips/export/route.ts` | sửa |
| i18n | `apps/web/messages/{vi,en,ko}.json` | sửa |
| guide | `scripts/build-truck-guide.content.mjs`, `apps/web/public/docs/user-guide/{vi,ko}/truck-manager/11-import-excel.html` | sửa |

## 5. Kiểm chứng

- `tsc --noEmit`: `packages/shared` ✅, `apps/web` ✅.
- ESLint 3 file sửa: 0 lỗi. 1 cảnh báo `no-unused-vars` cho biến bóc tách `_issue`. Cảnh báo này có sẵn từ trước với tên `_valid`, nên số cảnh báo không tăng.
- Script round-trip chạy **chính code shared** (transpile `truck-import.zod.ts`) và thư viện `xlsx` của repo, ở vi / en / ko, với 4 chuyến mẫu:

| Kiểm tra | Trước | Sau |
|---|---|---|
| Template = export bỏ 6 cột hệ thống | ✅ | ✅ |
| Auto-map template / export | 22/22 | 22/22 + cột Trạng thái map đúng trên file xuất, không xuất hiện trên template |
| L1 — TR-2 (22:00 → 02:15 hôm sau) | ❌ kết thúc lùi 1 ngày | ✅ đúng 07/08 02:15 |
| L2 — TR-3 IN_PROGRESS | ❌ nhập thành COMPLETED | ✅ bỏ qua, có lý do |
| L3 — TR-2 40,25 L × 21.480,6 | ❌ lệch +1.090 đ | ✅ khớp 864.594 đ |
| TR-1 (tên phí có `,` và `:`), TR-4 (ô trống, km = 0) | ✅ | ✅ |
| Nhãn "Hoàn tất" của cả 3 ngôn ngữ có trong `TRUCK_IMPORT_COMPLETED_STATUS` | — | ✅ |

- **Chưa kiểm** trên UI thật (dev server / staging) và DB, vì máy này là prod, không có Node trên host. Cần chạy TC ở mục 7 trên staging trước khi lên prod.

## 6. Còn lại (chưa sửa, có chủ đích)

- **Khoản phát sinh không tên**: bị bỏ khỏi "Ghi chú phát sinh", nên nhập lại thành 1 khoản gộp. Form và zod bắt buộc tên (`min(1)`), nên dữ liệu tạo qua UI không gặp.
- **Cột Xe / Tài xế** vẫn chỉ để tham khảo: mỗi file một xe + một tài xế (đúng thiết kế, hướng dẫn đã ghi).
- "Ghi chú phát sinh" luôn định dạng số vi-VN (`70.000`) ở mọi ngôn ngữ. Import đọc được nên không ảnh hưởng.

## 7. Kiểm thử trên staging

1. Danh sách chuyến: nút đầu tiên hiện **"Tải file mẫu"** (en "Download template", ko "템플릿 다운로드").
2. Tạo chuyến qua nửa đêm (bắt đầu 22:00, kết thúc 02:15) → Xuất Excel → Import vào tháng nháp → chi tiết chuyến: giờ kết thúc là **ngày hôm sau** 02:15.
3. Danh sách có 1 chuyến đang chạy → Xuất Excel (không lọc) → Import: dòng đó đỏ **"Chưa hoàn tất — bỏ qua"**, nút "Nhập N dòng" không tính dòng đó.
4. Chuyến có lít 40,25 và đơn giá 21.480,6 → Xuất: hiện đúng 40,25 / 21480,6 → Import lại: Phí nhiên liệu thực tế giống bản gốc.
5. File mẫu tự điền (không có cột Trạng thái) → nhập bình thường như trước.
6. Xoá mềm các chuyến test sau khi kiểm.

## 8. Phòng tái phát

- Cột mới của file chuyến: chỉ sửa `TRUCK_TRIP_SHEET_COLUMNS` (BUG-261015). Nếu là cột hệ thống mà import cần biết (như Trạng thái), thêm alias và trường trong `FIELDS`.
- Giá trị số trong export phải giữ đúng **scale lưu DB**. Chỉ làm tròn ở màn hình, không làm tròn trong file dùng để nhập lại.
- Thêm trạng thái mới hoặc đổi nhãn `exportContent.status.COMPLETED` thì cập nhật `TRUCK_IMPORT_COMPLETED_STATUS`.
