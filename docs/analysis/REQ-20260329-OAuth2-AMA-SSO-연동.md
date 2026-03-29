# OAuth 2.0 AMA SSO Integration — Requirements Analysis (OAuth 2.0 AMA SSO 연동 요구사항 분석서)

---
document_id: PLT-REQ-20260329-OAUTH-SSO
version: 1.0.0
status: Draft
created: 2026-03-29
updated: 2026-03-29
author: Copilot
app: platform (+ all partner apps)
---

## 1. Requirements Summary (요구사항 요약)

| # | Requirement (요구사항) | Type (유형) |
|---|----------------------|-------------|
| FR-001 | Replace direct login form (`/apps/login`) with OAuth 2.0 Authorization Code Flow via AMA | Functional |
| FR-002 | Implement `/callback` route on platform frontend to receive OAuth authorization code | Functional |
| FR-003 | Implement backend OAuth token exchange endpoint (`POST /api/v1/auth/oauth/token`) | Functional |
| FR-004 | Implement backend userinfo proxy endpoint (`GET /api/v1/auth/oauth/userinfo`) | Functional |
| FR-005 | Implement OAuth token refresh flow (`POST /api/v1/auth/oauth/refresh`) | Functional |
| FR-006 | Implement logout with AMA token revocation (`POST /api/v1/auth/oauth/revoke`) | Functional |
| FR-007 | Store OAuth tokens (access_token, refresh_token) in platform backend and issue app-local JWT | Functional |
| FR-008 | All partner apps (car-manager, stock-management, future apps) share the platform OAuth session via `ama_token` in localStorage | Functional |
| FR-009 | Admin login page also supports AMA OAuth flow (not just dev token input) | Functional |
| FR-010 | Handle 401 from API by attempting silent refresh, fallback to AMA OAuth re-login | Functional |
| NFR-001 | OAuth client_secret stored server-side only — never exposed to frontend | Non-Functional |
| NFR-002 | CSRF protection via `state` param with random nonce | Non-Functional |
| NFR-003 | Token refresh (access_token 1h, refresh_token 30d) transparent to user | Non-Functional |
| NFR-004 | Backward-compatible: existing JWT guards continue to work with app-local JWT | Non-Functional |

---

## 2. AS-IS Current State Analysis (AS-IS 현황 분석)

### 2.1 Platform Backend Auth (플랫폼 백엔드 인증)

**File Path**: `apps/platform/backend/src/auth/`

| File | Description |
|------|-------------|
| `auth.module.ts` | PassportModule + JwtModule (secret: `JWT_SECRET` env, 24h expiry) |
| `auth.controller.ts` | `POST /api/v1/auth/login` — static password `amoeba1!` verification, returns self-signed JWT |
| `jwt.strategy.ts` | Extract Bearer token, verify with `JWT_SECRET` |
| `guards/jwt-auth.guard.ts` | Passport JWT guard with `@Public()` bypass |
| `guards/role.guard.ts` | `ADMIN` role check via `@AdminOnly()` decorator |
| `decorators/auth.decorator.ts` | `@Auth()` = JwtAuthGuard + RoleGuard |
| `decorators/current-user.decorator.ts` | Extract `AmaJwtPayload` from `request.user` |
| `interfaces/ama-jwt-payload.interface.ts` | `{ userId, entityId, entityCode, email, name, roles, iat, exp }` |

**Problem (문제점)**:
- `auth.controller.ts` uses **hardcoded static password** (`amoeba1!`) — no real authentication
- **Self-signs JWT** with internal `JWT_SECRET` — not verified against AMA
- Login form collects `ent_id`, `email`, `password` directly — **no SSO integration**
- No `access_token` / `refresh_token` concept — single 24h JWT only

### 2.2 Platform Frontend Auth (플랫폼 프론트엔드 인증)

