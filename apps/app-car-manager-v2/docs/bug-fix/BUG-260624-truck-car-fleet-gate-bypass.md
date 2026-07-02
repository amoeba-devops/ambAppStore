# BUG-260624 — Manager bypass cross-department (CAR ↔ TRUCK) fleet isolation

## Mức độ
**Medium** — RBAC nội bộ. Lộ dữ liệu **giữa 2 phòng ban trong cùng tenant** (vẫn còn `ent_id` → KHÔNG rò rỉ chéo công ty). Chỉ ảnh hưởng role **MANAGER**.

## Hiện tượng
- MANAGER chỉ có quyền TRUCK mở được mọi trang CAR (`/dashboard`, `/trips`, `/drivers`, `/vehicles`, `/costs`) → thấy dữ liệu xe con.
- MANAGER chỉ có quyền CAR mở được `/truck/*` → thấy dữ liệu xe tải.
- Sidebar giấu link đúng (không lẫn menu), nhưng gõ URL / bookmark / nút back là vào được.
- DRIVER **không** dính (middleware `isDriverAllowed` chặn sẵn). ADMIN xem cả 2 — đúng thiết kế.

## Nguyên nhân
1. Các trang CAR (`/dashboard`, `/trips`, `/vehicles`, `/costs`, `/drivers`) **không có fleet gate** nào.
2. `/truck/*` có gate ở `truck/layout.tsx` nhưng dùng **`redirect()` cấp layout** — không hiệu lực do **streaming RSC quirk**: layout tính đúng `hasFleet=false` nhưng response vẫn 200 (đã xác nhận bằng debug log). Quirk này đã được team ghi nhận trong `(app)/layout.tsx` (từng dời onboarding gate sang middleware vì lý do tương tự). Kiểm chứng thêm: `redirect()` cấp **page** (`settings/fleet-access`) cũng bị nuốt — chỉ **middleware redirect** (hard 307) là đáng tin.

## Cách sửa (Option B — middleware)
Enforce fleet gate tại **middleware** (`apps/web/src/middleware.ts`):
- `requiredFleet(pathname)` → phòng ban mà path yêu cầu (`/truck/*`→TRUCK; `/dashboard /trips /vehicles /costs /reports /drivers /drivers/new`→CAR).
- Chỉ áp cho **MANAGER** (ADMIN bypass — cả 2 fleet; DRIVER đã bị `isDriverAllowed` chặn).
- `managerFleets(entId, userId)` — query nhẹ bằng `neon` HTTP (edge-safe, không qua Drizzle), **fail-open** khi lỗi/thiếu config để không khoá nhầm manager.
- Thiếu quyền → 307 về workspace của chính họ (`/dashboard` hoặc `/truck/dashboard`).
- **Giữ nguyên** `/drivers/:id` detail/edit (dùng chung — truck roster link tới đây), chỉ gate roster *list* (`/drivers`, `/drivers/new`).
- `truck/layout.tsx` giữ lại như defense-in-depth (vô hại; middleware mới là lớp enforce).

## Verify (local, dev)
| Role | Path | Trước | Sau |
|------|------|-------|-----|
| Mgr CAR-only | /truck/dashboard, /truck/pnl | 200 ❌ | 307→/dashboard ✅ |
| Mgr TRUCK-only | /dashboard, /trips, /drivers | 200 ❌ | 307→/truck/dashboard ✅ |
| Mgr TRUCK-only | /drivers/:id (shared) | 200 | 200 ✅ (giữ) |
| Mgr (đúng phòng) | trang phòng mình | 200 | 200 ✅ |
| ADMIN | cả 2 phòng | 200 | 200 ✅ |
| DRIVER | /truck/*, trang CAR | →/today | →/today ✅ |

tsc (web) sạch. Không có redirect loop. Session **không** bị mất do car/truck (chỉ JWT hỏng mới xoá cookie — không liên quan).

## File đổi
- `apps/web/src/middleware.ts` — fleet gate + `requiredFleet` + `managerFleets`
- `apps/web/package.json` — khai báo `@neondatabase/serverless` (đã hoisted)

## Ghi chú
- Latency: thêm 1 query nhẹ cho MANAGER trên path bị gate (app nhỏ → không đáng kể). Có thể cache bằng signed cookie TTL ngắn nếu cần sau.
- Residual minor: MANAGER truck cố tình mở `/drivers/:id` của 1 tài xế CAR vẫn xem được (trang dùng chung) — chấp nhận; có thể siết sau bằng cách kiểm tra fleet của tài xế đó.
