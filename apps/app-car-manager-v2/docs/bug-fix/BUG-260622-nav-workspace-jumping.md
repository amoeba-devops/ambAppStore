# BUG-260622 — Menu "nhảy" giữa workspace Xe con / Xe tải

| | |
|---|---|
| **Ngày** | 2026-06-22 |
| **Phạm vi** | Điều hướng (sidebar + bottom-tab + dept switch + theme) — `app-car-manager-v2` |
| **Mức độ** | Cao (UX) — gây mất phương hướng cho admin/manager đa phòng ban |
| **Branch** | `feature/fleet-truck-merge` |
| **Trạng thái** | ✅ Đã sửa |

---

## 1. Hiện tượng

Admin/manager có quyền cả 2 phòng ban (CAR + TRUCK): khi đang ở **workspace Xe tải** (`/truck/*`) mà bấm vào một mục **dùng chung** (Tài xế, Người dùng, Phân quyền, Cấu hình, Nhật ký), toàn bộ sidebar + dept-switch + theme **đột ngột lật về Xe con**. Người dùng cảm thấy menu "nhảy lộn xộn" và bị "đá" khỏi workspace truck một cách khó hiểu. Reload trang cũng mất ngữ cảnh truck.

## 2. Nguyên nhân (root cause)

Phòng ban đang xem được suy ra **100% từ URL**, không hề được lưu lại:

```ts
// nav-items.ts (cũ)
deptForContext(role, fleetAccess, pathname)
  → role==='DRIVER' ? (membership) : deptForPath(pathname)
deptForPath(pathname) = pathname.startsWith('/truck') ? 'TRUCK' : 'CAR'
```

Trong khi đó nhiều mục nav **dùng chung cho cả 2 phòng** (không gắn `fleet`) lại nằm ở URL không phải `/truck`: `/drivers`, `/users`, `/settings`, `/audit`, `/settings/fleet-access`.

➡️ Mọi điều hướng tới một trang dùng chung khiến `pathname` rời `/truck` → `deptForPath` trả về `CAR` → `sidebar-nav` + `bottom-tab-nav` + `dept-switch` (cả 3 đều gọi `deptForContext`) đồng loạt render lại theo phòng CAR. Không có lớp **persistence** nào để "ghi nhớ" workspace người dùng đang làm việc.

## 3. Phương án sửa — "Sticky workspace"

Tách **active workspace** ra khỏi URL thuần và lưu lại, với quy tắc:

| Loại trang | Hành vi |
|---|---|
| URL rõ TRUCK (`/truck/*`) | set + lưu workspace = TRUCK |
| URL rõ CAR (`/dashboard`,`/trips`,`/vehicles`,`/costs`,`/expenses`) | set + lưu workspace = CAR |
| URL **trung tính** (drivers/users/settings/audit/fleet-access/me) | **giữ nguyên** workspace hiện tại (không đổi) |
| DRIVER | khoá theo đúng 1 membership (không bao giờ đổi) |

### Cơ chế
- **`DeptProvider`** (client context, `dept-context.tsx`): giữ state `activeDept`, phản ứng theo `usePathname()`. Lưu lựa chọn vào cookie `ccms.fleet.dept` (client-readable, chỉ là preference UI — quyền truy cập vẫn luôn được server re-check bằng `requireFleet`/`resolveFleetAccess`).
- **`clearlyDept(pathname)`** (nav-items): trả `'CAR' | 'TRUCK' | null` — `null` = trang trung tính → giữ nguyên.
- **`AppShell`** (server) đọc cookie → `initialDept` (clamp theo `fleetAccess`; driver khoá theo membership) để SSR khớp client, không "nháy" sai workspace.
- **`useActiveDept()`**: `sidebar-nav`, `bottom-tab-nav`, `dept-switch` đọc workspace từ context thay vì tự suy từ URL.
- **Theme** (`DeptThemeEffect`) đặt trong `DeptProvider` theo `activeDept` → giữ màu cam của truck cả khi ở trang trung tính (trước đây chỉ set khi URL `/truck/*`).
- **Pill chỉ báo workspace**: user 1 phòng (manager/admin theo phòng, hoặc tài xế) thấy badge tĩnh "Xe con/Xe tải" trong sidebar để luôn biết mình đang ở đâu.

Lý do bắt buộc dùng client context: layout `(app)` **không** re-render server-side khi điều hướng client (`<Link>`), nên giá trị tính ở server sẽ cũ — phải tính ở client theo `usePathname()`.

## 4. File thay đổi

| Loại | File | Thay đổi |
|---|---|---|
| Mới | `components/layout/dept-context.tsx` | `DeptProvider` + `useActiveDept()` (sticky + persist cookie + theme) |
| Sửa | `components/layout/nav-items.ts` | thêm `clearlyDept()`; gỡ `deptForContext()` (dead) |
| Sửa | `components/layout/app-shell.tsx` | đọc cookie → `initialDept`, truyền xuống |
| Sửa | `components/layout/app-shell-client.tsx` | bọc `DeptProvider`; gỡ theme chỉ-theo-URL |
| Sửa | `components/layout/sidebar-nav.tsx` | dùng `useActiveDept()` |
| Sửa | `components/layout/bottom-tab-nav.tsx` | dùng `useActiveDept()`; gỡ prop `fleetAccess` thừa |
| Sửa | `components/layout/dept-switch.tsx` | active state theo `useActiveDept()`; thêm pill 1-phòng |
| Sửa | `app/(app)/truck/layout.tsx` | gỡ `DeptThemeEffect` (đã chuyển vào provider) |

## 5. Kiểm chứng

- `tsc --noEmit` (web) = **0 lỗi**.
- `next lint` = **0 warning/error**.
- Smoke runtime (dev server, session OWNER): `/truck/{dashboard,trips,fleet,settings}`, `/drivers`, `/users`, `/settings/fleet-access`, `/settings`, `/dashboard` + (MEMBER) `/today`, `/trips` → tất cả **200** (không crash SSR do `cookies()`/provider).
- Manual (cần browser): ở Xe tải → bấm Tài xế/Cấu hình → sidebar + switch + theme **đứng yên** ở Xe tải; chỉ đổi khi bấm switch hoặc vào trang rõ-phòng của phòng kia; reload giữ đúng workspace (cookie).

## 6. Ghi chú liên quan

- Bất biến "tài xế = đúng 1 phòng" được provider tôn trọng (khoá theo membership). Dữ liệu seed Demo MEMBER hiện có cả CAR+TRUCK (do seed test) vẫn resolve ổn định về TRUCK; nên siết ở `grant` action khi làm Hướng B.
- Là tiền đề cho **Hướng B — admin theo phòng ban** (REQ riêng): khi ADMIN chạy theo membership, pill 1-phòng + sticky workspace áp dụng nguyên vẹn.
</content>
</invoke>
