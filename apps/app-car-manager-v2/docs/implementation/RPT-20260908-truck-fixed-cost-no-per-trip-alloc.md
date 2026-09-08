# RPT-20260908 — Truck: Lương + Khấu hao không phân bổ theo chuyến

Yêu cầu + phân tích: [REQ-20260908](../analysis/REQ-20260908-truck-fixed-cost-no-per-trip-alloc.md). Đảo ngược
có chủ đích quyết định 2026-07-25 ([RPT-20260725](RPT-20260725-truck-sheet3-fixed-allocation.md)) + dừng dùng
cơ chế đóng băng [REQ-20260821](../analysis/REQ-20260821-truck-freeze-allocation-until-report.md) cho lương/
khấu hao — người dùng xác nhận trực tiếp (không qua PLN/TC riêng, theo lựa chọn của người dùng khi được hỏi
2026-09-08).

## Đã làm

Xem bảng "Gap analysis — file đã đổi" ở REQ. Tóm tắt theo lớp:

- **Xoá hẳn** `truck-fixed-allocation.ts` (core) — không còn ai gọi `loadTruckFixedAllocation` /
  `computeTruckFixedAllocRows` sau khi dọn 2 query + 1 action dùng nó.
- **Bóc tách** phần đóng băng phân bổ ra khỏi `truck-fuel-snapshot.ts` (giữ nguyên phần đóng băng nhiên liệu —
  không liên quan, không đổi).
- **Action `generateOneTruckReport`**: thay lệnh gọi `computeTruckFixedAllocRows` (vừa tính phân bổ vừa trả về
  danh sách xe trong scope) bằng helper mới `resolveTruckVehicleIds` chỉ làm việc còn cần — lấy danh sách xe
  trong scope cho phần đóng băng ZERO nhiên liệu (REQ-20260821 follow-up, không đổi).
- **Query + UI + export**: bỏ 3 field `salaryAllocated`/`depreciationAllocated`/`profitAfterFixed` (+
  `fixedTripCount`) khỏi `TruckFinanceTripRow` và `getTruckTripBreakdown`; mọi màn quay về dùng `profit` (biến
  phí only) — đúng như Bảo trì chưa từng có field này.
- **Cột DB `trr_fixed_alloc`**: **giữ nguyên, không migration** — đánh dấu `@deprecated` trong schema comment,
  không còn code nào đọc/ghi. Báo cáo lịch sử trước 2026-09-08 vẫn giữ nguyên giá trị JSONB cũ (vô hại, không
  đọc tới).
- **E2E**: xoá `truck-fixed-alloc-freeze.spec.ts` (6 test case cho tính năng đã bỏ); tách 2 test case fuel-zero
  freeze không liên quan sang file mới `truck-fuel-zero-freeze.spec.ts`; dọn helper seed không còn dùng trong
  `truck-seed.ts`.

## Không đổi (theo đúng REQ)

`computeTruckPnl` (công thức `fixedCost` cấp tháng), Dashboard, P&L tab "Tổng quan" + export P&L, file Excel
báo cáo tháng gửi khách (`truck-report-export.queries.ts`), cơ chế đóng băng nhiên liệu.

## Verify

- `npm run typecheck` — 5/5 package pass.
- `npm run lint` (`@car-v2/web`) — sạch, không phát sinh warning/error mới (chỉ còn các warning có sẵn từ
  trước, không liên quan file đã sửa).
- Kiểm tra trực tiếp trên dev server (`localhost:3001`), trip thật `TRK-2608-002` tháng 08/2026:
  - Finance tab "Theo chuyến": bảng đi thẳng Doanh thu (8.500.000đ) → Lợi nhuận (6.476.000đ), không còn cột
    "CP CỐ ĐỊNH PHÂN BỔ".
  - Card "Chi phí cố định" = 2.000.000đ, ghi chú "không phân bổ theo chuyến".
  - Chi tiết chuyến: không còn 2 dòng lương/KH phân bổ; Lợi nhuận = 6.476.000đ (khớp Finance tab).
  - `/truck/finance/export?month=2026-08` → 200, file .xlsx hợp lệ (16.873 bytes), không còn 3 cột phân bổ.
  - Không có lỗi console / server log trong suốt quá trình test.

## File đã đổi

Core: `truck-fixed-allocation.ts` (xoá), `index.ts`, `truck-fuel-snapshot.ts`, `truck-maintenance.ts` (comment).
DB: `truck-report.schema.ts` (comment). Action: `truck-report.actions.ts`. Query: `truck-finance.queries.ts`,
`truck-trips.queries.ts`. UI: `truck/finance/page.tsx`, `truck/finance/export/route.ts`,
`truck/trips/[id]/page.tsx`, `trips/[id]/page.tsx`, `trips/[id]/_components/truck-trip-detail.tsx`. i18n:
`messages/vi.json`, `messages/en.json`, `messages/ko.json`. E2E: xoá `truck-fixed-alloc-freeze.spec.ts`, thêm
`truck-fuel-zero-freeze.spec.ts`, sửa `helpers/truck-seed.ts`.

## Chưa làm / cần lưu ý

- Chưa commit/push — chờ người dùng review diff theo quy ước repo.
- Không có DB migration — cột `trr_fixed_alloc` chỉ ngừng dùng, không drop, nên deploy staging/production
  không cần chạy SQL thủ công cho thay đổi này.
