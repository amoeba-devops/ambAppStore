# TR-20260904 — Kết quả kiểm tra: Truck Bảo trì

> TC: [TC-20260904-truck-maintenance.md](TC-20260904-truck-maintenance.md) · Ngày: 2026-09-04 · Môi trường chạy được trong phiên: **máy dev, không có DB/dev server** → chỉ kiểm tra tĩnh.

## 1. Kiểm tra tĩnh (đã chạy)

| ID | Lệnh | Kết quả |
|---|---|---|
| E1 | `packages/db` · `packages/shared` · `packages/core`: `npx tsc --noEmit` | ✅ 0 lỗi |
| E1 | `apps/web`: `npx tsc --noEmit` | ✅ 0 lỗi (exit 0) |
| E2 | `apps/web`: `npx next lint --dir src` | ✅ exit 0; chỉ còn warning `no-unused-vars` ở các file **cũ** (không thuộc thay đổi này) |
| E2 | `next lint --file` cho 9 file mới/sửa nặng (maintenance pages/form/actions/queries, trip form, dashboard, format-action-error) | ✅ không warning |
| — | Round-trip `messages/{vi,en,ko}.json` (json load → dump) | ✅ byte-identical trước khi sửa → diff chỉ gồm key mới + 4 chuỗi cố ý đổi (kpiCostSub, tooltipCost, tooltipProfit, thFixedAllocHint) |

## 1b. Kiểm tra trực tiếp trên DEV (đã chạy, 2026-09-04 ~21:20)

Môi trường: migration `0030` áp lên Neon DEV (`ep-steep-tooth`) → bảng + 2 index tạo đúng, 0 dòng. Dev server `next dev :3001`, đăng nhập `dev-login?role=OWNER` (ADMIN). Dữ liệu dev: 5 xe tải, xe 51C-458.32 (HCM) có 2 chuyến LOG 02–03/08/2026; tháng 09/2026 chưa có chuyến.

| TC | Kết quả | Ghi chú |
|---|---|---|
| A1 | ✅ | Sidebar › Vận hành có "Bảo trì" sau "Tài xế", active đúng |
| A2 | ✅ | `/truck/maintenance` empty state + filter tháng/khu vực/xe, không lỗi console |
| A3 | ✅ | Tạo 51C-458.32 · 05/09–08/09/2026 · 7.500.000 → toast "Đã thêm bảo trì cho 51C-458.32"; dòng: Ngày 4/9/2026 · 51C-458.32 / Hyundai HD210 · HCM · 5/9/2026 – 8/9/2026 · 4 ngày · chip "Sắp tới" · 7.500.000 ₫ · Demo OWNER · 21:26 04/09/2026 · ✎ 🗑 |
| B1 | ✅ | Xe đã chọn 51C, đổi ngày 01–05/08/2026 → banner đỏ "Xe 51C-458.32 đã có 2 chuyến trong khoảng này (TRK-2608-002, TRK-2608-001)…", nút Lưu khoá |
| B3 | ✅ | Chọn ngày 01–05/08 trước → option "51C-458.32 · Hyundai HD210 (có 2 chuyến trong khoảng)" bị disable, 4 xe khác chọn được |
| B5 | ✅ | `/truck/trips/new` ngày 06/09/2026 → option "51C-458.32 · Hyundai HD210 (bảo trì 5/9/2026–8/9/2026)" disable |
| C1 | ✅ | Dashboard HCM, Tháng này: Tổng chi phí 7.500.000 ₫ · Lợi nhuận ròng −7.500.000 ₫ · subtitle có "· bảo trì" |
| C2 | ✅ | Donut có lát "Bảo trì" 7.500.000 = tâm |
| C4 | ✅ | P&L: card Chi phí cố định 7.500.000 (Lương 0 · Khấu hao 0 · Bảo trì 7.500.000); bảng có dòng "Bảo trì" |
| C6 | ✅ | Finance Theo chuyến: card "Chi phí cố định 7.500.000 ₫ — gồm bảo trì 7.500.000 ₫ — không phân bổ theo chuyến" |
| C7 | ✅ | Tháng 09/2026 có 0 chuyến nhưng bảo trì vẫn tính (Q7) |
| Fix trong lúc test | — | "hạch toán vào tháng **tháng 09, 2026**" (lặp chữ do locale) → đổi sang `MM/YYYY` ở form + subtitle danh sách |
| Server log | ✅ | Không lỗi runtime; các route `/truck/maintenance*` 200 |

