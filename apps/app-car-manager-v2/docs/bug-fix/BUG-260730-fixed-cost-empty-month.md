# BUG-260730 — Chi phí cố định: tháng trắng vẫn gánh, và không có lịch sử theo tháng

| | |
|---|---|
| **Ngày** | 2026-07-30 |
| **Phạm vi** | Chi phí cố định — core resolver + `computeTruckPnl` + phân bổ theo chuyến (dashboard · Chi phí & LN · P&L · báo cáo) |
| **Mức độ** | Trung bình (số tiền hiển thị) — mọi tháng chưa có chuyến đều báo lỗ |
| **Branch** | `staging-car-truck` |
| **Trạng thái** | ✅ Đã sửa |

> **Yêu cầu KH (2026-07-30)**:
> 1. *"tháng không có chuyến thì không phân bổ chi phí cố định"* → §3
> 2. *"làm luôn lịch sử theo tháng"* (khấu hao / lương) → §7

---

## 1. Hiện tượng

Sau khi reset dữ liệu chuyến trên staging, Bảng điều khiển xe tải hiện:

```
Doanh thu 0 ₫ · Số chuyến 0 · Tổng chi phí 14.500.000 ₫ · Lợi nhuận ròng −14.500.000 ₫
  Lương tài xế 13.000.000 ₫ · Khấu hao 1.500.000 ₫   (cố định 100% "theo tháng")
```

Số **đúng theo dữ liệu** (đã tính lại từ DB thô: Baiksan 8.5tr + Đồng Nai 6tr, HCM 0 vì không còn xe live) nhưng
**sai theo nghiệp vụ**: chưa chạy chuyến nào mà đã báo lỗ 14,5tr. Và vì fallback không giới hạn theo thời gian,
**mọi tháng** — kể cả tháng 12/2026 — đều ra đúng con số đó.

## 2. Nguyên nhân

`computeTruckPnl` cộng chi phí cố định của tháng từ 2 nguồn, không xét tháng đó có chuyến hay không:

1. `car_truck_fixed_costs` (nhập tay theo xe/tháng), và
2. **fallback theo xe** khi không có bản ghi tay: `cvh_depreciation` + lương cố định của tài xế mặc định
   (quy tắc "1 xe ↔ 1 tài xế", mở rộng cho cả fleet aggregate 2026-07-21).

Fallback (2) chạy cho **mọi tháng trong khoảng truy vấn**, nên tháng trắng vẫn nhận đủ chi phí cố định. Đây cũng
là lý do tháng tương lai hiện lỗ: fallback đọc thuộc tính hiện tại của xe, không có mốc thời gian.

## 3. Phương án sửa

Sau khi đã cộng **cả hai** nguồn, nếu phạm vi truy vấn (tháng × khu vực × xe) **không có chuyến COMPLETED nào**
thì chi phí cố định = 0:

```ts
if (row.tripCount === 0 && !q.fixedCostWithoutTrips) {
  row.salary = 0; row.driverSalary = 0; row.depreciation = 0; row.insurance = 0;
}
```

- Đặt ở vòng tổng hợp cuối của `computeTruckPnl` → **một chỗ duy nhất**, mọi màn dùng chung: Bảng điều khiển,
  Chi phí & Lợi nhuận, P&L, `/truck/pnl/export`, các sheet trong báo cáo tháng, và preview wizard.
- **Tháng CÓ chuyến: không đổi gì** — xe nằm bãi trong tháng đó vẫn gánh chi phí cố định như trước. Chỉ tháng
  trắng mới về 0. (Nếu KH muốn mạnh hơn — xe nào không chạy thì xe đó không gánh, ngay trong tháng có chuyến —
  thì đổi điều kiện sang cấp *xe*; hiện cố tình KHÔNG làm vậy để không thay số của các tháng đã có dữ liệu.)

### 3.1 Ngoại lệ có chủ đích: sheet "xe nằm bãi" của báo cáo

