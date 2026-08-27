# TC-20260814 — Truck: Lập báo cáo cho nhiều xe cùng lúc (Multi-select Vehicle)

> Test cho [REQ-20260814](../analysis/REQ-20260814-truck-report-multi-vehicle.md) + [PLN-20260814](../plan/PLN-20260814-truck-report-multi-vehicle.md).
> Phạm vi: bộ lọc xe multi-select trên `/truck/finance` + `/truck/pnl` và 2 route export. Wizard chốt sổ `/truck/reports/new` **không đổi** — nhóm R (Regression) tồn tại để chứng minh điều đó.

## Setup

- Không cần `db:push`, không có schema mới. Chạy trên dữ liệu hiện có.
- dev-login: `/app-car-manager-v2/dev-login?role=ADMIN|MANAGER|MEMBER` (`DEMO_AUTO_LOGIN=true`).
- **Seed tối thiểu** — 1 entity, tháng test `2026-07`:
  - **8 xe TRUCK** còn hoạt động: 4 xe `HCM` (`T1..T4`), 3 xe `DONG_NAI` (`T5..T7`), 1 xe `BAIKSAN` (`T8`).
  - `T1, T2, T3, T5, T6` có ≥ 2 chuyến `COMPLETED` với odometer đầy/cuối (để `km > 0`).
  - `T4` **0 chuyến** trong tháng nhưng có chi phí cố định → kiểm tra xe idle.
  - `T7` `cvh_status = MAINTENANCE`.
  - ≥ 1 hoá đơn nhiên liệu gán cho `T1` và `T5` (để có `costPerKm` thật).
  - ≥ 1 báo cáo chính thức đã lập cho `HCM` tháng `2026-07` (để nhóm R có mốc so sánh).
- **User test**: `admin1` (ADMIN, không gán khu vực → `'ALL'`), `mgr1` (MANAGER, gán **chỉ `HCM`**), `mgr2` (MANAGER, không gán → `'ALL'`).
- **Ảnh chụp số liệu trước khi sửa code** (bắt buộc cho nhóm R): ghi lại Dashboard tháng 7, `/truck/pnl` không lọc, và file `MONTHLY_SUMMARY` của `HCM/2026-07`.

---

## A. Helper `resolveVehicleScope` (PLN A1 · REQ BL-1)

| # | Mô tả | Tiền điều kiện | Bước | Kỳ vọng |
|---|---|---|---|---|
| TC-A01 | Không truyền gì | `admin1` | `resolveVehicleScope(admin1, undefined)` | `vehicleIds: undefined`, `isAll: true`, `trucks.length = 8` |
| TC-A02 | Chuỗi rỗng | `admin1` | `raw = ''` | như TC-A01 (không phải mảng `['']`) |
| TC-A03 | 1 xe hợp lệ | `admin1` | `raw = '<T1>'` | `vehicleIds = ['<T1>']`, `isAll: false` |
| TC-A04 | Nhiều xe hợp lệ | `admin1` | `raw = '<T1>,<T2>,<T5>'` | `vehicleIds` đủ 3 id, `isAll: false` |
| TC-A05 | Trùng lặp + khoảng trắng | `admin1` | `raw = ' <T1> , <T1>,<T2> '` | unique + trim → `['<T1>','<T2>']` |
| TC-A06 | Chọn đủ toàn bộ | `admin1` | `raw` = cả 8 id | chuẩn hoá về `isAll: true`, `vehicleIds: undefined` |
| TC-A07 | ID rác | `admin1` | `raw = 'khong-ton-tai,<T1>'` | ID rác bị **loại im lặng** (không throw) → `['<T1>']` |
| TC-A08 | Toàn ID rác | `admin1` | `raw = 'a,b,c'` | không còn id hợp lệ → `isAll: true` (về mặc định, KHÔNG trả bảng rỗng) |
| TC-A09 | ID ngoài ACL khu vực | `mgr1` (chỉ `HCM`) | `raw = '<T5>'` (Đồng Nai) | bị loại → `isAll: true`; `trucks` chỉ gồm 4 xe HCM |
| TC-A10 | Trộn trong/ngoài ACL | `mgr1` | `raw = '<T1>,<T5>'` | chỉ còn `['<T1>']` |
| TC-A11 | "Tất cả xe" của user bị thu hẹp | `mgr1` | `raw = undefined` | `isAll: true`; **scope thực tế = 4 xe HCM**, KHÔNG phải 8 xe |
| TC-A12 | Tương thích param cũ | `admin1` | URL chỉ có `?vehicle=<T1>` | đọc được → `['<T1>']` (RB-4) |
| TC-A13 | Cả hai param | `admin1` | `?vehicles=<T2>&vehicle=<T1>` | `vehicles` thắng → `['<T2>']` |

