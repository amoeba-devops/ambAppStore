# PLN-20260817 — Truck: Cho phép chọn xe khi Lập báo cáo chính thức (Wizard chốt sổ)

```yaml
document_id: V2-PLN-20260817-REPORT-WIZARD-VEHICLE-SCOPE
based_on: docs/analysis/REQ-20260817-truck-report-wizard-vehicle-scope.md
created: 2026-08-17
author: Claude (dev@amoeba.group)
quyết_định_đã_chốt:
  - "GĐ-B (đã xác nhận): CHO PHÉP lập báo cáo tập con nhiều lần trong cùng tháng/khu vực — BL-1 (fold theo xe) là bắt buộc, không phải tuỳ chọn."
  - "GĐ-A (mặc định đề xuất, CHƯA có xác nhận rõ ràng — xem §0): MONTHLY_SUMMARY giữ nguyên toàn khu vực, không cho chọn xe. Người dùng yêu cầu 'verify tốt quan hệ xe–tài xế–khu vực' — đã đưa thành Phase A0 riêng, xem bên dưới."
```

## 0. Làm rõ chỉ đạo của người dùng trước khi lên kế hoạch

Câu trả lời của người dùng cho câu hỏi GĐ-A không chọn thẳng 1 trong 2 phương án, mà là chỉ đạo:

> *"tất nhiên phải verify tốt quan hệ giữa xe, tài xế, và khu vực, mới cho xuất hay không, hãy check kỹ, và implement đúng"*

Diễn giải: đây là **yêu cầu về mức độ chặt chẽ của việc validate**, không phải câu trả lời trực tiếp cho câu hỏi "MONTHLY_SUMMARY có cho chọn xe không". PLAN này xử lý bằng cách:

1. **Vẫn đi theo mặc định đề xuất** cho GĐ-A (MONTHLY_SUMMARY giữ nguyên toàn khu vực) — vì đây là lựa chọn AN TOÀN hơn (không đụng form khách đã duyệt) và không có chỉ đạo nào phủ nhận nó. Sẽ nêu rõ trong TR/RPT để người dùng có thể sửa nếu hiểu sai ý.
2. **Thêm hẳn 1 bước (Phase A0)** kiểm tra + củng cố quan hệ **xe ↔ tài xế ↔ khu vực** trước khi cho phép chọn xe ở wizard — đây là phần thực thi trực tiếp chỉ đạo của người dùng, xem §2 Phase A0.

### 0.1 Quan hệ xe–tài xế–khu vực trong schema hiện tại (đã audit)

| Quan hệ | Cột / bảng | Ràng buộc hiện có | Đánh giá |
|---|---|---|---|
| Xe → Khu vực | `car_vehicles.cvh_region` (nullable, code từ `TRUCK_REGIONS`) | Không FK cứng (varchar) — hợp lệ hoá qua `TRUCK_REGIONS` enum ở tầng app | Đủ — không có bảng `region` riêng để FK tới |
| Xe → Tài xế mặc định | `car_vehicles.cvh_default_driver_id` → `car_drivers.drv_id` (app-level ref, không FK DB) | Nullable — 1 xe có thể chưa gán tài xế | Tài xế **không có** cột khu vực riêng — tài xế "thuộc" khu vực nào hoàn toàn qua việc là `cvh_default_driver_id` của 1 xe thuộc khu vực đó. **Không có bảng ACL riêng cho tài xế** |
| User → Khu vực (ACL) | `car_user_region_access` (REQ-20260813) | Có, qua `resolveRegionAccess`/`allowedRegions` | Đã kiểm chứng kỹ ở REQ-20260814 (nhóm E, 10/10 PASS) |
| User → Xe (suy ra) | `resolveVehicleScope()` = xe có `cvh_region ∈ allowedRegions(user)` | Có, tái dùng được | Là đúng cơ chế cần dùng cho bước chọn xe mới |

**Kết luận kiểm tra**: quan hệ "xe ↔ khu vực" đã có ACL chặt (REQ-20260813/814, đã test kỹ). Quan hệ "xe ↔ tài xế" **không phải quan hệ bảo mật** (không có ACL riêng cho tài xế) — nó chỉ là **nguồn dữ liệu** (tên tài xế hiển thị + lương cố định hàng tháng đưa vào P&L, xem `truck-report-export.queries.ts:278-282,363`). Vì vậy "verify quan hệ tài xế" ở đây nghĩa là: **đảm bảo khi lọc theo tập xe, thông tin tài xế mặc định đi kèm mỗi xe vẫn đúng và không rơi rớt** — không phải thêm 1 tầng ACL mới cho tài xế (vì không tồn tại khái niệm đó trong hệ thống).

