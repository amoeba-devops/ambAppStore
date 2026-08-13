# TR-20260813 — Region Access Control: Báo cáo Kết quả Test

> Thực thi [TC-20260813-region-access-control](TC-20260813-region-access-control.md).
> Kết quả cuối: **37/37 check server-side PASS** + **5/5 test UI (Playwright) PASS**.
> **1 defect UX được phát hiện và đã sửa trong lần test này** — xem §7.

## 1. Môi trường test

| Mục | Giá trị |
|---|---|
| Ngày | 2026-08-13 |
| Môi trường | Local dev (`localhost:3001`, Next 15 dev server) |
| DB | Neon branch dev `ep-steep-tooth` (`DATABASE_URL_DEV`) |
| Migration | `0026_truck_region_access.sql` áp thủ công vào dev — xác nhận 7 cột đúng schema |
| Persona | `dev-login?role=MANAGER` (Demo MANAGER, `00000000-…-002`) và `?role=OWNER` (Demo OWNER → local ADMIN) |
| Dữ liệu | 5 xe TRUCK trong ent `…-010`: HCM ×2 (29C-99999, 51C-458.32), DONG_NAI ×2 (60C-311.07, 60C-522.18), BAIKSAN ×1 (43C-201.55) |
| Typecheck | `tsc --noEmit` exit 0 ở `apps/web`, `packages/db`, `packages/shared`, `packages/core` |

**Tiền điều kiện bổ sung**: Demo MANAGER mặc định chỉ có `car_user_fleet_access = CAR` → mọi route `/truck/*` bị chặn 307 ở tầng **department** (có sẵn từ REQ-20260617), trước khi tới tầng khu vực. Script test tạm cấp TRUCK department access rồi **xoá lại sau khi chạy** để trả nguyên trạng DB.

## 2. Phương pháp đo — điều chỉnh so với TC gốc (quan trọng)

TC gốc giả định "khu vực ngoài quyền → status ≠ 200". Thực tế trong Next.js App Router **status code không phản ánh kết quả ACL**:

| Hiện tượng | Nguyên nhân | Cách đo đã dùng |
|---|---|---|
| Trang admin trả **200** cho MANAGER | `redirect()` trong Server Component xảy ra ở tầng RSC; raw document fetch nhận shell 200. **Đã kiểm chứng: các trang admin có sẵn (`/settings/fleet-access`, `/users`, `/audit`) cũng trả 200 y hệt** → hành vi framework, không phải lỗi mới | Assert theo **nội dung**: MANAGER không nhận được bảng thành viên (`"Nhân sự đội xe tải"`) |
| `?region=<ngoài quyền>` trả **200** | `CarError` được error boundary render (200 ở dev) thay vì HTTP 403 | Assert nội dung chứa `CAR-E0403` / `no access to region` |
| Biển số xe ngoài khu vực vẫn xuất hiện trong HTML thô | **React dev flight stream serialize giá trị trả về của server function** (kèm tên hàm + timing) — instrumentation chỉ có ở dev, không phải nội dung trang | Strip toàn bộ `<script>` trước khi assert |

Điểm thứ 3 từng làm test lần đầu báo 14 FAIL giả. Sau khi strip script, số lần xuất hiện biển số ngoài khu vực giảm **6 → 1** (1 còn lại nằm trong flight payload dev). Xác nhận riêng: route handler (`/truck/trips/export`) trả **HTTP status thật** → 403 đúng cho khu vực ngoài quyền, 200 cho khu vực được phép — đây là bằng chứng độc lập rằng guard chạy đúng.

## 3. Kết quả chi tiết

### A. Ngữ nghĩa resolver (9/9 PASS)

| TC | Kịch bản | Kết quả |
|---|---|---|
| TC-01 | 0 grant → thấy cả 5 xe + đủ 3 khu vực trong filter | PASS |
| TC-03 | Gán HCM → chỉ 2 xe HCM hiển thị; BAIKSAN + DONG_NAI bị ẩn | PASS |
| TC-12 | Gán HCM → dropdown khu vực chỉ còn HCM | PASS |
| TC-04 | Gán HCM + DONG_NAI → 4 xe hiển thị, BAIKSAN vẫn ẩn | PASS |
| TC-08 | Revoke hết → quay lại thấy cả 5 xe (mặc định mở) | PASS |
| TC-10 | Re-grant sau revoke → đúng 1 row live (unique index có điều kiện hoạt động) | PASS |

