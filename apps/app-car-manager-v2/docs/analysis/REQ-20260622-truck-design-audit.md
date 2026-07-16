# REQ-20260622 — Audit: Truck Manager design ↔ bản đã build

| | |
|---|---|
| **Ngày** | 2026-06-22 |
| **Design nguồn** | `Truck Manager.html` (Claude Design "bundled page", project `3713644d-…`) |
| **Cách đọc** | Bundle không greppable trực tiếp → giải nén manifest (gzip+base64) → unescape template → trích `text/x-dc` design script (`design.dc.js`, 924 dòng, `class Component`, `state.dept='truck'`). |
| **Đối chiếu** | `apps/web/src/app/(app)/truck/**` + `components/layout/nav-items.ts` |

---

## 1. Kiến trúc thông tin design (TRUCK)

Design là 1 prototype tương tác, dept switch **Xe con (CCMS) / Xe tải**, theme cam `#C2410C`. Phòng Xe tải có **6 màn** (`state.screen`): `dashboard · trips · trucks · monthly · drivers · import`, kèm **bộ chọn kỳ** đa cấp (Tuần / Tháng / Năm / Toàn bộ Q4) + role labels `Quản trị viên · Quản trị · Quản lý · Tài xế`.

## 2. Đối chiếu theo màn

| Design (Xe tải) | Built (`/truck/*`) | Trạng thái | Ghi chú |
|---|---|---|---|
| **Tổng quan** (dashboard): KPI + biểu đồ lợi nhuận theo tháng + donut cơ cấu chi phí + **bộ chọn kỳ (Tuần/Tháng/Năm/Toàn bộ)** + **so sánh nhiều tháng** + **bảng TOP người dùng** | `truck/dashboard` | ⚠️ **Một phần** | Có: KPI, profit bar, cost donut, fleet status. **Thiếu**: bộ chọn kỳ đa cấp (đang chỉ theo tháng), cột so sánh nhiều tháng, **bảng TOP** (topUsersBars). |
| **Nhật ký chuyến** (trips): KH, BOL, CDF, điểm đón/đến, NL(L), cầu đường, phát sinh, doanh thu, LN, tài xế, trạng thái + sửa/xoá | `truck/trips` (+new/[id]/edit/export) | ✅ **Đã follow** | Đủ cột (BOL/CDF/fuel/toll/other/revenue/profit) + export Excel + chi tiết + sửa/xoá. |
| **Đội xe** (trucks): biển số, mẫu xe, màu, **định mức L/km**, odometer, **trạng thái dầu** (Quá hạn / Sắp đến hạn / Còn X km), tải trọng | `truck/fleet` (+CRUD) | ✅ **Đã follow** | Có định mức + oil status + tonnage + CRUD. |
| **Chi phí & Lợi nhuận** (monthly): P&L theo kỳ + chi phí cố định (lương/khấu hao) + **CHỐT SỔ THÁNG** (Đang mở → Đã chốt, mở lại có lý do) | `truck/pnl` **+** `truck/settings` (tách 2 màn) | ⚠️ **Khác + thiếu** | Built tách P&L (pnl) và chi phí cố định (settings). **Thiếu hẳn**: workflow **chốt/mở lại sổ tháng** (OPEN/CLOSED, reopen reason). |
| **Tài xế** (drivers): roster theo phòng + vai trò + trạng thái (Hoạt động/Tạm nghỉ/Ngừng/Vô hiệu) | dùng chung `/drivers` (CCMS) | ⚠️ **Khác** | Truck nav không có mục Tài xế riêng; đang mượn danh sách tài xế chung của CCMS. |
| **Import** Excel | `truck/import` | ✅ **Đã follow** | Template + upload + preview + import. |
| Dept switch Xe con/Xe tải + theme cam | `dept-switch` + sticky workspace | ✅ **Đã follow** | (kèm fix nhảy BUG-260622). |
| Role labels Quản trị viên/Quản trị/Quản lý | B1 dept-admin label | ✅ **Khớp hướng** | Design cũng phân "Quản trị" (phòng) vs "Quản trị viên" — đúng hướng B1 vừa làm. |

## 3. Danh sách GAP (ưu tiên)

| # | Gap | Mức | Cần schema? | Effort |
|---|---|---|---|---|
| G1 | **Chốt sổ tháng** (month close/reopen): trạng thái OPEN/CLOSED mỗi tháng/xe-phòng, nút Chốt, Mở lại + lý do, số liệu "chốt" cố định | 🔴 Lớn | **Có** (bảng `car_truck_month_close` hoặc cột status) | Cao |
| G2 | **Dashboard — bộ chọn kỳ đa cấp** (Tuần/Tháng/Quý/Năm/Toàn bộ) + **so sánh nhiều tháng** | 🟠 Vừa | Không | Vừa |
| G3 | **Dashboard — bảng TOP** (top người dùng/tài xế/xe theo doanh thu/lợi nhuận/số chuyến) | 🟡 Nhỏ | Không | Thấp |
| G4 | **Gộp "Chi phí & Lợi nhuận"** = P&L + chi phí cố định (+ chốt sổ) thành 1 màn theo design IA (thay vì pnl + settings tách rời) | 🟠 Vừa | Không | Vừa |
| G5 | **Màn Tài xế theo phòng Xe tải** (roster + vai trò + trạng thái), thêm vào truck nav | 🟡 Nhỏ | Không (lọc fleet) | Thấp |

## 4. Đã follow đúng (không cần sửa)

Trips log (đủ cột + export + CRUD) · Đội xe (định mức + oil status + tonnage + CRUD) · Import · dept switch + theme cam · dashboard KPI/profit-bar/cost-donut · role labels.

## 5. Đề xuất triển khai (phân pha)

- **Pha 1 (nhanh, không schema):** G3 (bảng TOP) + G2 (bộ chọn kỳ + so sánh tháng) + G5 (màn Tài xế truck). Nâng fidelity dashboard sát design.
- **Pha 2 (cần schema):** G1 chốt sổ tháng + G4 gộp màn Chi phí & Lợi nhuận. Đây là feature nghiệp vụ thật (đóng sổ) → cần REQ/PLAN + migration riêng.

> Khuyến nghị làm Pha 1 trước (sát design ngay, rủi ro thấp), Pha 2 mở REQ riêng vì đụng schema + nghiệp vụ đóng sổ.
</content>
