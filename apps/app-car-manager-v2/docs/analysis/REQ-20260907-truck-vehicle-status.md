# REQ-20260907 — Truck: Trạng thái Phương tiện (Sẵn sàng · Bảo trì tự động · Ngừng sử dụng)

> **Yêu cầu gốc (2026-09-07, nguyên văn)**
> "MENU PHƯƠNG TIỆN — Thêm Trạng thái cho Phương tiện, chỉ có thể chuyển Sẵn sàng với Ngừng sử dụng, còn trạng thái Bảo trì được auto gán khi phương tiện nằm trong thời gian bảo trì.
> · Sẵn sàng — Phương tiện sẵn sàng để tạo chuyến
> · Bảo trì — Phương tiện nằm trong danh sách bảo trì — Không thể tạo chuyến mới
> · Ngừng sử dụng — Phương tiện đã ngừng sử dụng — Không thể tạo chuyến mới
> Nếu xe được thêm vào menu Bảo trì, thì trạng thái ở Phương tiện được cập nhật thành Bảo trì."

Phạm vi: **workspace TRUCK** của `apps/app-car-manager-v2` (`/truck/*`). Không đụng phân hệ CAR (form xe con giữ 4 trạng thái như cũ).
Tiền đề: [REQ-20260904-truck-maintenance.md](REQ-20260904-truck-maintenance.md) (menu Bảo trì, bảng `car_truck_maintenances`, BR-7/BR-8 chặn hai chiều). REQ này chính là "REQ riêng" mà BR-12 của REQ-20260904 để lại: đồng bộ trạng thái xe với bản ghi bảo trì.

---

## 1. Yêu cầu tóm tắt

| # | Yêu cầu | Loại |
|---|---|---|
| R1 | Xe tải có **3 trạng thái**: Sẵn sàng · Bảo trì · Ngừng sử dụng, hiển thị ở menu Phương tiện (danh sách + form) | UI + nghiệp vụ |
| R2 | Người dùng **chỉ chuyển tay** giữa Sẵn sàng ↔ Ngừng sử dụng | Quy tắc chuyển trạng thái |
| R3 | **Bảo trì được gán tự động** khi xe nằm trong khoảng ngày của một bản ghi ở menu Bảo trì; thêm bản ghi → trạng thái ở Phương tiện đổi thành Bảo trì | Đồng bộ tự động |
| R4 | Bảo trì và Ngừng sử dụng → **không thể tạo chuyến mới** | Quy tắc nghiệp vụ |
| R5 | Mô tả từng trạng thái hiện cho người dùng (tooltip/ghi chú) | UI |

---

## 2. AS-IS — hiện trạng (đã đọc code 2026-09-07)

### 2.1 DB / kiểu dữ liệu

| Thành phần | Hiện trạng | File |
|---|---|---|
| Enum `car_vehicle_status` | `AVAILABLE · IN_USE · MAINTENANCE · RETIRED` (dùng chung CAR + TRUCK) | `packages/db/src/schema/vehicles.schema.ts:21-26` |
| `car_vehicles.cvh_status` | NOT NULL, default `AVAILABLE`, index `(ent_id, cvh_status)` | `vehicles.schema.ts:74,97` |
| Dữ liệu dev (TRUCK) | 3 xe `AVAILABLE`; **43C-201.55 = `MAINTENANCE` (đặt tay/seed), 60C-311.07 = `IN_USE`** — không có bản ghi bảo trì nào tương ứng | Neon DEV `ep-steep-tooth` |
| Bản ghi bảo trì | `car_truck_maintenances` (`tmn_start_date`, `tmn_end_date` bao gồm 2 đầu, `tmn_month`, `tmn_cost`, soft delete) — migration `0030` | `packages/db/src/schema/truck-maintenance.schema.ts` |

### 2.2 Ai ghi `cvh_status` cho xe tải hôm nay?