---

## B. Màn `/truck/finance` — tab Chuyến đi

| # | Mô tả | Bước | Kỳ vọng |
|---|---|---|---|
| TC-B01 | Mặc định | `admin1` mở `/truck/finance?month=2026-07` | Nhãn bộ lọc "Tất cả xe"; bảng có chuyến của cả 5 xe có chuyến |
| TC-B02 | Chọn 1 xe (chống hồi quy) | tick `T1` → Áp dụng | URL `?vehicles=<T1>`; bảng + thẻ P&L **trùng khớp** kết quả cũ với `?vehicle=<T1>` |
| TC-B03 | Chọn 3 xe | tick `T1,T2,T5` → Áp dụng | Nhãn "3 xe"; bảng chỉ có chuyến của 3 xe; `subtitle` đếm đúng số dòng |
| TC-B04 | Chỉ 1 lần điều hướng | tick 3 xe rồi mới bấm Áp dụng | Chỉ **1** lần push URL / 1 lần SSR (không re-render sau mỗi tick) |
| TC-B05 | Chọn "Tất cả xe" | đang chọn 3 xe → tick "Tất cả xe" | `vehicles` bị **xoá khỏi URL**; kết quả bằng TC-B01 |
| TC-B06 | Bỏ chọn tất cả | bấm "Bỏ chọn tất cả" → Áp dụng | về trạng thái "Tất cả xe" (không phải bảng rỗng) |
| TC-B07 | Kết hợp bộ lọc Khu vực | `region=DONG_NAI` + chọn `T1` (HCM) | Bảng rỗng (giao 2 điều kiện), nút Xuất ẩn — **không** báo lỗi |
| TC-B08 | Kết hợp ô tìm kiếm | chọn 2 xe + gõ tên khách | Cả 2 điều kiện cùng áp; đổi từ khoá không mất tập xe đang chọn |
| TC-B09 | Xe không có chuyến | chỉ chọn `T4` (0 chuyến) | Bảng hiện empty state; **nút Xuất Excel ẩn** (`rows.length > 0`) |
| TC-B10 | Giữ state khi chuyển tab | chọn 3 xe → bấm tab "Tổng quan" | Sang `/truck/pnl` vẫn đúng 3 xe đó (PLN C5) |
| TC-B11 | Đổi tháng | chọn 3 xe → đổi sang `2026-06` | Tập xe **giữ nguyên**, chỉ dữ liệu đổi tháng |
| TC-B12 | Reload / chia sẻ link | copy URL `?vehicles=…` mở tab mới | Bộ lọc khôi phục đúng, nhãn "n xe" đúng |

---

## C. Màn `/truck/pnl` — tab Tổng quan

| # | Mô tả | Bước | Kỳ vọng |
|---|---|---|---|
| TC-C01 | Mặc định | `admin1` mở `/truck/pnl?month=2026-07` | "Tất cả xe"; số liệu bằng ảnh chụp trước khi sửa |
| TC-C02 | Chọn 1 xe (chống hồi quy) | chọn `T1` | Số liệu **trùng khớp** kết quả cũ với chip `?vehicle=<T1>` |
| TC-C03 | Chọn nhiều xe | chọn `T1,T2` | Mọi chỉ tiêu = tổng của 2 xe (doanh thu, nhiên liệu, cầu đường, phát sinh, lương, khấu hao, chuyến, lợi nhuận ròng) |
| TC-C04 | Chi phí cố định cấp đội | chọn tập con bất kỳ | `driverSalary` cấp đội bị loại — cùng quy tắc như lọc 1 xe/khu vực hiện tại (PLN A3) |
| TC-C05 | Xe idle | chỉ chọn `T4` (0 chuyến) | Chi phí cố định **không** phân bổ (`fixedCostWithoutTrips` mặc định false) → mọi chỉ tiêu 0, không âm |
| TC-C06 | Xe bảo dưỡng | chọn `T7` | Không lỗi; hiển thị đúng như AS-IS khi lọc riêng xe đó |
| TC-C07 | Biểu đồ 3 tháng | chọn 2 xe | Cả 3 tháng đều lọc theo tập xe, không chỉ tháng đang chọn |
| TC-C08 | Giữ state khi chuyển tab | chọn 2 xe → bấm tab "Chuyến đi" | `/truck/finance` giữ đúng 2 xe |

---

## D. Route export

