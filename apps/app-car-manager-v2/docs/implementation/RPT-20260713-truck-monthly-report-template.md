# RPT-20260713 — Work Report: Truck Monthly Summary report (export theo template khách)

| | |
|---|---|
| **Ngày** | 2026-07-13 |
| **Tài liệu** | [REQ](../analysis/REQ-20260713-truck-monthly-report-template.md) · [PLAN](../plan/PLAN-20260713-truck-monthly-report-template.md) · [TC](../test/TC-20260713-truck-monthly-report-template.md) · [TR](../test/TR-20260713-truck-monthly-report-template.md) |
| **Trạng thái** | ✅ Code + unit-verify xong; ⏳ chờ E2E staging + xác nhận khách (4 câu hỏi mở REQ §7) |

## 1. Đã làm
Thêm định dạng báo cáo thứ 4 **`MONTHLY_SUMMARY`** ("Tổng kết chi phí tháng") — 1 sheet Excel song ngữ có công thức, khớp **từng ô** template khách gửi (`BaoCao_DoiXe_T5_2026_Report.xlsx`). Mọi số lấy từ core hiện tại (`computeTruckPnl` + snapshot nhiên liệu), aggregate bằng công thức Excel `SUM`/`IFERROR`.

**Khớp 100% hình thức** (theo yêu cầu bổ sung): trích xuất style thật từ template rồi dựng lại y hệt — font **Arial**, header **navy `#1F3A5F`** chữ trắng, **banding dòng xen kẽ** (`#F0F4F8`/trắng), viền hairline `#DEE2E6`, dòng TỔNG viền hộp indigo `#A5B4FC`, đúng độ rộng cột & chiều cao dòng & vùng merge, số định dạng `#,##0`/`0.00" km/L"`/`#,##0" đ/km"`, màu trạng thái (xanh Có lãi / đỏ Lỗ / hổ phách Bảo dưỡng). **Logo Cargo Rush** (185×70) nhúng góc phải trên qua base64 (`truck-report-logo.ts`). Tên/địa chỉ/tel-fax công ty **cố định theo template** (quyết định user 2026-07-14) — chỉ map động thông tin app có (người lập = user hiện tại, ngày lập, tháng/khu vực, số liệu).

## 2. Quyết định áp dụng (theo khuyến nghị REQ §3.5)
- **QĐ-1(b)** Gom `totals = Σ per-xe` cho báo cáo mới ⇒ dòng TỔNG khớp tuyệt đối A/B/C (không dùng đường `driverSalary` fleet). Giới hạn: tài xế không gán default cho xe nào sẽ không được tính lương.
- **QĐ-2(a)** "Chi phí khác" = `insurance` (= `fixedOther − depreciation`).
- **QĐ-3** km/L = `totalKm / totalLiters` (nghịch đảo consumption).
- **QĐ-4(a)** Trạng thái theo `cvh_status`: MAINTENANCE→"Bảo dưỡng", else net≥0→"Có lãi"/<0→"Lỗ".
- **QĐ-5(b)** TB chuyến/xe & km/xe chia cho **xe hoạt động**.
- **QĐ-6 (cập nhật user 2026-07-14)** Header công ty (tên/địa chỉ/tel-fax) + logo **cố định theo template** (Cargo Rush, hằng trong builder + `truck-report-logo.ts`); chỉ map động thông tin app có: người lập (user hiện tại), ngày lập, tháng/khu vực, số liệu. Không lookup tenant-settings.
- **QĐ-7(a)** Type mới, giữ nguyên PNL/TRIP_LOG/VEHICLE. Cột "Xe / Tài xế" = tài xế + tên xe (B46).

