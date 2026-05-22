# Auth & RBAC cho app-car-manager-v2 — Yêu cầu Phân tích (Reuse-first)

```yaml
document_id: V2-REQ-20260521-AUTH-RBAC
version: 4.0.0
status: Draft
created: 2026-05-21
updated: 2026-05-21
author: Claude (dev@amoeba.group)
strategy: "Reuse-first (D-008) + Driver phone-login (D-010 rev)"
scope: ambManagement (AMA) + ambAppStore (Platform) + app-car-manager-v2 (v2)
related: docs/plan/PLAN-20260521-auth-rbac-v2.md
```

> **Strategy chốt**:
> - **D-008 Reuse-first**: Tận dụng tối đa AMA + Platform sẵn có cho admin/manager flow
> - **D-010 (rev) Driver phone-login**: Driver login bằng **ent_code + phone (KHÔNG password)** tại v2/driver-login. Admin gửi 2 thông tin này qua Zalo/SMS.
> - **D-014 Security**: Rate limit 5/min/IP + audit log mọi attempt (success+fail)
> - **D-015 Admin create driver**: AMA Web HOẶC v2 Web đều tạo được
>
> Tổng effort ~3.5 ngày (2.0d base + 1.5d driver phone-login).

---

## 1. Tóm tắt Yêu cầu (요구사항 요약)

### 1.1 Base flow (Admin/Manager — qua AMA UI)

| # | Yêu cầu | Loại | Status |
|---|---------|------|--------|
| FR-001 | v2 verify JWT do AMA mint qua `POST /custom-apps/:id/token` | Functional | ✅ Đã có |
| FR-002 | Role trong JWT phải là `eur_role` entity-scoped (OWNER/MASTER/MANAGER/MEMBER) | Functional | ⚠️ Gap |
| FR-003 | Đăng ký `app-car-manager-v2` vào `amb_entity_custom_apps` cho VN01 | Functional | ⚠️ Gap |
| FR-004 | Flow A Direct: AMA Web → iframe v2 — tận dụng `CustomAppHostPage.tsx` | Functional | ✅ Đã có |
| FR-005 | Flow B Embedded: Platform → iframe v2 — proxy AMA endpoint | Functional | ⚠️ Gap |
| FR-006 | v2: upsert `car_users` lúc verify JWT lần đầu (`ensureCarUser`) | Functional | ⚠️ Gap |
| FR-007 | v2: fix bug `scripts/dev-token.mjs` payload | Bug fix | 🐛 Bug |
| FR-008 | Multi-tenancy: query v2 filter qua `withEnt(ent_id)` | Functional | ✅ Đã có |

### 1.2 Driver phone-login flow (D-010 rev — bypass AMA UI, no password)

| # | Yêu cầu | Loại | Status |
|---|---------|------|--------|
| FR-009 | v2 có page `/driver-login` mobile-first, hiện ngoài app chrome (no sidebar) | Functional | ⚠️ Gap |
| FR-010 | Form `/driver-login` chỉ 2 field: **Mã công ty (ent_code)** + **Số điện thoại** + checkbox "Ghi nhớ 30 ngày" | Functional | ⚠️ Gap |
| FR-011 | **AMA endpoint mới**: `POST /api/v1/auth/driver-phone-login { ent_code, phone }` — verify phone tồn tại trong entity + có eur_role + status ACTIVE → mint AMA access (4h) + refresh (rotating) | Functional | ⚠️ Gap |
| FR-012 | v2 endpoint `POST /api/auth/driver-login` proxy AMA `/auth/driver-phone-login` + mint app token + set cookie | Functional | ⚠️ Gap |
| FR-013 | Cookie `amb_session` maxAge 30 ngày (driver) thay vì 8h (admin) | Functional | ⚠️ Gap |
| FR-014 | Silent refresh: app token (1h) expire → v2 dùng AMA refresh token (encrypted trong `car_users.usr_ama_refresh_token_enc`) gọi `/auth/refresh` → mint app token mới → update cookie. Driver không cảm nhận | Functional | ⚠️ Gap |
| FR-015 | Refresh token rotation: mỗi lần refresh, AMA trả refresh token mới → v2 update DB. Inactive 7d = bị logout (AMA refresh exp) | Functional | ⚠️ Gap |
| FR-016 | Lỗi auth → redirect `/driver-login` (KHÔNG về AMA) | Functional | ⚠️ Gap |
| FR-017 | Logout button trong sidebar driver — clear cookie + xóa refresh token DB + redirect `/driver-login` | Functional | ⚠️ Gap |
| FR-018 | "Đổi tài xế" button trên `/today` — same logout flow | Functional | ⚠️ Gap |
| FR-019 | Sync phone bidirectional: `amb_users.usr_phone` ↔ `car_users.usr_phone`. AMA là source of truth; v2 sync lúc login (one-way pull) | Functional | ⚠️ Gap |
| FR-020 | Admin tạo driver: AMA Web (đã có UI tạo user) HOẶC v2 Web `/drivers/new` (cần build, gọi AMA API) | Functional | ⚠️ Gap |
| FR-021 | Sau khi tạo driver, AMA Web/v2 hiển thị template SMS/Zalo có sẵn `ent_code` + `phone` + URL v2 để admin copy-paste gửi cho driver | Functional | ⚠️ Gap |

