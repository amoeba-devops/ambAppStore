# BUG-260730 — Chuyến mới tự thành "Đã lập BC"; phí nhiên liệu mất field nhập và tính sai theo định mức

| | |
|---|---|
| **Ngày** | 2026-07-30 |
| **Phạm vi** | Phí nhiên liệu chuyến xe tải — core (công thức) + form chuyến + P&L + báo cáo |
| **Mức độ** | Cao (số tiền) — phí nhiên liệu mọi chuyến chưa lập báo cáo đều là số ước tính sai |
| **Branch** | `staging-car-truck` |
| **Trạng thái** | ✅ Đã sửa |

> **Quy tắc KH chốt lại (2026-07-30)**: *"Phí nhiên liệu phân bổ theo chuyến KHÔNG tính theo định mức, mà tính dựa theo số KM và chi phí nhiên liệu của xe trong 1 tháng."*
> ⇒ Đây là **đảo ngược REQ-20260724** (mô hình `km × định mức × giá xe`).

---

## 1. Hiện tượng

1. **Chỉ mới lập chuyến đi**, vào Chi phí & Lợi nhuận thì chuyến đã mang trạng thái **"Đã lập BC"** (và chi tiết chuyến ghi "Đã lập BC · 02:19 28/07/2026") — trong khi chuyến vừa tạo chưa từng nằm trong báo cáo nào.
2. **Tạo chuyến**: mất 2 field nhập **Nhiên liệu (lít)** và **Đơn giá (đ/L)** — không còn chỗ ghi chi phí nhiên liệu thực của chuyến.
3. **Sau khi tạo chuyến**: phí nhiên liệu **tự tính ra số** dù chưa lập báo cáo, và **số đó sai** (đang tính theo định mức).

## 2. Nguyên nhân (root cause)

### 2.1 Case 1 — trạng thái "Đã lập BC" theo THÁNG, không theo chuyến

`isReported(month, vehicleId)` chỉ hỏi *"tháng/khu vực này có báo cáo nào chưa?"*:

```ts
// truck-fuel-snapshot.ts — TRƯỚC
isReported(month, vehicleId) {
  return reported.has(`${month}|${region}`) || reported.has(`${month}|`);
}
```

Tháng 7 đã có báo cáo lập ngày 28/07 → **mọi** chuyến thuộc tháng 7, kể cả chuyến tạo ngày 29/07, đều bị coi là "đã lập BC". Cùng lỗi ở `getTruckReportStatus` (badge trên trang chi tiết) — nó tính theo phạm vi (tháng, khu vực), không theo bản ghi.

Hệ quả kép: chuyến mới không chỉ hiện sai trạng thái mà còn **lấy luôn số nhiên liệu đã đóng băng** của báo cáo cũ (`costPerKm` đóng băng trên số km cũ) — số nó không hề tham gia.

### 2.2 Case 2 & 3 — công thức nhiên liệu theo định mức

REQ-20260724 đặt nhánh **mặc định** của phí nhiên liệu là định mức của xe:

```ts
// truck-fuel-snapshot.ts fuelForTrip() — TRƯỚC
frozen vehicleSnap (báo cáo, money÷km)      // 1
→ frozen region snap (bình quân khu vực)     // 2
→ km × (cvh_fuel_quota/100) × cvh_fuel_price // 3  ← "VEHICLE_RATE", nguồn của lỗi
→ 0                                          // 4
```

Hai hệ quả trực tiếp:

- **Số trước khi lập báo cáo ≠ số sau khi lập báo cáo.** Nhánh 3 là *ước tính lý thuyết* (định mức × giá cấu hình), còn nhánh 1 là *tiền thật* (chi phí nhiên liệu tháng của xe ÷ km tháng). Cùng một chuyến, hai con số khác nhau → đúng như KH nói "tự động tính … đang sai".
- **Field Lít/Đơn giá bị bỏ khỏi form** (quyết định §7 của REQ-20260724) vì không còn tham gia công thức → không còn đường nhập chi phí nhiên liệu thực, trong khi cột `trp_fuel_liters` / `trp_fuel_price` vẫn tồn tại và vẫn được API nhận.

