# BUG-260709 — Truck · "Đã xuất báo cáo nhưng menu Chi phí & Lợi nhuận chưa cập nhật theo bình quân"

> Feedback KH: *"Cập nhật dữ liệu tại menu sau khi xuất báo cáo — Đã xuất báo cáo, nhưng data tại menu này chưa được cập nhật. Cập nhật logic để sau khi lập báo cáo cuối tháng, chi phí nhiên liệu và lợi nhuận của từng chuyến tại menu Chi phí & Lợi nhuận cũng được tính lại theo số liệu bình quân."*

## Mức độ
**Medium** — cơ chế tính lại theo bình quân **đã đúng và đang chạy**; vấn đề là **độ bao phủ theo khu vực + hướng dẫn sai** khiến người dùng tưởng "chưa cập nhật". Chỉ ảnh hưởng surface xe tải (ADMIN/MANAGER).

## Hiện tượng
Người dùng lập báo cáo cuối tháng rồi vào menu **Chi phí & Lợi nhuận** (`/truck/finance`), thấy nhiều chuyến vẫn giữ giá xăng nhập tay (không đổi sang bình quân) → tưởng phần mềm không tính lại.

## Nguyên nhân (đã kiểm chứng bằng dữ liệu thật, tháng 2026-07)
Cơ chế: mỗi lần **"Lập báo cáo"** đóng băng một *snapshot* bình quân (giá TB + định mức tiêu hao) vào `car_truck_reports`; [`listTruckFinanceTrips`](../../apps/web/src/server/queries/truck-finance.queries.ts) đọc lại qua [`loadTruckRegionSnapshots.forTrip()`](../../packages/core/src/truck/truck-fuel-snapshot.ts) và tính lại `fuelCost/profit` mỗi chuyến. **Đây là hoạt động đúng.**

Nhưng báo cáo **scope theo khu vực** (HCM / DONG_NAI / BAIKSAN — REQ-20260630), và `forTrip` chỉ finalize chuyến khi **khu vực của xe đó** có snapshot. Do đó:

| Chuyến | Khu vực | Kết quả trước fix |
|---|---|---|
| 3 chuyến 51C-458.32 | HCM (đã lập BC) | ✅ tính lại theo BQ (27.333 đ/L) |
| TRK-2001 60C-311.07 | DONG_NAI (chưa lập BC) | ⚠️ vẫn giá nhập tay |
| TRK-3001 43C-201.55 | BAIKSAN (chưa lập BC) | ⚠️ vẫn giá nhập tay |

→ Report chỉ lập cho HCM ⇒ chỉ chuyến HCM đổi sang bình quân; các khu vực khác **đúng nghiệp vụ** vẫn tạm tính, nhưng **không có gì nói cho người dùng biết**.