| File | Description |
|------|-------------|
| `pages/AppsLoginPage.tsx` | Direct login form (ent_id + email + password) → `POST /api/v1/auth/login` |
| `pages/admin/AdminLoginPage.tsx` | AMA SSO button → `VITE_AMA_LOGIN_URL` redirect + dev token input (Dev mode only) |
| `stores/auth.store.ts` | Zustand store: `ama_token` in localStorage, base64 JWT decode for user info |
| `lib/api-client.ts` | Axios interceptor: attach `Bearer ama_token`, on 401 → clear token |
| `App.tsx` | Routes: `/apps/login` → AppsLoginPage, `/admin/login` → AdminLoginPage |
| `components/admin/AdminGuard.tsx` | Check `isAuthenticated && isAdmin` for admin routes |

**Problem (문제점)**:
- `AppsLoginPage.tsx` is a **direct email/password login form** — no OAuth
- No `/callback` route exists for OAuth redirect handling
- `AdminLoginPage.tsx` has AMA SSO button but only redirects to `VITE_AMA_LOGIN_URL` (plain login page, not OAuth authorize endpoint)
- No `state` parameter for CSRF protection
- No token refresh mechanism — 401 just clears token

### 2.3 Partner App Auth — Car Manager (차량관리 앱 인증)

| File | Description |
|------|-------------|
| `backend/src/auth/` | Same JWT strategy pattern, reads `ama_token` Bearer header |
| `frontend/src/stores/auth.store.ts` | Reads `ama_token` from localStorage, no login page |
| `frontend/src/lib/api-client.ts` | On 401 → redirect to `VITE_AMA_LOGIN_URL` |

**Pattern**: Car manager assumes token is already set by platform — **no independent login flow**.

### 2.4 Partner App Auth — Stock Management (재고관리 앱 인증)

| File | Description |
|------|-------------|
| `backend/src/auth/auth.service.ts` | Own user DB, bcrypt passwords, `ama-sso` endpoint for token exchange |
| `backend/src/auth/auth.controller.ts` | `/auth/login` (direct), `/auth/ama-sso` (AMA token exchange) |
| `frontend/src/stores/auth.store.ts` | Separate `asm_token` + `asm_refresh_token` in localStorage |
| `frontend/src/pages/auth/LoginPage.tsx` | Direct login with entity_code + email + password |

**Pattern**: Stock management has its **own independent auth** with separate user DB — different from platform/car-manager.

### 2.5 Environment Variables (환경 변수)

| Variable | File | Current Value |
|----------|------|--------------|
| `JWT_SECRET` | All backend `.env` | Shared secret for JWT signing/verification |
| `VITE_AMA_LOGIN_URL` | All frontend `.env` | `https://ama.amoeba.site/login` (plain login redirect, not OAuth) |
| `VITE_API_BASE_URL` | All frontend `.env` | `/api` or `/{slug}/api` |

**Missing (미존재)**:
- `AMA_OAUTH_CLIENT_ID` — OAuth client ID
- `AMA_OAUTH_CLIENT_SECRET` — OAuth client secret
- `AMA_OAUTH_BASE_URL` — AMA OAuth base URL (`https://ama.amoeba.site`)
- `AMA_OAUTH_REDIRECT_URI` — Callback URL (`https://apps.amoeba.site/callback`)
- `VITE_AMA_OAUTH_CLIENT_ID` — Frontend needs client_id for authorize URL construction
- `VITE_AMA_OAUTH_AUTHORIZE_URL` — Frontend OAuth authorize endpoint

### 2.6 DB Schema (데이터베이스)

**Current**: No OAuth-related tables exist in `db_app_platform`.

**Relevant existing tables**:
- `plt_apps` — App master (has `app_slug`)
- `plt_subscriptions` — Entity subscription (has `ent_id`, `sub_status`)

### 2.7 Nginx / Routing (Nginx 라우팅)

**File**: `platform/nginx/apps.amoeba.site.conf`

- `/` → Platform SPA (handles all SPA routes: `/apps/login`, `/apps/:slug`, `/admin/*`)
- `/api/` → Platform BFF (NestJS :3100)
- No explicit `/callback` route — handled by SPA catch-all at `/`

---

## 3. TO-BE Requirements (TO-BE 요구사항)

