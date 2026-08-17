# REQ-20260817 — Truck: Cho phép chọn xe khi Lập báo cáo chính thức (Wizard chốt sổ)

```yaml
document_id: V2-REQ-20260817-REPORT-WIZARD-VEHICLE-SCOPE
version: 1.0.0
status: Draft (3 giả định chờ KH xác nhận — xem §7, đặc biệt GĐ-A ảnh hưởng thiết kế lõi)
created: 2026-08-17
author: Claude (dev@amoeba.group)
scope: apps/app-car-manager-v2 (TRUCK department — wizard /truck/reports/new)
precedent:
  - docs/analysis/REQ-20260814-truck-report-multi-vehicle.md (§6.1 — lý do trước đây KHÔNG làm việc này)
  - docs/analysis/REQ-20260726 (per-vehicle fuel freeze, trr_vehicle_fuel)
```

> **Nguồn**: sau khi REQ-20260814 chốt "wizard chốt sổ giữ nguyên granularity khu vực" (R6), người dùng xác nhận lại — **muốn** bước chọn xe cũng có mặt ở chính bước chốt sổ, không chỉ ở 2 màn trích xuất (Chi phí & Lợi nhuận / Tổng quan P&L). REQ này giải quyết đúng rào cản kỹ thuật đã nêu ở REQ-20260814 §6.1 thay vì né nó.

---

## 1. Tóm tắt Yêu cầu

| # | Yêu cầu | Loại |
|---|---|---|
| R1 | Wizard `/truck/reports/new` thêm **bước 2.5 — Chọn xe**, ngay sau bước chọn khu vực: mặc định Tất cả xe của khu vực, cho phép thu hẹp còn 1/nhiều xe | Chức năng |
| R2 | Báo cáo sinh ra chỉ tính/hiển thị đúng tập xe đã chọn (bước Review, file Excel) | Chức năng |
| R3 | Xe **không** được chọn trong lần lập báo cáo này **không được mất** số liệu đã đóng băng ở lần lập báo cáo trước — đây là rào cản chính đã chặn REQ-20260814 | Phi chức năng / Toàn vẹn dữ liệu |
| R4 | Trạng thái "Đã lập BC / Tạm tính" của 1 chuyến phải theo **đúng xe** của chuyến đó, không theo cả khu vực | Phi chức năng / Toàn vẹn dữ liệu |
| R5 | Định dạng `MONTHLY_SUMMARY` (form R1 khách đã duyệt) — xem GĐ-A — đề xuất **giữ nguyên toàn khu vực**, không cho chọn xe, vì khối KPI của form tính trên toàn bộ xe sống của khu vực | Ràng buộc (đề xuất) |
| R6 | Tập xe chọn vẫn nằm trong ACL khu vực của user (tái dùng `resolveVehicleScope`, REQ-20260814 BL-1) | Bảo mật |
| R7 | Text mới qua i18n 3 ngôn ngữ | Phi chức năng |

**Ngoài phạm vi:** không đổi khái niệm "khu vực" là đơn vị chốt sổ tối đa (vẫn không có báo cáo "xuyên khu vực + xuyên xe" tuỳ ý); không đổi 2 màn trích xuất A/B (đã xong ở REQ-20260814).

---

## 2. AS-IS Hiện trạng Phân tích

### 2.1 Mô hình "đóng băng" hiện tại — theo REPORT, không theo XE

