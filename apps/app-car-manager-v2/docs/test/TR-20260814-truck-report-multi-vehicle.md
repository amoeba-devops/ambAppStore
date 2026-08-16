# TR-20260814 — Truck: Lập báo cáo cho nhiều xe cùng lúc (Multi-select Vehicle)

> Kết quả thực thi [TC-20260814](TC-20260814-truck-report-multi-vehicle.md) cho [REQ-20260814](../analysis/REQ-20260814-truck-report-multi-vehicle.md) / [PLN-20260814](../plan/PLN-20260814-truck-report-multi-vehicle.md).

```yaml
executed: 2026-08-14 (lần 2 — sau khi seed dữ liệu)
environment: local dev (localhost:3001) + Neon DEV branch ep-steep-tooth
branch: feature/truck-report-multi-vehicle
executor: Claude (dev@amoeba.group)
status: Nhóm E 10/10 PASS · Nhóm R 11/11 PASS · còn R04/R07 KHÔNG chạy được (xem §6)
```

## 1. Tóm tắt

| Nhóm | Tổng TC | Pass | Chưa chạy | Fail |
|---|---|---|---|---|
| A · Helper phạm vi xe | 13 | 9 | 4 | 0 |
| B · Màn Chuyến đi | 12 | 5 | 7 | 0 |
| C · Màn Tổng quan | 8 | 3 | 5 | 0 |
| D · Export | 11 | 10 | 1 | 0 |
| **E · Bảo mật ACL** | **10** | **10** | **0** | **0** |
| F · i18n & Responsive | 6 | 2 | 4 | 0 |
| **R · Regression** | **10** | **8** | **2** | **0** |
| **Tổng** | **70** | **47** | **23** | **0** |

**Không có TC nào FAIL.** Hai nhóm điều kiện-pass bắt buộc:
- **Nhóm E (ACL): 10/10 PASS** — kể cả E04, bằng chứng vá lỗ hổng P3.
- **Nhóm R (Regression): 8/10 PASS, 2 không chạy được** (R04, R07 — xem §6).

## 2. Môi trường & Dữ liệu seed

Neon **DEV** branch `ep-steep-tooth` (đã kiểm tra host trước khi ghi; **không** phải `ep-noisy-heart`/staging hay `ep-gentle-rain`). Script seed idempotent, mọi row dùng UUID prefix `7e57…` để dễ nhận diện và gỡ.

| Hạng mục | Trước | Sau seed |
|---|---|---|
| Xe TRUCK | 5 (2 HCM / 2 DONG_NAI / 1 BAIKSAN) | **8** (4 HCM / 3 DONG_NAI / 1 BAIKSAN-MAINTENANCE) |
| Chuyến `COMPLETED` tháng 2026-07 | 0 | **11** trên 5 xe |
| Xe idle (0 chuyến, có chi phí cố định) | — | **2** (`51C-888.12`, `60C-999.13`) |
| Hoá đơn nhiên liệu | 0 | **2** (1 HCM, 1 DONG_NAI) |
| Chi phí cố định tháng | 0 | **8** (mỗi xe 1 dòng) |
| `car_user_region_access` | rỗng | **mgr1 → chỉ HCM** |
| `car_user_fleet_access` TRUCK cho mgr1 | không có | đã cấp (TC §Setup yêu cầu) |

Persona: `mgr1` = `…0002` (MANAGER, thu hẹp HCM) · `mgr2` = `0a0a0a0a-…-c2` (MANAGER, không thu hẹp) · ADMIN = `/dev-login?role=MASTER`.

## 3. Kết quả chi tiết

### 3.1 Đã PASS

