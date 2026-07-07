# PLAN-20260707 — Lập báo cáo tính lại & phân bổ số liệu theo công thức chốt sổ

> **Yêu cầu**: Khi **Lập báo cáo** phải chạy đúng bộ công thức tính toán của **chốt sổ** cũ (phân bổ xăng theo bình quân khu vực). **Mỗi lần lập lại báo cáo → tính lại số mới** theo dữ liệu hiện hành. Không còn khái niệm khóa sổ thủ công.
>
> Trạng thái: **ĐÃ IMPLEMENT & VERIFY E2E TRÊN LOCAL (2026-07-07)** — typecheck 5/5 pass, luồng lập BC/lập lại/stale/phân bổ kiểm chứng bằng dev server + DB steep-tooth (chi tiết: docs/log/2026-07-07/11_01). 3 câu hỏi mở đã chốt: (1) KHÔNG khóa — cảnh báo mềm; (2) XÓA vỏ chốt sổ cũ; (3) BC tất-cả-khu-vực giữ logic hiện tại.
> Còn lại khi deploy staging: chạy migration 0021 trên ep-noisy-heart + quyết định dọn legacy close BAIKSAN (mục 7) — cần user cho phép ghi DB.

---

## 1. Hiện trạng & bộ công thức chốt sổ (đã xác minh trong code)

### 1.1 Bộ công thức (giữ nguyên 100%, chỉ đổi thời điểm chạy)

| # | Công thức | Vị trí code |
|---|---|---|
| F1 | **Giá bình quân** (đ/L) = trung bình cộng đơn giá các hóa đơn xăng của (tháng, khu vực) — trung bình đơn giản, không trọng số lít | `getTruckFuelStats` — truck-finance.queries.ts:160 |
| F2 | **Tổng lít** = Σ lít các hóa đơn (tháng, khu vực) | :161 |
| F3 | **Tổng km** = Σ (km cuối − km đầu) các chuyến LOG COMPLETED của (tháng, khu vực) | :159 |
| F4 | **Mức tiêu hao** (L/km) = F2 ÷ F3 (khi F3 > 0) | :167 |
| F5 | **Điều kiện snapshot hợp lệ**: totalKm > 0 AND lít > 0 AND giá bình quân > 0; không đạt → giữ fallback | `closeTruckMonthAction` — truck-finance.actions.ts:46 |
| F6 | **Xăng mỗi chuyến** = round(km chuyến × F4 × F1); km ≤ 0 → 0. Hiển thị: Lít = km × F4, Đơn giá = F1 | `truckTripFuelCost` — packages/core truck-cost.ts:59 |
| F7 | **Lợi nhuận chuyến** = doanh thu − F6 − cầu đường − Σ phát sinh | listTruckFinanceTrips :381 |
| F8 | **P&L tháng** = doanh thu − (xăng+cầu đường+phát sinh) − (lương+khấu hao+bảo hiểm+lương tài xế); có fallback chi phí cố định từ xe (khấu hao xe + lương tài xế mặc định) khi tháng không có dòng chi phí cố định | `computeTruckPnl` — truck-pnl.service.ts |
| F9 | **Đối soát**: Σ xăng phân bổ toàn khu vực = F2 × F1 (tự thỏa từ F4+F6 vì cùng tập chuyến) | comment :129-137 |
| F10 | **Fallback** khi không có snapshot: xăng chuyến = lít tự nhập × đơn giá tự nhập | listTruckFinanceTrips :364, `computeTruckCost` |
| F11 | **Quy ước làm tròn**: tiền → đồng nguyên (round từng chuyến); consumption lưu 6 số lẻ (numeric 10,6); lít hiển thị/xuất 1 số lẻ; giá bình quân round đồng ngay khi tính | stats :160, truck-cost.ts:66, workbook |
| F12 | **Snapshot NULL hợp lệ** (F5 fail): close row vẫn tạo (tháng khóa) nhưng mọi chuyến giữ F10 + style "Tạm tính" | loadTruckRegionSnapshots :58 |

