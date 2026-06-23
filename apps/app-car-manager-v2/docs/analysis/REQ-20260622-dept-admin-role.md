# REQ-20260622 — Mô hình phân quyền theo phòng ban (Admin toàn quyền / Admin phòng)

| | |
|---|---|
| **Ngày** | 2026-06-22 |
| **Bối cảnh** | Sau fleet-truck-merge: cần phân biệt "admin toàn quyền (tổ chức)" với "admin phòng xe con / xe tải" để hiển thị đúng + tránh confuse |
| **Liên quan** | [BUG-260622 nav sticky-workspace](../bug-fix/BUG-260622-nav-workspace-jumping.md) |
| **Quyết định** | **B1** (chốt với user 2026-06-22) |

---

## 1. Yêu cầu

| # | Yêu cầu | Loại |
|---|---|---|
| 1 | Phân biệt 3 mức: admin toàn quyền · admin phòng xe con · admin phòng xe tải | Phân quyền |
| 2 | Hiển thị đúng vai trò để người dùng "dễ nhớ, tránh confuse" | UX |
| 3 | Không phá car MVP / không bẻ nguyên tắc identity hiện có | Ràng buộc |

## 2. AS-IS

- **Role mapping** (`jwt-claims.ts` + CLAUDE.md §4.6): AMA `OWNER/MASTER/ADMIN/SUPER_ADMIN → ADMIN`, `MANAGER → MANAGER`, `MEMBER/VIEWER → DRIVER`.
- **Ràng buộc cốt lõi phát hiện được**: `ensureCarUser` ([ensure-car-user.service.ts:112](../../apps/web/src/server/services/user/ensure-car-user.service.ts)) **ghi đè `usr_local_role` theo AMA role mỗi lần login**. ⇒ Không thể tạo "ADMIN một phòng" bền vững bằng cách nâng role local cho một manager — lần login kế tiếp sẽ reset về MANAGER.
- **resolveFleetAccess**: `role === 'ADMIN'` → **cả 2 phòng ngầm định**; MANAGER/DRIVER → theo membership (`car_user_fleet_access`).
- **Org tools** (`/users` mutations, `/audit`, `/settings`, `/settings/fleet-access`): đã gate `roles: ADMIN` / `requireRole(['ADMIN'])`. MANAGER không truy cập được (chỉ xem `/users` read-only — hành vi sẵn có).
- **MANAGER** đã: workspace đầy đủ theo phòng được cấp (dashboard/chuyến/đội xe/tài xế/chi phí/P&L/import), **không** có org tools.

## 3. TO-BE — Quyết định B1

> **Mọi local-ADMIN hiện tại đều là AMA admin-tier ⇒ đều là "admin tổ chức".** "Admin phòng" với đúng phạm vi user yêu cầu (chỉ workspace, không org tools) **trùng khớp 100% với quyền của một MANAGER được cấp đúng phòng.** Do đó B1 = **giữ nguyên permission model, chỉ thêm nhãn**.

| Vai trò | Định nghĩa | Phạm vi (đã có sẵn) |
|---|---|---|
| **Admin toàn quyền (tổ chức)** | local role ADMIN (= AMA OWNER/MASTER/ADMIN/SUPER_ADMIN) | Cả 2 phòng ngầm định + org tools (Users/Audit/Cấu hình/Phân quyền) |
| **Admin phòng xe tải** | MANAGER được cấp **chỉ** TRUCK | Workspace xe tải; **không** org tools |
| **Admin phòng xe con** | MANAGER được cấp **chỉ** CAR | Workspace xe con; **không** org tools |
| **Quản lý 2 phòng** | MANAGER được cấp cả 2 (qua request→approve) | Workspace cả 2; **không** org tools |
| **Tài xế** | DRIVER, đúng 1 phòng | Driver surface |

**Cách tạo "admin phòng"**: org-admin vào `/settings/fleet-access` cấp đúng 1 phòng cho một manager → người đó là admin phòng đó.

## 4. Gap (thay đổi cần làm)

| Vùng | Thay đổi | Lý do |
|---|---|---|
| i18n | `layout.dept.deptAdminCar` / `deptAdminTruck` (vi/en/ko) | Nhãn "Quản trị xe con/xe tải" |
| `sidebar-nav.tsx` | MANAGER 1-phòng → title = nhãn admin phòng (label only) | "Show cho đúng" |
| (đã làm ở BUG-260622) | Pill workspace cho user 1-phòng + sticky workspace | Nhận biết phòng đang làm |
| Permission/auth | **KHÔNG đổi** — model đã đúng | Ràng buộc #3 |
| Schema | **KHÔNG đổi** | Ràng buộc #3 |

## 5. Vì sao KHÔNG chọn B2 (admin role thật scoped 1 phòng)

B2 cần cột `usr_role_overridden` + sửa login-sync để không reset elevation + migration, và **bẻ nguyên tắc §4.6 "AMA role là nguồn cuối"**. Vì phạm vi quyền user chọn cho admin phòng = đúng quyền MANAGER, B2 chỉ thêm *cái nhãn role* với chi phí/rủi ro cao hơn hẳn → loại.

## 6. Kiểm chứng

- typecheck + lint sạch; i18n parity vi/en/ko.
- Manual: MANAGER chỉ-TRUCK → sidebar hiện "Quản trị xe tải" + pill "Xe tải" + chỉ thấy workspace truck, không thấy Users/Audit/Cấu hình/Phân quyền. Org-admin → "Quản trị viên" + switch 2 phòng + đủ org tools.

## 7. Follow-up (tùy chọn, chưa làm)

- Đồng bộ nhãn admin phòng vào `/users` list + `/settings/fleet-access` (hiện vẫn hiện role gốc MANAGER — đúng cho mục đích quản trị).
- Nếu sau này khách thực sự cần admin-phòng có **một phần org tools giới hạn trong phòng** (quản lý user/tài xế của phòng, audit lọc theo phòng) → mở REQ B2 mở rộng.
</content>