`car_truck_reports` ([truck-report.schema.ts:35-80](../../packages/db/src/schema/truck-report.schema.ts#L35)): 1 row = 1 (tháng, khu vực). Cột `trr_vehicle_fuel` (jsonb) chứa **mảng TOÀN BỘ xe** có phát sinh xăng trong khu vực đó, tính bởi `getTruckFuelStatsByVehicle(entId, month, region)` → `loadVehicleFuelPool(entId, [month], region)` ([truck-finance.queries.ts:205-224](../../apps/web/src/server/queries/truck-finance.queries.ts#L205)) — **không nhận tham số xe**, luôn quét cả khu vực.

`loadTruckRegionSnapshots` ([truck-fuel-snapshot.ts:120-323](../../packages/core/src/truck/truck-fuel-snapshot.ts#L120)) đọc mọi report của `(ent, month)`, nhóm theo `(month, region)`, và với mỗi scope **chỉ giữ lại report mới nhất** (`latestByScope`, dòng 200-205). Khi report đó có `trrVehicleFuel`, code **ghi đè toàn bộ `vehicleSnap`** bằng đúng mảng của report ấy (dòng 206-218) — **không hợp nhất** với report cũ hơn.

`isReported()` / `reportedAt` ([truck-fuel-snapshot.ts:117](../../packages/core/src/truck/truck-fuel-snapshot.ts#L117), :260-264, :313-321) cũng fold theo **`(month, region)`**, không theo xe: 1 report tồn tại cho scope đó là đủ để **toàn bộ xe trong khu vực** hiện "Đã lập BC".

### 2.2 Vì sao REQ-20260814 phải loại trừ việc này (§6.1)

> Trích nguyên văn: *"Lập báo cáo cho 2/8 xe **sau** một báo cáo đầy đủ sẽ khiến 6 xe còn lại **mất snapshot**, rơi về `livePool` → chi phí nhiên liệu và lợi nhuận của những chuyến **đã chốt** đổi số. Đây là hồi quy dữ liệu thật, không phải rủi ro lý thuyết."*

Nguyên nhân gốc: bước "ghi đè toàn bộ theo report mới nhất" ở §2.1 — không phải bản chất của việc "chọn xe" là sai, mà là **cách fold dữ liệu hiện tại không hỗ trợ phủ một phần**.

### 2.3 Wizard hiện tại — 3 bước, không có bước xe

`reports/new/page.tsx` ([:24-33](../../apps/web/src/app/(app)/truck/reports/new/page.tsx#L24)): Bước 1 chọn tháng → Bước 2 chọn khu vực (`ReportRegionStep`, multi-select khu vực hoặc "Tất cả khu vực") → Bước 3 review + xác nhận (`ReportReviewStep`), đã hiển thị **từng xe dạng thẻ collapse** trong mỗi khu vực ([report-review-step.tsx:259-329](../../apps/web/src/app/(app)/truck/reports/_components/report-review-step.tsx#L259)) — cấu trúc dữ liệu review **đã có sẵn theo xe**, chỉ thiếu bước chọn/bỏ chọn.

`generateTruckReportAction` ([truck-report.actions.ts:313-343](../../apps/web/src/server/actions/truck-report.actions.ts#L313)) nhận `{ month, type, region }` — không có `vehicleIds`.

### 2.4 KPI khối MONTHLY_SUMMARY tính trên toàn khu vực

`getTruckReportExport` ([truck-report-export.queries.ts:272-433](../../apps/web/src/server/queries/truck-report-export.queries.ts#L272)): `scopeVehicles` = query trực tiếp `carVehicles` theo `region` (không nhận tham số xe) → `truckCount`, `activeCount`, `maintenanceCount`, `avgTripsPerActive`, `avgKmPerActive` (dòng 417-429) đều là số của **toàn bộ xe sống trong khu vực**, không lọc được.

### 2.5 Helper ACL đã có, tái dùng được ngay

`resolveVehicleScope(actor, raw)` ([region-access.ts:131-163](../../apps/web/src/lib/auth/region-access.ts#L131), REQ-20260814 BL-1) đã làm đúng việc: danh sách xe hợp lệ theo ACL khu vực + giải mã CSV + loại ID lạ im lặng + chuẩn hoá "chọn hết = Tất cả". Bước 2.5 mới **dùng lại y hệt hàm này**, không viết logic ACL mới.

---

## 3. TO-BE Yêu cầu

### 3.1 Bảng ánh xạ AS-IS → TO-BE

| Hạng mục | AS-IS | TO-BE |
|---|---|---|
| Schema `car_truck_reports` | không có cột phạm vi xe | thêm `trr_vehicle_ids JSONB` nullable — **NULL = phủ toàn bộ xe của khu vực** (hành vi cũ, mọi row hiện có tự động NULL), mảng = phủ đúng tập xe đó |
| Fold snapshot (`loadTruckRegionSnapshots`) | "report mới nhất của scope thắng tất" (ghi đè toàn mảng) | **fold theo XE**: duyệt các report của `(month, region)` theo thứ tự tạo tăng dần; report `trr_vehicle_ids = NULL` → ghi đè MỌI xe trong khu vực; report có tập con → **chỉ** ghi đè đúng những xe trong tập đó. Xe ngoài tập con của report mới nhất giữ nguyên số của report trước |
| `isReported` / `reportedAt` | theo `(month, region)` | thêm chiều theo xe: 1 xe "đã lập BC" nếu tồn tại ≥1 report phủ nó (toàn khu vực HOẶC tập con chứa nó) sinh tại/sau lần sửa cuối của chuyến |
| Wizard | 3 bước, không có bước xe | **4 bước**: Tháng → Khu vực → **Chọn xe (mới)** → Review. Bước xe mặc định = Tất cả xe của khu vực (bỏ qua = hành vi y hệt hiện tại) |
| `generateTruckReportAction` | `{ month, type, region }` | thêm `vehicleIds?: string[]` |
| `getTruckFuelStatsByVehicle` | quét cả khu vực | thêm tham số lọc theo tập xe (khi có) |
| `getTruckReportExport` (KPI) | `scopeVehicles` = cả khu vực | **giữ nguyên khi `type = MONTHLY_SUMMARY`** (xem GĐ-A); các type khác (`PNL`/`TRIP_LOG`/`VEHICLE`) lọc theo tập xe đã chọn |
| Tên báo cáo (`reportName`) | "{loại} · Khu vực X" / "· Tất cả khu vực" | thêm nhánh "· {loại} · Khu vực X · 3/8 xe" khi có tập con |
| DB migration | — | 1 cột mới, nullable, **không backfill** (NULL đã đúng nghĩa "toàn khu vực" cho mọi row cũ) |

### 3.2 Logic nghiệp vụ

**BL-1 · Fold theo xe (thay thế fold theo report, điểm mấu chốt của REQ này)**

```
input:  mọi report (chưa xoá) của (ent, month, region), sắp theo trr_created_at TĂNG DẦN
for mỗi report r:
  if r.trr_vehicle_ids IS NULL:
      # phủ toàn khu vực — ghi đè MỌI xe (hành vi cũ)
      vehicleSnap[xe] = r.trr_vehicle_fuel[xe]   với mọi xe có trong mảng
      reportedAt[mọi xe trong khu vực] = max(hiện có, r.trr_created_at)
  else:
      # phủ 1 phần — CHỈ ghi đè đúng tập con
      for xe in r.trr_vehicle_ids:
          vehicleSnap[xe] = r.trr_vehicle_fuel[xe]   (nếu report có tính được)
          reportedAt[xe] = max(hiện có, r.trr_created_at)
kết quả: report SINH SAU thắng report SINH TRƯỚC, nhưng CHỈ trên đúng tập xe nó phủ —
xe ngoài tập con của report mới nhất vẫn giữ giá trị report trước đó (không "biến mất")
```

Đây chính là điểm khác duy nhất so với AS-IS: AS-IS coi 1 report là "toàn quyền" trên cả scope; TO-BE coi 1 report chỉ "toàn quyền" trên đúng tập xe nó khai báo.

**BL-2 · KPI khối MONTHLY_SUMMARY không đổi (theo GĐ-A đề xuất).** Khi `type = MONTHLY_SUMMARY`, bỏ qua tập xe đã chọn ở bước 2.5 (hoặc ẩn hẳn bước đó khi format này được chọn) — `getTruckReportExport(actor, month, region, { includeIdle: true })` gọi y hệt AS-IS, đảm bảo khối KPI + dòng TỔNG luôn đúng nghĩa "báo cáo tháng của khu vực" như form khách đã duyệt.

**BL-3 · `PNL` / `TRIP_LOG` / `VEHICLE` tôn trọng tập xe đã chọn.** 3 định dạng còn lại lọc đúng theo `vehicleIds`; `trr_vehicle_ids` lưu lại tập đó để BL-1 fold đúng ở các lần đọc sau.

**BL-4 · Số liệu công thức không đổi.** Vẫn dùng nguyên `computeTruckPnl`, `loadVehicleFuelPool` — chỉ thay đổi Ở ĐÂU dữ liệu được đóng băng và cách hợp nhất nhiều report, không đổi công thức tính tiền.

### 3.3 Thiết kế UI — Bước 2.5 mới

```
① Chọn tháng → ② Chọn khu vực → ②.5 Chọn xe (MỚI) → ③ Review & Xác nhận

┌─ Bước 2.5 — Chọn xe (Khu vực: HCM, 4 xe) ──────┐
│ ☑ Tất cả xe (4)                                 │
│ ☑ 51C-111.11   ☑ 51C-222.22                     │
│ ☐ 51C-333.33   ☑ 51D-444.44                     │
│                                                  │
│ ⚠ Xe không chọn giữ nguyên số báo cáo gần nhất   │
│   (nếu có) hoặc vẫn "Tạm tính" (nếu chưa từng)   │
│                                        [Tiếp tục]│
└──────────────────────────────────────────────────┘
```

- Tái dùng `resolveVehicleScope` (đã ACL-aware) cho danh sách + validate.
- Multi-region (bước 2 chọn nhiều khu vực) → bước 2.5 lặp lại **cho từng khu vực** (giống review step hiện tại đã tách theo `region`), mỗi khu vực có tập xe riêng.
- Khi format được chọn ở bước Review là `MONTHLY_SUMMARY`, bước 2.5 hiện banner "Định dạng này luôn phủ toàn bộ khu vực" và khoá về "Tất cả xe" (theo GĐ-A) — hoặc bước 2.5 chỉ prompt SAU khi đã biết định dạng, tuỳ PLAN quyết định thứ tự UX.

---

## 4. Phân tích Gap

### 4.1 Bảng phạm vi thay đổi

| Khu vực | Hiện tại | Thay đổi | Mức ảnh hưởng |
|---|---|---|---|
| DB | không có cột phạm vi xe trên report | +1 cột `trr_vehicle_ids JSONB` nullable | 🟡 Trung bình — migration đơn giản, không backfill |
| **Core — `loadTruckRegionSnapshots`** | fold theo report-thắng-tất | fold theo xe (BL-1) | 🔴 **Cao nhất** — hàm này là nguồn sự thật fuel cho **mọi** màn (dashboard, finance, pnl, trips, exports, report review) |
| Core — `getTruckFuelStatsByVehicle` | quét cả khu vực | + lọc theo tập xe (tuỳ chọn) | 🟢 Thấp |
| Query — `getTruckReportExport` | KPI toàn khu vực luôn | giữ nguyên cho MONTHLY_SUMMARY; lọc cho 3 loại còn lại | 🟡 Trung bình |
| Action — `generateTruckReportAction`, `generateOneTruckReport` | không có `vehicleIds` | thêm tham số, ghi `trr_vehicle_ids` | 🟡 Trung bình |
| UI wizard | 3 bước | +1 bước (2.5), review lọc theo xe đã chọn | 🟡 Trung bình — tái dùng nhiều pattern có sẵn |
| i18n | — | ~6-8 key × 3 ngôn ngữ | 🟢 Thấp |
| 2 màn trích xuất (Chi phí/PNL) | đã multi-select (REQ-20260814) | **không đổi** | ⬜ Không |

### 4.2 Vì sao mức rủi ro cao hơn hẳn REQ-20260814

REQ-20260814 chỉ thêm 1 nhánh lọc ở **tầng đọc ad-hoc** (không đụng gì được đóng băng). REQ này sửa **chính cơ chế đóng băng + hợp nhất** mà toàn bộ ứng dụng dựa vào để biết "số nào là chính thức" — bắt buộc phải chạy lại **toàn bộ** nhóm hồi quy R01-R09 của REQ-20260814 (dashboard, P&L, finance, export, wizard) cộng thêm test case mới cho đúng kịch bản BL-1 (report tập con không xoá số report tập toàn bộ trước đó, và ngược lại).

### 4.3 Danh sách file thay đổi (dự kiến — PLAN sẽ chốt chi tiết)

| Lớp | File | Loại |
|---|---|---|
| DB | `packages/db/src/schema/truck-report.schema.ts` | Sửa (+cột) |
| DB | migration mới `00XX_truck_report_vehicle_scope.sql` | Mới |
| Core | `packages/core/src/truck/truck-fuel-snapshot.ts` | Sửa (BL-1 — trọng tâm) |
| Query | `apps/web/src/server/queries/truck-finance.queries.ts` (`getTruckFuelStatsByVehicle`) | Sửa |
| Query | `apps/web/src/server/queries/truck-report-export.queries.ts` | Sửa |
| Action | `apps/web/src/server/actions/truck-report.actions.ts` | Sửa |
| UI | bước mới `report-vehicle-step.tsx` (tên dự kiến) | Mới |
| UI | `apps/web/src/app/(app)/truck/reports/new/page.tsx` | Sửa (thêm bước) |
| UI | `apps/web/src/app/(app)/truck/reports/_components/report-review-step.tsx` | Sửa (lọc theo xe) |
| i18n | `apps/web/messages/{vi,en,ko}.json` | Sửa |

### 4.4 Chiến lược migration DB

Thêm `trr_vehicle_ids JSONB NULL` vào `car_truck_reports`. **Không cần backfill** — NULL cho mọi row hiện có đã đúng nghĩa "phủ toàn bộ khu vực" (hành vi cũ). Migration thuần túy additive, an toàn chạy trên staging/production như quy trình sẵn có (manual SQL, `synchronize` đã tắt).

---

## 5. Luồng Người dùng

### 5.1 Kịch bản chính — chốt sổ 3/8 xe của khu vực HCM

```
Admin/Manager → /truck/reports/new
   ├─ Bước 1: chọn Tháng 07/2026
   ├─ Bước 2: chọn Khu vực HCM
   ├─ Bước 2.5: bỏ chọn 1 xe (còn 3/4 xe HCM)   ← MỚI
   ├─ Bước 3: Review chỉ hiện 3 xe đã chọn, chọn định dạng PNL
   └─ [Lập báo cáo]
        └─ car_truck_reports: 1 row mới, trr_vehicle_ids = [xe1, xe2, xe3]
        └─ 3 xe này: số fuel đóng băng theo report MỚI
        └─ xe thứ 4 (không chọn): GIỮ NGUYÊN số report gần nhất trước đó
```

### 5.2 Phân nhánh

```
Bước 2.5 bỏ qua / chọn Tất cả  → trr_vehicle_ids = NULL → hành vi Y HỆT AS-IS (không hồi quy)
Bước 2.5 chọn tập con          → trr_vehicle_ids = tập đó → fold theo BL-1
Định dạng = MONTHLY_SUMMARY    → (GĐ-A) bỏ qua bước 2.5, luôn toàn khu vực
Xe X đã có report tập-toàn-bộ trước đó, giờ bị bỏ ra khỏi report tập-con mới
   → xe X giữ nguyên số của report tập-toàn-bộ (report cũ vẫn là report MỚI NHẤT
     áp dụng cho xe X, vì report mới không khai báo phủ xe X)
```

### 5.3 Luồng không đổi

- 2 màn trích xuất `/truck/finance`, `/truck/pnl` (REQ-20260814) — không chạm.
- Công thức tính phí nhiên liệu/lợi nhuận (`computeTruckPnl`, `loadVehicleFuelPool`) — không đổi.

---

## 6. Ràng buộc Kỹ thuật

### 6.1 Toàn vẹn dữ liệu (trọng tâm của REQ này)

- BL-1 phải có test hồi quy riêng cho đúng kịch bản đã bị chặn ở REQ-20260814 §6.1: sinh report toàn bộ 8 xe → sau đó sinh report chỉ 2 xe → xác nhận 6 xe còn lại **không đổi số, không đổi trạng thái "Đã lập BC"**.
- `reportedAt` theo xe phải test cả chiều ngược: chuyến của xe NGOÀI tập con, sửa SAU report tập toàn bộ nhưng TRƯỚC report tập con mới — phải vẫn tính là "đã phủ" bởi report toàn bộ (không bị report tập con sau đó vô tình làm mất trạng thái).

### 6.2 Bảo mật

- Bước 2.5 dùng `resolveVehicleScope` — thừa hưởng nguyên ACL khu vực (REQ-20260813) + loại ID lạ im lặng, không viết lại.
- `generateTruckReportAction` phải validate `vehicleIds` ⊆ xe hợp lệ theo ACL của actor + khu vực đang chốt (không tin tưởng input thô).

### 6.3 Hiệu năng

- `loadTruckRegionSnapshots` đổi từ "lấy 1 report/scope" sang "duyệt N report/scope theo thứ tự" — với tần suất lập báo cáo thực tế (vài lần/tháng/khu vực), N nhỏ, không đáng lo. Vẫn giữ 1 query DB (không N+1).

### 6.4 Tương thích

- Mọi report cũ (`trr_vehicle_ids IS NULL`) tiếp tục hoạt động y hệt AS-IS qua nhánh "NULL = toàn khu vực" của BL-1 — không cần migrate dữ liệu, không đổi hành vi lịch sử.

---

## 7. Giả định & Điểm chờ Khách xác nhận

| # | Giả định | Nếu KH trả lời khác |
|---|---|---|
| **GĐ-A** ⚠️ trọng yếu | `MONTHLY_SUMMARY` (form R1 đã duyệt) **không** cho chọn xe, luôn phủ toàn khu vực — vì khối KPI của form (`truckCount`, `avgKmPerActive`…) chỉ có nghĩa ở cấp khu vực | Nếu KH muốn `MONTHLY_SUMMARY` cũng lọc theo xe → phải định nghĩa lại ý nghĩa các KPI khi là tập con (vd `truckCount` = tổng khu vực hay tổng tập chọn?) — ảnh hưởng trực tiếp form đã duyệt, cần KH duyệt lại mẫu |
| **GĐ-B** | Lập báo cáo tập con nhiều lần với các tập xe khác nhau trong cùng tháng/khu vực là hành vi **cho phép và có chủ đích** (vd "làm mới" 2 xe vừa có hoá đơn mới mà không đụng 6 xe kia) | Nếu KH muốn **chặn** lập báo cáo tập con khi khu vực đã có report toàn bộ (chỉ cho lập lại toàn bộ) → đơn giản hơn nhiều, bỏ hẳn BL-1, chỉ cần validate ở action |
| **GĐ-C** | Tên báo cáo hiển thị thêm "· n/m xe" khi là tập con; không cần cột riêng trong danh sách báo cáo | Nếu KH muốn cột/badge riêng ở `/truck/reports` list → thêm việc UI nhỏ |

---

## 8. Ước lượng

| Hạng mục | Công |
|---|---|
| Migration DB (+cột, không backfill) | 0.25 ngày |
| Rework `loadTruckRegionSnapshots` (BL-1) — trọng tâm rủi ro | 1.5 ngày |
| `getTruckFuelStatsByVehicle` + `getTruckReportExport` nhận tập xe | 0.5 ngày |
| Action `generateTruckReportAction`/`generateOneTruckReport` + validate ACL | 0.5 ngày |
| UI bước 2.5 + wire review step | 0.75 ngày |
| i18n 3 ngôn ngữ | 0.25 ngày |
| TC + test hồi quy toàn bộ luồng fuel (bắt buộc, xem §6.1) | 1 ngày |
| **Tổng** | **~4.75 ngày** — cao hơn nhiều REQ-20260814 (~2 ngày) vì sửa lõi đóng băng, không phải tầng đọc |

---

## 9. Bước tiếp theo

1. ✅ REQ (tài liệu này)
2. ⬜ `docs/plan/PLN-20260817-truck-report-wizard-vehicle-scope.md`
3. ⬜ `docs/test/TC-20260817-truck-report-wizard-vehicle-scope.md`
4. ⏸️ **Cổng duyệt của người dùng** — đặc biệt cần chốt **GĐ-A** trước khi viết PLAN, vì nó quyết định liệu bước 2.5 có áp dụng cho `MONTHLY_SUMMARY` hay không (ảnh hưởng thiết kế UI + core)
5. ⬜ Triển khai → TR → RPT
