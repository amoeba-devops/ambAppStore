# TC-20260817 — Truck: Cho phép chọn xe khi Lập báo cáo chính thức (Wizard chốt sổ)

> Test cho [REQ-20260817](../analysis/REQ-20260817-truck-report-wizard-vehicle-scope.md) / [PLN-20260817](../plan/PLN-20260817-truck-report-wizard-vehicle-scope.md).
> Trọng tâm: (1) BL-1 — fold theo xe không làm mất số đã đóng băng của xe khác; (2) Phase A0 — xác thực chặt quan hệ xe–tài xế–khu vực theo chỉ đạo người dùng; (3) không hồi quy REQ-20260813/814.

## Setup

- Không cần `db:push` cho phần code cũ; **CẦN** áp migration `00XX_truck_report_vehicle_ids.sql` trước khi chạy nhóm A/B.
- dev-login: `/dev-login?role=ADMIN|MANAGER|MEMBER`.
- Seed tối thiểu, tháng test `2026-08`, entity test:
  - **Khu vực HCM**: 4 xe `T1..T4`, đều có ≥ 2 chuyến `COMPLETED` với odometer đầy đủ và ≥ 1 hoá đơn nhiên liệu gán đúng xe (để `costPerKm` thật cho cả 4 xe).
  - `T1` có `cvh_default_driver_id` hợp lệ; `T2` có `cvh_default_driver_id = NULL` (chưa gán tài xế); `T3` có `cvh_default_driver_id` trỏ tới 1 driver đã bị soft-delete.
  - `T4` thuộc khu vực **DONG_NAI** (dùng để test "xe sai khu vực bị loại").
  - User test: `admin1` (ADMIN), `mgr1` (MANAGER, ACL chỉ `HCM`), `mgr2` (MANAGER, không giới hạn).
  - **Ảnh chụp trước khi sửa code** (bắt buộc cho nhóm R): Dashboard tháng 08, `/truck/pnl` không lọc, danh sách `/truck/reports`.

---

## A0. Xác thực quan hệ xe–tài xế–khu vực (Phase A0 — MỚI, ưu tiên theo chỉ đạo người dùng)

| # | Nội dung | Tiền điều kiện | Bước | Kỳ vọng |
|---|---|---|---|---|
| A0-01 | Chọn đúng 2/4 xe HCM | `admin1`, khu vực HCM | Bước 2.5 chọn `T1, T2` | Bước 3 chỉ hiện 2 xe; `resolveReportVehicleScope` trả `vehicleIds = [T1, T2]` |
| A0-02 | Chèn xe khác khu vực qua request giả mạo | `admin1` | Gọi `generateTruckReportAction({ region: 'HCM', vehicleIds: [T1, T4] })` trực tiếp (bỏ qua UI) | `T4` (Đồng Nai) bị loại ở tầng server; báo cáo chỉ chứa `T1`. Không throw, không lẫn dữ liệu Đồng Nai |
| A0-03 | mgr1 (ACL chỉ HCM) chèn xe ngoài ACL | `mgr1` | `generateTruckReportAction({ region: 'HCM', vehicleIds: [T1, '<id xe không tồn tại trong ACL>'] })` | ID lạ bị loại; báo cáo chỉ chứa `T1` |
| A0-04 | Toàn bộ `vehicleIds` gửi lên đều không hợp lệ | `admin1` | `vehicleIds` toàn ID rác/sai khu vực | **Trả lỗi rõ ràng** (không âm thầm coi là "Tất cả xe" — khác hành vi `resolveVehicleScope` của màn trích xuất, xem PLN §2 A0.2) |
| A0-05 | Xe không có tài xế mặc định (`T2`) | `admin1` | Lập báo cáo PNL gồm `T2` | Dòng `T2` lên báo cáo bình thường, cột lương cố định = 0, không lỗi, tên tài xế hiện "—" |
| A0-06 | Xe có tài xế mặc định đã bị xoá (`T3`) | `admin1` | Lập báo cáo PNL gồm `T3` | Dòng `T3` lên báo cáo bình thường (không crash do driver bị soft-delete), lương cố định = 0 hoặc theo fallback đã có, không throw |
| A0-07 | Xe bị xoá GIỮA lúc mở wizard và lúc bấm xác nhận | `admin1` | Mở bước 2.5 (thấy `T1..T4`) → soft-delete `T2` ở tab khác → quay lại bấm "Lập báo cáo" với `vehicleIds` cũ (còn chứa `T2`) | `T2` bị loại khỏi báo cáo cuối cùng (server re-validate tại thời điểm generate, không tin danh sách hiển thị lúc mở wizard) |
| A0-08 | Không tin function/label từ client | `admin1` | Gửi `vehicleIds` hợp lệ nhưng kèm field lạ khác | Server chỉ dùng `region` + `vehicleIds` đã parse qua Zod, không dùng field không khai báo |