Nói cách khác: mô hình đúng (per-vehicle money ÷ km, REQ-20260726) **đã có sẵn** nhưng chỉ chạy khi đã lập báo cáo; trước đó hệ thống dùng một công thức khác.

## 3. Phương án sửa

### 3.0 Case 1 — "đã lập BC" phải là câu trả lời CHO TỪNG CHUYẾN

Báo cáo là ảnh chụp tại một thời điểm ⇒ một chuyến chỉ nằm trong báo cáo nếu **báo cáo được lập SAU lần sửa cuối của chuyến**:

```ts
coveredByReport(month, vehicleId, changedAt) = reportedAt(scope) >= changedAt
```

- `reportedAt` (mới): Map `${month}|${region}` → thời điểm báo cáo/chốt sổ mới nhất.
- `isReported(month, vehicleId, changedAt?)` và `fuelForTrip(..., changedAt?)` đều đi qua `coveredByReport`: chuyến chưa được phủ thì **bỏ qua cả 2 tầng đóng băng**, rơi xuống pool live → hiện "Tạm tính" đúng bản chất.
- `getTruckReportStatus(..., changedAt?)` trả thêm `covered`; badge có state thứ 3: **"Chưa có trong BC"** (neutral) — thay vì khoe ngày lập báo cáo của một báo cáo không chứa chuyến này.
- `changedAt` = `trp_updated_at ?? trp_created_at`. Sửa chuyến sau khi lập báo cáo cũng làm nó rời khỏi phạm vi báo cáo — khớp với banner "dữ liệu đã thay đổi, cần lập lại" đã có.
- Chỗ **cố tình không truyền** `changedAt`: bộ dựng file Excel (`truck-report-export.queries.ts`) — chính nó LÀ báo cáo vừa được insert, nên mọi chuyến trong phạm vi đều được phủ.

### 3.1 Case 2 & 3 — một công thức duy nhất, chạy cả trước và sau khi lập báo cáo

```
phí nhiên liệu chuyến = km chuyến × (chi phí nhiên liệu tháng của xe ÷ tổng km tháng của xe)
```

`chi phí nhiên liệu tháng của xe` = hoá đơn xăng gắn xe đó trong tháng, **hoặc** (nếu chưa có hoá đơn) nhiên liệu ghi nhận trên các chuyến của xe (`lít × đơn giá`) — một kênh, xem §3.2.

Precedence mới:

```ts
frozen vehicleSnap (đã lập BC)        // 1  AVERAGED — số đã chốt
→ frozen region snap (BC cũ, legacy)  // 2  AVERAGED — giữ nguyên số lịch sử
→ LIVE pool (tính ngay bây giờ)       // 3  LIVE     — cùng công thức, chưa chốt
→ 0                                    // 4  UNSET   — tháng chưa có chi phí NL
```

- Nhánh định mức **bị xoá khỏi mọi đường tính tiền** (`truckTripFuelCostByVehicleRate`, `hasVehicleFuelRate` xoá). Cột `cvh_fuel_quota` / `cvh_fuel_price` **giữ lại** như thông tin tham khảo của xe.
- Xe chưa có chi phí nhiên liệu nào trong tháng → phí = 0 + badge "Chưa tính được" (không ước tính).
- **Live == freeze**: `getTruckFuelStatsByVehicle` (hàm mà "Lập báo cáo" dùng để đóng băng) giờ chỉ là wrapper mỏng của `loadVehicleFuelPool` — cùng một đoạn code sinh ra số tạm tính và số chốt, nên hai bên chỉ có thể lệch bởi nhiên liệu nhập **sau** khi lập báo cáo.

### 3.2 Một nguồn tiền cho mỗi (xe, tháng) — không cộng dồn 2 kênh

Chi phí nhiên liệu tháng có thể vào từ 2 đường: **hoá đơn xăng tháng** (gắn xe, tab Tổng quan P&L) và **nhiên liệu nhập trên chuyến**. Cộng cả hai sẽ **đếm 2 lần** cùng một lần đổ dầu (phát hiện khi verify: 4,37 tr hoá đơn + đúng số dầu đó ghi trên các chuyến → pool đọc thành 6,18 tr). Quy tắc chốt:

> Có hoá đơn gắn xe trong tháng → dùng hoá đơn (`source: 'INVOICE'`). Không có → dùng nhiên liệu ghi trên các chuyến của xe (`source: 'TRIP'`). Không có cả hai → 0 (`'NONE'`).

Nhờ vậy tenant ghi theo cách nào cũng ra đúng số thực chi; km luôn lấy từ chuyến COMPLETED bất kể kênh nào.

### 3.3 Tính chất phân bổ (vì sao pool theo tháng, không phải theo chuyến)

Một lần đổ dầu phục vụ nhiều chuyến. Nếu tính "chi phí của chuyến nào thì chuyến đó gánh", chuyến đi đổ dầu bị đội chi phí còn chuyến sau lãi ảo. Pool theo (xe, tháng) rồi chia theo km giữ **Σ phí phân bổ = Σ tiền thật đã chi**, và mỗi chuyến gánh theo đúng phần đường nó chạy.

## 4. Nội dung sửa

| # | File | Thay đổi |
|---|---|---|
| 1 | `packages/core/src/truck/truck-fuel-pool.ts` | **Mới** — `loadVehicleFuelPool(entId, months, region?)`: pool (money/liters/km/costPerKm/avgPrice/source) theo (tháng, xe); hoá đơn ưu tiên, nhiên liệu chuyến dự bị |
| 2 | `packages/core/src/truck/truck-fuel-snapshot.ts` | Precedence mới + `reportedAt`/`coveredByReport` (case 1); `TruckFuelMode`: `VEHICLE_RATE` → **`LIVE`**; bỏ map `vehicleRate`, thêm `livePool` |
| 3 | `packages/core/src/truck/truck-cost.ts` | Xoá `truckTripFuelCostByVehicleRate` + `hasVehicleFuelRate` (kèm ghi chú vì sao) |
| 4 | `packages/core/src/truck/truck-pnl.service.ts` | `fuelVehicleRateTripCount` → `fuelLiveTripCount` |
| 5 | `packages/core/src/truck/truck-trip.service.ts` | `completeTruckTrip` nhận + lưu `fuelPrice` (trước chỉ có lít) |
| 6 | `packages/shared/src/zod/truck-trip.zod.ts` | `completeTruckTripSchema` + `fuel_price` |
| 7 | `apps/web/src/server/queries/truck-finance.queries.ts` | `getTruckFuelStatsByVehicle` → wrapper của pool; `allocatable` = có pool (thay vì hỏi hoá đơn khu vực); preview wizard bỏ fallback định mức |
| 8 | `apps/web/src/server/actions/trips/truck-trip.actions.ts` | truyền `fuel_price` xuống `completeTruckTrip` |
| 9 | `apps/web/.../truck/trips/_components/truck-trip-form.tsx` | **Trả lại 2 field** Lít + Đơn giá; preview lợi nhuận dùng lít × đơn giá; panel định mức → ghi chú cách phân bổ |
| 10 | `apps/web/.../trips/[id]/_components/truck-complete-section.tsx` | Thêm 2 field Lít + Đơn giá cho sheet hoàn thành chuyến của tài xế |
| 11 | `fuel-reconciliation-badge.tsx`, `fuel-toast.ts`, `truck/finance/page.tsx`, `truck/pnl/page.tsx` | Theo mode mới (`LIVE`), badge "Tạm tính" thay "Ước tính theo định mức" |
| 12 | `apps/web/src/server/queries/truck-report.queries.ts` | `getTruckReportStatus(..., changedAt?)` → thêm `covered` (case 1) |
| 13 | `apps/web/src/components/truck/report-status-badge.tsx` + 2 trang chi tiết chuyến | State thứ 3 **"Chưa có trong BC"**; 2 trang truyền `trp_updated_at` |
| 14 | `apps/web/src/server/queries/truck-trips.queries.ts` | `getTruckTripBreakdown` nhận `trpUpdatedAt/trpCreatedAt`; list + breakdown truyền `changedAt` vào `isReported`/`fuelForTrip` |
| 15 | `packages/shared/src/zod/truck-trip.zod.ts`, `truck-trip.actions.ts`, `truck-trip.service.ts`, form + trang sửa chuyến | **Bù field còn thiếu của form tạo chuyến** (§4.1) |
| 16 | `messages/{vi,en,ko}.json` | Viết lại toàn bộ copy nhiên liệu (badge/tooltip/toast/hint/wizard/footer export); thêm `form.fuelAllocNote`, `truckReportStatus.notCovered`; bỏ `fuelSelectVehicleFirst`, `fuelRateNotSet` |