| Đường ghi | Ảnh hưởng xe tải? | File |
|---|---|---|
| Form xe tải `TruckVehicleForm` | **Không có** select trạng thái → xe tải tạo ra luôn `AVAILABLE` và không có cách đổi qua UI truck | `apps/web/src/app/(app)/truck/fleet/_components/truck-vehicle-form.tsx` |
| Form xe con (`vehicle-form.tsx`) | Có select 4 trạng thái; về lý thuyết sửa được xe tải nếu mở `/vehicles/[id]` | `apps/web/src/app/(app)/vehicles/_components/vehicle-form.tsx` |
| `updateVehicleAction` | Nhận `status` bất kỳ trong 4 giá trị (`updateVehicleSchema`), ghi thẳng `patch.cvhStatus` | `apps/web/src/server/actions/vehicles/vehicle.actions.ts:113` · `packages/shared/src/zod/vehicle.zod.ts:45` |
| State machine chuyến xe con `syncVehicleStatusForTrip` | `IN_PROGRESS → IN_USE`, `COMPLETED/CANCELLED → AVAILABLE` — chỉ chuyến dispatch CAR; **chuyến LOG (truck) không đụng `cvh_status`** | `apps/web/src/server/services/trip-state-machine.service.ts:245-270` |
| Core truck | `createTruckTrip/assignTruckTrip/updateTruckTrip` chỉ **đọc**: từ chối `RETIRED` (`CAR-E1002`) | `packages/core/src/truck/truck-trip.service.ts:125-136` |

→ Với xe tải, `IN_USE` không bao giờ được hệ thống set; `MAINTENANCE` chỉ có thể do đặt tay/seed. **Không có liên hệ nào giữa `cvh_status` và `car_truck_maintenances`** (BR-12 REQ-20260904).

### 2.3 Ai đọc `cvh_status` cho xe tải?

| Nơi đọc | Cách dùng hiện tại | File |
|---|---|---|
| Phương tiện `/truck/fleet` | Bộ lọc `?status=` 4 giá trị; badge `tStatus(v.cvhStatus)` (mobile card + bảng) | `truck/fleet/page.tsx:44,74,86,130,169,222` |
| Bảng điều khiển card "Tình trạng đội xe" | Đếm 4 trạng thái theo `cvhStatus` | `truck/dashboard/page.tsx:301-311,535-545` |
| Picker xe ở form chuyến (tạo/sửa/hôm nay) + import | `listVehicles(entId, 'active', 'TRUCK')` = **mọi xe chưa xoá, không lọc trạng thái** → xe RETIRED vẫn hiện, server mới từ chối; xe bảo trì được **làm mờ theo NGÀY chuyến** nhờ `maintenanceWindows` (REQ-20260904) | `truck/trips/new/page.tsx`, `truck/trips/[id]/edit/page.tsx`, `today/truck/new|[id]/edit/page.tsx`, `truck/import/page.tsx`, `truck-trip-form.tsx:449-458` |
| Picker xe ở form Bảo trì | `resolveVehicleScope(user)` = mọi xe tải trong khu vực được phép, kể cả RETIRED | `truck/maintenance/new/page.tsx`, `[id]/edit/page.tsx` |
| Báo cáo tháng (mục E + KPI "Xe bảo dưỡng") | `scopeVehicles.status = cvh_status`; dòng xe `MAINTENANCE` nếu `cvh_status = MAINTENANCE`, `maintenanceCount` đếm theo đó | `server/queries/truck-report-export.queries.ts:288,360-372,433` · `server/lib/truck-monthly-summary-workbook.ts:396-445` |
| Guard mềm chuyến | `evaluateAssignmentWarnings` → `VEHICLE_MAINTENANCE` khi `cvh_status = MAINTENANCE` (dialog xác nhận) | `packages/core/src/driver-availability.ts:104-113` |

### 2.4 i18n

`vehicles.status`: vi `AVAILABLE=Sẵn sàng · IN_USE=Đang sử dụng · MAINTENANCE=Bảo trì · RETIRED=Đã ngừng` (en `Retired`, ko `퇴역`) — dùng chung CAR/TRUCK. Yêu cầu dùng chữ **"Ngừng sử dụng"** cho xe tải. `screens.truckFleet.form` chưa có khoá trạng thái.

### 2.5 Vấn đề

1. Trạng thái Bảo trì ở menu Phương tiện **không phản ánh** menu Bảo trì (2 nguồn sự thật, BR-12).
2. Xe tải **không có cách** chuyển Ngừng sử dụng qua UI truck; xe RETIRED (nếu có) vẫn hiện trong picker chuyến.
3. Màn truck hiển thị trạng thái `Đang sử dụng` vô nghĩa với xe tải (không bao giờ được set).
4. Dev có 2 xe tải mang trạng thái đặt tay (`MAINTENANCE`, `IN_USE`) không có nguồn gốc.

