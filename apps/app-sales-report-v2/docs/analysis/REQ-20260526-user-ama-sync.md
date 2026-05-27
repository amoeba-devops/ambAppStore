# REQ-20260526 — User Management AMA Sync (Phase 1: app-side)

> **Status:** Draft v1
> **Author:** Truc Hoang (with Claude)
> **Date:** 2026-05-26
> **Scope:** App side only. AMA endpoint integration is **out of scope** for Phase 1 and stubbed via mock data behind a swappable interface.

---

## 1 · Requirement summary

| # | Requirement | Type |
|---|---|---|
| R1 | Admin có button **"Đồng bộ với AMA"** trên trang Settings → User Management để bulk pull entity members | New feature |
| R2 | Sync **không xóa** user, chỉ INSERT / UPDATE / mark INACTIVE | Functional |
| R3 | JIT sync khi user login lần đầu (đã có) → confirm flow vẫn đúng sau khi thêm manual sync | Regression check |
| R4 | Service layer dùng interface `AmaClient` swappable — Phase 1 dùng **mock data**, Phase 2 swap sang HTTP call thật | Architecture |
| R5 | Sync action ghi 1 entry vào Activity Log với summary `inserted N · updated M · deactivated K` | Audit |
| R6 | i18n đầy đủ button + toast (en/ko) | NFR |
| R7 | Admin role only — Operator/Manager không thấy button | Security |

---

## 2 · AS-IS analysis

### 2.1 JIT sync on login (already working)

- **File**: [apps/web/src/middleware.ts](../../apps/web/src/middleware.ts) → verify JWT từ `?ama_token=` hoặc cookie `amb_session`
- **File**: [apps/web/src/lib/auth/get-current-user.ts](../../apps/web/src/lib/auth/get-current-user.ts) → đọc header `x-ent-id / x-user-id / x-user-role / x-user-email / x-user-name` rồi gọi `ensureUserSynced()`
- **File**: [apps/web/src/server/services/user-sync.service.ts](../../apps/web/src/server/services/user-sync.service.ts) → upsert `sal_users`:
  - First time: INSERT với role được map từ AMA role (`mapAmaRoleToLocal`), status=ACTIVE, login_count=1
  - Subsequent: UPDATE `last_login_at`, increment `login_count`, refresh `ama_role_snapshot / email / name`. **Preserve** `usr_local_role` (admin override)

→ **JIT đang hoạt động đúng**. Phase 1 KHÔNG thay đổi logic này.

### 2.2 User Management UI (current)

- **File**: [apps/web/src/components/users/UserAccountsCard.tsx](../../apps/web/src/components/users/UserAccountsCard.tsx)
- Render: merge `realRows` (từ `sal_users`) + `mockSeeds` (từ [apps/web/src/lib/users-mock.ts](../../apps/web/src/lib/users-mock.ts) — 7 user hard-coded)
- Mock members: `role='UNASSIGNED'`, `status='INACTIVE'` → admin phải Edit + Activate
- Mock state lưu localStorage (`apps/web/src/lib/users-state.ts`)
- Buttons hiện có: Edit / Activate / Deactivate inline. Không có "Add User", "Reset PWD" (đã remove)

### 2.3 Action layer

- **File**: [apps/web/src/server/actions/user.actions.ts](../../apps/web/src/server/actions/user.actions.ts)
- Actions hiện có: `listUsersAction`, `updateUserAction`, `deactivateUserAction`, `activateUserAction`, `resetPasswordAction` (audit-only), `inviteUserAction` (pre-stage by email)

### 2.4 DB schema

- **File**: [packages/db/src/schema/users.schema.ts](../../packages/db/src/schema/users.schema.ts)
- Enum `sal_user_local_role` = `['OPERATOR', 'MANAGER', 'ADMIN']` (KHÔNG có UNASSIGNED — UNASSIGNED chỉ tồn tại ở UI display layer cho mock seeds)
- Unique key: `(ent_id, usr_ama_user_id)` → safe để upsert bằng AMA user ID

### 2.5 Vấn đề hiện tại

