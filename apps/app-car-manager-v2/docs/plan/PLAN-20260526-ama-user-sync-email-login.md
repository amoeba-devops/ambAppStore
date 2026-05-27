# PLAN-20260526 — AMA user sync hoàn chỉnh + Email login + Driver flow refactor

> **Linked REQ**: [REQ-20260526-ama-user-sync-email-login.md](../analysis/REQ-20260526-ama-user-sync-email-login.md)
> **Status**: Draft — chờ confirm AMA endpoint contract
> **Owner**: Huy Nguyen
> **Estimated effort**: ~4–5 ngày làm việc (sau khi AMA endpoint sẵn sàng)

---

## 1. 시스템 개발 현황 분석

### 1.1 Stack hiện tại liên quan
- Next.js 15 App Router (apps/web), TypeScript strict
- Drizzle 0.38 + Neon Postgres — schema ở [packages/db/src/schema](../../packages/db/src/schema)
- Auth: cookie-based JWT passthrough từ AMA. Verify bằng `jose`
- AMA contract: env `AMA_API_BASE_URL` (default `http://localhost:3009/api/v1`)
- i18n: `next-intl` 3 ngôn ngữ vi/en/ko trong [apps/web/messages/](../../apps/web/messages/)

### 1.2 Code paths đụng tới
- 3 server actions admin operation: `add-member`, `update-member`, `driver.actions`
- 1 service AMA: `list-entity-members`
- 3 auth routes: `login`, `logout`, `refresh`
- 14 UI files có phone (xem REQ §2.3)

### 1.3 Ràng buộc team
- AMA backend ở repo riêng (không trong workspace này) → phối hợp cross-team
- Staging xanh trước khi prod (mandatory) — không skip
- DB migrations: dùng `drizzle-kit migrate` cho local, **manual SQL** cho staging/prod theo [v2 CLAUDE.md §4.3](../../CLAUDE.md)

---

## 2. 단계별 구현 계획

### Phase 0 — AMA backend prerequisite (chặn Wave 2+)

> **Người làm**: AMA team. v2 chỉ define contract.

**Step 0.1** — Confirm + build AMA endpoints theo REQ §3.1
- `POST /auth/email-login` — passwordless (theo Q1)
- `POST /entity-settings/members/email-add`
- `PATCH /entity-settings/members/:userId` — accept `email`
- `GET /entity-settings/members` — thêm `page`, `limit`, `status=ALL`, `include_cross_entity`

└─ **사이드 임팩트**: AMA portal cũng dùng `members` endpoint này → AMA team confirm không break UI bên đó. Đề nghị backward-compatible (default `status=ACTIVE` & no pagination khi không truyền params).

**Step 0.2** — AMA backfill: đảm bảo mọi `amb_users.usr_email` trong các entity dùng v2 đều populated
└─ **사이드 임팩트**: nếu user nào không có email → AMA team phải bổ sung trước Wave 3 migration.

### Phase 1 — Wave 1: Driver flow refactor (R5) — không phụ thuộc AMA

> Triển khai được ngay, không phụ thuộc Wave 0.

**Step 1.1** — Bỏ inline driver creation
- Xoá file `apps/web/src/app/(app)/drivers/_components/inline-driver-form.tsx`
- Sửa `apps/web/src/app/(app)/drivers/new/page.tsx`:
  - Bỏ `searchParams.mode`, bỏ toggle UI, bỏ `InlineDriverForm` import
  - Luôn render `<DriverForm userCandidates={candidates} />`
  - Nếu `candidates.length === 0` → hiển thị empty state với CTA `→ /users/new`
- Xoá `createDriverWithUserAction` + `createDriverWithUserSchema` trong `driver.actions.ts` (lines 125–261)

└─ **사이드 임팩트**: link nội bộ đến `/drivers/new?mode=inline` (nếu có) bị break. Search codebase → không có. Quick check route handler không lưu state mode.

**Step 1.2** — Driver form: bỏ phone editable trong create mode
- Trong [driver-form.tsx](../../apps/web/src/app/(app)/drivers/_components/driver-form.tsx) line 314–366:
  - Bỏ field phone editable
  - Bỏ logic `phoneChanged`, `confirmPhoneOpen`, dialog confirm phone change ở create mode
  - Edit mode tạm thời giữ — sẽ thay bằng email ở Wave 3