| # | Mô tả | Bước | Kỳ vọng |
|---|---|---|---|
| TC-D01 | Finance · 1 xe | `/truck/finance/export?month=2026-07&vehicles=<T1>` | .xlsx chỉ có chuyến của `T1`; **giống hệt** file cũ `?vehicle=<T1>` (trừ dòng phạm vi mới) |
| TC-D02 | Finance · nhiều xe | `…&vehicles=<T1>,<T2>,<T5>` | **1 file, 1 sheet**; cột `Phương tiện` có đủ 3 biển số; sắp xếp biển số → ngày |
| TC-D03 | Finance · tất cả | `…` không có `vehicles` | Bằng file AS-IS khi không lọc |
| TC-D04 | Dòng phạm vi | TC-D02 | Có dòng `Phạm vi: 3/8 xe — <3 biển số>`; TC-D03 có `Phạm vi: Tất cả xe (8)` |
| TC-D05 | **PNL · vá P2** | `/truck/pnl/export?month=2026-07&vehicles=<T1>&format=xlsx` | 🔴 File chỉ chứa số của `T1`. **Trước khi sửa** file này chứa cả khu vực — đây là bằng chứng vá lỗi |
| TC-D06 | PNL · nhiều xe (layout) | `…&vehicles=<T1>,<T2>,<T5>` | Cột 1 = Chỉ tiêu; 3 cột biển số; cột cuối **TỔNG**; TỔNG = Σ 3 cột trên từng dòng |
| TC-D07 | PNL · PDF nhiều xe | `…&format=pdf` với 3 xe | PDF không tràn lề; > 6 xe → khổ ngang |
| TC-D08 | PNL · tất cả | không truyền `vehicles` | Bằng file AS-IS |
| TC-D09 | Tên file | mọi trường hợp trên | Không đổi so với AS-IS (chỉ 1 xe hay nhiều xe đều giữ pattern cũ) |
| TC-D10 | Param cũ | `/truck/finance/export?month=2026-07&vehicle=<T1>` | Vẫn chạy, cho kết quả như TC-D01 |
| TC-D11 | Hiệu năng | `vehicles` = cả 8 xe, `format=pdf` | Phản hồi < 10s, không timeout (bắt buộc `Promise.all` — PLN B3) |

---

## E. Bảo mật / ACL khu vực (REQ §6.2)

| # | Mô tả | Người dùng | Bước | Kỳ vọng |
|---|---|---|---|---|
| TC-E01 | Dropdown bị thu hẹp | `mgr1` (chỉ HCM) | mở bộ lọc xe ở `/truck/finance` | Chỉ liệt kê **4 xe HCM**; không lộ biển số Đồng Nai/Baiksan |
| TC-E02 | "Tất cả xe" ≠ toàn đội | `mgr1` | không lọc gì | Bảng chỉ có chuyến của xe HCM |
| TC-E03 | Ép ID ngoài quyền qua URL | `mgr1` | `/truck/finance?month=2026-07&vehicles=<T5>` | `T5` bị loại → hiển thị như "Tất cả xe HCM"; **không** có dòng nào của `T5` |
| TC-E04 | 🔴 **Vá P3 — export ACL** | `mgr1` | `/truck/finance/export?month=2026-07` (không param) | File **chỉ** chứa chuyến xe HCM. **Trước khi sửa** file chứa cả 3 khu vực → bằng chứng vá lỗ hổng |
| TC-E05 | Ép ID ngoài quyền qua export | `mgr1` | `/truck/finance/export?…&vehicles=<T5>` | `T5` bị loại; file không chứa dòng nào của `T5` |
| TC-E06 | PNL export ACL | `mgr1` | `/truck/pnl/export?month=2026-07` | Số liệu chỉ gồm xe HCM |
| TC-E07 | Ép `?region=` ngoài quyền | `mgr1` | `/truck/finance?region=BAIKSAN` | Hành vi cũ giữ nguyên: redirect + `region_denied` (không hồi quy REQ-20260813) |
| TC-E08 | DRIVER | role=MEMBER | gọi 2 route export | `403 Forbidden` (gate cũ giữ nguyên) |
| TC-E09 | Chưa đăng nhập | không cookie | gọi 2 route export | `401 Unauthorized` |
| TC-E10 | User không thu hẹp | `mgr2` (`'ALL'`) | như TC-E01/E04 | Thấy đủ 8 xe, file đủ 3 khu vực — không hồi quy |

---

## F. i18n & Responsive

