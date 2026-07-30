# REQ-20260724 — Phí nhiên liệu theo định mức + giá của XE (tính live theo km, không cần hoá đơn)

> ## ⛔ ĐÃ BỊ THAY THẾ (2026-07-30)
>
> KH chốt lại: **phí nhiên liệu KHÔNG tính theo định mức**, mà phân bổ theo
> `km chuyến × (chi phí nhiên liệu tháng của xe ÷ tổng km tháng của xe)`.
> Mô hình `km × định mức × giá xe` trong tài liệu này đã bị xoá khỏi code
> (kể cả field Lít/Đơn giá trên chuyến đã được trả lại).
> Xem [BUG-260730](../bug-fix/BUG-260730-truck-fuel-allocation-by-monthly-cost.md).
> Tài liệu giữ lại để tra lịch sử quyết định.

> Yêu cầu KH (dev@amoeba): *"vì sao lại phải nhập hoá đơn xăng để tính lại, tôi cần thay đổi đúng các trường đã cung cấp sẽ tính lại luôn"* → chọn model **KM × định mức × giá theo xe**, và **bổ sung làm mặc định** (giữ bình quân theo hoá đơn đè lên khi có lập báo cáo).

## 1. Tóm tắt yêu cầu

| # | Yêu cầu | Loại |
|---|---------|------|
| R1 | Phí nhiên liệu mỗi chuyến tính **mặc định** = `km × định mức(L/km) × giá xăng`, **theo từng xe**, **không cần hoá đơn** | Logic |
| R2 | Sửa **km** (hoặc số liệu xe) → phí **tính lại ngay** (live, như mọi trường khác) | Logic/UX |
| R3 | **Giữ** model bình quân theo hoá đơn (khách đã duyệt): khi khu vực có hoá đơn + đã lập báo cáo → số chuyển sang bình quân (đè lên định mức xe) | Logic |
| R4 | Nhập **giá xăng theo xe** (field mới) + tận dụng **định mức** sẵn có trên xe | DB/UI |
| R5 | Badge/tooltip phân biệt 3 trạng thái: theo định mức xe / bình quân / chưa đặt định mức | UX |

## 2. AS-IS (hiện trạng — đã verify bằng exploration)

### 2.1 Công thức hiện tại (2 nhánh, KHÔNG dùng định mức xe)
Choke point lặp ở ~5 nơi, ví dụ [truck-pnl.service.ts:184-192](apps/web/../packages/core/src/truck/truck-pnl.service.ts):
```
snap = snapshots.forTrip(month, vehicleId)          // snapshot bình quân của (tháng, khu vực)
if (snap) fuelCost = round(km × snap.consumption × snap.avgPrice)   // "Bình quân"
else      fuelCost = round(trpFuelLiters × trpFuelPrice)            // "Tự nhập" (km KHÔNG dùng)
```
→ Nhánh `else` (khi chưa có hoá đơn/báo cáo) dùng **Lít × Đơn giá nhập tay của chuyến** — **km không nằm trong công thức** ⇒ đúng nguyên nhân "thêm km không tính lại".

### 2.2 Field liên quan
- **Xe** [vehicles.schema.ts:63,68](packages/db/src/schema/vehicles.schema.ts):
  - `cvh_fuel_quota` decimal(6,2) — **"Định mức tiêu hao (L/100km)"**, hiện **chỉ hiển thị/nhập, CHƯA dùng để tính chi phí**.
  - `cvh_region` varchar(40) — khu vực (dùng cho snapshot bình quân).
  - **KHÔNG có** field giá xăng theo xe.
- **Chuyến** [trips.schema.ts:74,75,83,84](packages/db/src/schema/trips.schema.ts): `trp_start_odometer`, `trp_end_odometer` (→ km = end−start), `trp_fuel_liters`, `trp_fuel_price`.

