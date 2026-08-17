# BUG-260817 — Lập báo cáo chọn 1 xe nhưng file xuất vẫn hiện cả khu vực

| | |
|---|---|
| **Ngày** | 2026-08-17 |
| **Phạm vi** | Wizard `/truck/reports/new` (bước 3 Review) + `generateTruckReportAction` + `getTruckReportExport` — chỉ định dạng `MONTHLY_SUMMARY` |
| **Mức độ** | Trung bình — không sai số liệu (số vẫn đúng công thức), nhưng báo cáo "chốt sổ" không phản ánh đúng phạm vi xe người dùng đã chọn ở bước 2.5 |
| **Branch** | `staging` |
| **Trạng thái** | ✅ Đã sửa (repro + verify bằng cách gọi thẳng Server Action qua HTTP + tải lại file Excel thật từ S3 để đọc nội dung) |

> **Báo cáo của người dùng (2026-08-17)**: *"lập báo cáo chọn 1 xe mà xuất file hiện vẫn 2 xe, cần show chuẩn theo xe, và các logic đi theo cũng vậy"*

---

## 1. Hiện tượng

`/truck/reports/new` → chọn tháng → chọn khu vực → bước 2.5 **Chọn xe**, bỏ chọn còn 1/2 xe → bước 3 Review (đã hiện đúng 1 xe) → để định dạng mặc định **"Tổng kết chi phí tháng"** (`MONTHLY_SUMMARY`) → **Lập báo cáo**.

File Excel tải về vẫn hiện **cả 2 xe** của khu vực (khối KPI "Tổng xe", và bảng "E. CHI TIẾT TỪNG XE"), như thể bước chọn xe chưa từng xảy ra. Đổi sang định dạng "Chi tiết đầy đủ" (`PNL`) thì lọc đúng — chỉ `MONTHLY_SUMMARY` (định dạng mặc định) bị ảnh hưởng.

## 2. Nguyên nhân

Đây không phải lỗi tính sai — là một nhánh loại trừ **có chủ đích**, cài từ REQ-20260817, nhưng giả định nền của nhánh đó (GĐ-A trong tài liệu REQ) chưa từng được khách hàng xác nhận:

> *"MONTHLY_SUMMARY (form R1 khách đã duyệt) — đề xuất giữ nguyên toàn khu vực, không cho chọn xe, vì khối KPI của form tính trên toàn bộ xe sống của khu vực"* — [REQ-20260817 §7 GĐ-A](../analysis/REQ-20260817-truck-report-wizard-vehicle-scope.md)

Tài liệu triển khai tự ghi rõ đây là giả định treo: *"nếu khách hàng xác nhận muốn khác, cần REQ riêng vì đụng tới form đã duyệt"* — nhưng chưa có REQ nào chốt lại, nên hành vi mặc định (bỏ qua tập xe) vẫn nằm trong code cho tới hôm nay.

Nhánh loại trừ này lặp lại ở **3 lớp độc lập**, tất cả đều check `type === 'MONTHLY_SUMMARY'` / `includeIdle`:

