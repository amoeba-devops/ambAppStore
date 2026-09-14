# REQ-20260908 — Truck: Lương + Khấu hao không phân bổ theo chuyến (giống Bảo trì)

> **Yêu cầu gốc (2026-09-08, nguyên văn)**
> "check cho tôi app car truck muốn đổi lại Lương và Khấu hao không phân bổ theo chuyến - như Bảo trì luôn"

Phạm vi: workspace TRUCK của `apps/app-car-manager-v2` (`/truck/*`). Không đụng phân hệ CAR.

## 1. AS-IS trước khi đổi

Lương + khấu hao được phân bổ theo chuyến (`salary ÷ số chuyến COMPLETED của xe trong tháng`), implement theo
đúng công thức trong sheet tham chiếu của khách hàng ("CR TRUCK APP" Sheet3, [RPT-20260725](../implementation/RPT-20260725-truck-sheet3-fixed-allocation.md)),
verify khớp số và gửi ảnh xác nhận cho khách hàng trên staging (2026-07-25). Đóng băng khi lập BC
(`trr_fixed_alloc`, [REQ-20260821](REQ-20260821-truck-freeze-allocation-until-report.md)) để trip CRUD sau
báo cáo không làm đổi số các chuyến đã báo cáo.

Bảo trì ([REQ-20260904](REQ-20260904-truck-maintenance.md), BR-6) được chốt rõ **không phân bổ theo chuyến** —
chỉ cộng vào `fixedCost` cấp tháng.

Người dùng xác nhận (2026-09-08): đảo ngược quyết định 2026-07-25 là chủ đích — không cần hỏi lại khách hàng,
vì thay đổi chỉ ảnh hưởng màn hình trong app (Finance tab, Chi tiết chuyến), **không ảnh hưởng** file Excel
báo cáo tháng chính thức gửi khách (`truck-report-export.queries.ts` chỉ dùng `fixedCost` cấp tháng, chưa bao
giờ dùng số phân bổ theo chuyến).

## 2. TO-BE

Lương + khấu hao xử lý giống hệt Bảo trì: chỉ là 2 trong 3 thành phần của `fixedCost` cấp tháng
(`computeTruckPnl` — **không đổi công thức, không đổi rule "về 0 khi 0 chuyến"**). Bỏ hoàn toàn:

- Phân bổ live theo chuyến (`loadTruckFixedAllocation`, "lương ÷ N chuyến")
- Đóng băng theo BC (`computeTruckFixedAllocRows`, cột `trr_fixed_alloc`, `fixedShareForTrip`)
- Cột "CP CỐ ĐỊNH PHÂN BỔ" + `profitAfterFixed` trên Finance tab "Theo chuyến"
- 2 dòng "Lương phân bổ" / "Khấu hao phân bổ" + LN sau phân bổ trên Chi tiết chuyến
- 3 cột tương ứng trên export Finance Excel

Lợi nhuận/chuyến ở mọi nơi trên = `revenue − fuel − toll − extra` (biến phí only, giá trị `profit` đã có sẵn
song song với `profitAfterFixed` trước đây). Card "Chi phí cố định" trên Finance tab giữ nguyên tổng tháng,
chỉ đổi ghi chú thành "không phân bổ theo chuyến" (áp dụng chung cho cả 3 thành phần, thay vì chỉ nhắc riêng
phần bảo trì như trước).

## 3. Không đổi

- `computeTruckPnl` / `truck-pnl.service.ts` — công thức `fixedCost = salary + depreciation + maintenanceCost`
  cấp tháng giữ nguyên 100%. Dashboard, P&L tab "Tổng quan", export P&L không đổi số.
- `truck-report-export.queries.ts` + workbook tháng gửi khách — không đổi (chưa từng dùng số phân bổ theo chuyến).
- Cột DB `trr_fixed_alloc` (migration 0029) — giữ nguyên, không drop (báo cáo lịch sử vẫn đọc được), chỉ
  ngừng ghi giá trị mới (luôn NULL từ nay).
