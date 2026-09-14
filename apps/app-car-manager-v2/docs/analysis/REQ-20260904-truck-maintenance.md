# REQ-20260904 — Truck: Menu "Bảo trì" (CRUD) + chặn tạo chuyến trong thời gian bảo trì + cộng chi phí bảo trì vào Bảng điều khiển

> **Yêu cầu gốc (2026-09-04, nguyên văn)**
> "bên app truck tôi cần thêm phần menu bảo trì mới gồm list, và các tính năng CRUD gồm các field sau:
> Chọn phương tiện · Chọn thời gian thực hiện bảo trì (Bắt đầu - Kết thúc) · Nhập chi phí ·
> Trong thời gian bảo trì thì không cho Tạo chuyến với xe này ·
> Danh sách: Ngày / Phương tiện / Thời gian bảo trì (Bắt đầu - Kết thúc) / Chi phí / Cập nhật bởi / Cập nhật / Hành động (Chỉnh sửa / Xóa)
> relate đến các UI liên quan — MENU BẢNG ĐIỀU KHIỂN: Thêm Chi phí bảo trì vào Tổng chi phí · vào Cơ cấu chi phí · vào Tổng phí cố định ·
> Chú ý: Không tính phân bổ cho từng chuyến."

Phạm vi: **workspace TRUCK** của `apps/app-car-manager-v2` (`/truck/*`). Không đụng phân hệ CAR.

---

## 1. Yêu cầu tóm tắt

| # | Yêu cầu | Loại |
|---|---|---|
| R1 | Menu mới **"Bảo trì"** trong sidebar truck, có màn danh sách | UI mới |
| R2 | CRUD bản ghi bảo trì: **Phương tiện** · **Bắt đầu – Kết thúc** · **Chi phí** | Tính năng mới |
| R3 | Danh sách cột: Ngày · Phương tiện · Thời gian bảo trì · Chi phí · Cập nhật bởi · Cập nhật · Hành động (Sửa/Xoá) | UI mới |
| R4 | **Không cho tạo chuyến** với xe đang trong khoảng bảo trì | Quy tắc nghiệp vụ (chặn cứng) |
| R5 | Bảng điều khiển: chi phí bảo trì cộng vào **Tổng chi phí**, **Cơ cấu chi phí**, **Tổng phí cố định** | Thay đổi công thức |
| R6 | **Không phân bổ** chi phí bảo trì cho từng chuyến | Ràng buộc công thức |

---

## 2. AS-IS — hiện trạng liên quan (đã đọc code 2026-09-04)

### 2.1 Mô hình chi phí truck hiện tại (một nguồn: `computeTruckPnl`)

| Nhóm | Thành phần | Nguồn dữ liệu | Cấp tính | Ghi chú |
|---|---|---|---|---|
| **Biến đổi** | Nhiên liệu (phân bổ theo km) · Cầu đường · Phát sinh | `car_trips` (LOG, COMPLETED) + `car_trip_extra_costs` | theo chuyến | nhiên liệu đóng băng theo báo cáo (`trr_vehicle_fuel`) |
| **Cố định** | Lương tài xế · Khấu hao xe | `loadTruckFixedMonthly`: `car_truck_fixed_costs` (nhập tay) → `car_truck_cost_rates` (mức hiệu lực theo tháng) → 0 | theo tháng | **về 0 khi tháng có 0 chuyến** (QA 2026-07-30, `fixedCostWithoutTrips`) |
| — | Bảo hiểm | bỏ khỏi mô hình 2026-07-21 (field còn, luôn 0) | — | |

Công thức đang chạy ([truck-pnl.service.ts](../../packages/core/src/truck/truck-pnl.service.ts)):

```
variableCost = fuelCost + tollFee + extraTotal
fixedCost    = salary + depreciation                 (về 0 nếu tripCount = 0)
netProfit    = revenue − variableCost − fixedCost
```

**Phân bổ theo chuyến** (`loadTruckFixedAllocation`, đóng băng khi lập BC qua `trr_fixed_alloc`, REQ-20260821):
`share = (salary_xe ÷ n_chuyến, depreciation_xe ÷ n_chuyến)` → cột "CP cố định phân bổ" + `profitAfterFixed` ở màn Chi phí & Lợi nhuận, chi tiết chuyến, export finance.

