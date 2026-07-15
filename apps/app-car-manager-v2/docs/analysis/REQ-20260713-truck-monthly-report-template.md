# REQ-20260713 — Truck: Export "Tổng kết chi phí tháng" theo template khách (Monthly Summary)

| | |
|---|---|
| **Ngày** | 2026-07-13 |
| **Người yêu cầu** | Khách hàng (Cargo Rush International Co., Ltd) |
| **Nguồn** | `C:\Users\nhutp\Downloads\BaoCao_DoiXe_T5_2026_Report.xlsx` (template mẫu tháng 5/2026) |
| **Phạm vi** | Thêm 1 định dạng báo cáo Excel mới ("Tổng kết chi phí tháng" — 1 sheet song ngữ, có công thức) khớp **từng ô** với template khách. Cho **truck ADMIN + MANAGER**. |
| **Tiền đề** | [REQ-20260629 month-end finance](REQ-20260629-truck-monthend-finance-reports.md), [PLAN-20260707 report recalc](../plan/PLAN-20260707-report-recalc-allocation.md) — đã ship mô hình cuối tháng + module Báo cáo (PNL/TRIP_LOG/VEHICLE) |
| **Yêu cầu gốc** | "đọc hiểu output báo cáo này… khách muốn export đúng với template này và mỗi ô là đúng số phù hợp với logic hiện tại, check logic hiện tại đã đủ chưa" |

---

## 0. Kết luận nhanh (đọc trước)

Nền logic tính số **đã đủ ~80%**: mọi dòng tiền chính (doanh thu, 6 loại chi phí, lợi nhuận, đối soát nhiên liệu) đã có trong `computeTruckPnl` + `getTruckFuelStats` + snapshot nhiên liệu theo vùng. **Không cần thêm bảng dữ liệu mới**. Việc còn thiếu để export **đúng từng ô**:

1. **Layout mới** — template là **1 sheet song ngữ có công thức** (`SUM`, `IFERROR`); workbook hiện tại là 3 sheet khác hẳn → cần builder mới.
2. **Dataset export mở rộng** — thêm per-truck `km / lít / km-L / số chuyến / chi phí tổng / margin / trạng thái`, **xe bảo dưỡng không chạy chuyến** (hiện bị loại), KPI đếm xe, tên người lập.
3. **6 quyết định semantics** (§3.5) phải chốt để công thức template khớp `netProfit` của app — quan trọng nhất là **lương tài xế ở scope "Tất cả khu vực"** và **cách gom tổng để dòng TỔNG = Σ dòng xe**.

---

## 1. Yêu cầu (요구사항 요약)

| # | Yêu cầu | Loại | Ưu tiên |
|---|---|---|---|
| R1 | Thêm định dạng báo cáo **"Tổng kết chi phí tháng"** (Monthly Summary) — 1 sheet Excel khớp layout + từng ô của template khách | Tính năng | P0 |
| R2 | Mỗi ô số = đúng logic tài chính hiện tại (`computeTruckPnl`, snapshot nhiên liệu), **không hardcode**; các ô tổng hợp dùng **công thức Excel** (`SUM`, `IFERROR`) đúng như template | Nghiệp vụ | P0 |
| R3 | Bảng **Chi tiết từng xe** liệt kê **tất cả** xe TRUCK trong kỳ (kể cả xe **bảo dưỡng/không chạy chuyến** vẫn gánh chi phí cố định) + dòng **TỔNG** = `SUM` các dòng xe | Nghiệp vụ | P0 |
| R4 | Khối **KPI** đầu báo cáo: tổng xe (tách hoạt động/bảo dưỡng), tổng chuyến (+TB/xe), tổng km (+TB/xe), lợi nhuận (+margin) | UI | P0 |
| R5 | Khối **Hiệu quả nhiên liệu**: tổng lít, **km/L** (nghịch đảo consumption), chi phí dầu/km | Nghiệp vụ | P0 |
| R6 | **Header công ty** (tên, địa chỉ, tel/fax) + **Người lập** + **Ngày lập** + **Tháng** | UI | P1 |
| R7 | Trạng thái từng xe: **Có lãi / Lỗ / Bảo dưỡng** (nghiệp vụ), thay cho "Đã lập BC / Tạm tính" | Nghiệp vụ | P1 |
| R8 | Cột "Xe / Tài xế" cho phép kèm **tên xe** (ghi chú B46 của khách) | UI | P2 |
| R9 | Báo cáo scope theo **kỳ (tháng) × khu vực** như các báo cáo hiện tại (`region` null = tất cả khu vực) | Nghiệp vụ | P1 |

