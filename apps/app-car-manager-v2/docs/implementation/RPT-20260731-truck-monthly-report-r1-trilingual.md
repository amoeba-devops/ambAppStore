# RPT-20260731 — Báo cáo tháng xe tải: khớp form R1 (3 sheet VI/EN/KO)

## 1. Yêu cầu

Khách gửi bản revision **`Báo Cáo form (R1).xlsx`**. Yêu cầu: kiểm tra multi-language của app có
khớp form không, và **refactor cho giống file gửi**.

## 2. Hiện trạng trước khi sửa (AS-IS)

| Hạng mục | App (trước) | Form R1 |
|---|---|---|
| Số sheet | 1 sheet, ngôn ngữ chốt theo `NEXT_LOCALE` lúc bấm "Lập báo cáo" | **3 sheet**: `tiếng việt` · `English` · `Korean` |
| Nhãn sheet VI | song ngữ (`A.  DOANH THU  /  REVENUE`) | thuần Việt (`A.  DOANH THU`) |
| Tiêu đề | `TỔNG KẾT CHI PHÍ THÁNG \| MONTHLY SUMMARY` | `BÁO CÁO XE TRUCK HÀNG THÁNG` / `MONTHLY TRUCKING REPORT` / `월간 운송 보고서` |
| Câu chữ EN | ~60% khác R1 | — |
| Câu chữ KO | ~70% khác R1 | — |
| Cỡ chữ sheet KO | Arial, giống VI/EN | **Malgun Gothic**, title 20pt, section 11pt, KPI label 8pt bold |
| Độ rộng cột | 1 bộ (B=36) | 2 bộ: VI hẹp (B=24.44), EN/KO rộng (B=25.11, E/H/I lớn hơn) |
| Span ô KPI | B:C · D:E · F:G · H:J · K:L | VI: B:C · D:F · G:I · J:L — EN/KO: B:C · D:G · H:I · J:L |

## 3. Nội dung sửa (TO-BE)

### Backend / generator
- `truck-monthly-summary-workbook.ts`: tách thân hàm thành `writeSummarySheet()`, hàm public nhận
  `{ generatedAt, sheets: SummarySheetSpec[] }` → build **1 workbook 3 sheet**, dùng chung 1 ảnh logo.
- Bổ sung theo R1: bộ width theo ngôn ngữ (`WIDTHS_VI` / `WIDTHS_WIDE`), span KPI theo ngôn ngữ
  (`KPI_SPANS_VI` / `KPI_SPANS_WIDE`), typography theo ngôn ngữ (`TYPO_LATIN` / `TYPO_KO`).
- Ngày: dùng `dd/mm/yyyy` cố định cho **cả 3 sheet** (đúng R1) thay vì `toLocaleDateString` —
  tránh sheet EN đổi thành `05/31/2026`. Số vẫn theo locale của sheet.
- Sửa 2 chi tiết style lệch template: nhãn B16 không in đậm (chỉ số tiền đậm), nhãn trong
  `line()` luôn màu tối (trước đó nhãn bị nhuộm theo màu của giá trị ở B29/B33/B34).
- Header công ty (B2:B4) chuyển vào i18n vì R1 bỏ dấu địa chỉ ở sheet EN/KO; giữ Arial cho cả sheet KO.

### Action
- `truck-report.actions.ts`: bỏ `resolveUiLocale()` / cookie `NEXT_LOCALE` — file không còn phụ thuộc
  ngôn ngữ UI, luôn build cả 3 (`SUMMARY_LOCALES = ['vi','en','ko']`). Truyền thêm `{mn}` (tên tháng
  dạng chữ) để sheet EN in "May 2026".

### i18n (`exportContent.truckMonthlySummary`, 57 key × 3 file)
- Toàn bộ 54 nhãn cũ cập nhật theo câu chữ R1; thêm `companyName` / `companyAddress` / `companyContact`.
- `sheetName` = tên ngôn ngữ (`tiếng việt` / `English` / `Korean`) đúng như R1.
- `reports.formatSummaryHint` cập nhật: "3 sheet (VI / EN / KO)".

