# RPT-20260814 — Truck: Lập báo cáo cho nhiều xe cùng lúc (Multi-select Vehicle)

```yaml
document_id: V2-RPT-20260814-REPORT-MULTI-VEHICLE
created: 2026-08-14
author: Claude (dev@amoeba.group)
branch: feature/truck-report-multi-vehicle
status: Implemented — chờ seed dữ liệu để chạy nốt nhóm E/R trước khi mở PR
chain:
  - docs/analysis/REQ-20260814-truck-report-multi-vehicle.md
  - docs/plan/PLN-20260814-truck-report-multi-vehicle.md
  - docs/test/TC-20260814-truck-report-multi-vehicle.md
  - docs/test/TR-20260814-truck-report-multi-vehicle.md
```

## 1. Yêu cầu

Dòng requirement khách hàng: *"Lập báo cáo cho tất cả các xe 1 lúc — cho phép lựa chọn lập báo cáo cho 1-nhiều-Tất cả xe (Multi-select)"*, thay cho hiện trạng *"lập báo cáo theo từng xe"*.

Phân tích xác định yêu cầu nhắm vào **màn Chi phí & Lợi nhuận** (nơi bộ lọc xe đang là single-select), **không phải** wizard chốt sổ — nơi báo cáo vốn đã phủ toàn bộ xe của khu vực.

## 2. Đã làm

### Phase A — Nền tảng

- `resolveVehicleScope(actor, raw)` mới trong [`lib/auth/region-access.ts`](../../apps/web/src/lib/auth/region-access.ts): phân tích CSV → giao với tập xe thuộc khu vực được phép → trả `{ trucks, vehicleIds, isAll }`. ID lạ/ngoài quyền bị loại **im lặng**, giữ đúng hành vi forgiving của `?vehicle=` cũ.
- `listTruckFinanceTrips` nhận `vehicleIds`, ưu tiên hơn `vehicleId`.
- `computeTruckPnl` nhận `vehicleIds` và **giao** với `regionVehicleIds` (không ghi đè như nhánh `vehicleId` cũ) — điểm mấu chốt vì service này cũng phục vụ 2 route export vốn bỏ qua guard của layout.

### Phase B — Route export

- `/truck/finance/export`: nhận `?vehicles=`, **bổ sung ACL khu vực** (vá P3), thêm dòng phạm vi.
- `/truck/pnl/export`: nhận `?vehicles=` (vá P2 — trước đây bỏ qua hoàn toàn bộ lọc xe), nhiều xe → **1 cột/xe + cột TỔNG**, PDF > 6 cột tự xoay ngang.
- `buildExcel` thêm tuỳ chọn `scopeLine`; `buildReportPdf` thêm tuỳ chọn `orientation`. Cả hai mặc định giữ nguyên hành vi cũ.

### Phase C — UI

- Component mới [`ParamMultiSelect`](../../apps/web/src/components/inputs/param-multi-select.tsx): popover checkbox, chỉ push URL khi bấm **Áp dụng**, chọn hết/không chọn → xoá param.
- Wire vào `/truck/finance` và `/truck/pnl` (thay dãy chip 1-lựa-chọn), `FinanceTabs` mang tập xe qua lại 2 tab.
- `ParamSelect` **không đụng** — các dropdown Khu vực/Trạng thái ở mọi màn giữ nguyên.

### Phase D — i18n

7 key mới × 3 ngôn ngữ (vi/en/ko), đặt theo house convention: nhãn UI ở `screens.truckFinance.*`, nội dung file ở `exportContent.truckFinance.*` + `exportContent.truckPnl.*`.

## 3. File thay đổi

| Lớp | File | Loại |
|---|---|---|
| Auth/Lib | `apps/web/src/lib/auth/region-access.ts` | Sửa |
| Query | `apps/web/src/server/queries/truck-finance.queries.ts` | Sửa |
| Core | `packages/core/src/truck/truck-pnl.service.ts` | Sửa |
| Route | `apps/web/src/app/(app)/truck/finance/export/route.ts` | Sửa |
| Route | `apps/web/src/app/(app)/truck/pnl/export/route.ts` | Sửa |
| Lib | `apps/web/src/server/lib/excel.ts` | Sửa |
| Lib | `apps/web/src/server/lib/pdf.ts` | Sửa |
| Frontend | `apps/web/src/components/inputs/param-multi-select.tsx` | **Mới** |
| Frontend | `apps/web/src/app/(app)/truck/finance/page.tsx` | Sửa |
| Frontend | `apps/web/src/app/(app)/truck/pnl/page.tsx` | Sửa |
| Frontend | `apps/web/src/app/(app)/truck/finance/_components/finance-tabs.tsx` | Sửa |
| i18n | `apps/web/messages/{vi,en,ko}.json` | Sửa |
| DB | — | **Không có migration** |

