# TR-20260907 — Truck: Trạng thái Phương tiện — kết quả kiểm thử trên dev

> TC: [TC-20260907-truck-vehicle-status.md](TC-20260907-truck-vehicle-status.md) · REQ/PLN/RPT cùng mã 20260907.
> Môi trường: Neon DEV `ep-steep-tooth`, `next dev` `localhost:3001`, ADMIN = Demo OWNER (`dev-login?role=OWNER`), MANAGER = `0a0a…00c2` (gán tạm HCM khi test E2, đã gỡ). Ngày test 2026-09-07 (UTC = local).
> Cách gọi thẳng server action: `curl -H "Next-Action: <id 42 hex>"` với cookie dev-login; ID lấy từ `.next/static/chunks/app/(app)/…/page.js` (`updateVehicleAction = 60c8d440…`, `createTruckMaintenanceAction = 4087f550…`, `updateTruckMaintenanceAction = 40915c97…`, `deleteTruckMaintenanceAction = 40df3fe4…`).

## 0. Kỹ thuật (F)

| ID | Kết quả | Ghi chú |
|---|---|---|
| F1 | ✅ | `0031` lần 1: BEFORE TRUCK `AVAILABLE 3 · IN_USE 1 · MAINTENANCE 1` → `rowCount 2` → AFTER `AVAILABLE 5` |
| F2 | ✅ | Lần 2: `rowCount 0` |
| F3 | ✅ | CAR vẫn `AVAILABLE 4` |
| F4 | ✅ | `npm run typecheck` xanh (sau khi sửa 1 lỗi literal ở `fleet/[id]/edit/page.tsx`); `npm run lint` xanh (chỉ cảnh báo `no-unused-vars` cũ, không ở file sửa) |
| F5 | ✅ | 3 file JSON parse OK; đủ khoá `status.*`, `statusDesc.*`, `maintUntil`, `form.status*` ở vi/en/ko (chưa kiểm tra đổi ngôn ngữ trên UI) |
| F6 | ✅ (theo cấu trúc) | Sau 0031 không xe tải nào còn `cvh_status = MAINTENANCE`; guard mềm `VEHICLE_MAINTENANCE` không còn đường kích hoạt cho truck |

## A. Danh sách Phương tiện & trạng thái hiệu lực

| ID | Kết quả | Quan sát |
|---|---|---|
| A1 | ✅ | `/truck/fleet`: 5 xe đều **Sẵn sàng** (43C-201.55 trước là MAINTENANCE tay, 60C-311.07 trước là IN_USE tay); không còn "Đang sử dụng" |
| A2 | ✅ | Select trạng thái: `Tất cả · Sẵn sàng · Bảo trì · Ngừng sử dụng` (value AVAILABLE/MAINTENANCE/RETIRED) |
| A3 | ✅ | Badge có `title` = mô tả ("Phương tiện nằm trong danh sách bảo trì · Không thể tạo chuyến mới" có trong HTML) |
| A4 | ✅ | Tạo bảo trì 29C-99999 07–09/09/2026 · 0 ₫ (action) → `/truck/fleet` 29C **● Bảo trì · đến 09/09/2026** ngay; dashboard Sẵn sàng 4 · Bảo trì 1 · Ngừng 0 |
| A5 | ✅ | Sửa bản ghi start = 08/09 → 29C **Sẵn sàng**; trả lại 07/09 → **Bảo trì đến 09/09/2026** |
| A6 | ✅ | Xoá bản ghi chồng (A7) → badge lùi về "đến 09/09/2026" |
| A7 | ✅ | Thêm bản ghi thứ hai 07–12/09 (hệ thống cho phép chồng ngày) → badge **đến 12/09/2026** (ngày kết thúc xa nhất) |
| A8 | ⏸ | Mobile chưa chụp; markup card đã có badge + "đến dd/mm" (cùng nguồn dữ liệu với bảng) |

## B. Chuyển trạng thái tay

| ID | Kết quả | Quan sát |
|---|---|---|
| B1 | ✅ (theo code) | Form tạo không render field Trạng thái (`vehicleId` undefined); schema create không có `status` |
| B2 | ✅ | `/truck/fleet/{60C-311.07}/edit`: field **Trạng thái** = Select 2 item "Sẵn sàng / Ngừng sử dụng" + hint "Chỉ chuyển giữa Sẵn sàng và Ngừng sử dụng. Trạng thái Bảo trì được gán tự động theo lịch ở menu Bảo trì." |
| B3 | ✅ | Chọn Ngừng sử dụng › Lưu → về danh sách, 60C-311.07 **● Ngừng sử dụng**, Cập nhật 18:22:08 07/09/2026; DB `cvh_status = RETIRED` |
| B4 | ✅ (qua 29C) | 29C RETIRED → AVAILABLE bằng action: về Bảo trì (bản ghi còn hiệu lực) |
| B5 | ✅ | `/truck/fleet/{29C}/edit`: hộp ⓘ "Xe đang bảo trì đến 09/09/2026 — trạng thái Bảo trì được gán tự động. Xem lịch bảo trì" + link `/truck/maintenance?vehicle=511a3e37…` |
| B6 | ✅ | 29C (đang bảo trì) → RETIRED: danh sách **Ngừng sử dụng** (thắng Bảo trì); bản ghi bảo trì còn nguyên; trả về AVAILABLE → Bảo trì |
| B7 | ✅ | `updateVehicleAction(60C, {status:'MAINTENANCE'})` → `CAR-E1001 "Truck status must be AVAILABLE or RETIRED"` |
| B8 | ✅ | `{status:'IN_USE'}` → `CAR-E1001` |
| B9 | ✅ | Xe con 51K-123456 `{status:'MAINTENANCE'}` → success; trả về AVAILABLE → success (CAR không đổi) |
| B10 | ✅ (theo code) | `vehicle-form.tsx` (CAR) không sửa; `vehicles.status.RETIRED` vẫn "Đã ngừng" |