---

## 2. AS-IS (현황 분석)

### 2.1 Core tài chính (đã có — nguồn số của mọi báo cáo)
- **`packages/core/src/truck/truck-pnl.service.ts`** — `computeTruckPnl(actor, { vehicleId?, region?, months })` → `TruckPnlRow[]`:
  - `revenue, fuelCost, tollFee, extraTotal, variableCost` (= fuel+toll+extra)
  - `salary, depreciation, insurance, driverSalary, fixedCost` (= salary+dep+insurance+driverSalary)
  - `tripCount, netProfit` (= revenue − variableCost − fixedCost)
  - **Fuel**: nếu có snapshot vùng → `km × consumption × avgPrice`; nếu không → `Σ(liters × price)` mỗi chuyến (fallback).
  - **driverSalary**: chỉ cộng khi scope **all-regions** (không `vehicleId`, không `region`) = Σ `car_drivers.drv_fixed_salary` của tài xế TRUCK. Ngược lại (per-vehicle/per-region) `driverSalary=0` và thay bằng **default per-xe**: `car_vehicles.cvh_depreciation` + lương cố định của `cvh_default_driver_id`, cho `(xe,tháng)` **không** có bản ghi `car_truck_fixed_costs` thủ công (dòng 219–265).
- **`packages/core/src/truck/truck-cost.ts`** — `truckTripFuelCost({km,consumption,avgPrice})`, `parseAmount()`.
- **`apps/web/src/server/queries/truck-finance.queries.ts`** — `getTruckFuelStats(entId,month,region?)` → `{ invoiceCount, avgPrice (mean đơn giá HĐ), invoiceLiters (Σ lít), totalKm (Σ km chuyến COMPLETED), consumption (Σ lít ÷ Σ km, đơn vị **L/km**) }`.

### 2.2 Báo cáo hiện tại
- **`apps/web/src/server/queries/truck-report-export.queries.ts`** — `getTruckReportExport(actor,month,region)` → `TruckReportExport`:
  - `trips[]` (nhật ký, đầy đủ cột NEW RULE), `vehicles[]` (per-xe P&L), `totals` (fleet total), `fuel`, `closed`.
  - ⚠️ `vehicles[]` build từ **danh sách xe CÓ chuyến** (`vehIds` từ `rows`, dòng 227) → **xe không chạy chuyến bị loại**.
  - ⚠️ `ReportVehiclePnlRow` **không có** `km`, `liters`, `tripCount`, `costTotal`, `margin`, `status` nghiệp vụ.
  - ⚠️ `totals` gọi `computeTruckPnl(region)` riêng → **không đảm bảo** `Σ vehicles = totals` khi có xe không chạy chuyến hoặc lệch driverSalary.
- **`apps/web/src/server/lib/truck-report-workbook.ts`** — `buildTruckReportWorkbook()`: workbook **3 sheet** (Danh sách chuyến / Lợi nhuận theo xe / Tổng hợp P&L + glossary), ExcelJS, **không dùng công thức Excel** (số tính sẵn trong JS).
- **`apps/web/src/server/actions/truck-report.actions.ts`** — `generateOneTruckReport()`: type ∈ `{PNL, TRIP_LOG, VEHICLE}` (`TRUCK_REPORT_TYPES`), freeze snapshot vào `car_truck_reports`, upload S3.