| # | Mô tả | Bước | Kỳ vọng |
|---|---|---|---|
| TC-F01 | 3 ngôn ngữ | đổi locale vi/en/ko trên cả 2 màn | Nhãn "Tất cả xe" / "{n} xe" / "Áp dụng" / "Bỏ chọn tất cả" dịch đúng; **không lộ key thô** |
| TC-F02 | Dòng phạm vi trong file | xuất file ở cả 3 locale | Dòng `Phạm vi:` theo ngôn ngữ người xuất |
| TC-F03 | Cột TỔNG | xuất pnl 3 xe ở 3 locale | `TỔNG` / `TOTAL` / `합계` |
| TC-F04 | Mobile 375px | mở bộ lọc xe | Bottom sheet full-width, hàng ≥ 44px, không tràn ngang |
| TC-F05 | Tablet 768px | như trên | Popover hiển thị đúng, không bị cắt |
| TC-F06 | Bàn phím | Tab/Space/Enter trên popover | Điều hướng và tick được bằng bàn phím; Esc đóng không áp dụng |

---

## R. Regression — chứng minh KHÔNG đụng luồng chốt sổ (SI-1, SI-8)

> **Bắt buộc chạy sau Phase A** (trước khi có UI) và **lặp lại sau Phase D**. So với ảnh chụp ở Setup.

| # | Mô tả | Bước | Kỳ vọng |
|---|---|---|---|
| TC-R01 | Dashboard không đổi số | mở `/truck/dashboard?month=2026-07` | Mọi con số **trùng khớp** ảnh chụp trước khi sửa |
| TC-R02 | P&L không lọc không đổi số | `/truck/pnl?month=2026-07` (không `vehicles`) | Trùng khớp ảnh chụp |
| TC-R03 | Wizard chốt sổ nguyên vẹn | `/truck/reports/new` → tháng 7 → chọn HCM → review | 3 bước y nguyên; **không có** bước/bộ lọc chọn xe; bước 3 vẫn liệt kê đủ xe của khu vực |
| TC-R04 | Snapshot nhiên liệu không đổi | lập lại báo cáo `HCM/2026-07`, đọc `car_truck_reports` | `trr_vehicle_fuel` phủ **đủ** xe HCM có hoá đơn; `trr_region = 'HCM'`; không có cột phạm vi xe nào |
| TC-R05 | Trạng thái chuyến không đổi | xem `/truck/finance` sau khi xuất file nhiều xe | Không chuyến nào đổi "Tạm tính" ⇄ "Đã lập BC" — export **không** chốt sổ (REQ BL-3) |
| TC-R06 | Không sinh row báo cáo | xuất file từ cả 2 route nhiều lần | `car_truck_reports` **không** thêm row nào; S3 không thêm object |
| TC-R07 | File `MONTHLY_SUMMARY` không đổi | tải lại báo cáo chính thức `HCM/2026-07` | KPI (`Tổng xe`, `Xe hoạt động`, `TB chuyến/xe`) và dòng TỔNG trùng khớp ảnh chụp |
| TC-R08 | Dropdown Khu vực/Trạng thái | mọi màn TRUCK dùng `ParamSelect` | Hành vi không đổi (RB-1 — không refactor `ParamSelect`) |
| TC-R09 | Báo cáo TRIP_LOG | lập báo cáo loại `TRIP_LOG` | Không đổi — `listTruckFinanceTrips` gọi từ đây không truyền `vehicleIds` (PLN A2) |
| TC-R10 | Build | `npm run lint` · `tsc --noEmit` · `npm run build` | Xanh, không warning mới |

---

## Tổng kết

| Nhóm | Số TC | Trọng tâm |
|---|---|---|
| A · Helper phạm vi xe | 13 | Phân tích CSV, chuẩn hoá, giao với ACL |
| B · Màn Chuyến đi | 12 | Multi-select, giữ state, kết hợp bộ lọc |
| C · Màn Tổng quan | 8 | Cộng dồn số liệu, xe idle/bảo dưỡng |
| D · Export | 11 | Layout nhiều xe, vá P2, hiệu năng |
| E · Bảo mật ACL | 10 | **Vá P3**, chống ép ID qua URL |
| F · i18n & Responsive | 6 | 3 ngôn ngữ, mobile |
| R · Regression | 10 | **Chứng minh không đụng chốt sổ** |
| **Tổng** | **70** | |

**Ưu tiên khi thiếu thời gian**: R (bắt buộc, không được bỏ) → E → B02/C02 (chống hồi quy 1 xe) → D05/E04 (bằng chứng vá lỗi) → phần còn lại.

**Điều kiện pass để lên staging**: toàn bộ nhóm R và nhóm E pass; nhóm B/C/D không có lỗi mức Cao.
