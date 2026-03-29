# OAuth 2.0 AMA SSO Integration — Task Plan (OAuth 2.0 AMA SSO 연동 작업계획서)

---
document_id: PLT-PLAN-20260329-OAUTH-SSO
version: 1.0.0
status: Draft
created: 2026-03-29
updated: 2026-03-29
author: Copilot
based_on: PLT-REQ-20260329-OAUTH-SSO
app: platform (+ all partner apps)
---

## 1. System Development Status Analysis (시스템 개발 현황 분석)

### 1.1 Directory Structure (디렉토리 구조)

```
apps/platform/
├── backend/src/
│   ├── auth/
│   │   ├── auth.module.ts              ← Modify (add HttpModule, OAuthService, Entity)
│   │   ├── auth.controller.ts          ← Modify (replace login → OAuth endpoints)
│   │   ├── jwt.strategy.ts             ← No change (continues to verify app-local JWT)
│   │   ├── guards/
│   │   │   ├── jwt-auth.guard.ts       ← No change
│   │   │   └── role.guard.ts           ← No change
│   │   ├── decorators/
│   │   │   ├── auth.decorator.ts       ← No change
│   │   │   ├── public.decorator.ts     ← No change
│   │   │   ├── admin-only.decorator.ts ← No change
│   │   │   └── current-user.decorator.ts ← No change
│   │   ├── interfaces/
│   │   │   └── ama-jwt-payload.interface.ts ← No change
│   │   ├── entity/
│   │   │   └── oauth-session.entity.ts ← NEW
│   │   ├── dto/
│   │   │   ├── oauth-callback.request.ts ← NEW
│   │   │   ├── oauth-refresh.request.ts  ← NEW
│   │   │   └── oauth-token.response.ts   ← NEW
│   │   └── oauth.service.ts            ← NEW (core OAuth logic)
│   ├── common/
│   │   └── dto/base-response.dto.ts    ← No change
│   ├── platform-app/                   ← No change
│   └── platform-subscription/          ← No change
├── frontend/src/
│   ├── App.tsx                         ← Modify (add /callback route)
│   ├── pages/
│   │   ├── AppsLoginPage.tsx           ← Modify (add OAuth button, keep dev fallback)
│   │   ├── OAuthCallbackPage.tsx       ← NEW
│   │   └── admin/
│   │       └── AdminLoginPage.tsx      ← Modify (use OAuth flow)
│   ├── stores/
│   │   └── auth.store.ts              ← Modify (add refresh_token)
│   ├── lib/
│   │   └── api-client.ts              ← Modify (add silent refresh interceptor)
│   └── i18n/locales/
│       ├── ko/platform.json            ← Modify
│       ├── en/platform.json            ← Modify
│       └── vi/platform.json            ← Modify
└── scripts/
    └── init-db.sql                     ← Modify (add plt_oauth_sessions)
```

### 1.2 Tech Stack (기술 스택)

| Component | Version | Note |
|-----------|---------|------|
| NestJS | 11.1.x | Backend framework |
| @nestjs/jwt | 11.x | JWT token sign/verify |
| @nestjs/passport | 11.x | Passport strategy |
| @nestjs/axios | (new) | HTTP client for AMA API calls |
| TypeORM | 0.3.x | ORM for plt_oauth_sessions |
| React | 18.3.x | Frontend |
| React Router | 6.28.x | /callback route |
| Axios | 1.7.x | API client + refresh interceptor |
| Zustand | 5.x | Auth state management |

### 1.3 Existing Code Constraints (기존 코드 제약)

| Constraint | Detail |
|-----------|--------|
| JWT_SECRET sharing | All 3 backends (platform, car-manager, stock-management) use same `JWT_SECRET` → app-local JWT must be signed with same key |
| localStorage key `ama_token` | Car-manager reads this key → must continue using same key name |
| `AmaJwtPayload` interface | Must remain compatible — `userId`, `entityId`, `entityCode`, `email`, `name`, `roles` |
| `@Auth()` decorator | All existing guards continue to work — no change needed |
| Docker networking | Platform BFF runs in `amb-apps-network` Docker network → must be able to reach AMA server (external HTTPS) |