- Update label hint: "Phone sẽ lấy tự động từ AMA"

└─ **사이드 임팩트**: existing drivers edit-mode vẫn hoạt động bằng phone vì Wave 1 chưa migrate. Wave 3 sẽ swap.

**Step 1.3** — i18n cleanup keys mode toggle
- Tìm + xoá keys `screens.newDriver.modeInline*`, `modeExisting*` trong 3 ngôn ngữ

└─ **사이드 임팩트**: không, vì JSX không còn dùng.

**Step 1.4** — Test + deploy staging Wave 1
- Run typecheck + dev server
- Verify `/drivers/new` flow: empty state CTA, user select working, phone auto-fill from AMA
- Deploy staging → smoke test → merge `main`

### Phase 2 — Wave 2: Onboarding sync + member pagination (R1, R6) — sau Wave 0.1

> Pre-req: AMA endpoint đã hỗ trợ `page`/`limit`/`status=ALL`/`include_cross_entity`.
> Architecture shift: thay vì `/users` page fetch AMA mỗi lần, ta build onboarding sync action chạy 1 lần ở lần đầu admin access + thêm Refresh button.

**Step 2.1** — DB migration: thêm cột sync state
- File: `packages/db/migrations/00XX_tenant_settings_sync.sql`
  ```sql
  ALTER TABLE car_tenant_settings
    ADD COLUMN tns_users_synced_at TIMESTAMPTZ;
  ALTER TABLE car_tenant_settings
    ADD COLUMN tns_users_synced_count INTEGER NOT NULL DEFAULT 0;
  ```
- Update Drizzle schema [tenant-settings.schema.ts](../../packages/db/src/schema/tenant-settings.schema.ts) tương ứng

└─ **사이드 임팩트**: row mới sẽ default `tns_users_synced_at = NULL` → trigger onboarding. Existing tenant đã có row → cũng NULL → admin tenant cũ sẽ thấy onboarding screen 1 lần (acceptable — UX: "Đồng bộ user lần đầu từ AMA").

**Step 2.2** — Update `listEntityMembersFromAma` với pagination loop
- File: `apps/web/src/server/services/ama/list-entity-members.ts`
- Function signature giữ nguyên: `(entityId) => Promise<AmaMember[] | null>`
- Internal: loop pagination
  ```ts
  let page = 1;
  const limit = 100;
  const all: AmaMember[] = [];
  while (page <= 50) {  // safety guard 5000 users
    const res = await fetch(
      `${AMA_API}/entity-settings/members?entity_id=${entityId}&page=${page}&limit=${limit}&status=ALL&include_cross_entity=true`,
      { headers: ..., cache: 'no-store' },
    );
    if (!res.ok) return null;
    const body = await res.json();
    all.push(...body.data.map(mapper));
    const total = body.pagination?.total ?? body.data.length;
    if (all.length >= total || body.data.length < limit) break;
    page++;
  }
  return all;
  ```

└─ **사이드 임팩트**: chỉ chạy ở onboarding action + Refresh button, KHÔNG còn ở /users page render → latency /users không bị ảnh hưởng.

**Step 2.3** — Tạo `syncTenantUsersAction`
- File mới: `apps/web/src/server/actions/onboarding/sync-tenant.action.ts`
- RBAC: ADMIN hoặc MANAGER only
- Logic:
  1. `listEntityMembersFromAma(entId)` → fail nếu null
  2. Bulk upsert `car_users`:
     ```ts
     await db.insert(carUsers).values(
       members.map(m => ({
         usrId: m.userId,
         entId: actor.entId,
         usrAmaUserId: m.userId,
         usrName: m.name,
         usrEmail: m.email,
         usrLocalRole: mapAmaRoleToLocal(m.amaRole),
         usrAmaRoleSnapshot: m.amaRole,
       }))
     ).onConflictDoUpdate({
       target: [carUsers.entId, carUsers.usrAmaUserId],
       set: {
         usrName: sql`EXCLUDED.usr_name`,
         usrEmail: sql`EXCLUDED.usr_email`,
         usrAmaRoleSnapshot: sql`EXCLUDED.usr_ama_role_snapshot`,
         usrUpdatedAt: sql`NOW()`,
       },
     });
     ```
  3. Update `car_tenant_settings`: SET `tns_users_synced_at = NOW()`, `tns_users_synced_count = members.length`
  4. Audit log `TENANT.ONBOARDING_SYNC` với `{ count, durationMs }`
  5. Return `{ count, durationMs }`