### 3.1 AS-IS → TO-BE Mapping (변경 매핑)

| # | Area | AS-IS | TO-BE |
|---|------|-------|-------|
| 1 | Login Flow | Direct password form → self-signed JWT | OAuth 2.0 Authorization Code Flow → AMA-issued tokens |
| 2 | Login Page | `/apps/login` — 3-field form (ent_id, email, password) | `/apps/login` — "AMA 계정으로 로그인" button → redirect to AMA OAuth authorize |
| 3 | Callback | None | `/callback?code=XXX&state=YYY` → exchange code → store tokens → redirect |
| 4 | Token Storage (Frontend) | `ama_token` single JWT in localStorage | `ama_token` (app-local JWT from platform BFF) in localStorage |
| 5 | Token Exchange (Backend) | `POST /auth/login` static password | `POST /auth/oauth/token` → exchange auth code with AMA → issue app-local JWT |
| 6 | Token Refresh | None (24h expiry, then re-login) | Silent refresh via platform BFF using AMA refresh_token |
| 7 | User Info | Base64 decode of self-signed JWT | AMA `/oauth/userinfo` verified data → embedded in app-local JWT |
| 8 | Logout | Clear localStorage only | Revoke AMA token + clear localStorage |
| 9 | Admin Login | Dev token input + AMA redirect | OAuth flow (same as user login, with ADMIN role check) |
| 10 | Partner Apps | Car-manager reads `ama_token`, Stock has own auth | All apps read `ama_token` set by platform OAuth |
| 11 | Backend JWT Verification | Verify self-signed JWT | Verify platform-issued JWT (same `JWT_SECRET`) |
| 12 | Auth Controller | Static password auth | OAuth code exchange + token management |
| 13 | DB | No OAuth tables | `plt_oauth_sessions` for refresh token storage |

### 3.2 New Entities / Tables (신규 엔티티)

#### `plt_oauth_sessions` — OAuth Session Management

```sql
CREATE TABLE IF NOT EXISTS plt_oauth_sessions (
  oas_id              CHAR(36)      NOT NULL PRIMARY KEY,
  ent_id              CHAR(36)      NOT NULL,
  oas_user_id         CHAR(36)      NOT NULL,       -- AMA user ID
  oas_email           VARCHAR(200)  NOT NULL,
  oas_ama_access_token  TEXT        NOT NULL,        -- AMA access_token (encrypted)
  oas_ama_refresh_token TEXT        NULL,            -- AMA refresh_token (encrypted)
  oas_ama_token_expires DATETIME    NOT NULL,        -- AMA access_token expiry
  oas_app_refresh_token VARCHAR(500) NOT NULL,       -- App-local refresh token (hashed)
  oas_app_token_expires DATETIME    NOT NULL,        -- App-local refresh_token expiry
  oas_scopes          VARCHAR(500)  NULL,            -- Granted scopes
  oas_is_active       BOOLEAN       NOT NULL DEFAULT TRUE,
  oas_created_at      DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  oas_updated_at      DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  INDEX idx_plt_oauth_sessions_user (oas_user_id, oas_is_active),
  INDEX idx_plt_oauth_sessions_ent (ent_id, oas_is_active),
  INDEX idx_plt_oauth_sessions_refresh (oas_app_refresh_token(255))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

### 3.3 New API Endpoints (신규 API)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/api/v1/auth/oauth/authorize` | Public | Generate AMA OAuth authorize URL (with state param) |
| `POST` | `/api/v1/auth/oauth/token` | Public | Exchange authorization code → AMA tokens → issue app-local JWT |
| `POST` | `/api/v1/auth/oauth/refresh` | Public (with refresh_token) | Refresh app-local JWT using stored AMA refresh_token |
| `POST` | `/api/v1/auth/oauth/revoke` | Auth | Revoke AMA tokens + invalidate session |
| `GET` | `/api/v1/auth/me` | Auth | Get current user info from JWT |

### 3.4 New Frontend Pages / Components (신규 프론트엔드)