### 1.3 Security (D-014)

| # | Yêu cầu | Loại | Status |
|---|---------|------|--------|
| SR-001 | Rate limit `/auth/driver-phone-login`: 5 attempts/phút/IP. Vượt → 429 với header `Retry-After` | Security | ⚠️ Gap |
| SR-002 | Audit `car_audit_logs` mọi attempt: `USER.LOGIN_ATTEMPT` (success/fail), payload `{ ent_code, phone_masked, ip, reason }` | Security | ⚠️ Gap |
| SR-003 | Error message generic: KHÔNG phân biệt "ent_code sai" vs "phone không tồn tại" vs "không có role" → tất cả trả `E1014 Invalid credentials`. Chống enumeration | Security | ⚠️ Gap |
| SR-004 | Phone masked trong audit log: `0901****67` thay vì full | Security | ⚠️ Gap |

### 1.4 Non-Functional

| # | Yêu cầu | Status |
|---|---------|--------|
| NFR-001 | `JWT_SECRET` đồng bộ byte-for-byte: AMA, Platform, v2 | ✅ |
| NFR-002 | Token AMA mint 1h; cookie v2: 8h (admin) / 30d (driver) | ⚠️ |
| NFR-003 | Audit `USER.ROLE_SYNC`, `USER.PROVISIONED`, `USER.LOGIN_ATTEMPT`, `USER.LOGGED_IN`, `USER.LOGGED_OUT` vào `car_audit_logs` | ⚠️ Gap |
| NFR-004 | Refresh token encrypted AES-256-GCM bằng `ENCRYPTION_KEY` env | ⚠️ Gap |
| NFR-005 | Driver login form responsive 320px-768px, không cần horizontal scroll | ⚠️ Gap |

**Tổng: ~20 gap + 1 bug** (FR-002 → FR-006 base, FR-009 → FR-021 driver, SR-001 → SR-004 security, NFR-002 → NFR-005). Phần ✅ tận dụng nguyên hiện trạng AMA + Platform.

---

## 2. Phân tích Hiện trạng — Cái gì đã có sẵn (AS-IS 현황 분석)

### 2.1 ambManagement — Custom App Integration ĐÃ HOÀN CHỈNH ✅

#### Bảng `amb_entity_custom_apps` ([entity-custom-app.entity.ts](../../ambManagement/apps/api/src/domain/entity-settings/entity/entity-custom-app.entity.ts))

| Field | Mô tả | Dùng cho v2 |
|-------|-------|-------------|
| `eca_id` PK | UUID | — |
| `ent_id` FK | Org sở hữu | Multi-tenancy |
| `eca_code` varchar(50) UNIQUE per ent | Slug — sẽ là `app-car-manager-v2` | App identifier |
| `eca_name` | Display name | UI |
| `eca_url` | Endpoint app | iframe src + ?ama_token |
| `eca_auth_mode` | `jwt`/`none`/`api_key` | v2 dùng `jwt` |
| `eca_open_mode` | `iframe`/`new_tab` | v2 dùng `iframe` |
| `eca_allowed_roles` | array hoặc null (public) | Filter app theo role |
| `eca_api_key_enc` | AES-256-GCM nếu `api_key` mode | Không dùng cho v2 |

#### Endpoints — tất cả đã có

| Endpoint | Mục đích | Auth | Status |
|----------|----------|------|--------|
| `GET /entity-settings/custom-apps` | List all per entity (admin) | `@Auth() + OwnEntityGuard` | ✅ |
| `GET /entity-settings/custom-apps/my` | List apps user thấy được (filter `eca_allowed_roles`) | `@Auth()` | ✅ |
| `POST /entity-settings/custom-apps` | Create | `@Auth() + OwnEntityGuard` | ✅ |
| `PATCH/DELETE /entity-settings/custom-apps/:id` | Update/soft-delete | `@Auth() + OwnEntityGuard` | ✅ |
| **`POST /entity-settings/custom-apps/:id/token`** | Mint JWT 1h cho app | `@Auth()` | ✅ (⚠️ role payload cần fix) |

#### `generateAppToken()` ([service.ts:116-146](../../ambManagement/apps/api/src/domain/entity-settings/service/entity-custom-app.service.ts#L116))

```typescript
const payload = {
  sub: user.userId,
  email: user.email,
  role: user.role,                   // ⚠️ usr_role (user-level), KHÔNG phải eur_role
  entityId,
  appId: app.ecaId,
  appCode: app.ecaCode,
  scope: 'custom_app:context',
};
const token = this.jwtService.sign(payload, { expiresIn: '1h' });
```

**Vấn đề duy nhất**: `role` lấy từ `user.role` (JWT context user-level: SUPER_ADMIN/ADMIN/MANAGER/MEMBER/VIEWER). v2 expect entity-scoped `eur_role` (OWNER/MASTER/MANAGER/MEMBER). → **Đây là gap chính cần fix**.