### 1.1b Toàn bộ nơi áp dụng số snapshot (qua 1 hàm chung `loadTruckRegionSnapshots`)

| # | Màn/luồng | Query | Ghi chú |
|---|---|---|---|
| 1 | Chi phí & LN theo chuyến (+ export) | `listTruckFinanceTrips` | unitPrice/liters/fuel/profit + finalized |
| 2 | Danh sách chuyến /truck/trips (+ export) | `listTruckTrips` (truck-trips.queries.ts:157-199) | breakdown + finalized per row |
| 3 | P&L 3 tháng + Dashboard KPI/biểu đồ | `computeTruckPnl` | fuel tháng = Σ F6 per trip |
| 4 | File Excel báo cáo PNL 3-sheet | `getTruckReportExport` | per-trip + per-vehicle + totals |
| 5 | Bước 3 Lập BC | `getTruckReportReview` ← (1) | tổng theo xe + fixedCost |

**⚠️ GAP hiện hữu — 2 trang chi tiết chuyến KHÔNG áp snapshot** (dùng `computeTruckCost` thô): `/trips/[id]/page.tsx:74` và `/truck/trips/[id]/page.tsx:25` → tháng đã chốt/đã BC hiển thị xăng & lợi nhuận **lệch** với mọi màn khác. Phải sửa trong scope này (S1.5).

### 1.1c Hành vi khóa & guard của chốt sổ (đầy đủ)

| Điểm khóa | Vị trí | Ghi chú |
|---|---|---|
| 7 action ghi chuyến (tạo/gán/hoàn thành/patch/sửa ngày cũ+mới/xóa) | truck-trip.actions.ts :101/:198/:237/:285/:328-329/:417/:478 | qua `assertTruckMonthOpen` (region-aware) |
| Import Excel chuyến | import.actions.ts:62 | region-aware |
| Thêm hóa đơn xăng | truck-finance.actions.ts:142 | region-aware |
| **Xóa hóa đơn xăng — KHÔNG guard** | deleteFuelInvoiceAction | 🐞 lỗ hổng hiện hữu: tháng chốt vẫn xóa được hóa đơn |
| Chi phí cố định upsert | truck-fixed-cost.actions.ts:26 | 🐞 chỉ check whole-fleet close (region null) → tháng chốt theo khu vực vẫn sửa được fixed cost → P&L "đã chốt" vẫn đổi được |
| Bước 3 review khu vực closed | report-review-step:92 + getTruckReportReview `closed` | read-only + skip patch |
| Mở lại tháng | reopenTruckMonthAction | ADMIN + lý do bắt buộc, lịch sử qua `listTruckMonthAdjustments` (UI đã gỡ) |

### 1.1d Nhãn trạng thái — đang lệch giữa app và file

- App UI + export TRIP_LOG: đã đổi sang "Đã lập BC"/"Tạm tính" (đợt QA trước).
- **Workbook PNL 3-sheet vẫn ghi "Đã chốt"** (truck-report-workbook.ts:135/:214) + glossary định nghĩa "Đã chốt = tháng đã khóa sổ" (:319) → 🐞 lệch wording, phải cập nhật theo mô hình mới.

### 1.2 Hạ tầng snapshot hiện tại

- Snapshot đóng băng vào `car_truck_month_close` (tmc_avg_price, tmc_consumption, tmc_total_liters, tmc_total_km) theo (ent, TRUCK, tháng, khu vực).
- **Mọi nơi hiển thị số** đọc qua 1 hàm chung `loadTruckRegionSnapshots` (packages/core/truck-fuel-snapshot.ts): Chi phí & LN, P&L, export Excel, báo cáo. → Đổi nguồn snapshot tại 1 chỗ là toàn hệ nhất quán.
- **Khóa tháng** `assertTruckMonthOpen` (CAR-E1002) đang chặn 9 điểm ghi: tạo/gán/hoàn thành/sửa/patch/xóa chuyến, import Excel, thêm hóa đơn xăng — chỉ kích hoạt bởi row close.