**Lỗi thứ hai (từ bản fix #1 trước — BUG-260708):** banner cảnh báo tính cờ `allocatable` trên **tổng-toàn-đội**, nên hiển thị *"Đã đủ dữ liệu — hãy Lập báo cáo"* ngay cả khi người dùng **đã lập báo cáo** cho một khu vực → hướng dẫn sai, càng gây hiểu nhầm.

## Cách sửa (giữ mô hình per-region để đảm bảo chính xác — quyết định của KH)

**A. Banner minh bạch theo khu vực** (`finance/page.tsx` + `truck-finance.queries.ts` + i18n)
- Gom các chuyến còn tạm tính **theo khu vực**, chỉ đích danh khu vực nào **chưa lập báo cáo**, kèm số chuyến.
- Phân biệt: khu vực **đã có hoá đơn xăng** (→ "hãy lập báo cáo để chốt") vs **chưa có hoá đơn** (→ "chưa có hoá đơn xăng cho khu vực này", tô cảnh báo).
- Thêm `region` vào `TruckFinanceTripRow`; thêm query `getTruckInvoiceRegions(entId, month)` (các khu vực có ≥1 hoá đơn trong tháng). Bỏ hẳn logic `allocatable/provReady` toàn-đội gây hiểu nhầm.

**B. Nút 1 chạm "Lập báo cáo tất cả khu vực"** (`truck-report.actions.ts` + component mới)
- Tách core [`generateOneTruckReport()`](../../apps/web/src/server/actions/truck-report.actions.ts); thêm `generateAllRegionsTruckReportsAction({month})`: lập báo cáo PNL cho **mọi khu vực có chuyến trong tháng**, đóng băng bình quân **riêng từng khu vực** (không trộn vùng). Khu vực còn thiếu hoá đơn (F5 fail) → trả về `pending` (bỏ qua, báo lại) thay vì tạo báo cáo rỗng snapshot.
- Nút chỉ hiện khi có ≥1 khu vực tạm tính **thực sự chốt được** (có hoá đơn) và người dùng là ADMIN/MANAGER; kết quả báo qua toast (done / partial / none) rồi `router.refresh()`.

## Verify (local dev — SSR fetch sau dev-login OWNER)
| Hạng mục | Kết quả |
|---|---|
| `tsc --noEmit` (web) | ✅ exit 0 |
| i18n vi/en/ko | ✅ JSON hợp lệ, không rò key chưa dịch |
| `/truck/finance?month=2026-07` render | ✅ 200, **không** có IntlError / MISSING_MESSAGE / error overlay |
| Banner (dữ liệu gốc) | ✅ liệt kê **Đồng Nai + Baiksan**, cả hai "chưa có hoá đơn xăng"; **nút ẩn** (không vùng nào chốt được) |
| Recalc không hồi quy | ✅ 3 dòng HCM "Đã lập BC" (bình quân) + 2 dòng "Tạm tính" (giá tay) |
| Banner (seed hoá đơn Đồng Nai) | ✅ Đồng Nai → "đã có hoá đơn — hãy lập báo cáo"; Baiksan vẫn "chưa có hoá đơn"; **nút "Lập báo cáo tất cả khu vực" hiện** |
| Dọn seed | ✅ DB khôi phục (chỉ còn hoá đơn HCM) |

## File đổi
- `apps/web/src/server/queries/truck-finance.queries.ts` — thêm `region` vào `TruckFinanceTripRow` (select + map); thêm `getTruckInvoiceRegions()`
- `apps/web/src/server/actions/truck-report.actions.ts` — tách `generateOneTruckReport()`; thêm `generateAllRegionsTruckReportsAction()`; gom `revalidateTruckReportPaths()`
- `apps/web/src/app/(app)/truck/finance/_components/generate-all-regions-button.tsx` — **mới**, nút 1 chạm + toast kết quả
- `apps/web/src/app/(app)/truck/finance/page.tsx` — banner region-aware, bỏ logic allocatable toàn-đội, gắn nút
- `apps/web/messages/{vi,en,ko}.json` — sửa `provDesc`; bỏ `provInvoice`/`provReady`; thêm `provRegionCount/Ready/NoInvoice/Unassigned`, `genAllBtn/Done/Partial/None`

## Ghi chú / Chống tái diễn
- **Trạng thái tài chính mỗi dòng = có snapshot cho KHU VỰC của xe** (không phải "tồn tại 1 báo cáo bất kỳ"). `provisional ⟺ khu vực chưa có snapshot`.
- **Không trộn khu vực**: mỗi vùng chốt bằng hoá đơn + km của chính nó (giữ chính xác theo giá xăng vùng). Nút "tất cả khu vực" = lặp per-region, **không** phải 1 số bình quân chung.
- Khi một vùng **không chốt được** (thiếu hoá đơn), phải **nói rõ** thay vì lặng lẽ giữ giá tay dưới nhãn xanh.
- `generateAllRegionsTruckReportsAction` **regenerate cả vùng đã chốt** (latest-wins, không phá huỷ) → đồng thời làm mới số theo dữ liệu hiện tại; đúng với nhãn nút.