1. **Client** — [report-review-step.tsx:130-132](../../apps/web/src/app/(app)/truck/reports/_components/report-review-step.tsx#L130): chỉ gửi `vehicle_ids` lên server khi `fmt !== 'MONTHLY_SUMMARY'`.
2. **Server Action** — [truck-report.actions.ts:241](../../apps/web/src/server/actions/truck-report.actions.ts#L241): `generateOneTruckReport` tự ép `vehicleIds = undefined` khi `type === 'MONTHLY_SUMMARY'`, kể cả khi caller có gửi lên.
3. **Query** — [truck-report-export.queries.ts:150](../../apps/web/src/server/queries/truck-report-export.queries.ts#L150): `getTruckReportExport` tự ép `vehicleScope = undefined` khi `opts.includeIdle` (`buildReportWorkbook` luôn gọi `includeIdle: true` cho MONTHLY_SUMMARY) — nên cả `scopeVehicles` (khối KPI) lẫn truy vấn chuyến đi đều KHÔNG BAO GIỜ nhận được tập xe đã lọc cho định dạng này.

`MONTHLY_SUMMARY` là định dạng **mặc định** của bước Review ([report-review-step.tsx:49](../../apps/web/src/app/(app)/truck/reports/_components/report-review-step.tsx#L49)) — người dùng chọn xe ở bước 2.5, thấy đúng bước Review (bước Review tự lấy dữ liệu qua `getTruckReportReview(..., vehicleIds)` nên vẫn hiện đúng 1 xe), rồi bấm "Lập báo cáo" mà không đổi định dạng → dính đúng 3 nhánh loại trừ trên.

## 3. Phương án sửa

Xác nhận với người dùng (2026-08-17): **bỏ hẳn ngoại lệ GĐ-A** — mọi định dạng, kể cả `MONTHLY_SUMMARY`, đều lọc theo đúng tập xe đã chọn, khối KPI (Tổng xe / hoạt động / bảo dưỡng / TB chuyến / TB km) tính lại trên đúng tập đã chọn thay vì cả khu vực.

Gỡ điều kiện loại trừ ở cả 3 lớp — không đổi công thức tính (`computeTruckPnl`, `loadTruckRegionSnapshots`), không đổi layout Excel, không đổi field nào của form đã duyệt, chỉ đổi **input** cấp cho `scopeVehicles`/`rows`:

- `truck-report-export.queries.ts`: `vehicleScope = opts.vehicleIds?.length ? opts.vehicleIds : undefined` (bỏ `!opts.includeIdle &&`) — `scopeVehicles`/`trips` đã có sẵn nhánh `inArray(...)`, chỉ cần được truyền `vehicleScope` đúng.
- `truck-report.actions.ts`: `const vehicleIds = opts.vehicleIds` (bỏ ép `undefined` theo `type`).
- `report-review-step.tsx`: gửi `vehicle_ids` cho mọi định dạng; gỡ banner cảnh báo "định dạng này luôn phủ toàn khu vực" (không còn đúng) + key i18n `vehicleMonthlySummaryOverride` (3 ngôn ngữ).

Không đụng: bước Review (đã lọc đúng từ trước qua `getTruckReportReview`), snapshot fold `loadTruckRegionSnapshots` (BL-1, đã fold theo xe từ REQ-20260817), 2 màn trích xuất ad-hoc `/truck/finance` + `/truck/pnl` (không liên quan `trr_vehicle_ids`).

## 4. File thay đổi

| File | Loại | Nội dung |
|---|---|---|
| `apps/web/src/server/queries/truck-report-export.queries.ts` | sửa | Bỏ `!opts.includeIdle &&` khỏi điều kiện `vehicleScope` |
| `apps/web/src/server/actions/truck-report.actions.ts` | sửa | Bỏ ép `vehicleIds = undefined` theo `type === 'MONTHLY_SUMMARY'` |
| `apps/web/src/app/(app)/truck/reports/_components/report-review-step.tsx` | sửa | Gửi `vehicle_ids` cho mọi định dạng; gỡ banner cảnh báo lỗi thời |
| `apps/web/messages/{vi,en,ko}.json` | sửa | Gỡ key `screens.truckReports.vehicleMonthlySummaryOverride` (không còn nơi dùng) |

## 5. Kiểm chứng (dev DB thật, gọi thẳng Server Action qua HTTP)

Không dùng local preview để test tương tác được (hydration local đã biết là hỏng — xem `reference_preview_skeleton_wedge` trong memory), nên verify bằng cách gọi thẳng `generateTruckReportAction` qua HTTP (`Next-Action` header, lấy id từ page bundle đã compile), rồi tải LẠI đúng file Excel vừa sinh từ S3 và đọc nội dung bằng ExcelJS.

Khu vực HCM (dev), 2 xe: `51C-458.32` (có 1 chuyến tháng 8/2026) + `29C-99999` (không chuyến). Gọi `generateTruckReportAction({ month: '2026-08', region: 'HCM', type: 'MONTHLY_SUMMARY', vehicle_ids: ['...458.32'] })`:

| Kiểm tra | Trước sửa (suy ra từ code) | Sau sửa (đo thật) |
|---|---|---|
| `car_truck_reports.trr_vehicle_ids` | `NULL` (bị ép) | `["29ad0000-...-000102"]` ✅ |
| `trr_name` | không có hậu tố xe | `"Tổng kết chi phí tháng · Khu vực HCM · 1/2 xe"` ✅ |
| Excel — "Tổng xe" (B11-B12) | `2 xe` | **`1 xe`** ✅ |
| Excel — dòng trạng thái (B13) | `2 hoạt động · 0 bảo dưỡng` | **`1 hoạt động · 0 bảo dưỡng`** ✅ |
| Excel — bảng "E. CHI TIẾT TỪNG XE" | 2 dòng (cả `29C-99999`) | **1 dòng** — chỉ `51C-458.32` ✅ |
| Excel — dòng "Tổng / Total" | Σ của 2 xe | Σ của đúng 1 xe đã chọn ✅ |

2 report test tạo trong lúc kiểm chứng đã được dọn (soft-delete `car_truck_reports` + xoá object S3 tương ứng) — không để lại dữ liệu rác trên dev.

`tsc --noEmit` exit 0. Không hồi quy: định dạng `PNL`/`TRIP_LOG`/`VEHICLE` không đổi code, vẫn dùng đúng nhánh lọc đã có từ REQ-20260814.

## 6. Chống tái phát

| Vấn đề | Quy tắc |
|---|---|
| Giả định "chờ khách xác nhận" (GĐ-X trong REQ) bị code hoá trước khi có REQ chốt lại | Khi REQ tự đánh dấu `status: Draft (N giả định chờ KH xác nhận)`, coi bước xác nhận đó là **gate bắt buộc trước khi merge**, không phải trước khi viết PLAN — nếu code đã lỡ triển khai theo hướng đề xuất, phải quay lại xác nhận trước khi coi là "xong". |
| Một điều kiện loại trừ nằm rải ở nhiều lớp (client + action + query) | Khi gỡ/sửa một nhánh loại trừ theo `type`/flag, phải grep toàn bộ occurrence của điều kiện đó (ở đây: `MONTHLY_SUMMARY` × `vehicleIds`/`includeIdle`) trước khi sửa — sửa 1/3 chỗ vẫn để bug tồn tại ở 2 chỗ còn lại. |
| Bug chỉ hiện ở định dạng MẶC ĐỊNH | Test tính năng "chọn X rồi tạo Y" phải test cả nhánh mặc định lẫn nhánh phải-đổi-tay — người dùng thật hiếm khi đổi khỏi giá trị mặc định của 1 form nhiều bước. |
| Không có preview tương tác được ở local | Verify tính năng ghi (server action) bằng cách gọi thẳng qua `Next-Action` header + đọc lại kết quả thật (DB row / file S3), không chỉ đọc code — đặc biệt với báo cáo tài chính, nơi "đúng logic" không thay thế được "đã thấy số ra đúng trên file thật". |
