# REQ-20260916 — Thêm loại chi phí cố định + hóa đơn riêng cho chuyến đi Truck

> **Yêu cầu gốc (2026-09-16, nguyên văn khách hàng)**
> "trong phần chuyến đi, em thêm giúp chị CỐ ĐỊNH các chi phí phát sinh sau: Phí vệ sinh phương tiện / Phí sửa chữa /
> Phí cầu phà / Phí bốc dỡ hàng hóa / + Thêm khoản phí. Ở mục hóa đơn thì cho đính kèm Hóa đơn nhiên liệu / Hóa đơn
> cầu đường / Hóa đơn vệ sinh phương tiện / Hóa đơn sửa chữa / Hóa đơn cầu phà / Hóa đơn bốc dỡ hàng hóa / Hóa đơn khác"

Phạm vi: workspace **TRUCK** của `apps/app-car-manager-v2` (`/truck/*`, `car_trips.trp_kind='LOG'`). Không đụng phân hệ
CAR (car_expenses, 8 loại chi phí PRD — Fuel/Oil/Accident/Meal/Repair/Parking/Toll/Inspection).

⚠️ **Lưu ý thuật ngữ**: "CỐ ĐỊNH" trong yêu cầu này nghĩa là **trường nhập luôn hiển thị / có tên cố định** (giống
cách `Phí cầu đường` đang có hôm nay) — **KHÔNG** liên quan đến khái niệm "chi phí cố định" (Lương + Khấu hao phân bổ
theo tháng, không theo chuyến — xem [REQ-20260908](REQ-20260908-truck-fixed-cost-no-per-trip-alloc.md)). Hai khái
niệm trùng chữ "cố định" nhưng khác hẳn phạm vi — ghi chú lại để tránh nhầm khi đọc code sau này.

## 1. Yêu cầu

| # | Yêu cầu | Loại |
|---|---|---|
| R1 | Thêm 4 trường chi phí **cố định** mới trên form tạo/sửa chuyến và form hoàn thành chuyến (cùng tầng với `Phí cầu đường` hiện có): **Phí vệ sinh phương tiện**, **Phí sửa chữa**, **Phí cầu phà**, **Phí bốc dỡ hàng hóa** | Chức năng |
| R2 | Giữ nguyên nút **"+ Thêm khoản phí"** (freeform, đã có sẵn) cho các khoản phát sinh khác không thuộc 4 loại ở R1 | Chức năng (không đổi) |
| R3 | Mục hóa đơn/chứng từ hỗ trợ đính kèm theo **7 nhóm riêng biệt**: Nhiên liệu, Cầu đường, Vệ sinh phương tiện, Sửa chữa, Cầu phà, Bốc dỡ hàng hóa, Khác — thay vì 3 nhóm hiện tại (Nhiên liệu/Cầu đường/Phí phát sinh gộp chung) | Chức năng |
| R4 | 4 khoản phí mới phải cộng vào **Tổng chi phí** và trừ vào **Lợi nhuận** của chuyến (giống cách `Phí cầu đường` đang cộng hôm nay), và phản ánh nhất quán ở P&L / dashboard tài chính / báo cáo tháng | Chức năng |
| R5 | Không phá dữ liệu chuyến cũ — 4 trường mới nullable, mặc định trống/0, chuyến đã tạo trước đây vẫn mở/sửa/hiển thị bình thường | Phi chức năng |
| R6 | i18n đầy đủ 3 ngôn ngữ (vi/en/ko) cho toàn bộ label mới | Phi chức năng |

## 2. AS-IS

