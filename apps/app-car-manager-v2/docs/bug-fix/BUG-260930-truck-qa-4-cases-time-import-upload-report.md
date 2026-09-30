# BUG-260930 — Truck QA: 4 case (giờ tạo/sửa · import thiếu dữ liệu · upload chứng từ · báo cáo thiếu lương/khấu hao)

- **Ngày / Date**: 2026-09-30
- **App**: app-car-manager-v2 — phân hệ TRUCK
- **Branch**: `fix/truck-qa-4-cases-260930`
- **Nguồn**: bảng test QA (4 dòng "Kết quả thực tế / Kết quả mong đợi")

| # | Case QA | Trạng thái |
|---|---------|-----------|
| 1 | Thời gian tạo và chỉnh sửa chưa load đúng | ✅ Fixed — server render giờ UTC, thiếu `timeZone` |
| 2 | Không ghi nhận đầy đủ data từ file tải lên (km, giờ bắt đầu/kết thúc, ngày) | ✅ Fixed — 5 nguyên nhân độc lập (xem §2) |
| 3 | Đính kèm hóa đơn thất bại (jpeg + pdf) khi tạo/sửa | ⚠️ Không tái hiện được trên môi trường có thể truy cập; đã làm thông báo lỗi tự mô tả để lần test sau chỉ ra đúng nguyên nhân |
| 4 | Báo cáo xuất ra không có Lương tài xế và Khấu hao xe | ✅ Fixed — rate có hiệu lực từ tháng nhập nên tháng backfill = 0; xe không có tài xế mặc định → lương 0 |

---

## 1. Case 1 — Giờ tạo / chỉnh sửa lệch 7 giờ

### Triệu chứng
Cột "Cập nhật" (danh sách chuyến, tài xế, xe, tài chính, bảo trì) và "Ngày lập" (báo cáo) hiển thị giờ sớm hơn thực tế 7 giờ. Ví dụ TR-3036 trên staging: DB lưu `trp_updated_at = 2026-09-17 04:04:38Z` (= 11:04:38 giờ VN) nhưng màn hình in `04:04:38`.

### Nguyên nhân
`DateTimeCell` (`apps/web/src/components/datetime-cell.tsx`) và `dateTime()` ở `truck/reports/page.tsx` là Server Component gọi `toLocaleTimeString(loc)` **không có `timeZone`**. Server (Render / Docker) chạy UTC → in giờ UTC. Tenant đã có cấu hình `tns_timezone` (mặc định `Asia/Ho_Chi_Minh`) nhưng không nơi nào dùng để format.

### Sửa
- `getTenantTimeZone(entId)` (React `cache`) trong `apps/web/src/server/queries/tenant-settings.queries.ts`.
- `DateTimeCell` nhận prop `timeZone` (fallback `Asia/Ho_Chi_Minh`); `formatDay` nhận `timeZone` tuỳ chọn; thêm `formatDateTime` / `formatDateTimeParts` (`apps/web/src/lib/format-day.ts`).
- 6 trang truyền timezone tenant: trips, drivers, fleet, finance, maintenance (kể cả cột "Ngày tạo"), reports.
- Ngày-khoá (`trp_scheduled_at` = 00:00Z, ngày bảo trì) vẫn đi qua `formatDayKey` (UTC) — không đổi.

---

## 2. Case 2 — Import không ghi nhận km / giờ / ngày

QA thấy: (a) km không xem được trong chi tiết chuyến; (b) giờ bắt đầu, kết thúc và ngày "không ghi nhận". Truy vết ra **5 nguyên nhân độc lập**:

### 2.1 Ngày lệch 1 ngày, giờ sai — SheetJS `cellDates` + timezone Việt Nam (root cause chính)
Kiểm chứng bằng script node với `xlsx@0.18.5` trên máy GMT+7:

| Ô Excel | `cellDates:true` trả về | `parseImportDate` / `timeStr` cũ đọc ra |
|---------|-------------------------|------------------------------------------|
| Ngày 27/08/2026 (serial 46261) | `2026-08-26T16:59:56Z` = **26/08 23:59:56** local | **2026-08-26** (lệch 1 ngày) |
| Giờ 08:30 (serial 0.3541) | `1899-12-30T01:47:56Z`, local 08:29:56 | `getUTCHours` → **01:47** |

SheetJS dựng Date từ epoch 1899-12-30 bằng offset **của năm 1899** — `Asia/Ho_Chi_Minh` khi đó là LMT +7:06:30 → sai số ~30 giây kéo mọi ngày về trước nửa đêm hôm trước. Máy UTC không thấy lỗi này, nên trước đây không tái hiện được.

