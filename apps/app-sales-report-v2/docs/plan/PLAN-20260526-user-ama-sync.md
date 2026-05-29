# PLAN-20260526 — User Management AMA Sync (Phase 1 implementation)

> **Status:** Draft v1
> **Author:** Truc Hoang (with Claude)
> **Date:** 2026-05-26
> **Source REQ:** [REQ-20260526-user-ama-sync.md](../analysis/REQ-20260526-user-ama-sync.md)
> **Estimated effort:** 0.5 — 1 dev-day

---

## 1 · Hệ thống hiện tại

### 1.1 Cấu trúc thư mục liên quan

```
apps/web/src/
├── middleware.ts                       # JWT verify + set x-* headers
├── lib/auth/get-current-user.ts        # RSC-cached, calls ensureUserSynced
├── lib/users-mock.ts                   # 7 hard-coded mock seeds (Phase 1 keep)
├── lib/users-state.ts                  # localStorage overrides for mock
├── server/
│   ├── services/
│   │   ├── user-sync.service.ts        # ensureUserSynced (JIT)
│   │   └── action-log.service.ts       # logAction helper
│   └── actions/
│       └── user.actions.ts             # listUsers/update/deactivate/...
├── components/users/
│   ├── UserAccountsCard.tsx            # main UI (header + table)
│   └── UserFormModal.tsx
├── messages/en.json + ko.json
└── app/(dashboard)/settings/users/page.tsx

packages/db/src/schema/users.schema.ts  # sal_users table
packages/shared/src/auth/jwt-claims.ts  # mapAmaRoleToLocal
```

### 1.2 Constraints

- DB enum `sal_user_local_role` chỉ có 3 giá trị (OPERATOR/MANAGER/ADMIN). Sync KHÔNG thay đổi enum.
- New users sync vào với `usr_status = INACTIVE` để admin review trước khi grant access.
- `sal_action_logs` có FK đến `sal_users` → không hard-delete user, chỉ deactivate.

---

## 2 · Kế hoạch triển khai theo Step

### Phase 1.A — Service layer (45 phút)

#### Step 1: Tạo `ama-client.service.ts`

**File**: `apps/web/src/server/services/ama-client.service.ts` (NEW)

```ts
import 'server-only';
import { getAmaMockMembers } from '@/lib/users-mock';

export type AmaRole = 'OWNER' | 'MASTER' | 'MANAGER' | 'MEMBER';
export type AmaStatus = 'ACTIVE' | 'INACTIVE';

export interface AmaMember {
  amaUserId: string;
  email: string;
  name: string | null;
  amaRole: AmaRole;
  amaStatus: AmaStatus;
}

export interface AmaClient {
  fetchEntityMembers(entId: string): Promise<AmaMember[]>;
}

class MockAmaClient implements AmaClient {
  async fetchEntityMembers(_entId: string): Promise<AmaMember[]> {
    const seeds = getAmaMockMembers();
    return seeds.map((s, i) => ({
      amaUserId: s.amaUserId,
      email: s.email ?? `mock${i}@example.com`,
      name: s.name,
      amaRole: (s.amaRoleSnapshot as AmaRole) ?? 'MEMBER',
      amaStatus: 'ACTIVE',
    }));
  }
}

// Phase 2 stub — sẽ implement sau khi có endpoint AMA
class HttpAmaClient implements AmaClient {
  constructor(private baseUrl: string, private token: string) {}
  async fetchEntityMembers(entId: string): Promise<AmaMember[]> {
    throw new Error('HttpAmaClient not implemented yet — Phase 2');
  }
}

export function createAmaClient(): AmaClient {
  const baseUrl = process.env.AMA_API_BASE_URL;
  const token = process.env.AMA_API_TOKEN;
  if (baseUrl && token) {
    return new HttpAmaClient(baseUrl, token);
  }
  return new MockAmaClient();
}
```

**└─ Side impact:** `users-mock.ts` được consumed thêm bởi server-side (đã là pure data, OK).

#### Step 2: Thêm `syncFromAmaAction` vào `user.actions.ts`

**File**: `apps/web/src/server/actions/user.actions.ts` (MODIFY)