### 2.3 Schema liên quan
- `car_truck_reports` (`trr_*`): `trr_type varchar(16)`, đã có snapshot `trr_avg_price/consumption/total_liters/total_km`, `trr_region`, `trr_created_by`, `trr_created_at`. **`TRUCK_REPORT_TYPES = ['PNL','TRIP_LOG','VEHICLE']`** (packages/db `truck-report.schema.ts:58`).
- `car_vehicles`: `cvh_plate_number, cvh_code, cvh_model, cvh_region, cvh_default_driver_id, cvh_depreciation, cvh_status` (enum `AVAILABLE|IN_USE|MAINTENANCE|RETIRED`).
- `car_drivers`: `drv_fixed_salary`, `drv_user_id` → `car_users.usr_name`.
- `car_tenant_settings` (`tns_*`): `tns_tenant_name`, `tns_depot_address`. **KHÔNG có** cột điện thoại/fax/tên đại diện.

### 2.4 i18n
- `apps/web/messages/{vi,en,ko}.json` — namespace `screens.truckReports` đã có (title, type_PNL/TRIP_LOG/VEHICLE, stepper…). Nội dung **file Excel là tiếng Việt cố định** (tài liệu vận hành cho công ty VN) — chỉ UI chrome i18n.

---

## 3. TO-BE (요구사항)

### 3.1 Cấu trúc template khách (giải mã từ file)

1 sheet `Báo cáo tháng 5.2026`, vùng `B2:L46`, song ngữ Việt/Anh, 44 vùng merge:

| Khối | Ô | Nội dung | Ghi chú công thức |
|---|---|---|---|
| Header cty | B2/B3/B4 | Tên / Địa chỉ / Tel·Fax | text |
| Tiêu đề | B7 | "TỔNG KẾT CHI PHÍ THÁNG \| MONTHLY SUMMARY" | text |
| Meta | J8, E9, I9 | Ngày lập / Tháng / Người lập | text |
| KPI | B12/D12/F12/H12 | 5 xe / 187 / 8.240 / (8,203,335) đ | số |
| KPI phụ | B13/D13/F13/H13 | "4 hoạt động · 1 bảo dưỡng" / "TB 46,8 chuyến/xe" / "TB 2.060 km/xe" / "Margin −4,4%" | text dẫn xuất |
| A. Doanh thu | C16 | Freight revenue = 186.400.000 | số |
| B. Chi phí | C19..C24 | Nhiên liệu / Cầu đường / Phát sinh / **Lương tài xế** / Khấu hao / **Khác** | số |
| B. Tổng | C25 | `=SUM(C19:C24)` | **công thức** |
| C. Kết quả | C28 | Lợi nhuận gộp `=C16-C25` | **công thức** |
| C. Margin | C29 | `=IFERROR(C28/C16,"")` | **công thức** |
| D. Nhiên liệu | C32/C33/C34 | Tổng lít 1.742 / **km/L 4,73** / Chi phí dầu/km 5.096 | số |
| E. Chi tiết xe | B37:L37 | Header 11 cột: Xe/Tài xế, Biển số, Chuyến, KM, Doanh thu, Chi phí, Nhiên liệu, km/L, Lợi nhuận, Margin, Trạng thái | — |
| E. Dòng xe | B38..L42 | 5 xe; **E42 = xe bảo dưỡng** (Chuyến/KM/DT = "—", Chi phí 15.003.335, Trạng thái "Bảo dưỡng") | J=`=F−G`, K=`=IFERROR(J/F,"")` |
| E. Tổng | B43:L43 | `=SUM(...)` mỗi cột số; K43 `=IFERROR(J43/F43,"")` | **công thức** |
| Ghi chú | B46 | KH hỏi có thể để **tên xe** vào cột "Xe / Tài xế" không | → R8 |

