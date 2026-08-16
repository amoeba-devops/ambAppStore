# REQ-20260814 — Truck: Lập báo cáo cho nhiều xe cùng lúc (Multi-select Vehicle)

```yaml
document_id: V2-REQ-20260814-REPORT-MULTI-VEHICLE
version: 1.0.0
status: Draft (có 4 giả định chờ KH xác nhận — xem §7)
created: 2026-08-14
updated: 2026-08-14
author: Claude (dev@amoeba.group)
scope: apps/app-car-manager-v2 (TRUCK department — màn Chi phí & Lợi nhuận)
precedent: docs/analysis/REQ-20260629-truck-monthend-finance-reports.md (luồng lập báo cáo)
related:
  - docs/analysis/REQ-20260713-truck-monthly-report-template.md (template R1 — KHÔNG đổi)
  - docs/analysis/REQ-20260813-region-access-control.md (ACL khu vực — ràng buộc scope)
```

> **Nguồn yêu cầu** — dòng requirement khách hàng:
> `Lập báo cáo | FALSE | FALSE | TRUE | Cho phép lập báo cáo theo từng xe | | Lập báo cáo cho tất cả các xe 1 lúc | Cho phép lựa chọn lập báo cáo cho 1-nhiều-Tất cả xe (Multi-select)`

> **Kết luận phân tích (đọc trước)**: hệ thống hiện có **3 bề mặt "lập báo cáo"** khác nhau. Yêu cầu này chỉ áp dụng cho **2 bề mặt trích xuất ad-hoc** (`/truck/finance`, `/truck/pnl`) — nơi bộ lọc xe đang là **single-select**. Bề mặt thứ 3 (wizard `/truck/reports/new` — báo cáo chính thức / chốt sổ) **KHÔNG được** thêm trục chọn xe: xem §6.1 để biết vì sao việc đó phá vỡ snapshot nhiên liệu đã đóng băng.

---

## 1. Tóm tắt Yêu cầu (요구사항 요약)

| # | Yêu cầu | Loại |
|---|---|---|
| R1 | Bộ lọc **Phương tiện** trên màn Chi phí & Lợi nhuận đổi từ **single-select** → **multi-select**: chọn 1 xe / nhiều xe / Tất cả xe | Chức năng |
| R2 | Nút **Xuất Excel** phải tôn trọng đúng tập xe đang chọn — xuất 1 lần ra 1 file cho nhiều xe, thay vì lặp thao tác từng xe | Chức năng |
| R3 | Áp dụng đồng nhất trên **cả 2 tab** của menu "Chi phí & Lợi nhuận": tab Chuyến đi (`/truck/finance`) và tab Tổng quan (`/truck/pnl`) | Chức năng |
| R4 | Sửa lỗi tồn: `/truck/pnl/export` **đang bỏ qua** bộ lọc xe → file tải về không khớp màn hình đang xem | Lỗi |
| R5 | Tập xe chọn được luôn nằm trong phạm vi **ACL khu vực** của user (REQ-20260813); "Tất cả xe" = tất cả xe **trong khu vực được phép** | Phi chức năng / Bảo mật |
| R6 | Luồng **báo cáo chính thức** (`/truck/reports/new` — chốt sổ) giữ nguyên granularity **khu vực / toàn bộ xe**, KHÔNG thêm trục chọn xe | Ràng buộc |
| R7 | Toàn bộ text mới qua i18n 3 ngôn ngữ (vi/en/ko) | Phi chức năng |

**Ngoài phạm vi (Out of scope):**

- Không đổi template `MONTHLY_SUMMARY` (form R1) — xem §6.1.
- Không đổi schema `car_truck_reports` — **không có migration DB** trong đợt này.
- Cột `FALSE / FALSE / TRUE` trong dòng requirement chưa xác định được ngữ nghĩa → tách thành mục chờ xác nhận, xem §7 GĐ-4.

---

## 2. AS-IS Hiện trạng Phân tích

### 2.1 Có 3 bề mặt "lập báo cáo", không phải 1