**Sửa** (`packages/shared/src/zod/truck-import.zod.ts`, `truck/import/_components/truck-import-panel.tsx`):
- Đọc sheet với `cellDates: false` → serial số, quy đổi số học (không phụ thuộc timezone).
- `parseImportDate`: serial dùng `Math.floor` (serial ngày+giờ 46261.7 phải ở ngày 46261; `round` trước đây đẩy chuyến buổi chiều sang ngày sau); nhánh `Date` làm tròn về phút trước khi đọc (fallback).
- `parseImportTime` mới: serial (phần lẻ ngày), Date (làm tròn phút, local), text (`8:30`, `08:30:00`, `8h30`, `8.30`, `4:05 pm`).

Kết quả kiểm chứng sau sửa (máy GMT+7): ngày `2026-08-27`, giờ `08:30`, datetime `2026-08-27 16:48`, `8h30 → 08:30`, `4:05 pm → 16:05`.

### 2.2 Chi tiết chuyến không hiển thị km / odo / giờ
`trips/[id]/_components/truck-trip-detail.tsx` không in `trp_start_odometer / trp_end_odometer / trp_started_at / trp_ended_at`. Km chỉ xuất hiện trong dòng ghi chú nhiên liệu khi đã có nhiên liệu. → Thêm 4 hàng: **Ngày**, **Giờ bắt đầu → Giờ kết thúc**, **Km đầu → Km cuối**, **Tổng km** (nhãn dùng glossary `columns.truck`, không thêm key i18n). Cả 2 trang gọi (`/truck/trips/[id]`, `/trips/[id]`) truyền thêm 4 prop.

### 2.3 Sửa chuyến import → xoá km
Form sửa suy ra `start_odometer / end_odometer` **từ km của điểm dừng**. Chuyến import có km trên trip nhưng điểm dừng không có km (hoặc không có điểm dừng) → lưu là `updateTruckTripAction` set `?? null` → **mất km**. Sửa 3 lớp:
- Edit page (manager + driver) truyền `startOdometer/endOdometer` vào form.
- Form: `seedStopOdometers()` gán km lên ORIGIN (hoặc điểm đầu) / RETURN (hoặc điểm cuối) khi không điểm dừng nào có km; khi lưu, fallback điểm đầu/cuối nếu không có ORIGIN/RETURN (route import là PICKUP → WAYPOINT → DELIVERY).
- `updateTruckTripAction`: odometer bỏ trống = "giữ nguyên" (`?? curTrip.trpStartOdometer`), cùng quy tắc với driver edit đã có.

### 2.4 Giờ kết thúc = thời điểm import
`completeTruckTrip` mặc định `trpEndedAt = new Date()` khi không có giờ kết thúc → chuyến import tháng 8 có "Giờ kết thúc" = giờ import (và in theo UTC). Sửa: core **không** mặc định nữa (`?? trip.trpEndedAt`); riêng 2 action hoàn thành (staff / driver "Kết thúc chuyến") truyền `wallClockNowUtc(tenantTz)` — "bây giờ" theo đồng hồ tenant, đúng frame wall-clock mọi nơi đang đọc. Import và form manager `mark_completed` để trống nếu không có giờ.

### 2.5 Form hoàn thành đọc giờ lệch frame
`toLocalInput` trong `components/truck/truck-complete-section.tsx` trừ offset trình duyệt → 09:20 lưu hiển thị 16:20 và lưu lại thành 16:20. Sửa: đọc UTC components như `hhmm` ở edit page.

---

## 3. Case 3 — Đính kèm hóa đơn thất bại

### Đã kiểm tra
| Kiểm tra | Kết quả |
|----------|---------|
| Code presign route + client (`truck-cost-upload.ts`) | Không thấy lỗi logic; MIME jpeg/pdf hợp lệ với `ATTACHMENT_CONTENT_TYPE_RE` |
| CORS bucket `ama-car-manager` (preflight PUT + content-type) | 200 + `Access-Control-Allow-Origin` cho cả 3 origin: stg-apps.amoeba.site, car-manager-staging.onrender.com, apps.amoeba.site |
| Route reachable (POST không auth) | 307 → login ở cả 3 môi trường (middleware chặn, route tồn tại) |
| **Test thật trên Render staging** (dev-login, gọi presign + PUT 5 byte từ trang) | presign **200**, S3 PUT **200** — upload hoạt động |
| stg-apps.amoeba.site (Docker staging, môi trường QA nhiều khả năng dùng) | `/dev-login` tắt (DEMO_AUTO_LOGIN=false); SSH đọc `.env` bị auto-mode classifier từ chối → **chưa xác nhận được AWS_* trên container** |