└─ **사이드 임팩트**:
  - Race condition: 2 admin click cùng lúc → 2 transaction concurrent. ON CONFLICT DO UPDATE handle phía DB (idempotent). Acceptable
  - Members bị xóa trên AMA sau onboarding → vẫn còn ở `car_users`. Cần soft-delete logic ở phase sau (out of scope wave 2)

**Step 2.4** — Onboarding page
- File mới: `apps/web/src/app/(app)/onboarding/page.tsx`
- Server Component
- Layout: full-screen card, không có sidebar (override layout)
- Content:
  - Heading: "Chào mừng đến với Fleet Manager"
  - Sub: entity name + entity code
  - "Đây là lần đầu công ty bạn dùng app. Hãy đồng bộ user từ AMA về."
  - Pre-fetch count via HEAD-like call (optional — có thể bỏ, chỉ hiện "Bắt đầu đồng bộ")
  - Button "Bắt đầu đồng bộ" → trigger `syncTenantUsersAction`
  - Sau success: hiện "Đã đồng bộ N user" + button "→ Bảng điều khiển" (redirect `/`)
- File mới: `apps/web/src/app/(app)/onboarding/_components/onboarding-form.tsx` (Client)
  - useTransition + state hiển thị progress
  - Display result hoặc error

└─ **사이드 임팩트**: cần i18n strings mới (vi/en/ko). 1 màn UI mới — không phụ thuộc layout chung.

**Step 2.5** — Middleware redirect
- File: `apps/web/src/middleware.ts`
- Add check sau khi resolve session:
  ```ts
  // Skip onboarding check for: /onboarding itself, /api, /login, /dev-login, static
  if (pathname.startsWith('/onboarding') || pathname.startsWith('/api')
      || pathname.startsWith('/login')) return;

  if (actor.role === 'ADMIN' || actor.role === 'MANAGER') {
    const synced = await getTenantSyncedAt(actor.entId);
    if (!synced) {
      return NextResponse.redirect(new URL('/onboarding', req.url));
    }
  }
  ```
- Helper `getTenantSyncedAt(entId)`: cached query `car_tenant_settings.tns_users_synced_at`

└─ **사이드 임팩트**:
  - DB call extra mỗi page request → cache 60s với `unstable_cache` tag `tenant:${entId}:synced`
  - DRIVER không bị redirect (giữ flow login bình thường)
  - Sau khi sync xong, action invalidate tag → next request không còn redirect

**Step 2.6** — Refactor `/users` page query sang local
- File: `apps/web/src/app/(app)/users/page.tsx`
- Bỏ `listEntityMembersFromAma` call
- Dùng `listUsers(entId)` từ [users.queries.ts](../../apps/web/src/server/queries/users.queries.ts) — đã có
- Hiển thị: cột thêm "Cập nhật" theo `usr_updated_at`
- Footer "Cập nhật cuối: 2 phút trước" + "[Đồng bộ lại]" button → trigger `syncTenantUsersAction` qua client transition

└─ **사이드 임팩트**:
  - Status tab counter (active/inactive/suspended) — hiện đang dựa trên AMA `status` field, chuyển sang local cần thêm cột `usr_status` vào `car_users`. **Decision**: bỏ status filter tab ở wave 2, chỉ giữ "Tất cả" + admin xem status qua badge. Add lại nếu cần ở wave sau (cần mirror `amb_users.usr_status` vào local)
  - Search by phone hiện work với AMA fetch → chuyển sang local cần SQL `ilike` trên `usr_email` (cột mới ở wave 3) hoặc tạm thời chỉ search name. **Decision**: search name + email (sau wave 3) là đủ