## C. Không tạo chuyến mới

| ID | Kết quả | Quan sát |
|---|---|---|
| C1 | ✅ | `/truck/trips/new` (payload RSC): không có `60C-311.07`; có 29C-99999, 51C-458.32, 60C-522.18 |
| C2 | ✅ | `/truck/import`: không có `60C-311.07` |
| C3 | ✅ (theo code) | `today/truck/new` dùng cùng `listDispatchableTrucks` |
| C4 | ⏸ | 60C-311.07 không có chuyến nào trên dev → chưa kiểm tra trang sửa giữ xe RETIRED (`keepId` theo code) |
| C5 | ✅ (kế thừa) | `assertTruckVehicle` RETIRED → CAR-E1002 (không đổi) |
| C6 | ✅ (kế thừa) | Chặn theo ngày CAR-E1013 đã kiểm tra ở TR-20260904 |
| C7 | ✅ (Q2) | 29C đang bảo trì hôm nay vẫn xuất hiện trong picker (mờ chỉ khi ngày chuyến ∈ khoảng) |
| C8 | ✅ | `/truck/maintenance/new`: không có `60C-311.07`; 29C (đang bảo trì) vẫn có |
| C9 | ✅ | `createTruckMaintenanceAction` xe 60C-311.07 (RETIRED) → `CAR-E1002 409 "Vehicle is retired"` |
| C10 | ⏸ | 60C-311.07 không có bản ghi bảo trì → chưa chạy; cùng đường `loadTruck` với C9 |

## D. Bảng điều khiển & báo cáo

| ID | Kết quả | Quan sát |
|---|---|---|
| D1 | ✅ | Card "Tình trạng đội xe": 3 dòng `Sẵn sàng 4 · Bảo trì 1 · Ngừng sử dụng 0` (trước B3); dòng Bảo trì là link `/truck/maintenance` |
| D2 | ✅ | Sau A4: Bảo trì 1 |
| D3 | ✅ (kế thừa) | Lọc khu vực không đổi code |
| D4 (alt) | ✅ | Tháng 9 chưa có chuyến → wizard khoá nút; lập lại **08/2026 · HCM** lúc 29C đang bảo trì: KPI `1 hoạt động · 1 bảo dưỡng` (en `1 Active · 1 Under Maintenance`, ko `가동 1 · 정비 1`); mục E dòng 29C = **Bảo dưỡng / Maintenance / 정비 중**, 51C = Có lãi — đúng BR-9 "status tại thời điểm lập" |
| D5 | ⏸ | Không lặp lại (D4 alt đã minh hoạ cùng ngữ nghĩa) |
| D6 | ⏸ | 60C-311.07 (Đồng Nai) không thuộc scope HCM; theo code vẫn trong `scopeVehicles` (Q4) |

## E. Phân quyền

| ID | Kết quả | Quan sát |
|---|---|---|
| E1 | ⏸ | Không chạy UI manager (ACL fleet không đổi code) |
| E2 | ✅ | Gán HCM cho `…00c2` → `updateVehicleAction(60C-311.07 Đồng Nai, {status:'AVAILABLE'})` → `CAR-E0403 "Forbidden: no access to region DONG_NAI"`; DB vẫn RETIRED; đã gỡ grant |
| E3 | ⏸ | Kế thừa (`truck/layout.tsx`) |

## G. Bổ sung — menu Danh sách chuyến đi (yêu cầu kiểm tra 07/09 18:4x)