### 0.2 Việc "check kỹ, implement đúng" được cụ thể hoá thành

- **Phase A0** (mới, xem §2): viết lại rõ ràng, có test riêng, cho đúng 3 quan hệ trên tại **tầng server action** (không tin dữ liệu từ client) — không chỉ tái dùng `resolveVehicleScope` cho hiển thị mà còn **validate lại y hệt bên trong `generateTruckReportAction`**, đúng nguyên tắc "route xuất file bỏ qua guard của layout" đã từng là lỗ hổng P3 ở REQ-20260814.
- Test case riêng (xem TC nhóm mới) cho: xe ngoài ACL khu vực bị chèn vào `vehicleIds` → bị loại; xe thuộc khu vực khác khu vực đang chốt sổ bị chèn vào → bị loại; xe đã bị soft-delete giữa lúc mở wizard và lúc bấm xác nhận → bị loại; tài xế mặc định của 1 xe bị null/xoá → dòng vẫn lên báo cáo, lương cố định = 0 thay vì crash.

---

## 1. Hiện trạng hệ thống (tham chiếu REQ §2, không lặp lại)

- Turborepo `app-car-manager-v2`, Next.js 15 App Router, Drizzle + Neon Postgres — xem CLAUDE.md.
- File lõi cần sửa đã xác định ở REQ §4.3.
- Constraint quan trọng nhất: `synchronize` tắt ở staging/production → mọi thay đổi schema cần SQL thủ công (xem §5).

---

## 2. Kế hoạch triển khai theo Phase

### Phase A0 — Củng cố xác thực quan hệ xe–tài xế–khu vực (MỚI, ưu tiên cao nhất)

- **A0.1** Viết hàm mới `resolveReportVehicleScope(actor, region, rawVehicleIds)` trong `region-access.ts` — biến thể của `resolveVehicleScope` nhưng khoá cứng theo **1 khu vực cụ thể đang chốt sổ** (khác với `resolveVehicleScope` hiện dùng cho trích xuất, vốn cho phép trộn nhiều khu vực). Trả về `{ vehicles: VehicleListItem[], vehicleIds: string[] | undefined }` với mọi id: (a) thuộc `entId` hiện tại, (b) `cvhType = 'TRUCK'`, (c) `cvhDeletedAt IS NULL` tại **thời điểm generate** (không chỉ thời điểm mở wizard), (d) `cvhRegion = region`, (e) `region ∈ allowedRegions(actor)`.
  - └─ *Sự cố phụ*: đây là điểm khác biệt so với REQ-20260814's `resolveVehicleScope` (cho phép xe nhiều khu vực trong 1 lần trích xuất) — PHẢI là hàm riêng, không sửa `resolveVehicleScope` cũ (tránh phá vỡ hành vi 2 màn trích xuất đã ổn định).
- **A0.2** `generateTruckReportAction` gọi `resolveReportVehicleScope` **lại từ đầu** bằng `region` + `vehicleIds` nhận từ input — không tin tưởng bất kỳ danh sách nào wizard đã hiển thị trước đó (khác biệt thời gian giữa lúc mở wizard và lúc bấm xác nhận là có thật: xe có thể bị xoá/đổi khu vực trong lúc đó).
  - └─ *Sự cố phụ*: nếu sau khi lọc lại, tập xe hợp lệ RỖNG (toàn bộ id gửi lên đều bị loại) → trả lỗi rõ ràng thay vì âm thầm coi là "Tất cả xe" (khác với hành vi "ID rác → về Tất cả" của `resolveVehicleScope`, vì ở đây hậu quả là chốt sổ sai phạm vi — phải chặn cứng, không suy diễn).
- **A0.3** Test riêng (TC nhóm A0): xe ngoài khu vực, xe ngoài ACL, xe đã xoá, xe không có tài xế mặc định, xe có tài xế mặc định đã bị xoá — tất cả phải cho kết quả đúng, không crash.

### Phase A — Nền tảng dữ liệu (BL-1, trọng tâm rủi ro)

- **A1** Migration: thêm `trr_vehicle_ids JSONB NULL` vào `car_truck_reports` ([schema](../../packages/db/src/schema/truck-report.schema.ts)).
  - └─ *Sự cố phụ*: hoàn toàn additive, không backfill; mọi row cũ tự động NULL = "toàn khu vực" (không đổi hành vi lịch sử).