## 4. Lệch so với kế hoạch

| # | PLAN | Thực tế | Lý do |
|---|---|---|---|
| 1 | `ParamMultiSelect` nhận `nSelectedLabel: (n) => string` | Nhận `buttonLabel: string` render sẵn ở server | Function không qua được ranh giới RSC. Số lượng đã áp dụng vốn đã biết ở server nên không mất tính năng |
| 2 | Key i18n đặt ở `screens.truckFinance.*` | Nhãn UI ở `screens.*`, nội dung file ở `exportContent.*` | Bám house convention (mỗi namespace export tự chứa) |
| 3 | Không đề cập | Thêm tuỳ chọn `orientation` cho `buildReportPdf` | Cần cho yêu cầu B3 (PDF nhiều cột xoay ngang); mặc định portrait nên caller cũ không đổi |
| 4 | Không đề cập | Xoá `Chip` + `permittedCodes` khỏi `pnl/page.tsx` | Thành code chết sau khi thay chip bằng multi-select |

## 5. Kiểm thử

`tsc --noEmit` exit 0 · `next lint` không lỗi mới · `next build` thành công.

**47/70 TC pass, 0 fail.** Đã seed dữ liệu lên Neon DEV (`ep-steep-tooth`) và chạy trọn 2 nhóm điều kiện-pass:

- **Nhóm E (ACL): 10/10 PASS** — E04 là bằng chứng vá P3 (file export của user thu hẹp chỉ còn xe HCM); E06 cho thấy doanh thu mgr1 = 29.9tr vs mgr2 = 52.7tr.
- **Nhóm R (Regression): 8/10 PASS** bằng so sánh **A/B thật** (chụp fingerprint → `git stash` → chụp baseline → so sánh): P&L export 11 dòng và finance export 12 dòng **khớp 100%**; dashboard 32/32 số trùng khớp. Chênh lệch duy nhất là mảnh biển số biến mất khỏi HTML — đúng bằng số chip chuyển vào popover đóng.
- **R04/R07 không chạy được** ở môi trường này (browser pane wedge + không gọi được Server Action). Chi tiết và bằng chứng gián tiếp ở [TR §6](../test/TR-20260814-truck-report-multi-vehicle.md).

1 lỗi phát hiện và đã sửa trong lúc test: prop function truyền qua ranh giới RSC làm trắng màn Chi phí & Lợi nhuận.

## 6. Còn lại trước khi mở PR

- [x] Seed dữ liệu theo TC §Setup — đã chạy trên Neon DEV
- [x] Chạy trọn **nhóm E** (10/10 PASS) và **nhóm R** (8/10 PASS)
- [ ] **R04 + R07 phải chạy trên staging** sau khi deploy — bắt buộc trước khi cân nhắc lên production
- [x] Ghi release note cho 2 thay đổi hành vi có chủ đích (§7) — [RELEASE-NOTE-20260814](RELEASE-NOTE-20260814-truck-report-multi-vehicle.md)
- [x] Xoá dữ liệu seed khỏi Neon DEV — đã xoá 26 row, DB về đúng trạng thái trước seed ([TR §8](../test/TR-20260814-truck-report-multi-vehicle.md))

## 7. Ghi chú vận hành (release note)

1. **`/truck/finance/export` từ nay áp ACL khu vực.** User bị thu hẹp sẽ nhận file ít dòng hơn trước. Trước đây file chứa mọi khu vực — đó là lỗ hổng bảo mật (REQ-20260813 chưa phủ tới route này), không phải tính năng.
2. **`/truck/pnl/export` từ nay áp bộ lọc xe.** Trước đây luôn xuất cả khu vực dù màn hình đang lọc 1 xe.

## 8. Chưa làm (theo thiết kế)

- Wizard `/truck/reports/new` **giữ nguyên** granularity khu vực / toàn bộ xe (REQ §6.1, R6) — thêm trục chọn xe ở đây sẽ làm các xe không được chọn mất snapshot nhiên liệu và đổi số của chuyến đã chốt.
- Template `MONTHLY_SUMMARY` (form R1) không đổi.
- 4 giả định ở REQ §7 vẫn **chờ khách xác nhận**, trong đó GĐ-4 (cột `FALSE/FALSE/TRUE`) có thể là yêu cầu thứ 2 về quyền role — cần REQ riêng.