> ⚠️ Số trong file là **số mẫu, không tự khớp nội bộ** (vd. C34 chi phí dầu/km = 5.096 ≠ 64.200.000 ÷ 8.240 = 7.791). Khi áp logic app, các ô này sẽ **tự nhất quán** với nhau — đây là điểm cộng, không phải sai lệch cần bám theo số mẫu.

### 3.2 Mapping từng ô → nguồn số app (bảng cốt lõi R2)

Ký hiệu: `pnl` = `computeTruckPnl` fleet-scope của (tháng×khu vực); `veh[i]` = per-xe; `fuel` = `getTruckFuelStats`; `V` = danh sách xe TRUCK trong kỳ.

| Ô | Nhãn | Nguồn / Công thức |
|---|---|---|
| B2 | Tên cty | `tns_tenant_name` (fallback `actor.entName`) |
| B3 | Địa chỉ | `tns_depot_address` |
| B4 | Tel/Fax | **§3.5 QĐ-6** (field mới hoặc để trống) |
| J8 | Ngày lập | `generatedAt` (đã stamp workbook) |
| E9 | Tháng | `monthLabel(month)` |
| I9 | Người lập | `car_users.usr_name` theo `actor.userId` (fallback `actor.name`) |
| B12 | Tổng xe | `V.length` |
| B13 | (hoạt động·bảo dưỡng) | `#active` · `#maintenance` — **§3.5 QĐ-4** |
| D12 | Tổng chuyến | `pnl.tripCount` |
| D13 | TB chuyến/xe | `tripCount / #active` — **§3.5 QĐ-5** |
| F12 | Tổng KM | `fuel.totalKm` (= `Σ veh.km`) |
| F13 | TB km/xe | `totalKm / #active` |
| H12 | Lợi nhuận | `pnl.netProfit` |
| H13 | Margin | `IFERROR(netProfit/revenue)` |
| C16 | Doanh thu | `pnl.revenue` |
| C19 | Nhiên liệu | `pnl.fuelCost` |
| C20 | Cầu đường | `pnl.tollFee` |
| C21 | Phát sinh | `pnl.extraTotal` |
| C22 | **Lương tài xế** | `pnl.salary + pnl.driverSalary` — **§3.5 QĐ-1** |
| C23 | Khấu hao | `pnl.depreciation` |
| C24 | **Khác** | `pnl.insurance` — **§3.5 QĐ-2** |
| C25 | Tổng chi phí | `=SUM(C19:C24)` (Excel) — khớp `variableCost+fixedCost` |
| C28 | Lợi nhuận gộp | `=C16-C25` (Excel) — khớp `netProfit` |
| C29 | Margin | `=IFERROR(C28/C16,"")` (Excel) |
| C32 | Tổng lít | `fuel.invoiceLiters` |
| C33 | **km/L** | `IFERROR(totalKm/invoiceLiters)` = 1/consumption — **§3.5 QĐ-3** |
| C34 | Chi phí dầu/km | `IFERROR(fuelCost/totalKm)` (self-consistent với model phân bổ) |
| E: Xe/Tài xế | | `usr_name` của `cvh_default_driver_id` (fallback tài xế chạy nhiều nhất) [+ tên xe R8] |
| E: Biển số | | `cvh_plate_number` |
| E: Chuyến | | `veh[i].tripCount` (0/"—" nếu bảo dưỡng) |
| E: KM | | `Σ trip km` của xe |
| E: Doanh thu | | `veh[i].revenue` |
| E: Chi phí | | `veh[i].variableCost + veh[i].fixedCost` |
| E: Nhiên liệu (L) | | `km × consumption` (nếu allocatable) / `Σ trip liters` |
| E: km/L | | `IFERROR(km/liters)` |
| E: Lợi nhuận | | `=F−G` (Excel) = `veh[i].netProfit` |
| E: Margin | | `=IFERROR(J/F,"")` (Excel) |
| E: Trạng thái | | **§3.5 QĐ-4**: MAINTENANCE→"Bảo dưỡng"; else net≥0→"Có lãi"/net<0→"Lỗ" |
| E: TỔNG | | `=SUM(...)` mỗi cột (Excel) — **phải khớp** khối A/B/C |

