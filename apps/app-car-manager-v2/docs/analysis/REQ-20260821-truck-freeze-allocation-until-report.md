# REQ-20260821 — Tạo chuyến không tính lại số; số phân bổ chỉ tính khi lập báo cáo

> **Yêu cầu gốc (2026-08-21)**: *"tôi cần khi tạo chuyến thì sẽ không tính lại số nào cả, khi lập báo cáo mới tính"* — sau khi
> test trực tiếp trên staging cho thấy tạo 1 chuyến mới làm cột "CP cố định phân bổ" của các chuyến **đã lập BC** tự chia lại
> (3.333.333đ → 2.500.000đ) và lợi nhuận từng chuyến đổi theo.

## 1. Yêu cầu tóm tắt

| # | Yêu cầu | Loại |
|---|---------|------|
| 1 | Tạo/sửa/xoá chuyến trong tháng đã lập BC **không được làm đổi** bất kỳ số đã hiển thị nào của các chuyến nằm trong BC (lương/KH phân bổ, lợi nhuận, nhiên liệu) | Thay đổi hành vi |
| 2 | Số phân bổ (lương, khấu hao ÷ số chuyến) **chỉ được tính tại thời điểm lập báo cáo** — giữa hai lần lập BC, chuyến mới không có số phân bổ | Thay đổi hành vi |
| 3 | Chuyến chưa nằm trong BC nào hiển thị rõ trạng thái "chưa phân bổ — tính khi lập BC" thay vì con số tạm | UI/UX |
| 4 | Lập báo cáo (như hiện tại) vẫn là hành động tính + đóng băng toàn bộ số của tháng | Giữ nguyên |

## 2. AS-IS — hiện trạng (đã verify bằng test live trên staging 2026-08-21)

### 2.1 Hai loại số, hai hành vi khác nhau

| Số | Cách tính hiện tại | Có bị "tính lại" khi tạo chuyến? |
|---|---|---|
| **Nhiên liệu / chuyến** | Có cơ chế coverage: chuyến nằm trong BC dùng snapshot đóng băng trên dòng báo cáo (`trr_vehicle_fuel`); chuyến tạo/sửa **sau** BC (`changedAt > reportedAt`) rơi về pool LIVE, badge "Tạm tính" — [truck-fuel-snapshot.ts:108](../../packages/core/src/truck/truck-fuel-snapshot.ts) (BUG-260730 case 1) | ❌ Không — số cũ giữ nguyên (ĐÚNG ý khách) |
| **Lương/KH phân bổ / chuyến** | **Luôn tính live** tại thời điểm đọc: `tháng ÷ số chuyến COMPLETED hiện tại` — `loadTruckFixedAllocation` ([truck-fixed-allocation.ts:105](../../packages/core/src/truck/truck-fixed-allocation.ts)), gọi tại [truck-finance.queries.ts:432](../../apps/web/src/server/queries/truck-finance.queries.ts) và [truck-trips.queries.ts:88](../../apps/web/src/server/queries/truck-trips.queries.ts). **Không có tham số coverage** (`forTrip(month, vehicleId)` — không nhận `changedAt`) | ✅ **Có — đây là chỗ khách phàn nàn** |
| **Lợi nhuận / chuyến** (`profitAfterFixed`) | = DT − biến phí − phân bổ → kế thừa vấn đề của phân bổ | ✅ Có (gián tiếp) |

### 2.2 Bằng chứng test (staging, 2026-08-21, xe 50E-22222 tháng 8: 3 chuyến + BC lập 03:01 21/08)

Tạo chuyến TR-3014 (COMPLETED, 10km, DT 10tr):
- 3 chuyến cũ (đã lập BC): lương phân bổ 3.333.333 → **2.500.000**, KH 33.333 → **25.000**, LN 7.446.667* → đổi theo — **số đã báo cáo bị đổi trên màn hình dù file BC không đổi**.
- Nhiên liệu 3 chuyến cũ: giữ nguyên 11.000đ/km "Theo hoá đơn" (frozen — hành vi đúng).
- Chuyến mới: nhiên liệu LIVE 10.817đ/km "Tạm tính"; nhận ngay 1 phần phân bổ (2.525.000).
- Badge tháng chuyển cam: "Đã lập BC · 03:01 21/08/2026 — dữ liệu đã thay đổi, cần lập lại" (cơ chế `reportedAt` có sẵn).
- Xoá TR-3014 → mọi số quay về (vì tất cả live).

### 2.3 Chỗ ĐÃ đúng yêu cầu (không cần đổi)