#### Frontend AMA — `CustomAppHostPage.tsx` ĐÃ HOÀN CHỈNH ✅

[apps/web/src/domain/custom-apps/pages/CustomAppHostPage.tsx](../../ambManagement/apps/web/src/domain/custom-apps/pages/CustomAppHostPage.tsx) (209 dòng) đã làm:
1. Call `GET /entity-settings/custom-apps/my` → list apps user thấy
2. User click → call `POST /entity-settings/custom-apps/:id/token` → nhận token
3. Build iframe src: `${app.url}?ama_token=${token}&locale=${lang}`
4. Render iframe với CSP-aware fallback (block detect → mở new_tab)

**Kết luận Flow A Direct**: KHÔNG cần thêm code AMA. Chỉ cần (1) sửa role trong `generateAppToken()`, (2) seed một row vào `amb_entity_custom_apps` cho VN01.

#### Guards + Decorators sẵn có

| Guard/Decorator | Behavior | Path |
|-----------------|----------|------|
| `@Auth()` | JwtAuthGuard + LevelRoleGuard | [auth.decorator.ts](../../ambManagement/apps/api/src/domain/auth/decorator/auth.decorator.ts) |
| `@AdminOnly()` | level = ADMIN_LEVEL | |
| `@MasterOrAdmin()` | role ∈ {MASTER, ADMIN, SUPER_ADMIN} | |
| `OwnEntityGuard` | USER_LEVEL chỉ vào entity của mình; ADMIN_LEVEL bypass | [own-entity.guard.ts](../../ambManagement/apps/api/src/domain/auth/guard/own-entity.guard.ts) |
| `LevelRoleGuard` | Block PENDING/SUSPENDED/INACTIVE/WITHDRAWN, mustChangePw | [level-role.guard.ts](../../ambManagement/apps/api/src/domain/auth/guard/level-role.guard.ts) |
| `DataScopeInterceptor` | Set `request.dataScope` theo level | [data-scope.interceptor.ts](../../ambManagement/apps/api/src/domain/auth/interceptor/data-scope.interceptor.ts) |

#### Bảng `amb_hr_entity_user_roles` (EUR) — role nguồn

| Field | Mô tả |
|-------|-------|
| `eur_id` PK | UUID |
| `ent_id` FK | Org |
| `usr_id` FK | User |
| `eur_role` | OWNER/MASTER/MANAGER/MEMBER ⭐ khớp v2 |
| `eur_status` | ACTIVE/INACTIVE |
| Unique `(ent_id, usr_id)` | 1 role/user/entity |

### 2.2 ambAppStore Platform — Đã wire AMA SSO ✅

#### Trạng thái thực tế (audit kết quả)

| Endpoint | Trạng thái |
|----------|-----------|
| `POST /api/v1/auth/login` | ✅ Proxy AMA `/login` (`process.env.AMA_API_BASE_URL` default `https://stg-ama.amoeba.site`) → decode AMA JWT → mint Platform JWT |
| Admin SSO callback | ✅ `AdminLoginPage.tsx` redirect tới AMA `/login?redirect_uri=...` → nhận `?token=` → clean URL |
| Entity iframe context | ✅ `entity-context.store.ts` đọc `?ent_id&ent_code&ent_name&email` |
| Subscription model | ✅ `plt_subscriptions` per entity, status `ACTIVE` mới hiện app |
| **`AppDetailPage` mở app** | ⚠️ **Gap**: `<a href={app.slug}>` đơn giản, KHÔNG mint per-app token, mất iframe context |
| OAuth full | ❌ Chưa làm — không cần cho v2 |

#### Không cần refactor Platform login

Plan trước đề xuất "bỏ Platform self-mint" — bỏ phương án này vì:
- Admin SSO + user login proxy đang hoạt động ổn
- Phá vỡ Platform sẽ break các app v1 (car-manager v1, sales, stock) hiện chạy production
- Chỉ cần FIX 1 chỗ: `AppDetailPage` proxy AMA mint token rồi set iframe src

### 2.3 app-car-manager-v2 — Hoàn chỉnh trừ 2 bug

#### JWT Verify chain — ĐẦY ĐỦ ✅

| Component | Path | Status |
|-----------|------|--------|
| Middleware | [apps/web/src/middleware.ts](../../apps/app-car-manager-v2/apps/web/src/middleware.ts) | ✅ Verify + cookie + driver allowlist |
| jose verify | [apps/web/src/lib/auth/verify-jwt.ts](../../apps/app-car-manager-v2/apps/web/src/lib/auth/verify-jwt.ts) | ✅ HS256, no iss/aud check |
| Zod schema | [packages/shared/src/auth/jwt-claims.ts](../../apps/app-car-manager-v2/packages/shared/src/auth/jwt-claims.ts) | ✅ Strict, dual appCode support |
| Role mapping | Same file | ✅ OWNER/MASTER→ADMIN, MANAGER→MANAGER, MEMBER→DRIVER |
| Cookie config | middleware.ts:63-68 | ✅ HttpOnly, Secure(prod), SameSite, 8h |
| CSP frame-ancestors | next.config.mjs:37 | ✅ Dynamic theo `NEXT_PUBLIC_AMA_ORIGIN` |
| Server action role checks | trip/driver/expense.actions.ts | ✅ `requireRole()` consistent |
| dev-login route | [apps/web/src/app/dev-login/route.ts](../../apps/app-car-manager-v2/apps/web/src/app/dev-login/route.ts) | ✅ Payload đúng |