- **A2** Viết lại fold trong `loadTruckRegionSnapshots` ([truck-fuel-snapshot.ts](../../packages/core/src/truck/truck-fuel-snapshot.ts)): thay `latestByScope` (1 report thắng tất theo scope) bằng vòng lặp theo xe (REQ §3.2 BL-1) — với report `trr_vehicle_ids IS NULL` ghi đè mọi xe trong khu vực; report có tập con chỉ ghi đè đúng tập đó. Áp dụng cho cả `vehicleSnap` (đóng băng costPerKm) và `reportedAt` (badge "Đã lập BC").
  - └─ *Sự cố phụ nghiêm trọng*: đây là hàm được gọi bởi **mọi** màn hình đọc phí nhiên liệu (dashboard, finance, pnl, trips, exports, report review) — sửa sai ở đây ảnh hưởng toàn bộ số liệu tài chính hiển thị. Bắt buộc chạy lại nguyên nhóm R01-R09 (REQ-20260814) + test case mới của BL-1 trước khi coi Phase A xong.
- **A3** `getTruckFuelStatsByVehicle` ([truck-finance.queries.ts:205](../../apps/web/src/server/queries/truck-finance.queries.ts#L205)): thêm tham số `vehicleIds?: readonly string[]` — lọc `loadVehicleFuelPool` output theo tập này trước khi trả về (không đổi công thức, chỉ lọc kết quả).
  - └─ *Sự cố phụ*: không ảnh hưởng caller cũ (tham số optional, mặc định = không lọc).

### Phase B — Report export/action theo tập xe

- **B1** `getTruckReportExport` ([truck-report-export.queries.ts](../../apps/web/src/server/queries/truck-report-export.queries.ts)): thêm tham số `vehicleIds?: readonly string[]`.
  - Khi có: lọc `scopeVehicles`, `rowVehicleIds` theo tập này (dòng 272-328) — TRỪ KHI `opts.includeIdle === true` (đường MONTHLY_SUMMARY, xem A0/GĐ-A) thì bỏ qua tham số này, giữ nguyên toàn khu vực.
  - └─ *Sự cố phụ*: `computeTruckPnl` đã hỗ trợ sẵn `vehicleIds` giao với `region` (REQ-20260814, `truck-pnl.service.ts:157-168`) — B1 chỉ cần truyền tiếp, không viết logic giao-tập mới.
- **B2** `generateOneTruckReport` + `generateTruckReportAction` ([truck-report.actions.ts](../../apps/web/src/server/actions/truck-report.actions.ts)): nhận `vehicleIds?: string[]`; khi `type !== 'MONTHLY_SUMMARY'` và có `vehicleIds` → gọi A0.2 validate lại, ghi `trrVehicleIds` vào row, truyền `vehicleIds` vào `getTruckFuelStatsByVehicle` (A3) và `buildReportWorkbook`/`getTruckReportExport` (B1).
  - └─ *Sự cố phụ*: `generateAllRegionsTruckReportsAction` (batch "làm mới tất cả khu vực" từ màn finance) **không đổi** — luôn luôn toàn bộ xe mỗi khu vực, không nhận `vehicleIds` (đúng ý nghĩa "làm mới toàn bộ").
- **B3** `reportName()` ([truck-report.actions.ts:56-65](../../apps/web/src/server/actions/truck-report.actions.ts#L56)): thêm nhánh nhãn "· n/m xe" khi có `trrVehicleIds`.

### Phase C — UI wizard bước 2.5

- **C1** Component mới `report-vehicle-step.tsx`: tái dùng `resolveReportVehicleScope` (A0.1) để lấy danh sách xe theo ĐÚNG khu vực đang xử lý (không phải nhiều khu vực trộn như `ParamMultiSelect`); layout tái dùng pattern checkbox của `report-region-step.tsx`.
- **C2** `reports/new/page.tsx`: chèn bước 2.5 giữa Bước 2 (khu vực) và Bước 3 (review); với luồng nhiều khu vực (`regions=A,B`), lặp bước 2.5 cho từng khu vực tuần tự (giữ đúng thứ tự canonical `TRUCK_REGIONS`).
- **C3** `report-review-step.tsx`: lọc `review.vehicles` theo tập đã chọn ở bước 2.5 trước khi render; khi định dạng chọn là `MONTHLY_SUMMARY`, hiện banner "Định dạng này luôn phủ toàn bộ khu vực — bỏ qua lựa chọn xe" (GĐ-A) và review lại hiện đủ xe.
  - └─ *Sự cố phụ*: format picker đã nằm ở bước Review (không phải bước riêng) — nghĩa là bước 2.5 phải cho phép chọn xe TRƯỚC KHI biết định dạng cuối; nếu người dùng đổi sang MONTHLY_SUMMARY ở bước 3 sau khi đã thu hẹp xe ở bước 2.5, review phải tự mở rộng lại về toàn bộ khu vực (không giữ tập đã chọn) và báo rõ lý do — tránh hiểu nhầm "đã chọn 3 xe nhưng báo cáo lại có 8 xe".

### Phase D — i18n

- 6-8 key mới × 3 ngôn ngữ: tiêu đề bước 2.5, hint, banner MONTHLY_SUMMARY, cảnh báo "xe không chọn giữ nguyên số cũ", nhãn "n/m xe" trong tên báo cáo và danh sách.

---

## 3. Bảng file thay đổi

| Khu vực | File | Loại | Phase |
|---|---|---|---|
| Auth/Lib | `apps/web/src/lib/auth/region-access.ts` (+`resolveReportVehicleScope`) | Sửa | A0 |
| DB | `packages/db/src/schema/truck-report.schema.ts` | Sửa | A1 |
| DB | migration mới `00XX_truck_report_vehicle_ids.sql` | Mới | A1 |
| Core | `packages/core/src/truck/truck-fuel-snapshot.ts` | Sửa | A2 |
| Query | `apps/web/src/server/queries/truck-finance.queries.ts` | Sửa | A3 |
| Query | `apps/web/src/server/queries/truck-report-export.queries.ts` | Sửa | B1 |
| Action | `apps/web/src/server/actions/truck-report.actions.ts` | Sửa | A0.2, B2, B3 |
| Frontend | `apps/web/src/app/(app)/truck/reports/_components/report-vehicle-step.tsx` | **Mới** | C1 |
| Frontend | `apps/web/src/app/(app)/truck/reports/new/page.tsx` | Sửa | C2 |
| Frontend | `apps/web/src/app/(app)/truck/reports/_components/report-review-step.tsx` | Sửa | C3 |
| i18n | `apps/web/messages/{vi,en,ko}.json` | Sửa | D |

---

## 4. Phân tích Sự cố phụ (Side Impact)

| Phạm vi | Rủi ro | Mô tả |
|---|---|---|
| `loadTruckRegionSnapshots` (A2) | 🔴 Cao | Nguồn sự thật fuel cho toàn app — sai ở đây ảnh hưởng dashboard/finance/pnl/trips/exports cùng lúc. Bắt buộc regression đầy đủ (R01-R09 cũ + case mới của BL-1) trước khi merge |
| `generateTruckReportAction` (A0.2, B2) | 🟡 Trung bình-Cao | Validate lại từ đầu ở server, không tin input client — đúng nguyên tắc đã áp dụng khi vá P3 (REQ-20260814) |
| `generateAllRegionsTruckReportsAction` | ⬜ Không | Không nhận `vehicleIds`, hành vi không đổi |
| 2 màn trích xuất `/truck/finance`, `/truck/pnl` (REQ-20260814) | ⬜ Không | Không chạm file này |
| `MONTHLY_SUMMARY` (form R1) | ⬜ Không (theo GĐ-A mặc định) | Luôn toàn khu vực — nếu người dùng phản hồi khác ở bước duyệt TR, đây là điểm cần sửa đầu tiên |
| UI wizard (C1-C3) | 🟡 Trung bình | Thêm 1 bước, nhưng bước cũ (bỏ qua = Tất cả xe) giữ hành vi AS-IS y hệt |

---

## 5. Chiến lược Migration DB

```sql
-- 00XX_truck_report_vehicle_ids.sql
ALTER TABLE car_truck_reports
  ADD COLUMN trr_vehicle_ids JSONB;
```

- Không backfill: `NULL` cho mọi row hiện có đã đúng nghĩa "phủ toàn bộ khu vực".
- Additive-only, an toàn chạy trên staging/production theo quy trình sẵn có (`synchronize` tắt, áp SQL thủ công qua `db:migrate:staging`/`db:migrate:prod`).
- Đăng ký migration vào `packages/db/migrations/meta/_journal.json` như các migration trước (xem `reference_carv2_migration_journal` — journal chỉ đến 0007 trong lịch sử dự án, các bản sau áp thủ công + baseline watermark; migration này cần được đăng ký nhất quán theo đúng cách các migration 0023-0026 đã làm).

---

## 6. Bước tiếp theo

1. ✅ REQ, ✅ PLAN (tài liệu này)
2. ⬜ `docs/test/TC-20260817-truck-report-wizard-vehicle-scope.md` — bổ sung hẳn 1 nhóm TC cho Phase A0 (xác thực quan hệ xe–tài xế–khu vực) theo đúng chỉ đạo của người dùng
3. ⏸️ Cổng duyệt người dùng — chờ chỉ thị "triển khai"