**Step 2.7** — Cross-entity ADMIN_LEVEL handling
- AMA-side khi return `levelCode = ADMIN_LEVEL` member → có nên insert vào `car_users` không?
- **Decision**: KHÔNG insert (vì họ không thuộc entity về mặt logic). Filter out trong `syncTenantUsersAction` trước khi insert. Nếu admin cross-entity login → `ensureCarUser` tạo row lazy
- `car_users.usrAmaRoleSnapshot` lưu raw role; level info không cần lưu (chỉ là metadata)

└─ **사이드 임팩트**: cross-entity admin không xuất hiện ở /users list — admin xem AMA portal nếu cần manage họ. UX acceptable

**Step 2.8** — Test + deploy staging Wave 2
- Migration apply staging
- Test với tenant fresh chưa onboard: redirect /onboarding → click sync → vào /
- Test tenant đã onboard: vào / trực tiếp, không qua /onboarding
- Test Refresh button trên /users — count update
- Test với tenant có 120 user → đủ 120

### Phase 3 — Wave 3: Email login + sync (R2, R3, R4)

> Pre-req: AMA endpoint sẵn sàng (Wave 0.1) + 100% email backfilled (Wave 0.2)

**Step 3.1** — DB migration: `usr_email` NOT NULL UNIQUE per ent
- File mới: `packages/db/migrations/00XX_email_required.sql`
  ```sql
  -- Pre-check: phải 0 row có email NULL
  -- SELECT COUNT(*) FROM car_users WHERE usr_email IS NULL AND usr_deleted_at IS NULL;
  ALTER TABLE car_users ALTER COLUMN usr_email SET NOT NULL;
  CREATE UNIQUE INDEX uniq_car_users_ent_email
    ON car_users (ent_id, usr_email)
    WHERE usr_deleted_at IS NULL;
  ```
- Drizzle schema: `users.schema.ts:15` → bỏ optional, thêm uniqueIndex
- **Staging migration manual** trước khi deploy code

└─ **사이드 임팩트**: nếu có row NULL → migration fail. Pre-check bắt buộc. Bonus: nếu phát hiện duplicate email trong cùng ent (data dirty) → cũng fail → cần resolve trước.

**Step 3.2** — Auth flow: phone → email
- File: `apps/web/src/app/api/auth/login/route.ts`
  - Bỏ `normalizePhoneVn`
  - Đổi `phone` → `email` trong form parse + body POST
  - URL: `POST {AMA}/auth/email-login` body `{ entity_code, email }`
  - Error mask: log email với hash để diagnostic (không log plaintext)
- File: `apps/web/src/app/login/page.tsx`
  - Field name="email", type="email", autoComplete="email"
  - Bỏ pattern phone, dùng browser email validation
  - Update i18n: `phoneLabel`→`emailLabel`, `phoneHint`→`emailHint`, etc.
- File: `apps/web/src/app/api/auth/refresh/route.ts` — kiểm tra có dùng phone không, swap

└─ **사이드 임팩트**:
  - Mobile autofill: `type="email"` hiện email keyboard thay tel pad — UX thay đổi đáng kể với driver. Cần thông báo
  - Sessions phone-login đã issued vẫn valid (refresh token 7d). AMA giữ `phone-login` endpoint thêm 7 ngày

**Step 3.3** — User mgmt server actions: phone-add → email-add
- File: `apps/web/src/server/actions/users/add-member.action.ts`
  - Schema: `phone` → `email` (Zod `.email()`)
  - URL: `phone-add` → `email-add`
  - Return type: `phone` → `email`, smsTemplate → emailTemplate
- File: `apps/web/src/server/actions/users/update-member.action.ts`
  - Schema: accept `email` (optional)
  - PATCH body: `email` thay `phone`
- File: `apps/web/src/server/actions/drivers/driver.actions.ts`
  - Bỏ `resolveUserPhone` (drv_phone không còn auto-sync — sẽ là contact thuần)
  - Tuy nhiên: vẫn pull email từ AMA member khi cần (cho display)

└─ **사이드 임팩트**: `addMemberAction` result shape đổi → `add-member-form.tsx` phải cập nhật. SMS/Zalo template UI swap thành email/Gmail link.