| Component | Route | Description |
|-----------|-------|-------------|
| `OAuthLoginPage.tsx` | `/apps/login` | Replaces `AppsLoginPage.tsx` — "AMA 계정으로 로그인" button |
| `OAuthCallbackPage.tsx` | `/callback` | Receives auth code from AMA redirect, exchanges for tokens |
| `AdminLoginPage.tsx` (modified) | `/admin/login` | Reuse same OAuth flow (remove dev-only token input in production) |

### 3.5 Business Logic (비즈니스 로직)

#### OAuth 2.0 Authorization Code Flow — Sequence

```
┌─────────┐     ┌──────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│ Browser  │     │ Platform SPA     │     │ Platform BFF     │     │ AMA OAuth Server│
│          │     │ (React)          │     │ (NestJS :3100)   │     │ (ama.amoeba.site)│
└────┬─────┘     └───────┬──────────┘     └───────┬──────────┘     └────────┬─────────┘
     │                   │                        │                         │
     │ 1. Click "Login"  │                        │                         │
     │ ────────────────> │                        │                         │
     │                   │ 2. GET /auth/oauth/    │                         │
     │                   │    authorize           │                         │
     │                   │ ─────────────────────> │                         │
     │                   │                        │ 3. Generate state       │
     │                   │   { authorizeUrl }     │    (store in session)   │
     │                   │ <───────────────────── │                         │
     │ 4. Redirect to    │                        │                         │
     │ AMA /oauth/authorize                       │                         │
     │ ─────────────────────────────────────────────────────────────────>   │
     │                   │                        │                         │
     │                   │                        │   5. User logs in       │
     │                   │                        │      + consents         │
     │                   │                        │                         │
     │ 6. Redirect to /callback?code=XXX&state=YYY                         │
     │ <────────────────────────────────────────────────────────────────────│
     │                   │                        │                         │
     │ ────────────────> │                        │                         │
     │                   │ 7. POST /auth/oauth/   │                         │
     │                   │    token {code, state} │                         │
     │                   │ ─────────────────────> │                         │
     │                   │                        │ 8. POST AMA /oauth/token│
     │                   │                        │ ─────────────────────>  │
     │                   │                        │   {access_token,        │
     │                   │                        │    refresh_token}       │
     │                   │                        │ <─────────────────────  │
     │                   │                        │                         │
     │                   │                        │ 9. GET AMA /oauth/      │
     │                   │                        │    userinfo             │
     │                   │                        │ ─────────────────────>  │
     │                   │                        │   {userId, entityId,    │
     │                   │                        │    scopes}              │
     │                   │                        │ <─────────────────────  │
     │                   │                        │                         │
     │                   │                        │ 10. Store AMA tokens    │
     │                   │                        │     in plt_oauth_sessions│
     │                   │                        │ 11. Issue app-local JWT │
     │                   │   { token, user }      │     (sign with JWT_SECRET)│
     │                   │ <───────────────────── │                         │
     │                   │                        │                         │
     │                   │ 12. Store ama_token    │                         │
     │                   │     in localStorage    │                         │
     │ 13. Redirect to / │                        │                         │
     │ <──────────────── │                        │                         │
```

#### Token Refresh Flow (토큰 갱신 플로우)

```
Browser API call → 401 Unauthorized
    ↓
Frontend interceptor catches 401
    ↓
POST /api/v1/auth/oauth/refresh { refresh_token }
    ↓
Platform BFF:
    → Find active session by refresh_token
    → POST AMA /oauth/token { grant_type: refresh_token }
    → Gets new AMA access_token (+ possibly new refresh_token)
    → Update plt_oauth_sessions
    → Issue new app-local JWT
    ↓
Frontend stores new ama_token → Retry original request
```

### 3.6 UI Design (UI 설계)

#### Login Page (`/apps/login`) — TO-BE

