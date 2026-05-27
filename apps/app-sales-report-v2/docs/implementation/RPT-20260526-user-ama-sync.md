# RPT-20260526 — User Management AMA Sync (Phase 1)

> **Status:** Implementation complete — pending manual test
> **Author:** Truc Hoang (with Claude)
> **Date:** 2026-05-26
> **Source REQ:** [REQ-20260526-user-ama-sync.md](../analysis/REQ-20260526-user-ama-sync.md)
> **Source PLAN:** [PLAN-20260526-user-ama-sync.md](../plan/PLAN-20260526-user-ama-sync.md)
> **Source TC:** [TC-20260526-user-ama-sync.md](../test/TC-20260526-user-ama-sync.md)

---

## 1 · Summary

Phase 1 của User Management AMA Sync hoàn tất. Admin có button **"Sync from AMA"** trên Settings → User Management để bulk pull entity members. Phase 1 dùng `MockAmaClient` (đọc từ `MOCK_AMA_MEMBERS` constant); Phase 2 sẽ swap sang `HttpAmaClient` khi có endpoint AMA.

JIT sync on login (đã có sẵn) không bị động đến.

---

## 2 · Files changed

| File | Change | Notes |
|---|---|---|
| `apps/web/src/server/services/ama-client.service.ts` | NEW (54 lines) | Interface `AmaClient` + `MockAmaClient` + `HttpAmaClient` stub + `createAmaClient()` factory |
| `apps/web/src/server/actions/user.actions.ts` | MODIFY (+99 lines) | New export `syncFromAmaAction`, `SyncSummary` type |
| `apps/web/src/components/users/UserAccountsCard.tsx` | MODIFY (+25 lines) | `syncing` state, `onSync()` handler, RotateCw button in header |
| `apps/web/src/lib/users-mock.ts` | REFACTOR | Extracted `MOCK_AMA_MEMBERS` constant; both client (`getAmaMockMembers`) and server (`MockAmaClient`) consume the same source |
| `apps/web/messages/en.json` | MODIFY | +3 keys: `action.syncFromAma`, `confirm.syncFromAma`, `toast.synced` |
| `apps/web/messages/ko.json` | MODIFY | +3 keys (Korean) |
| `docs/analysis/REQ-20260526-user-ama-sync.md` | NEW | Requirements doc |
| `docs/plan/PLAN-20260526-user-ama-sync.md` | NEW | Implementation plan |
| `docs/test/TC-20260526-user-ama-sync.md` | NEW | 12 test cases (6 P0 + 5 P1 + 1 P2) |
| `docs/implementation/RPT-20260526-user-ama-sync.md` | NEW | This doc |
| `docs/test/TC-20260522-staging-full-regression.md` | MODIFY | +1 TC-10.7 |

**No DB migration.** Schema `sal_users` unchanged.

---

## 3 · Key implementation decisions

### 3.1 Single source of truth for mock seeds
Trước đó `users-mock.ts` định nghĩa `SEEDS` inline. Tách ra thành export `MOCK_AMA_MEMBERS` để cả client (UserAccountsCard merge display) và server (`MockAmaClient.fetchEntityMembers`) cùng đọc. Tránh data drift.

### 3.2 New users → INACTIVE (khác JIT)
- JIT (existing): user login lần đầu → INSERT với role mapped + **status=ACTIVE** (vì user đã chứng tỏ identity qua AMA JWT)
- Manual sync (new): bulk import → INSERT với role mapped + **status=INACTIVE** (vì admin chưa biết những user này, cần review trước khi grant access)

Điểm này quan trọng: nếu user vừa được Sync (INACTIVE) rồi tự login thì JIT sẽ KHÔNG tự bật ACTIVE — `ensureUserSynced` chỉ UPDATE login fields, preserve status. Admin phải Activate thủ công.

### 3.3 Idempotency
Sync 2 lần liên tiếp cho cùng kết quả vì:
- Existing user → UPDATE chỉ heartbeat fields (email/name/ama_role_snapshot), không động vào `usr_local_role` / `usr_status`
- New user → INSERT với `onConflictDoNothing` (defensive — unique key trên `(ent_id, ama_user_id)`)
- Removed from AMA → UPDATE status to INACTIVE, nhưng skip nếu đã INACTIVE rồi → no-op

### 3.4 Self-protection
Admin đang gọi action không bao giờ tự deactivate, kể cả nếu vô tình admin ama_user_id không có trong AMA list (vd. AMA endpoint trả về sai). Check: `if (found.usrId === user.userId) continue`.

### 3.5 Factory pattern cho client swap
`createAmaClient()` đọc `process.env.AMA_API_BASE_URL` + `AMA_API_TOKEN`. Có cả 2 → `HttpAmaClient` (Phase 2 stub, throw error). Không có → `MockAmaClient`. Khi sẵn sàng Phase 2 chỉ cần implement `HttpAmaClient.fetchEntityMembers()`.

---

## 4 · Acceptance verification

