# PLN-20260916 — Thêm loại chi phí cố định + hóa đơn riêng cho chuyến đi Truck

> REQ: [REQ-20260916-truck-trip-fixed-cost-types](../analysis/REQ-20260916-truck-trip-fixed-cost-types.md)

## 1. Hiện trạng hệ thống (tóm tắt — chi tiết ở REQ §2)

- Next.js 15 App Router + Drizzle + Neon Postgres, `car_trips.trp_kind='LOG'` = truck trip-log.
- Chi phí cố định hôm nay: chỉ có `trp_toll_fee` (cột scalar trên `car_trips`), nhập được ở form tạo/sửa VÀ form
  hoàn thành. Khoản phí tự do (`car_trip_extra_costs`, nút "+ Thêm khoản phí") giữ nguyên, không đổi.
- Hóa đơn/chứng từ: 3 nhóm hiện tại (`FUEL`/`TOLL`/`EXTRA`) trên `car_trip_cost_attachments.tca_cost_kind`
  (`VARCHAR(10)`, không phải Postgres ENUM → mở rộng giá trị không cần migration kiểu dữ liệu).
- `toll_fee` xuyên suốt ~10 file (core cost calc, P&L, finance query, report export, import, 2 form, 1 detail view) —
  xem danh sách đầy đủ ở REQ §2. Mọi thay đổi ở Phase 2-6 dưới đây mirror đúng các điểm chạm này.

## 2. Kế hoạch triển khai theo Phase

### Phase 1 — DB schema + migration [làm trước, mọi phase sau phụ thuộc]
- **Step 1.1**: `packages/db/src/schema/trips.schema.ts` — thêm 4 cột sau `trpTollFee`: `trpCleaningFee`,
  `trpRepairFee`, `trpFerryFee`, `trpLoadingFee` (`decimal('trp_xxx_fee', { precision: 14, scale: 2 })`, nullable).
  └─ Side impact: chỉ thêm field vào object schema hiện có, không đổi field cũ.
- **Step 1.2**: Migration thủ công `packages/db/migrations/0034_truck_trip_fixed_cost_types.sql`:
  ```sql
  ALTER TABLE car_trips
    ADD COLUMN IF NOT EXISTS trp_cleaning_fee DECIMAL(14,2),
    ADD COLUMN IF NOT EXISTS trp_repair_fee DECIMAL(14,2),
    ADD COLUMN IF NOT EXISTS trp_ferry_fee DECIMAL(14,2),
    ADD COLUMN IF NOT EXISTS trp_loading_fee DECIMAL(14,2);
  ```
  Không cần backfill (cột mới, nullable). Idempotent theo đúng convention `0033_attachment_file_name.sql`.
  └─ Side impact: an toàn — chỉ ADD COLUMN, không ALTER/DROP cột hiện có.
- **Step 1.3**: Đăng ký migration 0034 vào `scripts/check-manual-migrations.mjs` (probe schema) — bắt buộc theo
  ghi chú trong chính migration 0033, nếu bỏ qua sẽ lặp lại sự cố FIX-260914 (báo "đã áp dụng" nhưng thực ra chưa
  chạy trên môi trường đích).
  └─ Side impact: không có, chỉ thêm entry probe.
- **Step 1.4**: Apply migration trên Neon dev branch trước → verify → staging (`ep-noisy-heart`, xem
  `reference_truck_db_branches`) → **KHÔNG** đụng production cho tới khi staging xanh (nguyên tắc CLAUDE.md gốc).

### Phase 2 — Shared contract (zod + core cost calc)
- **Step 2.1**: `packages/shared/src/zod/truck-trip.zod.ts`:
  - Mở rộng `tripCostKindSchema` → `z.enum(['FUEL','TOLL','CLEANING','REPAIR','FERRY','LOADING','EXTRA'])`.
  - Thêm `cleaning_fee`, `repair_fee`, `ferry_fee`, `loading_fee` (`z.number().nonnegative().optional()`) vào
    `createTruckTripSchema` VÀ `completeTruckTripSchema` (cả 2, giống `toll_fee`).
  - **Tăng cap `costAttachmentsField` từ `.max(30)` → `.max(70)`** (7 nhóm × 10) — cập nhật luôn comment giải thích.
  └─ Side impact: field mới optional → backward compatible với payload cũ. Quên bước tăng cap → lỗi validate khi
     user đính kèm nhiều hóa đơn ở nhóm mới (đã nêu rủi ro này ở REQ §6).