**Step 3.4** — User mgmt UI: `/users/new` + `/users/[id]/edit`
- File: `apps/web/src/app/(app)/users/new/_components/add-member-form.tsx`
  - Replace `phone` state với `email`
  - Bỏ `normalizePreview`, `isValidVnMobile`
  - Replace "SĐT đăng nhập" banner → "Email đăng nhập"
  - Success state: replace SMS template + Zalo button → email template + Gmail mailto link
- File: `apps/web/src/app/(app)/users/[userId]/edit/_components/edit-member-form.tsx`
  - Replace phone field bằng email
  - Confirm dialog: warning thay phone → email
- File: `apps/web/src/app/(app)/users/page.tsx`
  - Cột "SĐT" → "Email" (đã có sẵn email field trong row data) — actually email đã hiển thị dưới name. Tab/search: search by email thay phone

└─ **사이드 임팩트**: search keyboard mobile (numpad → text). Tablet usage acceptable.

**Step 3.5** — Driver pages: phone là contact, không phải login key
- File: `apps/web/src/app/(app)/drivers/_components/driver-form.tsx`
  - **Edit mode**: bỏ warning đỏ "đổi SĐT login" + confirm dialog. Phone field giờ chỉ là contact (UI thường, no danger styling). Có thể giữ field, hoặc xoá luôn (xem option dưới)
  - **Create mode**: đã bỏ ở Wave 1
  - Email field (hiển thị read-only từ user account) — hiển thị section "Tài khoản" có email
- File: `apps/web/src/app/(app)/drivers/[id]/page.tsx`
  - Header thêm email (đã có `driver.user.usrEmail`), giữ phone bên dưới (icon Phone, "Gọi tài xế")
- File: `apps/web/src/app/(app)/drivers/page.tsx`
  - Desktop table: cột "Liên hệ" giữ phone, thêm email sub-text
  - Mobile card: hiện email + phone
- File: `apps/web/src/app/(app)/settings/me/_components/me-license-card.tsx`
  - Phone vẫn hiện, bỏ context "đăng nhập"

└─ **사이드 임팩트**: drivers chuyển sang dùng email đăng nhập — admin phải educate tài xế trước cutover. Cần in-app banner thông báo 7 ngày trước.

**Step 3.6** — Trip-related driver contact (tap-to-call)
- Files: `trips/[id]/_components/{admin,manager,driver}-view.tsx`, `trips/_components/trip-peek-drawer.tsx`
- KHÔNG đổi — phone là contact, tap-to-call vẫn hữu ích. Chỉ verify hiển thị không có warning login

└─ **사이드 임팩트**: không

**Step 3.7** — i18n update (vi/en/ko)
- Thêm keys: `login.emailLabel`, `emailHint`, `emailPlaceholder`, `users.list.thEmail`, ...
- Giữ key phone với context "contact only" cho driver pages
- Verify 3 ngôn ngữ đồng bộ — no missing key

└─ **사이드 임팩트**: cần native VN/KR speaker review để không sound awkward.

**Step 3.8** — Audit log + service worker
- File: `apps/web/src/server/services/audit-log.service.ts` — thêm event `USER.EMAIL_CHANGE` (parallel với phone đã có)
- File: `apps/web/public/sw.js` — bump version (nếu có) để clear login page cache cho PWA

└─ **사이드 임팩트**: log history phone change vẫn giữ — không xoá để compliance.

**Step 3.9** — Deploy staging Wave 3 → test → prod
- Coordinate AMA: giữ phone-login endpoint 7 ngày sau v2 deploy
- Deploy staging sáng thứ Hai → in-app banner 7 ngày → cutover Chủ Nhật tuần sau
- Test plan riêng (xem TC-20260526-*.md sẽ tạo sau)

---

## 3. 변경 파일 목록

### 3.1 Backend (server actions / services)

