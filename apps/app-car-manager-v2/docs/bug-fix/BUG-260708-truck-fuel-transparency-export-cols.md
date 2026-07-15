# BUG-260708 — Truck: lợi nhuận không "theo bình quân xăng" (minh bạch) + thiếu cột export danh sách chuyến

> Từ feedback khách hàng (`truck app feedback.docx`) — xử lý **#1** (bình quân xăng) và **#4** (cột export). #2 (đính kèm hóa đơn) & #3 (UI chi phí cố định) tách riêng, chưa làm.

## Mức độ
**Medium** — không sai dữ liệu tính toán, nhưng **UX gây mất niềm tin** vào số liệu tài chính (#1) và **thiếu dữ liệu khi xuất Excel** (#4). Chỉ ảnh hưởng surface xe tải (MANAGER/ADMIN).

## Hiện tượng
**#1 — Chi phí & Lợi nhuận / Dashboard:** Khách báo "đã Lập báo cáo nhưng lợi nhuận mỗi chuyến vẫn không tính theo bình quân xăng dầu cuối tháng".
- Mọi dòng đều gắn badge **"Đã lập BC"** (xanh) miễn là tồn tại 1 báo cáo — kể cả khi dòng đó vẫn tính theo **giá xăng nhập tay** (chưa phân bổ bình quân).
- Không có bất kỳ lời giải thích nào vì sao số còn "tạm tính" → khách tưởng phần mềm tính sai.

**#4 — Tải xuống danh sách chuyến đi:** Khách cần thêm cột theo mẫu chi tiết.
- Nút "Tải xuống" chỉ xuất **14 cột**; cột **"CDF" luôn rỗng** dù DB có dữ liệu; thiếu Giờ BĐ/KT, ODO đầu/cuối, Nơi lấy/giao, Tên phí khác, Tổng chi phí, Ghi chú.

## Nguyên nhân
**#1:**
1. Badge trạng thái ở `finance/page.tsx` bind vào **`latestReport` (có tồn tại báo cáo)** thay vì **`r.finalized` (dòng đó có thực sự được phân bổ bình quân)**.
2. Snapshot bình quân chỉ hợp lệ khi **F5**: `totalKm>0 && invoiceLiters>0 && avgPrice>0` (freeze lúc "Lập báo cáo"). `loadTruckRegionSnapshots` lọc `trr_avg_price/trr_consumption IS NOT NULL`, nên báo cáo lập khi thiếu km/hóa đơn ⇒ snapshot **NULL** ⇒ mọi dòng fallback về giá xăng thô nhưng **vẫn hiện "Đã lập BC"**. → "Có báo cáo" ≠ "đã phân bổ bình quân".
3. Không có surface nào nói cho người dùng biết **đang thiếu gì** (km / hóa đơn) để tính được bình quân.
> Lưu ý: `avgPrice` = **trung bình cộng** đơn giá hóa đơn là **cố ý theo SRS khách** (`netcost.txt §1.2`, "simple average, not litre-weighted") — KHÔNG phải bug, giữ nguyên.

**#4:**
- Tồn tại 2 đường export: báo cáo tháng (`truck-report-workbook.ts`, ~26 cột đủ) và **export nhanh danh sách** (`trips/export/route.ts`, 14 cột). Export nhanh **hardcode ô CDF = `''`** và chưa map các cột chi tiết dù dữ liệu đã có trong DB. Export cũng không honor filter `region`/`driver`.

## Cách sửa
**#1 (`apps/web/src/app/(app)/truck/finance/page.tsx` + i18n):**
- Badge mỗi dòng → dựa vào **`r.finalized`** (đã có sẵn từ `listTruckFinanceTrips`): `r.finalized ? 'Đã lập BC' : 'Tạm tính'`.
- Thêm **banner cảnh báo** khi còn dòng tạm tính (`getTruckFuelStats` → `hasInvoice`, `allocatable`; `kmZeroCount` từ rows), chỉ hiện **đúng lý do áp dụng**: (a) còn N chuyến thiếu km ODO, (b) chưa có hóa đơn xăng, (c) đã đủ dữ liệu → hãy "Lập báo cáo". Có link CTA sang `/truck/pnl`.
- Đổi nhãn `provisional`: "Chưa lập BC" → **"Tạm tính"** (vi/en/ko) + 6 key banner mới (`provTitle/Desc/Km/Invoice/Ready/Cta`).

**#4 (`trips/export/route.ts` + `truck-trips.queries.ts`):**
- Làm giàu **`listTruckTrips`** (nguồn duy nhất, giữ nguyên mọi filter) với: `startTime/endTime`, `startOdometer/endOdometer`, `pickup/dropoff`, `cdf`, `notes`, `extraNote` (ghép tên phí khác), `fuelUnitPrice/fuelLiters` (theo snapshot khi finalized, ngược lại theo giá tự nhập).
- Viết lại export → **25 cột bilingual** theo mẫu KH; **sửa lỗi cột CDF rỗng**; thêm **Tổng chi phí** (`breakdown.totalCost`) & **Ghi chú** (`trp_notes`); export honor thêm `region` + `driver`.

## Verify (local, dev — SSR fetch sau dev-login)
| Hạng mục | Kết quả |
|---|---|
| `tsc --noEmit` (web) | ✅ exit 0 |
| i18n vi/en/ko | ✅ JSON hợp lệ |
| `/truck/finance?month=2026-07` | ✅ 200, không lỗi |
| Badge theo dòng | ✅ **hỗn hợp 3 "Đã lập BC" + 2 "Tạm tính"** (trước: tất cả cùng 1 trạng thái) |
| Banner | ✅ render (CTA `/truck/pnl` + đúng dòng "Đã đủ dữ liệu…"; ẩn đúng lý do km/hóa đơn vì không thiếu) |
| `/truck/trips/export?month=2026-07` | ✅ 200, `application/…spreadsheetml.sheet`, **22.928 bytes** |

## File đổi
- `apps/web/src/app/(app)/truck/finance/page.tsx` — badge theo `r.finalized` + banner minh bạch + fetch `getTruckFuelStats`
- `apps/web/src/server/queries/truck-trips.queries.ts` — làm giàu `TruckTripRow`/`listTruckTrips` (detail export + tên phí khác + đơn giá/lít xăng)
- `apps/web/src/app/(app)/truck/trips/export/route.ts` — 25 cột bilingual, sửa CDF, thêm Tổng chi phí/Ghi chú, honor region/driver
- `apps/web/messages/{vi,en,ko}.json` — nhãn "Tạm tính" + 6 key banner

## Ghi chú / Chống tái diễn
- **Trạng thái tài chính mỗi dòng phải bám cờ `finalized`** (từ `loadTruckRegionSnapshots.forTrip`), **không** bám "tồn tại báo cáo". Áp dụng cho mọi surface mới (dashboard, chi tiết chuyến…).
- Khi **không tính được bình quân**, phải **nói rõ thiếu gì** thay vì lặng lẽ fallback giá thô dưới nhãn xanh.
- **Một query snapshot-aware duy nhất** (`listTruckTrips`) làm nguồn cho cả bảng lẫn export → không lệch số.
- Còn mở (feedback tách riêng): **#2** đính kèm ảnh hóa đơn/biên lai (chưa có upload — tái dùng S3 của module Expense); **#3** UI nhập chi phí cố định (`TruckFixedCostRow` đang mồ côi, chưa gắn vào trang nào).