#### Bug + Gap thật ⚠️

| Issue | File | Vấn đề |
|-------|------|--------|
| **dev-token.mjs sai payload** | [scripts/dev-token.mjs](../../apps/app-car-manager-v2/scripts/dev-token.mjs) | Payload: `{ent_id, app_code}` snake_case + `iss: 'amb-management'` + `aud: 'car-manager-v2'`. Verify schema kỳ vọng camelCase + NO iss/aud → Zod parse FAIL. Token script này KHÔNG dùng được. |
| **car_users không auto-upsert** | server services | Trip/expense flow query `car_users.usr_id` (driver.actions.ts:23). Nếu user chưa có row → fail. AMA mint JWT thành công nhưng v2 vẫn block — bad UX. |

---

## 3. Yêu cầu TO-BE (TO-BE 요구사항)

### 3.1 Sơ đồ tổng thể

```
                ┌─────────────────────────────────────────┐
                │   ambManagement (AMA, :3009/:5179)      │
                │                                          │
                │   amb_users ─── amb_hr_entity_user_roles │
                │                       (eur_role)         │
                │   amb_hr_entities                        │
                │                                          │
                │   amb_entity_custom_apps                 │
                │     eca_code='app-car-manager-v2' (VN01) │
                │                                          │
                │   POST :id/token (1h, HS256, JWT_SECRET) │
                │     payload {sub, email, role:eur_role*, │
                │              entityId, appCode, appId,   │
                │              scope, iat, exp}            │
                │     * = THAY ĐỔI (D-002 role source)     │
                └──────────┬───────────────────────┬───────┘
                           │                       │
              Flow A       │                       │      Flow B
       (Direct, ĐÃ READY)  │                       │  (Embedded, sửa 1 chỗ)
                           │                       │
              AMA Web :5179│                       │ Platform :5200
              CustomAppHost│                       │ AppDetailPage
              Page.tsx     │                       │ (proxy AMA endpoint)
                           │                       │
                           ▼                       ▼
                   ┌──────────────────────────────────────┐
                   │   car-manager-v2 (:3001)             │
                   │   iframe src=`${eca_url}?ama_token=…`│
                   │                                      │
                   │   middleware verify → cookie 8h      │
                   │   RSC layout → ensureCarUser() ⭐ NEW│
                   │   data filtered by ent_id            │
                   └──────────────────────────────────────┘
```

### 3.2 Mapping AS-IS → TO-BE (14 thay đổi: 6 base + 8 driver phone-login)

**Base flow (admin/manager qua AMA UI):**

| # | Component | AS-IS | TO-BE | Effort |
|---|-----------|-------|-------|--------|
| 1 | AMA `generateAppToken()` payload role | `user.role` (usr_role) | Lookup `eur_role` từ `amb_hr_entity_user_roles` | 0.5d |
| 2 | AMA seed `amb_entity_custom_apps` | Chưa có cho v2 | INSERT cho VN01, `eca_allowed_roles=[O,MA,M,M]` | 0.1d |
| 3 | Platform `AppDetailPage` | `<a href={slug}>` | useEffect gọi launch-token → set iframe src | 0.3d |
| 4 | Platform backend proxy endpoint | Chưa có | `POST /api/v1/apps/:slug/launch-token` | 0.2d |
| 5 | v2 `ensureCarUser()` + phone sync | Không có | Service mới + RSC layout + React `cache()` | 0.3d |
| 6 | v2 `dev-token.mjs` bug | snake_case + iss/aud | camelCase, bỏ iss/aud | 0.1d |

**Driver phone-login flow (D-010 rev):**

| # | Component | AS-IS | TO-BE | Effort |
|---|-----------|-------|-------|--------|
| 7 | AMA endpoint `/auth/driver-phone-login` | Không có | Mới — verify ent_code + phone, mint tokens | 0.3d |
| 8 | AMA rate limit + audit log | Không có | `@Throttle` 5/min + auditLog mỗi attempt + maskPhone util | 0.2d |
| 9 | v2 `car_users` add usr_phone + refresh col | Không có | DB migration 0010 | 0.1d |
| 10 | v2 crypto util AES-256-GCM | Không có | `lib/auth/crypto.ts` | 0.1d |
| 11 | v2 driver-login page + API route | Không có | Mobile form 2 field + proxy AMA | 0.3d |
| 12 | v2 silent refresh logic | Không có | server action `refreshDriverToken()` | 0.2d |
| 13 | v2 logout + switch user | Không có | endpoint + UI button | 0.2d |
| 14 | Admin create driver UI (AMA + v2) | AMA có, v2 chưa | v2 `/drivers/new` + AMA SMS template modal | 0.5d |

| | | **Tổng** | **3.5d** code + 0.5d testing = **4.0d** |

### 3.2.1 Driver Phone-Login Flow — Chi tiết (D-010 rev)