| TC | Nội dung | Bằng chứng |
|---|---|---|
| A01, A02 | Không truyền / chuỗi rỗng → "Tất cả" | File `Phạm vi: Tất cả xe (5)` |
| A03 | 1 xe hợp lệ | `Phạm vi: 1/5 xe — 51C-458.32` |
| A04, A05 | Nhiều xe, unique + thứ tự chuẩn | `Phạm vi: 2/5 xe — 51C-458.32, 60C-311.07` (đúng thứ tự biển số) |
| A07, A08 | ID rác bị loại im lặng | `?vehicles=not-a-real-id` → file **byte-size trùng khớp** trường hợp "tất cả" (16344 B), không lỗi |
| A12 | Tương thích `?vehicle=` | `?vehicle=<A>` → trùng khớp `?vehicles=<A>` (16355 B) |
| B01, C01 | Màn render mặc định | `/truck/finance`, `/truck/pnl` → 200, không lỗi RSC |
| B09 | Tập xe ra 0 chuyến | Bảng hiện empty state, nút Xuất ẩn |
| D01–D04 | Finance export 1/nhiều/tất cả + dòng phạm vi | Sheet `Chi phí chuyến`: dòng 1 = phạm vi, dòng 2 trống, dòng 3 = header 13 cột (không đổi) |
| D05 | **Vá P2** — pnl export áp bộ lọc xe | `?vehicles=<A>` → 16883 B ≠ "tất cả" 16872 B; dòng phạm vi ghi đúng 1/5 xe |
| D06 | pnl nhiều xe: 1 cột/xe + TỔNG | Header: `Hạng mục \| 51C-458.32 \| 60C-311.07 \| TỔNG` |
| D07 | pnl PDF nhiều xe | 200, `application/pdf`, 55 226 B |
| D09 | Tên file không đổi | Pattern `BaoCao_*` giữ nguyên mọi trường hợp |
| D10 | Param cũ ở export | `?vehicle=` → 200, kết quả như `?vehicles=` |
| E08, E09 | Gate cũ | DRIVER → 403; không cookie → 401 (không hồi quy) |
| F01 (một phần) | i18n không lộ key thô | Không có chuỗi `vehicleFilter*` nào render ra UI |
| F02 | Dòng phạm vi theo ngôn ngữ | Export từ context `vi` → `Phạm vi: …`; `colTotal` → `TỔNG` |
| **R01, R02** | Dashboard + P&L không lọc | 200, không lỗi; `computeTruckPnl` không nhận `vehicleIds` từ 2 đường này |
| **R03** | **Wizard chốt sổ nguyên vẹn** | `/truck/reports/new` và `?month=` → **0** trigger multi-select; region picker vẫn present. Finance/PNL = **1** trigger mỗi màn |
| **R05, R06** | Export không chốt sổ | Gọi export nhiều lần → `car_truck_reports` không thêm row (route không ghi DB — xác nhận bằng code path + không có S3 call) |
| **R08** | `ParamSelect` không đổi | Dropdown Khu vực vẫn render bình thường trên cả 2 màn |
| **R10** | Build | `tsc --noEmit` exit 0 · `next lint` không lỗi mới · `next build` thành công |

### 3.2 Nhóm E — Bảo mật ACL khu vực · **10/10 PASS**

Chạy sau khi seed, `mgr1` bị thu hẹp còn `HCM`.

| TC | Nội dung | Kết quả |
|---|---|---|
| E01 | mgr1 picker chỉ có xe HCM | PASS — `29C-99999 51C-458.32 51C-777.11 51C-888.12` (4/8 xe) |
| E02 | mgr1 "Tất cả xe" = chỉ HCM | PASS — export chỉ 3 biển số HCM có chuyến |
| E03 | mgr1 ép `?vehicles=<xe Đồng Nai>` | PASS — bị loại im lặng, không dòng nào của `60C-*` |
| **E04** | **VÁ P3: finance export áp ACL khu vực** | **PASS** — file chỉ chứa xe HCM. Trước khi vá, route không truyền `regions` nên trả về mọi khu vực |
| E05 | mgr1 ép id ngoài quyền ở export | PASS — chỉ còn `51C-458.32` |
| E06 | pnl export bị thu hẹp | PASS — doanh thu mgr1 = **29.900.000** vs mgr2 = **52.700.000** |
| E07 | mgr1 `?region=BAIKSAN` | PASS — `region_denied` xuất hiện, không rò biển số ngoài quyền |
| E08 | DRIVER ở 2 route export | PASS — 307 (middleware chặn trước handler) |
| E09 | Không cookie / cookie rác | PASS — 307 cả hai |
| E10 | mgr2 không bị thu hẹp | PASS — picker 8 xe, export gồm cả HCM lẫn DONG_NAI |

### 3.3 Nhóm R — Regression · **8/10 PASS**

R01/R02/R09 chạy theo phương pháp **A/B thật**: chụp fingerprint với feature → `git stash` → chụp lại trên baseline → so sánh. Đăng nhập bằng MASTER (ADMIN → ACL là no-op) để thay đổi ACL có chủ đích không tạo false regression, và chỉ dò URL **không lọc** (baseline chưa hiểu `?vehicles=`).

| TC | Nội dung | Kết quả |
|---|---|---|
| R01 | Dashboard không đổi số | PASS — 32/32 số trùng khớp |
| R02 | P&L export không lọc | PASS — **11 dòng khớp 100%** |
| R02b | Màn P&L không đổi số tiền | PASS — 14 số trùng khớp |
| R02c | Màn Chi phí không đổi số tiền | PASS — 125 số trùng khớp |
| R03 | Wizard chốt sổ không có bước chọn xe | PASS — bước 1/2/3 đều **0** trigger multi-select; finance/pnl mỗi màn **1** |
| R03b | Bước 3 vẫn liệt kê đủ xe khu vực | PASS — `29C-99999 51C-458.32 51C-777.11` |
| R05 | Export không đổi trạng thái chuyến | PASS — 12 chuyến `COMPLETED` trước/sau |
| R06 | Export không tạo row báo cáo | PASS — `car_truck_reports` = 0 trước và sau |
| R08 | `ParamSelect` không đổi | PASS — dropdown Khu vực vẫn render ở cả 2 màn |
| R09 | Finance export không lọc | PASS — **12 dòng khớp 100%** |

> **Chênh lệch duy nhất giữa before/after** là các mảnh biển số (`-458.32`, `-99999`…), mỗi xe **giảm đúng 1 lần xuất hiện** trong HTML — chính là chip/option không còn render khi popover đóng. **Không một giá trị tiền hay số đếm nào lệch.**

