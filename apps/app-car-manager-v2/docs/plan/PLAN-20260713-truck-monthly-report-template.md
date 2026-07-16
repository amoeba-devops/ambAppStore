# PLAN-20260713 — Truck Monthly Summary report (export theo template khách)

| | |
|---|---|
| **Ngày** | 2026-07-13 |
| **REQ nguồn** | [REQ-20260713](../analysis/REQ-20260713-truck-monthly-report-template.md) |
| **Mục tiêu** | Thêm loại báo cáo `MONTHLY_SUMMARY` — 1 sheet Excel có công thức, khớp **từng ô** template khách, số lấy 100% từ core hiện tại |
| **Quyết định áp dụng** | QĐ-1(b) gom Σ per-xe · QĐ-2(a) Other=insurance · QĐ-3 km/L=nghịch đảo · QĐ-4(a) status theo `cvh_status` · QĐ-5(b) TB theo xe hoạt động · QĐ-6(b) tel/fax để trống MVP · QĐ-7(a) type mới |

---

## 1. 시스템 개발 현황 분석

### 1.1 Cấu trúc & tech stack
- **Monorepo** `apps/app-car-manager-v2/` (Turborepo, Next.js 15 App Router, Drizzle+Neon, ExcelJS + SheetJS).
- **Core** `packages/core/src/truck/`: `truck-pnl.service.ts` (`computeTruckPnl`), `truck-cost.ts` (`truckTripFuelCost`, `parseAmount`). **Pure — tái dùng nguyên, không sửa.**
- **Export** `apps/web/src/server/`:
  - `queries/truck-report-export.queries.ts` — `getTruckReportExport()` (**sửa**).
  - `queries/truck-finance.queries.ts` — `getTruckFuelStats`, `listTruckFinanceTrips` (dùng lại).
  - `lib/truck-report-workbook.ts` — builder 3-sheet PNL (**giữ nguyên**).
  - `actions/truck-report.actions.ts` — `generateOneTruckReport`, `buildReportWorkbook` (**sửa: thêm nhánh**).
- **Schema** `packages/db/src/schema/truck-report.schema.ts` — `TRUCK_REPORT_TYPES` (**sửa hằng**).

### 1.2 Ràng buộc
- `trr_type varchar(16)` → `'MONTHLY_SUMMARY'` (15) vừa khít ⇒ **không DDL**.
- ExcelJS ghi formula qua `cell.value = { formula: 'SUM(...)', result }`. Chỉ dùng `SUM`, `IFERROR` (không prefix).
- Ô tiền phải là **number** (không format sẵn chuỗi) để `SUM` cộng được; format qua `numFmt='#,##0'`.
- Bất biến khớp số (tiêu chí nghiệm thu): `Σ dòng xe == khối A/B/C == computeTruckPnl(region).netProfit`.

---

## 2. 단계별 구현 계획

### Phase 1 — Dataset mở rộng (backend, nguồn số)

**Step 1.1** — Mở rộng type `ReportVehiclePnlRow` + `TruckReportExport`
- Thêm vào `ReportVehiclePnlRow`: `tripCount:number`, `km:number`, `liters:number`, `costTotal:number`, `status:'PROFIT'|'LOSS'|'MAINTENANCE'`.
- Thêm `TruckReportExport.summary`: `{ truckCount, activeCount, maintenanceCount, tripCount, totalKm, avgTripsPerActive, avgKmPerActive, revenue, netProfit, margin }`.
- Thêm `TruckReportExport.header`: `{ companyName, companyAddress, companyContact:null, preparedBy, month }`.
- └─ **사이드 임팩트**: `truck-report-workbook.ts` (PNL 3-sheet) đọc cùng `TruckReportExport` → chỉ **thêm field optional**, không đổi field cũ ⇒ builder cũ không vỡ. Kiểm tra TS compile.

**Step 1.2** — Danh sách xe = tất cả xe TRUCK trong khu vực (kể cả bảo dưỡng)
- Trong `getTruckReportExport`: đổi nguồn `vehIds` từ "xe có chuyến" → `listVehicles(entId,'active','TRUCK')` lọc `cvhRegion===region` (khi region set).
- Gom `km`/`liters` per-xe từ `trips[]` (đã có odometer + allocatable → `km×consumption`; fallback `Σ trip liters`).
- `status`: `cvh_status==='MAINTENANCE'` → `MAINTENANCE`; else `net>=0`→`PROFIT`/`LOSS`.
- └─ **사이드 임팩트**: xe không chuyến giờ xuất hiện trong `vehicles[]` → **builder PNL cũ (sheet ②) cũng sẽ hiển thị thêm dòng xe bảo dưỡng**. Đây là **sửa đúng** (khớp tổng), nhưng là thay đổi hành vi PNL cũ → ghi rõ ở TR + báo user. Nếu muốn cô lập: thêm cờ `includeIdleVehicles` chỉ bật cho MONTHLY_SUMMARY (an toàn hơn — **chọn cách này**).