---

## 2. Step-by-Step Implementation Plan (단계별 구현 계획)

### Phase 1: Backend — OAuth Infrastructure (백엔드 OAuth 인프라)

#### Step 1.1: Add Dependencies (의존성 추가)
- Add `@nestjs/axios` (NestJS HttpModule wrapper) to platform backend
- └─ Side Impact: None — new dependency only

#### Step 1.2: Create `plt_oauth_sessions` Entity
- Create `apps/platform/backend/src/auth/entity/oauth-session.entity.ts`
- TypeORM entity for `plt_oauth_sessions` table
- Fields: oas_id (PK/UUID), ent_id, oas_user_id, oas_email, oas_ama_access_token, oas_ama_refresh_token, oas_ama_token_expires, oas_app_refresh_token, oas_app_token_expires, oas_scopes, oas_is_active, timestamps
- └─ Side Impact: TypeORM auto-creates table in dev (synchronize: true)

#### Step 1.3: Create OAuth Request/Response DTOs
- `apps/platform/backend/src/auth/dto/oauth-callback.request.ts` — `{ code, state, redirect_uri }`
- `apps/platform/backend/src/auth/dto/oauth-refresh.request.ts` — `{ refresh_token }`
- `apps/platform/backend/src/auth/dto/oauth-token.response.ts` — `{ token, refreshToken, user, expiresIn }`
- └─ Side Impact: None — new files only

#### Step 1.4: Create OAuthService (핵심 서비스)
- `apps/platform/backend/src/auth/oauth.service.ts`
- Methods:
  - `getAuthorizeUrl(redirectPath?: string)`: Generate AMA OAuth authorize URL with random `state`
  - `exchangeCode(code, state, redirectUri)`: Exchange auth code → AMA tokens → app-local JWT
  - `refreshTokens(appRefreshToken)`: Refresh app-local JWT using AMA refresh_token
  - `revokeSession(userId)`: Revoke AMA tokens + deactivate session
  - `getUserInfo(amaAccessToken)`: Call AMA /oauth/userinfo
  - `issueAppJwt(userInfo)`: Sign app-local JWT with JWT_SECRET
- Dependencies: HttpService (@nestjs/axios), JwtService, TypeORM Repository
- └─ Side Impact: None — new service only

#### Step 1.5: Modify AuthController — OAuth Endpoints
- Replace `POST /api/v1/auth/login` (static password) with:
  - `GET /api/v1/auth/oauth/authorize` — Returns `{ authorizeUrl }`
  - `POST /api/v1/auth/oauth/token` — Exchanges code → tokens
  - `POST /api/v1/auth/oauth/refresh` — Refreshes tokens
  - `POST /api/v1/auth/oauth/revoke` — Revokes session
  - `GET /api/v1/auth/me` — Returns current user from JWT
- **Keep** existing `POST /api/v1/auth/login` as `@Public()` fallback for dev/staging
- └─ Side Impact: **Medium** — Frontend must update API calls. Backward compatible if old endpoint is kept.

#### Step 1.6: Modify AuthModule — Register New Providers
- Import `HttpModule` (from `@nestjs/axios`)
- Import `TypeOrmModule.forFeature([OAuthSessionEntity])`
- Register `OAuthService` as provider + export
- └─ Side Impact: None — module config change only

#### Step 1.7: Update init-db.sql
- Add `plt_oauth_sessions` table DDL to `apps/platform/backend/scripts/init-db.sql`
- └─ Side Impact: Requires Docker MySQL volume reset on staging for new table

