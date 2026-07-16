# TR-20260629 — Test report: Truck month-end finance + reports

| | |
|---|---|
| **Ngày** | 2026-06-29 |
| **Nguồn** | [TC-20260629](TC-20260629-truck-monthend-finance-reports.md) · [REQ](../analysis/REQ-20260629-truck-monthend-finance-reports.md) · [PLAN](../plan/PLAN-20260629-truck-monthend-finance-reports.md) |
| **Môi trường** | Local dev (Next 15, port 3099), DB `0016` đã apply local (ep-steep-tooth); phiên ADMIN qua `/dev-login?role=OWNER`. |
| **Phương pháp** | (1) `tsc --noEmit` cho `packages/core`, `packages/db`, `apps/web` sau mỗi pha. (2) Smoke test runtime: dev server thật + curl có cookie phiên → kiểm HTTP status + marker DOM (không dùng unit test). |

## 1. Tổng quan kết quả

| Hạng mục | Kết quả |
|---|---|
| Typecheck (core + db + web) — sau mỗi pha A→E | ✅ exit 0, không lỗi |
| Smoke runtime các màn mới/sửa | ✅ 200, không error-boundary |
| Functional E2E với **dữ liệu thật** | ⏳ **chờ test local** (xem §3) |

## 2. Đã verify (static + smoke)

| TC | Phạm vi verify được | Kết quả |
|---|---|---|
| — | `tsc` core/db/web mọi pha | ✅ exit 0 |
| TC-07 | `/truck/pnl?tab=overview` & `?tab=invoices` render 200; marker: tab labels, banner "tạm tính"+"Đi chốt tháng", card biến-đổi/cố-định, "Tổng hợp cuối tháng", công thức "định mức × km × giá bình quân" | ✅ |
| TC-08 | `/truck/finance` render 200; marker: tiêu đề, "Tất cả phương tiện", summary "Doanh thu tháng"/"Lợi nhuận ròng", cột "Trạng thái", badge "Tạm tính"/"Đã chốt"; empty-state khi không có chuyến | ✅ (render) |
| TC-10 | `/truck/reports` (list, empty-state) + `/truck/reports/new` (3 loại: PNL/TRIP_LOG/VEHICLE) render 200 | ✅ (render) |
| TC-11 | Download route: `{id}` không tồn tại (đã auth) → **404**; chưa auth → **307** (middleware deflect) | ✅ |
| TC-14 | Các màn render với locale mặc định vi, không lộ i18n key (đã thêm key vi/en/ko + prettier canonical) | ✅ (vi) |
| TC-13 | Khoá kỳ `CAR-E1002` — logic giữ nguyên từ REQ-20260623 (regression, không sửa) | ✅ (không đổi) |

## 3. Chưa verify — cần test local với dữ liệu thật

Demo entity (`...010`) không có chuyến truck → các path phụ thuộc dữ liệu + tương tác (server action / nút bấm) chưa chạy E2E. **Khuyến nghị test theo TC tương ứng:**

| TC | Lý do chưa verify | Cách test local |
|---|---|---|
| TC-01/02/03 | cần chuyến + hoá đơn thật | Tạo vài chuyến COMPLETED + hoá đơn → xem Tạm tính → Chốt → Đã chốt, đối chiếu công thức (TC-02 §4-5) |
| TC-04 | cần phiên MANAGER + tháng đã chốt | MANAGER không thấy nút Mở lại; ADMIN reopen có lý do → lịch sử điều chỉnh |
| TC-05/06 | cần tháng không hoá đơn / tháng chốt cũ | Kiểm fallback liters×price |
| TC-09 | cần chuyến tháng đã chốt | Đối chiếu LN finance = trips = dashboard |
| TC-10/11/12 | server action + S3 + browser | Lập 3 báo cáo → S3 → tải về; badge "Mới" nav/per-row |

## 4. Ghi chú
- Migration `0016` mới ở **local**. Khi deploy staging-car-truck → apply **ep-noisy-heart** (không ep-gentle-rain).
- Pipeline báo cáo dùng S3 thật (4/4 AWS env có ở local + deploy).
- Verdict tạm: **PASS (static + smoke)**; **PENDING** functional E2E do người dùng nghiệm thu local.