- **Step 2.2**: `packages/core/src/truck/truck-cost.ts` — mở rộng `TruckCostInput`/`TruckCostBreakdown` thêm
  `cleaningFee/repairFee/ferryFee/loadingFee`; `computeTruckCost()`:
  `totalCost = fuelCost + tollFee + cleaningFee + repairFee + ferryFee + loadingFee + extraTotal`.
  └─ Side impact: **regression bắt buộc test** — chuyến KHÔNG có 4 phí mới (null/0) phải ra `totalCost`/`profit`
     y hệt công thức cũ.

### Phase 3 — Backend service/actions/P&L/finance
- **Step 3.1**: `packages/core/src/truck/truck-trip.service.ts` — mirror đúng pattern `tollFee` cho 4 field mới ở
  cả create/update/complete (đọc từ input → ghi cột DB, đọc cột DB → trả về DTO).
  └─ Side impact: đổi luồng ghi chính của trip — test kỹ case không có 4 phí mới (giữ hành vi hiện tại).
- **Step 3.2**: `apps/web/src/server/actions/trips/truck-trip.actions.ts` — forward 4 field mới từ input đã validate
  xuống service (nếu action không dùng spread tự động).
  └─ Side impact: thấp — cơ học, theo pattern `toll_fee` đã có.
- **Step 3.3**: `packages/core/src/truck/truck-pnl.service.ts` — `variableCost` cộng thêm 4 khoản mới, đồng bộ công
  thức với Step 2.2.
  └─ Side impact: **đổi số Lợi nhuận/Biến phí hiển thị trên P&L** ngay khi có chuyến nhập phí mới — cần thông báo
     trước khi merge nếu KH đang theo dõi số trên staging (câu hỏi mở REQ §6).
- **Step 3.4**: `apps/web/src/server/queries/truck-finance.queries.ts` — mở rộng row/aggregate finance (per-trip +
  per-vehicle + fleet) để cộng 4 khoản mới vào tổng biến phí/lợi nhuận, giữ cấu trúc hiện có.
  └─ Side impact: dashboard tài chính đổi số cùng lúc với Step 3.3 — cùng 1 PR để tránh lệch số giữa 2 màn hình.

### Phase 4 — Frontend: form nhập (Manager tạo/sửa + Driver hoàn thành)
- **Step 4.1**: `apps/web/src/app/(app)/truck/trips/_components/truck-trip-form.tsx`:
  - Thêm 4 `MoneyInput` mới cạnh field Toll hiện có (dòng ~566-585), field state (`f.cleaning/repair/ferry/loading`).
  - Mở rộng `type CostKind` → 7 giá trị; `RECEIPT_LABEL` map thêm 4 entry; `receiptsBlock` loop qua 7 kind thay vì 3;
    `receipts` state init + `buildCostAttachments()` loop qua 7 kind.
  - Cập nhật client-side `totalCost` preview (dòng ~256-265) cộng thêm 4 khoản.
  └─ Side impact: form đang chạy — giữ nguyên field cũ, test lại toàn bộ submit flow (create + edit) với và không
     có 4 phí mới.
- **Step 4.2**: `apps/web/src/components/truck/truck-complete-section.tsx` — y hệt Step 4.1 (form hoàn thành của
  Driver): field mới, `CostKind`/`RECEIPT_LABEL`/`receipts` state/`buildCostAttachments`, JSX field + attachment
  block cho 4 nhóm mới.
  └─ Side impact: form driver-facing PWA — test trên mobile viewport, và test **seed lại đúng giá trị cũ** khi mở
     lại chuyến đã có dữ liệu (component có cơ chế seed từ `initial`/`existingAttachments`, phải mở rộng đủ 4 field).
- **Step 4.3**: `apps/web/src/lib/truck-complete-initial.ts` — mở rộng object seed trả về cho `CompleteSectionInitial`
  để mang theo 4 giá trị mới từ trip đã load (nếu không, mở lại chuyến sẽ mất giá trị đã nhập trước đó — đúng rủi ro
  đã ghi trong comment gốc của `CompleteSectionInitial`: "core's completeTruckTrip xoá+chèn lại toàn bộ").
  └─ Side impact: **cao nếu bỏ sót** — seed thiếu field mới sẽ làm mất dữ liệu phí khi driver mở lại và submit.

### Phase 5 — Frontend: hiển thị (chi tiết chuyến, driver + staff)
- **Step 5.1**: `apps/web/src/app/(app)/trips/[id]/_components/truck-trip-detail.tsx`:
  - Mở rộng type `costAttachments[].costKind` union thêm 4 giá trị.
  - Thêm 4 `CostRow` mới (sau dòng Toll ~154) đọc từ `breakdown.cleaningFee/repairFee/ferryFee/loadingFee`.
  - Mở rộng `receiptGroups` (dòng ~177-181) từ 3 lên 7 nhóm; đổi label nhóm `EXTRA` → "Hóa đơn khác" (key
    `receiptsExtra`).
  └─ Side impact: card "Chi phí chuyến"/"Hóa đơn" đang hiển thị — thêm dòng mới, không đổi layout dòng cũ.