### Giả thuyết còn lại cho stg-apps
1. Container Docker thiếu / sai `AWS_REGION / AWS_S3_BUCKET / AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY` → presign 500 "Upload service temporarily unavailable".
2. Session hết hạn giữa lúc sửa → presign trả 307 → HTML → `res.json()` ném SyntaxError.

Cả hai trước đây đều hiện cùng một câu "Tải chứng từ lên thất bại. Vui lòng thử lại." nên không phân biệt được.

### Sửa (để lần test sau tự chỉ ra nguyên nhân)
- `requestPresigned`: phát hiện `res.redirected` / content-type không phải JSON → lỗi "presign redirected (307) — session expired" hoặc "presign HTTP 5xx"; lỗi API kèm message server.
- `uploadToS3`: đọc `<Code>` trong XML lỗi S3 (SignatureDoesNotMatch, AccessDenied, EntityTooLarge…).
- Cả 2 form (tạo/sửa + hoàn thành) nối chi tiết vào toast: `Tải chứng từ lên thất bại. Vui lòng thử lại. (presign: …)`.

**Việc cần người có quyền server làm**: `ssh ambAppStore@stg-apps.amoeba.site` → `grep -E '^AWS_' ~/ambAppStore/apps/app-car-manager-v2/.env` và `docker logs next-car-manager-v2 | grep upload-presigned`.

---

## 4. Case 4 — Báo cáo không có Lương tài xế / Khấu hao xe

### Nguyên nhân
Chi phí cố định theo tháng lấy từ `car_truck_cost_rates` (migration 0025) — rate ghi khi tạo/sửa xe hoặc tài xế và **có hiệu lực từ tháng hiện tại** (`recordTruckCostRate`: `month = now`). Hai tình huống QA gặp:
1. Tạo xe/tài xế hôm nay rồi import nhật ký tháng trước → tháng đó nằm **trước rate đầu tiên** → lương = khấu hao = 0 → báo cáo in trống dù xe chạy cả tháng.
2. Xe không có **tài xế mặc định** (`cvh_default_driver_id` null — vd `33e-32322*` trên staging) → lương = 0 dù mọi chuyến đều có tài xế; trong khi báo cáo vẫn in tên tài xế đó ở dòng xe (fallback theo chuyến đầu tháng).

Dữ liệu staging (ep-noisy-heart) xác nhận cơ chế: 3 rate DEPRECIATION tháng 2026-08, 2 rate tháng 2026-09; 5 rate SALARY tháng 2026-08; xe tạo 14–17/09 chưa có rate hoặc chưa có tài xế mặc định.

### Sửa (`packages/core/src/truck/truck-fixed-monthly.ts`, `truck-pnl.service.ts`)
- `loadTruckFixedMonthly` nhận `activeKeys` (`month|vehicleId` có chuyến COMPLETED) và `driverByKey` (tài xế chuyến đầu tháng).
- `rateAt`: tháng **trước** rate đầu tiên → dùng rate đầu tiên **chỉ khi** xe có chuyến tháng đó (backfill). Tháng không chuyến vẫn 0 → giữ quyết định QA 2026-07-30 ("tháng trước khi mua xe không gánh chi phí").
- Xe không có tài xế mặc định → tính lương theo tài xế chuyến đầu tháng (khớp tên báo cáo đang in).
- `computeTruckPnl` (nguồn của báo cáo MONTHLY_SUMMARY, P&L, finance, dashboard) build 2 map này từ chính danh sách chuyến đã tải.

Manual entry `car_truck_fixed_costs` vẫn ưu tiên tuyệt đối. Rate đổi sau đó vẫn effective-dated như cũ.

---

## 5. File thay đổi