### 3.3 Nguồn dữ liệu mới cần bổ sung vào dataset export

Mở rộng `TruckReportExport` (hoặc tạo `TruckMonthlySummary` riêng) để phủ bảng E + KPI:

- `ReportVehiclePnlRow` thêm: `tripCount`, `km`, `liters`, `costTotal`, `status: 'PROFIT'|'LOSS'|'MAINTENANCE'` (mã, i18n/label hoá ở builder).
- Danh sách xe = `listVehicles(entId,'active','TRUCK')` lọc theo `region` (thay vì chỉ xe có chuyến) → **bao gồm xe bảo dưỡng**.
- KPI: `truckCount`, `activeCount`, `maintenanceCount`, `avgTripsPerTruck`, `avgKmPerTruck`.
- Header: `companyName`, `companyAddress`, `companyContact?`, `preparedBy`.

### 3.4 UI (điểm chạm người dùng)

**Không thêm màn mới.** Tái dùng module Báo cáo hiện có:
- Thêm loại báo cáo thứ 4 hiển thị trong bước chọn loại / hoặc đặt làm layout mặc định của `PNL`. **§3.5 QĐ-7**.
- Nút "Lập báo cáo" (review step) + "Làm mới tất cả khu vực" (finance) sinh thêm file mới này.
- i18n key mới: `screens.truckReports.type_MONTHLY_SUMMARY` (+ mô tả) trong vi/en/ko.

### 3.5 Quyết định semantics (⚠️ phải chốt — khuyến nghị kèm sẵn)

| Mã | Vấn đề | Lựa chọn | **Khuyến nghị** |
|---|---|---|---|
| **QĐ-1** | Lương tài xế ở scope all-regions (`pnl.salary` chỉ có tfc thủ công; `driverSalary` = Σ lương tài xế fleet) | (a) `salary+driverSalary` ở summary; per-xe dùng default → **rủi ro Σxe ≠ summary** · (b) **Gom summary = Σ per-xe** (mỗi xe scope `vehicleId` → salary = default driver), bỏ đường `driverSalary` cho báo cáo này | **(b)** — đảm bảo dòng TỔNG (E43) = khối B (C22) tuyệt đối. Đánh đổi: tài xế **không** gắn default cho xe nào sẽ không được tính lương (theo mô hình "1 xe↔1 tài xế" thì mọi xe có default driver ⇒ chấp nhận được). |
| **QĐ-2** | Ô "Chi phí khác / Other" (C24) map field nào | (a) `insurance` · (b) 0 (gộp vào khấu hao) | **(a)** `pnl.insurance` (bảo hiểm & CP cố định khác) |
| **QĐ-3** | km/L (C33) vs consumption (app lưu L/km) | nghịch đảo | **km/L = totalKm/invoiceLiters** (=1/consumption), `IFERROR` khi lít=0 |
| **QĐ-4** | Định nghĩa "hoạt động / bảo dưỡng" + trạng thái xe | (a) theo `cvh_status=MAINTENANCE` · (b) theo có/không có chuyến | **(a)** `cvh_status`: `MAINTENANCE`→bảo dưỡng; xe khác = hoạt động. Trạng thái dòng: MAINTENANCE→"Bảo dưỡng", else net≥0→"Có lãi"/<0→"Lỗ" |
| **QĐ-5** | Mẫu số TB chuyến/xe, km/xe | (a) tổng xe · (b) **xe hoạt động** | **(b)** khớp template (187÷4=46,8; 8.240÷4=2.060) |
| **QĐ-6** | Header Tel/Fax (không có field) | (a) thêm `tns_company_phone`,`tns_company_fax` + ô Settings · (b) **để trống MVP** · (c) 1 field free-text `tns_report_header` | **(b)** để trống ở MVP (giảm scope + migration); nâng cấp (a) nếu KH yêu cầu in chính xác |
| **QĐ-7** | Cách phát hành layout mới | (a) **type mới `MONTHLY_SUMMARY`** (giữ PNL 3-sheet) · (b) thay layout PNL | **(a)** — không phá báo cáo cũ, KH chọn được cả hai; cần migration mở rộng `TRUCK_REPORT_TYPES` (chỉ là hằng TS + i18n, `trr_type` đã `varchar(16)` nên **không cần DDL**) |

