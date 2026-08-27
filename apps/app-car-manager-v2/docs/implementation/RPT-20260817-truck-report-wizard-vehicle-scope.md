# RPT-20260817 — Truck: Cho phép chọn xe khi Lập báo cáo chính thức (Wizard chốt sổ)

```yaml
document_id: V2-RPT-20260817-REPORT-WIZARD-VEHICLE-SCOPE
created: 2026-08-17
author: Claude (dev@amoeba.group)
branch: feature/truck-report-multi-vehicle
status: Implemented — round-trip "Lập báo cáo" thật đã verify qua UI thật + file Excel export đã đối chiếu khớp 100%; đủ điều kiện mở PR vào staging
chain:
  - docs/analysis/REQ-20260817-truck-report-wizard-vehicle-scope.md
  - docs/plan/PLN-20260817-truck-report-wizard-vehicle-scope.md
  - docs/test/TC-20260817-truck-report-wizard-vehicle-scope.md
  - docs/test/TR-20260817-truck-report-wizard-vehicle-scope.md
```

## 1. Yêu cầu

Người dùng phản hồi sau REQ-20260814 (multi-select xe ở 2 màn trích xuất): *"phần lập báo cáo phải có bước chọn xe chứ"* — muốn wizard chốt sổ chính thức (`/truck/reports/new`) cũng có bước chọn xe, việc REQ-20260814 §6.1 đã cố tình loại trừ vì rủi ro làm mất số liệu đã đóng băng của xe khác.

Khi được hỏi cụ thể, người dùng không chọn thẳng phương án mà chỉ đạo: *"tất nhiên phải verify tốt quan hệ giữa xe, tài xế, và khu vực... hãy check kỹ"* — dẫn tới việc thêm hẳn Phase A0 (xác thực quan hệ xe–tài xế–khu vực) làm trọng tâm, và đi theo mặc định an toàn cho câu hỏi còn lại (MONTHLY_SUMMARY giữ nguyên toàn khu vực).

## 2. Đã làm

### Phase A0 — Xác thực quan hệ xe–tài xế–khu vực

- `resolveReportVehicleScope(actor, region, rawIds)` mới trong [`region-access.ts`](../../apps/web/src/lib/auth/region-access.ts) — khác `resolveVehicleScope` (REQ-20260814, dùng cho trích xuất đa khu vực): khoá cứng 1 khu vực, truy vấn lại **live** từ DB mỗi lần gọi (không tin danh sách wizard đã render), và **báo lỗi cứng** (không âm thầm fallback "Tất cả") khi toàn bộ ID gửi lên đều không hợp lệ.
- `generateTruckReportAction` gọi lại hàm này **ngay trong action**, độc lập với những gì UI đã hiển thị — chặn xe sai khu vực/ngoài ACL/đã xoá dù bị chèn trực tiếp qua request giả mạo.
- Quan hệ tài xế: xác nhận không có ACL riêng cho tài xế (chỉ là dữ liệu mô tả + nguồn lương cố định qua `cvh_default_driver_id`) — không cần thêm cơ chế mới, chỉ cần đảm bảo lọc theo xe không làm vỡ luồng hiển thị tên tài xế/lương đã có.

### Phase A — BL-1: Fold theo xe (thay fold theo report)

- Migration `0027_truck_report_vehicle_ids.sql`: thêm `trr_vehicle_ids JSONB` nullable, additive, không backfill.
- Viết lại `loadTruckRegionSnapshots` ([`truck-fuel-snapshot.ts`](../../packages/core/src/truck/truck-fuel-snapshot.ts)): duyệt MỌI report theo thứ tự tạo tăng dần thay vì chỉ lấy report mới nhất/scope; report toàn khu vực (`trr_vehicle_ids = NULL`) ghi đè mọi xe như cũ; report tập con **chỉ** ghi đè đúng xe nó khai báo — xe ngoài tập con giữ nguyên số của report trước.
- `reported`/`reportedAt` (theo khu vực) giữ nguyên cho report toàn khu vực; thêm `vehicleReportedAt` (theo xe) cho report tập con — `isReported` giờ kiểm tra cả hai chiều.
- `getTruckFuelStatsByVehicle` nhận thêm `vehicleIds` để lọc pool khi đóng băng cho report tập con.

### Phase B — Report export/action theo tập xe

