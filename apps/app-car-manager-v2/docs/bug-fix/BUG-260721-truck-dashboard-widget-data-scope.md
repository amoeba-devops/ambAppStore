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

## Đợt 4 (cùng ngày) — Donut "Cơ cấu chi phí" thiếu lương/khấu hao ở view toàn đội (quyết định KH: "Fleet = tổng các xe")

**Triệu chứng:** donut "Cơ cấu chi phí" (view Tất cả xe) chỉ hiện nhiên liệu/cầu đường/phát sinh + "Lương tài xế", **thiếu Lương (theo xe) và Khấu hao**. Lọc HCM thì lại có (khấu hao 1M, lương 12M).

**Root cause (`packages/core/src/truck/truck-pnl.service.ts`):** phần "vehicle-default fallback" (khấu hao từ `cvh_depreciation` + lương tài xế mặc định của xe) chỉ chạy khi có filter xe/khu vực (`scopeIds = q.vehicleId ? [id] : regionVehicleIds`; ở view toàn đội `regionVehicleIds = null` → bỏ qua). View toàn đội thay bằng `driverSalary` = tổng lương **tất cả** tài xế qua fleet-access, và khấu hao = 0 (không có dòng nhập tay). → dashboard tự mâu thuẫn: KPI/donut (toàn đội) bỏ khấu hao, nhưng bảng "Theo khu vực" ngay dưới + báo cáo tháng chính thức (`getTruckReportExport`, đã per-vehicle) lại có.

**Quyết định KH (AskUserQuestion 2026-07-21):** **"Fleet = tổng các xe"** — view toàn đội tính giống per-vehicle để KPI = Σ khu vực = Σ P&L per-xe = báo cáo.

**Sửa:**
- `truck-pnl.service.ts`: bỏ hẳn block fleet-roster `driverSalaryTotal` (+ import `carUserFleetAccess`); áp vehicle-default fallback cho **mọi** view (fleet = tất cả xe TRUCK); `fixedCost = salary + depreciation + insurance` (bỏ số hạng `driverSalary`). Field `driverSalary` giữ lại trong interface = 0 (đánh dấu @deprecated) để không phá shape P&L row / export.
- Gỡ hiển thị "Lương tài xế" (giờ luôn 0, đã gộp vào `salary`): dashboard donut + CostSplit; P&L METRICS row + CostCard row; finance summary card (grid 7→6 cột); pnl/export route dòng Excel.
- **Per-vehicle/region view KHÔNG đổi** (đã dùng fallback từ trước); **báo cáo tháng KHÔNG đổi** (đường per-vehicle riêng). Chỉ fleet view đổi → giờ khớp mọi nơi.
- Lưu ý KH đã chấp nhận: tổng lương chuyển từ "toàn bộ tài xế" sang "tổng lương tài xế mặc-định-của-xe" — nếu có tài xế không gắn xe thì số lương có thể đổi.

Verify: `tsc --noEmit` (web+core) sạch, `next lint` sạch. Local render 200 không lỗi, card cố định còn 3 dòng (bỏ "Lương tài xế").

**Verify reconciliation trên staging (dữ liệu thật, sau deploy commit 1ea077a):**
| | Lương | Khấu hao | Tổng cố định |
|---|---|---|---|
| HCM | 12M | 1M | 13M |
| Đồng Nai | 10M | 2M | 12M |
| Baiksan | 16M | 1M | 17M |
| **Σ khu vực** | **38M** | **4M** | **42M** |
| **Toàn đội (KPI)** | **38M** | **4M** | **42M** ✅ khớp tuyệt đối |

Donut toàn đội giờ hiện Lương (theo xe) 38M + Khấu hao 4M; tâm 48.8M = Σ lát (4.2+0.9+1.7+38+4). Trước fix toàn đội = 38M (thiếu 4M khấu hao). **Follow-up cùng lượt:** tooltip `tooltipCost`/`tooltipProfit` bỏ "+ Lương tài xế" (giờ gộp trong "Lương") — sửa vi/en/ko.

## Ghi chú / Chống tái diễn
- **Mọi widget trên một trang có filter phải khai báo rõ nó theo filter nào** — hoặc áp filter, hoặc comment lý do cố ý bỏ qua (như fleet-status bỏ qua vehicle filter).
- **Tổng hiển thị và các thành phần liệt kê phải cùng một danh sách khoản mục** — khi thêm khoản mới vào `fixedCost`/`totalCost` (như `driverSalary` trước đây), phải rà mọi chỗ render breakdown (dashboard CostSplit, donut, P&L CostCard — cả 3 đều đã dính).
- **Widget phụ trợ (chart/trend) phải neo theo lựa chọn của user, không neo theo "hôm nay"** — nếu cần mở rộng cửa sổ cho dễ nhìn thì mở rộng quanh kỳ đã chọn.
