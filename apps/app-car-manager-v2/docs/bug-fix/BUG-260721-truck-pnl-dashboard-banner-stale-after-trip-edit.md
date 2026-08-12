# BUG-260721 — Truck · Banner Chi phí & Lợi nhuận / Dashboard không tính lại realtime sau khi hoàn thành/sửa/xoá chuyến

> Feedback người dùng: *"phần lập báo cáo theo thời gian khi lập thì các số sẽ được tính lại theo logic, nhưng các banner trong phần chi phí lợi nhuận hay dashboard vẫn chưa được tính lại và load realtime."*

## Mức độ
**Medium-High** — cơ chế tính P&L (`computeTruckPnl`) luôn đọc **live** từ DB, không sai logic; vấn đề là **thiếu revalidate cache phía Next.js** sau các thao tác vận hành hàng ngày (hoàn thành/sửa/xoá chuyến), tần suất cao hơn nhiều so với "Lập báo cáo" (chỉ chạy cuối tháng). Chỉ ảnh hưởng surface xe tải (ADMIN/MANAGER + tài xế tự hoàn thành).

## Hiện tượng
Người dùng mở **Chi phí & Lợi nhuận** (`/truck/pnl`) hoặc **Dashboard xe tải** (`/truck/dashboard`), sau đó hoàn thành/sửa/xoá một chuyến (`/truck/trips/[id]` hoặc form "Ghi nhận hoàn thành"). Khi quay lại 2 màn trên bằng menu/Link (soft navigation, không F5), số liệu (doanh thu, chi phí, lợi nhuận) **vẫn giữ giá trị cũ** — phải reload cứng (F5) mới thấy số mới.

Ngược lại, khi đi qua luồng **"Lập báo cáo"** (`generateTruckReportAction` / `generateAllRegionsTruckReportsAction`), số liệu **luôn đúng ngay** — vì luồng này gọi `revalidatePath` đầy đủ cho cả `/truck/pnl` và `/truck/dashboard` (thêm từ BUG-260709 / commit `19f3403`).

## Nguyên nhân (đã đọc code xác minh, không phải giả thuyết)
Next.js chỉ fetch lại RSC payload cho một route khi route đó được `revalidatePath()` từ một Server Action; nếu không, Router Cache phía client giữ bản render cũ khi điều hướng bằng `<Link>`. Đối chiếu các Server Action ghi đúng cột dữ liệu mà `computeTruckPnl` đọc (`trp_revenue`, `trp_fuel_liters/price`, `trp_toll_fee`, extra costs, fixed costs) trong [`truck-trip.actions.ts`](../../apps/web/src/server/actions/trips/truck-trip.actions.ts):

| Action | Khi nào dùng | Revalidate TRƯỚC fix | Thiếu |
|---|---|---|---|
| `patchTruckTripCostsAction` | Bước 2 wizard "Lập báo cáo" | finance, pnl, trips, **dashboard** | — (đúng mẫu, không đổi) |
| `generateTruckReportAction` / batch | Bấm "Lập báo cáo" | reports, finance, pnl, **dashboard**, trips | — (đúng mẫu, không đổi) |
| `completeTruckTripAction` | QL ghi nhận chuyến hoàn thành (số liệu thật) | trips, trips/{id} | ❌ finance, pnl, dashboard |
| `driverCompleteTruckTripAction` | Tài xế tự hoàn thành | today, trips, trips/{id} | ❌ finance, pnl, dashboard |
| `updateTruckTripAction` | Sửa chuyến (DT/nhiên liệu/cầu đường/phát sinh) | trips, trips/{id} | ❌ finance, pnl, dashboard |
| `deleteTruckTripAction` | Xoá chuyến | trips | ❌ finance, pnl, dashboard |
| `createTruckTripAction` (mark_completed) | Ghi 1 bước chuyến đã xong | trips, today | ❌ finance, pnl, dashboard |
| `upsertTruckFixedCostAction` ([truck-fixed-cost.actions.ts](../../apps/web/src/server/actions/settings/truck-fixed-cost.actions.ts)) | Sửa lương/KH/bảo hiểm xe | settings, pnl | ❌ dashboard |

→ Khi P&L/Dashboard được thêm ở P3, chỉ luồng **report** được nối `revalidatePath` cho 2 trang này; các action trip gốc (P1, có trước) không được cập nhật theo.

## Cách sửa
Thêm `revalidatePath('/truck/finance')`, `revalidatePath('/truck/pnl')`, `revalidatePath('/truck/dashboard')` vào 5 action còn thiếu ở `truck-trip.actions.ts` (theo đúng mẫu đã chạy đúng ở `patchTruckTripCostsAction`), và thêm `revalidatePath('/truck/dashboard')` vào `upsertTruckFixedCostAction`. Không đổi logic tính toán, không đổi schema — thuần bổ sung lời gọi cache-invalidation bị thiếu.

