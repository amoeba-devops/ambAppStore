# TR-20260821 — Kết quả test: đóng băng phân bổ CP cố định theo báo cáo

> TC: [TC-20260821](TC-20260821-truck-freeze-allocation-until-report.md) · Môi trường: dev server :3001 (Next dev) + Neon dev branch (ep-steep-tooth), migration 0029 đã áp.
> E2E: `apps/web/e2e/truck-fixed-alloc-freeze.spec.ts` — **4/4 PASS (43.6s)**, chạy qua UI thật (dev-login OWNER, wizard lập BC, màn Chi phí & LN).

## 1. Kết quả theo TC

| TC | Nội dung | Kết quả | Bằng chứng |
|----|----------|---------|-----------|
| TC-01 | Lập BC freeze basis vào `trr_fixed_alloc` | ✅ PASS | e2e test 1: poll DB thấy `{salary 9.000.000, dep 600.000, tripCount 2}` |
| TC-02 | Tạo chuyến sau BC **không đổi** số chuyến đã BC | ✅ PASS | e2e test 1: E2E-DN-1/2 giữ 4.500.000 sau khi thêm E2E-DN-3; assert không xuất hiện 3.000.000 trên dòng cũ |
| TC-03 | Chuyến mới hiển thị live như hiện tại, không UI mới | ✅ PASS | e2e test 1: E2E-DN-3 hiện 3.000.000 (÷3 live), chip "Tạm tính" sẵn có |
| TC-04 | Lập lại BC = thời điểm tính lại duy nhất | ✅ PASS | e2e test 2: DB tripCount 3; mọi dòng chuyển 3.000.000 |
| TC-05 | Xoá chuyến sau BC không kéo số cũ về | ✅ PASS | e2e test 3: soft-delete E2E-DN-3 → E2E-DN-1/2 **vẫn 3.000.000**, không quay lại 4.500.000 |
| TC-06 | Sửa 1 chuyến sau BC → chỉ chuyến đó rơi về live | ☑ Covered by design | Cùng một rule coverage (`changedAt` vs `trr_created_at`) dùng chung với nhiên liệu — không automate riêng |
| TC-07 | Regression: tháng chưa có BC → live y hệt hôm nay | ✅ PASS | e2e test 1 (baseline đầu test): trước khi lập BC, dòng hiện 4.500.000 (÷2 live) |
| TC-08 | Grandfather: BC không có `trr_fixed_alloc` → fallback live | ✅ PASS | e2e test 4: NULL hoá cột trên BC → màn hình quay về live ÷2 (4.500.000) |
| TC-09 | BC subset chỉ freeze xe nó phủ | ☑ Code-reviewed | Fold copy đúng semantics `trr_vehicle_fuel` (lọc theo `trr_vehicle_ids`); chưa automate riêng |
| TC-10 | File Excel khớp màn hình tại thời điểm lập | ☑ Không đổi code path | Workbook build tại generate (live) — không sửa; đã verify tay ở vòng RPT-20260725 |
| TC-11 | Chuyến CONFIRMED không vào formula | ☑ Không đổi code path | Mọi filter `COMPLETED` giữ nguyên |
| TC-12 | Build sạch | ✅ PASS | `turbo run typecheck` 5/5 · `turbo run lint` pass (warning còn lại là pre-existing, không thuộc diff) |

## 2. Ngoài phạm vi — phát hiện trong lúc test

- **Spec e2e cũ `truck-report-allocation.spec.ts` (PLAN-20260707) đang hỏng TỪ TRƯỚC** (3/3 fail trên cả code chưa sửa):
  1. URL thiếu `vf=` → kẹt ở Bước 3 "Chọn xe" (REQ-20260817) không tới được review;
  2. thêm `vf` vẫn fail vì assertion review dựa trên số vùng cũ (26.000đ/L…) đã đổi từ REQ-20260726.
  Không liên quan diff này (fail trước cả khi build lại) — đã tách task riêng để sửa spec đó.
- Trong lúc chạy tổng thể, spec mới flake 1 lần do cold-compile server action >30s (dev mode) → đã nâng poll generate lên 90s, chạy lại ổn định 4/4.

## 3. Trạng thái migration

| DB | `trr_fixed_alloc` |
|----|-------------------|
| dev (ep-steep-tooth) | ✅ Đã áp 2026-08-21 |
| staging (ep-noisy-heart) | ✅ Đã áp 2026-08-21 (additive, build cũ không bị ảnh hưởng — Drizzle select cột hữu danh) |
| production | ⬜ Chưa — áp khi release theo flow chuẩn |


---

## Addendum 2026-08-21 (chiều) — Kết quả test follow-up freeze nhiên liệu 0

**Kết quả cuối: 6/6 pass, 1.4 phút** (TC-01/02/03 · TC-04 · TC-05 · TC-08 · TC-13 · TC-14), typecheck 5/5, lint pass.

Run đầu fail 4/6 (13.6 phút do retry + poll 90s) — **lỗi ở spec, không phải code**: click "Lập báo cáo"
bắn ngay sau `domcontentloaded`, khi Next dev còn đang tải chunk `page.js` → React chưa hydrate, click
không có handler → **không POST nào được gửi** (bằng chứng: trace TC-04-retry có 32 request, 0 POST;
server log không có POST cho tháng 2026-12). TC-01 thoát vì đi qua màn finance với assertion 30s trước
khi click. Fix: helper `clickGenerateUntil` — chờ `networkidle`, click, xác nhận row qua DB trong 30s,
chưa thấy thì click lại (tối đa 4 vòng); cũng hấp thụ luôn generation fail lẻ. Bài học cho mọi spec sau:
**không click server-action button ngay sau goto domcontentloaded trong dev mode**.