---

## 3. TO-BE — quy tắc nghiệp vụ

| BR | Quy tắc |
|---|---|
| **BR-1 Ba trạng thái xe tải** | `AVAILABLE` "Sẵn sàng" · `MAINTENANCE` "Bảo trì" · `RETIRED` "Ngừng sử dụng". `IN_USE` không dùng cho xe tải (không hiện ở màn truck). |
| **BR-2 Trạng thái hiệu lực (dẫn xuất, không lưu)** | `effective = RETIRED` nếu `cvh_status = RETIRED`; ngược lại `MAINTENANCE` nếu tồn tại bản ghi bảo trì còn hiệu lực (`tmn_deleted_at IS NULL`) với `tmn_start_date ≤ hôm nay ≤ tmn_end_date`; ngược lại `AVAILABLE`. "Hôm nay" theo **ngày UTC** — cùng quy ước chip trạng thái D5 và guard `CAR-E1013` của REQ-20260904. Mọi màn truck đọc `effective`, không đọc `cvh_status` thô. |
| **BR-3 Chuyển tay** | Form **sửa** xe tải có select "Trạng thái" đúng 2 lựa chọn Sẵn sàng / Ngừng sử dụng. Server (`updateVehicleAction`) từ chối `MAINTENANCE`/`IN_USE` khi xe là TRUCK → `CAR-E1001` 400. Form **tạo** xe không có select (mặc định Sẵn sàng). |
| **BR-4 Ngừng sử dụng ưu tiên** | Xe RETIRED hiển thị Ngừng sử dụng kể cả khi có bản ghi bảo trì. Không cho **tạo/sửa** bản ghi bảo trì cho xe RETIRED: picker form Bảo trì ẩn xe RETIRED; server `CAR-E1002` 409 `Vehicle is retired`. Bản ghi bảo trì đã có của xe bị ngừng sau đó: giữ nguyên (lịch sử + chi phí tháng vẫn tính). |
| **BR-5 Không tạo chuyến mới** | *Ngừng sử dụng*: ẩn khỏi picker xe ở mọi đường tạo/sửa chuyến + import (trang sửa vẫn giữ xe hiện tại của chuyến để không vỡ form); server đã có `CAR-E1002`. *Bảo trì*: **giữ cơ chế theo NGÀY chuyến** của REQ-20260904 (picker mờ theo ngày, server `CAR-E1013` ở 6 đường) — đây là chặn cứng đúng nghĩa "trong thời gian bảo trì"; không thêm chặn "theo hôm nay" để không cản nhập bù chuyến quá khứ / lên lịch ngoài khoảng bảo trì (xem Q2). |
| **BR-6 Danh sách Phương tiện** | Badge + bộ lọc theo `effective` (3 giá trị). Badge Bảo trì kèm "đến dd/mm/yyyy" (ngày kết thúc bản ghi đang hiệu lực; nhiều bản ghi chồng ngày → lấy ngày kết thúc xa nhất). Tooltip/mô tả theo R5. |
| **BR-7 Form sửa xe đang Bảo trì** | Select vẫn hiện giá trị lưu (Sẵn sàng) + dòng thông tin "Xe đang bảo trì đến dd/mm/yyyy — trạng thái Bảo trì được gán tự động theo lịch bảo trì" (link tới `/truck/maintenance?vehicle=…`). Chuyển sang Ngừng sử dụng vẫn được (BR-4). |
| **BR-8 Bảng điều khiển** | Card "Tình trạng đội xe": 3 dòng theo `effective` (bỏ dòng Đang sử dụng); dòng Bảo trì là link tới `/truck/maintenance`. Vẫn theo bộ lọc khu vực như hiện tại. |
| **BR-9 Báo cáo tháng** | `scopeVehicles.status` = `effective` **tại thời điểm lập báo cáo** (thay `cvh_status`); ngữ nghĩa dòng xe "Bảo trì" / KPI "Xe bảo dưỡng" giữ nguyên. Xe RETIRED vẫn nằm trong scope như hiện tại (Q4). |
| **BR-10 Guard mềm** | `VEHICLE_MAINTENANCE` theo `cvh_status` không còn xảy ra với xe tải (không còn lưu `MAINTENANCE`) → xung đột C5 của REQ-20260904 tự hết. Không đổi code guard. |
| **BR-11 Chuẩn hoá dữ liệu** | Migration `0031`: xe TRUCK có `cvh_status ∈ {MAINTENANCE, IN_USE}` → `AVAILABLE` (idempotent). Dev: 2 dòng (43C-201.55, 60C-311.07). Sau đó Bảo trì chỉ còn đến từ bản ghi. |
| **BR-12 Audit** | Đổi trạng thái đi qua `updateVehicleAction` → audit `VEHICLE.UPDATE` với `before/after.status` (đã có). Trạng thái tự động không ghi audit (không phải hành động người dùng). |
| **BR-13 CAR không đổi** | Form xe con, dashboard xe con, `syncVehicleStatusForTrip` giữ nguyên. Nhãn truck dùng khoá i18n riêng `screens.truckFleet.status.*` để không đổi chữ "Đã ngừng" của xe con. |

