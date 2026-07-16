# TC-20260629 — Truck: mô hình tài chính cuối tháng + Chi phí&Lợi nhuận per-trip + Báo cáo

> Nguồn: [REQ-20260629](../analysis/REQ-20260629-truck-monthend-finance-reports.md) · [PLAN-20260629](../plan/PLAN-20260629-truck-monthend-finance-reports.md).
> Precondition chung: user ADMIN hoặc MANAGER có **TRUCK** fleet access; DB đã apply migration `0016`. Có ≥1 xe tải + vài chuyến LOG **COMPLETED** trong tháng test.

## TC-01: Tháng mở — phí xăng/lợi nhuận là "Tạm tính"

| # | Bước | Kết quả kỳ vọng |
|---|------|----------------|
| 1 | Tạo vài chuyến truck COMPLETED trong tháng hiện tại (chưa chốt) | Chuyến lưu OK |
| 2 | Vào `/truck/finance` (tháng đó) | Mỗi chuyến 1 dòng; cột Đơn giá/Lít/Phí xăng/Lợi nhuận hiện **số tạm tính** (in nghiêng/mờ) + badge **Tạm tính** (amber) |
| 3 | Vào `/truck/trips` | Cột Lợi nhuận có nhãn **Tạm tính** dưới số |
| 4 | Vào `/truck/dashboard` (kỳ chứa tháng mở) | Banner amber "...số tạm tính" + nút "Đi chốt tháng →" |

---

## TC-02: Chốt tháng → snapshot + chuyển "Đã chốt"

**Precondition**: tháng có ≥1 hoá đơn xăng (tab Hoá đơn) + chuyến có odometer (Σkm > 0).

| # | Bước | Kết quả kỳ vọng |
|---|------|----------------|
| 1 | `/truck/pnl?tab=invoices` → thêm 2 hoá đơn: 100L@20.000, 140L@20.000 | Card "Tổng hợp cuối tháng": Σlít=240, giá BQ=**20.000** (trung bình cộng đơn giá, KHÔNG theo lít) |
| 2 | Giả sử Σkm tháng = 40.000 | Định mức = 240÷40.000 = **0.006 L/km** |
| 3 | Nhấn "Chốt tháng" → xác nhận | Badge → **Đã chốt**; snapshot ghi vào `car_truck_month_close` (tmc_avg_price, tmc_consumption, tmc_total_liters, tmc_total_km) |
| 4 | Quay lại `/truck/finance` | Chuyến chuyển **Đã chốt** (xanh); phí xăng/chuyến = `km × 0.006 × 20.000`; Σ phí xăng = 240×20.000 = **4.800.000** |
| 5 | 1 chuyến 500km | Phí xăng chuyến = 500×0.006×20.000 = **60.000** |

---

## TC-03: P&L tháng dùng snapshot khi đã chốt

| # | Bước | Kết quả kỳ vọng |
|---|------|----------------|
| 1 | `/truck/pnl?tab=overview`, tháng đã chốt | Dòng "Phí xăng dầu" = Σ(km×định mức×giá BQ) (snapshot), KHÔNG phải Σ(lít×giá nhập/chuyến) |
| 2 | So với tháng mở kế bên | Tháng mở vẫn = liters×price (tạm tính) |
| 3 | Lợi nhuận ròng | = Doanh thu − biến đổi − cố định, dùng phí xăng snapshot |

---

## TC-04: Mở lại tháng = ADMIN-only + bắt buộc lý do

| # | Bước | Kết quả kỳ vọng |
|---|------|----------------|
| 1 | MANAGER mở `/truck/pnl?tab=invoices` (tháng đã chốt) | KHÔNG thấy nút "Mở lại"; thấy hint "Chỉ Quản trị viên mới được mở lại" |
| 2 | MANAGER gọi `reopenTruckMonthAction` trực tiếp | Server chặn **CAR-E0102** (Forbidden) |
| 3 | ADMIN nhấn "Mở lại" → để trống lý do | Nút disabled (cần ≥3 ký tự) |
| 4 | ADMIN nhập lý do "Bổ sung hoá đơn sót" → Mở lại | Badge → Đang mở; ghi audit `TRUCK_MONTH.REOPENED`; mục "Lịch sử điều chỉnh" hiện entry + lý do + thời gian |
| 5 | Re-close lại | Snapshot tính lại từ dữ liệu hiện tại |

---

## TC-05: Chốt tháng KHÔNG có hoá đơn → fallback (không zero hoá)

| # | Bước | Kết quả kỳ vọng |
|---|------|----------------|
| 1 | Tháng có chuyến nhưng **0 hoá đơn** → Chốt tháng | Snapshot để **NULL** (avg/consumption) |
| 2 | `/truck/finance` + `/truck/pnl` tháng đó | Phí xăng = **liters×price** (giữ số cũ), không bị về 0 |

---

## TC-06: Tương thích ngược — tháng chốt trước 0016

| # | Bước | Kết quả kỳ vọng |
|---|------|----------------|
| 1 | Tháng đã chốt từ trước (snapshot NULL) | P&L + finance dùng fallback liters×price; số liệu cũ **không đổi** |

---

## TC-07: P&L 2 tab