#### Step 1.8: Update Environment Variables
- Add to `.env.staging.example`:
  - `AMA_OAUTH_BASE_URL`
  - `AMA_OAUTH_CLIENT_ID`
  - `AMA_OAUTH_CLIENT_SECRET`
  - `AMA_OAUTH_REDIRECT_URI`
- └─ Side Impact: Staging `.env` must be manually updated on server

---

### Phase 2: Frontend — OAuth Login Flow (프론트엔드 OAuth 로그인)

#### Step 2.1: Modify Auth Store — Add Refresh Token Support
- `apps/platform/frontend/src/stores/auth.store.ts`
- Add `refreshToken: string | null` field
- Add `ama_refresh_token` localStorage key
- Update `setAuth()` to accept and store refresh token
- Update `clearAuth()` to also clear refresh token
- └─ Side Impact: **Low** — Existing `token` and `user` fields unchanged

#### Step 2.2: Create OAuthCallbackPage
- `apps/platform/frontend/src/pages/OAuthCallbackPage.tsx`
- On mount: extract `code` and `state` from URL search params
- Call `POST /api/v1/auth/oauth/token` with code + state
- On success: `setAuth(token, refreshToken, user)` → redirect to stored path
- On error: display error message with "Try Again" button
- Handle `error` param from AMA (declined consent)
- └─ Side Impact: None — new component only

#### Step 2.3: Modify AppsLoginPage — Add OAuth Button
- `apps/platform/frontend/src/pages/AppsLoginPage.tsx`
- Add "AMA 계정으로 로그인" primary button
  - On click: call `GET /api/v1/auth/oauth/authorize` → redirect to `authorizeUrl`
- Keep existing form as **Dev-only fallback** (show only when `import.meta.env.DEV`)
- Store `redirect` search param in sessionStorage before redirect (to restore after callback)
- └─ Side Impact: **Medium** — Login UX changes. Dev mode retains backward compatibility.

#### Step 2.4: Modify AdminLoginPage — Use OAuth Flow
- `apps/platform/frontend/src/pages/admin/AdminLoginPage.tsx`
- Replace "Login with AMA" link (currently points to VITE_AMA_LOGIN_URL) with OAuth flow
  - On click: call `GET /api/v1/auth/oauth/authorize` → redirect to `authorizeUrl`
- Keep dev token input in Dev mode
- After OAuth callback + login, verify ADMIN role → redirect to `/admin/subscriptions`
- └─ Side Impact: **Medium** — Admin login UX changes

