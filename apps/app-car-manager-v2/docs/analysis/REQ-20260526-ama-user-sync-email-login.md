# REQ-20260526 — AMA user sync hoàn chỉnh + Email login + Driver flow refactor

> **Source**: feedback staging 2026-05-26
> **Owner**: Huy Nguyen
> **Status**: Draft — chờ confirm AMA-side endpoint contract
> **Linked PLAN**: [PLAN-20260526-ama-user-sync-email-login.md](../plan/PLAN-20260526-ama-user-sync-email-login.md)

---

## 1. Yêu cầu tóm tắt

| # | Yêu cầu | Loại |
|---|---|---|
| R1 | **Onboarding sync** — lần đầu admin/manager của entity (đã approve app) access v2 → màn onboarding bulk fetch all members từ AMA về `car_users` | Feature mới |
| R2 | Đổi login key từ **phone → email** (sync từ AMA) | Refactor + breaking |
| R3 | UI/page nào còn show "SĐT đăng nhập" phải đổi sang email; phone giữ làm contact (không phải auth key) | Refactor |
| R4 | Tạo user (`/users/new`) phải sync với AMA bằng email (replace `phone-add` → `email-add`) — 2-way: tạo bên này → tạo bên kia | Refactor + integration |
| R5 | Trang tạo tài xế (`/drivers/new`) bỏ chế độ "tạo user inline", chỉ cho chọn user có sẵn trong entity (đã được tạo qua `/users/new` hoặc AMA portal) | UX simplification |
| R6 | `/users` page đọc từ `car_users` local DB (sau onboarding) thay vì fetch AMA mỗi lần. Admin có nút "Đồng bộ lại từ AMA" để re-sync | Refactor / Perf |

**Nguyên tắc xuyên suốt**: AMA là source of truth duy nhất cho identity (email, name, role, phone). v2 cache (`car_users`) là **shadow copy** được sync chủ động tại các thời điểm: (a) onboarding lần đầu, (b) admin click Refresh, (c) user login (ensureCarUser cho self).

---

## 2. AS-IS 현황 분석

### 2.1 AMA member fetching (R1, R6)

**File**: [list-entity-members.ts](../../apps/web/src/server/services/ama/list-entity-members.ts)

```ts
const res = await fetch(`${AMA_API}/entity-settings/members?entity_id=${entityId}`, {
  headers: { Authorization: `Bearer ${amaAccess}` },
  cache: 'no-store',
});
```

- **Không** truyền `page` / `limit` / `status` / `include_cross_entity`
- Mỗi lần admin mở `/users` page → live fetch (cost + chậm + thiếu user khi paginate)
- Onboarding bootstrap chưa tồn tại — không có thời điểm "đồng bộ chính thức"
- Hiện chỉ có `ensureCarUser()` chạy ở mỗi lần user **tự** login → `car_users` chỉ chứa subset user đã từng login v2

### 2.2 Phone-based authentication (R2)

| File | Vai trò |
|---|---|
| [login/page.tsx](../../apps/web/src/app/login/page.tsx) | Form 2 field: `ent_code` + `phone` |
| [api/auth/login/route.ts](../../apps/web/src/app/api/auth/login/route.ts) | POST `AMA /auth/phone-login` → mint app token |
| [api/auth/refresh/route.ts](../../apps/web/src/app/api/auth/refresh/route.ts) | Rotate token bằng `amb_ama_refresh` |

Logic core: `normalizePhoneVn(raw)` → POST `phone-login` với `{ entity_code, phone }`.

### 2.3 Pages/components còn dùng phone như login key (R3)