**Chi phí cố định hiện có** — chỉ có 1 trường ngoài nhiên liệu: `Phí cầu đường` (toll), là **cột scalar trên
`car_trips`**, không phải dòng trong bảng phụ:
- Schema: `trpTollFee` — [trips.schema.ts:85](../../packages/db/src/schema/trips.schema.ts#L85) — `DECIMAL(14,2)` nullable.
- Zod: `toll_fee` xuất hiện ở cả `createTruckTripSchema` ([truck-trip.zod.ts:81](../../packages/shared/src/zod/truck-trip.zod.ts#L81)) và `completeTruckTripSchema` ([:121](../../packages/shared/src/zod/truck-trip.zod.ts#L121)) — nhập được ở **cả 2 form** (Manager tạo/sửa VÀ Driver hoàn thành).
- i18n key `toll` = "Phí cầu đường" (vi) / "Toll fee" (en) / "통행료" (ko) — dùng ở 3 namespace: `screens.truckTrips.form`, `screens.truckComplete`, `screens.truckTripDetail`.

**Khoản phí tự do (freeform)** — đã có sẵn, đúng như R2 mô tả:
- Bảng `car_trip_extra_costs` (`{tec_name, tec_amount}`) — [trip-extra-cost.schema.ts](../../packages/db/src/schema/trip-extra-cost.schema.ts), xoá+chèn lại toàn bộ mỗi lần sửa/hoàn thành chuyến.
- Nút UI hiện tại i18n key `extraAdd` = **"+ Thêm khoản phí"** (vi) — khớp Y HỆT text trong yêu cầu khách hàng → xác nhận khách muốn **giữ nguyên** nút này, không thay thế.

**Hóa đơn/chứng từ hiện có** — 3 nhóm (REQ-20260709), theo `tca_cost_kind VARCHAR(10)` trên bảng
`car_trip_cost_attachments` ([trip-cost-attachment.schema.ts:27](../../packages/db/src/schema/trip-cost-attachment.schema.ts#L27)), enum ứng dụng `tripCostKindSchema = z.enum(['FUEL','TOLL','EXTRA'])` ([truck-trip.zod.ts:29](../../packages/shared/src/zod/truck-trip.zod.ts#L29)):

| Nhóm hiện tại | Label vi | Khớp yêu cầu KH? |
|---|---|---|
| `FUEL` | "Hóa đơn nhiên liệu" | ✅ đã có, đúng tên |
| `TOLL` | "Hóa đơn cầu đường" | ✅ đã có, đúng tên |
| `EXTRA` | "Chứng từ phí phát sinh" (gộp chung mọi khoản tự do) | ⚠️ có tồn tại nhưng gộp chung, chưa tách theo loại; tên chưa khớp "Hóa đơn khác" |
| — | — | ❌ chưa có: Vệ sinh phương tiện, Sửa chữa, Cầu phà, Bốc dỡ hàng hóa |

Giới hạn hiện tại: `TRUCK_COST_ATTACHMENT_MAX_PER_KIND = 10` (mỗi nhóm tối đa 10 file), và tổng
`costAttachmentsField` cap **`.max(30)`** với comment "30 = 3 buckets × 10 each"
([truck-trip.zod.ts:46](../../packages/shared/src/zod/truck-trip.zod.ts#L46)) — **cứng theo số nhóm hiện tại (3)**,
sẽ cần tăng khi có 7 nhóm.

**Nơi `toll_fee` được dùng** (mỗi chỗ này khi thêm 4 loại phí mới đều cần cập nhật tương ứng):
- Tính chi phí thuần: `computeTruckCost()` — [truck-cost.ts](../../packages/core/src/truck/truck-cost.ts) — `totalCost = fuelCost + tollFee + extraTotal`.
- Đọc/ghi DB: [truck-trip.service.ts](../../packages/core/src/truck/truck-trip.service.ts) (create/update/complete).
- P&L theo tháng/xe: [truck-pnl.service.ts](../../packages/core/src/truck/truck-pnl.service.ts) — `variableCost = fuelCost + tollFee + extraTotal`.
- Dashboard tài chính: [truck-finance.queries.ts](../../apps/web/src/server/queries/truck-finance.queries.ts).
- **Báo cáo tháng Excel** (định dạng đã chốt với khách — R1, xem REQ-20260713): [truck-report-export.queries.ts](../../apps/web/src/server/queries/truck-report-export.queries.ts) — `ReportTripLogRow.toll`, `ReportVehiclePnlRow.toll`.
- Import Excel hàng loạt: [import.actions.ts:158](../../apps/web/src/server/actions/imports/import.actions.ts#L158).
- Form tạo/sửa: [truck-trip-form.tsx](../../apps/web/src/app/\(app\)/truck/trips/_components/truck-trip-form.tsx) (dòng ~566-585: `MoneyInput` + `receiptsBlock`).
- Form hoàn thành (driver): [truck-complete-section.tsx](../../apps/web/src/components/truck/truck-complete-section.tsx).
- Xem chi tiết (read-only): [truck-trip-detail.tsx](../../apps/web/src/app/\(app\)/trips/\[id\]/_components/truck-trip-detail.tsx) — `CostRow` + `receiptGroups`.
- Seed cho form hoàn thành: [truck-complete-initial.ts](../../apps/web/src/lib/truck-complete-initial.ts).

## 3. TO-BE

| Khoản | AS-IS | TO-BE |
|---|---|---|
| Phí vệ sinh phương tiện | không có | Cột mới `trp_cleaning_fee` trên `car_trips` — cùng tầng `trp_toll_fee` |
| Phí sửa chữa | không có (chỉ có `REPAIR` bên module Expense app CAR, **khác domain**) | Cột mới `trp_repair_fee` trên `car_trips` |
| Phí cầu phà | không có (khác với `Phí cầu đường`/toll) | Cột mới `trp_ferry_fee` trên `car_trips` |
| Phí bốc dỡ hàng hóa | không có | Cột mới `trp_loading_fee` trên `car_trips` |
| Khoản phí tự do | `car_trip_extra_costs` + nút "+ Thêm khoản phí" | Giữ nguyên 100% |
| `tripCostKindSchema` | `['FUEL','TOLL','EXTRA']` | `['FUEL','TOLL','CLEANING','REPAIR','FERRY','LOADING','EXTRA']` (giữ `EXTRA` làm mã nội bộ cho nhóm "Khác" — không đổi tên mã để khỏi phải migrate dữ liệu cũ, chỉ đổi **label hiển thị** thành "Hóa đơn khác") |
| Zod `createTruckTripSchema` / `completeTruckTripSchema` | có `toll_fee` | + `cleaning_fee`, `repair_fee`, `ferry_fee`, `loading_fee` (đều `z.number().nonnegative().optional()`) |
| `costAttachmentsField` cap | `.max(30)` (3×10) | `.max(70)` (7×10) |
| `computeTruckCost` | `totalCost = fuelCost + tollFee + extraTotal` | `totalCost = fuelCost + tollFee + cleaningFee + repairFee + ferryFee + loadingFee + extraTotal` |
| P&L `variableCost` | `fuelCost + tollFee + extraTotal` | + 4 khoản mới (đồng bộ công thức với `truck-cost.ts`) |
| UI form tạo/sửa + hoàn thành | 1 `MoneyInput` (Toll) + 3 nhóm hóa đơn | + 4 `MoneyInput` mới + 4 nhóm hóa đơn mới (tổng 7 nhóm) |
| UI chi tiết chuyến | `CostRow` Toll + `receiptGroups` 3 nhóm | + 4 `CostRow` mới + `receiptGroups` 7 nhóm |
| Báo cáo tháng Excel | cột `toll` riêng, phí khác gộp vào `extra`/`extraNote` | **Cần quyết định** (xem §6): thêm 4 cột riêng, hay gộp 4 khoản mới vào cột `extra` hiện có và chỉ tách trên UI app |
| i18n | `toll` + `extraReceipts`("Chứng từ phí phát sinh") | + 4 field label + 4 receipt label mới; đổi text `extraReceipts`/`receiptsExtra` → "Hóa đơn khác" (vi), "Other invoice" (en), tương đương (ko) |

## 4. Gap & phạm vi

| Vùng | Hiện tại | Thay đổi | Ảnh hưởng |
|---|---|---|---|
| DB (`car_trips`) | 1 cột phí cố định (`trp_toll_fee`) | + 4 cột `DECIMAL(14,2)` nullable, migration `ALTER TABLE ADD COLUMN IF NOT EXISTS` | Thấp — chỉ thêm cột, không đổi cột cũ |
| DB (`car_trip_cost_attachments.tca_cost_kind`) | `VARCHAR(10)`, không phải Postgres ENUM | Thêm 4 giá trị mới ở tầng ứng dụng (zod) — không cần ALTER TYPE vì là varchar | Thấp |
| Shared (zod) | `tripCostKindSchema` 3 giá trị, cap attachment 30 | Mở rộng enum + field mới + cap 70 | Trung bình — nếu quên tăng cap 30→70 sẽ lỗi validate khi user đính kèm nhiều hóa đơn ở nhóm mới |
| Core (`truck-cost.ts`, `truck-pnl.service.ts`) | Công thức 3 thành phần | Công thức 7 thành phần | Trung bình — đổi số Lợi nhuận hiển thị ngay khi nhập phí mới, cần test kỹ regression (chuyến không có 4 phí mới phải ra số y hệt hôm nay) |
| Backend (`truck-trip.service.ts`, `truck-trip.actions.ts`) | Đọc/ghi `tollFee` | + đọc/ghi 4 field mới, forward đúng field name | Trung bình |
| Backend queries (`truck-finance.queries.ts`) | Aggregate có `toll` | + 4 khoản trong tổng biến phí | Trung bình |
| **Báo cáo tháng Excel** (`truck-report-export.queries.ts`) | Format đã **chốt với khách hàng** (REQ-20260713, đang có "9 deviation chờ KH duyệt" theo lịch sử dự án) | Thêm cột hoặc gộp vào `extra` | **Cao** — đổi định dạng báo cáo khách đã duyệt cần xác nhận lại, xem §6 |
| Import Excel hàng loạt (`import.actions.ts`) | Map cột `toll` | Quyết định có thêm cột mới vào template import hay để 4 khoản mới = optional/bỏ trống khi import cũ | Trung bình — phụ thuộc quyết định ở trên |
| Frontend — form tạo/sửa (`truck-trip-form.tsx`) | 1 field Toll + 3 nhóm hóa đơn | + 4 field + 4 nhóm hóa đơn | Trung bình |
| Frontend — form hoàn thành (`truck-complete-section.tsx`) | tương tự | tương tự | Trung bình |
| Frontend — chi tiết chuyến (`truck-trip-detail.tsx`) | `CostRow` Toll + 3 nhóm hiển thị | + 4 `CostRow` + 4 nhóm hiển thị | Trung bình |
| Frontend — trang `today/truck/[id]`, `truck/trips/[id]` (driver + staff) | Truyền props qua `TruckTripDetail`/`TruckCompleteSection` | Cập nhật mapping props | Thấp-trung bình (chủ yếu cơ học) |
| i18n | 3 file `vi/en/ko.json` | + ~16 key mới (4 field × label + 4 receipt × label, ở 3 namespace) | Thấp |

## 5. User Flow

```
Manager tạo/sửa chuyến HOẶC Driver hoàn thành chuyến
  └─ Nhập Phí cầu đường (đã có) + Phí vệ sinh phương tiện / Sửa chữa / Cầu phà / Bốc dỡ hàng hóa (MỚI)
       └─ [tùy chọn] vẫn có thể bấm "+ Thêm khoản phí" cho khoản không nằm trong 4 loại trên
  └─ Mục "Hóa đơn / chứng từ" hiển thị 7 nhóm để đính kèm (thay vì 3):
       Nhiên liệu · Cầu đường · Vệ sinh phương tiện · Sửa chữa · Cầu phà · Bốc dỡ hàng hóa · Khác
       └─ mỗi nhóm tối đa 10 file (giữ nguyên hành vi hiện tại), tổng tối đa 70 (7×10)
  └─ Submit → car_trips (4 cột phí mới) + car_trip_cost_attachments (cost_kind mới)
Xem chi tiết chuyến đã hoàn thành
  └─ Card "Chi phí chuyến" hiển thị đủ 7 dòng phí (Nhiên liệu/Cầu đường/Vệ sinh/Sửa chữa/Cầu phà/Bốc dỡ/phí tự do) + Tổng chi phí + Lợi nhuận
  └─ Card "Hóa đơn / chứng từ" hiển thị đủ 7 nhóm (ẩn nhóm rỗng, giữ hành vi hiện tại)
Chuyến đã tạo TRƯỚC khi có tính năng này
  └─ 4 cột mới = NULL → hiển thị 0/để trống, không lỗi, sửa/hoàn thành bình thường
Dashboard tài chính / Báo cáo tháng
  └─ 4 khoản mới cộng vào biến phí, trừ vào lợi nhuận — số liệu đổi ngay từ chuyến đầu tiên có nhập phí mới
```

## 6. Ràng buộc kỹ thuật & câu hỏi cần xác nhận với khách hàng

- **Không đổi module Expense của app CAR** (`car_expenses`, `expenseTypeEnum` 8 loại) — dù `REPAIR` trùng tên, đây là
  domain hoàn toàn khác (có luồng duyệt/ngưỡng auto-approve riêng theo CLAUDE.md §4.8). Chỉ thêm cột mới bên
  `car_trips`/truck, không sửa file nào của Expense.
- **Cap tổng attachment phải tăng 30 → 70** khi mở rộng từ 3 lên 7 nhóm ([truck-trip.zod.ts:46](../../packages/shared/src/zod/truck-trip.zod.ts#L46)) — dễ bỏ sót vì con số 30 không tự động theo số lượng enum.
- **Nhóm "Khác" giữ mã nội bộ `EXTRA`**, chỉ đổi label hiển thị thành "Hóa đơn khác" — tránh phải migrate dữ liệu
  `tca_cost_kind='EXTRA'` đã lưu cho các chuyến cũ.
- ✅ **Đã quyết định (2026-09-17, đảo ngược đề xuất mặc định ban đầu)**: báo cáo tháng Excel (`truck-report-export.queries.ts`
  + `truck-monthly-summary-workbook.ts`) và file xuất "Danh sách chuyến đi" (`truck/trips/export/route.ts`) đều hiển
  thị **4 dòng/cột riêng** cho 4 khoản phí mới, KHÔNG gộp vào "Chi phí phát sinh". Báo cáo tháng: thêm dòng B21-B24,
  mọi dòng bên dưới dịch xuống 5 dòng so với template R1 gốc (không còn khớp 1:1 với form giấy — chấp nhận đánh đổi
  này để đổi lấy sự rõ ràng). Tổng chi phí/lợi nhuận không đổi, chỉ redistribute qua nhiều dòng hơn.
- ✅ **Đã quyết định (2026-09-17, follow-up)**: khoản "chi phí phát sinh" tự do (tên+số tiền tự nhập, "+ Thêm khoản
  phí") cũng phải liệt kê rõ tên **và số tiền thật của từng khoản**, mỗi khoản một dòng riêng (không gộp chung 1 dòng
  text, không hiện số 0/giả), và bỏ qua hoàn toàn khi tháng đó không có khoản tự do nào. Báo cáo tháng: sau dòng
  "Chi phí phát sinh" (tổng), chèn 0..N dòng text "        {Tên}: {Số tiền}" — một dòng cho mỗi tên phân biệt, số tiền
  là tổng thật gộp theo tên trong tháng/phạm vi (bỏ qua item tên rỗng hoặc số tiền = 0). Vì số dòng phụ thuộc dữ liệu,
  toàn bộ layout từ dòng 19 trở đi trong `truck-monthly-summary-workbook.ts` đã đổi từ số dòng cứng sang con trỏ
  (`next()`) — không còn phải tự đánh lại số dòng thủ công mỗi lần thêm dòng. File xuất "Danh sách chuyến đi": cột
  "Ghi chú phát sinh" đổi từ chỉ liệt kê tên sang "{Tên}: {Số tiền}" cho từng khoản của chuyến đó, cùng quy tắc bỏ qua
  tên rỗng/số tiền 0. Verify bằng cách generate lại cả 2 file với dữ liệu thật — tổng số tiền breakdown khớp chính xác
  với dòng tổng ở mọi trường hợp.
- ❓ **Cần xác nhận KH**: 4 khoản phí mới có tính vào **Lợi nhuận** (trừ trực tiếp như Toll) ngay, hay chỉ hiển thị
  để theo dõi (không đổi công thức lợi nhuận) ở giai đoạn đầu? Yêu cầu gốc dùng từ "chi phí phát sinh" giống Toll nên
  mặc định coi là **có tính vào lợi nhuận** — nêu rõ để KH xác nhận trước khi merge vì số lợi nhuận hiển thị trên
  staging sẽ đổi ngay.
- i18n bắt buộc 3 ngôn ngữ cho toàn bộ text mới (CLAUDE.md gốc).
- Multi-tenancy: 4 cột mới nằm trên `car_trips` đã có `ent_id` — không cần thêm cột `ent_id` mới, chỉ cần đảm bảo
  query/service hiện có (đã `withEnt`) không bỏ sót field mới khi SELECT/UPDATE.