### 3.1 Bảng trạng thái (hiển thị cho người dùng — R5)

| Trạng thái | Mô tả | Tạo chuyến mới | Nguồn |
|---|---|---|---|
| Sẵn sàng | Phương tiện sẵn sàng để tạo chuyến | Được | Người dùng (mặc định) |
| Bảo trì | Phương tiện nằm trong danh sách bảo trì (đến dd/mm/yyyy) | **Không** (theo ngày trong khoảng bảo trì) | **Tự động** từ menu Bảo trì |
| Ngừng sử dụng | Phương tiện đã ngừng sử dụng | **Không** | Người dùng |

### 3.2 Ví dụ

Xe 51C có bản ghi bảo trì 10–12/08/2026. Ngày 09/08 → Sẵn sàng; 10–12/08 → Bảo trì "đến 12/08/2026" (không cần thao tác); 13/08 → Sẵn sàng. Xoá bản ghi ngày 11/08 → lập tức Sẵn sàng. Chuyển xe sang Ngừng sử dụng ngày 11/08 → hiện Ngừng sử dụng (bản ghi bảo trì giữ, chi phí tháng 8 vẫn 2.000.000).

---

## 4. Gap analysis

### 4.1 Phạm vi thay đổi

| Khu vực | Hiện tại | Thay đổi | Ảnh hưởng |
|---|---|---|---|
| Core (`packages/core/src/truck`) | Không có khái niệm trạng thái hiệu lực | Thêm `truck-vehicle-status.ts`: `resolveTruckVehicleStatus`, `loadActiveMaintenanceByVehicle` | Thấp — module mới, pure + 1 query |
| Query web | `listVehicles(..., 'TRUCK')` trả `cvh_status` thô | Thêm `truck-vehicles.queries.ts`: `listTrucksWithStatus`, `listDispatchableTrucks` | Thấp |
| Action xe | Nhận 4 trạng thái | Guard TRUCK chỉ AVAILABLE/RETIRED | Thấp |
| Action bảo trì | Không kiểm RETIRED | Từ chối xe RETIRED | Thấp |
| UI `/truck/fleet` + form sửa | Không có select; badge thô | Select 2 giá trị + ghi chú; badge/lọc theo effective; bỏ IN_USE | Trung bình (UI) |
| UI dashboard | 4 dòng theo thô | 3 dòng theo effective | Thấp |
| Picker chuyến/import/bảo trì | Mọi xe chưa xoá | Loại RETIRED (giữ xe hiện tại khi sửa) | Thấp |
| Báo cáo | `cvh_status` thô | effective tại thời điểm lập | Thấp — cùng shape dữ liệu |
| DB | Có 2 xe tải trạng thái tay trên dev | Migration dữ liệu `0031` | Thấp, idempotent, không đổi schema |
| i18n | Thiếu khoá | Thêm ~10 khoá × 3 ngôn ngữ | Thấp |

### 4.2 Không đổi

Bảng/enum DB; `computeTruckPnl`; phân bổ theo chuyến; BR-7/BR-8 chặn hai chiều; state machine chuyến CAR; form xe con; nav; user guide (chưa có trang riêng cho trạng thái xe tải).

### 4.3 Chiến lược migration