---

## B. BL-1 — Fold theo xe (đóng băng không mất số của xe khác)

| # | Nội dung | Tiền điều kiện | Bước | Kỳ vọng |
|---|---|---|---|---|
| B-01 | Report toàn bộ trước, report tập con sau | HCM, tháng 08, 4 xe có invoice | 1) Lập báo cáo PNL toàn bộ 4 xe (`vehicleIds` bỏ trống) 2) Lập lại chỉ `T1, T2` | Sau bước 2: `T3, T4` **giữ nguyên** `costPerKm`/`avgPrice` của report #1; `T1, T2` cập nhật theo report #2 |
| B-02 | Trạng thái "Đã lập BC" theo đúng xe | Tiếp B-01 | Xem trip của `T3` (không nằm trong report #2) | Trip của `T3` vẫn hiện "Đã lập BC" (không bị report #2 làm mất trạng thái) vì report #1 (toàn bộ) đã phủ nó |
| B-03 | Report tập con trước, report toàn bộ sau | HCM, tháng 08 khác (chưa có report nào) | 1) Lập báo cáo chỉ `T1` 2) Lập báo cáo toàn bộ 4 xe | Sau bước 2: mọi xe (kể cả `T1`) lấy số của report #2 (report toàn bộ, sinh SAU, ghi đè mọi xe) |
| B-04 | Sửa chuyến giữa 2 lần report | Tiếp B-01 | Sửa 1 chuyến của `T3` SAU report #1 nhưng TRƯỚC report #2 | Chuyến đó vẫn tính "đã phủ" bởi report #1 (không bị report #2 — vốn không chứa T3 — làm sai trạng thái theo hướng ngược) |
| B-05 | 2 lần report tập con không giao nhau | HCM, tháng mới | Report lần 1: `T1, T2`. Report lần 2: `T3, T4` | Cả 4 xe đều có số đóng băng đúng — không xe nào ghi đè nhầm lên xe khác |
| B-06 | Regression công thức | Bất kỳ | So sánh `costPerKm` tính bởi BL-1 mới với công thức cũ (trước khi sửa) trên cùng dữ liệu toàn bộ xe | Khớp 100% — BL-1 không đổi công thức, chỉ đổi cách hợp nhất nhiều report |

---

## C. Report export theo tập xe (PNL / TRIP_LOG / VEHICLE)

| # | Nội dung | Tiền điều kiện | Bước | Kỳ vọng |
|---|---|---|---|---|
| C-01 | PNL chỉ 2/4 xe | HCM | Bước 2.5 chọn `T1, T2`, định dạng PNL | File Excel chỉ có 2 xe; tổng khớp đúng 2 xe, không lẫn `T3, T4` |
| C-02 | VEHICLE chỉ 2/4 xe | HCM | Tương tự C-01, định dạng VEHICLE | Sheet "Phương tiện" chỉ 2 dòng |
| C-03 | TRIP_LOG chỉ 2/4 xe | HCM | Tương tự, định dạng TRIP_LOG | Chỉ chuyến của 2 xe được liệt kê |
| C-04 | Bỏ qua bước 2.5 (chọn Tất cả) | HCM | Không đổi gì ở bước 2.5 | `trr_vehicle_ids = NULL`; hành vi **y hệt AS-IS** trước REQ này (không hồi quy) |
| C-05 | Tên báo cáo hiện đúng tỷ lệ xe | Tiếp C-01 | Xem danh sách `/truck/reports` | Tên có dạng "... · Khu vực HCM · 2/4 xe" |

---

## D. MONTHLY_SUMMARY — không đổi theo lựa chọn xe (GĐ-A mặc định)