| Mục | Kết quả | Quan sát |
|---|---|---|
| Xe đang bảo trì trong picker tạo chuyến | ✅ | Ngày 07/09/2026: 29C-99999 vẫn trong danh sách nhưng **mờ, không chọn được**, hậu tố "(bảo trì …)"; xe khác chọn bình thường; xe RETIRED không xuất hiện (cách 2 của yêu cầu, có từ REQ-20260904) |
| Định dạng ngày khớp Phương tiện | ✅ (sau sửa) | Trước: "(bảo trì 7/9/2026–9/9/2026)" vs badge "đến 09/09/2026". Sửa `fmtDay`/`day` ở form chuyến, form bảo trì, danh sách Bảo trì → "(bảo trì 07/09/2026–09/09/2026)", cột thời gian "07/09/2026 – 09/09/2026". Typecheck xanh. Sau đó người dùng yêu cầu thống nhất luôn cột "Ngày" → helper chung `lib/format-day.ts`, áp cho 7 màn (trips, maintenance, finance, dashboard, drivers, report-review-step, today/truck/[id]) |
| Cột Ngày thống nhất (curl HTML, 07/09 19:0x) | ✅ | trips: `02/08/2026, 03/08/2026`; maintenance: `05/09/2026, 07/09/2026, 09/09/2026, 10/08/2026, 12/08/2026`; finance: `02/08/2026, 07/09/2026`; dashboard "Chuyến gần đây": `02/08/2026, 03/08/2026`; drivers: `12/05/2026, 28/07/2026…` — không còn ngày thiếu số 0; `grep toLocaleDateString(loc)` trong `truck/*`, `today/truck/*` = 0; typecheck xanh |

## H. Bổ sung — menu Lập báo cáo (yêu cầu kiểm tra 07/09 19:1x)

| Mục | Kết quả | Quan sát |
|---|---|---|
| Bước 4 xem lại: thẻ "Tổng chi phí cố định" có gồm bảo trì | ✅ | `getTruckReportReview` → `computeTruckPnl(vehicleId)`.fixedCost (= lương + KH + bảo trì). 08/2026 HCM, xe 51C: 2.000.000 ₫ (lương 0, KH 0, bảo trì 2.000.000) |
| Lợi nhuận từng xe ở bước xem lại | ✅ | `net = revenue − fuel − toll − extra − fixedCost` → đã trừ bảo trì |
| File Excel | ✅ | Dòng 25 + `SUM(C19:C25)` + mục E (xem §D4, file người dùng tải 18:27) |
| Phân rã dưới thẻ (mẫu người dùng duyệt) | ✅ (sau sửa) | Thẻ hiện thêm "Lương 0 · Khấu hao 0 · **Bảo trì 2.000.000**" (pill warning); typecheck xanh; ảnh chụp 19:3x |

## I. Verify tổng trên local trước khi lên staging (07/09 19:4x–20:0x)

| Hạng mục | Kết quả | Chi tiết |
|---|---|---|
| `npm run typecheck` (5 gói: web, core, db, shared, ui) | ✅ | 5/5 successful |
| `npm run lint` | ✅ | Chỉ cảnh báo `no-unused-vars` có sẵn, không ở file sửa |
| Smoke ADMIN 22 route (dashboard, fleet list/lọc/new/edit ×2, trips list/new/edit/detail, import, maintenance list/new/edit, finance, drivers, reports list/wizard bước 4, pnl, + CAR `/vehicles`, `/dashboard`) | ✅ 22/22 | HTTP 200, không "Đã có lỗi xảy ra"/"Application error", không lộ khoá i18n dạng `screens.x.y` |
| Smoke MANAGER (`…00c2`, TRUCK) 7 route | ✅ | 200 toàn bộ |
| Smoke DRIVER (`role=MEMBER`) | ✅ | `/today` 200, `/today/truck/new` 200 (picker không có 60C-311.07 RETIRED, có 29C/51C), `/truck/fleet` → redirect `/today` |
| i18n en (cookie `NEXT_LOCALE`) | ✅ | fleet: Available/Maintenance/Retired/"until 09/09/2026"; review: Fixed cost · Salary · Depreciation · "Maintenance 2,000,000"; edit form: "Under maintenance until 09/09/2026", "View maintenance schedule", hint |
| i18n ko | ✅ | fleet: 이용 가능/정비 중/사용 중지/"2026. 09. 09.까지" (ko-KR định dạng ngày kiểu `yyyy. mm. dd.` — cùng cột "Cập nhật" nên nhất quán); review: 고정비 · 급여 · 감가상각 · "정비 2,000,000"; edit form đủ chuỗi |
| Cây nguồn sạch | ✅ | Xoá `apps/web/jar-mgr.txt` (cookie jar lọt vào từ curl); không còn artefact lạ trong `git status` |
| Production build (`next build`) | ⏸ | **Chưa chạy**: dev server ở `localhost:3001` là tiến trình của người dùng, `next build` dùng chung `.next` sẽ làm hỏng phiên dev đang chạy. Rủi ro còn lại thấp (mọi route đã compile + render OK ở dev, tsc/lint xanh); staging (Render) build lại từ đầu khi deploy. Có thể chạy local khi dừng dev server. |

## Dữ liệu để lại trên dev

- Bản ghi bảo trì 29C-99999 07–09/09/2026 · 0 ₫ (`6cc485fb-…`) → badge Bảo trì tới hết 09/09 UTC.
- 60C-311.07 = Ngừng sử dụng.
- Báo cáo 08/2026 HCM tạo 18:27:05 07/09/2026.

## Kết luận

Toàn bộ TC có thể chạy trên dev đều đạt; các mục ⏸ là thiếu dữ liệu phù hợp (xe ngừng chưa có chuyến/bản ghi) hoặc hành vi kế thừa không đổi code. Sẵn sàng áp `0030` + `0031` lên staging và smoke test lại.