## 4. File thay đổi

| Loại | File | Thay đổi |
|---|---|---|
| BE | `apps/web/src/server/lib/truck-monthly-summary-workbook.ts` | Sửa — 3 sheet, layout/typography theo ngôn ngữ |
| BE | `apps/web/src/server/actions/truck-report.actions.ts` | Sửa — build 3 translator, bỏ phụ thuộc UI locale |
| i18n | `apps/web/messages/{vi,en,ko}.json` | Sửa — namespace `truckMonthlySummary` + hint |

## 5. Chỗ CỐ Ý khác R1 (cần khách xác nhận)

| # | Vị trí | R1 | App | Lý do |
|---|---|---|---|---|
| 1 | H37 (EN/KO) | `Fuel Cost (VND)` / `유류비 (VND)` | `Fuel (L)` / `연료 (L)` | Dữ liệu cột này là **số lít** (`421 L`) — nhãn R1 mâu thuẫn với dữ liệu. Sheet VI của R1 ghi đúng `Nhiên liệu` |
| 2 | Hàng 9 (EN/KO) | không merge, nhãn+giá trị dồn vào F9, người lập ở L9 | merge B9:D9 / E9:H9 / I9:L9 như sheet VI | Sheet VI của R1 là bản chuẩn; EN/KO bị lệch cấu trúc |
| 3 | Hàng 12–13 (EN/KO) | còn tiếng Việt/tiếng Anh chưa dịch (`5 xe`, `4 Active · 1 Under Maintenance`) | dịch đủ theo từng sheet | Không thể cố ý xuất chữ chưa dịch |
| 4 | Số ở EN/KO | dùng dấu VN (`8.240`, `Avg. 2.060 km`) | theo locale (`8,240`) | Sai chuẩn tách nghìn của EN/KO |
| 5 | Ô số | lưu dạng **text** (`'421 L'`, `'4.73 Km/l'`, `'(8,203,335) đ'`) | số thật + number format | Để SUM/recalc chạy được |
| 6 | E9 | không có khu vực | thêm ` · Khu vực X` | App xuất 1 file / (tháng × khu vực), cần ghi rõ phạm vi |
| 7 | B45 | 2 ô merge trống (B45:H45 / I45:L45) | dòng ghi chú "Số liệu tính lúc …" | Giữ dấu thời điểm chốt số |
| 8 | B38+ cột B | `Xe A` … `Xe E` | `{model} · {tài xế}` | App không có field "tên xe"; đã đảo thứ tự để đọc như tên xe theo header `Xe` |
| 9 | Ảnh | 2 logo (1 cái 212×154 nằm ngoài vùng in ở cột M) | 1 logo 185×70 ở cột K | Logo thứ 2 nằm ngoài layout, coi như sót |

## 6. Lỗi phát hiện trong chính form R1 (đã báo, không copy theo)

1. Tháng không thống nhất giữa 3 sheet: VI `Tháng 5 / 2026`, EN `June 2026`, KO `6월 2026년` — trong khi
   ngày lập cả 3 sheet đều `31/05/2026`.
2. `C34` (chi phí dầu/km) = 5.096 đ/km nhưng `64.200.000 ÷ 8.240 km = 7.791 đ/km` → số mẫu không khớp.
3. Cột H dán nhãn là chi phí nhưng dữ liệu là số lít (xem §5.1).
4. Sheet KO thiếu dịch: `B37 = 'Truck'`, `C43 = '5 Trucks'`, hàng 13 còn nguyên tiếng Anh.

## 7. Kiểm chứng

Render workbook bằng số liệu mẫu của R1 rồi diff từng ô với file khách (`openpyxl`):