- **Step 5.2**: Trang bọc (`today/truck/[id]/page.tsx`, `today/truck/[id]/edit/page.tsx`,
  `truck/trips/[id]/page.tsx`, `truck/trips/[id]/edit/page.tsx`) — cập nhật mapping props truyền vào
  `TruckTripDetail`/`TruckCompleteSection`/`truck-trip-form` để không bỏ sót 4 field mới khi load dữ liệu trip.
  └─ Side impact: chủ yếu cơ học (đã có field toll làm mẫu) — rà đủ cả 4 trang (driver × 2, staff × 2).

### Phase 6 — Báo cáo tháng, P&L export, import Excel [rủi ro cao nhất — cần chốt với KH trước khi đổi template]
> Theo câu hỏi mở ở REQ §6: mặc định Phase này **gộp 4 khoản mới vào cột "Chi phí phát sinh khác" đã có** trong
> báo cáo Excel (KHÔNG thêm cột mới vào template đã duyệt với KH) — chỉ tách riêng nếu KH yêu cầu ở phản hồi sau.
- **Step 6.1**: `apps/web/src/server/queries/truck-report-export.queries.ts` — `ReportTripLogRow.extra` /
  `ReportVehiclePnlRow.extra` cộng thêm 4 khoản mới vào tổng (giữ số cột hiện tại); `extraNote` liệt kê tên+số tiền
  của 4 khoản mới giống cách đang liệt kê khoản tự do (để KH vẫn truy vết được chi tiết dù gộp cột).
  └─ Side impact: **cao** — đây là file dựng báo cáo Excel khách đã duyệt định dạng; đổi số nhưng KHÔNG đổi số cột.
     Bắt buộc verify số tổng khớp với dashboard tài chính (Step 3.4) trước khi coi là xong.
- **Step 6.2**: `apps/web/src/app/(app)/truck/reports/_components/report-review-step.tsx`,
  `apps/web/src/app/(app)/truck/pnl/page.tsx`, `.../truck/pnl/export/route.ts` — rà xem có hiển thị riêng `toll` hay
  không; nếu có, quyết định hiển thị thêm 4 dòng hay gộp theo cùng nguyên tắc Step 6.1.
  └─ Side impact: trung bình — màn xem trước báo cáo, cần khớp với file Excel thật xuất ra.
- **Step 6.3**: `apps/web/src/server/actions/imports/import.actions.ts` — 4 field mới **để optional/bỏ trống** khi
  import Excel hàng loạt (không bắt buộc thêm cột mới vào template import ngay) — import cũ không có cột này vẫn
  chạy được, giá trị mặc định NULL.
  └─ Side impact: thấp nếu để optional; KHÔNG tự ý đổi template import mà chưa hỏi KH.

### Phase 7 — i18n (vi/en/ko)
- **Step 7.1**: `apps/web/messages/{vi,en,ko}.json` — thêm key mới ở 3 namespace:
  - `screens.truckTrips.form`: `cleaningFee`, `repairFee`, `ferryFee`, `loadingFee` (field label) +
    `cleaningReceipts`, `repairReceipts`, `ferryReceipts`, `loadingReceipts` (receipt label); đổi text
    `extraReceipts` → "Hóa đơn khác" / "Other invoice" / tương đương ko.
  - `screens.truckComplete`: 4 field label tương ứng (dùng chung ý nghĩa với namespace form).
  - `screens.truckTripDetail`: 4 label cho `CostRow` + 4 label nhóm hóa đơn; đổi `receiptsExtra` → "Hóa đơn khác".
  └─ Side impact: chỉ thêm/đổi text key, không đổi key cũ đang dùng ở nơi khác.

## 3. Danh sách file thay đổi

