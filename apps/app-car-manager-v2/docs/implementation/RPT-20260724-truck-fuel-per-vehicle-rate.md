# RPT-20260724 — Phí nhiên liệu theo định mức + giá của XE (hoàn thành)

REQ/PLN/TC/TR: [REQ](../analysis/REQ-20260724-truck-fuel-per-vehicle-rate.md) · [PLN](../plan/PLN-20260724-truck-fuel-per-vehicle-rate.md) · [TC](../test/TC-20260724-truck-fuel-per-vehicle-rate.md) · [TR](../test/TR-20260724-truck-fuel-per-vehicle-rate.md). Commit `decdd30` trên `staging-car-truck`.

## Đã làm
Phí nhiên liệu mỗi chuyến giờ tính theo **định mức + giá của xe**, live theo km, không cần hoá đơn. Precedence (dùng chung 1 helper `TruckRegionSnapshots.fuelForTrip`):
1. Snapshot bình quân (hoá đơn, sau lập báo cáo) → 🟢 "Bình quân" — **giữ nguyên**
2. Định mức xe: `km × (cvh_fuel_quota/100) × cvh_fuel_price` → 🔵 "Theo định mức" (**mặc định, MỚI**)
3. Xe chưa đặt định mức/giá → 0 → 🟡 "Chưa đặt định mức"

## File chính
- DB: `cvh_fuel_price` (migration `0023`, áp local + ep-noisy-heart).
- Core: `truck-cost.ts` (`truckTripFuelCostByVehicleRate`, `hasVehicleFuelRate`); `truck-fuel-snapshot.ts` (nạp `vehicleRate`, expose `fuelForTrip` + `TruckFuelMode`); `truck-pnl.service.ts` (đếm theo mode).
- Query/action: `truck-finance.queries.ts`, `truck-trips.queries.ts`, `truck-report-export.queries.ts`, `truck-trip.actions.ts` (`fuelMode` cho toast), `vehicle.actions.ts` (+zod `fuel_price`).
- UI: badge `fuel-reconciliation-badge.tsx` (4 mode + `aggregateFuelMode`); `fuel-toast.ts`; form xe + list (+ "Giá xăng"); form chuyến + màn hoàn tất (bỏ Lít/Đơn giá, hiện read-only); i18n vi/en/ko.

## Kiểm thử
typecheck + lint sạch; verify thật trên staging (xem TR): 10km→25.000đ, 100km→250.000đ, cách ly theo xe, KPI rollup, badge/mode đúng.

## Không đổi
Model bình quân theo hoá đơn + báo cáo đã freeze giữ nguyên số. `trp_fuel_liters/trp_fuel_price` giữ cột (không dùng cho phí mặc định).

## Còn lại / gợi ý
- Có thể **seed định mức + giá cho các xe TRUCK còn lại** để hết "Chưa đặt định mức".
- Excel export: giá trị phí theo mode mới (đã dùng chung `fuelForTrip`); layout không đổi.
- Sau khi KH duyệt trên staging → PR `staging-car-truck` → `main` → `production`.