Chỉ dữ liệu, không schema: `UPDATE car_vehicles SET cvh_status='AVAILABLE' WHERE cvh_type='TRUCK' AND cvh_status IN ('MAINTENANCE','IN_USE') AND cvh_deleted_at IS NULL`. Áp tay dev → staging → production như `0030`. Rollback: không cần (giá trị cũ không có nguồn nghiệp vụ); nếu muốn, backup 2 dòng trước khi chạy.

---

## 5. User flow

```
[Admin/Manager] Bảo trì › Thêm: xe 51C · 10/08–12/08 · 2.000.000 › Lưu
        │  (BR-8 REQ-20260904: không có chuyến trong khoảng → lưu OK)
        ▼
Phương tiện › 51C  badge = ● Bảo trì · đến 12/08/2026      (không thao tác gì thêm)
Bảng điều khiển › Tình trạng đội xe: Bảo trì 1 (link → /truck/maintenance)
Tạo chuyến › chọn ngày 11/08 › xe 51C mờ "đang bảo trì 10/08–12/08" (đã có)
Tạo chuyến › chọn ngày 15/08 › xe 51C chọn được (Q2: chặn theo ngày chuyến)
        │  ngày 13/08 (UTC)
        ▼
Phương tiện › 51C  badge = ● Sẵn sàng                       (tự động)

[Admin] Phương tiện › 60C-311.07 › Sửa › Trạng thái = Ngừng sử dụng › Lưu
        ▼
badge = ● Ngừng sử dụng · picker chuyến/import/bảo trì không còn 60C-311.07
gọi thẳng action tạo chuyến với 60C-311.07 → CAR-E1002 (đã có)
gọi thẳng action tạo bảo trì với 60C-311.07 → CAR-E1002 (mới)
gọi thẳng updateVehicleAction TRUCK status=MAINTENANCE → CAR-E1001 (mới)
```

---

## 6. Ràng buộc kỹ thuật

- **Ngày UTC**: "hôm nay" = `new Date().toISOString().slice(0, 10)`; ở VN (UTC+7) trạng thái đổi lúc 07:00 sáng — chấp nhận, cùng quy ước D5/CAR-E1013 hiện có; đổi sang giờ VN là REQ khác (đụng cả guard).
- **Hiệu năng**: mỗi trang đọc thêm 1 query `car_truck_maintenances` lọc `ent_id + ngày` (index theo `ent_id + cvh_id + ngày` và `ent_id + tmn_month` đã có ở `0030`) — O(số bản ghi đang hiệu lực), không N+1.
- **Multi-tenant / ACL**: mọi query kèm `ent_id`; picker và danh sách vẫn đi qua `resolveVehicleScope`/`resolveRegionFilter` (REQ-20260813).
- **Không cron**: trạng thái dẫn xuất nên không có job nền, không lệch múi giờ khi deploy.
- **Tương thích CAR**: enum không đổi; xe con tiếp tục dùng 4 trạng thái.

---

## 7. Điểm cần người dùng chốt (kèm khuyến nghị)

| Q | Câu hỏi | Khuyến nghị |
|---|---|---|
| Q1 | Bảo trì **dẫn xuất khi đọc** hay **lưu vào `cvh_status` + cron ngày**? | **Dẫn xuất** — 1 nguồn sự thật (bản ghi), đổi tức thì khi thêm/sửa/xoá bản ghi, không cron, không lệch. |
| Q2 | "Bảo trì → không thể tạo chuyến mới": chặn theo **ngày chuyến** (đã có) hay chặn **mọi chuyến** khi xe đang Bảo trì hôm nay? | **Theo ngày chuyến** — đúng nghĩa "trong thời gian bảo trì", không cản nhập bù chuyến tháng trước hay lên lịch sau khi xong bảo trì. Nếu chốt ngược: thêm `assertTruckVehicle` kiểm "hôm nay" ở create/assign (không áp update/import). |
| Q3 | Nhãn "Ngừng sử dụng" dùng riêng cho truck (xe con giữ "Đã ngừng")? | **Riêng** (`screens.truckFleet.status.*`) — không đổi UI xe con. |
| Q4 | Xe Ngừng sử dụng trong báo cáo tháng: giữ trong scope (dòng Nhàn rỗi) hay loại? | **Giữ** — tránh lệch mục E với tổng khi xe có chuyến trước lúc ngừng; nhãn "Ngừng sử dụng" trong báo cáo là REQ khác. |
| Q5 | Bỏ hẳn "Đang sử dụng" khỏi màn truck (lọc + dashboard)? | **Bỏ** — xe tải không bao giờ được set IN_USE. |