| # | Bước | Kết quả kỳ vọng |
|---|------|----------------|
| 1 | `/truck/pnl` | 2 tab: "Tổng quan P&L" (mặc định) + "Hoá đơn & Chốt tháng" (chấm amber nếu tháng mở) |
| 2 | Tab Tổng quan | Card **Chi phí biến đổi** (xăng/cầu đường/phát sinh) + **Chi phí cố định** (lương/khấu hao/bảo hiểm/lương tài xế) + bảng P&L 3 tháng |
| 3 | Banner tạm tính | Hiện khi kỳ có tháng chưa chốt |
| 4 | Đổi tháng / lọc xe | Giữ nguyên tab đang chọn |

---

## TC-08: Màn per-trip "Chi phí & Lợi nhuận"

| # | Bước | Kết quả kỳ vọng |
|---|------|----------------|
| 1 | `/truck/finance` | 7 summary cards (Doanh thu/Xăng/Cầu đường/Phát sinh/Lương tài xế/Chi phí cố định/**Lợi nhuận ròng**) + bảng per-trip |
| 2 | Lọc theo 1 xe (chip) | Bảng + summary lọc đúng xe |
| 3 | Nút "Xuất Excel" | Tải file `truck-finance-{month}.xlsx` đúng cột + cột Trạng thái (Tạm tính/Đã chốt) |
| 4 | Click 1 dòng | Điều hướng `/truck/trips/{id}` |

---

## TC-09: Số liệu lợi nhuận NHẤT QUÁN giữa các màn

| # | Bước | Kết quả kỳ vọng |
|---|------|----------------|
| 1 | Chọn 1 chuyến thuộc tháng **đã chốt** | Lợi nhuận chuyến trên `/truck/finance` = trên `/truck/trips` = trong "Chuyến gần đây" của dashboard (đều dùng snapshot) |
| 2 | 1 chuyến thuộc tháng **mở** | Cả 3 màn đều = liters×price (tạm tính), khớp nhau |

---

## TC-10: Lập báo cáo (3 loại) → S3 → danh sách

| # | Bước | Kết quả kỳ vọng |
|---|------|----------------|
| 1 | `/truck/reports/new` → chọn tháng, tick cả 3 loại → "Lập báo cáo" | Tạo 3 `car_truck_reports` rows; file Excel upload S3 (`truck-reports/{ent}/{month}/...`); điều hướng về danh sách |
| 2 | `/truck/reports` | 3 báo cáo nhóm theo tháng, mỗi dòng có badge **Mới**, người tạo, thời gian |
| 3 | File PNL | 1 sheet: các dòng P&L (doanh thu→lợi nhuận ròng) |
| 4 | File TRIP_LOG / VEHICLE | Đúng cột per-trip / per-xe |

---

## TC-11: Tải báo cáo (presigned)

| # | Bước | Kết quả kỳ vọng |
|---|------|----------------|
| 1 | Nhấn "Tải" 1 báo cáo | Redirect 307 → presigned S3 URL → file tải về |
| 2 | GET `/truck/reports/{id-không-tồn-tại}/download` | 404 |
| 3 | GET download khi chưa đăng nhập | 307 về login (middleware) |

---

## TC-12: Badge "Mới" (DB-backed) — nav + per-row

| # | Bước | Kết quả kỳ vọng |
|---|------|----------------|
| 1 | Sau khi lập báo cáo mới, chưa mở danh sách | Nav "Danh sách báo cáo" có badge count = số báo cáo mới |
| 2 | Mở `/truck/reports` | Dòng mới có badge "Mới"; `usr_truck_reports_seen_at` cập nhật |
| 3 | Điều hướng đi rồi quay lại nav | Badge count nav = 0 (đã xem) |
| 4 | User KHÁC (chưa xem) | Vẫn thấy badge (seen-at theo từng user) |

---

## TC-13: Khoá kỳ (regression) — không sửa chuyến tháng đã chốt

| # | Bước | Kết quả kỳ vọng |
|---|------|----------------|
| 1 | Sửa/tạo/xoá/hoàn thành 1 chuyến thuộc tháng **đã chốt** | Chặn **CAR-E1002** (Financial month is closed) |
| 2 | Thêm hoá đơn xăng vào tháng đã chốt | Bị chặn / form khoá |

---

## TC-14: i18n 3 ngôn ngữ

| # | Bước | Kết quả kỳ vọng |
|---|------|----------------|
| 1 | Đổi locale vi/en/ko | Các màn `/truck/finance`, `/truck/pnl` (2 tab), `/truck/reports`, `/truck/reports/new` + nav (Chi phí & Lợi nhuận, P&L tháng & Chốt sổ, Lập báo cáo, Danh sách báo cáo) đều dịch đủ, không lộ key |

---

## Checklist sau implement
- [ ] Migration `0016` đã apply (local ✓ / ep-noisy-heart khi deploy staging-car-truck / **KHÔNG** ep-gentle-rain).
- [ ] Snapshot tính đúng (giá BQ = mean đơn giá; định mức = Σlít hoá đơn ÷ Σkm completed).
- [ ] Reopen ADMIN-only (UI + server).
- [ ] Số LN nhất quán finance/trips/dashboard.
- [ ] Báo cáo 3 loại generate → S3 → tải về OK.
- [ ] Badge "Mới" theo `usr_truck_reports_seen_at`.
- [ ] i18n vi/en/ko đủ.
