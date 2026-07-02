# REQ-20260629 — Truck: mô hình tài chính cuối tháng + màn Chi phí&Lợi nhuận theo chuyến + module Báo cáo

| | |
|---|---|
| **Ngày** | 2026-06-29 |
| **Design nguồn** | `Car Manager UI Integration (Remix)` (folder Downloads) — `Truck Manager.dc.html` + 9 screenshots + `uploads/` (SRS KH: `truck-req.txt`, `netcost.txt`, `alltrips.txt`) |
| **Tiền đề** | [REQ-20260622 audit](REQ-20260622-truck-design-audit.md), [REQ-20260623 month-close](REQ-20260623-truck-month-close.md) — đã ship month-close + fuel-invoice + fixed-cost |
| **Phạm vi** | P0 (mô hình tài chính cuối tháng) + P1 (module Báo cáo, tách P&L 2 tab, lịch sử điều chỉnh). Cho **truck ADMIN + MANAGER**. |
| **Quyết định bị thay thế** | **REQ-20260623 P1 + P3** — xem §0. |

---

## 0. ⚠️ Quyết định bị thay thế (đọc trước)

Design mới **đảo ngược** 2 quyết định đã ghi trong REQ-20260623:

| Mã | REQ-20260623 đã chốt | Design mới yêu cầu | Lý do chấp nhận đảo |
|---|---|---|---|
| **P1** | Giữ số lợi nhuận **hiển thị ngay** (liters×price); từ chối ẩn "Chờ chốt" | Phí xăng/lợi nhuận **chỉ tính được khi chốt tháng** → trước chốt hiển thị "Pending" | Mô hình cuối tháng **bắt buộc** điều này về mặt toán học (xem §3.2). Khuyến nghị: hiển thị **"Tạm tính"** thay vì "Pending" để vẫn giữ tinh thần P1. |
| **P3** | Hoá đơn xăng = **analytics only**; `computeTrip` **không** dùng giá BQ/định mức | Phí xăng/chuyến = `km × định mức tháng × giá BQ tháng` (dùng chính giá BQ/định mức) | Bám đúng **SRS khách hàng** `netcost.txt` — đây mới là cách KH thật sự tính. Per-trip `liters×price` là shortcut của bản build. |

**Căn cứ KH (`netcost.txt`, nguyên văn rút gọn):** "Net cost của từng chuyến cũng buộc phải **chờ đến cuối tháng** mới xác định được" vì *định mức tiêu hao* (Σ lít ÷ Σ km cả tháng) và *giá xăng bình quân* (trung bình cộng đơn giá các hoá đơn) đều là số liệu **tổng hợp toàn tháng**.

> Đây là **chỉnh hướng về đúng yêu cầu gốc KH**, không phải regress. Nhưng vì lật quyết định đã ghi → ghi nhận tại đây để truy vết.

---

## 1. Yêu cầu (요구사항 요약)

| # | Yêu cầu | Loại | Ưu tiên |
|---|---|---|---|
| R1 | Phí xăng/chuyến tính theo mô hình cuối tháng: `km × định mức × giá BQ`; chốt tháng = **đóng dấu chính thức** số liệu | Nghiệp vụ | P0 |
| R2 | Màn **Chi phí & Lợi nhuận theo chuyến** (mỗi chuyến 1 dòng) với trạng thái **Tạm tính / Đã chốt**; trước chốt cột phí-xăng/lợi-nhuận hiển thị nhãn tạm tính | UI + nghiệp vụ | P0 |
| R3 | **Banner "tạm tính"** ở P&L + Dashboard khi kỳ đang chọn chứa tháng chưa chốt | UI | P0 |
| R4 | Tách **Monthly P&L thành 2 tab**: *Tổng quan P&L* + *Hoá đơn & Chốt tháng* | UI | P1 |
| R5 | Card **Tổng hợp cuối tháng** (Σ lít, Σ km, giá BQ, định mức, Σ tiền xăng) trong tab Hoá đơn | UI | P1 |
| R6 | **Lịch sử điều chỉnh** (reopen) hiển thị inline (data đã có) | UI | P1 |
| R7 | **Mở lại tháng = ADMIN-only** (siết từ ADMIN｜MANAGER) | Role | P1 |
| R8 | **Module Báo cáo**: *Lập báo cáo* (stepper chọn tháng→xác nhận) + *Danh sách báo cáo* (group tháng, badge "Mới", tải lại) | Tính năng | P1 |
| R9 | Card **Chi phí biến đổi vs cố định** ở tab Tổng quan P&L | UI | P1 |

---

## 2. AS-IS (현황 분석)