| Kiểm tra | Kết quả |
|---|---|
| Tên + thứ tự sheet | `tiếng việt` · `English` · `Korean` — khớp |
| Toàn bộ nhãn 3 sheet | khớp R1 (trừ các mục cố ý ở §5) |
| Merge / width / row height | khớp cả 3 sheet (0 diff) |
| Font / cỡ chữ / in đậm / fill (B1:L43) | sheet VI: **0 diff**; EN/KO: chỉ còn 4 ô của §5.2 + C25/C28 lệch 0.5pt (lấy theo sheet VI) |
| Logo | có ở cả 3 sheet, dùng chung 1 media |
| `tsc --noEmit` | pass |
| `next lint` (2 file sửa) | pass |

Chưa test trên staging — cần bấm "Lập báo cáo" ở màn `/truck/reports` để kiểm tra file tải về.

---

# Phần 2 — Rà soát tên báo cáo / tên file theo ngôn ngữ lúc export

## 8. Kết quả rà soát

| # | Nơi sinh tên | Trước | Sau |
|---|---|---|---|
| 1 | Tên file tải về của báo cáo tháng (`/truck/reports/{id}/download`) | ✅ đã dịch theo `NEXT_LOCALE` (`screens.truckReports.fileName_*`) | giữ nguyên, đổi sang helper `resolveUiLocale()` |
| 2 | **Tên báo cáo trong danh sách (`trr_name`)** | ❌ hard-code tiếng Việt (`REPORT_NAME`) | ✅ dịch theo ngôn ngữ lúc bấm "Lập báo cáo" |
| 3 | Export chi phí chuyến (`/truck/finance/export`) | ❌ `truck-finance-2026-05.xlsx` | ✅ `BaoCao_ChiPhiChuyen_T5_2026` / `Trip_Costs_2026-05` / `운행비용_2026-05` |
| 4 | Export P&L nhanh (`/truck/pnl/export`, xlsx + pdf) | ❌ `truck-pnl-2026-05` | ✅ `BaoCao_LoiNhuan_T5_2026` / `PnL_2026-05` / `손익_2026-05` |
| 5 | Export danh sách chuyến (`/truck/trips/export`) | ❌ `truck-trips-2026-05.xlsx` | ✅ `DanhSachChuyen_T5_2026` / `Trip_List_2026-05` / `운행목록_2026-05` |
| 6 | Template import (`/truck/import/template`) | `CR-Vietnam-Truck-v1.xlsx` | ✅ `CR-Vietnam-Truck-v1_Mau-Nhap-Chuyen` / `..._Import-Template` / `..._가져오기-양식` — giữ token định dạng ở đầu |
| 7 | **Tên tab sheet** của 4 file export truck | `TruckFinance`, `P&L`, `TruckTrips`, `TripLog` | ✅ dịch 3 ngôn ngữ |
| 8 | Export bên workspace CAR (`/api/v1/{reports,expenses,trips,audit}/export`) | `reports-2026-07-31.csv` … | **KHÔNG làm** — user chốt chỉ scope truck (2026-07-31) |

Ghi chú #6: `CR-Vietnam-Truck-v1` là token định dạng có nêu trong user guide (vi+ko) và
`truckImport.templateDesc` → giữ ở đầu tên file. Việc upload lại KHÔNG phụ thuộc tên file hay tên tab
(parser quét mọi sheet và khớp theo hàng header), đã kiểm tra `truck-import-panel.tsx`.

Ghi chú #5: tên cũ của export này trùng với báo cáo `TRIP_LOG` chính thức (`Trip_Log_2026-05`) → đã đổi
thành "danh sách chuyến" để 2 file không đè nhau trong Downloads.

## 9. Cách hoạt động sau khi sửa

- Ngôn ngữ = cookie `NEXT_LOCALE` (do switcher ở sidebar / login / settings ghi) — cùng cách resolve
  với `i18n/request.ts`, gom vào helper mới `src/i18n/ui-locale.ts`.