### 1.3 Ba khối đã mồ côi sau đợt QA "bỏ chốt sổ tay" (commit 75d286e)

| Khối | Trạng thái |
|---|---|
| `MonthCloseControls` (nút chốt sổ/mở lại) | Còn code, **không render** |
| `FuelInvoicePanel` (nhập hóa đơn xăng) | Còn code, **không render** → hiện KHÔNG có chỗ nhập hóa đơn xăng |
| `closeTruckMonthAction` / `reopenTruckMonthAction` | Còn code, không ai gọi từ UI |

Hệ quả: nhãn "Đã lập BC" chỉ là "đã có file Excel"; số liệu mãi tạm tính; tháng mới không bao giờ có giá bình quân/tiêu hao (= 0 vì không nhập được hóa đơn).

---

## 2. Thiết kế TO-BE

### 2.1 Nguyên tắc

1. **Lập báo cáo = tính lại + phân bổ + xuất file**, mỗi lần lập chạy lại từ đầu trên dữ liệu hiện hành.
2. Snapshot (giá bình quân, tiêu hao, tổng lít, tổng km) **lưu trên chính dòng báo cáo** (`car_truck_reports` — 4 cột mới). Bản báo cáo **mới nhất** của (tháng, khu vực) là nguồn số chính thức.
3. **Không tạo khóa mới** — dữ liệu sau khi lập BC vẫn sửa được; sửa xong lập lại BC là có số mới. (Câu hỏi mở #1 nếu team muốn khóa.)
4. Row close cũ (legacy) vẫn được tôn trọng: tháng đã chốt trước đây giữ nguyên khóa + snapshot; **ưu tiên snapshot báo cáo mới hơn** nếu cả hai tồn tại.

### 2.2 Luồng "Lập báo cáo" mới (mỗi khu vực)

```
Bước 3 bấm "Lập báo cáo"
  1. Lưu chỉnh sửa tay (cầu đường / phát sinh / doanh thu — cột XĂNG không còn sửa tay khi đủ điều kiện phân bổ)
  2. Tính stats = getTruckFuelStats(tháng, khu vực)   ← F1–F4
  3. hasSnapshot = F5 đạt?
       ĐẠT   → mọi chuyến trong file + màn hình dùng số phân bổ (F6)
       KHÔNG → giữ số tự nhập (F10) + cảnh báo trong UI/file
  4. Build Excel với factors vừa tính (không đọc close cũ)
  5. Upload S3
  6. INSERT car_truck_reports (kèm 4 cột snapshot) — 1 lệnh, atomic
  7. Audit log kèm snapshot
```

### 2.3 Đọc số (1 điểm sửa duy nhất)

`loadTruckRegionSnapshots` đọc từ 2 nguồn, merge theo precedence:
1. **Báo cáo PNL mới nhất** (max trr_created_at, trr_deleted_at IS NULL, có đủ 4 cột snapshot) per (tháng, khu vực) — khu vực null lưu key `''` (toàn đội) như hành vi close "all" cũ.
2. Legacy `car_truck_month_close` (fallback, chỉ khi không có báo cáo snapshot).

→ Chi phí & LN, P&L, Dashboard, mọi export tự động hiển thị số phân bổ của lần lập BC gần nhất, không phải sửa từng màn.

### 2.4 UI

| Màn | Thay đổi |
|---|---|
| **P&L tab** | Khôi phục `FuelInvoicePanel` (hiện khi chọn 1 khu vực cụ thể); `locked` chỉ còn theo legacy close |
| **Bước 3 Lập BC** | Bảng chuyến hiển thị **số phân bổ dự kiến** (xem trước = đúng số sẽ vào file); cột Phí xăng **read-only** khi khu vực đủ điều kiện phân bổ, kèm badge "Phân bổ theo bình quân"; thiếu điều kiện → editable như cũ + badge "Tạm tính thủ công" + cảnh báo thiếu hóa đơn/km |
| **Chi phí & LN** | Không đổi cấu trúc — hết in nghiêng tự nhiên khi có snapshot BC. Nice-to-have: badge vàng "Dữ liệu đã thay đổi sau lần lập BC" khi max(trp_updated_at) > trr_created_at |

---

## 3. Kế hoạch từng bước

### Phase 1 — Core: snapshot theo báo cáo (nền tảng)
- **S1.1** Migration 0021: 4 cột nullable trên `car_truck_reports`: `trr_avg_price numeric(14,2)`, `trr_consumption numeric(10,6)`, `trr_total_liters numeric(12,2)`, `trr_total_km numeric(12,1)` + index `idx_car_truck_reports_ent_month_region (ent_id, trr_month, trr_region, trr_created_at desc)`
  - └─ Side impact: additive, an toàn; cần chạy SQL tay trên staging (ep-noisy-heart)
- **S1.2** `generateTruckReportAction`: tính stats trước khi build; truyền factors override vào `getTruckReportExport`; insert row kèm snapshot; audit payload thêm snapshot
  - └─ Side impact: file Excel đổi số từ tạm tính → phân bổ (đúng chủ đích)
- **S1.3** `loadTruckRegionSnapshots`: thêm nguồn báo cáo + precedence (báo cáo mới nhất > legacy close). Import schema carTruckReports vào packages/core
  - └─ Side impact: LAN TỎA CHỦ ĐÍCH — mọi màn/export chuyển sang số phân bổ theo BC gần nhất; tháng chưa lập BC giữ nguyên tạm tính
- **S1.4** `getTruckReportExport`: nhận factors override (không tự đọc close) để file khớp 100% lần tính hiện tại
- **S1.5** Fix GAP hiện hữu: 2 trang chi tiết chuyến (`/trips/[id]`, `/truck/trips/[id]`) chuyển sang breakdown snapshot-aware (dùng chung rule với `listTruckTrips`) — hết lệch số giữa chi tiết và danh sách
  - └─ Side impact: chi tiết chuyến tháng đã BC đổi số hiển thị (từ tự nhập → phân bổ) — đúng chủ đích

### Phase 2 — Khôi phục nhập hóa đơn xăng
- **S2.1** Render lại `FuelInvoicePanel` trên P&L tab (bind theo khu vực đang chọn; chưa chọn khu vực → hint chọn khu vực)
  - └─ Side impact: i18n keys screens.truckPnl.* cũ cần rà lại 3 ngôn ngữ
- **S2.2** `addFuelInvoiceAction` giữ nguyên guard legacy close; bỏ điều kiện nào chặn nhập khi đã có BC (không khóa mới)

### Phase 3 — Bước 3 review theo mô hình phân bổ
- **S3.1** `getTruckReportReview`: per-trip trả thêm **allocated preview** (dùng live stats khi chưa có snapshot) + cờ `allocatable` per khu vực
- **S3.2** `report-review-step`: khóa/mở cột Phí xăng theo `allocatable`; badge chế độ; cảnh báo chuyến km=0 và khu vực 0 hóa đơn
  - └─ Side impact: bỏ đường sửa tay xăng (fix luôn lỗi ngầm: chuyến không đơn giá thì edit không lưu — patch :422)
- **S3.3** i18n mới (vi/en/ko): nhãn chế độ, cảnh báo, tooltip công thức
- **S3.4** Workbook PNL: đổi wording "Đã chốt"→"Đã lập BC" (:135/:214) + glossary (:319) mô tả theo mô hình mới; đối soát/glossary in kèm 4 số snapshot của lần lập

### Phase 4 — Dọn dẹp, dữ liệu, tài liệu
- **S4.1** Xóa dead code: `MonthCloseControls`, (tùy chọn #2) `closeTruckMonthAction`/`reopenTruckMonthAction`; GIỮ `assertTruckMonthOpen` + đường đọc legacy close
- **S4.2** Staging: soft-delete legacy close BAIKSAN 07/2026 (SQL tay — cần user cho phép ghi DB staging)
- **S4.3** Cập nhật TC xlsx (module 05/06/07: FN/PL/RP — bỏ TC chốt sổ tay, thêm TC phân bổ khi lập BC), user guide đoạn liên quan
- **S4.4** Test: unit cho merge precedence snapshot + E2E lập BC 2 lần ra số khác nhau sau khi sửa chuyến

**Thứ tự deploy**: Phase 1+2 một đợt (có migration), Phase 3 đợt hai, Phase 4 chốt. Staging trước, verify bằng bộ TC, rồi mới nói chuyện production.

---

## 4. Danh sách file thay đổi

| Khu vực | File | Loại |
|---|---|---|
| DB | `packages/db/migrations/0021_report_snapshot.sql` + schema `truck-report.schema.ts` | Mới/Sửa |
| Core | `packages/core/src/truck/truck-fuel-snapshot.ts` | Sửa (nguồn kép + precedence) |
| BE | `server/actions/truck-report.actions.ts` | Sửa (tính + lưu snapshot) |
| BE | `server/queries/truck-report-export.queries.ts` | Sửa (factors override) |
| BE | `server/queries/truck-finance.queries.ts` (`getTruckReportReview`) | Sửa (allocated preview) |
| FE | `truck/reports/_components/report-review-step.tsx` | Sửa (khóa cột xăng, badge, cảnh báo) |
| FE | `truck/pnl/page.tsx` (+ `fuel-invoice-panel.tsx` re-wire) | Sửa |
| FE | `trips/[id]/page.tsx` + `truck/trips/[id]/page.tsx` (S1.5 — breakdown snapshot-aware) | Sửa |
| BE | `server/lib/truck-report-workbook.ts` (S3.4 — wording + snapshot in glossary) | Sửa |
| BE | `truck-finance.actions.ts` (guard xóa hóa đơn — R14), `truck-fixed-cost.actions.ts` (guard region — 🐞) | Sửa |
| FE | Xóa `month-close-controls.tsx` | Xóa |
| i18n | `messages/{vi,en,ko}.json` | Sửa |
| Docs/TC | `docs/test/TC-260706-truck-app-testcase.xlsx`, user guide | Sửa |

---

## 5. Phân tích rủi ro

| # | Rủi ro | Mức | Phân tích & Giảm thiểu |
|---|---|---|---|
| R1 | **Số chính thức thay đổi hồi tố** — không khóa nên sửa chuyến/hóa đơn sau khi lập BC làm màn hình lệch file đã gửi | **Cao** | File S3 bất biến = bản gốc pháp lý; audit log đầy đủ; quy ước "BC mới nhất là bản chính thức"; badge stale (S3.2 nice-to-have). Nếu team cần cứng hơn → câu hỏi mở #1 |
| R2 | **Hai chế độ số trên cùng màn** (tháng có BC = phân bổ; chưa = tạm tính) gây hiểu nhầm | **Cao** | Giữ quy ước in nghiêng + tooltip công thức + badge trạng thái có timestamp |
| R3 | **Sửa tay xăng bị recompute đè** nếu vẫn cho edit cột xăng | **Cao** | Khóa cột xăng khi allocatable (S3.2); chỉ còn toll/phát sinh/doanh thu sửa tay |
| R4 | **Không có UI nhập hóa đơn xăng** → không bao giờ phân bổ được | **Cao** | Phase 2 là điều kiện tiên quyết của cả tính năng |
| R5 | **BC "Tất cả khu vực"**: factors gộp toàn đội áp cho chuyến từng khu vực | TB | Giữ hành vi legacy (key '' + forTrip ưu tiên khu vực cụ thể); wizard đa khu vực đã sinh BC riêng từng khu vực |
| R6 | **Nhiều snapshot sống cùng lúc** khi lập BC nhiều lần → chọn sai bản | TB | Query max(trr_created_at) + index S1.1; unit test |
| R7 | **Không transaction** (Neon HTTP): fail giữa chừng → edits đã lưu nhưng không có BC / Excel fail | TB | Thứ tự an toàn: tính → build → upload S3 → 1 INSERT cuối (row+snapshot atomic); lỗi bước nào toast rõ; partial edits vẫn là dữ liệu hợp lệ |
| R8 | **Legacy close** (BAIKSAN 07/2026 staging) vừa khóa vừa giữ snapshot cũ | TB | Precedence BC mới > close cũ; dọn staging bằng SQL (S4.2, cần authorize); production truck chưa live |
| R9 | **Chuyến km=0** (quên công tơ): xăng phân bổ 0 + làm tiêu hao khu vực méo | TB | Cảnh báo Bước 3 liệt kê chuyến km=0 trước khi lập |
| R10 | Hiệu năng (stats + build + S3 mỗi lần lập) | Thấp | Dataset nhỏ; như hiện tại + 1 query |
| R11 | i18n/user guide/TC lệch nhịp code | Thấp | Gói trong Phase 3–4, checklist trước merge |
| R12 | **2 trang chi tiết chuyến lệch số** với danh sách/BC (gap có sẵn, lộ rõ hơn khi phân bổ chạy thường xuyên) | **Cao** | S1.5 bắt buộc trong Phase 1 |
| R13 | **Chi phí cố định sửa được sau khi lập BC** → P&L màn hình lệch file (fixed cost không nằm trong snapshot, tính live) | TB | Chấp nhận theo mô hình "không khóa, lập lại là cập nhật" + badge stale nên theo dõi cả tfc_updated_at; guard region-close cũ (🐞) sửa kèm nếu giữ legacy lock |
| R14 | Xóa hóa đơn xăng không guard (🐞 sẵn có) — với legacy close vẫn xóa được nguồn snapshot | Thấp | Thêm guard đối xứng với add (1 dòng) trong Phase 2 |

---

## 6. Câu hỏi mở cần team chốt trước khi code

1. **Khóa dữ liệu sau lập BC?** Đề xuất: KHÔNG khóa (đúng yêu cầu "lập lại tính lại"), chỉ cảnh báo stale. Phương án thay thế: khóa mềm sau BC, sửa phải bấm "Lập lại BC" xác nhận.
2. **Xóa hẳn closeTruckMonthAction/reopenTruckMonthAction** hay giữ (không UI) cho tương lai? Đề xuất: xóa để khỏi nhầm — logic tính đã nằm ở getTruckFuelStats, không mất gì.
3. **BC "Tất cả khu vực"** giữ (factors gộp) hay buộc chọn từng khu vực khi có ≥2 khu vực có chuyến? Đề xuất: giữ, vì wizard đa chọn đã tách BC theo khu vực.

## 7. DB Migration (staging chạy tay)

```sql
ALTER TABLE car_truck_reports
  ADD COLUMN trr_avg_price     numeric(14,2),
  ADD COLUMN trr_consumption   numeric(10,6),
  ADD COLUMN trr_total_liters  numeric(12,2),
  ADD COLUMN trr_total_km      numeric(12,2);
-- (precision mirror đúng car_truck_month_close: 14,2 / 10,6 / 12,2 / 12,2)

CREATE INDEX idx_car_truck_reports_ent_month_region
  ON car_truck_reports (ent_id, trr_month, trr_region, trr_created_at DESC);

-- S4.2 (tùy chọn, sau khi xác nhận): dọn legacy close trên staging
-- UPDATE car_truck_month_close SET tmc_deleted_at = now()
--  WHERE ent_id = '00000000-0000-4000-8000-000000000010' AND tmc_deleted_at IS NULL;
```