| # | Nội dung | Tiền điều kiện | Bước | Kỳ vọng |
|---|---|---|---|---|
| D-01 | Chọn 2/4 xe rồi đổi định dạng sang MONTHLY_SUMMARY | HCM | Bước 2.5 chọn `T1, T2` → Bước 3 chọn định dạng MONTHLY_SUMMARY | Banner cảnh báo hiện ra; Review tự mở rộng lại đủ 4 xe; file sinh ra có KPI (`truckCount`, `avgKmPerActive`…) tính trên **toàn bộ 4 xe** — không bị ảnh hưởng bởi lựa chọn ở bước 2.5 |
| D-02 | KPI reconciliation không đổi | Tiếp D-01 | So `truckCount`/`activeCount`/`avgKmPerActive` với baseline trước khi có REQ này | Khớp 100% — MONTHLY_SUMMARY hoàn toàn không hồi quy |
| D-03 | `trr_vehicle_ids` của report MONTHLY_SUMMARY | Tiếp D-01 | Kiểm tra DB row vừa tạo | `trr_vehicle_ids = NULL` dù bước 2.5 có chọn tập con (vì bị bỏ qua theo GĐ-A) |

---

## E. Bảo mật / ACL (không hồi quy REQ-20260813/814)

| # | Nội dung | Tiền điều kiện | Bước | Kỳ vọng |
|---|---|---|---|---|
| E-01 | mgr1 (ACL chỉ HCM) không thấy khu vực khác ở bước 2 | `mgr1` | Vào wizard | Bước 2 chỉ hiện HCM, không hiện Đồng Nai/Baiksan (không hồi quy REQ-20260813) |
| E-02 | mgr1 không lập được báo cáo "Tất cả khu vực" | `mgr1` | Thử truy cập trực tiếp `?regions=ALL` | 403 (không hồi quy — hành vi đã có từ trước REQ này) |
| E-03 | DRIVER không vào được wizard | role DRIVER | Truy cập `/truck/reports/new` | Bị chặn bởi layout gate hiện có (không hồi quy) |
| E-04 | 2 màn trích xuất không đổi | `mgr1`, `mgr2` | Vào `/truck/finance`, `/truck/pnl` | Multi-select vehicle filter (REQ-20260814) hoạt động y hệt trước — không bị Phase A2 (sửa `loadTruckRegionSnapshots`) làm hỏng |

---

## F. i18n & Responsive

| # | Nội dung | Kỳ vọng |
|---|---|---|
| F-01 | 3 ngôn ngữ cho bước 2.5 + banner MONTHLY_SUMMARY | Không lộ key thô ở vi/en/ko |
| F-02 | Mobile — bước 2.5 dạng bottom sheet | Popover chuyển full-width, hàng cao 44px (nhất quán với `ParamMultiSelect`, REQ-20260814) |

---

## R. Regression bắt buộc (so sánh A/B thật — theo phương pháp REQ-20260814)

| # | Nội dung | Phương pháp | Kỳ vọng |
|---|---|---|---|
| R-01 | Dashboard không đổi số | Fingerprint trước/sau (feature → `git stash` → baseline → so sánh) | Khớp 100% khi không có report tập con nào được tạo (chỉ test path cũ) |
| R-02 | Report toàn bộ khu vực (không dùng bước 2.5) | A/B trên đúng kịch bản REQ-20260814 R02/R09 | Khớp 100% — `trr_vehicle_ids = NULL` phải tái tạo đúng hành vi cũ |
| R-03 | 2 màn trích xuất Chi phí/PNL | Lặp lại nhóm R của REQ-20260814 | Khớp 100% — Phase A2 không được phá vỡ đường đọc cũ |
| R-04 | Toàn bộ luồng fuel (trip list, finance, pnl, dashboard) sau khi Phase A2 deploy | So sánh trước/sau trên 1 tháng có ≥ 3 report lịch sử (toàn bộ + tập con trộn lẫn) | Không xe nào đổi số ngoài đúng những xe vừa được report lại |
| R-05 | Build | `tsc --noEmit`, `next lint`, `next build` | Exit 0 / không lỗi mới |

---

## Ghi chú thực thi

- **Nhóm A0 và B là điều kiện PASS bắt buộc** trước khi mở PR — đây là 2 nhóm trực tiếp giải quyết rủi ro đã bị REQ-20260814 §6.1 từ chối làm.
- Nhóm D (MONTHLY_SUMMARY không đổi) là bằng chứng cho GĐ-A — nếu người dùng phản hồi muốn MONTHLY_SUMMARY cũng lọc theo xe sau khi xem TR, đây là nhóm test đầu tiên cần viết lại.