- Bấm "Lập báo cáo" ở UI tiếng Hàn → `trr_name` lưu `월간 비용 요약 · HCM 지역`, và file auto-download
  ngay sau đó tên `차량비용보고서_2026-05_HCM.xlsx` (wizard gọi lại đúng route `/download`).
- Tên file luôn tính lúc **tải**, nên bấm tải lại 1 báo cáo cũ ở UI tiếng Anh sẽ ra tên tiếng Anh.
- `trr_name` thì lưu cố định lúc lập → báo cáo do người khác lập bằng tiếng Việt vẫn hiện tiếng Việt
  trong danh sách. **Đây là hành vi anh yêu cầu (bind lúc export).** Nếu muốn danh sách luôn theo
  ngôn ngữ người đang xem thì phải bỏ `trr_name`, render từ `trr_type` + `trr_region` lúc hiển thị —
  nói 1 tiếng tôi đổi.
- Bản ghi tạo trước 2026-07-31 giữ tên tiếng Việt cũ (giá trị đã lưu, không render lại).

## 10. File thay đổi (phần 2)

| Loại | File | Thay đổi |
|---|---|---|
| BE | `apps/web/src/i18n/ui-locale.ts` | **Mới** — `resolveUiLocale()` dùng chung |
| BE | `apps/web/src/server/lib/export-file-name.ts` | **Mới** — `exportFileName()` + `attachment()` (RFC 5987) |
| BE | `apps/web/src/server/actions/truck-report.actions.ts` | `reportName()` theo i18n thay `REPORT_NAME` |
| BE | `apps/web/src/app/(app)/truck/reports/[id]/download/route.ts` | dùng helper locale chung |
| BE | `apps/web/src/app/(app)/truck/{finance,pnl,trips}/export/route.ts` | tên file + tên tab theo i18n |
| BE | `apps/web/src/app/(app)/truck/import/template/route.ts` | tên file + tên tab theo i18n |
| i18n | `apps/web/messages/{vi,en,ko}.json` | `truckReports.nameScopeRegion` · `truckFinance/truckPnl/truckTrips/truckImport`: `fileName` (+ `fileNameMonth`) + `sheetName` |

## 11. Ma trận tên sau khi sửa (tháng 5/2026, khu vực HCM)

| | VI | EN | KO |
|---|---|---|---|
| Tên trong danh sách | `Tổng kết chi phí tháng · Khu vực HCM` | `Monthly cost summary · HCM region` | `월간 비용 요약 · HCM 지역` |
| File báo cáo tháng | `BaoCao_DoiXe_T5_2026_HCM_Report` | `Fleet_Cost_Report_2026-05_HCM` | `차량비용보고서_2026-05_HCM` |
| Chi phí chuyến (tab) | `BaoCao_ChiPhiChuyen_T5_2026` (Chi phí chuyến) | `Trip_Costs_2026-05` (Trip costs) | `운행비용_2026-05` (운행 비용) |
| P&L nhanh (tab) | `BaoCao_LoiNhuan_T5_2026` (Lợi nhuận) | `PnL_2026-05` (P&L) | `손익_2026-05` (손익) |
| Danh sách chuyến (tab) | `DanhSachChuyen_T5_2026` (Danh sách chuyến) | `Trip_List_2026-05` (Trip list) | `운행목록_2026-05` (운행 목록) |
| Template import (tab) | `CR-Vietnam-Truck-v1_Mau-Nhap-Chuyen` (Nhật ký chuyến) | `..._Import-Template` (Trip log) | `..._가져오기-양식` (운행 일지) |