### 2.2 Nơi hiển thị các con số này (tất cả đọc chung `computeTruckPnl`)

| Màn / file | Dùng gì | Ảnh hưởng nếu đổi `fixedCost` |
|---|---|---|
| Bảng điều khiển `truck/dashboard/page.tsx` | KPI Tổng chi phí = `variableCost + fixedCost`; donut 5 lát (fuel/toll/other/salary/depreciation) **phải cộng đúng = tâm donut**; card Tổng phí cố định (lương + KH); tooltip công thức chữ | **mục tiêu của REQ** |
| Chi phí & Lợi nhuận — tab Tổng quan `truck/pnl/page.tsx` | bảng METRICS 10 dòng (…lương, khấu hao, **Tổng phí cố định**, số chuyến, LN ròng); CostCard cố định 2 dòng | subtotal ≠ tổng các dòng nếu không thêm dòng |
| Export P&L `truck/pnl/export/route.ts` | cùng 10 dòng | như trên |
| Chi phí & Lợi nhuận — tab Theo chuyến `truck/finance/page.tsx` | card `sumFixed` = `fixedCost`, `sumNet` = `netProfit`; cột phân bổ theo chuyến | card tự cộng; cột phân bổ **không** đổi (R6) |
| Review lập BC `getTruckReportReview` | `fixedCost` từng xe qua `computeTruckPnl` | tự cộng |
| Báo cáo tháng (template khách) `truck-report-export.queries.ts` + `truck-monthly-summary-workbook.ts` | mục B: dòng 19–24 (nhiên liệu, cầu đường, phát sinh, lương, khấu hao, **"Chi phí khác" = bảo hiểm = luôn 0**), dòng 25 `SUM(C19:C24)`; sheet từng xe `costTotal = variableCost + fixedCost`, `net = netProfit` | nếu `fixedCost` đổi mà dòng B không đổi → `costTotal`/`net` từng xe lệch với `Tổng chi phí` mục B |
| Badge "Đã lập BC · dữ liệu đã thay đổi" `getTruckReportStatus` | stale = `max(trp_updated_at)` hoặc `tfc_updated_at` > `trr_created_at` | cần thêm nguồn stale mới |

### 2.3 Cơ chế "bảo trì" đang có — KHÔNG phải cái REQ này cần

| Cơ chế | Bản chất | Vì sao không tái dùng |
|---|---|---|
| `car_vehicles.cvh_status = 'MAINTENANCE'` | enum trạng thái xe, đặt **thủ công** (form xe CAR có select trạng thái; **form xe TRUCK không có**) | không có khoảng thời gian, không có chi phí, không có lịch sử |
| Guard `VEHICLE_MAINTENANCE` (`driver-availability.ts`) | **cảnh báo mềm** khi gán xe có status MAINTENANCE — ADMIN/MANAGER "Vẫn tiếp tục" được | R4 yêu cầu **chặn**, không cho xác nhận vượt |
| `car_maintenance_alerts` + `/maintenance` (CAR) | cảnh báo tới hạn thay dầu / đăng kiểm, cron hằng ngày | là alert, không phải bản ghi chi phí; scope CAR |
| `car_expenses` loại `REPAIR` | chi phí CAR do tài xế nộp, có duyệt | luồng CAR, không dùng cho truck |
| `car_truck_fixed_costs` | 1 dòng / (xe, tháng): lương/KH/bảo hiểm nhập tay | không có khoảng ngày, không có "cập nhật bởi", không thể nhiều lần / tháng, không chặn được chuyến |

→ **Cần bảng mới** cho bản ghi bảo trì.

### 2.4 Các đường tạo/sửa chuyến truck (nơi phải chặn — R4)