---

## 4. 갭 분석 (Gap Analysis)

### 4.1 Bảng phạm vi thay đổi
| Vùng | Hiện tại | Thay đổi | Ảnh hưởng |
|---|---|---|---|
| Dataset export | `TruckReportExport` (xe có chuyến, thiếu km/lít/status) | Query/summary mới phủ đủ KPI + per-xe đầy đủ + xe bảo dưỡng | Trung bình |
| Gom tổng | `totals` = call region riêng | `totals` = Σ per-xe (QĐ-1) | **Cao** (ảnh hưởng khớp số) |
| Workbook | 3-sheet, không formula | Builder 1-sheet, có `SUM/IFERROR`, merge, song ngữ | Trung bình |
| Report type | 3 type | +`MONTHLY_SUMMARY` (hằng TS + i18n) | Thấp |
| i18n | — | +key type mới ×3 ngôn ngữ | Thấp |
| DB | — | **Không DDL** (`trr_type varchar(16)` đủ chỗ) | Không |

### 4.2 Danh sách file thay đổi
| Loại | File | Thay đổi |
|---|---|---|
| Backend/query | `apps/web/src/server/queries/truck-report-export.queries.ts` | Sửa: thêm km/lít/tripCount/costTotal/status per-xe; xe bảo dưỡng; KPI; gom Σ per-xe |
| Backend/lib | `apps/web/src/server/lib/truck-monthly-summary-workbook.ts` | **Mới**: builder 1-sheet có công thức |
| Backend/action | `apps/web/src/server/actions/truck-report.actions.ts` | Sửa: nhánh `type==='MONTHLY_SUMMARY'` → builder mới; header (companyName/preparedBy) |
| Backend/query | `apps/web/src/server/queries/truck-report.queries.ts` | (nếu cần) tên người lập theo `trr_created_by` |
| DB const | `packages/db/src/schema/truck-report.schema.ts` | Sửa: `TRUCK_REPORT_TYPES += 'MONTHLY_SUMMARY'` |
| i18n | `apps/web/messages/{vi,en,ko}.json` | Sửa: `type_MONTHLY_SUMMARY` + mô tả |
| UI | `apps/web/src/app/(app)/truck/reports/new` + review step | Sửa: hiển thị/chọn loại mới (nếu QĐ-7a) |
| Test | `packages/core` hoặc script | **Mới**: unit đối chiếu ô ↔ core |

### 4.3 DB Migration
**Không cần DDL.** `car_truck_reports.trr_type` là `varchar(16)` — `'MONTHLY_SUMMARY'` (15 ký tự) vừa khít. Chỉ mở rộng hằng `TRUCK_REPORT_TYPES` (TypeScript). Snapshot nhiên liệu tái dùng cột `trr_*` sẵn có.
> Nếu chọn **QĐ-6a** (tel/fax): thêm migration `00XX_tenant_company_contact.sql` (`ADD COLUMN IF NOT EXISTS tns_company_phone/tns_company_fax`). MVP khuyến nghị bỏ qua.

---

## 5. 사용자 플로우 (User Flow)