**Step 1.3** — Gom `totals` = Σ per-xe (QĐ-1b)
- Thay `totals` (đang gọi `computeTruckPnl(region)` riêng) bằng reduce trên `vehicles[]`: `salary=Σveh.salary`, … `net=Σveh.net`.
- Đảm bảo mỗi `veh` scope `vehicleId` (đã đúng — dòng 239) → salary = default driver; summary = Σ ⇒ **khớp tuyệt đối**.
- └─ **사이드 임팩트**: với scope all-regions, tổng lương giờ = Σ lương default-driver per-xe (thay vì `driverSalary` fleet). Có thể **lệch** báo cáo cũ nếu tồn tại tài xế TRUCK không phải default của xe nào. Ghi chú giới hạn ở REQ §3.5 QĐ-1; áp cờ `includeIdleVehicles` để chỉ MONTHLY_SUMMARY dùng cách gom mới, PNL cũ giữ `totals` cũ.

### Phase 2 — Workbook builder (1 sheet + công thức)

**Step 2.1** — `lib/truck-monthly-summary-workbook.ts` (**mới**)
- Hàm `buildTruckMonthlySummaryWorkbook(data, labels)` → `Buffer`.
- Layout đúng template: header cty (B2:B4), tiêu đề (B7), meta (E9/I9/J8), KPI (B11:H13), A/B/C (B15:C29), D (B31:C34), E bảng xe (B37:L43), ghi chú.
- Công thức Excel (ExcelJS `{formula, result}`):
  - `C25 = SUM(C19:C24)`; `C28 = C16-C25`; `C29 = IFERROR(C28/C16,"")`.
  - Mỗi dòng xe: `J{r}=F{r}-G{r}`, `K{r}=IFERROR(J{r}/F{r},"")`.
  - Dòng TỔNG: `D43=SUM(D38:D42)`, `E43`, `F43`, `G43`, `H43`(lít), `J43`; `I43=IFERROR(E43/H43,...)`, `K43=IFERROR(J43/F43,"")`.
  - KPI dẫn xuất: `H12` link `=C28`; margin `H13`; TB (số tính sẵn — text).
- Style: Montserrat, merge song ngữ, `numFmt='#,##0'`, freeze header bảng E, màu trạng thái (xanh Có lãi / đỏ Lỗ / xám Bảo dưỡng) — tái dùng hằng màu từ `truck-report-workbook.ts`.
- └─ **사이드 임팩트**: không (file mới). Chú ý set `result` cho formula để reader không mở LibreOffice/Excel vẫn thấy giá trị cached.

**Step 2.2** — Đấu nối action
- `truck-report.actions.ts`:
  - `TRUCK_REPORT_TYPES` (schema) `+= 'MONTHLY_SUMMARY'`; `REPORT_NAME['MONTHLY_SUMMARY']='Tổng kết chi phí tháng'`.
  - `buildReportWorkbook()`: nhánh `if (type==='MONTHLY_SUMMARY')` → `getTruckReportExport(includeIdle=true)` → `buildTruckMonthlySummaryWorkbook`.
  - `preparedBy`: query `car_users.usr_name` theo `actor.userId`.
- └─ **사이드 임팩트**: `generateAllRegionsTruckReportsAction` hardcode `type:'PNL'` → **không** tự sinh MONTHLY_SUMMARY. Quyết định: giữ PNL cho batch "làm mới", MONTHLY_SUMMARY sinh từ review step (hoặc cho user chọn). Ghi rõ.

### Phase 3 — UI + i18n

**Step 3.1** — i18n `type_MONTHLY_SUMMARY`
- Thêm `screens.truckReports.type_MONTHLY_SUMMARY` (+ `type_MONTHLY_SUMMARY_desc`) vào vi/en/ko.
- vi: "Tổng kết chi phí tháng" · en: "Monthly cost summary" · ko: "월간 비용 요약".
- └─ **사이드 임팩트**: thiếu key → next-intl throw. Phải sửa **đủ 3 file**.

**Step 3.2** — Cho phép chọn loại ở review step (nếu QĐ-7a giữ chọn)
- `report-review-step.tsx`: `generate()` hiện hardcode `type:'PNL'`. Thêm lựa chọn radio/select loại báo cáo, hoặc **sinh cả 2** (PNL + MONTHLY_SUMMARY) 1 lần. Khuyến nghị: 1 select "Định dạng" mặc định MONTHLY_SUMMARY.
- └─ **사이드 임팩트**: đổi payload `generateTruckReportAction` — `type` đã nằm trong enum, action đã nhận `type`. An toàn.

