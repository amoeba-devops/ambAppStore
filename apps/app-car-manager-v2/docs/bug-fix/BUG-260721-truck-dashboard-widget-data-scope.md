# BUG-260721 — Truck · Dashboard widgets hiển thị số sai scope / không khớp tổng-thành-phần

> Yêu cầu người dùng: *"check chi tiết từng widget ở dashboard, tôi cần load đúng data và cập nhật mới nhất, không được bịa hay show số sai."*

## Mức độ
**Medium** — không có số "bịa" (mọi số đều derive từ DB qua `computeTruckPnl`/`listTruckTrips`), nhưng 4 widget hiển thị **sai scope so với filter đang chọn** hoặc **tổng không khớp các thành phần liệt kê** — với người dùng thì trông y như số sai.

## 4 lỗi & cách sửa (tất cả trong `apps/web/src/app/(app)/truck/dashboard/page.tsx`)

| # | Widget | Lỗi | Sửa |
|---|---|---|---|
| 1 | Tình trạng đội xe | Đếm TOÀN BỘ xe (`trucks`) kể cả khi đang lọc khu vực | Đếm theo `region ? regionTrucks : trucks`. Cố ý KHÔNG áp filter xe (danh sách trạng thái của 1 xe vô nghĩa) |
| 2 | Chuyến gần đây | `listTruckTrips(entId)` không truyền filter nào — luôn 5 chuyến mới nhất toàn hệ thống, bất kể kỳ/khu vực/xe | Truyền `{ region, vehicleId }` vào query + lọc JS theo khoảng kỳ (`kpiMonths[0]` → `monthEndExclusive(last)`) trước khi `slice(0,5)` |
| 3 | Card "Tổng phí cố định" | `total = fixedCost` (lương + KH + BH + lương tài xế) nhưng rows chỉ liệt kê KH + BH → tổng > các dòng | Thêm dòng Lương (`salary`) + Lương tài xế (`driverSalary`); thêm `driverSalary` vào reducer `acc` |
| 4 | Donut "Cơ cấu chi phí" | Tâm donut = `totalCost` (gồm driverSalary) nhưng không có lát driverSalary → tâm > tổng các lát | Thêm lát `driverSalary` (màu `--c5`), vẫn filter `value > 0` |

Lỗi 3–4 không lộ ra ở tenant test hiện tại (chi phí cố định = 0) nhưng sẽ hiện ngay khi cấu hình lương/khấu hao/bảo hiểm thật.

## Verify (SSR fetch + DOMParser trên dev server — preview renderer vẫn kẹt, xem BUG-260721 kia)
| Case | Kết quả |
|---|---|
| `tsc --noEmit` | ✅ exit 0 |
| `/truck/dashboard` (tất cả) | ✅ đội xe 3/1/1/0 (5 xe); chuyến gần đây đủ mọi khu vực |
| `/truck/dashboard?region=HCM` | ✅ đội xe **2/0/0/0** (chỉ 2 xe HCM); chuyến gần đây chỉ khách HCM — không còn lộ Đồng Nai/Baiksan |
| `/truck/dashboard?from=2025-01&to=2025-01` (kỳ trống) | ✅ chuyến gần đây rỗng; đội xe giữ nguyên (trạng thái là hiện tại, không theo kỳ — đúng) |
| Fixed card default view | ✅ có đủ dòng "Lương" + "Lương tài xế" |

## Đợt 2 (cùng ngày, user yêu cầu "sửa luôn lỗi ở P&L và mục 5-6")