| Khu vực | File | Loại |
|---------|------|------|
| shared | `packages/shared/src/zod/truck-import.zod.ts` | sửa (parseImportDate, +parseImportTime, +wallClockNowUtc) |
| core | `packages/core/src/truck/truck-trip.service.ts` | sửa (bỏ mặc định `new Date()` cho end) |
| core | `packages/core/src/truck/truck-fixed-monthly.ts` | sửa (activeKeys, driverByKey) |
| core | `packages/core/src/truck/truck-pnl.service.ts` | sửa (truyền 2 map) |
| web | `src/lib/format-day.ts`, `src/components/datetime-cell.tsx`, `src/server/queries/tenant-settings.queries.ts` | sửa (timezone) |
| web | `src/app/(app)/truck/{trips,drivers,fleet,finance,maintenance,reports,dashboard,pnl}/page.tsx` | sửa (timeZone cho `DateTimeCell` / `ReportStatusBadge`) |
| web | `src/components/truck/report-status-badge.tsx` | sửa (prop `timeZone` — giờ "Đã lập BC · HH:MM dd/mm/yyyy" cũng in UTC trước đây) |
| web | `src/app/(app)/truck/invoices/page.tsx` | sửa (ngày kết thúc chuyến đọc theo UTC — frame wall-clock) |
| web | `src/app/(app)/truck/import/_components/truck-import-panel.tsx` | sửa (cellDates:false) |
| web | `src/app/(app)/trips/[id]/_components/truck-trip-detail.tsx`, `src/app/(app)/trips/[id]/page.tsx`, `src/app/(app)/truck/trips/[id]/page.tsx` | sửa (hàng Ngày/Giờ/Odo/Km) |
| web | `src/app/(app)/truck/trips/[id]/edit/page.tsx`, `src/app/(app)/today/truck/[id]/edit/page.tsx`, `src/app/(app)/truck/trips/_components/truck-trip-form.tsx` | sửa (seed km điểm dừng) |
| web | `src/server/actions/trips/truck-trip.actions.ts` | sửa (giữ odometer; wallClockNow) |
| web | `src/components/truck/truck-complete-section.tsx`, `src/lib/truck-cost-upload.ts` | sửa (frame giờ; lỗi upload chi tiết) |

Không có migration DB. Không thêm key i18n (dùng `columns.truck` sẵn có).

## 6. Kiểm chứng
- `tsc --noEmit`: web / core / shared đều pass. `next lint`: chỉ còn warning có sẵn, không thuộc file sửa.
- Script node + `xlsx@0.18.5` trên máy GMT+7: bảng §2.1.
- `wallClockNowUtc('Asia/Ho_Chi_Minh', 03:40Z)` → `10:40Z` ✓; `Asia/Seoul` → `12:40Z` ✓.
- Upload trên Render staging: presign 200 / S3 PUT 200 (§3).
- Chứng minh đường code timezone dưới process `TZ=UTC` (giống Render/Docker) — `format-day.ts` biên dịch riêng và chạy bằng node:
  - `formatDateTimeParts(03:18:49Z, 'vi-VN', 'Asia/Ho_Chi_Minh')` → `10:18:49 · 17/09/2026` ✓ · `Asia/Seoul` → `12:18:49` ✓
  - `formatDay(17:30Z, Asia/Ho_Chi_Minh)` → `18/09/2026`; `formatDay(17:30Z, 'UTC')` → `17/09/2026` ✓
  - đối chứng lỗi cũ: `toLocaleTimeString('vi-VN')` không `timeZone` → `03:18:49`.
- Dev server local (`localhost:3001`, DB dev ep-steep-tooth; **lưu ý máy dev chạy giờ VN nên list/badge không phân biệt được server-local và tenant tz — bằng chứng phân biệt là mục TZ=UTC ở trên**), đọc HTML SSR:
  - `/truck/trips`: cột Cập nhật in `10:18:49` cho `trp_updated_at = 03:18:49Z` (TR-3004), `13:54:38` cho `06:54:38Z`, `14:02:36` cho `07:02:36Z` → đúng giờ VN.
  - `/truck/trips/{TR-3004}`: hiện `Ngày 17/09/2026 · Giờ bắt đầu → Giờ kết thúc — → 03:18 · Km đầu → Km cuối 100 → — km` (03:18 là giờ "now" giả lưu trước khi sửa — minh hoạ §2.4).
  - `/truck/trips/{TR-3004}/edit`: payload form nhận `startOdometer: 100` → ORIGIN được seed km, lưu lại không mất.

## 7. Tái phát — quy tắc rút ra
1. **Server Component format giờ phải có `timeZone`** (tenant) — server luôn là UTC. Dùng `DateTimeCell timeZone=` / `formatDateTime`.
2. **Không dùng `cellDates: true` của SheetJS** cho dữ liệu người dùng VN; đọc serial và quy đổi số học (`parseImportDate` / `parseImportTime`).
3. Giờ bắt đầu/kết thúc chuyến là **wall clock lưu dạng UTC components** — mọi nơi đọc/ghi qua `parseWallClockUtc` / `wallClockNowUtc` / `toISOString().slice(11,16)`, không trừ offset trình duyệt.
4. Trường suy ra từ UI phụ (odometer ← km điểm dừng) khi thiếu phải là **"giữ nguyên"**, không phải "xoá".
5. Toast lỗi kỹ thuật phải mang nguyên nhân (HTTP code / mã lỗi S3) để QA report có thể chẩn đoán.