## 3. File thay đổi
| Loại | File | Thay đổi |
|---|---|---|
| DB const | `packages/db/src/schema/truck-report.schema.ts` | `TRUCK_REPORT_TYPES += 'MONTHLY_SUMMARY'` (không DDL — `trr_type varchar(16)` đủ) |
| Query | `apps/web/src/server/queries/truck-report-export.queries.ts` | `ReportVehiclePnlRow` + `model/tripCount/km/liters/costTotal/status`; thêm `summary`+`header`+`totals.depreciation`; cờ `includeIdle`; xe bảo dưỡng; gom Σ per-xe |
| Lib (mới) | `apps/web/src/server/lib/truck-monthly-summary-workbook.ts` | Builder 1-sheet + công thức + style khớp 100% template |
| Asset (mới) | `apps/web/src/server/lib/truck-report-logo.ts` | Logo Cargo Rush (base64 PNG 185×70) nhúng vào báo cáo |
| Action | `apps/web/src/server/actions/truck-report.actions.ts` | Nhánh `MONTHLY_SUMMARY` (`includeIdle=true`); `REPORT_NAME` |
| UI | `apps/web/src/app/(app)/truck/reports/_components/report-review-step.tsx` | Bộ chọn định dạng (mặc định Tổng kết chi phí tháng) |
| Route | `apps/web/src/app/(app)/truck/reports/[id]/download/route.ts` | Tên file tải về theo template + i18n (`fileName_*`), locale từ cookie `NEXT_LOCALE` |
| Lib | `apps/web/src/lib/s3-client.ts` | `getSignedGetUrl` thêm `downloadFilename` (ResponseContentDisposition, RFC 5987) |
| i18n | `apps/web/messages/{vi,en,ko}.json` | `type_MONTHLY_SUMMARY`, `selectFormat`, `formatSummaryHint`, `formatDetailHint`, `fileName_{MONTHLY_SUMMARY,PNL,TRIP_LOG,VEHICLE}` (tên file tải về theo ngôn ngữ — vi khớp tên template: `BaoCao_DoiXe_T{m}_{y}[_Region]_Report.xlsx`), **`exportContent.truckMonthlySummary`** (55 key — toàn bộ nhãn TRONG file dịch theo ngôn ngữ UI của người lập; vi = template verbatim) |
| Docs | REQ/PLAN/TC/TR + RPT này | — |

## 4. Kiểm thử
- `tsc --noEmit` (apps/web): ✅ PASS
- `next lint` (4 file): ✅ PASS
- Unit builder (esbuild harness + openpyxl): ✅ **42/42 PASS** — gồm bất biến `Σ dòng xe == A/B/C`, `C28 = C16 − C25 = KPI profit`.
- LibreOffice recalc: N/A trên Windows (dùng openpyxl cached-value thay thế; chỉ dùng hàm core `SUM`/`IFERROR`).

## 5. Không phá vỡ
- PNL/TRIP_LOG/VEHICLE giữ nhánh `includeIdle=false` (danh sách xe & `totals` tính như cũ); field mới optional ⇒ builder PNL cũ bỏ qua. Typecheck xác nhận tương thích type.
- `generateAllRegionsTruckReportsAction` vẫn sinh PNL (batch "làm mới") — MONTHLY_SUMMARY sinh từ màn review.

## 6. Việc còn lại / bàn giao
1. **Deploy staging** (theo CLAUDE.md — staging trước) rồi chạy TR §"Còn lại": E2E flow, PNL regression, spot-check số thật, mở file recalc.
2. **Xác nhận khách** 4 câu hỏi REQ §7 (tel/fax, người lập, format cột Xe/Tài xế, định nghĩa bảo dưỡng). Nếu khách muốn in Tel/Fax → chạy migration `tns_company_phone/fax` (REQ §4.3 / PLAN §5).
3. **DB migration**: KHÔNG cần cho tính năng này.

## 6.1 Nội dung file theo ngôn ngữ (bổ sung 2026-07-14)
Toàn bộ nhãn trong file MONTHLY_SUMMARY (tiêu đề, section A–E, dòng chi phí, header bảng E, trạng thái Có lãi/Lỗ/Bảo dưỡng, KPI, footer, tên sheet, Ngày lập/Người lập) dịch theo **ngôn ngữ UI của người lập** lúc bấm "Lập báo cáo" (cookie `NEXT_LOCALE`): vi = template verbatim (100%), en/ko = bản dịch; định dạng số/ngày theo locale (vi-VN/en-US/ko-KR). ⚠️ Ngôn ngữ **đóng băng vào file** tại thời điểm sinh — người tải về sau nhận đúng file đó (chỉ TÊN file đổi theo locale người tải). PNL/TRIP_LOG/VEHICLE giữ tiếng Việt (quy ước cũ). Header cty + logo vẫn cố định theo template (không dịch). Verified: 3 file vi/en/ko sinh bằng messages thật; bản vi qua trọn bộ validator.

## 7. Rủi ro tồn đọng
- QĐ-1(b): nếu thực tế có tài xế TRUCK không phải default của xe nào, lương họ không vào báo cáo tháng (khác cách tính all-regions cũ). Đã ghi REQ §3.5; cần khách xác nhận mô hình "1 xe ↔ 1 tài xế".
