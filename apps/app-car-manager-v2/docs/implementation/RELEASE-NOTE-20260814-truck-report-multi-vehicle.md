# RELEASE NOTE — 2026-08-14: Truck Finance/PNL export — bộ lọc xe multi-select

```yaml
document_id: V2-NOTE-20260814-REPORT-MULTI-VEHICLE
branch: feature/truck-report-multi-vehicle
liên_quan:
  - docs/implementation/RPT-20260814-truck-report-multi-vehicle.md
  - docs/test/TR-20260814-truck-report-multi-vehicle.md
audience: Admin/Manager dùng module Truck (Chi phí & Lợi nhuận), đội vận hành/support
```

## Tóm tắt

Bản này thêm khả năng chọn **nhiều xe cùng lúc** (trước đây chỉ chọn 1 xe hoặc "Tất cả") ở 2 màn:
- **Chi phí & Lợi nhuận** (`/truck/finance`)
- **Tổng quan P&L** (`/truck/pnl`)

Đi kèm là **2 thay đổi hành vi có chủ đích** ở file xuất — cần đọc kỹ trước khi thông báo cho người dùng, vì nhìn bề ngoài giống "file bị thiếu dữ liệu" nhưng thực ra là sửa đúng.

## Thay đổi 1 — `/truck/finance/export` giờ áp bộ lọc khu vực (ACL)

**Trước đây:** endpoint xuất Excel không kiểm tra khu vực được phép của người dùng. Một Manager bị giới hạn chỉ xem khu vực HCM vẫn tải được file chứa **toàn bộ khu vực** (kể cả Đồng Nai, Baiksan…) — đây là lỗ hổng bảo mật, không phải tính năng.

**Bây giờ:** file xuất chỉ chứa xe/chuyến thuộc khu vực người dùng được cấp quyền, khớp với những gì họ thấy trên màn hình.

**Ảnh hưởng:** người dùng bị giới hạn khu vực (vd Manager gán riêng 1 khu vực) sẽ thấy file xuất **ít dòng hơn trước**. Đây là **sửa lỗ hổng**, không phải regression — nếu có ai hỏi "sao file thiếu dữ liệu", trả lời: dữ liệu ngoài khu vực chưa từng thuộc quyền xem của họ, chỉ là trước đây bị lộ ra do thiếu guard.

## Thay đổi 2 — `/truck/pnl/export` giờ áp đúng bộ lọc xe đang chọn trên màn hình

**Trước đây:** dù màn `/truck/pnl` đang lọc theo 1 xe cụ thể, nút xuất luôn trả về **toàn bộ xe trong khu vực**, bỏ qua bộ lọc đang chọn.

**Bây giờ:** file xuất khớp với đúng tập xe đang chọn trên màn hình (1 xe / nhiều xe / tất cả). Khi chọn nhiều xe, PDF/Excel hiển thị **1 cột cho mỗi xe + 1 cột TỔNG** (PDF tự xoay ngang nếu quá 6 cột).

**Ảnh hưởng:** người dùng đã quen "xuất luôn ra cả khu vực bất kể đang lọc gì" sẽ thấy file giờ nhỏ hơn nếu họ đang lọc ít xe — đây là **sửa đúng theo kỳ vọng UI**, không phải bug mới.

## Không đổi

- Wizard chốt sổ báo cáo tháng (`/truck/reports/new`) — vẫn giữ nguyên granularity theo khu vực/toàn bộ xe, không có bước chọn xe (đã regression-test riêng, xem TR §3.3 R03/R03b).
- Tên file xuất, cấu trúc cột chuẩn (13 cột finance / KPI PDF khi 1 xe), template `MONTHLY_SUMMARY`.
- Dropdown Khu vực/Trạng thái (`ParamSelect`) trên mọi màn.

## Trước khi thông báo rộng

- **R04 (snapshot đóng băng đúng lúc lập báo cáo) và R07 (file `MONTHLY_SUMMARY` không đổi) chưa chạy được ở dev** (giới hạn môi trường — không bấm được nút "Lập báo cáo" qua UI). **Bắt buộc chạy lại trên staging** ngay sau khi deploy, trước khi cân nhắc note này áp dụng cho production.