- Tạo chuyến chỉ ghi số thô, không cache formula ([truck-trip.actions.ts](../../apps/web/src/server/actions/trips/truck-trip.actions.ts): "Profit/cost carry no cached column").
- Nhiên liệu chuyến đã-BC bất biến (coverage theo `changedAt`).
- File báo cáo + snapshot trên dòng `car_truck_reports` bất biến.
- Badge cam "dữ liệu đã thay đổi, cần lập lại" đã tồn tại.
- Danh sách chuyến đi hiển thị số thực nhập (fix 468f136), báo cáo là nơi tính (workbook build lúc generate).

## 3. TO-BE — nguyên tắc "số chia chỉ chia khi chốt"

### 3.1 Quy tắc nghiệp vụ

1. **Lập báo cáo = thời điểm tính phân bổ.** Khi `generateOneTruckReport` chạy, tính và **đóng băng lên dòng báo cáo** phần phân bổ cố định của từng xe trong scope: `{vehicleId, salary tháng, depreciation tháng, tripCount tại thời điểm lập}` (cột mới `trr_fixed_alloc` JSONB — cùng pattern `trr_vehicle_fuel`).
2. **Chuyến nằm trong coverage của BC** (cùng test `changedAt ≤ reportedAt` như nhiên liệu): lương/KH phân bổ = số đóng băng (`salary ÷ tripCount` của BC), bất biến cho tới BC kế tiếp.
3. **Chuyến ngoài coverage** (tạo/sửa sau BC, hoặc tháng chưa có BC): cột "CP cố định phân bổ" hiển thị **"— · Tính khi lập BC"** (không con số); cột Lợi nhuận hiển thị lợi nhuận **trước** chi phí cố định (`profit` biến-phí-only, đã có sẵn) kèm chip "Tạm tính".
4. Nhiên liệu giữ nguyên cơ chế hiện có (frozen ↔ live) — **không đổi**: nhiên liệu là tiền thật cộng dồn (additive), khác bản chất số chia (redistributive).
5. Xoá/sửa chuyến sau BC: các chuyến còn trong coverage **giữ nguyên** share đã đóng băng (không re-divide). Tổng Σshare có thể lệch tổng tháng cho tới BC mới — chấp nhận, badge cam đã cảnh báo "cần lập lại".

### 3.2 AS-IS → TO-BE

| Tình huống | AS-IS | TO-BE |
|---|---|---|
| Tạo chuyến trong tháng đã BC | Các chuyến cũ chia lại phân bổ ngay | Chuyến cũ **giữ nguyên**; chuyến mới "Tính khi lập BC" |
| Tháng chưa có BC nào | Mọi chuyến có phân bổ live | Mọi chuyến "— · Tính khi lập BC" (LN = trước CP cố định, Tạm tính) |
| Lập (lại) BC | Tính toàn bộ + freeze nhiên liệu | Tính toàn bộ + freeze nhiên liệu **và phân bổ** |
| Sửa 1 chuyến sau BC | Chuyến đó rơi về fuel live; phân bổ mọi chuyến vẫn live | Chuyến đó rơi cả fuel + phân bổ về "chưa chốt"; chuyến khác giữ frozen |
| BC cũ (trước khi deploy, chưa có `trr_fixed_alloc`) | — | Fallback tính live như AS-IS (grandfather); lập lại BC là có số đóng băng |

### 3.3 Phương án đã cân nhắc

| Phương án | Mô tả | Đánh giá |
|---|---|---|
| A | Freeze phân bổ lên dòng BC + coverage theo `changedAt`; chuyến ngoài coverage: UI mới "Tính khi lập BC" | Đúng nghĩa đen nhất nhưng phải thêm UI state mới |
| **B (✅ CHỐT — quyết định user 2026-08-21)** | Freeze phân bổ lên dòng BC; chuyến ngoài coverage hiển thị số tạm bằng công thức live **như hiện tại**; **không thêm bất kỳ UI nào**; CRUD chuyến giữ nguyên | Số đã lập BC bất biến (đạt yêu cầu cốt lõi); zero thay đổi UI/i18n; diff nhỏ nhất |
| C | Khoá luôn việc tạo chuyến khi tháng đã BC | Quá cứng; nghiệp vụ cần bổ sung chuyến rồi lập lại BC cuối tháng |

> **Quyết định user (2026-08-21)**: *"không thêm bất kỳ UI gì, chỉ tính lại khi lập báo cáo thôi, còn CRUD chuyến thì cứ để vậy"*
> → Phương án **B**: mục 3.1-(3) bị loại bỏ (không có state "— · Tính khi lập BC"); chuyến ngoài coverage giữ nguyên
> hiển thị live hiện tại (đã có chip "Tạm tính" sẵn). Các mục Gap về UI + i18n trong §4 **bỏ**; sai số Σshare ≠ tổng tháng
> giữa 2 lần BC được chấp nhận, badge cam sẵn có là tín hiệu duy nhất.

## 4. Gap analysis — phạm vi thay đổi

