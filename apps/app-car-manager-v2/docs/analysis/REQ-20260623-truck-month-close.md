# REQ-20260623 — Pha 2: Chốt sổ tháng (G1) + gộp màn Chi phí & Lợi nhuận (G4)

| | |
|---|---|
| **Ngày** | 2026-06-23 |
| **Nguồn** | `Truck Manager.html` → `design.dc.js` (prototype `class Component`), đối chiếu code built |
| **Tiền đề** | [REQ-20260622 audit](REQ-20260622-truck-design-audit.md) — Pha 1 (G2/G3/G5) đã xong |

---

## 1. Ngữ nghĩa "Chốt sổ" trong design (giải mã từ prototype)

| Thành phần | Dòng | Ý nghĩa |
|---|---|---|
| `monthStatus(key)` | 211 | Tháng có trạng thái **OPEN / CLOSED**. `monthClosed[key]` (user chốt) ưu tiên, else `monthMeta[key].status` seeded. |
| `askClose → doClose` | 37–39 | Chốt tháng = set `monthClosed[key]=true` (có bước xác nhận). |
| `askReopen → setReopenReason → doReopen` | 43–56 | Mở lại tháng **bắt buộc nhập lý do** (`reopenDisabled` khi reason rỗng). |
| `'Chờ chốt'` | 595–596 | **Trong màn tài chính, cost & profit hiển thị "Chờ chốt" cho tới khi tháng được chốt** — số liệu coi như tạm tính. |
| `computeTrip` | 472–478 | Cost/profit **mỗi chuyến** = `fuelQty×fuelPrice + toll + other`; `profit = revenue − cost`. **Giống hệt app built** (biến phí theo chuyến). |
| `periodAgg` | 482–491 | P&L kỳ: revenue/fuel/toll/other theo chuyến + `fixed=fixedForRange` (prorate theo ngày) → **split salary/khấu hao bằng RATIO cứng** `11345000/(11345000+3541667)≈0.762`, **không có bảo hiểm**. |
| `monthMeta` / `monthConst` | 191–224 | "Mô hình net-cost cuối tháng": mỗi tháng có **danh sách hoá đơn xăng dầu** → **giá BQ tháng** (mean đơn giá) + **định mức L/km** (tổng lít÷tổng km). Là **bảng phân tích nhiên liệu**, KHÔNG dùng làm cơ sở tính cost trong computeTrip. |

**Tóm tắt:** "Chốt sổ" = đánh dấu tháng CLOSED (có xác nhận) / mở lại (có lý do); trước khi chốt, màn tài chính coi cost/profit là **tạm tính ("Chờ chốt")**; kèm 1 bảng đối soát hoá đơn xăng dầu hàng tháng.

## 2. Phản biện (⚠️ những chỗ KHÔNG nên bê nguyên prototype)

| # | Vấn đề trong prototype | Phản biện | Đề xuất |
|---|---|---|---|
| P1 | **Ẩn cost/profit thành "Chờ chốt" cho tới khi chốt** | App built đang cho manager **thấy lợi nhuận ngay** khi tài xế hoàn thành chuyến (liters×price). Ẩn hết thành "Chờ chốt" là **regress UX** + dễ gây hiểu nhầm "mất số liệu". | **Giữ số liệu tạm tính luôn hiển thị**; "chốt" chỉ **khoá + đóng dấu chính thức** (badge Đang mở/Đã chốt). "Chờ chốt" → đổi thành nhãn trạng thái, không che số. |
| P2 | **Fixed = 1 cục, split salary/khấu hao bằng ratio CỨNG, không có bảo hiểm** | App built đã có **salary + depreciation + insurance nhập riêng theo từng xe/tháng** (`car_truck_fixed_costs`) — linh hoạt + audit được hơn hẳn. Ratio cứng là shortcut prototype. | **Giữ model built** (3 khoản nhập tay). KHÔNG dùng ratio cứng. |
| P3 | **Bảng hoá đơn xăng dầu tháng** (giá BQ + định mức L/km) | Là feature phân tích **tách biệt**, cần bảng mới `car_truck_fuel_invoices` + UI nhập hoá đơn — phình to Pha 2. computeTrip không phụ thuộc nó. | **Defer** sang feature riêng. Pha 2 dùng nhiên liệu **theo chuyến** (đang có) + định mức tĩnh trên xe. |
| P4 | Prototype "chốt" chỉ **ẩn/hiện số**, KHÔNG thật sự khoá sửa chuyến | "Chốt sổ" thật phải **khoá kỳ tài chính**: tháng đã chốt thì không cho tạo/sửa/xoá/hoàn-thành chuyến thuộc tháng đó (nếu không, P&L "chính thức" vẫn đổi được). | **Thêm enforce khoá**: action truck-trip chặn khi tháng (theo `trp_scheduled_at`) đã CLOSED → `CAR-E1002`. Đây mới là giá trị thật của chốt sổ. |
| P5 | Trạng thái chốt theo **cả phòng/tháng** (dept-wide) | Hợp lý (đóng sổ tài chính cả đội xe theo tháng), không cần per-xe. | Giữ: chốt theo **(ent, TRUCK, tháng)**. |

## 3. TO-BE đề xuất (đã điều chỉnh theo phản biện)

### 3.1 Schema (migration thủ công `0013_truck_month_close.sql`)
Bảng mới `car_truck_month_close` — mỗi dòng = 1 tháng đã chốt (vắng dòng = OPEN):
- `tmc_id` PK, `ent_id`, `tmc_vehicle_type` (='TRUCK', reserve cho CAR sau), `tmc_month` CHAR(7) 'YYYY-MM'
- `tmc_closed_by`, `tmc_closed_at`
- `tmc_reopen_reason` (text, null), `tmc_reopened_by`, `tmc_reopened_at`, `tmc_deleted_at` (mở lại = soft-delete + ghi lý do)
- unique (ent, type, month) where `tmc_deleted_at IS NULL`.

### 3.2 Logic
- `getTruckMonthStatus(ent, months[])` → map month→OPEN|CLOSED.
- `closeTruckMonthAction(month)` — STAFF + `requireFleet('TRUCK')`, audit `TRUCK_MONTH.CLOSED`.
- `reopenTruckMonthAction(month, reason)` — reason bắt buộc, audit `TRUCK_MONTH.REOPENED` (kèm reason).
- **Khoá kỳ (P4):** `assertMonthOpen(ent, scheduledAt)` gọi trong create/update/delete/complete truck-trip actions → CLOSED thì throw `CAR-E1002`.

### 3.3 Màn gộp "Chi phí & Lợi nhuận" (G4)
Gộp `/truck/pnl` + `/truck/settings` thành 1 màn: chọn tháng → **bảng P&L** (computeTruckPnl, đang có) + **editor chi phí cố định** (salary/khấu hao/bảo hiểm, đang có ở settings) + **badge trạng thái** (Đang mở/Đã chốt) + nút **Chốt sổ** / **Mở lại (nhập lý do)**. Nav `truckSettings` gộp vào `truckPnl` (đổi nhãn "Chi phí & Lợi nhuận"); `/truck/settings` redirect sang.

## 4. Cần chốt trước khi code

- **Q-A**: trước khi chốt — **giữ số tạm tính hiển thị** (đề xuất P1) hay **ẩn "Chờ chốt"** (bám prototype)?
- **Q-B**: **defer** bảng hoá đơn xăng dầu (đề xuất P3) hay **làm luôn** trong Pha 2?
- (P2 giữ fixed-cost model built, P4 khoá kỳ, P5 chốt theo tháng/phòng — sẽ làm theo đề xuất trừ khi phản hồi khác.)
</content>