```
┌─────────────────────────────────────┐
│         ┌─────────────────┐         │
│         │  AMA App Store  │         │
│         │      Logo       │         │
│         └─────────────────┘         │
│                                     │
│    ┌─────────────────────────────┐  │
│    │                             │  │
│    │  ┌─────────────────────┐    │  │
│    │  │  🔐  AMA 계정으로    │    │  │
│    │  │      로그인          │    │  │
│    │  └─────────────────────┘    │  │
│    │                             │  │
│    │  AMA 계정으로 로그인하여    │  │
│    │  앱 스토어를 이용하세요     │  │
│    │                             │  │
│    │  ─── 또는 (Dev Only) ───   │  │
│    │                             │  │
│    │  [Entity ID          ]     │  │
│    │  [Email              ]     │  │
│    │  [Password           ]     │  │
│    │  [      로그인       ]     │  │
│    │                             │  │
│    └─────────────────────────────┘  │
│                                     │
└─────────────────────────────────────┘
```

- Production: OAuth button only (개발 모드 폼 비노출)
- Development: OAuth button + fallback form for local testing

---

## 4. Gap Analysis (갭 분석)

### 4.1 Change Scope Summary (변경 범위 요약)

| Area | Current | Change | Impact |
|------|---------|--------|--------|
| Platform Backend Auth | Static password login | OAuth 2.0 code exchange + token management | **High** — Core auth rewrite |
| Platform Frontend Login | Direct form | OAuth redirect + callback handler | **High** — New UX flow |
| Platform Frontend Auth Store | Single JWT, no refresh | JWT + refresh token, silent refresh | **Medium** — Store extension |
| Platform Frontend API Client | Clear token on 401 | Refresh token interceptor | **Medium** — Interceptor rewrite |
| Platform DB | No OAuth tables | `plt_oauth_sessions` | **Low** — New table only |
| Platform Backend .env | `JWT_SECRET`, `VITE_AMA_LOGIN_URL` | + 4 new OAuth env vars | **Low** — Config addition |
| Car Manager Frontend | Reads `ama_token` | No change needed (same token key) | **None** |
| Car Manager Backend | Verify JWT with `JWT_SECRET` | No change needed (same JWT_SECRET) | **None** |
| Stock Management | Own auth system | Optional: accept platform `ama_token` alongside `asm_token` | **Low** — Future enhancement |
| Nginx | No `/callback` route needed | No change (SPA catch-all handles it) | **None** |
| Admin Login | Dev token input | Reuse OAuth flow + role check | **Medium** — Refactor |

### 4.2 File Change List (변경 파일 목록)

| Category | File | Change Type |
|----------|------|-------------|
| **Backend** | `apps/platform/backend/src/auth/auth.module.ts` | Modify — add OAuth service, HttpModule |
| **Backend** | `apps/platform/backend/src/auth/auth.controller.ts` | Modify — replace login with OAuth endpoints |
| **Backend** | `apps/platform/backend/src/auth/oauth.service.ts` | **New** — OAuth token exchange, refresh, revoke |
| **Backend** | `apps/platform/backend/src/auth/entity/oauth-session.entity.ts` | **New** — `plt_oauth_sessions` TypeORM entity |
| **Backend** | `apps/platform/backend/src/auth/dto/oauth-token.request.ts` | **New** — OAuth token exchange request DTO |
| **Backend** | `apps/platform/backend/src/auth/dto/oauth-authorize.response.ts` | **New** — OAuth authorize URL response DTO |
| **Backend** | `apps/platform/backend/package.json` | Modify — add `@nestjs/axios` / `axios` for HTTP calls |
| **Frontend** | `apps/platform/frontend/src/pages/AppsLoginPage.tsx` | Modify — add OAuth button, keep dev fallback form |
| **Frontend** | `apps/platform/frontend/src/pages/OAuthCallbackPage.tsx` | **New** — `/callback` code exchange handler |
| **Frontend** | `apps/platform/frontend/src/pages/admin/AdminLoginPage.tsx` | Modify — use OAuth flow for admin auth |
| **Frontend** | `apps/platform/frontend/src/stores/auth.store.ts` | Modify — add refresh_token support |
| **Frontend** | `apps/platform/frontend/src/lib/api-client.ts` | Modify — add silent refresh interceptor |
| **Frontend** | `apps/platform/frontend/src/App.tsx` | Modify — add `/callback` route |
| **i18n** | `apps/platform/frontend/src/i18n/locales/ko/platform.json` | Modify — add oauth login keys |
| **i18n** | `apps/platform/frontend/src/i18n/locales/en/platform.json` | Modify — add oauth login keys |
| **i18n** | `apps/platform/frontend/src/i18n/locales/vi/platform.json` | Modify — add oauth login keys |
| **DB** | `apps/platform/backend/scripts/init-db.sql` | Modify — add `plt_oauth_sessions` table |
| **Config** | `apps/platform/.env.staging.example` | Modify — add OAuth env vars |

