# TC-20260907 — Truck: Trạng thái Phương tiện (Sẵn sàng · Bảo trì tự động · Ngừng sử dụng)

> REQ: [REQ-20260907-truck-vehicle-status.md](../analysis/REQ-20260907-truck-vehicle-status.md) · PLN: [PLN-20260907-truck-vehicle-status.md](../plan/PLN-20260907-truck-vehicle-status.md)
> Môi trường: dev (`ep-steep-tooth`, `localhost:3001`) sau khi áp `0031`; lặp lại trên staging sau deploy. Vai trò: ADMIN, MANAGER khu vực HCM (bị thu hẹp), DRIVER xe tải.
> Dữ liệu: xe 51C-458.32 (HCM) có bản ghi bảo trì 10–12/08/2026 · 2.000.000 (đã có trên dev); xe 60C-311.07 (Đồng Nai) dùng để test Ngừng sử dụng; "hôm nay" = ngày UTC.

## A. Danh sách Phương tiện & trạng thái hiệu lực

| ID | Bước | Kỳ vọng |
|---|---|---|
| A1 | ADMIN › `/truck/fleet` sau migration | Cột Trạng thái: mọi xe **Sẵn sàng** (kể cả 43C-201.55, 60C-311.07 vốn đặt tay); không còn "Đang sử dụng" |
| A2 | Bộ lọc Trạng thái | Đúng 3 lựa chọn: Sẵn sàng · Bảo trì · Ngừng sử dụng; `?status=IN_USE` gõ tay → bỏ qua (hiện tất cả) |
| A3 | Hover badge | Tooltip mô tả đúng bảng REQ §3.1 (Sẵn sàng: "sẵn sàng để tạo chuyến"; Bảo trì/Ngừng: "…Không thể tạo chuyến mới") |
| A4 | Thêm bản ghi bảo trì cho 29C-99999: hôm nay → hôm nay + 2, chi phí 0 › Lưu › mở `/truck/fleet` | 29C **● Bảo trì · đến dd/mm/yyyy** ngay, không thao tác thêm; lọc "Bảo trì" → chỉ 29C (và xe khác đang trong khoảng) |
| A5 | Sửa bản ghi A4: đổi ngày bắt đầu = ngày mai | 29C về **Sẵn sàng** (khoảng chưa tới); chip ở menu Bảo trì = "Sắp tới" |
| A6 | Xoá bản ghi A4 (sau khi trả về hôm nay) | 29C về Sẵn sàng tức thì |
| A7 | Hai bản ghi chồng ngày cho 1 xe (hôm nay–+1 và hôm nay–+5) | Badge "đến" = ngày kết thúc xa nhất (+5) |
| A8 | Mobile (≤ md) | Card xe hiện badge + "đến dd/mm" cùng dòng; bộ lọc 3 trạng thái |

## B. Chuyển trạng thái tay (form sửa xe tải)

| ID | Bước | Kỳ vọng |
|---|---|---|
| B1 | `/truck/fleet/new` | **Không** có field Trạng thái; tạo xong → Sẵn sàng |
| B2 | `/truck/fleet/{60C-311.07}/edit` | Field Trạng thái: Select đúng 2 item Sẵn sàng / Ngừng sử dụng + hint "Chỉ chuyển giữa…"; không có Bảo trì / Đang sử dụng |
| B3 | Chọn Ngừng sử dụng › Lưu | Toast cập nhật; danh sách: **● Ngừng sử dụng**; audit `VEHICLE.UPDATE` có `before.status=AVAILABLE, after.status=RETIRED` |
| B4 | Sửa lại → Sẵn sàng › Lưu | Về Sẵn sàng; audit ghi ngược lại |
| B5 | Sửa xe đang trong khoảng bảo trì (29C sau A4) | Select vẫn hiện "Sẵn sàng" (giá trị lưu) + hộp ⓘ "Xe đang bảo trì đến dd/mm/yyyy — trạng thái Bảo trì được gán tự động" + link mở `/truck/maintenance?vehicle=…` |
| B6 | Trong B5 chọn Ngừng sử dụng › Lưu | Lưu được; danh sách hiện **Ngừng sử dụng** (ưu tiên hơn Bảo trì); bản ghi bảo trì vẫn còn ở menu Bảo trì, chi phí tháng không đổi |
| B7 | Gọi thẳng `updateVehicleAction(truckId, { status: 'MAINTENANCE' })` (Next-Action) | `{"success":false,"error":{"code":"CAR-E1001",…}}`; DB không đổi |
| B8 | Gọi thẳng với `status: 'IN_USE'` | CAR-E1001 |
| B9 | Gọi thẳng cho **xe con** với `status: 'MAINTENANCE'` | Thành công (CAR không đổi) |
| B10 | Form xe con `/vehicles/[id]` | Vẫn 4 trạng thái; nhãn RETIRED vẫn "Đã ngừng" |