- `getTruckReportExport` nhận `vehicleIds`, lọc `scopeVehicles`/trips/`computeTruckPnl` khi **không phải** MONTHLY_SUMMARY (đề xuất GĐ-A: form R1 khách đã duyệt luôn giữ nguyên toàn khu vực).
- `generateOneTruckReport`/`generateTruckReportAction` xâu chuỗi `vehicleIds` qua toàn bộ 4 loại báo cáo, ghi `trr_vehicle_ids`, ép `vehicleIds = undefined` cứng khi `type === 'MONTHLY_SUMMARY'` (2 lớp bảo vệ: UI + server).
- `reportName()` thêm nhánh "· n/m xe".
- `getTruckReportReview` nhận `vehicleIds` để bước Review hiển thị đúng tập đã chọn.

### Phase C — UI wizard

- Bước mới `report-vehicle-step.tsx` — checkbox theo xe, mặc định "Tất cả", tái dùng ACL qua `resolveReportVehicleScope`. Đa khu vực → lặp bước này cho từng khu vực (tích luỹ vào query param `vf`), khu vực "Tất cả" (consolidated) bỏ qua hẳn bước này.
- `ReportStepper` mở rộng 3→4 bước (Tháng / Khu vực / **Chọn xe** / Xác nhận).
- `ReportReviewStep` nhận `vehicleIdsByRegion`, hiện banner cảnh báo khi chọn MONTHLY_SUMMARY sau khi đã thu hẹp xe.

### Phase D — i18n

10 key mới × 3 ngôn ngữ (vi/en/ko).

## 3. File thay đổi

| Lớp | File | Loại |
|---|---|---|
| Auth/Lib | `apps/web/src/lib/auth/region-access.ts` | Sửa |
| DB | `packages/db/src/schema/truck-report.schema.ts` | Sửa |
| DB | `packages/db/migrations/0027_truck_report_vehicle_ids.sql` | **Mới** |
| DB | `packages/db/migrations/meta/_journal.json` | Sửa |
| Core | `packages/core/src/truck/truck-fuel-snapshot.ts` | Sửa (trọng tâm) |
| Query | `apps/web/src/server/queries/truck-finance.queries.ts` | Sửa |
| Query | `apps/web/src/server/queries/truck-report-export.queries.ts` | Sửa |
| Action | `apps/web/src/server/actions/truck-report.actions.ts` | Sửa |
| Frontend | `.../reports/_components/report-vehicle-step.tsx` | **Mới** |
| Frontend | `.../reports/_components/report-stepper.tsx` | Sửa |
| Frontend | `.../reports/_components/report-review-step.tsx` | Sửa |
| Frontend | `.../reports/new/page.tsx` | Sửa |
| i18n | `apps/web/messages/{vi,en,ko}.json` | Sửa |

## 4. Lệch so với kế hoạch

| # | PLAN | Thực tế | Lý do |
|---|---|---|---|
| 1 | Không đề cập tên file "n/m xe" cần tổng số xe | `generateOneTruckReport` nhận thêm `vehicleTotal` để hiển thị đúng "n/m" | `reportName` cần biết tổng số xe của khu vực, không chỉ số đã chọn |
| 2 | Không đề cập | `hasSnapshot` (cột region-pool legacy) ép `false` khi có `vehicleIds` | Report tập con không nên claim đại diện region-pool — tránh dữ liệu gây hiểu nhầm dù fold logic đã bỏ qua nó |

## 5. Kiểm thử

Xem [TR-20260817](../test/TR-20260817-truck-report-wizard-vehicle-scope.md). Tóm tắt: build/lint/typecheck xanh; BL-1 verify bằng dữ liệu synthetic thật trên Neon DEV (không mock); routing wizard verify qua SSR fetch. **Chưa** test được round-trip "Lập báo cáo" thật qua UI (giới hạn môi trường, giống TR-20260814).

## 6. Còn lại trước khi mở PR

- [x] Migration áp lên Neon DEV, xác nhận cột tồn tại
- [x] BL-1 verify bằng dữ liệu thật (không mock)
- [x] Routing wizard (bước 3 xuất hiện/biến mất đúng điều kiện) verify qua SSR
- [x] **Round-trip "Lập báo cáo" thật (bấm nút) qua UI thật** — PASS, xem TR-20260817 §2. File Excel export đã đối chiếu khớp 100%
- [x] Dọn `packages/core/dist` cục bộ (gitignored, không ảnh hưởng repo)
- [x] Báo cáo test (`Chi phí & lợi nhuận · Khu vực HCM · 1/2 xe`, tháng 8/2026) đã dọn sạch — soft-delete DB row + xoá file S3

## 7. Chưa làm (theo thiết kế)

- MONTHLY_SUMMARY không hỗ trợ chọn xe (GĐ-A) — nếu khách hàng xác nhận muốn khác, cần REQ riêng vì đụng tới form đã duyệt.
- Không hỗ trợ chọn xe xuyên nhiều khu vực trong 1 report (khớp REQ §6.1 — mỗi report vẫn tối đa 1 khu vực).