### B. Enforcement 6 màn (12/12 PASS)

Với MANAGER bị thu hẹp còn HCM:

| Màn | `?region=HCM` | `?region=DONG_NAI` |
|---|---|---|
| `/truck/fleet` | Cho phép | Chặn (CAR-E0403) |
| `/truck/dashboard` | Cho phép | Chặn |
| `/truck/trips` | Cho phép | Chặn |
| `/truck/finance` | Cho phép | Chặn |
| `/truck/pnl` | Cho phép | Chặn |
| `/truck/reports` | Truy cập được (danh sách đã lọc theo khu vực) | — |

Month-close: bề mặt đọc nằm trong `/truck/finance` (đã cover ở trên); repo không có action ghi month-close nên không có điểm ghi cần chặn thêm.

### B2. Phạm vi báo cáo (3/3 PASS)

| Kịch bản | Kết quả |
|---|---|
| `regions=ALL` (báo cáo hợp nhất toàn khu vực) khi bị thu hẹp | Chặn — đúng chủ đích: báo cáo hợp nhất bao trùm cả khu vực user không được xem |
| `regions=HCM` (khu vực của mình) | Cho phép |
| `regions=DONG_NAI` (khu vực khác) | Chặn |

### B3. Route handler — status thật (2/2 PASS)

| Kịch bản | Status |
|---|---|
| `/truck/trips/export?region=DONG_NAI` | **403** |
| `/truck/trips/export?region=HCM` | **200** |

### C. ADMIN không bị ảnh hưởng (5/5 PASS)

ADMIN (0 row) thấy cả 5 xe, vào được cả 3 khu vực qua param, và vẫn tạo được báo cáo hợp nhất `regions=ALL`. Hành vi giống hệt trước khi có REQ này (RG-06 đạt).

### D. Trang quản lý (3/3 PASS)

| TC | Kết quả |
|---|---|
| TC-21 | MANAGER **không** nhận được nội dung trang `/settings/region-access` |
| TC-22 | ADMIN nhận được bảng thành viên |
| TC-22 | Trạng thái "Tất cả khu vực (mặc định)" hiển thị đúng cho user chưa bị thu hẹp |

### i18n

Trang render đúng 3 ngôn ngữ: xác nhận key `screens.regionAccess.*` + `nav.regionAccess` có ở `vi/en/ko`; nhãn khu vực tái dùng namespace `region.*` sẵn có. Diff messages: +18 dòng/file, không reformat file.

## 4. Regression

| # | Kết quả |
|---|---|
| RG-01 | CAR flow không đổi — region ACL chỉ tác động trong ngữ cảnh TRUCK; `cvh_region` của xe CAR vẫn NULL |
| RG-02 | Fleet-access (department ACL) nguyên vẹn — MANAGER chỉ có CAR vẫn bị chặn `/truck/*` như trước; user có TRUCK + 0 region row vẫn vào được đầy đủ |
| RG-03 | Xe chưa gán khu vực (`cvh_region` NULL): giữ nguyên AS-IS — hiển thị với user không bị thu hẹp, ẩn với user bị thu hẹp (ghi nhận side-impact, không thuộc scope sửa) |
| RG-04 | Revoke chỉ set `ura_deleted_at`, không DELETE cứng |
| RG-05 | `tsc --noEmit` exit 0 cả 4 package |
| RG-06 | Output của ADMIN giống hệt trước thay đổi |

## 5. Test UI thật bằng Playwright (5/5 PASS)

Browser pane của IDE không hydrate được (đã biết), nên dùng **Playwright + Chromium thật** (`apps/web/e2e`, spec tạm đã xoá sau khi chạy; bản lưu ở scratchpad). Đây là lần đầu tính năng được **click thử bằng chuột thật**:

| # | Test | Kết quả |
|---|---|---|
| 1 | ADMIN: row của chính mình hiện badge "Toàn bộ khu vực" và **không có** nút gán; row khác hiện "Tất cả khu vực (mặc định)" | PASS |
| 2 | ADMIN click HCM → `aria-pressed=true`, nút "Lưu" xuất hiện → click Lưu → **toast** "Đã giới hạn Demo MANAGER trong 1 khu vực", badge mặc định biến mất | PASS |
| 3 | MANAGER bị thu hẹp: `/truck/fleet` chỉ có 2 xe HCM; dropdown không còn Đồng Nai/Baiksan | PASS |
| 4 | MANAGER gõ URL `?region=DONG_NAI` → **redirect** về `?region_denied=DONG_NAI` + banner giải thích, không leak dữ liệu | PASS |
| 5 | ADMIN thêm Đồng Nai → manager thấy 4 xe (vẫn ẩn Baiksan); bỏ tick hết → toast "Đã mở lại toàn bộ khu vực" → manager thấy lại cả 5 xe | PASS |