```ts
import { createAmaClient } from '@/server/services/ama-client.service';

export interface SyncSummary {
  inserted: number;
  updated: number;
  deactivated: number;
  total: number;
}

export async function syncFromAmaAction(): Promise<ActionResult<SyncSummary>> {
  return wrap(async () => {
    const user = await getCurrentUser();
    requireRole(user.role, ['ADMIN']);

    const amaClient = createAmaClient();
    const amaMembers = await amaClient.fetchEntityMembers(user.entId);
    const amaIds = new Set(amaMembers.map((m) => m.amaUserId));

    const existing = await db
      .select()
      .from(schema.salUsers)
      .where(
        and(
          withEnt(schema.salUsers.entId, user.entId),
          isNull(schema.salUsers.usrDeletedAt),
        ),
      );
    const existingByAmaId = new Map(existing.map((u) => [u.usrAmaUserId, u]));

    let inserted = 0;
    let updated = 0;
    let deactivated = 0;

    for (const member of amaMembers) {
      const existingUser = existingByAmaId.get(member.amaUserId);
      if (existingUser) {
        // Update heartbeat only — preserve role + status
        await db
          .update(schema.salUsers)
          .set({
            usrEmail: member.email,
            usrName: member.name,
            usrAmaRoleSnapshot: member.amaRole,
            usrUpdatedAt: new Date(),
          })
          .where(eq(schema.salUsers.usrId, existingUser.usrId));
        updated++;
      } else {
        // New user → INACTIVE, role mapped (admin reviews before activating)
        await db.insert(schema.salUsers).values({
          usrId: randomUUID(),
          entId: user.entId,
          usrAmaUserId: member.amaUserId,
          usrEmail: member.email,
          usrName: member.name,
          usrLocalRole: mapAmaRoleToLocal(member.amaRole),
          usrAmaRoleSnapshot: member.amaRole,
          usrStatus: 'INACTIVE',
        }).onConflictDoNothing();
        inserted++;
      }
    }

    // Deactivate users no longer in AMA (skip already INACTIVE + skip self)
    for (const existingUser of existing) {
      if (amaIds.has(existingUser.usrAmaUserId)) continue;
      if (existingUser.usrStatus === 'INACTIVE') continue;
      if (existingUser.usrId === user.userId) continue;     // never self-deactivate
      await db
        .update(schema.salUsers)
        .set({ usrStatus: 'INACTIVE', usrUpdatedAt: new Date() })
        .where(eq(schema.salUsers.usrId, existingUser.usrId));
      deactivated++;
    }

    const summary: SyncSummary = {
      inserted,
      updated,
      deactivated,
      total: amaMembers.length,
    };

    await logAction({
      user,
      category: 'OTHER',
      verb: 'synced from AMA',
      targetType: 'user',
      targetId: 'bulk',
      targetLabel: 'AMA entity members',
      summary: `inserted ${inserted} · updated ${updated} · deactivated ${deactivated}`,
    });

    return summary;
  });
}
```

**└─ Side impact:** Action mới, không động vào existing actions. Race condition với JIT acceptable (idempotent UPSERT).

### Phase 1.B — UI layer (30 phút)

#### Step 3: Thêm "Sync from AMA" button vào `UserAccountsCard.tsx`

**File**: `apps/web/src/components/users/UserAccountsCard.tsx` (MODIFY)

- Import `syncFromAmaAction` + `RotateCw` icon
- Thêm state `syncing: boolean`
- Thêm handler `onSync()`:
  - Confirm dialog (i18n)
  - Set syncing=true
  - Call action
  - On success: toast với summary inserted/updated/deactivated
  - On error: toast error
  - `void refresh()` để reload real rows
  - Set syncing=false
- Render button bên cạnh search input ở header (right-aligned)

```tsx
<button
  type="button"
  onClick={onSync}
  disabled={syncing}
  className="inline-flex items-center gap-1.5 rounded-md border border-info-500 bg-white px-2.5 py-1.5 text-sm font-medium text-info-500 hover:bg-info-50 disabled:opacity-50"
>
  <RotateCw className={cn('h-3.5 w-3.5', syncing && 'animate-spin')} />
  {t('action.syncFromAma')}
</button>
```

**└─ Side impact:** Header layout có thêm 1 button — đã có `flex-wrap` nên responsive sẵn.

#### Step 4: i18n keys

**File**: `apps/web/messages/en.json` + `ko.json` (MODIFY)

Thêm vào namespace `usersPage.accounts.action`:
```jsonc
{
  "syncFromAma": "Sync from AMA"          // ko: "AMA에서 동기화"
}
```

Thêm vào `usersPage.accounts.confirm`:
```jsonc
{
  "syncFromAma": "Bulk sync from AMA — INSERT new (INACTIVE) and deactivate members no longer in AMA. Proceed?"
  // ko: "AMA에서 일괄 동기화합니다 — 신규는 비활성으로 추가되고, AMA에 없는 멤버는 비활성화됩니다. 계속하시겠습니까?"
}
```

Thêm vào `usersPage.accounts.toast`:
```jsonc
{
  "synced": "Sync complete · New: {inserted} · Updated: {updated} · Deactivated: {deactivated}"
  // ko: "동기화 완료 · 신규: {inserted} · 업데이트: {updated} · 비활성화: {deactivated}"
}
```

**└─ Side impact:** None — pure additions.

### Phase 1.C — Test (45 phút)

#### Step 5: Viết test cases

**File**: `docs/test/TC-20260526-user-ama-sync.md` (NEW)

Bao gồm 8 test cases:

| TC | Title | Priority |
|---|---|---|
| TC-1 | Click Sync với entity chưa có user nào → mock seeds (7) được INSERT, status=INACTIVE | P0 |
| TC-2 | Click Sync lần 2 → 7 rows updated, 0 inserted, 0 deactivated | P0 |
| TC-3 | Sau khi admin Edit + Activate 1 user, click Sync → user đó vẫn ACTIVE (preserve) | P0 |
| TC-4 | Mock 1 user bị remove (giảm seed) → Sync → 1 deactivated | P1 |
| TC-5 | Sync KHÔNG deactivate chính admin đang gọi action | P0 |
| TC-6 | Non-admin gọi action → SAL-E0102 Forbidden | P0 |
| TC-7 | Activity Log có 1 entry mới với verb "synced from AMA" và summary đúng | P1 |
| TC-8 | Button disabled khi đang spinning + i18n ko/en đúng | P1 |

#### Step 6: Manual test

Trên dev local:
1. Reset `sal_users` về trạng thái có 1 admin (chính bạn)
2. Click Sync → kiểm tra DB có 7 rows INACTIVE + admin vẫn ACTIVE
3. Edit user thứ 1 thành OPERATOR + Activate
4. Click Sync lại → user đó vẫn OPERATOR + ACTIVE (preserve)
5. Vào Activity Log → kiểm tra có entry

### Phase 1.D — Documentation (15 phút)

#### Step 7: RPT + i18n verification

- Viết `docs/implementation/RPT-20260526-user-ama-sync.md`
- Verify cả 2 locale (en/ko) hiển thị đúng
- Cập nhật regression test case ([docs/test/TC-20260522-staging-full-regression.md](../test/TC-20260522-staging-full-regression.md) §10) — thêm TC-10.7 "Sync from AMA"

---

## 3 · File change summary

| Layer | File | Change | Lines |
|---|---|---|---|
| Service | `apps/web/src/server/services/ama-client.service.ts` | NEW | ~50 |
| Action | `apps/web/src/server/actions/user.actions.ts` | MODIFY (+ syncFromAmaAction) | +75 |
| UI | `apps/web/src/components/users/UserAccountsCard.tsx` | MODIFY (+ Sync button + handler) | +40 |
| i18n | `apps/web/messages/en.json` | MODIFY (+ 3 keys) | +3 |
| i18n | `apps/web/messages/ko.json` | MODIFY (+ 3 keys) | +3 |
| Test | `docs/test/TC-20260526-user-ama-sync.md` | NEW | ~150 |
| Report | `docs/implementation/RPT-20260526-user-ama-sync.md` | NEW | ~80 |
| Regression | `docs/test/TC-20260522-staging-full-regression.md` | MODIFY (+ TC-10.7) | +10 |

**Total**: ~411 lines added across 8 files. 0 DB migration.

---

## 4 · Side impact analysis

| Range | Risk | Description |
|---|---|---|
| `sal_users` table | LOW | Same columns, same constraints. Idempotent upsert. |
| JIT login flow | LOW | Sync chỉ chạy on-demand qua button — không chạm `ensureUserSynced` |
| Activity Log volume | LOW | Mỗi Sync = 1 row. Bulk admin actions <1/day typical |
| Mock seeds path | LOW | `users-mock.ts` giờ được consumed cả client (existing) + server (new). Pure function, no state. |
| Existing inviteUserAction | LOW | Vẫn hoạt động độc lập với placeholder `pending-XXX` ama_user_id |
| Concurrency | MEDIUM | 2 admin bấm Sync cùng lúc → UPSERT race. Có thể gây counter trong summary off-by-N nhưng final state đúng. Acceptable cho Phase 1. |
| AMA endpoint contract | DEFERRED | HttpAmaClient sẽ throw nếu env có nhưng chưa implement. Phase 1 chỉ bật MockAmaClient nên không trigger. |

---

## 5 · DB migration

**Không có**. Tất cả thay đổi sử dụng schema hiện tại.

---

## 6 · Rollout sequence

1. Code review & merge to `main`
2. Deploy staging
3. Run regression TC-10.7 + TC-1..TC-8
4. Verify trên `stg-apps.amoeba.site` rằng:
   - Sync button hiển thị đúng locale
   - Sync 7 mock seeds đẩy vào `sal_users` (INACTIVE)
   - Activity Log entry xuất hiện
5. Khi AMA team sẵn sàng endpoint → Phase 2 (implement `HttpAmaClient`) — sẽ scope sau

---

## 7 · Open questions cần confirm trước khi code

| # | Question | Default |
|---|---|---|
| Q1 | New users sync vào với `INACTIVE` hay `ACTIVE`? | **INACTIVE** — admin review required. Khác JIT (ACTIVE) là chủ ý: bulk sync bring everyone vs JIT chỉ bring user tự đến |
| Q2 | Có deactivate user không còn trong AMA không? | **CÓ** — đây là 1 trong 4 lý do chính của manual sync (audit trail) |
| Q3 | UNASSIGNED là 1 enum value DB? | **KHÔNG** — vẫn dùng mapped role + INACTIVE. UNASSIGNED chỉ ở UI mock seed layer |
| Q4 | Sync có ghi đè `usr_local_role` admin đã override không? | **KHÔNG** — preserve. Chỉ refresh `usr_ama_role_snapshot` |

→ Nếu user agree Q1-Q4, mình code luôn. Nếu khác → update REQ trước.
