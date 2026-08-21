# REQ-20260822 — Tách khái niệm "Tiền dầu thực tế" (vận hành) vs "Phí nhiên liệu phân bổ" (tài chính)

> **Yêu cầu gốc (2026-08-22)**: *"cột Phí nhiên liệu ở list đúng bằng phí nhiên liệu thực tế ban đầu như ở page chuyến đi,
> còn Chi phí & Lợi nhuận thì có tính toán phân phối — để tách biệt wording và khái niệm."*

## 1. Bối cảnh — vì sao KH thấy "sai"

Cùng một chuyến (staging TR-3019, xe 50E-22222 tháng 8) hiển thị hai con số khác nhau mà **cả hai đều đúng**:

| Nơi | Số | Công thức |
|---|---|---|
| Form tạo/sửa chuyến | 300.000 ₫ | 10 L × 30.000 đ/L — tiền chuyến này thực bơm |
| Danh sách chuyến đi + Chi phí & LN (AS-IS) | 110.000 ₫ | 10 km × 11.000 đ/km — phần phân bổ từ pool tháng |

Pool tháng của xe: 3 chuyến (10 km/300.000đ · 20 km/không bơm dầu · 20 km/250.000đ) → 550.000 ₫ ÷ 50 km = 11.000 đ/km.
Chuyến chạy 20 km mà không bơm dầu vẫn phải gánh chi phí, nên phần của chuyến A giảm từ 300.000 → 110.000.

**Vấn đề không nằm ở công thức mà ở việc hai khái niệm dùng CHUNG một nhãn "Phí nhiên liệu"** ở hai màn khác nhau →
người dùng đối chiếu và kết luận hệ thống tính sai.

## 2. TO-BE — mỗi khu vực một khái niệm, nhãn nói rõ

| Khu vực | Màn | Số hiển thị | Nhãn (vi) |
|---|---|---|---|
| **VẬN HÀNH** | Danh sách chuyến đi (+ export của nó) | `trp_fuel_liters × trp_fuel_price` — bất biến, không phụ thuộc tháng/báo cáo | **"Tiền dầu thực tế"** |
| **TÀI CHÍNH** | Chi phí & Lợi nhuận (+ báo cáo, P&L, dashboard) | `km × (tiền dầu tháng của xe ÷ km tháng)` — giữ nguyên AS-IS | **"Phí nhiên liệu (phân bổ)"** |
| Cả hai | Chi tiết chuyến | **hiện cả 2 dòng**: "Nhiên liệu thực tế" và "Nhiên liệu phân bổ" | — |

Nguyên tắc: **Tổng chi phí / Lợi nhuận / báo cáo vẫn dựa trên số PHÂN BỔ** — không đổi công thức tài chính nào, nên
mọi con số tài chính và file báo cáo giữ nguyên như trước. Chỉ cột ở Danh sách chuyến đi (và export của riêng nó) đổi
nguồn sang số thực tế, kèm đổi nhãn ở cả hai phía để không thể nhầm.

Tooltip mới ở cả hai cột nói rõ cái còn lại nằm ở đâu, i18n đủ 3 ngôn ngữ (vi/en/ko).

## 3. Không thay đổi

- Công thức pool nhiên liệu, cơ chế đóng băng theo báo cáo (REQ-20260821), phân bổ CP cố định.
- Báo cáo tháng (MONTHLY_SUMMARY) và màn Chi phí & Lợi nhuận: số y hệt trước.
- DB: không migration (số thực tế đã có sẵn ở `trp_fuel_liters` / `trp_fuel_price`).

## 4. Kiểm chứng (local, 2026-08-22)

Fixture 3 chuyến giống hình dạng staging → Danh sách chuyến đi: 300.000 / 0 / 250.000 (Σ = 550.000 = tiền thật);
Chi phí & Lợi nhuận: 110.000 / 220.000 / 220.000 (Σ = 550.000). Chi tiết chuyến hiện cả hai dòng, Tổng chi phí dùng
số phân bổ. Chi tiết ở [RPT-20260822](../implementation/RPT-20260822-truck-fuel-actual-vs-allocated.md).