### 2.1 Mô hình tài chính (core)
- **`packages/core/src/truck/truck-cost.ts`** — `computeTruckCost`: `fuelCost = fuelLiters × fuelPrice` (nhập tay/chuyến), `profit = revenue − fuelCost − toll − Σextra`. Tính tức thì, vĩnh viễn.
- **`packages/core/src/truck/truck-pnl.service.ts`** — `computeTruckPnl`: gom theo tháng từ `car_trips` (LOG + COMPLETED). `row.fuelCost += parseAmount(t.fuelLiters) × parseAmount(t.fuelPrice)` (dòng 161). Fixed = salary+depreciation+insurance (`car_truck_fixed_costs`) + `driverSalary` (Σ `car_drivers.drv_fixed_salary` của tài xế TRUCK).
- **`apps/web/src/server/queries/truck-finance.queries.ts`** — `getTruckFuelStats`: **đã** tính `avgPrice` (mean đơn giá hoá đơn) + `consumption` (Σ lít chuyến ÷ Σ km) nhưng comment ghi **"Analytics only"** → **không** feed vào P&L.

### 2.2 Chốt sổ (đã ship)
- **`truck-finance.actions.ts`**: `closeTruckMonthAction` (ADMIN｜MANAGER) chỉ **insert** `car_truck_month_close` → **khoá** (chặn create/edit/delete/complete chuyến trong tháng via `assertTruckMonthOpen` → `CAR-E1002`). **Không recompute gì.** `reopenTruckMonthAction` (ADMIN｜MANAGER, reason min 3) → soft-delete + ghi `tmc_reopen_reason/by/at`.
- **Schema** `car_truck_month_close`: `tmc_month` CHAR(7), `tmc_closed_by/at`, `tmc_reopen_reason/by/at`, `tmc_deleted_at`. **Chưa có** cột snapshot giá BQ/định mức.