| # | File | Phạm vi đụng |
|---|---|---|
| 1 | [users/page.tsx](../../apps/web/src/app/(app)/users/page.tsx) | Cột `thPhone`, search by phone digit prefix, hint "📱" |
| 2 | [users/new/_components/add-member-form.tsx](../../apps/web/src/app/(app)/users/new/_components/add-member-form.tsx) | Banner đỏ "SĐT đăng nhập (rất quan trọng)", VN-mobile validate, normalize preview |
| 3 | [users/[userId]/edit/_components/edit-member-form.tsx](../../apps/web/src/app/(app)/users/[userId]/edit/_components/edit-member-form.tsx) | Banner đỏ + confirm dialog khi đổi SĐT |
| 4 | [drivers/_components/driver-form.tsx](../../apps/web/src/app/(app)/drivers/_components/driver-form.tsx) | Field phone editable kèm warning login, confirm dialog |
| 5 | [drivers/_components/inline-driver-form.tsx](../../apps/web/src/app/(app)/drivers/_components/inline-driver-form.tsx) | (Bị xoá ở R5) |
| 6 | [drivers/page.tsx](../../apps/web/src/app/(app)/drivers/page.tsx) | Cột phone trong list (mobile + desktop) |
| 7 | [drivers/[id]/page.tsx](../../apps/web/src/app/(app)/drivers/[id]/page.tsx) | Hiển thị `drvPhone` |
| 8 | [trips/[id]/_components/{admin,manager,driver}-view.tsx](../../apps/web/src/app/(app)/trips/[id]/_components/) | `driverPhone` tap-to-call |
| 9 | [trips/_components/trip-peek-drawer.tsx](../../apps/web/src/app/(app)/trips/_components/trip-peek-drawer.tsx) | Tap-to-call driver |
| 10 | [settings/me/_components/me-license-card.tsx](../../apps/web/src/app/(app)/settings/me/_components/me-license-card.tsx) | Driver tự xem phone |
| 11 | [server/actions/users/add-member.action.ts](../../apps/web/src/server/actions/users/add-member.action.ts) | POST AMA `phone-add` |
| 12 | [server/actions/users/update-member.action.ts](../../apps/web/src/server/actions/users/update-member.action.ts) | PATCH AMA member với phone |
| 13 | [server/actions/drivers/driver.actions.ts](../../apps/web/src/server/actions/drivers/driver.actions.ts) | `resolveUserPhone`, `createDriverWithUserAction` |
| 14 | i18n `messages/{vi,en,ko}.json` | Strings: `login.phoneLabel`, `phoneHint`, `screens.users.thPhone`, "SĐT đăng nhập" |

### 2.4 Driver creation flow (R4 + R5)

**File**: [drivers/new/page.tsx](../../apps/web/src/app/(app)/drivers/new/page.tsx)

- 2 modes:
  - `mode=inline` (default): tạo cả user AMA + driver license cùng 1 form → `createDriverWithUserAction`
  - `mode=existing`: chọn user có sẵn → `createDriverAction`

Mode `inline` đang tồn tại trong khi:
- `/users/new` cũng đã tạo được user AMA (qua `addMemberAction`)
- Duplicate UX → admin bối rối "tạo ở đâu?"
- 2 entry point cùng gọi `AMA phone-add` nhưng schema khác nhau (department field optional, role hard-code `MEMBER`)

### 2.5 DB schema hiện tại

```sql
-- car_users
usr_email      varchar(255)         NULL     -- mirror từ AMA, hiện đang NULL khi tạo qua phone-add
usr_ama_user_id char(36)            NOT NULL -- = amb_users.usr_id ở AMA

-- car_drivers
drv_phone      varchar(20)          NULL     -- mirror từ AMA usr_phone, dùng cho tap-to-call
```