## C. Không tạo chuyến mới

| ID | Bước | Kỳ vọng |
|---|---|---|
| C1 | 60C-311.07 = Ngừng sử dụng › `/truck/trips/new` › Select xe | **Không có** 60C-311.07 |
| C2 | Cùng trạng thái › `/truck/import` | Picker xe không có 60C-311.07 |
| C3 | DRIVER xe tải › `/today/truck/new` | Picker không có xe Ngừng sử dụng |
| C4 | Sửa một chuyến cũ của 60C-311.07 (tạo chuyến trước khi ngừng rồi ngừng) | Trang sửa vẫn hiện 60C-311.07 đã chọn (không vỡ form); chuyển sang xe khác được |
| C5 | Gọi thẳng `createTruckTripAction` với xe RETIRED | CAR-E1002 "Vehicle is retired" (đã có) |
| C6 | Xe đang bảo trì hôm nay › tạo chuyến **ngày trong khoảng** | Xe mờ trong picker theo ngày (đã có) · gọi thẳng → CAR-E1013 |
| C7 | Xe đang bảo trì hôm nay › tạo chuyến **ngày ngoài khoảng** (Q2 = theo ngày chuyến) | Cho phép (xe chọn được, lưu OK) — ghi rõ vì đây là quyết định Q2 |
| C8 | `/truck/maintenance/new` › Select xe | Không có xe Ngừng sử dụng; xe đang Bảo trì vẫn chọn được (ghi thêm đợt khác) |
| C9 | Gọi thẳng `createTruckMaintenanceAction` với xe RETIRED | CAR-E1002 409 "Vehicle is retired"; không ghi dòng |
| C10 | Sửa bản ghi bảo trì cũ của xe đã ngừng (không đổi xe) | Bị CAR-E1002 (BR-4); **xoá** vẫn được |

## D. Bảng điều khiển & báo cáo

| ID | Bước | Kỳ vọng |
|---|---|---|
| D1 | `/truck/dashboard` card "Tình trạng đội xe" | Đúng 3 dòng Sẵn sàng / Bảo trì / Ngừng sử dụng; tổng = số xe tải trong scope |
| D2 | Sau A4 | Bảo trì +1, Sẵn sàng −1; dòng Bảo trì là link → `/truck/maintenance` |
| D3 | Lọc khu vực HCM | Card chỉ đếm xe HCM (hành vi cũ giữ) |
| D4 | Lập báo cáo tháng hiện tại khi 29C đang bảo trì (A4) | Sheet: KPI "x hoạt động · 1 bảo dưỡng"; mục E dòng 29C trạng thái "Bảo trì" (màu hổ phách); xe không có chuyến & không bảo trì → "Nhàn rỗi" |
| D5 | Lập báo cáo tháng 08/2026 hôm nay (51C không còn trong khoảng) | 51C "Có lãi" như TR-20260904 (status theo thời điểm lập — BR-9); file cũ không đổi |
| D6 | Xe Ngừng sử dụng | Vẫn trong mục E (dòng Nhàn rỗi hoặc theo P&L) — Q4 |

## E. Phân quyền & khu vực

| ID | Bước | Kỳ vọng |
|---|---|---|
| E1 | MANAGER HCM-only › `/truck/fleet` | Chỉ xe HCM; badge đúng; sửa xe HCM đổi Ngừng sử dụng được |
| E2 | MANAGER HCM-only gọi thẳng `updateVehicleAction` xe Đồng Nai `status: 'RETIRED'` | CAR-E0403 (region ACL đã có) |
| E3 | DRIVER | Không vào `/truck/fleet` (đã có); picker hôm nay như C3 |

## F. Kỹ thuật

| ID | Bước | Kỳ vọng |
|---|---|---|
| F1 | Chạy `0031` lần 1 trên dev | `UPDATE 2` (43C-201.55, 60C-311.07); `SELECT cvh_status, count(*) … TRUCK` → AVAILABLE 5 |
| F2 | Chạy `0031` lần 2 | `UPDATE 0` (idempotent) |
| F3 | Xe con sau `0031` | Không đổi (`cvh_type='CAR'` không bị đụng) |
| F4 | `pnpm typecheck` · `pnpm lint` | Xanh (web + core) |
| F5 | i18n | `vi/en/ko` đủ khoá `screens.truckFleet.status.*`, `statusDesc.*`, `maintUntil`, `form.status*`; đổi ngôn ngữ trên `/truck/fleet` không lộ khoá |
| F6 | Guard mềm | Xe tải không còn trigger dialog `VEHICLE_MAINTENANCE` (vì `cvh_status` không còn MAINTENANCE); chặn cứng CAR-E1013 vẫn theo ngày |
