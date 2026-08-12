# BUG-260721 — Chi phí & Lợi nhuận · Theo chuyến: thêm badge phân biệt "đã tính bình quân" vs "tự nhập"

> Feedback KH (kèm ảnh chụp thật): *"mặc dù đã lập báo cáo, nhưng phí nhiên liệu chưa được update lại theo từng chuyến, hay phải thêm thông tin Km thì mới tính lại"* → sau khi xác nhận nguyên nhân, KH yêu cầu: *"thêm badge/tooltip cảnh báo chưa tính bình quân, show cho tôi làm sao để nhận biết đã tính hay chưa."*

## Xác nhận nguyên nhân (từ ảnh chụp thật trên staging)
Cùng 1 xe (50D-32938), 2 chuyến khác nhau hiện **Đơn giá khác nhau** (0đ vs 30.000đ) dù cùng trạng thái "Đã lập BC". Nếu đã có bình quân, đơn giá phải GIỐNG NHAU trong cùng khu vực/tháng. → khu vực này **chưa có snapshot bình quân** (thiếu hoá đơn xăng VÀ/HOẶC km đồng hồ — mọi chuyến đều "Tổng km: 0"), nên hệ thống đang hiển thị đúng số xăng **nhập tay riêng từng chuyến**, đúng theo thiết kế "Lập báo cáo = chốt luôn" (BUG-260721 Đợt 6): trạng thái báo cáo (`finalized`) đã tách khỏi việc có bình quân hay không (`fuelReconciled`) — nhưng UI trước đó không cho thấy sự tách biệt này, gây hiểu lầm "đã lập báo cáo mà sao chưa tính lại".

## Sửa

**`truck-finance.queries.ts`** — thêm field `fuelReconciled: boolean` (= `snap != null`) vào `TruckFinanceTripRow`, tách bạch rõ với `finalized` (= có báo cáo hay chưa).

**`finance/page.tsx`**:
- Sửa điều kiện in nghiêng/mờ ở 3 cột Đơn giá/Lít/Phí nhiên liệu: đổi từ `!r.finalized` → `!r.fuelReconciled` (đây là bug ăn theo Đợt 6 — sau khi tách `finalized` khỏi snapshot, style "số tạm tính" phải theo cờ snapshot, không phải cờ report-tồn-tại).
- Thêm **Badge** dưới giá trị "Phí nhiên liệu" mỗi dòng: **"Bình quân"** (tone success) khi `fuelReconciled=true`, **"Tự nhập"** (tone warning) khi `false` — kèm tooltip (native `title`) giải thích + hướng dẫn hành động ("cần hoá đơn xăng + km đồng hồ, sau đó lập lại báo cáo").
- Thêm icon Info + tooltip ở header cột "PHÍ NHIÊN LIỆU" giải thích ý nghĩa chung 2 nhãn.
- i18n: `fuelReconciledLabel/Tooltip`, `fuelNotReconciledLabel/Tooltip`, `thFuelHint` (vi/en/ko).

Dùng tooltip qua thuộc tính `title` gốc (không dùng overlay tự vẽ) vì bảng đang nằm trong container `overflow-x-auto` — tránh rủi ro tooltip nổi bị cắt do `overflow-y` ăn theo `overflow-x` (CSS spec).

## Verify
- `tsc --noEmit` + `next lint` sạch, 3 file JSON parse OK.
- Local (dev entity): render `/truck/finance` 200 không lỗi; cả 2 nhãn "Bình quân" và "Tự nhập" đều xuất hiện (dữ liệu local có cả 2 trường hợp).
- Số liệu không đổi — đây thuần là bổ sung hiển thị (badge/tooltip) + sửa 1 điều kiện style, không đụng công thức tính.

## Đợt 2 (cùng ngày, user: "check thêm các màn hình khác có bị tương tự không") — mở rộng badge ra 2 màn nữa

Rà toàn bộ nơi dùng `loadTruckRegionSnapshots`/`forTrip` để tìm mọi chỗ hiển thị số xăng có cùng vấn đề (giá trị đến từ snapshot hay số nhập tay, không phân biệt được).

**Tách thành shared component** `components/truck/fuel-reconciliation-badge.tsx` — `FuelReconciliationBadge({state: 'full'|'partial'|'none'})`, dùng chung 1 bộ i18n key (`screens.truckFinance.fuelReconciled*`/`fuelNotReconciled*`) cho mọi màn. Thêm state thứ 3 **"Hỗn hợp"** (partial) cho các màn tổng hợp nhiều chuyến/nhiều khu vực cùng lúc — khi trong phạm vi đó có chuyến đã bình quân VÀ chuyến chưa (khác khu vực/xe, khác tình trạng hoá đơn).

**2 màn thêm badge:**
1. **Chi tiết chuyến** (`/truck/trips/[id]`, `/trips/[id]` LOG) — `getTruckTripBreakdown` trả thêm `fuelReconciled: boolean`; `TruckTripDetail`/`CostRow` nhận `badge` tuỳ chọn, gắn cạnh dòng "Nhiên liệu". Verify: TRK-1002 hiện "Nhiên liệu 1.366.650 ₫ **Bình quân**".
2. **P&L** (`/truck/pnl`) — `computeTruckPnl` (core) thêm field `fuelReconciledTripCount` (đếm số chuyến đã bình quân trong mỗi dòng-tháng, so với `tripCount` để suy ra full/partial/none — vì 1 dòng P&L có thể gộp nhiều khu vực/xe với tình trạng khác nhau khi không lọc). Badge gắn ở: (a) card "Chi phí biến đổi" dòng Nhiên liệu (tháng đang chọn), (b) bảng P&L theo tháng dòng Nhiên liệu (mỗi cột tháng). `CostCard`'s `rows` đổi type từ `[string,string][]` → `[string,React.ReactNode][]` để nhúng badge.

**Đã CHỦ ĐỘNG BỎ QUA (không thêm badge), lý do:**
- **Dashboard** (KPI Tổng chi phí, donut, card "Biến đổi", "Chuyến gần đây"): số xăng luôn gộp chung với cầu đường+phát sinh (`fuelCost+tollFee+extraTotal`) thành 1 con số "Chi phí", không tách riêng — badge không có chỗ bám rõ ràng. Muốn xem chi tiết xăng của 1 khu vực/tháng → dùng P&L hoặc Chi phí & LN (đã có badge).
- **File Excel xuất báo cáo** (`truck-report-workbook.ts`, `truck-monthly-summary-workbook.ts`, `truck/pnl/export`, `truck/finance/export`): là template đã duyệt với KH (giống vụ "Bảo hiểm" trước đó), cột/dòng cố định theo layout — cần làm riêng, cẩn thận không vỡ layout. Hỏi lại KH nếu muốn làm tiếp.

Verify: `tsc --noEmit` (web+core) + `next lint` sạch. Local: Finance vẫn còn cả 2 nhãn; Trip detail (TRK-1002) hiện "Bình quân"; P&L hiện đủ cả "Tự nhập" và "**Hỗn hợp**" (xác nhận state thứ 3 hoạt động đúng khi 1 dòng-tháng gộp nhiều khu vực khác tình trạng).

## Ghi chú
- Phát hiện thêm (chưa xử lý): key i18n `sumDriverSalary` trong `truckFinance` không còn được dùng ở đâu (card tổng "Lương tài xế" đã bị gỡ khỏi `summaryCards` từ Đợt 4) — dead i18n key, không ảnh hưởng, có thể dọn cùng đợt sau nếu muốn.