| # | Đường | File | Guard hiện có |
|---|---|---|---|
| 1 | Quản lý tạo chuyến (gán / ghi chuyến đã xong) | `createTruckTripAction` | `assertTruckMonthOpen` + `ensureAssignmentConfirmed` (mềm) |
| 2 | Quản lý sửa chuyến | `updateTruckTripAction` | như trên; guard mềm chỉ chạy khi **đổi xe / đổi tài xế** |
| 3 | Quản lý gán xe cho chuyến chờ | `assignTruckTripAction` | như trên |
| 4 | Tài xế tự tạo `/today/truck/new` | `createTruckTripAction` (role DRIVER) | guard mềm → **hard** với DRIVER |
| 5 | Tài xế tự sửa | `driverUpdateTruckTripAction` | month lock; **không** có guard xe |
| 6 | **Import Excel** (1 xe, nhiều ngày) | `importTruckTripsAction` → `createTruckTrip` core trực tiếp | month lock theo tháng; **không** có guard xe |
| 7 | Sửa chi phí ở review BC | `patchTruckTripCostsAction` | không đổi xe/ngày → không liên quan |

### 2.5 Điều hướng

- Sidebar truck chia section `Vận hành / Tài chính / Dữ liệu / Báo cáo` (`nav-items.ts`, `NavItem.section`).
- Mobile: 6 mục truck → 3 tab phẳng (Chuyến · Đội xe · Tài xế) + nút "Thêm" mở sheet nhóm theo section. Thêm mục mới **sau `truckDrivers`** thì thanh dưới không đổi, mục mới rơi vào sheet "Thêm".

---

## 3. TO-BE — quy tắc nghiệp vụ (định nghĩa chính xác)

Ký hiệu: `M` = tháng `'YYYY-MM'` (UTC, cùng `monthKey` hiện dùng); `V` = tập xe trong phạm vi lọc (khu vực / xe / ACL); `R(M,V)` = bản ghi bảo trì **còn sống** (`tmn_deleted_at IS NULL`) có `cvh_id ∈ V` và `tmn_month = M`.