| File | Phase | Loại |
|---|---|---|
| `apps/web/src/server/services/ama/list-entity-members.ts` | 2 | Sửa (pagination loop) |
| `apps/web/src/server/actions/onboarding/sync-tenant.action.ts` | 2 | **Mới** |
| `apps/web/src/server/queries/tenant-onboarding.queries.ts` | 2 | **Mới** (getTenantSyncedAt) |
| `apps/web/src/server/actions/users/refresh-users.action.ts` | 2 | Sửa (call syncTenantUsersAction thay vì AMA fetch) |
| `apps/web/src/server/actions/users/add-member.action.ts` | 3 | Sửa (phone→email) |
| `apps/web/src/server/actions/users/update-member.action.ts` | 3 | Sửa (phone→email) |
| `apps/web/src/server/actions/drivers/driver.actions.ts` | 1 + 3 | Sửa (xoá createDriverWithUser) + (bỏ resolveUserPhone) |
| `apps/web/src/server/services/audit-log.service.ts` | 2 + 3 | Sửa (thêm event TENANT.ONBOARDING_SYNC + USER.EMAIL_CHANGE) |
| `apps/web/src/server/queries/drivers.queries.ts` | 3 | Sửa (search by email) |
| `apps/web/src/server/queries/users.queries.ts` | 2 | Sửa (thêm fields cần cho /users page render) |

### 3.2 Auth routes

| File | Phase | Loại |
|---|---|---|
| `apps/web/src/app/api/auth/login/route.ts` | 3 | Sửa (phone→email login) |
| `apps/web/src/app/api/auth/refresh/route.ts` | 3 | Sửa (verify no phone dep) |

### 3.3 Frontend pages + components

| File | Phase | Loại |
|---|---|---|
| `apps/web/src/app/(app)/onboarding/page.tsx` | 2 | **Mới** |
| `apps/web/src/app/(app)/onboarding/_components/onboarding-form.tsx` | 2 | **Mới** |
| `apps/web/src/middleware.ts` | 2 | Sửa (redirect logic onboarding) |
| `apps/web/src/app/login/page.tsx` | 3 | Sửa (form field email) |
| `apps/web/src/app/(app)/users/page.tsx` | 2 + 3 | Sửa (đọc local, footer Refresh, cột email) |
| `apps/web/src/app/(app)/users/_components/refresh-button.tsx` | 2 | Sửa (call syncTenantUsersAction) |
| `apps/web/src/app/(app)/users/new/_components/add-member-form.tsx` | 3 | Sửa |
| `apps/web/src/app/(app)/users/[userId]/edit/_components/edit-member-form.tsx` | 3 | Sửa |
| `apps/web/src/app/(app)/drivers/new/page.tsx` | 1 | Sửa (bỏ mode toggle) |
| `apps/web/src/app/(app)/drivers/_components/inline-driver-form.tsx` | 1 | **Xoá** |
| `apps/web/src/app/(app)/drivers/_components/driver-form.tsx` | 1 + 3 | Sửa (bỏ phone create-mode, edit-mode adjust) |
| `apps/web/src/app/(app)/drivers/page.tsx` | 3 | Sửa (cột email) |
| `apps/web/src/app/(app)/drivers/[id]/page.tsx` | 3 | Sửa (email header) |
| `apps/web/src/app/(app)/settings/me/_components/me-license-card.tsx` | 3 | Sửa (bỏ login context) |
| `apps/web/src/app/(app)/users/_components/driver-signin-toggle.tsx` | 3 | Verify |

### 3.4 Schema + DB

| File | Phase | Loại |
|---|---|---|
| `packages/db/src/schema/tenant-settings.schema.ts` | 2 | Sửa (thêm `tnsUsersSyncedAt`, `tnsUsersSyncedCount`) |
| `packages/db/migrations/00XX_tenant_settings_sync.sql` | 2 | **Mới** |
| `packages/db/src/schema/users.schema.ts` | 3 | Sửa (`usr_email` NOT NULL + unique) |
| `packages/db/migrations/00XX_email_required.sql` | 3 | **Mới** |

### 3.5 i18n + PWA

| File | Phase | Loại |
|---|---|---|
| `apps/web/messages/vi.json` | 2 + 3 | Sửa (onboarding strings + email strings) |
| `apps/web/messages/en.json` | 2 + 3 | Sửa |
| `apps/web/messages/ko.json` | 2 + 3 | Sửa |
| `apps/web/public/sw.js` (nếu có) | 3 | Bump version |

