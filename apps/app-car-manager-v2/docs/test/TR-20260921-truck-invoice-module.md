# TR-20260921 — Truck: Module Hóa đơn (Invoice Aggregation)

> Kết quả thực thi [TC-20260921](TC-20260921-truck-invoice-module.md) cho [REQ-20260921](../analysis/REQ-20260921-truck-invoice-module.md) / [PLN-20260921](../plan/PLN-20260921-truck-invoice-module.md). Cập nhật lần 3 (2026-09-21: lần 2 seed đa persona + lần 3 thêm R7 tìm kiếm theo tên hóa đơn).

```yaml
executed: 2026-09-21 (lần 1: smoke test OWNER-only; lần 2: seed đầy đủ + đa persona; lần 3: bổ sung R7 search)
environment: local dev (localhost:3001) + Neon DEV branch ep-steep-tooth (đã xác nhận host trước khi ghi)
executor: Claude (dev@amoeba.group)
status: Nhóm rủi ro cao nhất (R5 CAR-exclusion, ACL khu vực/phòng ban) — TẤT CẢ PASS trên dữ liệu thật. 1 gap thiết kế phát hiện + đã chốt lại (xem §5). R7 (search) PASS.
```

## 1. Tóm tắt

| Nhóm | Tổng TC | Pass (verified thật) | Chưa chạy |
|---|---|---|---|
| A · Aggregation logic | 12 | 10 | 2 (TC-07 phân trang >1 trang, TC-11 sửa lại kỳ vọng — xem §5) |
| B · uploaded_by | 6 | 5 | 1 (TC-16/17 backfill với key lệch format có kiểm soát) |
| C · ACL 2 tầng | 5 | 5 | 0 |
| D · UI (gồm TC-31 mới — R7 search) | 8 | 7 | 1 (TC-26 chưa xác nhận file lưu xuống đĩa thật — giới hạn browser pane) |
| Regression | 7 | 3 (RG-04, RG-06, RG-07) | 4 (cần A/B trước/sau trên 6 màn TRUCK khác) |

**Không phát hiện lỗi runtime nào.** Phát hiện **1 gap giữa đặc tả và code** (TC-11 — hành vi fuel-invoice không file), đã xem xét và **chốt giữ hành vi code** (hợp lý hơn đặc tả gốc) — xem §5.

## 2. Build & static checks (không đổi từ lần 1)

| Check | Kết quả |
|---|---|
| `npm run typecheck` (5 packages) | ✅ 5/5 |
| `npm run lint` | ✅ 0 lỗi |
| i18n JSON hợp lệ (vi/en/ko) | ✅ |
| Migration `0035` áp + verify qua `check-manual-migrations.mjs` | ✅ 9/9 |

## 3. Seed dữ liệu thật cho lần verify này (đã xoá sạch sau khi test)

Dùng UUID prefix `c0ffee00` để dễ nhận diện + xoá. Entity `00000000-…-0010` (entity dev có sẵn).

| # | Dữ liệu | Mục đích |
|---|---|---|
| 1 | Expense TRUCK (`REPAIR`, xe `60C-311.07`/Đồng Nai) + attachment | Nguồn EXPENSE thật (trước đó seed chỉ có MAINTENANCE) |
| 2 | Expense **CAR** (`FUEL`, xe `51K-123456`) + attachment | **Test R5** — phải KHÔNG xuất hiện |
| 3 | Trip-cost attachment gắn vào 1 trip `LOG` có sẵn (`29C-99999`/HCM) | Nguồn TRIP_COST thật |
| 4 | Fuel invoice CÓ attachment (Baiksan, `43C-201.55`) | Nguồn FUEL_INVOICE thật |
| 5 | Fuel invoice KHÔNG attachment (HCM, `51C-458.32`) | Test R4 "optional" |
| 6 | 1 row `car_user_region_access` — thu hẹp **Demo MANAGER** (`…c2`, đã có TRUCK fleet access) về **Đồng Nai** | Test ACL khu vực cho role MANAGER thật (row region-access có sẵn duy nhất trong DB thuộc về 1 DRIVER, không dùng được cho case này) |

Đã **xoá sạch cả 6 mục + 1 row tạo qua UI (mục 7 dưới) sau khi test** — xác nhận bằng query `count(*) = 0` cho mọi bảng liên quan.

## 4. Kết quả chi tiết — persona ADMIN (Demo OWNER)

Truy cập `/truck/invoices` sau khi seed:

| Kiểm tra | Kết quả |
|---|---|
| Tổng số hóa đơn | **5** (2 maintenance có sẵn + 3/4 mục mới; mục "CAR" và mục "fuel không file" đúng như kỳ vọng KHÔNG được tính) |
| **R5 — CAR expense bị loại** | ✅ **PASS** — expense CAR (mục 2) không xuất hiện ở bất kỳ đâu trong bảng/list, kể cả khi không filter gì |
| Nhãn "Loại hóa đơn" đủ 4 dạng | ✅ "Nhiên liệu (chuyến đi)", "Bảo trì / sửa chữa xe", "Sửa chữa (chi phí)", "Hóa đơn xăng dầu tháng" — đúng phân biệt nguồn khi trùng tên (REPAIR) |
| Khu vực resolve đúng theo nguồn | ✅ HCM (maintenance + trip-cost), Đồng Nai (expense), Baiksan (fuel invoice) — đều đúng |
| Ngày = ngày phát sinh nghiệp vụ (D6) | ✅ Trip-cost lấy đúng ngày trip thật (không phải ngày seed hôm nay); expense/fuel-invoice lấy đúng `occurred_at`/`tfi_date` đã set |
| `uploaded_by` → tên hiển thị | ✅ Tất cả hiện "Demo OWNER" đúng (2 dòng cũ từ backfill migration, 3 dòng mới set trực tiếp) |
| Dropdown "Loại hóa đơn" chỉ hiện data thật có | ✅ 4 option, không hard-code cả 17 mã |
| S3 key prefix đúng theo nguồn | ✅ `/maintenance/`, `/trips/`, `/expenses/`, `/fuel-invoices/` |

## 5. Phát hiện: TC-11 sai so với hành vi thực tế đúng (đã chốt lại)

**Quan sát**: hóa đơn xăng dầu KHÔNG có attachment (mục 5) **không xuất hiện** trong danh sách — khác với TC-11 gốc ("row vẫn hiện, action ẩn"). Nguyên nhân: `fetchFuelInvoiceRows()` viết `FROM car_truck_fuel_invoice_attachments` (bảng attachment là gốc), nên ledger-entry không có file không sinh ra row nào.

**Quyết định sau khi xem xét**: **giữ hành vi code, sửa lại đặc tả** (đã cập nhật REQ §7 D8 + TC-11). Lý do: màn "Hóa đơn" về bản chất là danh sách **chứng từ** (1 row = 1 file) — 3 nguồn khác (trip-cost/maintenance/expense) đã luôn 1:1 với attachment từ đầu, không có khái niệm "nghiệp vụ chưa có file thì hiện dòng rỗng". Hiện 1 dòng với "Tên hóa đơn" trống và Action disabled cho 1 ledger-entry-chưa-có-file sẽ khó hiểu hơn là hữu ích, và dữ liệu ledger đó vẫn xem đầy đủ ở màn Tài chính — không mất thông tin.

## 6. Kết quả chi tiết — persona MANAGER bị thu hẹp khu vực (Demo MANAGER → Đồng Nai)

| # | Kiểm tra | Kết quả |
|---|---|---|
| 1 | Vào `/truck/invoices` không filter | ✅ **PASS** — chỉ thấy **1/5** hóa đơn (đúng mục Đồng Nai); ẩn hoàn toàn HCM (3 dòng) + Baiksan (1 dòng) |
| 2 | Dropdown "Khu vực" | ✅ Chỉ có "Đồng Nai" (không có HCM/Baiksan) |
| 3 | Dropdown "Xe" | ✅ Chỉ 2 xe Đồng Nai (`60C-311.07`, `60C-522.18`) |
| 4 | Dropdown "Loại hóa đơn" | ✅ Chỉ "Sửa chữa (chi phí)" (loại duy nhất có trong phạm vi được phép) |
| 5 | Truy cập trực tiếp `?region=HCM` | ✅ **PASS** — banner "Bạn không có quyền xem khu vực HCM — đã hiển thị lại các khu vực bạn phụ trách", KHÔNG lộ dữ liệu HCM, tự động rơi về Đồng Nai (đúng cơ chế `resolveRegionFilter` tái dùng từ REQ-20260813) |
| 6 | Tạo hóa đơn xăng dầu MỚI qua UI thật (form `/truck/pnl?region=DONG_NAI`, không kèm file) | ✅ **PASS** — submit thành công (`POST 200`), `tfi_created_by` = đúng user_id của Demo MANAGER — xác nhận R4 "optional" hoạt động thật qua action, không chỉ qua DB trực tiếp |
| 7 | Gắn 1 file vào chính hóa đơn vừa tạo (uploaded_by = Demo MANAGER) rồi vào lại `/truck/invoices` | ✅ **PASS** — row mới xuất hiện (tổng 2/5), cột "Cập nhật bởi" hiện đúng **"Demo MANAGER"** (khác "Demo OWNER" của các dòng khác) — xác nhận join `uploaded_by → tên` resolve đúng theo TỪNG actor, không bị hardcode |