- Cơ chế đóng băng nhiên liệu (`trr_vehicle_fuel`, fuel-zero freeze REQ-20260821 follow-up) — không liên quan,
  giữ nguyên hoàn toàn.

## 4. Gap analysis — file đã đổi

| Khu vực | File | Thay đổi |
|---|---|---|
| Core | `packages/core/src/truck/truck-fixed-allocation.ts` | **Xoá file** (`loadTruckFixedAllocation`, `computeTruckFixedAllocRows`) |
| Core | `packages/core/src/truck/index.ts` | Bỏ export |
| Core | `packages/core/src/truck/truck-fuel-snapshot.ts` | Bỏ `fixedShareForTrip`, `fixedAllocFrozen`, đọc cột `trrFixedAlloc` |
| Core | `packages/core/src/truck/truck-maintenance.ts` | Sửa comment tham chiếu hàm đã xoá |
| DB | `packages/db/src/schema/truck-report.schema.ts` | Comment `trrFixedAlloc` → `@deprecated`, giữ cột |
| Action | `apps/web/src/server/actions/truck-report.actions.ts` | Bỏ gọi `computeTruckFixedAllocRows` + ghi `trrFixedAlloc`; thêm helper `resolveTruckVehicleIds` thay thế phần lấy danh sách xe trong scope (dùng cho fuel-zero freeze) |
| Query | `apps/web/src/server/queries/truck-finance.queries.ts`, `truck-trips.queries.ts` | Bỏ `salaryAllocated`/`depreciationAllocated`/`profitAfterFixed`/`fixedTripCount` |
| UI | `truck/finance/page.tsx`, `truck/trips/[id]/page.tsx`, `trips/[id]/page.tsx`, `trips/[id]/_components/truck-trip-detail.tsx` | Bỏ cột/dòng phân bổ, `profit` thay `profitAfterFixed`; note `sumFixedNote` thay `sumFixedMaintNote` |
| Export | `truck/finance/export/route.ts` | Bỏ 3 cột (LN trước CPCĐ, lương phân bổ, KH phân bổ) |
| i18n | `messages/{vi,en,ko}.json` | Xoá key `thFixedAlloc*`, `allocSalaryShort/DeprShort`, `salaryAllocated`, `depreciationAllocated`, `allocNote`, `colProfitBeforeFixed`, `colSalaryAllocated`, `colDepreciationAllocated`; đổi `sumFixedMaintNote`→`sumFixedNote`, `colProfit` label |
| E2E | `e2e/truck-fixed-alloc-freeze.spec.ts` | **Xoá** (TC-01/02/03/04/05/08 test tính năng đã bỏ) |
| E2E | `e2e/truck-fuel-zero-freeze.spec.ts` | **File mới** — tách TC-13/14 (fuel-zero freeze, không liên quan) ra khỏi file trên |
| E2E | `e2e/helpers/truck-seed.ts` | Xoá `seedDongNaiFixedCost`, `addThirdDongNaiTrip`, `softDeleteThirdDongNaiTrip`, `latestReportFixedAlloc`, `nullifyReportFixedAlloc` + fixture ID `TFC_DN`/`T_DN_3` không dùng nữa |

## 5. Verify

- `npm run typecheck` (5/5 package) + `npm run lint` (`@car-v2/web`) sạch — không phát sinh lỗi/cảnh báo mới.
- Trên dev server (`localhost:3001`, trip TRK-2608-002, tháng 08/2026): Finance tab "Theo chuyến" đi thẳng
  Doanh thu → Lợi nhuận (không còn cột phân bổ); card "Chi phí cố định" = 2.000.000đ kèm note "không phân bổ
  theo chuyến"; Chi tiết chuyến không còn 2 dòng lương/KH phân bổ, Lợi nhuận = 6.476.000đ = DT − tổng chi phí
  biến đổi (khớp Finance tab); export `/truck/finance/export` trả 200, file .xlsx hợp lệ.