| Mã | Quy tắc |
|---|---|
| **BR-1 Hạch toán tháng** | `tmn_month = to_char(tmn_start_date,'YYYY-MM')`. **100 % chi phí vào tháng bắt đầu**; không chia theo ngày sang tháng khác (1 hoá đơn = 1 tháng, biết ngay lúc nhập). |
| **BR-2 Tổng bảo trì** | `maintenanceCost(M,V) = Σ round(tmn_cost)` với `r ∈ R(M,V)`. VND nguyên (cùng `Math.round(parseAmount())`). |
| **BR-3 Phí cố định** | `fixedCost(M,V) = salary + depreciation + maintenanceCost`. Lương/KH giữ nguyên quy tắc **về 0 khi `tripCount = 0`**; **`maintenanceCost` KHÔNG về 0** (bản ghi có ngày cụ thể — xe nằm xưởng cả tháng vẫn là chi phí thật của tháng đó). |
| **BR-4 Tổng chi phí** | `totalCost = variableCost + fixedCost` (KPI "Tổng chi phí" dashboard) → tự bao gồm bảo trì. |
| **BR-5 Lợi nhuận ròng** | `netProfit = revenue − variableCost − fixedCost` (công thức hiện tại, không sửa) → tự trừ bảo trì. Tooltip chữ trên dashboard phải cập nhật cho khớp. |
| **BR-6 Không phân bổ** | `loadTruckFixedAllocation`, `computeTruckFixedAllocRows`, `trr_fixed_alloc`, cột "CP cố định phân bổ", `profitAfterFixed` **không đổi** — bảo trì không nằm trong share. Hệ quả cần **hiển thị rõ**: `Σ profitAfterFixed(chuyến) − maintenanceCost(M,V) = netProfit(M,V)` (± làm tròn, ± lệch freeze đã chấp nhận ở REQ-20260821). |
| **BR-7 Chặn tạo chuyến** | Tồn tại `r` sống với `r.cvh_id = vehicle_id` và `r.tmn_start_date ≤ date_utc(scheduled_at) ≤ r.tmn_end_date` (bao gồm 2 đầu, **đơn vị ngày**) → từ chối **`CAR-E1013` (409)**, tier BLOCK: không có nút "Vẫn tiếp tục", áp dụng **mọi role** (ADMIN/MANAGER/DRIVER) và **mọi đường ghi chuyến** ở §2.4 #1–#7: tạo, gán, sửa (**mọi lần sửa, kể cả không đổi xe/ngày — chốt Q6**, kiểm tra cả (xe, ngày) đang lưu và (xe, ngày) mới), hoàn thành, sửa chi phí ở review BC, tài xế tự tạo/sửa/hoàn thành, import Excel (kiểm tra **tất cả dòng trước khi ghi**, lỗi nêu số dòng). Áp dụng cả khi "ghi chuyến đã hoàn thành" (bản ghi bảo trì nói xe nằm xưởng → mâu thuẫn → chặn; sai thì sửa bản ghi bảo trì). Form chuyến còn **disable option xe** đang bảo trì theo ngày đã chọn (server vẫn là nguồn chặn). |
| **BR-8 Chuyến có sẵn** | **(Chốt 2026-09-04, Q5 = "cảnh báo và chặn")** Không được ghi/sửa bản ghi bảo trì lên khoảng ngày mà xe **đã có chuyến** (LOG, còn sống, không CANCELLED/REJECTED) → `CAR-E1014` (BLOCK). Form hiển thị cảnh báo **ngay khi chọn xe + ngày** (và khi mở trang sửa), xe có chuyến trong khoảng bị **disable trong Select**, nút Lưu bị khoá. Hai chiều loại trừ nhau: bảo trì ↔ chuyến không bao giờ cùng (xe, ngày). |
| **BR-9 Thứ tự guard** | Khi lưu chuyến: (1) month lock `assertTruckMonthOpen` → (2) **BR-7 chặn cứng** → (3) guard mềm hiện có (`VEHICLE_MAINTENANCE` theo `cvh_status`, tài xế đang chuyến…). Chặn cứng đứng trước nên không bao giờ hiện dialog xác nhận cho xe đang bảo trì theo bản ghi. |
| **BR-10 Khoá tháng** | CRUD bảo trì kiểm tra `isTruckMonthClosed(tmn_month, region xe)` **và** whole-fleet (giống `upsertTruckFixedCostAction`) → tháng đã chốt sổ: `CAR-E1002`, form read-only. Khi **sửa đổi ngày bắt đầu sang tháng khác**: kiểm tra **cả tháng cũ và tháng mới** (như `updateTruckTripAction`). |
| **BR-11 Báo cáo** | Lập báo cáo **không khoá** (PLAN-20260707). CRUD bảo trì trong tháng đã lập BC → badge cam "dữ liệu đã thay đổi, cần lập lại" (thêm `getTruckMaintenanceLastUpdated` vào phép tính stale). File Excel đã tạo bất biến (số tính lúc generate). |
| **BR-12 Trạng thái xe** | `cvh_status = MAINTENANCE` (thủ công) **không tự đồng bộ** từ bản ghi bảo trì và ngược lại; guard mềm theo status giữ nguyên. Card "Tình trạng đội xe" trên dashboard vẫn đếm theo `cvh_status` (ngoài phạm vi). |
| **BR-13 Phạm vi dữ liệu** | Bản ghi bảo trì **kế thừa khu vực của xe** (`cvh_region`) như chuyến. Danh sách/CRUD tuân `requireFleet('TRUCK')` + region ACL (`resolveRegionFilter`/`resolveVehicleScope`): user bị thu hẹp chỉ thấy/ghi cho xe trong khu vực được phép. |
| **BR-14 Quyền** | Xem + CRUD: ADMIN, MANAGER (STAFF) có TRUCK access. DRIVER: không có menu, không có action (truck layout đã redirect DRIVER → `/today`). Xoá = **soft delete** (`tmn_deleted_at`). |
| **BR-15 Validate** | `vehicle_id` uuid, là xe TRUCK còn sống trong scope; `start_date`, `end_date` dạng `YYYY-MM-DD`, `end ≥ start`; `cost ≥ 0` (cho phép **0** — bảo hành/không tốn phí nhưng vẫn cần chặn chuyến). Hai bản ghi cùng xe chồng khoảng nhau: **cảnh báo mềm** trong form (có thể là 2 hạng mục sửa khác nhau), không chặn. |

### 3.1 Ví dụ số (minh hoạ, không phải dữ liệu thật)

Tháng 09/2026, xe A có 4 chuyến COMPLETED, lương 12.000.000, KH 4.000.000, bảo trì 1 lần 7.500.000 (05–08/09):

