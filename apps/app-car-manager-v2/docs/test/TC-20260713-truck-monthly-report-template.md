# TC-20260713 — Truck Monthly Summary report (đối chiếu từng ô ↔ logic core)

| | |
|---|---|
| **Ngày** | 2026-07-13 |
| **REQ / PLAN** | [REQ-20260713](../analysis/REQ-20260713-truck-monthly-report-template.md) · [PLAN-20260713](../plan/PLAN-20260713-truck-monthly-report-template.md) |
| **Mục tiêu test** | (1) Mọi ô số = đúng logic core; (2) Công thức Excel `SUM/IFERROR` đúng & khớp; (3) Bất biến khớp tổng; (4) Xe bảo dưỡng, phân nhánh dữ liệu; (5) Không phá báo cáo cũ |
| **Cách chạy** | Unit (Vitest) trên builder + query với fixture; Manual E2E trên staging bằng dữ liệu tháng thật; đối chiếu file .xlsx tải về |

---

## A. Đối chiếu từng ô ↔ core (R2 — cốt lõi)

Fixture: 1 khu vực, 3 xe chạy chuyến + 1 xe `MAINTENANCE`; tháng có ≥1 hóa đơn xăng (allocatable). Gọi `getTruckReportExport(month, region)` và `computeTruckPnl` để lấy oracle.

| TC | Ô | Kỳ vọng | Cách verify |
|---|---|---|---|
| A-01 | B2/B3 | = `tns_tenant_name` / `tns_depot_address` (fallback `entName`) | so text |
| A-02 | I9 Người lập | = `car_users.usr_name(actor.userId)` | so text |
| A-03 | J8 Ngày lập | = `generatedAt` định dạng dd/mm/yyyy HH:mm | regex |
| A-04 | B12 Tổng xe | = số xe TRUCK trong khu vực (kể cả MAINTENANCE) | = `summary.truckCount` |
| A-05 | B13 | "N hoạt động · M bảo dưỡng", M = #`cvh_status=MAINTENANCE` | so chuỗi |
| A-06 | D12 Tổng chuyến | = `computeTruckPnl(region).tripCount` = `Σ veh.tripCount` | equal |
| A-07 | D13 TB chuyến/xe | = `round(tripCount / activeCount, 1)` (QĐ-5) | equal |
| A-08 | F12 Tổng KM | = `getTruckFuelStats.totalKm` = `Σ veh.km` | equal |
| A-09 | F13 TB km/xe | = `round(totalKm / activeCount)` | equal |
| A-10 | H12 Lợi nhuận | = `computeTruckPnl(region).netProfit` | equal |
| A-11 | H13 Margin | = `netProfit / revenue` (‰), khớp C29 | tol 1e-9 |
| A-12 | C16 Doanh thu | = `pnl.revenue` | equal |
| A-13 | C19 Nhiên liệu | = `pnl.fuelCost` | equal |
| A-14 | C20 Cầu đường | = `pnl.tollFee` | equal |
| A-15 | C21 Phát sinh | = `pnl.extraTotal` | equal |
| A-16 | C22 Lương tài xế | = `Σ veh.salary` (QĐ-1b) | equal |
| A-17 | C23 Khấu hao | = `Σ veh.depreciation` | equal |
| A-18 | C24 Khác | = `Σ veh.insurance` (QĐ-2) | equal |
| A-19 | C32 Tổng lít | = `getTruckFuelStats.invoiceLiters` | equal |
| A-20 | C33 km/L | = `IFERROR(totalKm/invoiceLiters)` (QĐ-3); lít=0 → "" | equal / rỗng |
| A-21 | C34 Chi phí dầu/km | = `IFERROR(fuelCost/totalKm)` | equal |

---

## B. Công thức Excel & bất biến khớp (R2/R3)

Kiểm bằng đọc lại file (openpyxl 2 lần: formula + `data_only`), hoặc recalc LibreOffice.

| TC | Ràng buộc | PASS khi |
|---|---|---|
| B-01 | C25 là **formula** `=SUM(C19:C24)` (không phải số cứng) | `cell.value` bắt đầu `=`/`{formula}` |
| B-02 | C25 (đã tính) == `variableCost + fixedCost` của `pnl` | equal |
| B-03 | C28 `=C16-C25` == `pnl.netProfit` == H12 | equal cả 3 |
| B-04 | C29 `=IFERROR(C28/C16,"")`; revenue=0 → "" | equal / rỗng |
| B-05 | Mỗi dòng xe: J `=F−G`, K `=IFERROR(J/F,"")` | là formula |
| B-06 | Dòng TỔNG D43/E43/F43/G43/J43 = `SUM(...38:..42)` | là formula |
| B-07 | **Σ dòng xe == khối B**: F43==C16, G-tổng khớp C25, J43==C28 | equal |
| B-08 | Ô tiền là **number** (numFmt `#,##0`), không phải chuỗi có dấu chấm | typeof number |
| B-09 | Formula có `result` cached → `data_only` đọc ra giá trị (không None) | not None |