| # | Màn | Chọn xe | Đường dẫn xuất file | Bản chất |
|---|---|---|---|---|
| **A** | `/truck/finance` — tab **Chuyến đi** | ✅ single-select | `/truck/finance/export?month=&vehicle=` | Trích xuất ad-hoc (không ghi DB) |
| **B** | `/truck/pnl` — tab **Tổng quan** | ✅ single-select (chips) | `/truck/pnl/export?month=&format=` — **thiếu `vehicle`** | Trích xuất ad-hoc (không ghi DB) |
| **C** | `/truck/reports/new` — wizard **Lập báo cáo** | ❌ không có | Ghi row `car_truck_reports` + file S3 | **Báo cáo chính thức = chốt sổ** |

**Mô tả AS-IS của khách ("cho phép lập báo cáo theo từng xe") khớp chính xác với bề mặt A/B** — mỗi lần chỉ lọc được 1 biển số rồi bấm Xuất, muốn 5 xe phải lặp 5 lần và ghép tay.

### 2.2 Bề mặt A — `/truck/finance`

- Danh sách xe nạp toàn bộ TRUCK còn hoạt động rồi lọc theo ACL khu vực — [`finance/page.tsx:74`](../../apps/web/src/app/(app)/truck/finance/page.tsx#L74).
- Giá trị lọc là **1 chuỗi** `?vehicle=` và được validate là thuộc `trucks` — [`finance/page.tsx:78`](../../apps/web/src/app/(app)/truck/finance/page.tsx#L78).
- UI là `<select>` native 1 lựa chọn, `allLabel = t('allTrucks')` — [`finance/page.tsx:192`](../../apps/web/src/app/(app)/truck/finance/page.tsx#L192), component [`param-select.tsx`](../../apps/web/src/components/inputs/param-select.tsx).
- Link xuất file ghép thẳng `&vehicle=` — [`finance/page.tsx:133`](../../apps/web/src/app/(app)/truck/finance/page.tsx#L133).
- Query nhận **`vehicleId?: string | null`** (số ít) — [`truck-finance.queries.ts:321-331`](../../apps/web/src/server/queries/truck-finance.queries.ts#L321).

### 2.3 Bề mặt B — `/truck/pnl`

- Cùng cơ chế ACL + validate như A — [`pnl/page.tsx:84-88`](../../apps/web/src/app/(app)/truck/pnl/page.tsx#L84).
- UI là dãy **chip** 1 lựa chọn: chip "Tất cả xe" + 1 chip mỗi biển số — [`pnl/page.tsx:213-215`](../../apps/web/src/app/(app)/truck/pnl/page.tsx#L213).
- ⚠️ **Route xuất file bỏ qua hoàn toàn tham số xe**: chỉ đọc `month`, `format`, `region` — [`pnl/export/route.ts:32-34`](../../apps/web/src/app/(app)/truck/pnl/export/route.ts#L32). Người dùng lọc 1 xe trên màn, bấm Xuất → nhận file của **cả khu vực**. Đây là lỗi tồn (R4), không phải thiết kế.

### 2.4 Bề mặt C — wizard báo cáo chính thức

- 3 bước: `month` → `regions` → review + xác nhận — [`reports/new/page.tsx:34-104`](../../apps/web/src/app/(app)/truck/reports/new/page.tsx#L34).
- Bước 2 **đã có sẵn đúng pattern "1 – nhiều – Tất cả"** mà KH mô tả, nhưng trên **trục khu vực**: checkbox multi-select + toggle "Tất cả khu vực" loại trừ lẫn nhau — [`report-region-step.tsx:36-57`](../../apps/web/src/app/(app)/truck/reports/_components/report-region-step.tsx#L36).
- Phạm vi xe của 1 báo cáo = **toàn bộ** TRUCK còn sống trong khu vực, kể cả xe idle/bảo dưỡng không chạy chuyến nào — [`truck-report-export.queries.ts:272-291`](../../apps/web/src/server/queries/truck-report-export.queries.ts#L272).
- Bảng `car_truck_reports` chỉ có cột phạm vi `trr_region`, **không có** cột phạm vi theo xe — [`truck-report.schema.ts:46`](../../packages/db/src/schema/truck-report.schema.ts#L46).

⇒ Ở bề mặt C, yêu cầu "lập báo cáo cho tất cả các xe 1 lúc" **đã được đáp ứng sẵn**.

### 2.5 Vấn đề

| # | Vấn đề | Hệ quả |
|---|---|---|
| P1 | Bộ lọc xe là single-select ở cả A và B | Muốn báo cáo 5 xe phải thao tác 5 lần, ghép Excel thủ công → đúng pain point của KH |
| P2 | `/truck/pnl/export` bỏ qua bộ lọc xe | File tải về ≠ màn hình đang xem; kể cả single-select cũng đã sai |
| P3 | `/truck/finance/export` **không áp ACL khu vực** — không truyền `region`/`regions` vào query ([`route.ts:35`](../../apps/web/src/app/(app)/truck/finance/export/route.ts#L35)) trong khi màn hình có truyền ([`page.tsx:81`](../../apps/web/src/app/(app)/truck/finance/page.tsx#L81)) | User bị thu hẹp khu vực vẫn tải được chuyến của mọi khu vực → **lỗ hổng ACL REQ-20260813** |
| P4 | `computeTruckPnl`: khi có `vehicleId` thì filter theo xe **thay thế** filter khu vực, không giao nhau ([`truck-pnl.service.ts:147-148`](../../packages/core/src/truck/truck-pnl.service.ts#L147)) | Hiện an toàn vì caller đã validate `vehicleId ∈ trucks`; mở rộng sang mảng mà quên validate sẽ thành lỗ hổng |

---

## 3. TO-BE Yêu cầu

### 3.1 Bảng ánh xạ AS-IS → TO-BE

| Hạng mục | AS-IS | TO-BE |
|---|---|---|
| Tham số URL lọc xe | `?vehicle=<uuid>` (1 giá trị) | `?vehicles=<uuid>,<uuid>,…` — vắng mặt / rỗng = **Tất cả xe**. Giữ `?vehicle=` đọc được để không gãy link cũ |
| UI lọc xe (finance) | `<select>` native | **Dropdown multi-select có checkbox** + dòng "Tất cả xe" + nút "Bỏ chọn" |
| UI lọc xe (pnl) | Dãy chip 1 lựa chọn | Cùng component multi-select như finance (thống nhất 2 tab) |
| Nhãn nút lọc | "Tất cả xe" / biển số | "Tất cả xe" · "51C-12345" · "**{n} xe**" khi chọn ≥ 2 |
| Query trips | `vehicleId?: string \| null` | thêm `vehicleIds?: readonly string[]` (ưu tiên hơn `vehicleId`) |
| Query P&L | `vehicleId` ghi đè scope khu vực | thêm `vehicleIds`, **giao** với `regionVehicleIds` thay vì ghi đè |
| `/truck/finance/export` | `?vehicle=` · **không có ACL** | `?vehicles=` + **truyền `regions` theo ACL** (vá P3) |
| `/truck/pnl/export` | bỏ qua xe | nhận `?vehicles=` + ACL; nhiều xe → **1 cột / xe + cột TỔNG** |
| Wizard `/truck/reports/new` | region-scope | **giữ nguyên** (R6) |
| DB | `car_truck_reports.trr_region` | **không đổi — không migration** |

### 3.2 Logic nghiệp vụ

**BL-1 · Giải mã phạm vi xe (dùng chung 4 điểm: 2 page + 2 route)**

```
input:  sp.vehicles ?? sp.vehicle ?? ''      (chuỗi CSV)
step 1: tách theo ',', trim, bỏ rỗng, unique
step 2: permittedTrucks = listVehicles(ent,'active','TRUCK') ∩ ACL khu vực
step 3: selected = tokens ∩ permittedTrucks.id      ← chặn ID giả mạo + ID ngoài khu vực
step 4: selected.length === 0            → scope = TẤT CẢ xe trong khu vực được phép
        selected.length === permitted.length → scope = TẤT CẢ (chuẩn hoá, bỏ param khỏi URL)
        ngược lại                        → scope = đúng tập `selected`
```

Bước 3 là điểm chốt bảo mật: mọi ID không nằm trong tập cho phép bị **loại bỏ im lặng**, không báo lỗi — cùng hành vi với `?vehicle=` hiện tại ([`finance/page.tsx:78`](../../apps/web/src/app/(app)/truck/finance/page.tsx#L78)).

**BL-2 · Số liệu không đổi công thức.** Multi-select chỉ **thu hẹp tập chuyến / tập xe** đưa vào cùng một hàm tính đang dùng (`listTruckFinanceTrips`, `computeTruckPnl`). Không đụng `loadTruckRegionSnapshots`, không đụng công thức nhiên liệu, không đổi trạng thái "Đã lập BC / Tạm tính" của bất kỳ chuyến nào.

**BL-3 · Trích xuất ≠ chốt sổ.** File tải từ A/B **không** ghi `car_truck_reports`, **không** đóng băng snapshot. Đây là ranh giới bắt buộc — xem §6.1.

**BL-4 · Nhãn phạm vi trong file.** File xuất chèn 1 dòng phạm vi ngay dưới tiêu đề:
`Phạm vi: Tất cả xe (8)` / `Phạm vi: 3/8 xe — 51C-111.11, 51C-222.22, 51C-333.33`.

### 3.3 Thiết kế UI

Component mới `ParamMultiSelect` (`apps/web/src/components/inputs/param-multi-select.tsx`), client component, ghi `?{param}=a,b,c` giữ nguyên các param khác — cùng hợp đồng với [`ParamSelect`](../../apps/web/src/components/inputs/param-select.tsx) đang có.

```
┌─ Phương tiện: 3 xe  ▾ ─────────┐     ← nút, nhãn theo số lượng đang chọn
└────────────────────────────────┘
  ▼ mở popover
┌────────────────────────────────┐
│ ☑ Tất cả xe                    │  ← chọn = xoá param (về mặc định)
├────────────────────────────────┤
│ ☑ 51C-111.11   HCM             │
│ ☑ 51C-222.22   HCM             │
│ ☐ 51C-333.33   Đồng Nai        │
│ ☑ 51D-444.44   Đồng Nai        │
├────────────────────────────────┤
│ Bỏ chọn tất cả      [ Áp dụng ]│  ← "Áp dụng" mới push URL (1 lần điều hướng)
└────────────────────────────────┘
```

Ghi chú thiết kế:
- Dùng lại đúng ngữ nghĩa toggle + ô check vuông của [`report-region-step.tsx:106-139`](../../apps/web/src/app/(app)/truck/reports/_components/report-region-step.tsx#L106) để 2 màn nhất quán.
- Chỉ push URL khi bấm **Áp dụng** → tránh SSR re-query mỗi lần tick (khác `ParamSelect` vốn push ngay).
- Mobile: popover chuyển thành bottom sheet full-width, hàng cao 44px (đã có tiền lệ ở bảng phân quyền — commit `03b4e0f`).
- Nút **Xuất Excel** trên `/truck/finance` chỉ hiện khi `rows.length > 0` ([`finance/page.tsx:167`](../../apps/web/src/app/(app)/truck/finance/page.tsx#L167)) — giữ nguyên hành vi này khi tập xe chọn ra 0 chuyến.

### 3.4 Layout file xuất khi chọn nhiều xe

| Route | 1 xe | Nhiều xe / Tất cả |
|---|---|---|
| `/truck/finance/export` | y như hiện tại | **Giữ nguyên 1 sheet** — bảng vốn đã có cột `Phương tiện`, chỉ thêm dòng phạm vi (BL-4). Sắp xếp: biển số → ngày |
| `/truck/pnl/export` (xlsx) | 2 cột: `Chỉ tiêu` \| `giá trị` | `Chỉ tiêu` \| 1 cột **mỗi xe** \| cột **TỔNG** cuối |
| `/truck/pnl/export` (pdf) | như trên | như trên; > 6 xe → xoay ngang khổ giấy |

---

## 4. Phân tích Gap

### 4.1 Bảng phạm vi thay đổi

| Khu vực | Hiện tại | Thay đổi | Mức ảnh hưởng |
|---|---|---|---|
| DB | `trr_region` | **không đổi** | ⬜ Không |
| Core service | `computeTruckPnl` nhận `vehicleId` | thêm `vehicleIds`, giao với scope khu vực | 🟡 Trung bình — dùng chung bởi dashboard/report/finance |
| Query layer | `listTruckFinanceTrips` nhận `vehicleId` | thêm `vehicleIds` | 🟢 Thấp — thêm nhánh, giữ nguyên đường cũ |
| Route xuất file | 2 route | nhận `?vehicles=`, **thêm ACL khu vực** | 🔴 Cao — vá lỗ hổng P3 |
| UI | `ParamSelect` / chips | component mới `ParamMultiSelect` | 🟡 Trung bình |
| Wizard báo cáo | region-scope | **không đụng** | ⬜ Không |
| Template R1 | `MONTHLY_SUMMARY` | **không đụng** | ⬜ Không |
| i18n | — | ~8 key × 3 ngôn ngữ | 🟢 Thấp |

### 4.2 Danh sách file thay đổi

| Lớp | File | Loại |
|---|---|---|
| UI | `apps/web/src/components/inputs/param-multi-select.tsx` | **Mới** |
| UI | `apps/web/src/app/(app)/truck/finance/page.tsx` | Sửa |
| UI | `apps/web/src/app/(app)/truck/pnl/page.tsx` | Sửa |
| UI | `apps/web/src/app/(app)/truck/finance/_components/finance-tabs.tsx` | Sửa (mang `vehicles` qua lại 2 tab) |
| Route | `apps/web/src/app/(app)/truck/finance/export/route.ts` | Sửa (+ vá ACL P3) |
| Route | `apps/web/src/app/(app)/truck/pnl/export/route.ts` | Sửa (+ vá P2) |
| Query | `apps/web/src/server/queries/truck-finance.queries.ts` | Sửa |
| Core | `packages/core/src/truck/truck-pnl.service.ts` | Sửa |
| Lib | `apps/web/src/lib/auth/region-access.ts` — thêm `resolveVehicleScope()` (BL-1) | Sửa |
| i18n | `apps/web/messages/{vi,en,ko}.json` | Sửa |
| DB | — | **Không có** |

### 4.3 Chiến lược migration DB

**Không cần migration.** Migration mới nhất trong repo là [`0026_truck_region_access.sql`](../../packages/db/migrations/0026_truck_region_access.sql) và đợt này không thêm cột/bảng nào. (Lưu ý vận hành: 0026 vẫn đang chờ áp thủ công trên staging/prod — độc lập với REQ này, không phải điều kiện tiên quyết.)

---

## 5. Luồng Người dùng

### 5.1 Kịch bản chính — xuất báo cáo 3 xe cùng lúc

```
Admin/Manager  →  Menu "Chi phí & Lợi nhuận"  →  /truck/finance
   │
   ├─ chọn Tháng: 07/2026
   ├─ chọn Khu vực: HCM            (giữ nguyên, single-select như cũ)
   ├─ mở dropdown "Phương tiện"
   │     ☑ 51C-111.11
   │     ☑ 51C-222.22
   │     ☑ 51D-444.44   →  [Áp dụng]
   │        └─ URL: /truck/finance?month=2026-07&region=HCM&vehicles=<id1>,<id2>,<id3>
   │        └─ nhãn nút: "3 xe"
   │
   ├─ bảng chuyến + thẻ P&L re-render cho đúng 3 xe
   │
   └─ [Xuất Excel]
         └─ /truck/finance/export?month=2026-07&region=HCM&vehicles=<id1>,<id2>,<id3>
         └─ 1 file .xlsx · dòng phạm vi "Phạm vi: 3/8 xe — 51C-111.11, 51C-222.22, 51D-444.44"
```

### 5.2 Phân nhánh theo điều kiện

```
Tập xe chọn
 ├─ rỗng / bằng toàn bộ  ──► scope = TẤT CẢ xe trong khu vực được phép
 │                            (param bị xoá khỏi URL — link sạch, chia sẻ được)
 ├─ đúng 1 xe            ──► hành vi y hệt AS-IS (không hồi quy)
 └─ 2..n xe              ──► lọc theo tập; nhãn "{n} xe"; file có dòng phạm vi

User bị thu hẹp khu vực (REQ-20260813)
 ├─ danh sách xe trong dropdown  = chỉ xe thuộc khu vực được phép
 ├─ "Tất cả xe"                  = tất cả xe TRONG khu vực được phép (không phải toàn đội)
 └─ ?vehicles= chứa ID ngoài phạm vi ──► ID đó bị LOẠI im lặng (BL-1 bước 3)

Tập xe chọn ra 0 chuyến trong tháng
 ├─ bảng hiện empty state hiện có
 └─ nút "Xuất Excel" ẩn (giữ nguyên điều kiện rows.length > 0)
```

### 5.3 Luồng KHÔNG đổi

```
/truck/reports/new  →  ① Chọn tháng  →  ② Chọn khu vực  →  ③ Xác nhận & Lập báo cáo
                                         (multi-select khu vực đã có sẵn)
   └─ mỗi báo cáo vẫn phủ TOÀN BỘ xe của khu vực — kể cả xe bảo dưỡng / 0 chuyến
   └─ vẫn ghi car_truck_reports + đóng băng snapshot nhiên liệu
```

---

## 6. Ràng buộc Kỹ thuật

### 6.1 ⛔ Vì sao KHÔNG đưa multi-select xe vào wizard báo cáo chính thức (R6)

Đây là ràng buộc quan trọng nhất của REQ này.

1. Mỗi lần "Lập báo cáo", hệ thống **tính lại và đóng băng** đối soát nhiên liệu vào chính row báo cáo: `trr_avg_price`, `trr_consumption`, `trr_total_liters`, `trr_total_km`, `trr_vehicle_fuel` — [`truck-report.actions.ts:206-257`](../../apps/web/src/server/actions/truck-report.actions.ts#L206).
2. Mọi màn hình đọc **report mới nhất theo `(ent, month, region)`** làm số chính thức. `latestByScope` ghi đè theo thứ tự tạo, và khi row mới có `trrVehicleFuel` thì **xoá luôn** snapshot cấp khu vực: `snap.delete(key)` — [`truck-fuel-snapshot.ts:200-225`](../../packages/core/src/truck/truck-fuel-snapshot.ts#L200).
3. ⇒ Lập báo cáo cho **2/8 xe** *sau* một báo cáo đầy đủ sẽ khiến 6 xe còn lại **mất snapshot**, rơi về `livePool` → chi phí nhiên liệu và lợi nhuận của những chuyến **đã chốt** đổi số. Đây là hồi quy dữ liệu thật, không phải rủi ro lý thuyết.
4. `reportedAt` cũng bị đẩy lên mốc mới → các chuyến sửa giữa 2 lần báo cáo bị coi là "đã được phủ" sai.
5. Template R1 (`MONTHLY_SUMMARY`) có block KPI tính trên **toàn khu vực**: `truckCount`, `activeCount`, `maintenanceCount`, `avgTripsPerActive`, `avgKmPerActive` — [`truck-report-export.queries.ts:414-433`](../../apps/web/src/server/queries/truck-report-export.queries.ts#L414). Lọc còn 3/8 xe thì dòng TỔNG và các chỉ số trung bình không còn reconcile với biểu mẫu KH đã duyệt.

**Kết luận**: "chốt sổ" phải phủ trọn khu vực. Nhu cầu "báo cáo theo tập xe" được đáp ứng bằng **bản trích xuất** (A/B) — đúng thứ KH đang làm thủ công.

### 6.2 Bảo mật

| # | Ràng buộc |
|---|---|
| S1 | Mọi `vehicleId` từ URL phải giao với tập xe hợp lệ theo ACL khu vực (BL-1 bước 3) — kể cả ở route xuất file, vốn **bỏ qua guard của layout `/truck`** |
| S2 | Vá P3: `/truck/finance/export` phải truyền `regions` theo ACL vào `listTruckFinanceTrips` |
| S3 | `computeTruckPnl`: `vehicleIds` phải **giao** với `regionVehicleIds`, không được ghi đè như nhánh `vehicleId` hiện tại ([`truck-pnl.service.ts:147`](../../packages/core/src/truck/truck-pnl.service.ts#L147)) |
| S4 | Giữ nguyên gate `role !== 'DRIVER' && hasFleet(user,'TRUCK')` ở cả 2 route |

### 6.3 Hiệu năng

- `computeTruckPnl` được gọi **1 lần / xe** ở đường report ([`truck-report-export.queries.ts:338`](../../apps/web/src/server/queries/truck-report-export.queries.ts#L338)). Đường P&L nhiều cột cũng cần 1 lần/xe → với 8–10 xe là chấp nhận được (đã chạy như vậy ở report), nhưng phải `Promise.all`, không tuần tự.
- URL `?vehicles=` với 10 UUID ≈ 370 ký tự — an toàn dưới mọi giới hạn.

### 6.4 Tương thích

- `?vehicle=<uuid>` (số ít) vẫn đọc được → link/bookmark cũ và `FinanceTabs` không gãy trong giai đoạn chuyển tiếp.
- Không đổi hợp đồng của `ParamSelect` → các dropdown khác (Khu vực, Trạng thái) không bị ảnh hưởng.
- Không đổi tên/định dạng file khi chỉ chọn 1 xe → thói quen người dùng hiện tại giữ nguyên.

---

## 7. Giả định & Điểm chờ Khách xác nhận

REQ này được viết theo 4 giả định dưới đây. Cả 4 đều **không chặn** việc triển khai; nếu KH trả lời khác, điều chỉnh nằm trong phạm vi đã mô tả.

| # | Giả định | Nếu KH trả lời khác |
|---|---|---|
| **GĐ-1** | KH muốn multi-select ở màn **Chi phí & Lợi nhuận** (bề mặt A/B), không phải ở wizard báo cáo chính thức | Nếu KH thực sự muốn ở wizard → phải mở REQ riêng và giải quyết §6.1 trước (đề xuất: thêm loại "bản trích xuất" không ghi snapshot) |
| **GĐ-2** | Chọn nhiều xe → **1 file gộp** (finance giữ 1 sheet; pnl 1 cột/xe + TỔNG) | Nếu muốn 1 sheet/xe → chỉ đổi tầng dựng workbook, +0.5 ngày |
| **GĐ-3** | Được phép chọn xe **thuộc nhiều khu vực khác nhau** trong cùng 1 lần (miễn nằm trong ACL); bộ lọc Khu vực và bộ lọc Xe hoạt động độc lập | Nếu KH muốn khoá xe theo đúng 1 khu vực → thêm ràng buộc ở BL-1, đơn giản hơn |
| **GĐ-4** | Cột `FALSE / FALSE / TRUE` **chưa xác định ngữ nghĩa** → chưa đưa vào phạm vi | Nếu đó là quyền theo role (Driver/Manager/Admin) thì requirement đang nói **chỉ ADMIN** được lập báo cáo — trong khi code hiện cho cả `ADMIN` và `MANAGER` ([`truck-report.actions.ts:316`](../../apps/web/src/server/actions/truck-report.actions.ts#L316)). Đây sẽ là **yêu cầu thứ 2** ẩn trong dòng này → cần REQ/PLAN riêng |

---

## 8. Ước lượng

| Hạng mục | Công |
|---|---|
| `ParamMultiSelect` + wire 2 page | 0.5 ngày |
| Query/core nhận `vehicleIds` + giao với ACL | 0.5 ngày |
| 2 route xuất file (+ vá P2, P3) | 0.5 ngày |
| i18n 3 ngôn ngữ + TC + kiểm thử | 0.5 ngày |
| **Tổng** | **~2 ngày** |

Không có migration DB → không có bước áp SQL thủ công lên staging/production.

---

## 9. Bước tiếp theo

1. ✅ REQ (tài liệu này)
2. ⬜ `docs/plan/PLAN-20260814-truck-report-multi-vehicle.md`
3. ⬜ `docs/test/TC-20260814-truck-report-multi-vehicle.md`
4. ⏸️ **Cổng duyệt của người dùng** — chờ chỉ thị "triển khai" trước khi viết code
5. ⬜ Triển khai → TR → RPT

> Ghi chú tách việc: P3 (lỗ hổng ACL ở `/truck/finance/export`) là **lỗi bảo mật độc lập** với yêu cầu này. Có thể tách thành hotfix riêng nếu muốn vá sớm hơn.