```
Truck ADMIN/MANAGER
  │
  ├─ /truck/reports/new → chọn Tháng (guard: tháng có ≥1 chuyến COMPLETED)
  │      ↓
  ├─ chọn Khu vực (HCM / Đồng Nai / Baiksan / Tất cả)
  │      ↓
  ├─ Bước review: xem per-xe + đối soát nhiên liệu (đã có)
  │      ↓  [chọn loại "Tổng kết chi phí tháng" — QĐ-7a]
  ├─ "Lập báo cáo"
  │      ├─ freeze snapshot nhiên liệu (nếu allocatable) vào car_truck_reports
  │      ├─ getTruckReportExport(month, region)  ← dataset mở rộng
  │      ├─ buildTruckMonthlySummaryWorkbook()   ← 1 sheet + formula
  │      └─ upload S3 → row car_truck_reports (trr_type=MONTHLY_SUMMARY)
  │      ↓
  └─ /truck/reports → tải file .xlsx
         └─ mở Excel: mọi ô SUM/IFERROR tự tính; số khớp app
```

**Phân nhánh dữ liệu:**
- Tháng chưa có hóa đơn xăng (không allocatable) → nhiên liệu = số tạm tính per-trip; km/L, chi phí dầu/km vẫn tính từ `totalKm`/`invoiceLiters` (có thể 0 → `IFERROR` trả "").
- Khu vực không có xe → báo cáo trống (0 dòng E, KPI = 0).
- Xe `MAINTENANCE` không chuyến nhưng có `cvh_depreciation`/default driver → 1 dòng E, Chuyến/KM/DT = "—", Chi phí = fixed, Trạng thái "Bảo dưỡng".

---

## 6. 기술 제약사항 (Constraints)

- **Công thức Excel**: dùng `SUM`, `IFERROR` (Excel-2007 core, không prefix) — ExcelJS ghi formula string vào ô. **Tránh** hàm spill/mới. Đơn vị tiền = VND nguyên (`#,##0`), stored number (không phải chuỗi) để `SUM` chạy.
- **Nhất quán số**: Ràng buộc bất biến — `E43 (TỔNG) == B/C khối` và `C25 == C19:C24` và `C28 == H12 == netProfit`. Đây là tiêu chí PASS chính (TC).
- **Multi-tenancy**: mọi query lọc `ent_id`; tái dùng `computeTruckPnl`/`getTruckReportExport` (đã enforce).
- **Role**: ADMIN/MANAGER + fleet TRUCK (route handler + action đã re-check).
- **i18n**: nội dung file = tiếng Việt cố định (nhất quán báo cáo hiện có); chỉ UI chrome i18n 3 ngôn ngữ.
- **Hiệu năng**: fleet nhỏ (vài xe) → gom JS; per-xe gọi `computeTruckPnl(vehicleId)` song song (`Promise.all`) như hiện tại.
- **Không phá vỡ**: PNL/TRIP_LOG/VEHICLE giữ nguyên; snapshot freeze giữ nguyên hành vi PLAN-20260707.

---

## 7. Câu hỏi mở cho khách — ĐÃ CHỐT (2026-07-14)
1. ~~Tel/Fax header~~ → **CHỐT (user 2026-07-14, thay QĐ-6b)**: header công ty (tên/địa chỉ/tel-fax) **+ logo cố định theo template** (Cargo Rush) — chỉ map động các thông tin app có (người lập, ngày lập, tháng/khu vực, toàn bộ số liệu). Không thêm field Settings.
2. "Người lập" — **CHỐT**: tên user hiện tại bấm "Lập báo cáo" (`car_users.usr_name`, fallback tên JWT).
3. Cột "Xe / Tài xế" — theo khuyến nghị: *tài xế + tên xe* (`driver · model`). Đổi được nếu khách yêu cầu.
4. Xe bảo dưỡng — theo QĐ-4a: `cvh_status = MAINTENANCE`.
```