[users.schema.ts:15](../../packages/db/src/schema/users.schema.ts#L15), [drivers.schema.ts:48](../../packages/db/src/schema/drivers.schema.ts#L48)

---

## 3. TO-BE 요구사항

### 3.0 Authentication strategy — Option B (decided 2026-05-26)

**Context**: 2 entry mode → cookie có khác nhau:
- **Standalone** (user nhập phone-login form): v2 set cả `amb_ama_access` (user accessToken) + `amb_session` (app-token) + `amb_ama_refresh`
- **Embed** (AMA portal redirect `?ama_token=`): v2 chỉ set `amb_session` (app-token); không có user accessToken

**Decision**: Option B — AMA endpoint `/entity-settings/members` accept cả 2 loại JWT (cùng JWT_SECRET).

v2 fallback chain:
```ts
amaAccess = cookie('amb_ama_access') ?? cookie('amb_session')
```

- Standalone admin/manager → ưu tiên accessToken (broader scope)
- Embed admin/manager → fallback app-token
- Driver KHÔNG bao giờ trigger /members (syncTenantUsersAction enforce role)

**Driver standalone compat** (constraint từ user 2026-05-26): KHÔNG bị ảnh hưởng. Driver app-token có `role=MEMBER` → AMA reject 403 nếu lỡ gọi /members. `syncTenantUsersAction` pre-check `requireRole(['ADMIN','MANAGER'])` → driver không vào được code path này.

Xem [AMA-DEPENDENCIES.md §1-§4](../integration/AMA-DEPENDENCIES.md) cho chi tiết.

### 3.1 AMA endpoint contract (BLOCKING — phải confirm với AMA team)

| Endpoint | Method | Mới / Sửa | Yêu cầu |
|---|---|---|---|
| `/entity-settings/members` | GET | **Sửa** | (a) Accept app-token (Option B — xem §3.0) — verify cùng JWT_SECRET, check `appCode` + `role`. (b) Thêm query params: `?page=1&limit=100&status=ALL&include_cross_entity=true`. (c) Response shape thêm `pagination: { total, page, limit }`. Dùng trong onboarding bootstrap + Refresh button. |
| `/auth/email-login` | POST | **Mới** | Body: `{ entity_code, email }`. Trả `{ tokens: { accessToken, refreshToken } }` — không cần password (passwordless email link OR đơn giản match email + ent_code) |
| `/entity-settings/members/email-add` | POST | **Mới** | Body: `{ name, email, role, department? }`. Tạo `amb_users` với `usr_email` unique trong ent. Trả `{ userId, email, name, role, entCode, entName, emailTemplate }`. Accept app-token. |
| `/entity-settings/members/:userId` | PATCH | **Sửa** | Cho phép field `email` (thay vì / ngoài `phone`). Accept app-token. |
| `/entity-settings/members?entity_id=...` | GET | **Sửa** | Mỗi member response thêm field `email` (đang có rồi) — đảm bảo luôn populated, không null |

### 3.2 v2 — Authentication flow

**Login form**: 2 field — `ent_code` (giữ nguyên) + `email`. Bỏ phone field.

**Submit flow**:
```
POST /api/auth/login (v2)
  → POST {AMA}/auth/email-login { entity_code, email }
  → GET  {AMA}/entity-settings/custom-apps/my (như cũ)
  → POST {AMA}/entity-settings/custom-apps/:eca_id/token (như cũ)
  → Set cookie amb_session, amb_ama_access, amb_ama_refresh
  → Redirect /today | /
```

Phone field **không** xuất hiện ở login page.

### 3.3 v2 — User management

- `/users/new` form: dùng **email** field (validate RFC 5322) thay phone. Confirm dialog warning "đổi email = đổi login key".
- `/users/[id]/edit`: cho phép sửa email + status + role + dept; phone là optional contact.
- `/users` list: cột "Email" thay "SĐT". Phone hiển thị nhỏ hơn như contact secondary, optional.
- Search: theo name / email / role. Phone vẫn match được nhưng không phải trọng tâm.

### 3.4 v2 — Driver management

**`/drivers/new`** — chỉ 1 mode duy nhất:
- Step 1: Select user từ `listDriverCandidates(entId)` — user trong entity chưa link driver
- Step 2: Nhập license info (number, class, expiry, optional emergency contact + notes)
- KHÔNG có field tạo user inline. Nếu admin chưa thấy user trong list → CTA "Tạo user mới" → `/users/new` (separate flow)

**Phone trên driver pages**: chỉ hiển thị như contact info ("Gọi tài xế"), KHÔNG còn warning login. Email là identity hiển thị chính.

### 3.5 DB schema thay đổi

```sql
-- car_users
ALTER TABLE car_users
  ALTER COLUMN usr_email SET NOT NULL;        -- email = login key, không thể NULL
ALTER TABLE car_users
  ADD CONSTRAINT uniq_car_users_ent_email
  UNIQUE (ent_id, usr_email);                  -- email unique trong tenant

-- car_tenant_settings — thêm 2 cột track sync state
ALTER TABLE car_tenant_settings
  ADD COLUMN tns_users_synced_at TIMESTAMPTZ;        -- null = chưa onboard
ALTER TABLE car_tenant_settings
  ADD COLUMN tns_users_synced_count INTEGER NOT NULL DEFAULT 0;

-- car_drivers: drv_phone giữ nguyên (optional contact)
```

Migration: cần backfill `usr_email` trước khi SET NOT NULL → call AMA list members → update car_users theo `usr_ama_user_id` → nếu vẫn NULL thì block migration & alert.

### 3.6 Onboarding sync flow (R1, R6)

**Trigger conditions:**

```
Middleware đọc session → resolve actor → query car_tenant_settings(ent_id)
  IF tns_users_synced_at IS NULL AND actor.role ∈ {ADMIN, MANAGER}
     AND current path NOT IN [/onboarding, /api/*, /login]
  THEN redirect → /onboarding
```

DRIVER không trigger onboarding (vẫn login bình thường, `ensureCarUser` tự tạo row cho mỗi driver). Nếu DRIVER login trước onboarding → vẫn vào được app, nhưng `/users` sẽ trống cho đến khi admin onboard. Acceptable vì DRIVER không xem `/users`.

**Onboarding screen `/onboarding`:**
- Server Component fetch số members hiện có ở AMA (chỉ HEAD/count, không pull full list trước khi user click)
- Hiển thị: company name + "X người dùng ở AMA. Bắt đầu đồng bộ?"
- Nút "Bắt đầu đồng bộ" → server action `syncTenantUsersAction`
- Action stream progress (RSC streaming hoặc polling): "Đang đồng bộ trang 1/3..."
- Done → set `tns_users_synced_at = NOW()`, count → "Đã đồng bộ X users" + nút "Đi tới Bảng điều khiển"

**Sync action `syncTenantUsersAction`:**
1. Verify caller role ∈ ADMIN/MANAGER
2. Loop `listEntityMembersFromAma` với pagination (page=1, limit=100, status=ALL, include_cross_entity=true)
3. Map AMA member → `CarUser` (role mapping per CLAUDE.md §4.6)
4. Bulk upsert `car_users` (`ON CONFLICT (ent_id, usr_ama_user_id) DO UPDATE`)
5. Set `tns_users_synced_at = NOW()`, `tns_users_synced_count = N`
6. Audit log `TENANT.ONBOARDING_SYNC` với { count, duration_ms }
7. Return { count, errors }

**Refresh button trên `/users`:**
- Re-call `syncTenantUsersAction` (idempotent)
- Cập nhật `tns_users_synced_at`
- Hiển thị toast "Đã đồng bộ X users"

**`/users` page query thay đổi:**
- Bỏ `listEntityMembersFromAma` trên page render
- Dùng `listUsers(entId)` query local `car_users` (đã có)
- Footer hiển thị "Cập nhật lần cuối: 2 phút trước" với link Refresh

**Late-added AMA user behavior:**
- User được tạo trên AMA SAU onboarding → chưa có `car_users` row
- Khi họ login lần đầu → `ensureCarUser` tự tạo row (existing logic) → admin thấy ở `/users` sau đó
- Nếu admin muốn thấy ngay → click Refresh button

---

## 4. 갭 분석

### 4.1 Tóm tắt thay đổi

| Vùng | Hiện tại | Thay đổi | Mức độ ảnh hưởng |
|---|---|---|---|
| AMA API contract | `phone-login`, `phone-add` | Thêm `email-login`, `email-add`; sửa members list | **Cao** (cross-team) |
| v2 login UI | Phone-based | Email-based | **Cao** (UX breaking) |
| v2 user mgmt | Phone là login key | Email là login key, phone optional contact | **Cao** |
| v2 driver mgmt | 2 mode (inline + existing) | 1 mode (existing only) | **Trung** (route bị bỏ) |
| v2 DB schema | `usr_email` nullable | `usr_email NOT NULL UNIQUE per ent` | **Trung** (migration + backfill) |
| i18n | Phone strings | Email strings + giữ phone contact strings | **Thấp** |
| Existing sessions | Phone-based JWT | Sau migration: invalidate hết hay không? | **Trung** (cần policy) |

### 4.2 Migration concerns

- **Phone-login sessions còn sống**: app token v2 expires 1h, refresh 7d. Sau khi v2 deploy email-login, user đang trong 7-day window vẫn dùng được token cũ — nhưng nếu phone-login endpoint AMA bị remove → refresh fail. ⇒ giữ phone-login endpoint AMA ít nhất 7 ngày kể từ ngày deploy.
- **Drivers không có email trong AMA**: phải backfill. Block migration `usr_email NOT NULL` cho đến khi 100% có email.

### 4.3 File-level change scope

Xem chi tiết trong [PLAN](../plan/PLAN-20260526-ama-user-sync-email-login.md) §3.

---

## 5. 사용자 플로우

### 5.1 Email login (admin/manager/driver)

```
User mở /login (v2)
   │
   ▼
Nhập ent_code + email + submit
   │
   ▼
v2 POST /api/auth/login
   │   ├─ POST AMA /auth/email-login → access+refresh token
   │   ├─ GET  AMA /custom-apps/my → eca_id
   │   └─ POST AMA /custom-apps/:eca_id/token → app token
   ▼
Set cookies (amb_session 30d, amb_ama_access 4h, amb_ama_refresh 7d)
   │
   ▼
Redirect theo role:
   ├─ DRIVER  → /today
   └─ ADMIN/MANAGER → /
```

### 5.2 Tạo user mới (admin/manager)

```
Admin /users/new → form (name, email*, role, department?)
   │
   ▼
v2 → POST AMA /entity-settings/members/email-add
   │   ├─ AMA tạo amb_users (usr_email unique check trong ent)
   │   ├─ AMA mint email template (passwordless onboarding link)
   │   └─ Trả { userId, email, name, role, emailTemplate }
   ▼
v2 hiển thị card success kèm template email + nút "Mở Gmail / Copy"
v2 KHÔNG tạo car_users — ensureCarUser sẽ tạo ở lần login đầu của user
```

### 5.3 Tạo tài xế (admin/manager)

```
Admin /drivers/new
   │
   ▼
v2 query listDriverCandidates(entId) — users trong ent chưa link car_drivers
   │
   ▼
   ┌─ Có candidates: hiện select + form license
   │      ▼
   │   Submit → createDriverAction({ user_id, license_*, ... })
   │      ├─ Verify user thuộc ent + chưa có driver
   │      ├─ resolveUserPhone(entId, user_id) ← sync drv_phone từ AMA
   │      └─ INSERT car_drivers
   │
   └─ Không candidates: hiện CTA "→ Tạo user mới rồi quay lại" (link /users/new)
```

Không còn `mode=inline` / `InlineDriverForm` / `createDriverWithUserAction`.

### 5.4 Onboarding lần đầu (admin/manager)

```
Admin click "Mở app" trên AMA portal → embed iframe → v2 /
   │
   ▼
v2 middleware đọc session + check car_tenant_settings.tns_users_synced_at
   │
   ├─ NULL (chưa onboard) + role ∈ ADMIN/MANAGER  →  redirect /onboarding
   └─ NOT NULL  →  vào / như bình thường
   │
   ▼ (/onboarding)
Server render màn welcome
   ├─ Lấy entity name + entity code từ session
   └─ Hiển thị "Chào X công ty. Đồng bộ Y user từ AMA?"
   │
   ▼
User click "Bắt đầu đồng bộ"
   │
   ▼
syncTenantUsersAction() (Server Action)
   ├─ Loop GET AMA /members?page=1..N&limit=100&status=ALL&include_cross_entity=true
   ├─ Bulk upsert car_users (ent_id, usr_ama_user_id)
   ├─ Set tns_users_synced_at = NOW(), tns_users_synced_count = total
   ├─ Audit log TENANT.ONBOARDING_SYNC
   └─ Return { count, durationMs }
   │
   ▼
UI show "Đã đồng bộ X user" → nút "Tới Bảng điều khiển"
   │
   ▼
Redirect /
```

### 5.5 Refresh subsequent (admin /users)

```
Admin /users → render từ car_users local DB (đã onboard rồi)
   │
   ▼
Click "Đồng bộ lại" button
   │
   ▼
syncTenantUsersAction() — same as onboarding
   │
   ▼
Toast "Đã cập nhật. Tổng X user"
```

---

## 6. 기술 제약사항

| Mục | Ràng buộc |
|---|---|
| **AMA backend** | Block toàn bộ Wave 2/3 cho đến khi AMA expose `email-login`, `email-add`, sửa `members?status=&page=&limit=&include_cross_entity` |
| **Multi-tenancy** | `usr_email` unique theo `(ent_id, usr_email)` — không phải global. Cùng email có thể dùng ở 2 entity khác nhau (case nhân viên multi-company hiếm nhưng cần cho ngay từ đầu) |
| **Email validation** | RFC 5322 cơ bản (Zod `.email()`). KHÔNG tự gửi email verification — AMA owns identity verification |
| **Session compat** | Phone-login users (token < 7d) vẫn dùng được app sau email deploy. AMA giữ phone-login endpoint live tối thiểu **7 ngày** sau khi v2 deploy email-login |
| **Driver backfill** | Trước khi `usr_email SET NOT NULL`, phải confirm 100% existing `car_users` có email từ AMA. Nếu user có row mà AMA không có email → cần fix AMA-side trước migration |
| **i18n** | 3 ngôn ngữ vi/en/ko phải cập nhật đồng thời. Không deploy partial |
| **Audit log** | Email change (giống phone change cũ) → log `USER.UPDATE` action với before/after email |
| **PWA cache** | Driver PWA service worker có thể cache /login HTML — sau deploy phải bump SW version để force re-fetch |

---

## 7. Out of scope

- Không tự build email-sending từ v2 (AMA owns email transport)
- Không refactor `car_drivers.drv_phone` column — vẫn optional contact
- Không touch `car_audit_logs` schema — chỉ thêm event types
- Không thay role mapping AMA→v2 (vẫn OWNER/MASTER→ADMIN, MANAGER→MANAGER, MEMBER→DRIVER)

---

## 8. Open questions

| # | Câu hỏi | Cần ai trả lời |
|---|---|---|
| Q1 | AMA `email-login` có yêu cầu password hay passwordless (magic link / OTP)? | AMA team |
| Q2 | AMA `members` endpoint hiện đã có pagination ngầm hay chưa? Default limit là bao nhiêu? | AMA team — quan trọng cho việc verify R1 |
| Q3 | Email AMA có sync từ Google Workspace / nguồn ngoài không? | Stakeholder |
| Q4 | Sau Wave 3, có giữ phone field trong AMA `amb_users.usr_phone` không, hay chỉ giữ trong v2 `car_drivers.drv_phone` làm contact? | Sản phẩm |
| Q5 | Onboarding sync — admin có cần re-sync định kỳ tự động (cron) hay chỉ manual qua Refresh button? | Sản phẩm |
| Q6 | Khi 2 admin/manager cùng entity cùng access lần đầu cùng lúc → cả 2 đều thấy /onboarding. Nếu 1 người click sync, người kia thấy gì? Race condition? | Sản phẩm + tech |