```
ONBOARDING (Admin → Driver):
────────────────────────────
1. Admin Lan (OWNER VN01) tạo driver:
   - Option A: AMA Web → Users → Create User (existing UI)
   - Option B: v2 Web /drivers/new (build mới) → gọi AMA API
   
   Tạo: amb_users { usr_phone='0901234567', usr_email=NULL,
                    usr_company_id=vn01_id, usr_status='ACTIVE' }
        amb_hr_entity_user_roles { ent_id=vn01_id, usr_id=binh_id,
                                    eur_role='MEMBER', eur_status='ACTIVE' }

2. Sau khi tạo, UI hiện template SMS có sẵn:
   ┌─────────────────────────────────────────────────┐
   │ Anh Bình, app quản lý xe Cty đã sẵn sàng.       │
   │ 📱 Tải: https://v2.amoeba.site                  │
   │ Đăng nhập với:                                  │
   │ • Mã công ty: VN01                              │
   │ • Số điện thoại: 0901234567                     │
   └─────────────────────────────────────────────────┘
   [📋 Copy]  [📲 Gửi Zalo]
   
3. Lan copy + gửi Zalo cho Bình.

LOGIN FLOW (Driver):
────────────────────
Driver Bình mở v2/driver-login (mobile):

   ┌──────────────────────────────────┐
   │ 📱 Đăng nhập tài xế              │
   │ ┌──────────────────────────────┐ │
   │ │ Mã công ty                   │ │
   │ │ VN01                         │ │
   │ └──────────────────────────────┘ │
   │ ┌──────────────────────────────┐ │
   │ │ Số điện thoại                │ │
   │ │ 0901234567                   │ │
   │ └──────────────────────────────┘ │
   │ ☑ Ghi nhớ thiết bị 30 ngày       │
   │ [    Đăng nhập               ]   │
   └──────────────────────────────────┘
                  ↓
   POST v2/api/auth/driver-login
                  ↓
   v2 backend:
   1. Rate limit check (5/min/IP) — fail → 429
   2. POST AMA /auth/driver-phone-login { ent_code: 'VN01',
                                          phone: '0901234567' }
      AMA service:
      a. Lookup amb_hr_entities WHERE ent_code='VN01' AND ent_status='ACTIVE'
      b. Lookup amb_users WHERE usr_phone='0901234567'
                          AND usr_company_id=ent_id
                          AND usr_status='ACTIVE'
      c. Lookup amb_hr_entity_user_roles WHERE (ent_id, usr_id)
                                         AND eur_status='ACTIVE'
      d. Bất kỳ step nào fail → audit log USER.LOGIN_ATTEMPT (fail)
                              → 401 E1014 "Invalid credentials" (generic)
      e. All pass → mint AMA access (4h) + refresh (7d, rotating)
      f. Audit log USER.LOGIN_ATTEMPT (success)
      g. Return { accessToken, refreshToken, user }
   
   3. v2 với accessToken:
      - GET AMA /custom-apps/my → tìm app id của 'app-car-manager-v2'
      - POST AMA /custom-apps/:eca_id/token → mint app token (1h, role=eur_role)
   
   4. ensureCarUser(claims) + sync phone:
      INSERT/UPDATE car_users SET
        usr_phone = '0901234567'  ← NEW, sync từ amb_users
        usr_local_role = mapAmaRoleToLocal(role)  // MEMBER → DRIVER
        usr_ama_refresh_token_enc = encrypt(refreshToken)
        usr_last_login_at = now
   
   5. Set cookie amb_session (app token, maxAge 30d, HttpOnly)
   6. Audit USER.LOGGED_IN
   7. Response: 302 → /today

SILENT REFRESH FLOW (giống D-011 trong v3.0):
───────────────────
RSC layout phát hiện token expired → server action refreshDriverToken():
1. SELECT car_users.usr_ama_refresh_token_enc WHERE usr_id=current
2. Decrypt → refreshToken cũ
3. POST AMA /auth/refresh { refresh_token } (endpoint chung cho mọi login)
4. POST AMA /custom-apps/:id/token → app token mới
5. UPDATE car_users SET usr_ama_refresh_token_enc=enc(rotated)
6. Set cookie amb_session
7. Audit: skip (quá nhiều log nếu mỗi giờ)

LOGOUT + SWITCH USER (giống v3.0):
────────────────
POST /api/auth/driver-logout:
1. Clear cookie amb_session
2. UPDATE car_users SET usr_ama_refresh_token_enc=NULL
3. Best-effort POST AMA /auth/logout
4. Audit USER.LOGGED_OUT
5. 302 → /driver-login

SECURITY MITIGATIONS (D-014):
────────────────────────
1. Rate limit middleware AMA: 5 attempts/phút/IP cho /auth/driver-phone-login
   - Vượt → 429 + Retry-After header
   - Track redis or in-memory (Nest @nestjs/throttler)

2. Audit log mọi attempt (success+fail) vào car_audit_logs:
   {
     audEvent: 'USER.LOGIN_ATTEMPT',
     audPayload: {
       ent_code: 'VN01',
       phone_masked: '0901****67',
       ip: '14.161.x.x',
       reason: 'success' | 'entity_not_found' | 'phone_not_found' | 'no_role',
       outcome: 'success' | 'fail'
     }
   }

3. Generic error E1014 — không phân biệt lý do fail để chống enumeration

4. Phone masking utility: maskPhone('0901234567') → '0901****67'
```

