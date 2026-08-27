# TC-20260821 — Test case: đóng băng phân bổ CP cố định theo báo cáo

> REQ: [REQ-20260821](../analysis/REQ-20260821-truck-freeze-allocation-until-report.md) · PLN: [PLN-20260821](../plan/PLN-20260821-truck-freeze-allocation-until-report.md)
> Fixture chuẩn: 1 xe TRUCK (khu vực X), tài xế mặc định lương 10.000.000đ/tháng (rate SALARY), khấu hao 100.000đ/tháng
> (rate DEPRECIATION), 3 chuyến COMPLETED trong tháng M, doanh thu 10tr/chuyến. Trạng thái so sánh lấy từ màn
> Chi phí & Lợi nhuận (`listTruckFinanceTrips`) + chi tiết chuyến (`getTruckTripBreakdown`).

| # | Case | Bước | Kỳ vọng |
|---|------|------|---------|
| TC-01 | **Freeze khi lập BC** | Lập BC tháng M (cả vùng) | Dòng BC có `trr_fixed_alloc = [{vehicle, salary 10tr, dep 100k, tripCount 3}]`; màn hình: 3 dòng lương 3.333.333 / KH 33.333, "Đã lập BC" |
| TC-02 | **Tạo chuyến KHÔNG làm đổi số đã BC** (core REQ) | Sau TC-01, tạo chuyến COMPLETED thứ 4 | 3 dòng cũ **giữ nguyên** 3.333.333/33.333 và LN cũ; badge tháng chuyển cam "cần lập lại" |
| TC-03 | Chuyến mới hiển thị như hiện tại (không UI mới) | Nhìn dòng chuyến 4 sau TC-02 | Phân bổ live ÷4 = 2.500.000/25.000, chip "Tạm tính" sẵn có; không xuất hiện element UI mới |
| TC-04 | **Lập lại BC = thời điểm tính lại duy nhất** | Lập lại BC tháng M | Cả 4 dòng chia lại 2.500.000/25.000, đều "Đã lập BC"; `trr_fixed_alloc` mới tripCount 4 |
| TC-05 | Xoá chuyến sau BC không kéo số cũ | Sau TC-04, xoá chuyến 4 | 3 dòng còn lại **vẫn 2.500.000/25.000** (frozen theo BC mới nhất), KHÔNG tự quay về 3.333.333; badge cam |
| TC-06 | Sửa 1 chuyến sau BC → chỉ chuyến đó rơi khỏi coverage | Sau TC-04, sửa DT chuyến 1 | Chuyến 1: phân bổ live + fuel live ("Tạm tính"); chuyến 2-4 giữ frozen |
| TC-07 | **Regression — tháng chưa có BC** | Tháng mới, 2 chuyến, chưa lập BC | Số y hệt hành vi hiện tại (live ÷2), không khác biệt nào |
| TC-08 | **Grandfather — BC cũ không có `trr_fixed_alloc`** | Giả lập dòng BC `trr_fixed_alloc = NULL` | Fallback live — số y hệt trước khi deploy (không vỡ tháng lịch sử) |
| TC-09 | BC subset xe chỉ freeze xe nó phủ | 2 xe A B có chuyến; lập BC subset chỉ xe A; tạo thêm chuyến xe B | Dòng xe A frozen; dòng xe B vẫn live (đổi theo số chuyến B) |
| TC-10 | Báo cáo Excel khớp màn hình tại thời điểm lập | So sheet sau TC-04 | Lương tài xế/khấu hao/LN trong file = màn hình (như RPT-20260725 §4) |
| TC-11 | Chuyến CONFIRMED (chưa hoàn thành) không vào formula | Tạo chuyến không mark_completed sau BC | Không dòng nào đổi, kể cả tripCount live |
| TC-12 | Build sạch | `tsc --noEmit`, `next lint` | 5/5 package pass |

Ghi chú kiểm thử: chạy e2e trên dev server :3001 + Neon dev branch (pattern `truck-trip-receipt-upload.spec.ts`), dọn fixture sau test. TC-02/04/05 là 3 case định nghĩa thành công của REQ.


---

## Addendum 2026-08-21 — TC bổ sung cho freeze nhiên liệu 0 (khe hở cuối)

Fixture: tháng 2026-12 (`MONTH2`), xe 29C-99999 (HCM), 1 chuyến E2E-HCM-3 **không có nhiên liệu**
(100 km, DT 5tr); chi phí cố định (xe, tháng) nhập tay = 0 để trung hoà rate dev. Sau khi lập BC,
thêm E2E-HCM-4 có dầu 20L × 30.000 = 600.000đ (50 km) → pool live = 4.000 đ/km.

| # | Case | Kỳ vọng |
|---|------|---------|
| TC-13 | Lập BC khi xe chưa có dầu → freeze số 0; nhập dầu sau đó | Dòng BC có entry `money 0` cho xe; E2E-HCM-4 (ngoài BC) ăn live 50km × 4.000 = 200.000đ; **E2E-HCM-3 (đã BC) giữ phí 0** — không xuất hiện "4.000 đ/km"/"400.000" trên dòng đó |
| TC-14 | Lập lại BC | E2E-HCM-3 được tính lại từ pool mới: 100km × 4.000 = 400.000đ, entry money 600.000 đóng băng |