### 4.1 Field còn thiếu trên form tạo chuyến (rà soát 2026-07-30)

Đối chiếu form ↔ DTO ↔ cột DB ↔ cột báo cáo, thiếu 2 thứ mà **báo cáo tháng và file xuất đã in ra**:

| Field | Cột DB | Nơi tiêu thụ | Trước đây |
|---|---|---|---|
| Giờ bắt đầu / Giờ kết thúc | `trp_started_at`, `trp_ended_at` | Sheet nhật ký chuyến (`Giờ BĐ / Start`, `Giờ KT / End`) + file xuất Excel tab Chuyến | Chỉ có ở sheet "Hoàn thành chuyến" của tài xế. Quản lý ghi nhận hoàn thành 1 bước → giờ BĐ **trống**, giờ KT = **lúc bấm Lưu** |
| Ghi chú chuyến | `trp_notes` | Cột "Ghi chú" của file xuất | DTO có `notes`, core lưu `trp_notes`, nhưng **không form nào có field** → luôn rỗng; `updateTruckTrip` cũng không ghi cột này |

Đã bổ sung: 2 input `time` (chỉ ở chế độ "Ghi nhận hoàn thành" — chuyến do tài xế tự hoàn thành vẫn nhập giờ ở sheet của họ) + 1 input Ghi chú trong khối "Khách hàng & chứng từ"; `start_time`/`end_time` vào `createTruckTripSchema`; `UpdateTruckTripInput` nhận `notes`/`startedAt`/`finishedAt` theo kiểu **chỉ ghi khi có gửi** (undefined → Drizzle bỏ qua cột) nên sửa chuyến không xoá giờ tài xế đã nhập; trang sửa chuyến hydrate `HH:mm` + ghi chú.

**Không đổi DB** — dùng lại `trp_fuel_liters` / `trp_fuel_price` / `trp_notes` / `trp_started_at` / `trp_ended_at` và `car_truck_fuel_invoices` sẵn có. Không migration.

## 5. Kiểm chứng (dev, dữ liệu thật + 1 case dựng riêng rồi xoá)