| Khu vực | File | Thay đổi | Mức độ |
|---|---|---|---|
| DB | `packages/db/migrations/0029_*.sql` + [truck-report.schema.ts](../../packages/db/src/schema/truck-report.schema.ts) | Thêm `trr_fixed_alloc` JSONB NULL | Thấp (cột nullable, không đụng dữ liệu cũ) |
| Core | [truck-fixed-allocation.ts](../../packages/core/src/truck/truck-fixed-allocation.ts) | `forTrip(month, vehicleId, changedAt?)`: ưu tiên share đóng băng từ BC (fold theo thứ tự tạo, subset-report chỉ đè xe nó phủ — cùng semantics `trr_vehicle_fuel`); ngoài coverage → trả `null` (chưa phân bổ); BC không có cột mới → fallback live | **Cao — lõi của REQ** |
| Action | [truck-report.actions.ts](../../apps/web/src/server/actions/truck-report.actions.ts) `generateOneTruckReport` | Tính + ghi `trr_fixed_alloc` (nguồn `loadTruckFixedMonthly` + đếm chuyến — đúng nguồn `computeTruckPnl`) | Trung bình |
| Query | [truck-finance.queries.ts](../../apps/web/src/server/queries/truck-finance.queries.ts) `listTruckFinanceTrips`, [truck-trips.queries.ts](../../apps/web/src/server/queries/truck-trips.queries.ts) `getTruckTripBreakdown` | Truyền `changedAt`; nhận share `null` → `salaryAllocated/depreciationAllocated/profitAfterFixed = null` | Trung bình |
| UI | Bảng Chi phí & LN, chi tiết chuyến | Cột phân bổ: share `null` → "— · Tính khi lập BC"; LN → `profit` (trước CP cố định) + chip Tạm tính | Trung bình |
| i18n | `messages/{vi,en,ko}.json` | Key mới: `allocPendingReport`, tooltip giải thích | Thấp |
| Export/Report | `truck-report-export.queries.ts`, workbook | **Không đổi** — tính tại thời điểm lập BC (đã đúng) | — |
| P&L tháng | `truck-pnl.service.ts` | **Không đổi** — số tháng (không phải per-trip); cân nhắc riêng nếu muốn card tháng cũng đóng băng | — |

### Sai số/side-impact cần chấp nhận
- Giữa 2 lần BC, `Σ(share hiển thị) ≠ CP cố định tháng` khi có chuyến mới/xoá (share cũ đóng băng + chuyến mới chưa chia). Badge cam hiện có là công cụ truyền đạt; tooltip cột nên nói rõ.
- KPI card tháng (Lợi nhuận ròng) vẫn nhúc nhích khi có chuyến mới vì doanh thu/biến phí là số thô cộng dồn — nằm ngoài phạm vi "số chia"; nếu khách muốn card tháng cũng đứng yên thì là REQ khác (freeze cấp tháng).

## 5. User flow

```
Tháng đang chạy (chưa BC):
  Tạo chuyến → dòng chuyến: DT/cầu đường/phát sinh thô · nhiên liệu Tạm tính ·
               phân bổ "— Tính khi lập BC" · LN (trước CPCĐ) Tạm tính
  → KHÔNG số nào của chuyến khác đổi

Lập BC (cuối tháng) → tính phân bổ ÷ N chuyến + chốt nhiên liệu → mọi dòng "Đã lập BC", số đóng băng

Phát sinh chuyến bổ sung sau BC:
  Tạo chuyến → 3 dòng cũ GIỮ NGUYÊN (frozen) · dòng mới "Tính khi lập BC" ·
               badge cam "dữ liệu đã thay đổi, cần lập lại"
  Lập lại BC → chia lại ÷ N+1, tất cả đóng băng theo BC mới (bản cũ soft-delete/giữ tuỳ user)
```

## 6. Ràng buộc kỹ thuật

- **Không migration dữ liệu**: cột JSONB nullable; BC lịch sử fallback live (grandfather) — staging chỉ cần lập lại BC 1 lần sau deploy.
- **Đồng bộ coverage**: dùng chung `reportedAt`/`changedAt` với nhiên liệu (`loadTruckRegionSnapshots`) để 1 chuyến không thể "nửa chốt nửa live".
- **Subset report (REQ-20260817)**: fold `trr_fixed_alloc` per-vehicle theo thứ tự tạo BC, chỉ đè xe được BC phủ — copy semantics của `trr_vehicle_fuel` (BL-1).
- **Làm tròn**: share = `Math.round(tháng ÷ tripCount)` như hiện tại; đóng băng con số đã làm tròn để hiển thị == file BC tuyệt đối.
- Neon HTTP driver không transaction: ghi `trr_fixed_alloc` cùng câu INSERT dòng BC (1 statement) — không thêm điểm dở dang.

---
**Trạng thái**: chờ duyệt (approval gate). Sau khi duyệt phương án: PLN → TC → implement theo workflow.