### 2.3 Màn P&L hiện tại
- **`truck/pnl/page.tsx`** — 1 trang dồn: MonthPicker + `MonthCloseControls` + bảng metric 3 tháng (12 dòng: revenue/fuel/toll/other/**variable**/salary/depreciation/insurance/driverSalary/**fixed**/trips/**netProfit**) + `FuelInvoicePanel` + `TruckFixedCostRow` xếp dọc. **Không tab.** **Không** bảng per-trip. **Không** banner tạm tính. **Không** card biến-đổi/cố-định. **Không** lịch sử điều chỉnh.

### 2.4 Báo cáo
- **Không có module.** Chỉ `truck/trips/export/route.ts` xuất Excel ad-hoc danh sách chuyến. Nav không có mục Báo cáo, không badge "Mới".

### 2.5 Role
- `truck/layout.tsx`: chặn DRIVER + yêu cầu fleet TRUCK. Mọi action finance = ADMIN｜MANAGER. Reopen hiện **ADMIN｜MANAGER** (design: ADMIN-only).

---

## 3. TO-BE (요구사항)

### 3.1 Mapping AS-IS → TO-BE
| Vùng | AS-IS | TO-BE |
|---|---|---|
| Phí xăng/chuyến | `liters × price` nhập tay, tức thì | Tháng mở: **tạm tính** (`km × định mức xe tĩnh × giá tham chiếu`), badge "Tạm tính". Tháng chốt: **chính thức** = `km × định mức tháng (snapshot) × giá BQ tháng (snapshot)` |
| Chốt tháng | Chỉ khoá | Khoá **+ snapshot** `avgPrice`, `consumption`, `totalLiters`, `totalKm` vào `car_truck_month_close` → cơ sở tính phí xăng chính thức |
| Màn finance | 1 trang dồn, chỉ tổng hợp | 2 tab; thêm **bảng per-trip** Tạm tính/Đã chốt; card biến-đổi/cố-định; card tổng hợp cuối tháng; lịch sử điều chỉnh |
| Báo cáo | export ad-hoc | Module *Lập báo cáo* + *Danh sách báo cáo* lưu trữ S3 |
| Reopen | ADMIN｜MANAGER | **ADMIN-only** |

### 3.2 Logic phí xăng cuối tháng (R1) — core mới
Công thức KH (`netcost.txt`):
```
định mức tháng   = Σ lít (hoá đơn tháng)  ÷ Σ km (chuyến tháng)
giá BQ tháng     = mean(đơn giá các hoá đơn tháng)
phí xăng/chuyến  = km chuyến × định mức tháng × giá BQ tháng
net cost/chuyến  = phí xăng + cầu đường + phát sinh
lợi nhuận/chuyến = doanh thu − net cost
```
**Hệ quả toán học:** cả 2 thừa số là tổng hợp toàn tháng ⇒ **không thể** biết chính xác trước khi tháng kết thúc + đủ hoá đơn ⇒ trạng thái "Tạm tính" trước chốt là tất yếu.

**Chiến lược lưu trữ (khuyến nghị — snapshot, không ghi per-trip):**
- Khi chốt: tính `avgPrice`, `consumption`, `totalLiters`, `totalKm` → lưu vào `car_truck_month_close` (4 cột mới). Phí xăng/chuyến **tính khi đọc** từ snapshot (deterministic, recompute được, không cần migrate `car_trips`).
- Tháng mở (tạm tính): dùng **định mức tĩnh của xe** (`cvh` fuel quota) × **giá tham chiếu** (giá BQ tháng hiện có hoặc đơn giá nhập/chuyến) → badge "Tạm tính".

> ⚠️ **Quyết định mở Q-A:** nhãn trước chốt = **"Tạm tính"** (khuyến nghị, giữ tinh thần REQ-20260623 P1, vẫn cho manager thấy số) hay **"Pending"** ẩn số (bám design mới)?

### 3.3 Thực thể / cột mới
- `car_truck_month_close` + `tmc_avg_price` DECIMAL(14,2), `tmc_consumption` DECIMAL(10,6), `tmc_total_liters` DECIMAL(12,2), `tmc_total_km` DECIMAL(12,2) (nullable; set khi close, giữ làm bằng chứng).
- **Báo cáo (R8):** bảng mới `car_truck_reports` — `trp...`→ tránh trùng prefix, dùng **`tr_`/`trr_`**: `trr_id` PK, `ent_id`, `trr_vehicle_type`, `trr_month` CHAR(7), `trr_type` ENUM(`PNL`,`TRIP_LOG`,`VEHICLE`), `trr_format` ENUM(`EXCEL`), `trr_s3_key`, `trr_name`, `trr_created_by`, `trr_created_at`, `trr_deleted_at`. (Badge "Mới" = so `trr_created_at` với mốc user xem lần cuối — lưu ở `localStorage` hoặc cột user, chốt ở PLAN.)

### 3.4 Trang / màn
| Route | Thay đổi |
|---|---|
| `truck/pnl/page.tsx` | Tách **2 tab** (R4): `?tab=overview` (mặc định) / `?tab=invoices`. Overview = bảng P&L + card biến-đổi/cố-định (R9) + banner tạm tính (R3). Invoices = chip tháng + FuelInvoicePanel + card tổng hợp cuối tháng (R5) + close/reopen + lịch sử điều chỉnh (R6) |
| `truck/finance/trips` (mới) **hoặc** `truck/pnl?tab=...` | **Bảng Chi phí & Lợi nhuận theo chuyến** (R2): cột STT｜Ngày｜Xe｜Tài xế｜KH｜Km｜Cầu đường｜Phát sinh｜Giá BQ｜Lít｜Phí xăng｜Doanh thu｜Lợi nhuận｜Trạng thái(Tạm tính/Đã chốt). Lọc xe + trạng thái |
| `truck/reports` (mới) | *Danh sách báo cáo* — group theo tháng, badge "Mới", nút Tải |
| `truck/reports/new` (mới) | *Lập báo cáo* — stepper chọn tháng → xác nhận → generate Excel → S3 |
| `nav-items.ts` | Thêm nhóm **Báo cáo** (Lập báo cáo + Danh sách, badge "Mới") cho truck staff |

### 3.5 UI (bám design)
- Bảng per-trip: dòng Tạm tính → cột Giá BQ/Lít/Phí xăng/Lợi nhuận hiển thị badge **"Tạm tính"** (amber); dòng Đã chốt → số thật + badge **"Đã chốt"** (xanh). (Theme accent cam `#C2410C` đã đúng, không đổi.)
- Card tổng hợp cuối tháng: Σ lít · Σ km · giá BQ · định mức · Σ tiền xăng + dòng giải thích công thức.
- Banner tạm tính (amber) + nút "Đi chốt tháng →".

---

## 4. Gap (갭 분석)

### 4.1 Phạm vi thay đổi
| Vùng | Hiện tại | Thay đổi | Ảnh hưởng |
|---|---|---|---|
| Core math | per-trip liters×price | + hàm tính phí xăng từ snapshot tháng | 🔴 Cao — đổi cách hiển thị LN mọi nơi |
| DB | month-close là cờ | +4 cột snapshot + bảng `car_truck_reports` | 🟠 Vừa — migration thủ công |
| P&L page | 1 trang | 2 tab + bảng per-trip + cards | 🟠 Vừa |
| Reports | không | module mới (UI + action + S3) | 🔴 Cao — diện rộng |
| Role | reopen ADMIN｜MANAGER | reopen ADMIN-only | 🟢 Thấp |
| i18n | — | keys mới 3 ngôn ngữ | 🟢 Thấp |

### 4.2 File thay đổi (sơ bộ — chi tiết ở PLAN)
- **Core:** `truck-cost.ts` (hàm phí xăng cuối tháng), `truck-pnl.service.ts` (dùng snapshot khi tháng chốt).
- **DB:** `truck-month-close.schema.ts` (+4 cột), `truck-report.schema.ts` (mới), migration `0016_*`.
- **Queries:** `truck-finance.queries.ts` (per-trip rows + snapshot), `truck-report.queries.ts` (mới).
- **Actions:** `truck-finance.actions.ts` (close → snapshot; reopen → ADMIN-only), `truck-report.actions.ts` (mới).
- **Pages/components:** `truck/pnl/*` (tab + cards + per-trip table), `truck/reports/*` (mới), `nav-items.ts`.
- **i18n:** `messages/{vi,en,ko}.json`.

### 4.3 DB migration
- Staging/prod `synchronize` OFF → **SQL thủ công** idempotent (`ADD COLUMN IF NOT EXISTS`, `CREATE TABLE IF NOT EXISTS`). Áp **chỉ DB staging-car-truck** (ep-noisy-heart) khi test, staging chung giữ nguyên (theo chỉ đạo trước).

---

## 5. Luồng người dùng (사용자 플로우)

### 5.1 Vòng đời tài chính tháng
```
Tháng MỞ
  ├─ Manager/Admin nhập chuyến (LOG) → cột phí xăng/LN = "Tạm tính"
  ├─ Nhập hoá đơn xăng dầu (tab Hoá đơn)
  └─ Cuối tháng: bấm "Chốt tháng"
        → xác nhận → hệ thống tính giá BQ + định mức (từ hoá đơn + Σkm)
        → snapshot vào month_close → mọi chuyến chuyển "Đã chốt" (số chính thức)
        → khoá kỳ (chặn sửa chuyến tháng đó)
Tháng ĐÃ CHỐT
  └─ (Chỉ ADMIN) "Mở lại tháng" → bắt buộc nhập lý do
        → soft-delete close row → ghi Lịch sử điều chỉnh → mở khoá → quay lại "Tạm tính"
```

### 5.2 Báo cáo
```
Lập báo cáo: chọn tháng (chip có nhãn Open/Đã xuất) → Bước 2 xác nhận (preview tổng hợp per-xe)
  → "Lập báo cáo" → generate Excel server-side → upload S3 → tạo car_truck_reports
  → điều hướng Danh sách (báo cáo mới có badge "Mới")
Danh sách: group theo tháng → nút "Tải" (presigned S3)
```

---

## 6. Ràng buộc kỹ thuật (기술 제약사항)
- **Tương thích:** chuyến/tháng đã chốt trước đây (chưa có snapshot) → fallback: nếu `tmc_avg_price` NULL thì dùng per-trip liters×price (giữ số cũ, không vỡ). Recompute snapshot khi reopen→close lại.
- **Hiệu năng:** dataset nhỏ (vài xe, ~vài chục chuyến/tháng) → tính JS khi đọc OK.
- **Bảo mật:** mọi query kèm `ent_id`; report S3 dùng presigned URL; reopen ADMIN-only + audit log bắt buộc lý do; multi-tenancy giữ nguyên.
- **i18n:** không hard-code; 3 ngôn ngữ vi/en/ko.
- **Quy ước:** không set `trp_status` trực tiếp; migration thủ công; không commit `.env`.

---

## 7. Quyết định cần chốt trước khi sang PLAN
- **Q-A:** Nhãn trước chốt = **"Tạm tính"** (khuyến nghị) hay **"Pending"** ẩn số (design)?
- **Q-B:** Bảng per-trip đặt ở **tab thứ 3 trong `/truck/pnl`** hay **route riêng `/truck/finance/trips`**? (Khuyến nghị: tab — gom finance 1 chỗ.)
- **Q-C:** Badge "Mới" báo cáo lưu mốc-xem ở **localStorage** (đơn giản) hay **cột user/DB** (đa thiết bị)? (Khuyến nghị: localStorage cho MVP.)
- **Q-D:** Loại báo cáo MVP = cả 3 (PNL / TRIP_LOG / VEHICLE) hay chỉ **PNL** trước? (Khuyến nghị: PNL trước, 2 loại sau.)
