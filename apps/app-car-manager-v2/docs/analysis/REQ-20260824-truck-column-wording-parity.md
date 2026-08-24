# REQ-20260824 — Một tên gọi cho một khái niệm: template · import · danh sách chuyến · export

> **Yêu cầu (2026-08-24)**: *"scan lại ở ngoài list chính show nữa, để consistent giữa 3 file template,
> import, export, và list show ở UI"* — sau khi phát hiện nhập lại chính file xuất thì app map sai cột.

## 1. Hiện trạng đo được (trước khi sửa)

Quét cùng một khái niệm trên 4 bề mặt, cả 3 ngôn ngữ:

| Ngôn ngữ | Khái niệm nhất quán |
|---|---|
| vi | **8/24** |
| en | **5/24** |
| ko | **4/24** |

Ví dụ tiêu biểu — cùng một thứ, bốn cách gọi:

| Khái niệm | Template | Import UI | List UI | Export |
|---|---|---|---|---|
| Odo đầu | Km đầu | Đồng hồ đầu | — | ODO đầu (km) |
| Chi phí khác | Chi phí khác | Phát sinh khác | Chi phí phát sinh | Phí khác (đ) |
| Giờ bắt đầu | Giờ bắt đầu | Giờ bắt đầu | — | Giờ BĐ |
| Số BOL | Số BOL | Số BOL | — | Số Bill |

**Hậu quả đã chứng minh trên staging**: thả file xuất vào màn Import → auto-map **sai 9/17 cột** (vi),
15/17 (ko) mà vẫn báo "4 dòng hợp lệ" và cho bấm Nhập. Thủ phạm kép: (a) nhãn không khớp nên từ khoá
không nhận ra, (b) khi không nhận ra thì app **gán đại theo vị trí cột của template** — sai âm thầm.
Ngoài ra file xuất **thiếu hẳn cột "Điểm ghé"** dù template có.

## 2. Giải pháp

**Một glossary duy nhất** `columns.truck` (i18n, 3 ngôn ngữ) làm nguồn nhãn cho **cả 4 bề mặt** — cộng
bề mặt thứ 5 phát hiện thêm là **form nhập chuyến**. Nguyên tắc: *từ gốc giống hệt nhau; chỉ đơn vị
đặt trong ngoặc mới được khác theo bề mặt* (file cần "(đ)", "(L)", "(km)"; màn hình thì không).

| Khái niệm | vi | en | ko |
|---|---|---|---|
| Odo đầu/cuối | Km đầu / Km cuối | Start ODO / End ODO | 시작 주행 / 종료 주행 |
| Chi phí phát sinh | Chi phí phát sinh | Other cost | 기타 비용 |
| Ghi chú phát sinh | Ghi chú phát sinh | Other note | 기타 메모 |
| Giờ bắt đầu/kết thúc | Giờ bắt đầu / Giờ kết thúc | Start time / End time | 시작 시간 / 종료 시간 |
| Xe · Tài xế · Khu vực | Xe · Tài xế · Khu vực | Vehicle · Driver · Region | 차량 · 기사 · 지역 |
| Điểm lấy/ghé/giao hàng | Điểm lấy hàng · Điểm ghé · Điểm giao hàng | Pickup · Waypoint · Drop-off | 상차지 · 경유지 · 하차지 |
| Số BOL · Số CDF | Số BOL · Số CDF | BOL No. · CDF No. | BOL 번호 · CDF 번호 |
| Doanh thu | Doanh thu | Revenue *(bỏ "Selling")* | 매출 |
| Tổng km | Tổng km | Total km | 총 주행 |

Giữ nguyên **"Phí nhiên liệu thực tế"** ⇄ **"Phí nhiên liệu (phân bổ)"** — hai khái niệm khác nhau đã
chốt ở REQ-20260822, không phải lệch chữ.

Kèm theo:
- **Template được i18n hoá** — trước đây header luôn tiếng Việt kể cả khi tải bản en/ko.
- **Thêm cột "Điểm ghé"** vào file xuất (26 cột) để nhập lại không mất dữ liệu.
- **Bỏ đoán theo vị trí**: chỉ dùng thứ tự template khi hàng tiêu đề *không nhận ra được gì*; nếu đã
  nhận ra ≥1 cột thì phần còn lại để trống cho người dùng tự chọn — thà bắt chọn tay còn hơn map nhầm.
- **Bảng alias** (`TRUCK_IMPORT_ALIASES`) phủ nhãn chuẩn của cả 3 ngôn ngữ + **wording cũ**, để file
  làm từ template cũ vẫn nhập được. Có danh sách **phủ định** để "Phí nhiên liệu" (tiền) không còn bị
  nhận nhầm là "Lượng nhiên liệu" (lít).

## 3. Kết quả

| Kiểm chứng | Trước | Sau |
|---|---|---|
| Round-trip xuất → nhập lại (vi) | 8/17 cột đúng | **17/17** |
| Round-trip (en) | 10/17 | **17/17** |
| Round-trip (ko) | 2/17 | **17/17** |
| Template theo ngôn ngữ | chỉ vi | **vi/en/ko** |
| Cột "Điểm ghé" trong file xuất | thiếu | **có** |
| File làm từ template CŨ | nhập được | **vẫn nhập được** (regression pass) |

Chi tiết thực thi: [RPT-20260824](../implementation/RPT-20260824-truck-column-wording-parity.md).