### 2.3 Model hoá đơn→snapshot (giữ nguyên ở TO-BE)
`getTruckFuelStats` ([truck-finance.queries.ts:143](apps/web/src/server/queries/truck-finance.queries.ts)) → `avgPrice` (mean giá hoá đơn) + `consumption` (Σ lít hoá đơn ÷ Σ km). `generateOneTruckReport` ([truck-report.actions.ts:193-270](apps/web/src/server/actions/truck-report.actions.ts)) freeze vào `car_truck_reports.trr_avg_price/trr_consumption` khi F5 (`totalKm>0 && invoiceLiters>0 && avgPrice>0`). `loadTruckRegionSnapshots` đọc lại.

## 3. TO-BE

### 3.1 Công thức mới (nhánh mặc định thay `else`)
```
snap = snapshots.forTrip(month, vehicleId)
if (snap)                       fuelCost = round(km × snap.consumption × snap.avgPrice)   // "Bình quân" (giữ nguyên, R3)
else if (quota>0 && price>0)    fuelCost = round(km × (cvh_fuel_quota/100) × cvh_fuel_price)  // "Theo định mức" (MỚI, mặc định, R1/R2)
else                            fuelCost = 0   // "Chưa đặt định mức" → badge cảnh báo (R5)
```
- `cvh_fuel_quota` giữ đơn vị **L/100km** → chia 100 thành L/km.
- **Bỏ** nhánh `Lít × Đơn giá tự nhập` khỏi tính chi phí mặc định (theo lựa chọn "bổ sung làm mặc định").

### 3.2 AS-IS → TO-BE

| Khía cạnh | AS-IS | TO-BE |
|---|---|---|
| Phí mặc định (chưa có hoá đơn) | Lít × Đơn giá (nhập tay/chuyến), km bỏ qua | **km × (định mức/100) × giá xe** — live theo km |
| Giá xăng | theo chuyến (`trp_fuel_price`) | **theo xe** (`cvh_fuel_price` — field mới) |
| Định mức | `cvh_fuel_quota` (chưa dùng) | **dùng để tính** (L/100km) |
| Bình quân theo hoá đơn | có | **giữ nguyên**, đè lên khi có báo cáo+hoá đơn |
| Badge | Bình quân / Tự nhập | **Bình quân / Theo định mức / Chưa đặt định mức** |

### 3.3 Field mới / thay đổi
- **DB (mới):** `car_vehicles.cvh_fuel_price` decimal(14,2) NULL — "Giá xăng (đ/L)" theo xe.
- **Tận dụng:** `cvh_fuel_quota` (không đổi schema).

### 3.4 Số phận trường "Lít"/"Đơn giá" trên chuyến (⚠ cần bạn xác nhận khi duyệt)
Đề xuất: **Ngừng dùng để tính chi phí mặc định**. Trên form chuyến:
- **Lít** → hiển thị **suy ra** = km × định mức/100 (read-only, tham khảo), không còn là input chi phí.
- **Đơn giá** → hiển thị **giá của xe** (read-only). 
- Cột DB `trp_fuel_liters/trp_fuel_price` **giữ lại** (lịch sử, không xoá) nhưng không tham gia công thức mặc định.
- *(Phương án thay thế nếu bạn muốn linh hoạt: giữ `trp_fuel_price` làm "giá override theo chuyến" khi cần — sẽ hỏi lại khi duyệt.)*

### 3.5 UI/UX
- **Màn Phương tiện** (form + list): thêm ô nhập **"Giá xăng (đ/L)"**; định mức đổi nhãn rõ đơn vị.
- **Badge nhiên liệu** (dùng lại `FuelReconciliationBadge`, thêm state): 🟢 "Bình quân" / 🔵 "Theo định mức" / 🟡 "Chưa đặt định mức xe" (kèm tooltip hướng dẫn: vào Phương tiện đặt định mức + giá).
- **Toast lưu chuyến**: cập nhật mô tả theo 3 trạng thái.

## 4. Gap analysis — phạm vi thay đổi