Kiểm chứng: `tsc --noEmit` pass · `next lint` (8 file) pass · key vi/en/ko parity pass · render đủ
4 loại báo cáo × 3 ngôn ngữ + 4 export ad-hoc; không trùng tên; mọi tên tab hợp lệ với Excel
(≤31 ký tự, không chứa `[]:*?/\`).

---

# Phần 3 — Dịch nội dung 3 export ad-hoc của truck

## 12. Nội dung đã dịch

Namespace mới `exportContent.truck{Finance,Pnl,Trips}` (theo đúng tiền lệ `exportContent.trips` của
workspace CAR) — **54 key × 3 ngôn ngữ**, lấy locale từ `resolveUiLocale()` giống tên file:

| Export | Đã dịch | Ghi chú |
|---|---|---|
| `/truck/finance/export` | 13 tiêu đề cột + 2 trạng thái (`Đã lập BC`/`Tạm tính`) + tên tab | trạng thái EN/KO lấy đúng chữ đang dùng trên UI (`Closed`/`Provisional`, `마감`/`잠정`) |
| `/truck/pnl/export` (xlsx + pdf) | 10 nhãn dòng + `Hạng mục` + nhãn tháng + tiêu đề PDF + tên section + tên tab | số trong PDF format theo locale (`toLocaleString(bcp47(locale))`) thay vì cứng `vi-VN` |
| `/truck/trips/export` | 25 tiêu đề cột + cột Trạng thái (dịch qua `exportContent.status`) + tên tab | **bỏ tiêu đề song ngữ** `Ngày / Date` → mỗi file 1 ngôn ngữ, đồng bộ hướng của mẫu R1 |

Đơn vị tiền trong tiêu đề: sheet VI dùng `(đ)`, EN/KO dùng `(VND)` — giống cách R1 làm.
Cột ngày vẫn ghi ISO `YYYY-MM-DD` (để Excel mọi máy parse được), không đổi theo locale.

### Dedupe kèm theo
- `bcp47()` + `monthName()` chuyển vào `src/i18n/ui-locale.ts` (trước đó `truck-report.actions.ts` tự
  giữ 1 bản `BCP47` riêng).
- `attachment()` tách ra `src/server/lib/content-disposition.ts` và **dùng luôn trong
  `excelResponse()` / `pdfResponse()`** — 2 hàm này trước đây nhét thẳng tên file vào `filename="…"`,
  với tên tiếng Hàn/tiếng Việt là header không hợp lệ (phần `filename*=UTF-8''` vẫn đúng nên trình
  duyệt hiện đại không lỗi, nhưng nay đã sạch cả 2 tham số).

## 13. File thay đổi (phần 3)

| Loại | File | Thay đổi |
|---|---|---|
| BE | `apps/web/src/server/lib/content-disposition.ts` | **Mới** — `attachment()` RFC 5987 |
| BE | `apps/web/src/server/lib/{excel,pdf}.ts` | dùng `attachment()` chung |
| BE | `apps/web/src/i18n/ui-locale.ts` | thêm `bcp47()`, `monthName()` |
| BE | `apps/web/src/app/(app)/truck/{finance,pnl,trips}/export/route.ts` | nội dung sheet theo i18n |
| BE | `apps/web/src/server/actions/truck-report.actions.ts` | dùng `bcp47()`/`monthName()` chung |
| i18n | `apps/web/messages/{vi,en,ko}.json` | `exportContent.truck{Finance,Pnl,Trips}` (54 key/ngôn ngữ); `sheetName` chuyển từ `screens.*` sang `exportContent.*` |

Kiểm chứng: `tsc --noEmit` pass · `next lint` pass · key parity vi/en/ko pass · script đối chiếu
54 key mà 3 route thật sự gọi đều tồn tại ở cả 3 ngôn ngữ (kể cả 7 giá trị `CarTripStatus`) ·
PDF dùng font Pretendard nên tiếng Hàn/tiếng Việt hiển thị được.

## 14. Còn tồn

Báo cáo 3-sheet `PNL / TRIP_LOG / VEHICLE` (`truck-report-workbook.ts`) vẫn tiếng Việt theo thiết kế
(tài liệu vận hành nội bộ cho công ty VN, đã ghi trong comment từ REQ-20260713). Export bên workspace
CAR: không làm theo yêu cầu ngày 2026-07-31.
