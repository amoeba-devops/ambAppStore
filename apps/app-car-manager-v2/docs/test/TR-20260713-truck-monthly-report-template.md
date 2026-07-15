# TR-20260713 — Test Report: Truck Monthly Summary report

| | |
|---|---|
| **Ngày** | 2026-07-13 |
| **TC nguồn** | [TC-20260713](TC-20260713-truck-monthly-report-template.md) |
| **Phạm vi test** | Unit đối chiếu ô ↔ core + bất biến khớp tổng; typecheck; lint. E2E dữ liệu thật = mục staging (chưa chạy). |
| **Cách test** | Bundle builder bằng esbuild (stub `server-only`, external `exceljs`) → sinh `.xlsx` từ fixture nội bộ nhất quán → đọc lại bằng openpyxl (formula + cached) → assert 42 điểm. |

## Kết quả tổng
| Hạng mục | Kết quả |
|---|---|
| `tsc --noEmit` (apps/web) | ✅ PASS (exit 0) |
| `next lint` (4 file thay đổi) | ✅ PASS (no warnings/errors) |
| Unit builder — đối chiếu ô + công thức + bất biến | ✅ **42/42 PASS** |
| LibreOffice recalc (F-01/F-02) | ⚠️ N/A — `soffice.py` cần `socket.AF_UNIX`, không có trên Windows. Bù: openpyxl xác nhận **result cached hiện diện & đúng**, và chỉ dùng hàm core `SUM`/`IFERROR` (không rủi ro `#NAME?`). |
| E2E flow / PNL regression / spot-check số thật | ⏳ Pending staging (E-01…E-05, D-01…D-05) |

## Chi tiết nhóm A/B (đối chiếu ô + công thức) — PASS
Fixture: 3 xe hoạt động (2 lãi, 1 lỗ) + 1 xe bảo dưỡng; totals = Σ per-xe.
- A/B/C: C16=F43=123M · C19..C24 = 60M/5,5M/2,5M/38M/22M/3M · **C25 = `SUM(C19:C24)` = 131M** · **C28 = `C16-C25` = −8M** · C29 = `IFERROR(C28/C16,"")` = −6,5%.
- D: C32 lít=1.250 · C33 km/L=4,80 · C34 đ/km=10.000.
- KPI: B12="4 xe" · D12(link `D43`)=120 · F12(link `E43`)=6.000 · H12(link `C28`)=−8M.

## Chi tiết nhóm C (bảng xe) — PASS
- Xe hoạt động: J=`F−G` (formula), K=`IFERROR(J/F,"")`, trạng thái "Có lãi"/"Lỗ" đúng dấu net.
- **Xe bảo dưỡng**: D/E/F/H/I = "—"; G = chi phí cố định 15M; **J = số literal −15M (không formula, vì F là "—")**; K="—"; L="Bảo dưỡng"; cột "Xe / Tài xế" = "Phạm Văn D · Thaco Auman" (tài xế + tên xe, B46).
- Dòng TỔNG: D/E/F/G/H/J = `SUM(...)`; F=123M, G=131M, J=−8M.

## Bất biến vàng — PASS
- `F42 (Σ doanh thu) == C16 == 123M`
- `G42 (Σ chi phí) == C25 == 131M`
- `J42 (Σ lợi nhuận) == C28 == H12 == −8M`
- `C28 == C16 − C25`

→ Dòng TỔNG bảng E khớp tuyệt đối khối A/B/C ⇒ yêu cầu "mỗi ô đúng số & tổng khớp" đạt.

## Còn lại (đề nghị chạy trên staging trước khi prod)
1. **E-01 PNL regression**: regen 1 báo cáo PNL cũ cùng tháng/khu vực → xác nhận file & số không đổi (nhánh `includeIdle=false`). Typecheck đã xác nhận builder PNL cũ vẫn nhận type mở rộng; cần xác nhận byte/số trên dữ liệu thật.
2. **D/E**: sinh MONTHLY_SUMMARY trên tháng có dữ liệu thật (có xe bảo dưỡng, có/không hóa đơn xăng) → spot-check số so màn finance.
3. **E-04**: `/truck/reports` hiển thị "Tổng kết chi phí tháng · Khu vực …", tải mở đúng.
4. **F-02**: mở file bằng Excel/LibreOffice thật, sửa 1 ô input → `SUM`/`IFERROR` tự tính lại.

## Kết luận
Lõi tính số + layout + công thức **đạt tiêu chí PASS chính** (nhóm A/B + bất biến). Sẵn sàng cho E2E staging.