| AC | Source | Verified by |
|---|---|---|
| Admin có button Sync trên Settings → User Management | REQ R1 | UI inspection — TC-10/11 |
| Sync không hard-delete user | REQ R2 | Code review — chỉ có UPDATE status=INACTIVE, không có DELETE |
| JIT sync on login vẫn hoạt động sau khi thêm manual sync | REQ R3 | Code review — `ensureUserSynced` không thay đổi |
| Service layer swappable | REQ R4 | Code review — `createAmaClient` factory + `AmaClient` interface |
| Sync ghi 1 entry Activity Log | REQ R5 | Code in `syncFromAmaAction` — `logAction({category:'OTHER', verb:'synced from AMA', summary:...})` |
| i18n đầy đủ EN/KO | REQ R6 | TC-10 + TC-11 |
| Admin role only | REQ R7 | `requireRole(['ADMIN'])` ở đầu action |

---

## 5 · Known limitations / Phase 2 backlog

| # | Limitation | Plan |
|---|---|---|
| L1 | `HttpAmaClient` throw error nếu env set — chưa có integration với AMA thật | Phase 2 — cần AMA team confirm endpoint contract |
| L2 | Không có auto-sync schedule (vd cron 6h) | Phase 2 — phụ thuộc L1 |
| L3 | Race condition khi 2 admin Sync cùng lúc → counter có thể off-by-N, final state đúng | Acceptable cho Phase 1. Nếu cần thì thêm advisory lock Phase 2 |
| L4 | Mock seeds hard-coded trong `users-mock.ts` | Xóa hoàn toàn sau khi Phase 2 ship + verify real sync work |
| L5 | Sync không gửi email notification cho user mới | Phase 2 — nếu khách yêu cầu |

---

## 6 · Testing status

- [x] Typecheck pass (`npx tsc --noEmit`) — across web/db/shared
- [x] Smoke test: 10 main routes return HTTP 200
- [x] Button render verified in both EN ("Sync from AMA") and KO ("AMA에서 동기화")
- [x] First-pass dev test exposed 2 bugs — both fixed (see §8)
- [ ] Manual test theo [TC-20260526](../test/TC-20260526-user-ama-sync.md) — pending re-test after fixes
- [ ] Staging regression TC-10.7 — pending deploy

## 7 · Bugs discovered during dev testing

### Bug 1 — Self-deactivation (introduced by this task) · P0

**Symptom:** Admin who clicked Sync got logged out with "Your account has been deactivated".

**Root cause:** Self-protection check `if (found.usrId === user.userId) continue;` compared the **local `sal_users.usr_id`** (randomUUID) against **`user.userId`** which is actually the AMA `sub` claim (different namespace). Comparison always false → admin's own row got deactivated when not present in AMA mock list.

**Fix:** `apps/web/src/server/actions/user.actions.ts` — compare against `usrAmaUserId`:
```ts
if (found.usrAmaUserId === user.userId) continue;
```

### Bug 2 — Pre-existing self-deactivation in `deactivateUserAction` · P1

**Discovered while fixing Bug 1.** Same root cause in the existing single-user deactivation path — input's `parsed.usrId` (local PK) vs `user.userId` (AMA sub). Self-protect never triggered → admin could deactivate themselves via the Deactivate button.

**Fix:** Same file. Load the target row first, compare its `usrAmaUserId` against caller's `user.userId`.

### Bug 3 — `isSelf` UI check broken (pre-existing) · P2

**Symptom:** Admin row would show Edit / Deactivate buttons for themselves instead of "Current user" text.

**Root cause:** `apps/web/src/components/users/UserAccountsCard.tsx` — `row.usrId === currentUserId` had the same namespace mismatch.

**Fix:** Compare `row.amaUserId === currentUserId`.

### Bug 4 — `char(36)` padding broke mock ID Map lookups · P1

**Discovered while validating Bug 1 fix.** `sal_users.usr_ama_user_id` is `char(36)`. Mock IDs were 8 chars (`'ama-1000'`) → Postgres right-pads with 28 spaces. When `syncFromAmaAction` built `existingByAmaId = new Map(existing.map(u => [u.usrAmaUserId, u]))`, keys were 36 chars; subsequent `.get(member.amaUserId)` lookup used 8-char keys → MISS → user re-INSERT-counted instead of UPDATE.

**Fix:** `apps/web/src/lib/users-mock.ts` — switched mock IDs to UUID shape (exactly 36 chars), e.g. `'00000000-0000-0000-0000-00000000a000'`. Real AMA UUIDs are also 36 chars so production won't hit this.

### Recovery
- One-off script `scripts/reactivate-demo-user.mjs` used to UPDATE demo user back to ACTIVE + DELETE 7 stale mock rows with padded IDs. Script removed after use.

---

## 8 · Deployment notes

- **No DB migration needed**
- **No env vars required** trên staging — `MockAmaClient` được dùng mặc định khi `AMA_API_BASE_URL` chưa set
- Sau deploy, admin chạy thử Sync 1 lần để verify mock seeds đẩy vào `sal_users`
- Nếu cần test `HttpAmaClient` error path: set `AMA_API_BASE_URL=...` + `AMA_API_TOKEN=...` rồi bấm Sync → toast error "Phase 2"