> **Bất biến vàng**: `F43 == C16 == pnl.revenue` và `J43 == C28 == H12 == pnl.netProfit`. Nếu lệch ⇒ FAIL (lỗi gom tổng hoặc driverSalary).

---

## C. Bảng chi tiết xe — per-truck (R3)

| TC | Case | Kỳ vọng |
|---|---|---|
| C-01 | Xe chạy chuyến, có lãi | Chuyến/KM/DT/CP/LN có số; Margin=J/F; Trạng thái "Có lãi" (net≥0) |
| C-02 | Xe chạy chuyến, lỗ | Trạng thái "Lỗ" (net<0), số âm hiển thị đúng |
| C-03 | **Xe MAINTENANCE, không chuyến** | Xuất hiện 1 dòng; Chuyến/KM/DT = "—"/0; **Chi phí = fixed (dep+salary+insurance)**; LN = −Chi phí; Trạng thái "Bảo dưỡng" |
| C-04 | Xe/Tài xế | = tên default driver (`cvh_default_driver_id`), fallback tài xế chạy nhiều nhất; [+tên xe nếu R8] |
| C-05 | Chi phí xe (cột G) | = `veh.variableCost + veh.fixedCost` |
| C-06 | Nhiên liệu (L) per-xe | allocatable → `km×consumption`; else `Σ trip liters` |
| C-07 | km/L per-xe | `IFERROR(km/liters)`; km=0 → "" |
| C-08 | Sắp xếp | theo biển số (localeCompare) |

---

## D. Phân nhánh dữ liệu (flow §5)

| TC | Case | Kỳ vọng |
|---|---|---|
| D-01 | Tháng chưa có hóa đơn xăng (không allocatable) | Nhiên liệu = số tạm tính per-trip; C33/C34 vẫn tính (hoặc "" nếu mẫu số 0); không crash |
| D-02 | Khu vực không có xe | 0 dòng E; KPI=0; C25/C28 = 0; C29="" (IFERROR) |
| D-03 | Xe có chuyến nhưng km=0 (thiếu odometer) | Nhiên liệu allocated=0 cho chuyến đó; không chia cho 0 |
| D-04 | Scope "Tất cả khu vực" (region=null) | Danh sách xe = mọi xe TRUCK; tổng khớp `computeTruckPnl({months})` **theo cách gom Σ per-xe** (ghi chú QĐ-1b) |
| D-05 | Tháng đã đóng (closed) + có snapshot | Số dùng snapshot đã freeze; nhất quán với màn finance |

---

## E. Không phá vỡ (regression)

| TC | Case | Kỳ vọng |
|---|---|---|
| E-01 | Regen báo cáo **PNL** (3-sheet) cùng tháng/khu vực | File & số **y hệt** trước thay đổi (cờ `includeIdle=false` cho PNL) |
| E-02 | `generateAllRegionsTruckReportsAction` | Vẫn sinh **PNL** cho từng khu vực; không tạo MONTHLY_SUMMARY ngoài ý muốn |
| E-03 | TRIP_LOG / VEHICLE export | Không đổi |
| E-04 | Danh sách báo cáo `/truck/reports` | Hiển thị tên "Tổng kết chi phí tháng · Khu vực …"; badge "Mới"; tải được |
| E-05 | i18n | Bước chọn loại render đủ vi/en/ko, không thiếu key |
| E-06 | TS build + lint | `npm run build` xanh; type `TruckReportType` gồm 4 giá trị |

---

## F. Verify kỹ thuật file .xlsx

| TC | Kiểm | Công cụ |
|---|---|---|
| F-01 | Mở bằng Excel/LibreOffice không lỗi formula (#NAME?/#REF!) | recalc.py / mở tay |
| F-02 | `SUM`/`IFERROR` recalc đúng sau khi sửa 1 ô input | LibreOffice recalc |
| F-03 | Font Montserrat, merge song ngữ, màu trạng thái đúng | mở tay |
| F-04 | Tên file & Content-Disposition UTF-8 (tiếng Việt) | tải về |

---

## Tiêu chí PASS tổng
- **100%** TC nhóm A + B (đối chiếu ô & bất biến khớp) PASS — đây là yêu cầu "mỗi ô đúng số".
- Nhóm C/D/E không có FAIL nghiêm trọng (xe bảo dưỡng hiện đúng, không regression PNL cũ).
- File mở sạch, công thức recalc đúng (F).

## Ghi chú thực thi
- Ưu tiên **unit test** builder với fixture cứng (oracle tính tay) cho A/B/C — chạy nhanh, khóa bất biến.
- **Manual E2E** trên staging tháng có dữ liệu thật cho D/E/F (chờ user duyệt & cung cấp tháng/khu vực mẫu).
- ⚠️ **Cổng phê duyệt**: chưa code cho tới khi user chốt REQ §7 (Q1–Q4) + QĐ-1/QĐ-7.