| Khu vực | File | Loại |
|---|---|---|
| DB | `packages/db/src/schema/trips.schema.ts` | Sửa |
| DB | `packages/db/migrations/0034_truck_trip_fixed_cost_types.sql` | Mới |
| DB | `scripts/check-manual-migrations.mjs` | Sửa |
| Shared | `packages/shared/src/zod/truck-trip.zod.ts` | Sửa |
| Core | `packages/core/src/truck/truck-cost.ts` | Sửa |
| Core | `packages/core/src/truck/truck-trip.service.ts` | Sửa |
| Core | `packages/core/src/truck/truck-pnl.service.ts` | Sửa |
| Backend | `apps/web/src/server/actions/trips/truck-trip.actions.ts` | Sửa |
| Backend | `apps/web/src/server/queries/truck-finance.queries.ts` | Sửa |
| Backend | `apps/web/src/server/queries/truck-report-export.queries.ts` | Sửa |
| Backend | `apps/web/src/server/actions/imports/import.actions.ts` | Sửa |
| Frontend | `apps/web/src/app/(app)/truck/trips/_components/truck-trip-form.tsx` | Sửa |
| Frontend | `apps/web/src/components/truck/truck-complete-section.tsx` | Sửa |
| Frontend | `apps/web/src/lib/truck-complete-initial.ts` | Sửa |
| Frontend | `apps/web/src/app/(app)/trips/[id]/_components/truck-trip-detail.tsx` | Sửa |
| Frontend | `apps/web/src/app/(app)/today/truck/[id]/page.tsx`, `.../[id]/edit/page.tsx` | Sửa |
| Frontend | `apps/web/src/app/(app)/truck/trips/[id]/page.tsx`, `.../[id]/edit/page.tsx` | Sửa |
| Frontend | `apps/web/src/app/(app)/truck/reports/_components/report-review-step.tsx` | Sửa (nếu áp dụng) |
| Frontend | `apps/web/src/app/(app)/truck/pnl/page.tsx`, `.../truck/pnl/export/route.ts` | Sửa (nếu áp dụng) |
| i18n | `apps/web/messages/vi.json`, `en.json`, `ko.json` | Sửa |

## 4. Phân tích side impact

| Phạm vi | Rủi ro | Giải thích |
|---|---|---|
| DB migration | Thấp | Chỉ `ADD COLUMN IF NOT EXISTS`, không ALTER/DROP cột hiện có, không cần backfill |
| `truck-cost.ts` / `truck-pnl.service.ts` (công thức) | **Trung bình-cao** | Đổi số Tổng chi phí/Lợi nhuận hiển thị ngay — bắt buộc test regression chuyến không có 4 phí mới ra số y hệt cũ |
| `truck-trip.service.ts` (create/update/complete) | Trung bình-cao | Đổi luồng ghi chính của trip — test kỹ case KHÔNG có 4 phí mới |
| **Báo cáo tháng Excel** (`truck-report-export.queries.ts`) | **Cao** | Định dạng đã chốt với KH (REQ-20260713) — mặc định gộp vào cột "phí phát sinh" để tránh đổi template, nhưng vẫn cần KH xác nhận đã đúng ý |
| Import Excel (`import.actions.ts`) | Trung bình | Để optional, không đổi template import — nếu sau này KH muốn cột riêng thì làm phase riêng |
| Form Manager + Driver | Trung bình | Thêm field/nhóm UI, không đổi field cũ — test cả 2 form song song vì dễ copy-paste lệch nhau |
| `truck-complete-initial.ts` (seed) | Trung bình-cao nếu bỏ sót | Thiếu seed → mất dữ liệu phí khi driver mở lại chuyến đã có (do complete ghi đè toàn bộ) |
| Attachment cap `.max(30)`→`.max(70)` | Trung bình nếu bỏ sót | Không tăng cap → lỗi validate khi user cố đính kèm nhiều hóa đơn ở 4 nhóm mới dù mỗi nhóm chưa vượt quá 10 |
| i18n | Thấp | Chỉ thêm/đổi key, không đổi key đang dùng chỗ khác |

## 5. DB Migration

Thủ công theo quy trình repo (staging/production không dùng `synchronize`, xem `scripts/check-manual-migrations.mjs`):

```sql
-- 0034_truck_trip_fixed_cost_types.sql
-- REQ-20260916: 4 loại chi phí cố định mới cho chuyến truck (vệ sinh phương tiện,
-- sửa chữa, cầu phà, bốc dỡ hàng hóa) — cùng tầng với trp_toll_fee hiện có.
--
-- Migration THỦ CÔNG (không nằm trong drizzle journal) — idempotent.
-- Nhớ probe trong scripts/check-manual-migrations.mjs.

ALTER TABLE car_trips
  ADD COLUMN IF NOT EXISTS trp_cleaning_fee DECIMAL(14,2),
  ADD COLUMN IF NOT EXISTS trp_repair_fee DECIMAL(14,2),
  ADD COLUMN IF NOT EXISTS trp_ferry_fee DECIMAL(14,2),
  ADD COLUMN IF NOT EXISTS trp_loading_fee DECIMAL(14,2);
```

Áp dụng Neon dev branch trước, verify, rồi mới apply staging (`ep-noisy-heart`) theo
[[reference_truck_db_branches]]. Không đụng production cho tới khi staging xanh + KH xác nhận 2 câu hỏi mở ở REQ §6.