| A3 (lần 2, 2026-09-05) | ✅ | Tạo 51C-458.32 · 10–12/09/2026 · 3.000.000 → dòng "3 ngày · Sắp tới · 3.000.000 ₫ · Demo OWNER · 17:01:03 05/09/2026" |
| A6 (sửa) | ✅ | Icon ✎ → `/truck/maintenance/{id}/edit` "Sửa bảo trì · 51C-458.32", form prefill đủ (xe, 10/09, 12/09, 3.000.000), có nút Xoá/Huỷ/Lưu. Đổi Kết thúc → 13/09, Chi phí → 4.500.000 → toast "Đã cập nhật bảo trì 51C-458.32"; dòng: 10/9 – 13/9/2026 · 4 ngày · 4.500.000 ₫ · Cập nhật 17:02:02 |
| A9 (xoá) | ✅ | Icon 🗑 → `confirm()` (automation phải ghi đè `window.confirm = () => true` để không bị tự huỷ — cùng pattern `ListRowActions` xe/chuyến) → toast → danh sách "0 lần bảo trì"; DB: `tmn_deleted_at` set (soft delete) |
| A11 (audit) | ✅ | `car_audit_logs`: `TRUCK_MAINTENANCE.CREATE` → `.UPDATE` → `.DELETE`, entity_ref = biển số |
| Dọn dev | — | Dòng test (đã soft-delete) xoá cứng bằng SQL để bảng dev về 0; audit giữ lại (append-only) |

### Kiểm tra tác động lên các màn khác — tháng 08/2026 · HCM (2026-09-05, 17:1x)

Dữ liệu: xe 51C-458.32 có 1 chuyến COMPLETED (02/08, DT 8.500.000, nhiên liệu phân bổ 1.364.000, cầu đường 210.000, phát sinh 450.000) + 1 chuyến CONFIRMED (03/08); lương/KH tháng 8 = 0 (chưa cấu hình mức). Thêm bảo trì **51C · 10–12/08/2026 · 2.000.000** (không trùng ngày có chuyến → lưu OK).

| TC | Kết quả | Số liệu quan sát |
|---|---|---|
| C1 Dashboard (khoảng thg 8 – thg 8, HCM) | ✅ | Doanh thu 8.500.000 · **Tổng chi phí 4.024.000** (= 2.024.000 biến đổi + 2.000.000 bảo trì) · **LN ròng 4.476.000** · tooltip có "+ Chi phí bảo trì" |
| C2 Cơ cấu chi phí | ✅ | Lát Bảo trì 2.000.000; Σ lát (1.364.000 + 210.000 + 450.000 + 2.000.000) = 4.024.000 = tâm |
| C3 Widget Tổng phí cố định | ✅ | 2.000.000 (50 % · theo tháng): Lương 0 · Khấu hao 0 · **Bảo trì 2.000.000** + ghi chú "Bảo trì tính theo tháng, không phân bổ theo chuyến" |
| C5 Export P&L xlsx (`/truck/pnl/export?month=2026-08&region=HCM`) | ✅ | Dòng "Chi phí bảo trì 2.000.000" giữa Khấu hao và "Chi phí cố định 2.000.000"; LN ròng 4.476.000 |
| C10 Review lập BC (bước 4) | ✅ | Card "Tổng chi phí cố định" xe 51C = 2.000.000 |
| C9 Lập báo cáo MONTHLY_SUMMARY tháng 8 · HCM → file `.xlsx` tải qua `/truck/reports/{id}/download` | ✅ | Cả 3 sheet (vi/en/ko): row 24 "Chi phí khác" = 0 (giữ), **row 25 "Chi phí bảo trì" = 2.000.000**, row 26 Tổng chi phí `=SUM(C19:C25)` = 4.024.000, row 29 Lợi nhuận gộp `=C16-C26` = 4.476.000, row 30 margin `=IFERROR(C29/C16,"")`; mục D rows 33–35; mục E header row 38, xe từ row 39: 51C Chi phí 4.024.000 · LN 4.476.000 (`=F40-G40`); TỔNG row 41 = mục B/C |
| C11 Badge stale | ✅ | Trước khi lập BC mới, bảng "Theo khu vực" HCM hiện "Đã lập BC · 16:24 17/08/2026 — dữ liệu đã thay đổi, cần lập lại" (nguồn stale = bảo trì) |