```
fixedCost      = 12.000.000 + 4.000.000 + 7.500.000 = 23.500.000
share/chuyến   = (12.000.000 ÷ 4, 4.000.000 ÷ 4) = (3.000.000, 1.000.000)   ← KHÔNG có bảo trì
Σ share        = 16.000.000 = lương + KH (đúng như hiện tại)
Σ profitAfterFixed(4 chuyến) − 7.500.000 = netProfit tháng                    ← BR-6
Tạo chuyến xe A ngày 06/09 → CAR-E1013; ngày 09/09 → cho phép.
```

Tháng 10/2026 xe A **không có chuyến**, bảo trì 20.000.000: `fixedCost = 0 + 0 + 20.000.000`, `netProfit = −20.000.000` (BR-3). Dashboard "Tổng phí cố định" = 20.000.000, card cố định hiện dòng Bảo trì 20.000.000, lương/KH 0.

---

## 4. Nhận định các logic chồng chéo và cách xử lý

| # | Chồng chéo | Rủi ro nếu bỏ qua | Xử lý trong REQ này |
|---|---|---|---|
| C1 | Bảo trì vs Lương/KH đều là "phí cố định" | Đếm 2 lần nếu vừa nhập bảo trì vừa nhập vào `car_truck_fixed_costs` | Bảo trì là **thành phần thứ 3 riêng biệt** trong `fixedCost`; không ghi vào bảng fixed_costs; card/bảng luôn tách dòng "Bảo trì" |
| C2 | Dashboard vs P&L vs Finance vs Báo cáo | Dashboard cộng bảo trì nhưng màn khác không → cùng tháng 2 số "Tổng phí cố định" khác nhau | **Một nguồn**: cộng trong `computeTruckPnl` → mọi màn đọc chung. Mỗi màn có dòng/label riêng để tổng = Σ dòng |
| C3 | Tổng tháng (có bảo trì) vs phân bổ theo chuyến (không bảo trì) | Người xem cộng cột LN từng chuyến không ra LN tháng | Ghi chú 1 dòng dưới card "Chi phí cố định" ở tab Theo chuyến: *"gồm bảo trì X — không phân bổ theo chuyến"*; tooltip cột phân bổ nêu rõ |
| C4 | Đóng băng theo BC (`trr_fixed_alloc`) | Sợ bảo trì phải freeze | Bảo trì là số **cấp tháng**, không per-trip → không cần freeze; file BC tự cố định lúc generate; màn hình tính live + badge cam (BR-11) |
| C5 | Guard mềm `VEHICLE_MAINTENANCE` (status) vs chặn cứng theo bản ghi | 2 thông điệp "bảo trì" khác nhau, 1 vượt được 1 không | BR-9 định thứ tự; i18n phân biệt "đang bảo dưỡng (trạng thái xe)" vs "đang bảo trì từ … đến … (bản ghi)" |
| C6 | Quy tắc "0 chuyến → phí cố định về 0" | Áp cho bảo trì thì tháng xe nằm xưởng mất chi phí | BR-3: chỉ lương/KH về 0; bảo trì giữ |
| C7 | Import Excel bỏ qua guard | Chèn chuyến vào ngày bảo trì qua đường import | BR-7 áp cho import, pre-scan toàn file |
| C8 | Sửa chuyến không liên quan (sửa cầu đường) khi chuyến nằm trong khoảng bảo trì | Chặn oan? | **Chốt Q6: chặn luôn.** Trạng thái "chuyến nằm trong khoảng bảo trì" vốn không thể xảy ra (BR-7 + BR-8 loại trừ hai chiều), nên kiểm tra ở mọi đường sửa chỉ là phòng thủ, không gây chặn oan trong vận hành bình thường |
| C9 | Khoảng bảo trì vắt qua 2 tháng | Chi phí "đi" tháng nào? | BR-1: tháng bắt đầu, 100 %; form hiện dòng "Hạch toán vào tháng MM/yyyy" |
| C10 | Khu vực / ACL | User khu vực A thấy bảo trì xe khu vực B | BR-13 |

---

## 5. Gap analysis — phạm vi thay đổi