### 4.3 DB Migration Strategy (DB 마이그레이션 전략)

- **Development**: `synchronize: true` — TypeORM auto-creates `plt_oauth_sessions`
- **Staging**: Manual SQL execution via `init-db.sql` update + Docker MySQL restart
- **Production**: Manual SQL migration script (no auto-sync)
- **No existing data loss**: New table only, no schema changes to existing tables

---

## 5. User Flow (사용자 플로우)

### 5.1 Normal Login Flow (일반 로그인)

```
Step 1: User visits apps.amoeba.site
         └─ LandingPage renders (public, no auth required)

Step 2: User clicks "앱 신청하기" or navigates to protected page
         └─ Redirect to /apps/login?redirect=/apps/car-manager

Step 3: Login page renders
         └─ Shows "AMA 계정으로 로그인" button
         └─ [Dev only] Shows fallback login form

Step 4: User clicks "AMA 계정으로 로그인"
         └─ Frontend calls GET /api/v1/auth/oauth/authorize
         └─ Backend generates { authorizeUrl, state }
              - state = crypto random UUID
              - URL = {AMA_BASE}/api/v1/oauth/authorize
                ?client_id={CLIENT_ID}
                &redirect_uri=https://apps.amoeba.site/callback
                &response_type=code
                &scope=profile entity:read offline_access
                &state={state}
         └─ Frontend redirects browser to authorizeUrl

Step 5: User is on AMA login page (ama.amoeba.site)
         └─ Enters AMA credentials
         └─ AMA validates → consent screen (if first time)
         └─ User approves

Step 6: AMA redirects to apps.amoeba.site/callback?code=XXX&state=YYY
         └─ OAuthCallbackPage.tsx renders

Step 7: Frontend extracts code + state from URL
         └─ POST /api/v1/auth/oauth/token { code, state, redirect_uri }

Step 8: Backend processes token exchange
         └─ Verify state matches (CSRF check)
         └─ POST AMA /api/v1/oauth/token
              { grant_type: authorization_code, code, client_id, client_secret, redirect_uri }
         └─ Receives { access_token (1h), refresh_token (30d) }
         └─ GET AMA /api/v1/oauth/userinfo (Bearer access_token)
              → { userId, entityId, email, name, scopes }
         └─ Create/update plt_oauth_sessions
         └─ Sign app-local JWT (payload: userId, entityId, entityCode, email, name, roles)
         └─ Return { token: app_local_jwt, refresh_token: app_refresh_token, user: {...} }

Step 9: Frontend stores tokens
         └─ auth.store.setAuth(token, refreshToken, user)
         └─ localStorage: ama_token = app_local_jwt, ama_refresh_token = app_refresh_token
         └─ Redirect to original URL (from /apps/login?redirect=...)

Step 10: User accesses partner app (e.g., /app-car-manager)
          └─ Car manager reads ama_token from localStorage
          └─ API calls include Bearer ama_token
          └─ Car manager backend verifies JWT with same JWT_SECRET
          └─ ✅ Access granted
```

### 5.2 Token Refresh Flow (토큰 갱신)

```
Step 1: API call returns 401 (token expired)
         └─ Axios response interceptor catches 401

Step 2: Check if refresh_token exists
         ├─ Yes → POST /api/v1/auth/oauth/refresh { refresh_token }
         └─ No → Redirect to /apps/login

Step 3: Backend refresh
         └─ Find plt_oauth_sessions by app_refresh_token
         └─ POST AMA /api/v1/oauth/token { grant_type: refresh_token, ... }
         └─ Update session, issue new app-local JWT
         └─ Return { token, refresh_token, user }

Step 4: Frontend retries original request with new token
         └─ ✅ Transparent to user
```