Dữ liệu test **để lại trên dev** để người dùng tự xem: bản ghi bảo trì 51C 10–12/08/2026 (2.000.000) + báo cáo `Tổng kết chi phí tháng · Khu vực HCM` tạo 17:17 05/09/2026.

### B11 — Import Excel bị chặn theo khoảng bảo trì (2026-09-05, ~17:4x, ADMIN)

File tạo từ template chính thức (`/truck/import/template`, 18 cột) với 2 dòng cho xe 51C-458.32: dòng 2 ngày 20/08/2026 (hợp lệ), dòng 3 ngày **11/08/2026** (trong khoảng bảo trì 10–12/08). Đẩy file vào panel `/truck/import` (input file, parse SheetJS), chọn xe 51C + tài xế, bấm "Nhập 2 dòng".

| Kỳ vọng | Kết quả |
|---|---|
| Từ chối **toàn file**, nêu số dòng | ✅ Toast `CAR-E1013 — Dòng 3: xe 51C-458.32 đang bảo trì từ 10/08/2026 đến 12/08/2026.` |
| Không ghi dòng nào (kể cả dòng 2 hợp lệ) | ✅ `car_trips` LOG vẫn 2 dòng; không có chuyến "KH import…"; `car_imports` không thêm dòng (pre-scan chạy trước khối ghi) |

### D — Phân quyền khu vực với MANAGER bị thu hẹp (2026-09-05, ~17:5x)

Fixture tạm: gán `car_user_region_access(HCM)` cho "Demo MANAGER" `0a0a…00c2` (TRUCK); thêm bản ghi bảo trì xe **60C-522.18 (Đồng Nai)** 20–21/08 · 1.500.000 bằng SQL. Đăng nhập `dev-login?role=MANAGER&sub=…00c2`. Sau test đã gỡ cả hai fixture.

| TC | Kết quả | Quan sát |
|---|---|---|
| D1 Danh sách `/truck/maintenance` | ✅ | Chỉ 1 bản ghi (51C HCM); bản ghi Đồng Nai **ẩn**; Select khu vực chỉ "HCM"; Select xe chỉ 29C-99999 + 51C-458.32; sidebar MANAGER có mục Bảo trì, không có nhóm Admin |
| D1b Form tạo mới | ✅ | Select xe chỉ 2 xe HCM, không có 60C-* |
| D2 Gọi thẳng server action `createTruckMaintenanceAction` (Next-Action) với xe Đồng Nai | ✅ | `{"success":false,"error":{"code":"CAR-E0403","message":"Forbidden: no access to region DONG_NAI"}}` |
| D2b Cùng action với xe HCM nhưng trùng ngày có chuyến | ✅ | `CAR-E1014` kèm details `{plate, count: 2, refs: [TRK-2608-002, TRK-2608-001]}` → manager đi được tới guard nghiệp vụ trên xe khu vực mình |
| D2c ADMIN gọi action với `end_date < start_date` | ✅ | `CAR-E0001` (zod) |
| D5 MANAGER mở URL sửa bản ghi Đồng Nai | ✅ | Trang lỗi (error boundary, `CAR-E0403 Forbidden`) — cùng hành vi trang sửa xe ngoài khu vực hiện có; mở bản ghi HCM → form "Sửa bảo trì · 51C-458.32" bình thường |
| — | — | DB sau các lời gọi bị chặn: số bản ghi bảo trì không đổi |

### Rà soát BR "Không tính phân bổ cho từng chuyến" (2026-09-07)

Truy vết code mọi nơi tiêu thụ chi phí bảo trì và mọi đường tính chi phí theo chuyến:

| Tầng | Nơi | Kết quả |
|---|---|---|
| Tổng tháng | `packages/core/src/truck/truck-pnl.service.ts` — `row.maintenanceCost = maintenance.forMonth(m)`; `fixedCost = salary + depreciation + maintenanceCost` | ✅ Cộng ở cấp tháng/phạm vi (khu vực · xe), không chia cho `tripCount`; **không** bị về 0 khi xe không có chuyến (khác lương/KH) |
| Phân bổ theo chuyến — live | `truck-fixed-allocation.ts` → `loadTruckFixedAllocation` chia `loadTruckFixedMonthly` (lương + KH) ÷ số chuyến COMPLETED; `TruckTripFixedShare {salary, depreciation, total = salary + depreciation}` | ✅ Không có trường bảo trì; `truck-fixed-monthly.ts` không tham chiếu bảo trì |
| Phân bổ theo chuyến — đóng băng khi lập BC | `computeTruckFixedAllocRows` ghi `{vehicleId, salary, depreciation, tripCount}` vào `trr_fixed_alloc`; reader `fixedShareForTrip` (truck-fuel-snapshot.ts) chia lương/KH ÷ tripCount | ✅ Không có bảo trì |
| Chi phí một chuyến | `truck-trips.queries.ts`: `totalCost = fuel.cost + tollFee + extraTotal`; `profitAfterFixed = revenue − totalCost − fixedShare.total` | ✅ Chỉ biến đổi + lương/KH phân bổ |
| UI tiêu thụ phân bổ theo chuyến | chi tiết chuyến (`trips/[id]`, `truck/trips/[id]`), bảng chuyến ở Finance + export | ✅ Không file nào dùng `maintenanceCost` |
| Nơi tiêu thụ `maintenanceCost` | dashboard, finance (ghi chú tổng), P&L (trang + export), query xuất báo cáo (mục B dòng 25 + mục E theo **xe**) | ✅ Toàn bộ ở cấp tháng / xe-tháng |

Kiểm chứng dữ liệu dev tháng 08/2026 (xe 51C có bảo trì 2.000.000): chi tiết chuyến TRK-2608-002 → Tổng chi phí 2.024.000 ₫ · Lợi nhuận 6.476.000 ₫ (không dòng bảo trì); cùng lúc dashboard/P&L/báo cáo tháng → Tổng chi phí 4.024.000 · LN 4.476.000.

Không còn TC nào chưa chạy trên dev, trừ D3/D4 (DRIVER redirect `/today`, MANAGER không có TRUCK access → `/dashboard`) vốn do `truck/layout.tsx` sẵn có xử lý, không thuộc thay đổi này.

## 2. Chưa chạy trong phiên (cần staging)

Toàn bộ nhóm **A (CRUD/list)**, **B (chặn hai chiều)**, **C (số liệu)**, **D (phân quyền)** và **E3/E4** trong TC cần DB có bảng `car_truck_maintenances` + dữ liệu chuyến. Trình tự đề xuất:

1. Áp `packages/db/migrations/0030_truck_maintenance.sql` lên Neon dev/staging (idempotent) — **trước** khi deploy build.
2. Deploy staging → chạy A1–A11, B1–B13, C1–C12, D1–D4 theo TC.
3. Điểm cần soi kỹ nhất:
   - **C2/C3**: Σ lát donut = tâm; Tổng phí cố định = Σ 3 dòng.
   - **C6**: cột phân bổ theo chuyến KHÔNG đổi sau khi thêm bảo trì; Σ LN chuyến − bảo trì = LN tháng.
   - **C9**: template báo cáo có thêm dòng 25, các công thức `SUM(C19:C25)`, `C16−C26`, `C29/C16` đúng ô; mục D/E không lệch hàng.
   - **B11**: import Excel bị từ chối toàn file, không dòng nào ghi.
   - **B4**: cảnh báo hiện ngay khi mở trang sửa (Q5).

## 3. E2E tự động

Chưa viết spec Playwright cho REQ này (không có môi trường chạy để xác nhận spec xanh). Đề xuất bổ sung `apps/web/e2e/truck-maintenance.spec.ts` theo pattern `truck-fixed-alloc-freeze.spec.ts` khi có dev DB: seed xe + chuyến → tạo bảo trì → tạo chuyến trong khoảng (E1013) → ngoài khoảng (OK) → bảo trì trùng chuyến (E1014) → đối chiếu số dashboard/P&L.
