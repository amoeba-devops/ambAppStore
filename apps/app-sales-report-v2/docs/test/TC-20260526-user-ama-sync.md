# TC-20260526 — User Management AMA Sync Test Cases

> **Status:** Draft v1
> **Author:** Truc Hoang (with Claude)
> **Date:** 2026-05-26
> **Source REQ:** [REQ-20260526-user-ama-sync.md](../analysis/REQ-20260526-user-ama-sync.md)
> **Source PLAN:** [PLAN-20260526-user-ama-sync.md](../plan/PLAN-20260526-user-ama-sync.md)
> **Estimated effort:** 30 phút manual test

---

## How to use

- Run cases in order — TC-2/3 dependent on TC-1.
- **P0 = blocker**, **P1 = must**, **P2 = should**.
- Tick `[ ]` → `[x]` khi pass.
- Phase 1 chỉ test `MockAmaClient` (env `AMA_API_BASE_URL` chưa set).

---

## Pre-test setup

### TC-0.1 — Reset state · P0
**Pre:**
- Local dev: Neon branch hoặc DB instance riêng cho test
- Login bằng `/dev-login` → role = ADMIN

**Steps:**
1. Vào psql / Neon SQL editor
2. `DELETE FROM sal_users WHERE ent_id = '<your-test-ent-id>' AND usr_ama_user_id != '<your-admin-ama-user-id>';`
   (giữ lại admin đang login)

**Expected:** `sal_users` chỉ còn 1 row admin. UI Settings → User Management hiển thị 1 user real + 7 mock seeds (status INACTIVE/UNASSIGNED).

---

## 1 · Happy path

### TC-1 — First sync inserts all AMA members as INACTIVE · P0
**Pre:** TC-0.1 done. `sal_users` chỉ có admin.

**Steps:**
1. Mở Settings → User Management
2. Click button **"Sync from AMA"** (top-right card)
3. Confirm dialog → "Yes, sync"

**Expected:**
- Spinner xoay trên button
- Toast green: "Đồng bộ thành công · Mới: 7 · Cập nhật: 1 · Vô hiệu hóa: 0"
  (admin đã có → updated count = 1, không phải 0)
- List refresh: 7 new rows xuất hiện với:
  - Tên đúng từ mock seed (Truc Hoang, Linh Nguyen, ...)
  - Email `@socialbean.vn`
  - Role pill = mapped role (OWNER/MASTER → ADMIN, MANAGER → MANAGER, MEMBER → OPERATOR)
  - Status pill = **INACTIVE** (gray)
  - AMA role snapshot hiển thị bên dưới role pill
- DB: `SELECT count(*) FROM sal_users WHERE ent_id = '<test-ent>'` = 8

### TC-2 — Idempotent: second sync only updates · P0
**Pre:** TC-1 passed.

**Steps:**
1. Click **"Sync from AMA"** lần thứ 2
2. Confirm

**Expected:**
- Toast: "Đồng bộ thành công · Mới: 0 · Cập nhật: 8 · Vô hiệu hóa: 0"
  (admin + 7 mock = 8 updated)
- DB count vẫn = 8, không có duplicate
- Tất cả `usr_updated_at` đều mới hơn TC-1

### TC-3 — Sync preserves role + status overrides · P0
**Pre:** TC-1 passed.

**Steps:**
1. Click Edit trên 1 user (e.g. Linh Nguyen — mapped role MANAGER)
2. Đổi role thành **OPERATOR**, save
3. Click Activate trên Linh Nguyen → status thành ACTIVE
4. Click **"Sync from AMA"**
5. Quan sát row Linh Nguyen

**Expected:**
- Role vẫn là OPERATOR (KHÔNG bị reset về MANAGER)
- Status vẫn là ACTIVE (KHÔNG bị set lại INACTIVE)
- `usr_ama_role_snapshot` vẫn là MANAGER (refreshed)
- Toast summary có updated ≥ 8, inserted = 0, deactivated = 0

### TC-4 — Activity Log entry · P1
**Pre:** TC-1 passed.

**Steps:**
1. Vào Activity Log page
2. Lọc category = OTHER

**Expected:** Có entry mới:
- Verb: `synced from AMA`
- Target: `AMA entity members` (target_id = `bulk`)
- Summary: `inserted 7 · updated 1 · deactivated 0` (khớp với toast TC-1)
- User: admin đang login
- Timestamp: vừa xảy ra

---

## 2 · Negative paths

### TC-5 — Deactivate users removed from AMA · P1
**Pre:** TC-1 passed.