| # | Problem | Impact |
|---|---|---|
| P1 | User chỉ xuất hiện sau khi tự login lần đầu → Admin không thể pre-assign role | Mất tính chủ động cho onboarding |
| P2 | Khi member bị remove khỏi AMA entity → user vẫn `ACTIVE` trong app cho đến khi admin manual deactivate | Stale access risk |
| P3 | Khi role AMA của user đổi (ví dụ MEMBER → MANAGER) → app chỉ refresh `ama_role_snapshot` khi user login. User chưa login lại không thấy thay đổi | Snapshot stale |
| P4 | `users-mock.ts` là hard-code → không scale | Tech debt |

---

## 3 · TO-BE design

### 3.1 New service: `ama-client.service.ts`

```ts
// apps/web/src/server/services/ama-client.service.ts
export interface AmaMember {
  amaUserId: string;      // AMA-side UUID
  email: string;
  name: string | null;
  amaRole: 'OWNER' | 'MASTER' | 'MANAGER' | 'MEMBER';
  amaStatus: 'ACTIVE' | 'INACTIVE';   // future: AMA-side disabling
}

export interface AmaClient {
  fetchEntityMembers(entId: string): Promise<AmaMember[]>;
}

// Phase 1 implementation: read from existing mock seeds + add some
export function createAmaClient(): AmaClient {
  if (process.env.AMA_API_BASE_URL) {
    return new HttpAmaClient(/* ... */);   // Phase 2 — chưa implement
  }
  return new MockAmaClient();
}
```

Swap point: env var `AMA_API_BASE_URL` chưa set → mock; set → HTTP (Phase 2).

### 3.2 New action: `syncFromAmaAction`

```ts
// apps/web/src/server/actions/user.actions.ts
export async function syncFromAmaAction(): Promise<ActionResult<SyncSummary>>

interface SyncSummary {
  inserted: number;
  updated: number;
  deactivated: number;     // existed in DB but no longer in AMA
  total: number;            // total AMA members returned
}
```

**Algorithm:**

```
1. requireRole(ADMIN)
2. amaMembers = amaClient.fetchEntityMembers(entId)
3. existingUsers = SELECT * FROM sal_users WHERE ent_id = entId AND usr_deleted_at IS NULL
4. amaByUserId = Map(amaMembers.map(m => [m.amaUserId, m]))
5. For each amaMember:
   - if amaMember.amaUserId in existing → UPDATE email/name/ama_role_snapshot ONLY (preserve usr_local_role, usr_status) ⇒ updated++
   - else → INSERT (usr_local_role = mapAmaRoleToLocal(amaRole), usr_status = INACTIVE) ⇒ inserted++
6. For each existing user NOT in amaByUserId AND usr_status === ACTIVE:
   - UPDATE usr_status = INACTIVE  ⇒ deactivated++
7. logAction(category='OTHER', verb='synced from AMA', summary=`inserted ${inserted} · updated ${updated} · deactivated ${deactivated}`)
8. Return SyncSummary
```

**Key decisions:**
- New users created via sync → `usr_status = INACTIVE` (admin reviews before activating). Khác với JIT (login lần đầu → ACTIVE).
- Đã `INACTIVE` rồi (vd admin manual deactivate) → giữ nguyên INACTIVE khi update, không bật lên lại.
- Không hard delete để giữ FK từ `sal_action_logs` còn nguyên (NFR-06/13 không UPDATE/DELETE).

### 3.3 UI changes

[apps/web/src/components/users/UserAccountsCard.tsx](../../apps/web/src/components/users/UserAccountsCard.tsx) — thêm button "Sync from AMA" ở header card, bên cạnh search:

```
[Search] [Role▾] [Status▾]                            [⟳ Sync from AMA]
```

- Click → confirm dialog "Đồng bộ X user từ AMA — sẽ INSERT user mới (INACTIVE) và deactivate user không còn trong AMA?"
- Đang chạy → button spinner + disable
- Xong → toast `"Đồng bộ thành công · Mới: 2 · Cập nhật: 5 · Vô hiệu hóa: 1"` rồi `refresh()`
- Error → toast đỏ

### 3.4 Mock seeds deprecation path