`truck-report-export.queries.ts` gọi `computeTruckPnl` **theo từng xe** để dựng sheet phương tiện, trong đó có
chế độ `includeIdle` — liệt kê cả xe không chạy chuyến nào, gắn nhãn `IDLE`, **cốt để cho thấy xe nằm bãi tốn bao
nhiêu**. Nếu áp rule mới ở đây thì dòng IDLE về 0 và sheet mất ý nghĩa. Vì vậy có cờ opt-in
`fixedCostWithoutTrips: true`, và chỉ bật khi **tháng đó có chuyến** (`rows.length > 0`) — tháng trắng thì mọi
dòng về 0 để khớp với tổng của phạm vi.

## 4. Nội dung sửa

| # | File | Thay đổi |
|---|---|---|
| 1 | `packages/core/src/truck/truck-pnl.service.ts` | `TruckPnlQuery` + `fixedCostWithoutTrips?` (default false); vòng tổng hợp cuối zero chi phí cố định khi `tripCount === 0` |
| 2 | `apps/web/src/server/queries/truck-report-export.queries.ts` | Sheet phương tiện truyền `fixedCostWithoutTrips: rows.length > 0` để giữ dòng IDLE |

Không đổi DB, không đổi i18n.

## 5. Kiểm chứng (local, seed 1 chuyến + set chi phí cố định tạm rồi revert)

| Trường hợp | Kỳ vọng | Kết quả |
|---|---|---|
| T8/2026 — **không** có chuyến | doanh thu 0 · nhiên liệu 0 · **CP cố định 0** · lợi nhuận **0** | ✅ (trước sửa: −6.000.000) |
| T7/2026 — **có** 1 chuyến (100 km, 30 L × 20.000, DT 5.000.000), xe có khấu hao 1tr + lương TX 5tr | CP cố định **6.000.000**, nhiên liệu 600.000, lợi nhuận **−1.600.000** | ✅ không đổi so với trước |
| Bảng điều khiển tháng có chuyến | tổng chi phí 6.600.000 = 600.000 + 6.000.000 | ✅ |
| Bảng điều khiển tháng trắng | tổng chi phí 0, "Cơ cấu chi phí: Chưa có dữ liệu", cố định 0% | ✅ |
| `tsc --noEmit` (web + core), `next lint` | pass, 0 warning | ✅ |

Dữ liệu seed (chuyến `TST-FC`, khấu hao/lương tạm) đã xoá và phục hồi đúng giá trị cũ (`dep=null`, `default_driver=null`, `salary=null`).

## 6. Ghi chú còn lại

- Fallback theo xe vẫn **không có mốc thời gian**: tháng nào có chuyến thì lấy thuộc tính xe *hiện tại*, kể cả
  tháng trước khi mua xe. Chưa xử lý (ngoài phạm vi yêu cầu này) — nếu cần thì phải lưu lịch sử khấu hao/lương
  theo tháng thay vì đọc giá trị hiện hành.
- Staging đang có 6/8 xe tải ở trạng thái xoá mềm nên HCM không còn xe → khu vực này luôn 0 ₫.


---

## 7. Lịch sử chi phí cố định theo tháng (yêu cầu #2)

### 7.1 Vấn đề

Chi phí cố định của một tháng đọc **giá trị hiện hành** trên bản ghi:
`car_vehicles.cvh_depreciation` + lương của tài xế mặc định (`car_drivers.drv_fixed_salary`). Không có chiều
thời gian, nên:

- tháng **trước khi mua xe** vẫn gánh đủ một tháng khấu hao;
- **tăng lương tháng 7 là viết lại tháng 6** — kể cả tháng đã lập báo cáo;
- và cùng một logic bị **copy ở 2 chỗ** (`computeTruckPnl` cho tổng tháng, `loadTruckFixedAllocation` cho phân
  bổ theo chuyến) nên hai bên có thể lệch nhau.

### 7.2 Mô hình mới — mức phí có hiệu lực từ tháng

Bảng mới `car_truck_cost_rates` (migration **0025**): mỗi dòng nói *"từ tháng này trở đi, mức này áp dụng"*.

| Cột | Ý nghĩa |
|---|---|
| `tcr_scope` | `VEHICLE` (khấu hao) \| `DRIVER` (lương) |
| `tcr_ref_id` | `cvh_id` \| `drv_id` |
| `tcr_kind` | `DEPRECIATION` \| `SALARY` |
| `tcr_month` | `YYYY-MM` — hiệu lực từ tháng này (gồm cả tháng này) |
| `tcr_amount` | mức phí/tháng (VND) |