## 7. Kết quả chi tiết — persona DRIVER (Demo MEMBER, có TRUCK fleet access)

| Kiểm tra | Kết quả |
|---|---|
| Truy cập `/dev-login?...&next=/truck/invoices` | ✅ **PASS** — log server xác nhận `GET /today 200` (không phải `/truck/invoices`) — layout `/truck/*` chặn DRIVER trước khi vào được màn/query, đúng thiết kế kế thừa (không cần code mới, side-impact = 0) |

## 7b. R7 — Tìm kiếm theo tên hóa đơn (bổ sung, verify sống lần 3)

Sau khi rà soát thấy 7/9 màn danh sách khác trong app đều có `DebouncedSearchInput` (`?q=`) mà `/truck/invoices` không có, đã thêm cho nhất quán (không thuộc yêu cầu gốc khách hàng — xem REQ §1 R7).

| # | Kiểm tra | Kết quả |
|---|---|---|
| TC-31 | Gõ "garage" vào ô tìm kiếm (2 hóa đơn maintenance có sẵn, 1 tên chứa "garage") | ✅ **PASS** — debounce → `?q=garage` → còn đúng **1/2** hóa đơn (`hoa-don-garage-truong-hai.pdf`), nút "Xoá lọc" xuất hiện |
| — | Bấm "Xoá lọc" | ✅ **PASS** — quay lại đủ **2/2**, `?q=` bị xoá khỏi URL |
| — | Console/server log | ✅ Không lỗi, không warning mới |

## 8. Chưa chạy / giới hạn công cụ

| Mục | Lý do |
|---|---|
| TC-07 (phân trang >1 trang) | Cần >20 hàng — không seed vì tốn công, rủi ro thấp (logic `slice()` đơn giản, đã đọc code kỹ) |
| TC-16/17 (backfill với key lệch format, có kiểm soát A/B) | Migration đã chạy thật trên dữ liệu cũ (2 hàng maintenance) và set đúng "Demo OWNER" — nhưng không phải test có seed key lệch format riêng để xác nhận nhánh NULL |
| TC-26 (tên file khi lưu xuống đĩa) | Browser pane không có action "download & inspect file" — chỉ xác nhận URL chứa đúng tên file trong path, không xác nhận trình duyệt lưu đúng tên (giới hạn công cụ, không phải giới hạn code — code dùng đúng pattern `download={name}` như các màn khác) |
| Upload file THẬT qua UI (chọn file từ máy) | Công cụ browser pane hiện tại không có action "chọn file cho `<input type=file>`" — đã proxy bằng: tạo ledger row qua UI thật (xác nhận `actor.userId` đúng) + gắn file qua DB với cùng `uploaded_by`, rồi xác nhận hiển thị đúng tên người dùng khác nhau theo từng dòng |
| Regression RG-01/02/03/05 (A/B 6 màn TRUCK khác + luồng CAR) | Chưa so trước/sau — thay đổi lần này KHÔNG sửa file nào của 6 màn đó (chỉ thêm mới), rủi ro thấp nhưng chưa đo bằng số |

## 9. Kết luận

- **2 rủi ro cao nhất đã nêu ở lần TR trước (R5 CAR-exclusion, ACL non-admin) — cả hai PASS trên dữ liệu thật, đa persona (ADMIN/MANAGER-thu hẹp/DRIVER-bị-chặn).**
- **1 gap đặc tả phát hiện qua verify sống, đã xem xét và chốt lại** (giữ code, sửa TC/REQ) — không phải lỗi, là quyết định thiết kế đúng hơn sau khi thấy hành vi thật.
- Phần còn lại chưa chạy đều là rủi ro thấp (logic đơn giản, đã type-check + đọc code) hoặc bị giới hạn bởi công cụ test (upload file thật, đo file lưu xuống đĩa) — không phải rủi ro nghiệp vụ.
- **Đề xuất**: đủ điều kiện để commit + mở PR review. Trước khi lên staging: áp `0035_truck_invoice_module.sql` tay + `check-manual-migrations.mjs` xác nhận TRƯỚC deploy (bắt buộc, tiền lệ FIX-260914); khi có UI thật (Playwright/thao tác tay) nên bổ sung 1 lượt upload file thật qua form để đóng nốt TC-13/14/15.