**Steps:**
1. Mở file `apps/web/src/lib/users-mock.ts`
2. Comment out 1 SEED (e.g. "Khanh Vo")
3. Save → hot reload
4. Click **"Sync from AMA"**

**Expected:**
- Toast: "Đồng bộ thành công · Mới: 0 · Cập nhật: 7 · Vô hiệu hóa: 1"
- Row "Khanh Vo" trong list giờ có status pill = INACTIVE (nếu trước đó ACTIVE)
- DB: `SELECT usr_status FROM sal_users WHERE usr_name = 'Khanh Vo'` = `INACTIVE`

**Cleanup:** Uncomment SEED, sync lại để restore.

### TC-6 — Sync does NOT deactivate current admin · P0
**Pre:** Login bằng admin. Admin KHÔNG có trong mock SEEDS.

**Steps:**
1. Verify admin ama_user_id KHÔNG match bất kỳ `amaUserId` nào trong `users-mock.ts`
2. Click **"Sync from AMA"**

**Expected:**
- Admin vẫn ACTIVE sau sync
- Toast `deactivated` count KHÔNG bao gồm admin
- Nếu admin là user duy nhất ngoài AMA list → deactivated = 0 (skipped vì self-protect)
- DB: admin's `usr_status` = ACTIVE, `usr_updated_at` KHÔNG đổi (skip self-update của INACTIVE branch)

### TC-7 — Non-admin cannot sync · P0
**Pre:** Đổi role admin thành OPERATOR (qua DB hoặc dev-login khác)

**Steps:**
1. Reload Settings page
2. Quan sát button "Sync from AMA"

**Expected:**
- **Settings page** trả về 403 / redirect vì `requireRole(['ADMIN'])` ở page level
- Nếu bằng cách nào đó vào được (vd. fetch trực tiếp action) → trả về `{ success: false, error: { code: 'SAL-E0102' } }`

**Cleanup:** Restore role về ADMIN.

### TC-8 — Concurrent sync race (acceptable behavior) · P2
**Pre:** TC-1 passed.

**Steps:**
1. Mở 2 tab cùng admin
2. Click Sync trên tab 1 → ngay lập tức click Sync trên tab 2 (trước khi tab 1 done)

**Expected:**
- Cả 2 không crash
- Final DB state đúng (8 users, không duplicate)
- Counter trên 1 trong 2 toast có thể bị off-by-N (race) — acceptable cho Phase 1
- Activity Log có 2 entries

---

## 3 · UI / i18n

### TC-9 — Button states · P1
**Steps:**
1. Click Sync → quan sát button trong khi đang chạy

**Expected:**
- Icon rotate spin animation
- Button disabled (opacity giảm, cursor not-allowed)
- Sau khi xong → button trở lại trạng thái normal

### TC-10 — i18n English · P1
**Pre:** Locale = en
**Steps:** Mở Sync button + toast.

**Expected:**
- Button label: "Sync from AMA"
- Confirm dialog text: English đầy đủ, không có raw key
- Toast: "Sync complete · New: X · Updated: Y · Deactivated: Z"

### TC-11 — i18n Korean · P1
**Pre:** Locale = ko
**Steps:** Mở Sync button + toast.

**Expected:**
- Button label: "AMA에서 동기화"
- Confirm dialog: Korean đầy đủ
- Toast: "동기화 완료 · 신규: X · 업데이트: Y · 비활성화: Z"

---

## 4 · Phase 2 readiness (smoke)

### TC-12 — HttpAmaClient stub fires when env set · P2
**Pre:** Set `AMA_API_BASE_URL=https://example.com` + `AMA_API_TOKEN=dummy` trong `.env.local`. Restart dev server.

**Steps:**
1. Click Sync

**Expected:**
- Toast error đỏ với message chứa "Phase 2" hoặc "not implemented"
- `MockAmaClient` KHÔNG được chạm
- DB không thay đổi

**Cleanup:** Remove 2 env vars, restart.

---

## 5 · Sign-off

| Section | P0 cases | P0 passed | P1 cases | P1 passed | Tester | Date |
|---------|---------|-----------|---------|-----------|--------|------|
| Pre-test | 1 | / | 0 | / | | |
| Happy path | 3 | / | 1 | / | | |
| Negative | 2 | / | 1 | / | | |
| UI/i18n | 0 | / | 3 | / | | |
| Phase 2 ready | 0 | / | 0 | / | | |
| **TOTAL** | **6** | / | **5** | / | | |

> Pass criteria: 100% P0 + ≥80% P1 + zero data corruption (DB count chính xác sau mỗi case).