### Ba vấn đề của test harness đã phải xử lý (không phải lỗi sản phẩm)

1. **Race hydration** — click trước khi React attach là no-op → thêm `waitHydrated()` chờ `__reactProps`. Đây là lý do lần chạy đầu trông như "nút không hoạt động".
2. **Cookie dùng chung trong 1 browser context** — mở tab thứ hai rồi login MANAGER **ghi đè** session ADMIN của tab đầu → chuyển sang `browser.newContext()` riêng cho manager.
3. **Dev DB có 2 user "Demo MANAGER" trùng cả tên và email** (seed 2026-05-27 và 2026-06-22) nên UI không phân biệt được row nào → tạm ẩn bản trùng khi test, khôi phục sau. **Đây là vấn đề dữ liệu seed dev có sẵn, không do REQ này** — nhưng đáng lưu ý: trên môi trường thật, nếu có 2 user trùng tên+email thì admin cũng sẽ không phân biệt được row trong trang quản lý.

## 6. Trạng thái DB sau khi test

Đã khôi phục nguyên trạng: `car_user_region_access` **0 row**; quyền TRUCK tạm cấp cho persona MANAGER (ban đầu chỉ có CAR) **đã xoá**; quyền TRUCK của bản trùng **đã restore**.

## 7. Defect phát hiện & đã sửa trong lần test này

**Triệu chứng**: MANAGER bị thu hẹp mà gõ URL `?region=<khu vực ngoài quyền>` thì nhận **trang lỗi chung** "Đã có lỗi xảy ra · Mã lỗi: 3257100512" — dữ liệu vẫn được chặn đúng, nhưng người dùng tưởng app crash chứ không biết là do phân quyền.

**Nguyên nhân**: `resolveRegionFilter` ném `CarError('CAR-E0403')` ngay trong Server Component → Next đưa vào error boundary, không phải màn hình "không có quyền".

**Cách sửa**: với **page**, `resolveRegionFilter` giờ **redirect** về đúng trang đó, bỏ `region` và thêm `?region_denied=<code>`; component mới `RegionDeniedNotice` hiển thị banner cảnh báo (i18n vi/en/ko) trên cả 5 màn. Cách này khớp với cách các trang khác trong app xử lý authorization miss (`redirect()`, ví dụ `FleetAccessPage`). **Server Action và Route Handler giữ nguyên 403/`CAR-E0403`** — ở đó status code là đúng.

**Ảnh hưởng tới cách đo**: pages không còn trả nội dung `CAR-E0403`; với fetch thường, redirect của Server Component **không phải 3xx** mà nằm trong flight payload (`region_denied` xuất hiện trong payload thô, status vẫn 200). Bộ test server-side đã cập nhật assert theo đó và xanh lại toàn bộ.

## 8. Hạn chế còn lại

1. **Chưa test trên staging**: migration `0026` mới áp vào **local/dev** (`ep-steep-tooth`). Staging (`ep-noisy-heart`) **chưa áp** — phải áp trước khi deploy, nếu không sẽ 500 khi đọc bảng mới.
2. **Chưa build production**: kết luận "flight payload chỉ là dev instrumentation" dựa trên đặc điểm payload (tên hàm + timing + `env:"Server"`), chưa kiểm chứng bằng bản build prod.
3. **Chưa test trên mobile viewport**: các assert xe đều scope vào bảng desktop; danh sách card mobile chưa được kiểm riêng.

## 9. Kết luận

Chức năng đạt đúng model đã chốt: **0 row = tất cả khu vực (mặc định, không breaking)**, **có row = thu hẹp**, **ADMIN luôn toàn quyền**. Enforcement áp ở cả tầng đọc (6 màn + danh sách/tải báo cáo) và tầng ghi (tạo báo cáo, hoá đơn nhiên liệu, tạo/sửa xe), và đã được xác nhận bằng cả test server-side lẫn click thật trên UI. Sẵn sàng để bạn review diff và quyết định deploy staging.