#### Step 2.5: Modify API Client — Silent Refresh Interceptor
- `apps/platform/frontend/src/lib/api-client.ts`
- On 401 response:
  1. Check if refresh_token exists in localStorage
  2. If yes: call `POST /api/v1/auth/oauth/refresh` with refresh_token
  3. If refresh succeeds: update stored tokens, retry original request
  4. If refresh fails: clear auth, redirect to `/apps/login`
  5. Queue concurrent 401s (don't send multiple refresh requests)
- └─ Side Impact: **Medium** — All API calls now have automatic retry on 401

#### Step 2.6: Modify App.tsx — Add Callback Route
- `apps/platform/frontend/src/App.tsx`
- Add route: `<Route path="/callback" element={<OAuthCallbackPage />} />`
- └─ Side Impact: None — new route only

#### Step 2.7: Update Frontend Environment Variables
- Add to `.env.example`:
  - `VITE_AMA_OAUTH_AUTHORIZE_URL` — Used for constructing authorize URL (optional, backend-driven)
  - `VITE_AMA_OAUTH_CLIENT_ID` — Frontend needs client_id if redirecting directly (optional)
- └─ Side Impact: None — new vars for build-time inlining

---

### Phase 3: i18n — Translation Keys (다국어 번역)

#### Step 3.1: Add OAuth Login Translation Keys
- `ko/platform.json`: OAuth 로그인 관련 번역 키 추가
- `en/platform.json`: OAuth login translation keys
- `vi/platform.json`: OAuth login Vietnamese translations
- Keys:
  - `login.loginWithAma` — "AMA 계정으로 로그인"
  - `login.oauthRedirecting` — "AMA 인증 페이지로 이동 중..."
  - `login.oauthError` — "인증에 실패했습니다"
  - `login.oauthDenied` — "접근이 거부되었습니다"
  - `login.callbackProcessing` — "로그인 처리 중..."
  - `login.callbackError` — "로그인 처리에 실패했습니다"
  - `login.tryAgain` — "다시 시도"
  - `login.devModeOnly` — "개발 모드 전용"
- └─ Side Impact: None — i18n key addition only

---

### Phase 4: Testing & Verification (테스트 및 검증)

#### Step 4.1: Backend Unit Verification
- `tsc --noEmit` — TypeScript 무에러 확인
- OAuthService unit logic verification
- AuthController endpoint manual testing

#### Step 4.2: Frontend Build Verification
- `vite build` — Build 성공 확인
- OAuth flow E2E manual testing:
  1. `/apps/login` → click OAuth → redirect to AMA
  2. AMA login → consent → callback
  3. Token stored → redirect to app
  4. 401 → silent refresh → retry
  5. Logout → token revoked

#### Step 4.3: Partner App Compatibility Check
- Car-manager: reads `ama_token` → verify JWT structure unchanged
- Stock-management: independent auth → no impact (verify healthy)

---

## 3. File Change List (변경 파일 목록)

| Category | File | Change | Phase |
|----------|------|--------|-------|
| Backend | `apps/platform/backend/package.json` | Modify — add `@nestjs/axios` | 1.1 |
| Backend | `apps/platform/backend/src/auth/entity/oauth-session.entity.ts` | **New** | 1.2 |
| Backend | `apps/platform/backend/src/auth/dto/oauth-callback.request.ts` | **New** | 1.3 |
| Backend | `apps/platform/backend/src/auth/dto/oauth-refresh.request.ts` | **New** | 1.3 |
| Backend | `apps/platform/backend/src/auth/dto/oauth-token.response.ts` | **New** | 1.3 |
| Backend | `apps/platform/backend/src/auth/oauth.service.ts` | **New** | 1.4 |
| Backend | `apps/platform/backend/src/auth/auth.controller.ts` | Modify — add OAuth endpoints | 1.5 |
| Backend | `apps/platform/backend/src/auth/auth.module.ts` | Modify — register OAuthService, HttpModule, Entity | 1.6 |
| DB | `apps/platform/backend/scripts/init-db.sql` | Modify — add `plt_oauth_sessions` DDL | 1.7 |
| Config | `apps/platform/.env.staging.example` | Modify — add 4 OAuth env vars | 1.8 |
| Frontend | `apps/platform/frontend/src/stores/auth.store.ts` | Modify — add refreshToken | 2.1 |
| Frontend | `apps/platform/frontend/src/pages/OAuthCallbackPage.tsx` | **New** | 2.2 |
| Frontend | `apps/platform/frontend/src/pages/AppsLoginPage.tsx` | Modify — add OAuth button | 2.3 |
| Frontend | `apps/platform/frontend/src/pages/admin/AdminLoginPage.tsx` | Modify — use OAuth flow | 2.4 |
| Frontend | `apps/platform/frontend/src/lib/api-client.ts` | Modify — silent refresh | 2.5 |
| Frontend | `apps/platform/frontend/src/App.tsx` | Modify — add `/callback` route | 2.6 |
| i18n | `apps/platform/frontend/src/i18n/locales/ko/platform.json` | Modify | 3.1 |
| i18n | `apps/platform/frontend/src/i18n/locales/en/platform.json` | Modify | 3.1 |
| i18n | `apps/platform/frontend/src/i18n/locales/vi/platform.json` | Modify | 3.1 |

**Total**: 6 new files + 13 modified files = **19 files**

---

## 4. Side Impact Analysis (사이드 임팩트 분석)

| Impact Area | Risk Level | Description |
|-------------|-----------|-------------|
| Platform Login UX | **Medium** | Login flow changes from form → OAuth redirect. Users will be redirected to AMA for login. Dev fallback form keeps local testing possible. |
| Partner Apps (car-manager) | **Low** | JWT structure unchanged. Same `ama_token` localStorage key. Same `JWT_SECRET` verification. No code changes needed. |
| Partner Apps (stock-management) | **None** | Independent auth system. Uses separate `asm_token`. Not affected. |
| Admin Console | **Medium** | Admin login changes to OAuth. ADMIN role verified after OAuth callback. Dev token input remains for dev mode. |
| API Interceptor | **Medium** | 401 handling changes from "clear + redirect" to "refresh + retry". More resilient but adds complexity. Concurrent request queueing needed. |
| AMA Server Dependency | **High** | OAuth flow requires AMA OAuth server to be available. If AMA is down, users cannot login. Mitigation: Dev fallback form for local development. |
| Database | **Low** | New `plt_oauth_sessions` table. No schema changes to existing tables. No data migration needed. |
| Docker/Nginx | **None** | No Nginx changes needed (SPA catch-all handles `/callback`). Docker network must allow outbound HTTPS to AMA. |
| Environment Config | **Low** | 4 new env vars needed on staging. Deployment requires `.env` update before first deployment. |

---

## 5. DB Migration (DB 마이그레이션)

### 5.1 New Table: `plt_oauth_sessions`

```sql
-- ============================================================
-- OAuth Session Management Table
-- Run on: db_app_platform
-- ============================================================

CREATE TABLE IF NOT EXISTS plt_oauth_sessions (
  oas_id                  CHAR(36)      NOT NULL PRIMARY KEY,
  ent_id                  CHAR(36)      NOT NULL,
  oas_user_id             CHAR(36)      NOT NULL,
  oas_email               VARCHAR(200)  NOT NULL,
  oas_ama_access_token    TEXT          NOT NULL,
  oas_ama_refresh_token   TEXT          NULL,
  oas_ama_token_expires   DATETIME      NOT NULL,
  oas_app_refresh_token   VARCHAR(500)  NOT NULL,
  oas_app_token_expires   DATETIME      NOT NULL,
  oas_scopes              VARCHAR(500)  NULL,
  oas_is_active           BOOLEAN       NOT NULL DEFAULT TRUE,
  oas_created_at          DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  oas_updated_at          DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  INDEX idx_plt_oauth_sessions_user (oas_user_id, oas_is_active),
  INDEX idx_plt_oauth_sessions_ent (ent_id, oas_is_active),
  INDEX idx_plt_oauth_sessions_refresh (oas_app_refresh_token(255))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

### 5.2 Migration Instructions (마이그레이션 지침)

| Environment | Method | Note |
|-------------|--------|------|
| Development | `synchronize: true` — automatic | TypeORM auto-creates table |
| Staging | Manual SQL via `docker exec mysql-apps mysql -u root -p db_app_platform < migration.sql` | Or update init-db.sql + recreate MySQL volume |
| Production | Manual SQL execution via admin tool | Must be executed before deploying new code |

### 5.3 Rollback SQL (롤백)

```sql
DROP TABLE IF EXISTS plt_oauth_sessions;
```

---

## Appendix A: Environment Variable Reference (환경 변수 참조)

### Backend (.env)

```bash
# Existing
JWT_SECRET=your-ama-jwt-secret-key

# New — OAuth 2.0
AMA_OAUTH_BASE_URL=https://stg-ama.amoeba.site      # AMA API base URL
AMA_OAUTH_CLIENT_ID=appstore-staging-client-id        # OAuth client ID (registered in AMA)
AMA_OAUTH_CLIENT_SECRET=appstore-staging-secret        # OAuth client secret (server-side only)
AMA_OAUTH_REDIRECT_URI=https://stg-apps.amoeba.site/callback  # OAuth callback URL
```

### Frontend (.env)

```bash
# Existing
VITE_API_BASE_URL=/api

# Removed
# VITE_AMA_LOGIN_URL — No longer needed (backend generates authorize URL)

# New (optional — for direct frontend redirect without backend call)
# VITE_AMA_OAUTH_CLIENT_ID=appstore-staging-client-id
# VITE_AMA_OAUTH_AUTHORIZE_URL=https://stg-ama.amoeba.site/api/v1/oauth/authorize
```

---

## Appendix B: API Reference (API 명세)

### GET `/api/v1/auth/oauth/authorize`

Generate AMA OAuth authorization URL. (OAuth 인증 URL 생성)

**Auth**: Public

**Query Params**:
| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `redirect` | string | No | Path to redirect after login (stored with state) |

**Response**:
```json
{
  "success": true,
  "data": {
    "authorizeUrl": "https://stg-ama.amoeba.site/api/v1/oauth/authorize?client_id=XXX&redirect_uri=...&response_type=code&scope=profile+entity:read+offline_access&state=random-uuid",
    "state": "random-uuid"
  },
  "timestamp": "2026-03-29T..."
}
```

---

### POST `/api/v1/auth/oauth/token`

Exchange authorization code for tokens. (인가 코드를 토큰으로 교환)

**Auth**: Public

**Request Body** (snake_case):
```json
{
  "code": "authorization-code-from-ama",
  "state": "random-uuid-from-authorize",
  "redirect_uri": "https://stg-apps.amoeba.site/callback"
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "token": "eyJhbG...(app-local JWT)",
    "refreshToken": "random-refresh-token-uuid",
    "expiresIn": 3600,
    "user": {
      "userId": "ama-user-uuid",
      "entityId": "ama-entity-uuid",
      "entityCode": "AMB-KR",
      "email": "user@example.com",
      "name": "John Doe",
      "roles": ["USER"]
    }
  },
  "timestamp": "2026-03-29T..."
}
```

**Errors**:
| Code | Message | Cause |
|------|---------|-------|
| `PLT-E1010` | Invalid or expired authorization code | AMA rejected code exchange |
| `PLT-E1011` | State mismatch — possible CSRF | state param doesn't match |
| `PLT-E1012` | AMA OAuth server error | AMA API unreachable or 5xx |

---

### POST `/api/v1/auth/oauth/refresh`

Refresh app-local JWT using refresh token. (토큰 갱신)

**Auth**: Public (인증은 refresh_token으로)

**Request Body**:
```json
{
  "refresh_token": "existing-refresh-token-uuid"
}
```

**Response**: Same as `/oauth/token` response

**Errors**:
| Code | Message | Cause |
|------|---------|-------|
| `PLT-E1013` | Invalid or expired refresh token | Session not found or expired |
| `PLT-E1014` | AMA refresh token expired | Must re-authenticate via OAuth |

---

### POST `/api/v1/auth/oauth/revoke`

Revoke current session tokens. (세션 토큰 무효화)

**Auth**: `@Auth()` (Bearer token required)

**Response**:
```json
{
  "success": true,
  "data": { "message": "Session revoked successfully" },
  "timestamp": "2026-03-29T..."
}
```

---

### GET `/api/v1/auth/me`

Get current authenticated user info. (현재 사용자 정보 조회)

**Auth**: `@Auth()` (Bearer token required)

**Response**:
```json
{
  "success": true,
  "data": {
    "userId": "ama-user-uuid",
    "entityId": "ama-entity-uuid",
    "entityCode": "AMB-KR",
    "email": "user@example.com",
    "name": "John Doe",
    "roles": ["USER"]
  },
  "timestamp": "2026-03-29T..."
}
```