**Tra cho tháng M** = dòng mới nhất có `tcr_month <= M`; không có dòng nào → **0** (xe/tài xế chưa tồn tại hoặc
chưa có mức phí). Bảng `car_truck_fixed_costs` (nhập tay theo xe/tháng) vẫn **đè lên tất cả**.

### 7.3 Một resolver dùng chung

`packages/core/src/truck/truck-fixed-monthly.ts` → `loadTruckFixedMonthly(entId, months, scope)`:

```
manual car_truck_fixed_costs (xe, tháng)  →  rate history (0025)  →  0
```

Cả `computeTruckPnl` **và** `loadTruckFixedAllocation` giờ gọi hàm này (trước đây mỗi bên tự dò `cvh_depreciation`
+ lương tài xế), nên Σ(phân bổ theo chuyến) luôn khớp tổng tháng.

### 7.4 Lịch sử tự tích luỹ, không cần màn hình mới

Form xe / form tài xế vẫn sửa **một giá trị hiện hành** như cũ; đường ghi thêm một bước:
`recordTruckCostRate()` (`apps/web/src/server/services/truck-cost-rate.service.ts`) đóng mốc **hiệu lực từ tháng
hiện tại** khi:

- tạo xe tải có khấu hao / tạo (hoặc phục hồi) tài xế có lương → mốc mở đầu;
- **sửa** khấu hao / lương và số **thực sự đổi** → mốc mới. Sửa field khác không sinh dòng rác; sửa 2 lần trong
  cùng tháng thì ghi đè dòng của tháng đó (một quyết định = một mốc).

### 7.5 Backfill (trong migration 0025)

Mốc đầu tiên = **tháng nhỏ hơn** giữa *tháng tạo bản ghi* và *tháng có chuyến hoàn thành sớm nhất* của xe/tài xế
đó. Lấy `min` để các tháng **đã có chuyến** (có thể đã lập báo cáo) giữ nguyên con số cũ; chỉ những tháng trước
đó — xe chưa tồn tại, chưa chạy gì — mới về 0.

Đã áp: **local** (`ep-steep-tooth`, 0 dòng vì khấu hao/lương đều null) và **staging** (`ep-noisy-heart`, 17 dòng:
11 lương + 6 khấu hao, hiệu lực từ 2026-07).

### 7.6 Kiểm chứng lịch sử (local)

Dựng: khấu hao 1.000.000 từ **2026-06** · lương 5.000.000 từ **2026-07** · lương 8.000.000 từ **2026-08**; 1 chuyến
mỗi tháng 06/07/08.

| Tháng | Kỳ vọng | Chi phí & LN | Cột "CP cố định phân bổ" của chuyến |
|---|---|---|---|
| 2026-05 (không chuyến) | 0 | **0 ₫** ✅ | — |
| 2026-06 (chỉ khấu hao) | 1.000.000 | **1.000.000 ₫** ✅ | Lương 0 · KH 1.000.000 ✅ |
| 2026-07 (khấu hao + lương 5tr) | 6.000.000 | **6.000.000 ₫** ✅ | Lương 5.000.000 · KH 1.000.000 ✅ |
| 2026-08 (lương tăng 8tr) | 9.000.000 | **9.000.000 ₫** ✅ | Lương 8.000.000 · KH 1.000.000 ✅ |

Điểm quan trọng: sau khi thêm mốc lương T8, **tháng 7 vẫn là 6.000.000** — tăng lương không viết lại tháng cũ.
Dữ liệu test đã xoá sạch (rate + chuyến + tài xế mặc định trả về `null`).

### 7.7 Còn lại

- **Lịch sử phân công tài xế** chưa mô hình hoá: lương lấy theo *tài xế mặc định hiện tại* của xe. Số tiền là lịch
  sử, còn "ai lái tháng đó" thì không. Muốn đúng tuyệt đối thì cần bảng lịch sử gán xe ↔ tài xế.
- Chưa có **màn xem/sửa lịch sử** — hiện chỉ đọc/ghi tự động. Nếu KH cần chỉnh mức phí của một tháng quá khứ thì
  vẫn dùng "chi phí cố định nhập tay" theo (xe, tháng) như trước, hoặc phải làm thêm UI cho `car_truck_cost_rates`.