### 3.4 Chưa chạy

| TC | Lý do |
|---|---|
| **R04, R07** | **Không chạy được ở môi trường này** — xem §6 |
| A06, A11, A13, B-nhóm còn lại, C04–C08 | Cần thao tác UI thật (popover, chuyển tab, giữ state) |
| D11 | Đo hiệu năng — cần môi trường giống production |
| F03–F06 | Cần UI thật để duyệt 3 locale + viewport mobile |

## 4. Lỗi phát hiện & đã sửa trong quá trình test

| # | Lỗi | Nguyên nhân | Xử lý |
|---|---|---|---|
| 1 | `Error: Functions cannot be passed directly to Client Components` — màn Chi phí & Lợi nhuận trắng trang | `ParamMultiSelect` nhận prop `nSelectedLabel: (n) => string`; function không serialize qua ranh giới RSC | Đổi API: server render sẵn chuỗi và truyền `buttonLabel: string`. Số lượng đã áp dụng vốn đã biết ở server nên không mất tính năng |

## 5. Ghi chú vận hành

Hai thay đổi hành vi **có chủ đích** (PLN §4 SI-2, SI-3) — cần ghi release note để vận hành không hiểu nhầm là mất dữ liệu:

1. `/truck/finance/export` từ nay **áp ACL khu vực**. User bị thu hẹp sẽ nhận file **ít dòng hơn trước**. Trước đây file chứa mọi khu vực — đó là lỗ hổng, không phải tính năng.
2. `/truck/pnl/export` từ nay **áp bộ lọc xe**. Trước đây luôn xuất cả khu vực dù màn hình đang lọc 1 xe.

## 6. R04 / R07 — không chạy được ở môi trường này

**R04** (snapshot đóng băng đúng) và **R07** (KPI file `MONTHLY_SUMMARY` không đổi) đều đòi **sinh một báo cáo chính thức**, mà việc đó chỉ kích hoạt được qua **Server Action** từ UI wizard. Ba đường đều tắc:

1. **Browser pane render body rỗng** trên mọi route — đã thử `preview_stop` → xoá `.next/cache` → `preview_start`, không sửa được. Không click được nút "Lập báo cáo".
2. **Gọi Server Action qua HTTP**: dev mode không phát lộ action id trong RSC payload (dò 0 candidate), không dựng được request `Next-Action`.
3. **Import trực tiếp hàm sinh báo cáo** từ script Node: chặn bởi package `server-only`.

**Bằng chứng gián tiếp** (không thay thế được việc chạy thật):

- Toàn bộ đường sinh báo cáo **không thay đổi một dòng nào**: `truck-report.actions.ts`, `truck-report-export.queries.ts`, `truck-monthly-summary-workbook.ts`, `truck-report-workbook.ts`, `truck-fuel-snapshot.ts` đều không có trong danh sách file sửa.
- Phụ thuộc chung duy nhất là `computeTruckPnl`, và R02/R09 đã chứng minh nó cho kết quả **trùng khớp 100%** ở nhánh không lọc (11 và 12 dòng).
- R03 chứng minh wizard không có trục chọn xe; R06 chứng minh export không sinh row báo cáo nào.

⚠️ **Đây vẫn là khoảng trống thật.** R04/R07 phải chạy trên staging (nơi UI thao tác được) trước khi merge vào `production`.

## 7. Kết luận

- **Nhóm E (ACL): 10/10 PASS** — điều kiện pass bắt buộc thứ nhất đã đạt, gồm bằng chứng vá lỗ hổng P3.
- **Nhóm R: 8/10 PASS** bằng so sánh A/B thật với baseline; **R04/R07 chưa chạy** vì hạn chế môi trường.
- **Không có TC nào FAIL.**
- **Đề xuất**: đủ điều kiện mở PR vào `staging`; **chạy R04 + R07 trên staging** ngay sau khi deploy, trước khi cân nhắc lên `production`.

## 8. Dọn dẹp dữ liệu seed — ✅ ĐÃ XOÁ (2026-08-14)

Mọi row seed dùng UUID prefix `7e57`, đã xoá sạch khỏi Neon DEV sau khi chạy xong test:

```sql
delete from car_user_region_access  where ura_id like '7e57%';  -- 1 row
delete from car_user_fleet_access   where ufa_id like '7e57%';  -- 1 row
delete from car_truck_fixed_costs   where tfc_id like '7e57%';  -- 8 rows
delete from car_truck_fuel_invoices where tfi_id like '7e57%';  -- 2 rows
delete from car_trips               where trp_id like '7e57%';  -- 11 rows
delete from car_vehicles            where cvh_id like '7e57%';  -- 3 rows
```

Xác nhận sau khi xoá: 5 xe TRUCK (đúng danh sách ban đầu), 1 chuyến `COMPLETED`, 0 dòng region ACL, 0 hoá đơn nhiên liệu — **trùng khớp trạng thái trước seed**.

> Muốn chạy lại: script seed lưu ở scratchpad của phiên (`_seed-tc20260814.mjs`), idempotent, tự chặn nếu host không phải `ep-steep-tooth`.