| Khu vực | Việc | Mức |
|---|---|---|
| DB | Bảng mới `car_truck_maintenances` (prefix `tmn_`) + migration `0030` | Thấp (bảng độc lập) |
| Core | `computeTruckPnl`: field `maintenanceCost`, cộng vào `fixedCost`; helper `loadTruckMaintenanceMonthly`; guard `assertVehicleNotUnderMaintenance` | **Cao — lõi công thức** |
| Zod | `truck-maintenance.zod.ts` | Thấp |
| Actions | create/update/delete maintenance; sửa 5 action chuyến + import (BR-7) | Trung bình |
| Queries | list (filter tháng/khu vực/xe, join `car_users` cho "Cập nhật bởi"), overlap trips, last-updated | Trung bình |
| UI mới | `/truck/maintenance` (list), `/new`, `/[id]/edit` | Trung bình |
| UI sửa | Dashboard (KPI/donut/card/tooltip), P&L (dòng + card), P&L export, Finance (ghi chú), review BC + workbook dòng 24, form chuyến (disable option + toast), nav | Trung bình |
| i18n | vi/en/ko | Thấp |
| Test | E2E `truck-maintenance.spec.ts`, TC/TR | Trung bình |

---

## 6. User flow

```
[Quản lý] Sidebar › Vận hành › Bảo trì
  → Danh sách (lọc tháng · khu vực · xe) — tổng chi phí bảo trì tháng hiển thị dưới tiêu đề
  → [+ Thêm bảo trì] → chọn xe, Bắt đầu, Kết thúc, Chi phí
      • dòng hint "Hạch toán vào tháng 09/2026"
      • nếu xe đã có chuyến trong khoảng → banner cảnh báo (vẫn lưu được)
      • tháng đã chốt sổ → form read-only
  → Lưu → toast "Đã thêm bảo trì cho 50E-32407" → về danh sách
  → Sửa / Xoá (soft) từ cột Hành động hoặc trang sửa

[Quản lý / Tài xế] Tạo chuyến, chọn xe + ngày trong khoảng bảo trì
  → option xe hiện "(bảo trì 05/09–08/09)" và bị disable theo ngày đã chọn
  → nếu vẫn gửi (đổi ngày sau khi chọn xe, hoặc request cũ) → server CAR-E1013 → toast lỗi, không có "Vẫn tiếp tục"

[Import Excel] file có dòng ngày ∈ khoảng bảo trì của xe
  → từ chối toàn file trước khi ghi: "Dòng 7: xe 50E-32407 đang bảo trì 05/09–08/09/2026"

[Dashboard] tháng có bảo trì
  → KPI Tổng chi phí tăng đúng Σ bảo trì; donut thêm lát "Bảo trì"; card Tổng phí cố định thêm dòng "Bảo trì"
  → Lợi nhuận ròng giảm đúng Σ bảo trì; tooltip công thức có "+ Chi phí bảo trì"

[Chi phí & LN › Theo chuyến] cột phân bổ không đổi; card "Chi phí cố định" có ghi chú "gồm bảo trì X — không phân bổ theo chuyến"
```

---

## 7. Ràng buộc kỹ thuật

- Neon HTTP không transaction → mỗi action 1 câu ghi chính; audit log ghi sau (đã là pattern).
- So ngày: dùng chuỗi `'YYYY-MM-DD'` từ `scheduledAt.toISOString().slice(0,10)` (form gửi `YYYY-MM-DD` → `new Date()` = 00:00 UTC; import dùng `${iso}T00:00:00.000Z`) — **cùng quy ước UTC với `monthKey`** nên không lệch ngày.
- Cột `tmn_month` lưu sẵn (derive lúc ghi) để `computeTruckPnl` lọc bằng `inArray(tmn_month, months)` như `car_truck_fixed_costs.tfc_month`.
- Migration áp tay, idempotent, trên mọi nhánh (pattern 0025/0029); cột/bảng mới không phá build cũ.
- Không hard-code text; 3 ngôn ngữ.

---

## 8. Điểm cần người dùng chốt (kèm khuyến nghị)