### Phase 4 — Test đối chiếu
**Step 4.1** — Unit/script đối chiếu ô ↔ core (chi tiết ở TC).
- └─ **사이드 임팩트**: không.

---

## 3. 변경 파일 목록

| Loại | File | Thay đổi |
|---|---|---|
| DB const | `packages/db/src/schema/truck-report.schema.ts` | Sửa — thêm `'MONTHLY_SUMMARY'` vào `TRUCK_REPORT_TYPES` |
| Backend/query | `apps/web/src/server/queries/truck-report-export.queries.ts` | Sửa — `ReportVehiclePnlRow`+field, `summary`, `header`, cờ `includeIdle`, gom Σ per-xe |
| Backend/lib | `apps/web/src/server/lib/truck-monthly-summary-workbook.ts` | **Mới** — builder 1-sheet có công thức |
| Backend/action | `apps/web/src/server/actions/truck-report.actions.ts` | Sửa — nhánh type mới, `REPORT_NAME`, `preparedBy` |
| Frontend | `apps/web/src/app/(app)/truck/reports/_components/report-review-step.tsx` | Sửa — chọn định dạng báo cáo |
| Frontend | `apps/web/src/app/(app)/truck/reports/new/page.tsx` | Sửa (nếu cần) — hiển thị loại mới |
| i18n | `apps/web/messages/vi.json` | Sửa — `type_MONTHLY_SUMMARY(+_desc)` |
| i18n | `apps/web/messages/en.json` | Sửa — như trên |
| i18n | `apps/web/messages/ko.json` | Sửa — như trên |
| Test | `apps/web/src/server/lib/__tests__/truck-monthly-summary.test.ts` | **Mới** — đối chiếu số |

---

## 4. 사이드 임팩트 분석

| Phạm vi | Rủi ro | Mô tả & giảm thiểu |
|---|---|---|
| Builder PNL cũ (3-sheet) | **Trung bình** | Dùng chung `TruckReportExport`. Field mới **optional** + cờ `includeIdle` chỉ bật cho MONTHLY_SUMMARY ⇒ PNL cũ **không đổi**. Verify: regen 1 PNL cũ, so số. |
| Khớp tổng (Σxe vs khối B) | **Cao** | Gom `totals=Σ per-xe` cho báo cáo mới; **không** dùng `driverSalary` fleet. TC ràng buộc `C25==SUM`, `E43==C-block`. |
| `generateAllRegions` batch | Thấp | Vẫn sinh PNL; MONTHLY_SUMMARY từ review. Không phá batch. |
| i18n thiếu key | Thấp | Sửa đủ 3 ngôn ngữ; test render bước chọn loại. |
| Excel formula không cache | Thấp | Set `{formula, result}` để có giá trị cached; test mở bằng openpyxl `data_only`. |
| `trr_type` dài | Không | 15 ≤ 16 ký tự. |
| Role/tenant | Không | Tái dùng guard + `computeTruckPnl` (đã enforce `ent_id`). |

---

## 5. DB 마이그레이션

**Không cần.** `trr_type varchar(16)` đủ chứa `'MONTHLY_SUMMARY'`; snapshot nhiên liệu tái dùng `trr_avg_price/consumption/total_liters/total_km` (0021). Chỉ đổi hằng TypeScript `TRUCK_REPORT_TYPES`.

> Chỉ khi khách chốt **QĐ-6a** (in Tel/Fax) mới thêm `00XX_tenant_company_contact.sql`:
> ```sql
> ALTER TABLE car_tenant_settings ADD COLUMN IF NOT EXISTS tns_company_phone varchar(40);
> ALTER TABLE car_tenant_settings ADD COLUMN IF NOT EXISTS tns_company_fax   varchar(40);
> ```
> Áp thủ công staging (`ep-noisy-heart`) + local; **không** đụng `ep-gentle-rain`.

---

## 6. Thứ tự thực thi & ước lượng
1. Phase 1 (dataset) — nền số, có thể unit-test ngay. *~⅓ effort*
2. Phase 2 (builder) — phần nhìn thấy, đối chiếu ô. *~⅓*
3. Phase 3 (UI/i18n) — nhỏ. *~⅙*
4. Phase 4 (test) + TR/RPT. *~⅙*

**Cổng phê duyệt**: sau REQ+PLAN+TC, chờ user chốt 4 câu hỏi mở (REQ §7) + QĐ-1/QĐ-7 trước khi code.