### 5.3 Logout Flow (로그아웃)

```
Step 1: User clicks "로그아웃"
         └─ POST /api/v1/auth/oauth/revoke (Bearer ama_token)

Step 2: Backend
         └─ POST AMA /api/v1/oauth/revoke { token: ama_access_token }
         └─ Set plt_oauth_sessions.oas_is_active = false

Step 3: Frontend
         └─ Clear localStorage (ama_token, ama_refresh_token)
         └─ Redirect to /apps/login or landing page
```

### 5.4 Error Scenarios (에러 시나리오)

| Scenario | Handling |
|----------|----------|
| User denies consent at AMA | AMA redirects with `error=access_denied` → show error on login page |
| Invalid/expired auth code | Backend returns error → show "인증 실패" on callback page |
| State mismatch (CSRF) | Backend rejects → show error on callback page |
| AMA server unreachable | Backend returns 502 → show "AMA 서버 연결 실패" |
| Refresh token expired | Backend returns 401 → redirect to /apps/login for re-authentication |
| Client_id/secret invalid | Backend returns error → log error, show generic "인증 실패" |

---

## 6. Technical Constraints (기술 제약사항)

### 6.1 Compatibility (호환성)

| Constraint | Description |
|-----------|-------------|
| AMA OAuth Server | Must be available at `{stg-}ama.amoeba.site/api/v1/oauth/*` — **external dependency** |
| OAuth Client Registration | `client_id` + `client_secret` must be pre-registered in AMA OAuth server |
| JWT_SECRET | Must remain same across platform + all partner apps for shared JWT verification |
| localStorage Key | Must keep `ama_token` key for backward compatibility with car-manager |
| Browser CORS | AMA OAuth authorize is a browser redirect (not AJAX) — no CORS issues |
| Backend-to-AMA HTTP | Platform BFF must be able to reach AMA API from Docker network |

### 6.2 Security (보안)

| Concern | Mitigation |
|---------|-----------|
| client_secret exposure | **Server-side only** — never sent to frontend |
| CSRF on OAuth callback | `state` parameter with server-verified random nonce |
| Token storage | AMA tokens encrypted at rest in DB (AES-256-GCM recommended) |
| XSS on localStorage | CSP headers, HttpOnly not applicable for SPA localStorage — standard risk |
| Refresh token leak | Hash refresh tokens in DB, rotate on use |
| Open redirect | `redirect_uri` must whitelist `apps.amoeba.site/callback` on AMA server |

### 6.3 Performance (성능)

| Concern | Mitigation |
|---------|-----------|
| OAuth flow latency | Additional redirect + backend HTTP calls (~300-500ms for token exchange) |
| Token refresh blocking | Queue concurrent 401s, refresh once, retry all |
| AMA API availability | Timeout (5s), retry once, graceful fallback |

### 6.4 Environment-Specific Configuration (환경별 설정)

| Variable | Staging | Production |
|----------|---------|-----------|
| `AMA_OAUTH_BASE_URL` | `https://stg-ama.amoeba.site` | `https://ama.amoeba.site` |
| `AMA_OAUTH_CLIENT_ID` | staging client ID (TBD) | production client ID (TBD) |
| `AMA_OAUTH_CLIENT_SECRET` | staging secret (TBD) | production secret (TBD) |
| `AMA_OAUTH_REDIRECT_URI` | `https://stg-apps.amoeba.site/callback` | `https://apps.amoeba.site/callback` |
| `VITE_AMA_OAUTH_AUTHORIZE_URL` | `https://stg-ama.amoeba.site/api/v1/oauth/authorize` | `https://ama.amoeba.site/api/v1/oauth/authorize` |
| `VITE_AMA_OAUTH_CLIENT_ID` | staging client ID | production client ID |