### 3.6 AMA-side (ngoài repo, ghi nhận để theo dõi)

| Endpoint | Loại |
|---|---|
| `POST /auth/email-login` | Mới |
| `POST /entity-settings/members/email-add` | Mới |
| `PATCH /entity-settings/members/:userId` (accept `email`) | Sửa |
| `GET /entity-settings/members` (page/limit/status/include_cross_entity params) | Sửa |

---

## 4. 사이드 임팩트 분석

| Phạm vi | Risk | Mức độ | Giảm thiểu |
|---|---|---|---|
| **Onboarding redirect** existing tenant đang dùng v2 → bất ngờ thấy /onboarding | UX surprise | **Trung** | UI message rõ "Đồng bộ lần đầu user từ AMA" + announce trước deploy |
| 2 admin click sync cùng lúc → race | Data inconsistency | **Thấp** | ON CONFLICT DO UPDATE idempotent — last writer wins. Acceptable |
| Member bị xóa AMA sau onboarding → vẫn còn ở car_users | Stale data | **Trung** | Wave 2.x: thêm soft-delete logic detect member missing. Hoặc Wave sau |
| Driver mobile login UX | Đổi tel pad → email keyboard, tài xế quen phone | **Cao** | In-app banner 7 ngày + Zalo broadcast trước cutover |
| Phone-login sessions sống | Token cũ refresh fail nếu AMA remove phone-login sớm | **Cao** | AMA giữ phone-login ≥ 7 ngày sau v2 deploy |
| `car_users.usr_email NOT NULL` migration | Fail nếu data dirty | **Trung** | Pre-check query + AMA backfill trước migration |
| Email duplicate trong tenant | Unique constraint vi phạm | **Trung** | AMA-side enforce unique từ trước; v2 verify pre-migration |
| `listEntityMembersFromAma` loop runaway | Performance / cost | **Thấp** | Max 50 page guard + caching unstable_cache 30s |
| Cross-entity admins (ADMIN_LEVEL) hiện ra trong list | UI confusion | **Thấp** | Filter out trong sync action (decision §2.7) — không lưu vào car_users |
| Audit log compatibility | Old phone change logs còn dùng `USER.PHONE_CHANGE` event | **Thấp** | Giữ event cũ, thêm event mới song song |
| i18n missing keys | Hiển thị key string lạ | **Trung** | Lint check `next-intl` báo missing trước build |
| Test data | Tenant staging có ít user (<10), không reproduce bug pagination | **Cao** | Seed thêm 100 user test trong tenant test trước Wave 2 verify |
| PWA cache login HTML | Driver client cũ vẫn thấy phone field sau deploy | **Trung** | Service worker bump version + skipWaiting |
| Middleware DB call mỗi request | Tăng latency | **Trung** | Cache 60s với unstable_cache tag `tenant:${entId}:synced`. Invalidate sau sync action |

---

## 5. DB 마이그레이션

### 5.1 Schema change Phase 2 — Onboarding sync state

```sql
-- File: packages/db/migrations/00XX_tenant_settings_sync.sql
BEGIN;

ALTER TABLE car_tenant_settings
  ADD COLUMN tns_users_synced_at TIMESTAMPTZ;          -- NULL = never synced
ALTER TABLE car_tenant_settings
  ADD COLUMN tns_users_synced_count INTEGER NOT NULL DEFAULT 0;

COMMIT;
```

Migration **không** ảnh hưởng row tồn tại. Existing tenant đã có `car_tenant_settings` row → `tns_users_synced_at = NULL` → trigger onboarding screen lần kế tiếp admin access. Expected behavior — admin "đồng bộ user lần đầu" cho tenant đã chạy v2 lâu.

### 5.2 Schema change Phase 3

```sql
-- File: packages/db/migrations/00XX_email_required.sql
-- Migration: car_users.usr_email NOT NULL + unique per ent
-- Pre-condition (manual verify trước khi chạy):
--   SELECT COUNT(*) FROM car_users WHERE usr_email IS NULL AND usr_deleted_at IS NULL;
--   → phải = 0
--   SELECT ent_id, usr_email, COUNT(*)
--     FROM car_users WHERE usr_deleted_at IS NULL
--     GROUP BY 1, 2 HAVING COUNT(*) > 1;
--   → phải = 0 row

BEGIN;

ALTER TABLE car_users
  ALTER COLUMN usr_email SET NOT NULL;

CREATE UNIQUE INDEX uniq_car_users_ent_email
  ON car_users (ent_id, usr_email)
  WHERE usr_deleted_at IS NULL;

COMMIT;
```