| # | Trường hợp | Kỳ vọng | Kết quả |
|---|---|---|---|
| 1 | **Phân bổ theo km** — 1 xe, tháng 2026-08, chuyến A (100 km, đổ 100 L × 20.000 = 2.000.000 đ) + chuyến B (100 km, không đổ) | mỗi chuyến 100 km × 10.000 đ/km = **1.000.000 đ**, Σ = 2.000.000 = tiền thật | ✅ cả 2 chuyến hiện `100 km × 10.000 ₫/km = 1.000.000 ₫` |
| 2 | Preview wizard "Lập báo cáo" cùng tháng | trùng khít số live | ✅ 2 dòng 1.000.000 ₫; card xe: tổng NL 2.000.000 ₫, BQ 20.000 đ/L, 0.500 L/km |
| 3 | Tháng đã lập BC (2026-07, xe 51C-458.32) | giữ số đã chốt, badge "Theo hoá đơn" | ✅ 13.667 đ/km × (120+100+100) km = 4.373.280 đ = KPI "đã chốt" |
| 4 | Chuyến chưa lập BC (43C-201.55) | tạm tính từ NL đã ghi: 92 L × 21.500 = 1.978.000 ⇒ 200 km × 9.890 | ✅ badge "Tạm tính" |
| 5 | Chuyến 0 km (TRK-9002) | phí 0 (tiền của nó chia cho các chuyến có km của cùng xe) | ✅ |
| 6 | Form tạo chuyến | có lại "Nhiên liệu (lít)" + "Đơn giá (đ/L)" + ghi chú phân bổ, không còn chữ "định mức" | ✅ |
| 7 | **Case 1** — chuyến TST-LATE tạo *hôm nay* cho tháng 7 (tháng đã có BC lập 07/07) | trạng thái **"Tạm tính"**, không phải "Đã lập BC" | ✅ (trước sửa: "Đã lập BC") |
| 8 | Chi tiết chuyến TST-LATE | badge **"Chưa có trong BC"** + Nhiên liệu 835.473 ₫ "Tạm tính" (50 km × 16.709 ₫/km, pool live) | ✅ |
| 9 | Các chuyến CÓ trong BC (TRK-1001/1002/1003, sửa lần cuối trước 10:57 07/07) | giữ "Đã lập BC" + số đóng băng 13.667 ₫/km | ✅ |
| 10 | Form tạo chuyến (chế độ Ghi nhận hoàn thành) | có Giờ bắt đầu / Giờ kết thúc (2 input `time`) + Ghi chú chuyến | ✅ |
| 11 | Trang sửa chuyến đã hoàn thành | hydrate Lít (45.00), Đơn giá, Giờ BĐ/KT, Ghi chú | ✅ |
| 12 | File xuất tab Chuyến (seed giờ 01:15–09:40 + ghi chú vào 1 chuyến rồi xoá) | in đúng `Giờ BĐ / Start = 01:15`, `Giờ KT / End = 09:40`, cột Ghi chú có nội dung | ✅ |
| 13 | `tsc --noEmit` (web + core + shared), `next lint` | pass, 0 warning | ✅ |

## 6. Ảnh hưởng / lưu ý khi lên staging

- **Số của các tháng CHƯA lập báo cáo sẽ đổi** (từ ước tính định mức → phân bổ theo chi phí thực). Đây chính là mục đích sửa.
- **Báo cáo đã lập không đổi số** — snapshot đã đóng băng vẫn ưu tiên (nhánh 1 & 2).
- Tháng nào xe chưa có hoá đơn xăng lẫn nhiên liệu chuyến → phí = 0 (trước đây ra một số ước tính). Muốn có số: nhập nhiên liệu ở chuyến hoặc thêm hoá đơn xăng cho xe.
- `cvh_fuel_quota` / `cvh_fuel_price` trên form Phương tiện vẫn giữ (thông tin xe), không còn ảnh hưởng tiền.
- **Chuyến tạo/sửa sau khi đã lập báo cáo** giờ hiện "Tạm tính" / "Chưa có trong BC" và dùng số live — muốn chốt lại thì **lập lại báo cáo** cho tháng đó (đúng như banner "dữ liệu đã thay đổi, cần lập lại" vẫn nhắc).
- Nếu tenant ghi nhiên liệu **cả** ở hoá đơn tháng lẫn trên chuyến cho cùng một xe/tháng, hệ thống **chỉ lấy hoá đơn** (§3.2). Nếu quy trình thật cần cộng cả hai thì cho em biết để đổi.

## 7. Phòng ngừa tái diễn

- **Một quy tắc, một hàm**: mọi màn hình lấy phí nhiên liệu qua `fuelForTrip`, và cả live lẫn freeze đều gọi `loadVehicleFuelPool`. Không được thêm nhánh tính tiền thứ hai — đó chính là cách lỗi này phát sinh (ước tính live ≠ số chốt).
- Field nào **không tham gia công thức** thì đừng ẩn nó rồi vẫn nhận qua API: `trp_fuel_liters/price` bị ẩn khỏi form nhưng DTO vẫn nhận, nên dữ liệu vào hệ thống theo đường không ai thấy.
- **Trạng thái/đóng băng phải trả lời cho từng bản ghi, không cho cả tháng.** "Tháng này có báo cáo" ≠ "chuyến này đã được báo cáo": mọi chỗ hỏi câu đó phải kèm mốc thay đổi của bản ghi (`coveredByReport`).