### 3.3 KHÔNG cần thay đổi (giữ nguyên hiện trạng)

- ❌ ~~Bỏ Platform self-mint JWT~~ — Platform login proxy AMA đang hoạt động ổn
- ❌ ~~Thêm AMA `/launch` redirect~~ — `CustomAppHostPage.tsx` đã handle Flow A
- ❌ ~~Refactor Platform login~~ — Admin SSO + user login đã wire
- ❌ ~~Đăng ký v2 vào `amb_partner_apps` OAuth~~ — overkill, v2 stateless JWT đủ
- ❌ ~~v2 implement OAuth client~~ — không cần, JWT passthrough đủ
- ❌ ~~Sửa Vite proxy config~~ — đã đúng
- ❌ ~~Sửa middleware v2~~ — đã đúng
- ❌ ~~Sửa cookie/CSP v2~~ — đã đúng

### 3.4 Quy tắc nghiệp vụ

1. **Role lookup strict**: User không có row `amb_hr_entity_user_roles` cho entity X → AMA `generateAppToken()` trả 403 `User chưa được gán role ở entity này`. Áp dụng cả ADMIN_LEVEL (system admin vẫn phải có row EUR cụ thể để vào v2 entity đó).
2. **`eca_allowed_roles` filter**: Nếu seed với `eca_allowed_roles=['OWNER','MASTER','MANAGER','MEMBER']` → tất cả role thấy được. Có thể tightening sau (vd: chỉ MASTER/OWNER thấy được v2 → nếu muốn limit driver).
3. **Role sync timing**: Khi `eur_role` đổi trong AMA → v2 cập nhật `usr_local_role` lúc verify JWT kế tiếp (cookie cũ vẫn dùng role cũ tới 8h drift). Acceptable cho MVP.
4. **car_users orphan**: Khi user bị remove khỏi entity trong AMA (`eur_status='INACTIVE'`) → AMA reject mint token → v2 block. Row `car_users` orphan vẫn còn nhưng không truy cập được — soft cleanup sau.

---

## 4. Gap Analysis (갭 분석)

### 4.1 Tóm tắt phạm vi qua các plan version

| Vùng | v1.0 refactor | v2.0 reuse | v3.0 +email login | **v4.0 phone login** |
|------|---------------|-----------|-------------------|---------------------|
| File backend AMA | 5 | 3 | 3 | **8** (+ 5 cho driver-phone-login endpoint + util) |
| File backend Platform | 3 | 2 | 2 | **2** (không đổi) |
| File frontend Platform | 4 | 1 | 1 | **1** (không đổi) |
| File v2 | 4 | 3 | 11 | **14** (+ 3 cho phone form, admin create UI) |
| DB migration | 0 | 1 (optional) | 2 | **2** (audit enum + driver-phone-login) |
| **Tổng** | **17+** | **9** | **17** | **33** |

→ Scope v4.0 lớn hơn v2.0/v3.0 vì thêm driver phone-login + admin create UI, nhưng vẫn TẬN DỤNG nguyên Platform login + AMA CustomAppHostPage.

### 4.2 Danh sách file thay đổi v4.0 (33 file)