### 5.2 Backfill plan

Trước khi chạy migration trên staging/prod:

1. **AMA-side** sync `amb_users.usr_email` cho tất cả existing user (Wave 0.2)
2. **v2-side** chạy script backfill ngay sau Wave 2 deploy (khi `list-entity-members` đã fetch full):
   ```sql
   -- File: docs/db/backfill-car-users-email-20260526.sql (manual run)
   UPDATE car_users cu
   SET usr_email = ama.email,
       usr_updated_at = NOW()
   FROM (
     -- Pseudo: lấy từ AMA members snapshot dump
     SELECT user_id AS ama_user_id, email FROM ama_members_snapshot
   ) ama
   WHERE cu.usr_ama_user_id = ama.ama_user_id
     AND cu.usr_email IS NULL;
   ```
3. **Verify** count NULL = 0 trước khi apply migration

### 5.3 Rollback strategy

```sql
-- Nếu cần rollback (chỉ trong window < 1h sau deploy):
DROP INDEX IF EXISTS uniq_car_users_ent_email;
ALTER TABLE car_users ALTER COLUMN usr_email DROP NOT NULL;
```

Không cần rollback data (column vẫn giữ nguyên values).

### 5.4 Migration windows

- **Staging**: bất kỳ lúc nào sau Wave 0.2 hoàn tất
- **Production**: weekend low-traffic (Chủ Nhật 8AM GMT+7); admin notified trước 24h

---

## 6. Timeline tham khảo

| Tuần | Phase | Trạng thái phụ thuộc |
|---|---|---|
| W0 (now) | Wave 1 (driver flow) | Standalone, làm ngay sau khi PLAN approve |
| W1 | Wave 0.1 (AMA build endpoints) | AMA team — coordinate |
| W2 | Wave 2 (member fetch pagination) | Pre-req: 0.1 |
| W3 | Wave 0.2 (AMA email backfill) + v2 prep | AMA team + v2 schema PR review |
| W4 | Wave 3 staging (email login) | Pre-req: 0.2 + 2 |
| W4+7d | Wave 3 prod cutover | Pre-req: W4 staging xanh + in-app banner đủ 7 ngày |

---

## 7. Acceptance criteria (cho TC bước sau)

### Wave 1
- [ ] `/drivers/new` không có toggle mode
- [ ] `InlineDriverForm` không còn import được
- [ ] Empty state CTA link tới `/users/new` khi không có candidate
- [ ] Existing driver edit flow không bị break

### Wave 2
- [ ] Migration `tns_users_synced_at` áp dụng thành công, không loss data
- [ ] Tenant fresh chưa onboard → admin/manager bị redirect `/onboarding` ngay lập tức
- [ ] DRIVER login không bị redirect onboarding
- [ ] Click "Bắt đầu đồng bộ" → bulk sync 120 user test → car_users đủ 120 rows
- [ ] Tenant đã onboard → access `/` không qua /onboarding
- [ ] Refresh button trên `/users` re-sync, cập nhật `tns_users_synced_at`
- [ ] AMA `members` endpoint trả pagination → loop fetch đủ tất cả pages
- [ ] Cross-entity ADMIN_LEVEL members KHÔNG xuất hiện ở `/users`
- [ ] Audit log `TENANT.ONBOARDING_SYNC` được tạo

### Wave 3
- [ ] Login page chỉ có email field (không có phone)
- [ ] `/users/new` tạo user thành công bằng email
- [ ] `/users/[id]/edit` đổi được email với confirm dialog
- [ ] Driver mobile login bằng email work trên iOS Safari + Android Chrome
- [ ] DB migration không gây loss data
- [ ] Phone vẫn hiển thị làm contact (tap-to-call) trên driver pages
- [ ] i18n vi/en/ko không có missing key