| # | Câu hỏi | Khuyến nghị | Lý do |
|---|---|---|---|
| Q1 | Bảo trì cộng ở **mọi màn đọc `computeTruckPnl`** (dashboard, P&L, finance, review BC, export, template BC) hay **chỉ dashboard**? | **Mọi màn** (một nguồn) | "Chỉ dashboard" tạo 2 số Tổng phí cố định khác nhau cho cùng tháng; LN ròng dashboard ≠ P&L |
| Q2 | Template báo cáo tháng dòng 24 "Chi phí khác" (đang luôn 0) → **đổi nhãn "Chi phí bảo trì"** và ghi số bảo trì vào đó? | **Đổi nhãn**, giữ vị trí dòng (không làm xê dịch template) | Không thêm dòng → công thức `SUM(C19:C24)` + layout khách giữ nguyên |
| Q3 | Tháng hạch toán = **tháng bắt đầu** hay tháng kết thúc? | **Bắt đầu** | Biết ngay lúc nhập; khớp hint trên form; đơn giản |
| Q4 | Cột "Ngày" trong danh sách = **ngày ghi nhận** (`created_at`) hay = ngày bắt đầu? | **Ngày ghi nhận** | Cột "Thời gian bảo trì" đã hiển thị Bắt đầu; "Ngày" + "Cập nhật" = tạo lúc nào / sửa lúc nào |
| Q5 | Xe đã có chuyến trong khoảng bảo trì khi tạo bản ghi: **cảnh báo** hay chặn? | **Cảnh báo, vẫn lưu** | Bản ghi bảo trì là sự thật cần ghi chi phí; chuyến cũ giữ nguyên (BR-8) |
| Q6 | Sửa chuyến **không đổi xe/ngày** nằm trong khoảng bảo trì: cho phép? | **Cho phép** | Tránh chặn oan sửa cầu đường/ghi chú; cùng precedent guard hiện có |
| Q7 | Tháng **0 chuyến**: bảo trì vẫn tính hay về 0 như lương/KH? | **Vẫn tính** | Chi phí có ngày, không phụ thuộc chuyến (đúng tinh thần "không phân bổ theo chuyến") |
| Q8 | Có thêm trường **ghi chú / nội dung bảo trì**? | **Không (đúng 3 field yêu cầu)**; thêm sau nếu cần | Tối giản theo yêu cầu |

---

## 9. Quyết định chốt (người dùng, 2026-09-04)

| # | Trả lời | Hệ quả triển khai |
|---|---|---|
| Q1 | "Chi phí bảo trì tính trên chi phí **tổng**, không phải từng chuyến" | Cộng trong `computeTruckPnl.fixedCost` → mọi màn (dashboard, P&L, finance, review BC, export, template BC) cùng một số; phân bổ theo chuyến **không đổi** |
| Q2 | "Chi phí khác và chi phí bảo trì **khác nhau**" | Template BC tháng: giữ dòng 24 "Chi phí khác"; **thêm dòng 25 "Chi phí bảo trì"**; các mục từ Σ trở xuống dịch 1 dòng (Σ = `SUM(C19:C25)` ở dòng 26, LN gộp dòng 29 = `C16−C26`) |
| Q3 | Theo khuyến nghị | `tmn_month` = tháng **bắt đầu**, 100 % |
| Q4 | Ngày ghi nhận | Cột "Ngày" = `tmn_created_at` |
| Q5 | "Cảnh báo **và chặn**, show cảnh báo ngay khi mở lên, chặn chọn" | BR-8 → BLOCK `CAR-E1014`; form preview xung đột ngay khi có xe + ngày (debounce 300 ms, chạy cả khi mở trang sửa), xe có chuyến bị disable trong Select, nút Lưu khoá |
| Q6 | Không cho phép | BR-7 kiểm tra ở **mọi** action sửa/hoàn thành/vá chi phí chuyến, cả (xe, ngày) cũ và mới |
| Q7 | Có tính | `maintenanceCost` không bị zero khi `tripCount = 0` |
| Q8 | Không | Không có trường ghi chú |

**Trạng thái**: đã chốt → triển khai theo [PLN-20260904-truck-maintenance.md](../plan/PLN-20260904-truck-maintenance.md) (xem RPT-20260904).