Xem chi tiết [PLAN §3](../plan/PLAN-20260521-auth-rbac-v2.md#3-danh-sách-file-thay-đổi-변경-파일-목록). Tóm gọn:

| Vùng | Số file | Mục đích chính |
|------|---------|----------------|
| AMA (backend + test + SQL) | 8 | `generateAppToken` eur_role + `/auth/driver-phone-login` + seed |
| Platform (BE + FE) | 4 | launch-token endpoint + AppDetailPage iframe |
| v2 (BE + FE + DB + scripts) | 14 | ensureCarUser + driver-login page + silent refresh + admin create driver |
| AMA frontend (modal SMS) | 1 | UserCreatedModal với template SMS |
| DB migration v2 | 2 | 0009 audit events + 0010 driver-phone-login cols |
| Bug fix | 1 | scripts/dev-token.mjs |

---

## 5. Flow Người dùng (사용자 플로우)

### 5.1 Flow A — Direct (AMA Web → v2) — DÙNG INFRASTRUCTURE SẴN CÓ

```
1. User login http://localhost:5179 (AMA Web)
2. Chọn entity nếu thuộc nhiều entity (UI AMA đã có)
3. Vào trang "My Apps" → CustomAppHostPage.tsx
4. Frontend gọi: GET /api/v1/entity-settings/custom-apps/my
     → Backend filter theo eca_allowed_roles + eca_status
     → Trả về list bao gồm 'app-car-manager-v2' (sau khi seed VN01)
5. User click "Open" trên card v2
6. Frontend gọi: POST /api/v1/entity-settings/custom-apps/:eca_id/token
     → Backend generateAppToken():
        a) Find eca by id
        b) Lookup eur_role WHERE usr_id=user.userId AND ent_id=user.entityId ⭐ NEW
        c) 403 nếu không có
        d) Mint JWT { sub, email, role:eur_role, entityId, appCode, appId, scope, iat, exp }
7. Frontend render: <iframe src="${eca.eca_url}?ama_token=${token}&locale=${lang}">
8. v2 middleware:
     a) Đọc ?ama_token → verifyAmaJwt → set cookie amb_session (8h)
     b) 302 redirect clean URL
9. v2 RSC root layout:
     a) getCurrentUser() đọc cookie + headers
     b) ensureCarUserCached(claims) ⭐ NEW — upsert car_users + audit log
     c) Render dashboard với data filter ent_id
```

### 5.2 Flow B — Embedded (AMA → Platform → iframe v2)

```
1. User login AMA → click "Apps Marketplace" → redirect tới Platform :5200
   URL: http://localhost:5200/?ent_id=<>&ent_code=<>&ent_name=<>&email=<>
2. Platform App.tsx đọc query → store vào entity-context Zustand → clean URL
3. User browse plt_apps catalog, click "Car Manager v2"
4. Platform frontend gọi backend: POST /api/v1/apps/app-car-manager-v2/launch-token ⭐ NEW
   Headers: Authorization: Bearer <Platform JWT từ localStorage>
5. Platform backend:
     a) Verify Platform JWT → extract userId, entityId, amaToken (lưu kèm khi user login)
     b) Lookup eca_id từ ent_id + 'app-car-manager-v2' qua call AMA GET /entity-settings/custom-apps/my
     c) Call AMA POST /entity-settings/custom-apps/:eca_id/token với header `Authorization: Bearer <amaToken>`
     d) Trả về { token, expiresAt }
6. Platform frontend render: <iframe src={`${v2_url}?ama_token=${token}`}>
7. v2 middleware xử lý giống Flow A step 8-9
```

### 5.3 Edge cases

**Admin/Manager (Flow A/B):**
- **User chưa có eur_role ở entity**: AMA `generateAppToken` 403. Frontend AMA Web/Platform hiện error toast.
- **JWT expire khi đang dùng v2**: Cookie admin 8h còn → tiếp tục. Hết → `/session-expired` → quay về AMA mở lại.
- **Mở v2 ở entity khác (cùng browser)**: Cookie cùng tên → overwrite. Limitation MVP.
- **Role thay đổi giữa session**: Cookie chưa hết → role cũ. Mở lại từ AMA → role mới + sync `car_users.usr_local_role`.

**Driver (phone-login flow):**
- **App token (1h) expire khi đang dùng**: RSC layout silent refresh → driver không cảm nhận. Cookie 30d kéo dài session.
- **Refresh token (7d) expire (driver không dùng 7 ngày)**: Silent refresh fail → redirect `/driver-login` → driver nhập lại ent_code + phone.
- **Admin disable driver trong AMA**: Refresh kế tiếp fail (`usr_status='SUSPENDED'`) → redirect `/driver-login`. Hard revoke phải đợi tới refresh tiếp theo (max 1h).
- **Driver nhập sai ent_code/phone 5 lần/phút**: Rate limit 429 + Retry-After. Phải đợi.
- **Shared device giữa 2 ca**: Driver A click "Đổi tài xế" → clear cookie + refresh token DB → driver B nhập creds.

**Dev mode**:
- Admin/Manager: `/dev-login?role=OWNER` route (đã có).
- Driver: cũng dùng `/dev-login?role=MEMBER` để skip AMA.
- Script `dev-token.mjs` fix bug để CLI test cũng dùng được.

---

## 6. Ràng buộc Kỹ thuật (기술 제약사항)

### 6.1 Shared `JWT_SECRET`

- AMA + v2 phải same secret HS256. Dev: `dev-local-jwt-secret-change-me` (đã set trong env files).
- Platform verify Platform JWT (mint local) — không cần share với v2.
- Rotation yêu cầu redeploy AMA + v2 đồng thời.

### 6.2 Cross-origin Platform → AMA (Flow B)

- Platform backend (localhost:3100) gọi AMA backend (localhost:3009). Backend-to-backend, không qua browser → CORS không phải vấn đề.
- AMA `CORS_ORIGINS` đã cho phép localhost:5179/5180. Thêm `:5200` nếu Platform frontend trực tiếp gọi AMA (KHÔNG khuyến nghị — proxy qua Platform backend an toàn hơn).

### 6.3 Token expiry alignment

| Token | Lifetime | Storage |
|-------|----------|---------|
| AMA access JWT | 4h | Cookie/header AMA Web |
| AMA refresh | 7d (rotating mỗi refresh) | Cookie HttpOnly AMA + `car_users.usr_ama_refresh_token_enc` (v2) |
| Platform JWT | 24h | localStorage |
| **AMA app token (mint cho v2)** | **1h** | Truyền qua URL `?ama_token=` 1 lần + cookie v2 |
| **v2 cookie `amb_session` (admin)** | **8h** | HttpOnly cookie v2 |
| **v2 cookie `amb_session` (driver, "remember 30d")** | **30d** maxAge cookie; JWT inside 1h → silent refresh | HttpOnly cookie v2 |

→ Admin: cookie 8h, hết → /session-expired → quay AMA. Driver: cookie 30d + silent refresh; inactive 7d (AMA refresh hết) → /driver-login.

### 6.4 Security

- AMA verify role TỪ DB (`eur_role`) không trust JWT context user-level → chống token reuse với role sai entity.
- v2 verify JWT stateless — không gọi ngược AMA → không thể hard-revoke ngay.
- Iframe CSP `frame-ancestors` đã dynamic theo `NEXT_PUBLIC_AMA_ORIGIN`.

### 6.5 Backward compatibility ⚠️

`generateAppToken()` thay đổi payload `role` từ `usr_role` sang `eur_role`. Custom apps khác đang dùng method này:
- car-manager v1 — chưa biết check role thế nào
- sales-report — chưa biết
- stock-management — chưa biết

**Per D-005**: Đổi đồng nhất, không switch theo `eca_code`. Chấp nhận rủi ro app v1 break. Coordinate với team khi deploy production.

---

## 7. Quyết định đã chốt (Decision Log)

| # | Quyết định | Session | Ghi chú |
|---|-----------|---------|---------|
| D-001 | Entry flow: Direct + Embedded | 2026-05-21 | Cả 2 |
| D-002 | Role source: `eur_role` từ `amb_hr_entity_user_roles` | 2026-05-21 | KHÔNG dùng `usr_role` |
| D-003 | Token issuer: AMA mint, Platform passthrough | 2026-05-21 | Platform bỏ self-mint ⛔ HỦY ở D-008 |
| D-004 | Seed scope: chỉ entity VN01 | 2026-05-21 | Pilot 1 entity |
| D-005 | v1 compat: đổi đồng nhất, app v1 tự lo | 2026-05-21 | ⚠️ HIGH RISK |
| D-006 | OAuth REQ-20260329: status PARTIAL (admin SSO chạy, OAuth full chưa) | 2026-05-21 | Audit Phase 0 đã chạy |
| D-007 | HTTPS local: skip, test staging | 2026-05-21 | — |
| **D-008** | **Strategy: REUSE-FIRST** | **2026-05-21** | Override D-003: Platform KHÔNG bỏ self-mint, chỉ thêm 1 endpoint proxy |
| D-009 | Fix `dev-token.mjs` bug ngay trong scope | 2026-05-21 | Bug fix |
| ~~D-010~~ | ~~Strategy 1 email+password~~ | 2026-05-21 | ⛔ HỦY ở D-010 rev |
| **D-010 rev** | **Driver phone-login**: ent_code + phone (KHÔNG password). AMA endpoint mới `POST /auth/driver-phone-login` | **2026-05-21** | Đơn giản hơn email+password |
| **D-011** | Cookie 30 ngày + silent refresh với rotating refresh token | 2026-05-21 | UX hằng ngày không login lại |
| **D-012** | Error UX = redirect /driver-login | 2026-05-21 | Mobile-friendly |
| **D-013** | Logout + Switch user button trong sidebar driver + /today | 2026-05-21 | Shared device |
| **D-014** | Security MVP: rate limit 5/min/IP + audit log mọi attempt | **2026-05-21** | Mitigate phone+ent_code brute force |
| **D-015** | Organize id = `ent_code` (VN01, HQ, KR01) trong SMS template | **2026-05-21** | Dễ type, khớp pattern AMA hiện có |
| **D-016** | Sync phone bidirectional: AMA source of truth, v2 sync ở login | **2026-05-21** | `car_users.usr_phone` đọc từ JWT/AMA |
| ~~D-017~~ | ~~Admin tạo driver: cả 2 nơi (AMA + v2)~~ | 2026-05-21 | ⛔ HỦY ở D-018 |
| **D-018** | **Phase 0 finding**: AMA KHÔNG có `POST /users` cho USER_LEVEL → **DEFER v2 admin create driver UI sang Phase 2**. MVP chỉ giữ AMA Web SMS template modal | **2026-05-21** | Step 8B defer |
| **D-019** | **Phase 0 finding**: `car_audit_logs` dùng `aud_action` + `aud_entity` (varchar), KHÔNG có `aud_event` enum | **2026-05-21** | Code dùng đúng field names |
| **D-020** | **Phase 0 finding**: AMA `auth.service` KHÔNG có `auditLog()` helper → dùng `LoginHistoryEntity` direct inject | **2026-05-21** | Login attempts → `amb_login_history` table |
| **D-021** | **Phase 0 finding**: Platform JWT KHÔNG include `amaToken` → Option B: frontend gửi qua header `X-AMA-Token` từ localStorage | **2026-05-21** | Step 3 đơn giản |

## 8. Câu hỏi còn lại

1. Khi user thuộc nhiều entity, AMA Web đã có UI chọn entity chưa? — Phase 0 confirm.
2. Role sync audit chỉ ghi vào v2 `car_audit_logs` (AMA stateless). OK.
3. eca_allowed_roles cho v2 mặc định là gì? — propose all 4 roles cho MVP, tightening sau.