- Phase 1 sẽ **giữ** `users-mock.ts` để demo & dev mode, nhưng `MockAmaClient` returns CÙNG data đó (single source of truth).
- Sau khi `HttpAmaClient` ship (Phase 2), `users-mock.ts` xoá được vì sync thật đã đẩy data vào `sal_users` → UI không cần merge nữa.

---

## 4 · Gap analysis

| Area | Now | Change | Impact |
|---|---|---|---|
| DB | `sal_users` upsert by JIT only | Add bulk upsert path via Server Action | Low — same table, same fields |
| Service | `ensureUserSynced` | + `ama-client.service.ts` (interface + mock impl) | New file, no breakage |
| Action | `user.actions.ts` 6 actions | + `syncFromAmaAction` | New export only |
| UI | Header has search + filters | + 1 button | Cosmetic |
| i18n | `usersPage.accounts.*` | + 6 new keys (button, confirm, toast success/error, summary placeholder) | All 2 locales |
| Activity Log | Has UPLOAD/APPROVAL/INGEST/OTHER categories | New verb `synced from AMA` under category `OTHER` | No schema change |
| Tests | n/a | TC for sync flow | + 5 cases |

### 4.1 File change list

| Type | File | Change |
|---|---|---|
| New | `apps/web/src/server/services/ama-client.service.ts` | NEW — interface + MockAmaClient |
| Modify | `apps/web/src/server/actions/user.actions.ts` | + `syncFromAmaAction` |
| Modify | `apps/web/src/components/users/UserAccountsCard.tsx` | + Sync button + handler + toast |
| Modify | `apps/web/messages/en.json` + `ko.json` | + 6 i18n keys |
| Test | `docs/test/TC-20260526-user-ama-sync.md` | NEW |
| Report | `docs/implementation/RPT-20260526-user-ama-sync.md` | NEW (sau khi xong) |

### 4.2 DB migration

**Không có**. Tất cả thay đổi đều dùng schema hiện tại.

---

## 5 · User flow

```
Admin opens Settings → User Management
         │
         ▼
Sees user list (real + mock merged)
         │
         ▼
Clicks "Sync from AMA" (top-right of card)
         │
         ▼
Confirm dialog: "Bulk sync from AMA — proceed?"
         │
         ▼ Yes
Button spinner ON, disabled
         │
         ▼
syncFromAmaAction() runs:
  - fetch AMA members (Phase 1: mock data)
  - upsert each into sal_users
  - deactivate users no longer in AMA
  - write activity log entry
         │
         ▼
Toast: "Đồng bộ thành công · Mới: 2 · Cập nhật: 5 · Vô hiệu hóa: 1"
         │
         ▼
List refreshes (real rows reloaded)
New rows visible with role pill + INACTIVE badge
Admin sets role + activates each
```

---

## 6 · Technical constraints

- **NFR-06 / NFR-13** (no UPDATE/DELETE on logs) → sync chỉ write 1 row mới
- **Multi-tenancy**: tất cả query phải `withEnt(entId)` (đã enforce qua helper)
- **Idempotency**: sync chạy nhiều lần liên tiếp phải cho cùng kết quả (UPDATE preserve user_local_role + user_status đã set)
- **Concurrency**: nếu 2 admin bấm Sync cùng lúc → race acceptable vì UPSERT ON CONFLICT DO UPDATE. Add idempotency key sau nếu cần.
- **AMA API contract** (sẽ confirm khi tích hợp Phase 2):
  - Endpoint giả định: `GET {AMA_API_BASE_URL}/api/v1/entities/{entId}/members` với header `Authorization: Bearer {AMA_API_TOKEN}`
  - Response shape: `{ success: true, data: { members: AmaMember[] } }`
  - Auth: service-to-service token (env `AMA_API_TOKEN`) — KHÔNG dùng user JWT vì cần list cả member chưa login

---

## 7 · Out of scope (Phase 2+)

- Real HTTP integration với AMA (cần endpoint từ AMA team)
- Schedule auto-sync (vd cron mỗi 6h) — Phase 1 chỉ manual
- Email notification khi có user mới được sync
- Webhook từ AMA → app khi member change (push thay vì pull)
- Sync `lastLoginAt` từ AMA (Phase 1 vẫn dựa vào JIT trên app side)
- Track role change history trong `sal_users` (chỉ giữ snapshot mới nhất)