| # | Chỗ sửa | Nội dung |
|---|---|---|
| 5 | Dashboard — biểu đồ "Doanh thu & lợi nhuận theo tháng" | Trước: luôn cố định 6 tháng gần nhất từ HÔM NAY, không theo bộ lọc kỳ. Sau: hiện đúng các tháng của kỳ đã chọn; riêng kỳ 1 tháng (mặc định "Tháng này") mở rộng thành 6 tháng **kết thúc tại tháng đó** (neo theo lựa chọn, không neo theo hôm nay) để không render 1 cột trơ trọi — view mặc định nhìn y như cũ |
| 6 | Dashboard — delta KPI của YTD | Trước: "so kỳ trước" của YTD = N tháng liền trước 01/01 (vô nghĩa). Sau: YTD so **cùng kỳ năm trước** (Th1–Th7/2026 vs Th1–Th7/2025), nhãn đổi thành "so cùng kỳ năm trước" (key i18n mới `vsPrevYoy` vi/en/ko). Các preset khác giữ nguyên kỳ-liền-trước |
| P&L | `pnl/page.tsx` CostCard "fixed" | Cùng pattern lỗi #3: total gồm driverSalary nhưng rows thiếu → thêm dòng "Lương tài xế" |

Verify đợt 2 (SSR fetch + DOMParser + đếm barData trong RSC payload):
- Mặc định: 6 cột Th2–Th7/2026 (không đổi) + nhãn "so kỳ trước" ✅
- `?period=ytd`: **7 cột Th1–Th7** ✅; delta ẩn vì tenant test không có dữ liệu 2025 (pctDelta trả null khi kỳ so sánh = 0 — đúng, không bịa %)
- `?from=2025-06&to=2025-07`: đúng **2 cột 2025-06/07**, neo theo range ✅
- `/truck/pnl` card cố định: đủ 4 dòng gồm "Lương tài xế 0 ₫" ✅
- `tsc --noEmit` sạch; 3 file JSON i18n parse OK

## Đợt 3 (cùng ngày, user: "sửa luôn phần chữ tooltip và subtitle") — messages vi/en/ko

Đối chiếu công thức thật (`truck-pnl.service.ts`: `totalCost = fuel + toll + extra + salary + depreciation + insurance + driverSalary`; `netProfit = revenue − totalCost`):

| Key | Trước (sai) | Sau (đúng) |
|---|---|---|
| `kpiCostSub` | "Lương · KH · xăng · **bãi** · cầu đường" (có "bãi"=parking của xe con, thiếu bảo hiểm/phát sinh) | "Nhiên liệu · cầu đường · phát sinh · lương · khấu hao · bảo hiểm" |
| `tooltipCost` | thiếu bảo hiểm + phát sinh, có "Lương tài xế" nhưng thiếu "Lương (theo xe)" | "= Phí nhiên liệu + Phí cầu đường + Chi phí phát sinh + Lương + Khấu hao xe + Bảo hiểm + Lương tài xế" |
| `tooltipProfit` | "− Lương tài xế − Khấu hao − **Tổng chi phí cố định** − …" (TRÙNG: fixed cost đã gồm lương+KH) | "= Tổng doanh thu − Tổng chi phí (nhiên liệu + cầu đường + phát sinh + lương + khấu hao + bảo hiểm + lương tài xế)" |

Verify: 3 JSON parse OK; SSR fetch `/truck/dashboard` xác nhận chuỗi mới render, chuỗi cũ ("bãi", "Tổng chi phí cố định − Tổng xăng dầu") đã biến mất.

## Ghi chú / Chống tái diễn
- **Mọi widget trên một trang có filter phải khai báo rõ nó theo filter nào** — hoặc áp filter, hoặc comment lý do cố ý bỏ qua (như fleet-status bỏ qua vehicle filter).
- **Tổng hiển thị và các thành phần liệt kê phải cùng một danh sách khoản mục** — khi thêm khoản mới vào `fixedCost`/`totalCost` (như `driverSalary` trước đây), phải rà mọi chỗ render breakdown (dashboard CostSplit, donut, P&L CostCard — cả 3 đều đã dính).
- **Widget phụ trợ (chart/trend) phải neo theo lựa chọn của user, không neo theo "hôm nay"** — nếu cần mở rộng cửa sổ cho dễ nhìn thì mở rộng quanh kỳ đã chọn.