## Verify
| Hạng mục | Kết quả |
|---|---|
| `tsc --noEmit` (web) | ✅ exit 0, không lỗi |
| Đối chiếu pattern | ✅ giống hệt `patchTruckTripCostsAction`/`revalidateTruckReportPaths` (đã chạy đúng trong production) |
| `git diff` | ✅ chỉ thêm dòng `revalidatePath(...)` + 1 comment, không đổi logic khác |
| E2E click-through (sửa chuyến → soft-nav dashboard) | ⚠️ **không thực hiện được** — preview renderer bị kẹt ("preview skeleton wedge", xem `reference_preview_skeleton_wedge` memory, tái diễn 2026-07-21: `body.innerText` rỗng, mọi `getBoundingClientRect()` trả về 0 trên MỌI tab/route, kể cả tab mới). Đây là lỗi môi trường Browser pane đã ghi nhận từ 2026-07-01, không phải do code sửa. |
| SSR qua `fetch()` (thay cho click) | ✅ `/truck/dashboard` trả 200, HTML chứa đúng số liệu hiện tại từ DB (61.700.000 / 14.200.000) — xác nhận server + DB đọc live, không lỗi runtime |
| An toàn dữ liệu test | ✅ query trực tiếp DB xác nhận `car_trips.trp_revenue`/`trp_updated_at` của trip test **không đổi** — các thao tác thử submit qua form không lọt xuống DB (do renderer kẹt), không để lại tác động phụ |

**Khuyến nghị:** vì phần click-through bị chặn bởi lỗi môi trường (không phải nghi ngờ về code), nên làm 1 lượt smoke-test thủ công trên trình duyệt thật (không qua Claude preview) trước khi merge: hoàn thành 1 chuyến ở `/truck/trips/[id]` → bấm menu sang `/truck/dashboard` (không F5) → xác nhận doanh thu/lợi nhuận đổi ngay.

### Bổ sung 2026-07-21 — đọc source Next.js để xác nhận cơ chế (thay cho click-through bị chặn)

User yêu cầu check lại: "đảm bảo các filter ở dashboard load được số mới nhất khi lập báo cáo" — tức mọi tổ hợp filter (period/region/vehicle/custom-range), không chỉ view mặc định. Đọc trực tiếp `node_modules/next` (v15.5.18) thay vì click-through (bị chặn bởi lỗi preview ở trên):

- `revalidatePath(path)` chỉ set `store.pathWasRevalidated = true` — **một boolean chung, không phải match theo path cụ thể** (`server/web/spec-extension/revalidate.js`, kèm comment `// TODO: only revalidate if the path matches` — chính Next.js team thừa nhận hiện tại đang coarse).
- Nếu `pathWasRevalidated`, response của Server Action gồm flight/RSC tree mới (`action-handler.js`).
- Client nhận flight đó thì **reset toàn bộ `prefetchCache` về `new Map()`** (`server-action-reducer.js`, comment: *"server actions have to invalidate the entire cache"*), áp dụng qua `handle-mutable.js`.

→ **Hệ quả:** hễ MỘT action gọi `revalidatePath` bất kỳ (kể cả chỉ `/truck/trips`) là toàn bộ cache điều hướng phía client (mọi path, mọi tổ hợp `?period=&region=&vehicle=`) bị xoá sạch — không chỉ path được nêu tên. Kết hợp với việc trang Dashboard/P&L đọc `searchParams` nên luôn dynamic-render phía server (không có Full Route Cache để bắt đầu với) → **mọi filter, sau MỌI action có revalidatePath, đều bắt buộc phải fetch lại thật khi soft-navigate tới**, không có đường nào phục vụ số cũ.
- Test độc lập: xác nhận `GET /truck/dashboard?region=HCM` (fetch SSR + point tới DB thật qua Neon script read-only) phản ánh đúng dữ liệu sống, khớp bảng "Theo khu vực" trên UI.
- Giới hạn còn lại (không có cách nào code-side khắc phục): 1 tab Dashboard đang mở sẵn, không điều hướng đi/về, sẽ **không** tự cập nhật — cơ chế trên chỉ kích hoạt ở lần điều hướng tiếp theo trong CÙNG tab đã chạy action. Muốn tab đang mở tự cập nhật cần polling/websocket (chưa có trong app) — khác hẳn phạm vi bug này.

## File đổi
- `apps/web/src/server/actions/trips/truck-trip.actions.ts` — thêm `revalidatePath('/truck/finance'|'/truck/pnl'|'/truck/dashboard')` vào `createTruckTripAction`, `completeTruckTripAction`, `driverCompleteTruckTripAction`, `updateTruckTripAction`, `deleteTruckTripAction`
- `apps/web/src/server/actions/settings/truck-fixed-cost.actions.ts` — thêm `revalidatePath('/truck/dashboard')` vào `upsertTruckFixedCostAction`

## Ghi chú / Chống tái diễn
- Bất kỳ Server Action nào ghi vào `car_trips` (revenue/fuel/toll/extra), `car_trip_extra_costs`, hoặc `car_truck_fixed_costs` đều phải revalidate **cả 3**: `/truck/finance`, `/truck/pnl`, `/truck/dashboard` — vì cả 3 màn cùng gọi `computeTruckPnl` trên cùng dữ liệu (xem comment trong `revalidateTruckReportPaths()` — nguyên tắc tương tự nên áp cho mọi action ghi cost/revenue, không chỉ luồng report).
- Liên quan [[BUG-260709]] (cùng khu vực code, cùng root theme "recalc đúng nhưng coverage thiếu") — khác biệt: BUG-260709 là thiếu *phạm vi theo vùng*, bug này là thiếu *cache revalidation theo action*.
