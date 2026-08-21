# RPT-20260821 — Hoàn thành: đóng băng phân bổ CP cố định theo báo cáo (REQ-20260821)

> REQ: [REQ-20260821](../analysis/REQ-20260821-truck-freeze-allocation-until-report.md) (phương án B — user chốt 2026-08-21: không UI mới, CRUD chuyến giữ nguyên)
> PLN: [PLN-20260821](../plan/PLN-20260821-truck-freeze-allocation-until-report.md) · TC/TR: [TC](../test/TC-20260821-truck-freeze-allocation-until-report.md) / [TR](../test/TR-20260821-truck-freeze-allocation-until-report.md) — e2e 4/4 PASS
> Branch: `feat/car-v2-truck-freeze-fixed-alloc-on-report`

## 1. Hành vi sau thay đổi

- **Lập báo cáo** là thời điểm duy nhất tính (lại) phân bổ lương/khấu hao theo chuyến: dòng BC đóng băng basis per xe `{salary, depreciation, tripCount}` vào cột mới `trr_fixed_alloc` (song song `trr_vehicle_fuel`).
- **Chuyến nằm trong BC** (cùng rule coverage với nhiên liệu: `changedAt ≤ trr_created_at`): màn Chi phí & LN + chi tiết chuyến hiển thị share đóng băng — tạo/sửa/xoá chuyến khác **không lay chuyển**.
- **Chuyến ngoài BC / tháng chưa BC**: giữ nguyên số live như trước (chip "Tạm tính" sẵn có) — không thêm bất kỳ UI/i18n nào.
- **BC lịch sử (cột NULL)**: fallback tính live y hệt trước đây (grandfather) — không migrate dữ liệu; lập lại BC một lần là chuyển hẳn sang chế độ freeze.

## 2. Thay đổi kỹ thuật

| File | Nội dung |
|------|----------|
| `packages/db/migrations/0029_truck_report_fixed_alloc.sql` (mới) | `ALTER TABLE car_truck_reports ADD COLUMN IF NOT EXISTS trr_fixed_alloc JSONB` — additive/idempotent |
| `packages/db/src/schema/truck-report.schema.ts` | Interface `TruckReportFixedAlloc` + cột `trrFixedAlloc` |
| `packages/core/src/truck/truck-fixed-allocation.ts` | Thêm `computeTruckFixedAllocRows(entId, month, {region?, vehicleIds?})` — cùng nguồn `loadTruckFixedMonthly` + cùng mẫu số COMPLETED của live path; `loadTruckFixedAllocation` giữ nguyên (fallback + generator) |
| `packages/core/src/truck/truck-fuel-snapshot.ts` | Select thêm `trrFixedAlloc`; fold overwrite-only theo thứ tự tạo, subset chỉ đè xe nó phủ (copy semantics `trr_vehicle_fuel`); expose `fixedShareForTrip(month, vehicleId, changedAt?)` — chia bằng đúng `Math.round` của live path |
| `apps/web/src/server/actions/truck-report.actions.ts` | `generateOneTruckReport` tính + ghi `trrFixedAlloc` ngay trong câu INSERT dòng BC (1 statement, không thêm điểm dở dang) |
| `apps/web/src/server/queries/truck-finance.queries.ts` | `listTruckFinanceTrips`: `fixedShareForTrip(...) ?? forTrip(...)` (frozen-first) |
| `apps/web/src/server/queries/truck-trips.queries.ts` | `getTruckTripBreakdown`: cùng resolution frozen-first |
| `apps/web/e2e/truck-fixed-alloc-freeze.spec.ts` (mới) | 4 test TC-01→05/07/08; fixture mở rộng trong `e2e/helpers/truck-seed.ts` (fixed cost thủ công + chuyến thứ 3 + probe `trr_fixed_alloc`; `insertTrip` set `trp_updated_at` cho giống chuyến app tạo) |
| UI / i18n | **Không đổi** (quyết định user) |

## 3. Kiểm chứng

- E2E 4/4 PASS trên dev :3001 (chi tiết trong TR): freeze khi lập BC → tạo chuyến không đổi số cũ → lập lại BC chia lại → xoá chuyến không kéo số về → BC NULL fallback live.
- `turbo run typecheck` 5/5 · `turbo run lint` pass.
- Số học: frozen share = `Math.round(salary_tháng ÷ tripCount_lúc_lập)` — trùng tuyệt đối công thức live, nên frozen/live chỉ có thể khác nhau bởi dữ liệu phát sinh sau BC.

## 4. Triển khai & vận hành

1. **Migration**: cột đã áp sẵn trên **dev** và **staging** (2026-08-21, idempotent; build cũ không ảnh hưởng vì Drizzle select cột hữu danh). Production: chạy `0029` trước khi release.
2. Sau deploy staging: **lập lại báo cáo** các tháng đang test để dòng BC có basis đóng băng (BC cũ NULL vẫn hoạt động theo kiểu live cũ — không gãy).
3. Hành vi mới cần lưu ý khi test/UAT (đúng thiết kế, đã nêu trong REQ):
   - Sau BC, thêm/xoá chuyến → các dòng đã BC đứng yên; Σ share hiển thị có thể lệch tổng CP cố định tháng cho tới BC kế tiếp; badge cam "dữ liệu đã thay đổi, cần lập lại" là tín hiệu.
   - Xoá chuyến sau BC không làm các chuyến còn lại quay về mẫu số cũ (TC-05) — muốn chia lại phải lập lại BC.

## 5. Ngoài phạm vi / tồn đọng

- Spec e2e cũ `truck-report-allocation.spec.ts` hỏng **từ trước** (thiếu bước `vf=` của REQ-20260817 + assertion review stale từ REQ-20260726) — đã tách task riêng, không thuộc diff này.
- KPI card tháng (Doanh thu/Lợi nhuận ròng) vẫn cập nhật live theo dữ liệu thô mới — nằm ngoài phạm vi "số chia", đã thống nhất trong REQ.