## 8. Quyết định chốt (người dùng, 2026-09-07)

| Q | Quyết định |
|---|---|
| Q1 | **OK** — Bảo trì dẫn xuất khi đọc, không lưu, không cron. |
| Q2 | **OK** — chặn tạo chuyến khi bảo trì theo NGÀY chuyến (BR-7 hiện có); không thêm chặn theo "hôm nay". |
| Q3 | **Chỉ xe tải** — "xe con không có bảo trì, chỉ tập trung vào xe tải": nhãn/logic mới nằm hoàn toàn ở workspace TRUCK (`screens.truckFleet.status.*`), phân hệ CAR không đổi. |
| Q4 | **Như khuyến nghị** — xe Ngừng sử dụng vẫn trong scope báo cáo tháng. |
| Q5 | **Phương án A** (chốt 2026-09-07, "A, tiến hành") — 3 trạng thái, bỏ "Đang sử dụng" khỏi màn xe tải; phân tích ở §8.1. |

### 8.1 Q5 — có nên giữ "Đang sử dụng" cho xe tải?

**Sự thật trong code (2026-09-07):** không nơi nào đặt `IN_USE` cho xe tải. Chỉ state machine chuyến xe con (`syncVehicleStatusForTrip`) đặt `IN_USE` khi chuyến dispatch `IN_PROGRESS`; chuyến nhật ký (LOG) của xe tải không có bước này. Xe 60C-311.07 trên dev đang `IN_USE` là giá trị seed/tay, **không có chuyến nào** và không bao giờ tự về Sẵn sàng → minh chứng trạng thái lưu tay này gây hiểu nhầm.

→ Giữ "Đang sử dụng" **dạng lưu trong DB** là không hợp lý: luôn 0 trên dashboard, hoặc kẹt mãi nếu ai đó đặt tay.

Nếu muốn phân biệt "xe đang chạy" với "xe đang bảo trì", cách duy nhất có nghĩa là **dẫn xuất từ chuyến**:

| | Phương án A — 3 trạng thái (khuyến nghị) | Phương án B — thêm "Đang sử dụng" dẫn xuất |
|---|---|---|
| Định nghĩa | Sẵn sàng · Bảo trì · Ngừng sử dụng (đúng yêu cầu gốc) | + `IN_USE` = xe có ≥ 1 chuyến LOG chưa huỷ có ngày = hôm nay (UTC). Ưu tiên: Ngừng > Bảo trì > Đang sử dụng > Sẵn sàng (Bảo trì và chuyến cùng ngày đã loại trừ nhau bởi BR-7/BR-8) |
| Người dùng chuyển tay | Sẵn sàng ↔ Ngừng sử dụng | Như A (Đang sử dụng chỉ hiển thị, không chọn được) |
| Chặn tạo chuyến? | Bảo trì (theo ngày), Ngừng | Như A — "Đang sử dụng" **không chặn**: một xe tải có thể chạy nhiều chuyến/ngày |
| Hiển thị | Badge/lọc/dashboard 3 giá trị | Badge/lọc/dashboard 4 giá trị; ngày mai tự về Sẵn sàng |
| Chi phí | Theo PLN | + 1 query `car_trips` theo ngày ở fleet/dashboard; + 1 khoá i18n × 3; sửa `TRUCK_VEHICLE_STATUSES`, `resolveTruckVehicleStatus` nhận thêm `busyToday`, `listTrucksWithStatus` nạp chuyến hôm nay |
| Rủi ro | Không | Người dùng có thể tưởng "Đang sử dụng" = không tạo được chuyến (ngược với mô tả bảng trạng thái); lệch ngày UTC (đổi lúc 07:00 VN) rõ hơn vì đổi mỗi ngày |

**Khuyến nghị: A.** Yêu cầu gốc nêu đúng 3 trạng thái và mỗi trạng thái gắn với quy tắc tạo chuyến; "Đang sử dụng" không mang quy tắc nào. Nếu cần nhìn nhanh xe nào có chuyến hôm nay, làm sau dưới dạng chỉ số riêng trên dashboard ("Xe có chuyến hôm nay: n") thay vì trộn vào trạng thái xe.