| Vùng | File | Loại |
|---|---|---|
| DB | `packages/db/src/schema/vehicles.schema.ts` (+`cvhFuelPrice`) + migration SQL | Sửa |
| Core | `packages/core/src/truck/truck-cost.ts` (helper `truckTripFuelCostByVehicleRate`) | Sửa |
| Core | `truck-fuel-snapshot.ts` — nạp thêm `quota`+`price` theo vehicleId (đã có `vehicleRegion`) | Sửa |
| Core | `truck-pnl.service.ts:184-192` — nhánh mới | Sửa |
| Query | `truck-finance.queries.ts:336-342, 497-512` | Sửa |
| Query | `truck-trips.queries.ts:60-83, 264-268` | Sửa |
| Export | `truck-report-export.queries.ts:235-240, 323-324` | Sửa |
| Action | `trips/truck-trip.actions.ts` — `tripFuelReconciled`→ trạng thái 3 nhánh cho toast | Sửa |
| UI | `truck/fleet/_components/truck-vehicle-form.tsx` + `fleet/page.tsx` + `vehicles/vehicle.actions.ts` — field giá | Sửa |
| UI | `truck/trips/_components/truck-trip-form.tsx` + `trips/[id]/_components/truck-complete-section.tsx` — Lít/Đơn giá | Sửa |
| UI | `components/truck/fuel-reconciliation-badge.tsx` + i18n (vi/en/ko) | Sửa |

### 4.1 DB migration
- Thêm cột: `ALTER TABLE car_vehicles ADD COLUMN cvh_fuel_price numeric(14,2) NULL;`
- Áp dụng: **local** (Neon ep-steep-tooth) + **staging-car-truck** (Neon ep-noisy-heart). KHÔNG đụng ep-gentle-rain.
- Theo tình trạng migration journal của car-v2 (lệch, áp thủ công) — dùng SQL thủ công + baseline như các lần trước.

## 5. User flow (TO-BE)
```
Admin: Phương tiện → sửa xe X → nhập Định mức = 30 (L/100km), Giá = 25.000 đ/L → Lưu
  ↓
Chuyến của xe X (COMPLETED, km=100, khu vực chưa có hoá đơn):
   phí nhiên liệu = 100 × (30/100) × 25.000 = 750.000 đ   → badge "Theo định mức"
  ↓
Sửa chuyến: km 100 → 150 → Lưu → phí = 150×0.3×25.000 = 1.125.000 đ  (tính lại NGAY)  ✅ R2
  ↓
(Tuỳ chọn) Nhập hoá đơn xăng khu vực + Lập báo cáo → phí chuyển sang bình quân (đè)  → badge "Bình quân"  ✅ R3
  ↓
Nếu xe CHƯA có định mức/giá → phí = 0 → badge "Chưa đặt định mức xe" (nhắc vào Phương tiện đặt)
```

## 6. Ràng buộc kỹ thuật
- Giá theo xe là **tĩnh** → khi giá xăng thị trường đổi, phải cập nhật lại trên từng xe (chấp nhận theo yêu cầu; bình quân theo hoá đơn vẫn là cách chính xác hơn khi cần).
- Không đổi cột tiền hiện có; chỉ thêm `cvh_fuel_price`.
- Báo cáo cũ đã freeze snapshot (bình quân) **không bị ảnh hưởng** (chỉ đổi nhánh mặc định khi CHƯA có snapshot).
- Multi-tenancy: `cvh_fuel_price` nằm trong `car_vehicles` đã có `ent_id`.

## 7. Quyết định đã chốt (2026-07-24)
1. **§3.4** — Trường "Lít/Đơn giá" trên chuyến: **ẩn/chỉ-đọc, suy ra từ xe** (Lít = km×định mức/100; Đơn giá = giá xe). Cột DB `trp_fuel_liters/trp_fuel_price` giữ lại nhưng không tham gia công thức mặc định.
2. **§3.1** — Xe chưa đặt định mức/giá → **phí = 0 + badge "Chưa đặt định mức xe"** (KHÔNG fallback về Lít×Đơn giá cũ).
3. Đơn vị định mức: **L/100km**, tận dụng `cvh_fuel_quota` sẵn có.
