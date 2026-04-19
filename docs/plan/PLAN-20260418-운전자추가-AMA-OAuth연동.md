# 운전자 추가 — AMA OAuth 2.0 Open API 연동 작업계획서

**문서 ID**: PLAN-20260418-운전자추가-AMA-OAuth연동
**작성일**: 2026-04-18
**작성자**: Gray Kim
**참조**: REQ-20260418-운전자추가-AMA멤버검색

---

## 1. 시스템 개발 현황 분석

### 1.1 403 원인 분석

| 구분 | 엔드포인트 | 인증 방식 | 가드 |
|------|-----------|----------|------|
| 내부 API (현재 호출) | `GET /api/v1/members` | JWT (쿠키/Bearer) | EntityGuard + RolesGuard(`@Roles('MEMBER')`) |
| **외부 앱용 Open API** | `GET /api/v1/open/users` | **OAuth Bearer Token** | OAuthTokenGuard + RequireScopeGuard(`@RequireScope('users:read')`) |

Car-Manager는 외부 앱이므로 AMA JWT 세션이 없어 EntityGuard에서 403 반환.
→ **`/api/v1/open/users`** (OAuth) 사용으로 변경 필요.

### 1.2 AMA OAuth 인프라 (이미 구현 완료)

| 구성 요소 | 상태 | 설명 |
|----------|------|------|
| OAuth 2.0 Auth Code + PKCE | ✅ | `oauth.service.ts` |
| `GET /api/v1/open/users` | ✅ | `open-user.controller.ts` (scope: `users:read`) |
| Partner App 등록 | ✅ | `partner-app.entity.ts` (`pap_scopes`) |
| Token 관리 | ✅ | Access Token(1h) + Refresh Token(30d) (`oauth-token.entity.ts`) |

### 1.3 현재 Car-Manager AMA 모듈 (수정 대상)

```
backend/src/domain/ama/
├── ama.module.ts              # 수정
├── controller/ama.controller.ts  # 수정 (OAuth 엔드포인트 추가)
└── service/ama.service.ts     # 전면 재작성 (OAuth flow + /open/users)
```

### 1.4 제약사항

- AMA Partner App 등록 필요 → `client_id`, `client_secret` 발급 (AMA 관리자 작업)
- OAuth redirect_uri → Car-Manager 프론트엔드 콜백 URL 필요
- OAuth 토큰 저장: 서버 측 메모리/DB or 프론트엔드 localStorage

---

## 2. 단계별 구현 계획

### Phase 1: 환경변수 + 설정

**Step 1-1: AMA OAuth 환경변수 추가**

`.env.staging.example` 및 스테이징 `.env`에 추가:
```env
# AMA OAuth 2.0
AMA_OAUTH_CLIENT_ID=car-manager-client-id
AMA_OAUTH_CLIENT_SECRET=car-manager-client-secret
AMA_OAUTH_REDIRECT_URI=https://stg-apps.amoeba.site/app-car-manager/oauth/callback
```

└─ 사이드 임팩트: 없음
└─ 전제: AMA 관리자에게 Partner App 등록 요청 필요 (`scopes: ['users:read']`)

### Phase 2: Backend — OAuth 토큰 관리 + Open API 호출

**Step 2-1: AmaService 재작성**

기존 다중 엔드포인트 시도 로직 제거. OAuth 흐름으로 전면 교체:

```
AmaService
├── getAuthorizationUrl(state)     → AMA authorize URL 생성
├── exchangeCodeForToken(code)     → code → access_token 교환
├── refreshAccessToken(refreshToken) → 토큰 갱신
├── getMembers(accessToken, search)  → GET /api/v1/open/users 호출
└── token 저장 (entity별 메모리 캐시)
```

- AMA OAuth authorize URL: `{AMA_API_BASE_URL}/oauth/authorize`
- AMA OAuth token URL: `{AMA_API_BASE_URL}/oauth/token`
- AMA Open API: `{AMA_API_BASE_URL}/api/v1/open/users`
- entity별로 OAuth 토큰 캐싱 (`Map<entityId, { accessToken, refreshToken, expiresAt }>`)
- 토큰 만료 시 자동 refresh

└─ 사이드 임팩트: 기존 AmaService 전면 교체

**Step 2-2: AmaController OAuth 엔드포인트 추가**

```
GET  /api/v1/ama/oauth/authorize    → AMA OAuth 인가 URL 리다이렉트
GET  /api/v1/ama/oauth/callback     → code → token 교환 + 저장
GET  /api/v1/ama/oauth/status       → 현재 OAuth 토큰 상태 확인
GET  /api/v1/ama/members            → Open API /open/users 프록시 (기존 유지)
```

└─ 사이드 임팩트: 기존 `/ama/members` 내부 로직만 변경, 프론트엔드 인터페이스 동일

### Phase 3: Frontend — OAuth 플로우 UI

**Step 3-1: OAuth 콜백 페이지**

- `OAuthCallbackPage.tsx` 신규 생성
- URL: `/oauth/callback?code=...&state=...`
- code를 백엔드 `/ama/oauth/callback`에 전달 → 토큰 교환
- 완료 후 이전 페이지로 리다이렉트

**Step 3-2: App.tsx 라우트 추가**

```tsx
<Route path="/oauth/callback" element={<OAuthCallbackPage />} />
```

**Step 3-3: DriverFormModal OAuth 연동**

- 모달 열릴 때 `GET /api/v1/ama/oauth/status` 확인
- 토큰 없음 → "AMA 연동 필요" 안내 + "연동하기" 버튼 → OAuth authorize 리다이렉트
- 토큰 있음 → 기존 검색 UI 동작 (변경 없음)
- OAuth 완료 후 돌아오면 자동으로 검색 가능

**Step 3-4: api.ts에 OAuth 엔드포인트 추가**

```typescript
export const amaApi = {
  getMembers: (params?) => apiClient.get('/v1/ama/members', { params }).then(r => r.data),
  getOAuthStatus: () => apiClient.get('/v1/ama/oauth/status').then(r => r.data),
  getOAuthUrl: () => apiClient.get('/v1/ama/oauth/authorize').then(r => r.data),
  exchangeOAuthCode: (code: string, state: string) =>
    apiClient.get('/v1/ama/oauth/callback', { params: { code, state } }).then(r => r.data),
};
```

└─ 사이드 임팩트: DriverFormModal 검색 UI 구조 유지, OAuth 상태 확인 로직 추가

### Phase 4: i18n

**Step 4-1: OAuth 관련 번역 키 추가 (ko/en/vi)**

```json
"oauthRequired": "AMA 사용자 검색을 위해 연동이 필요합니다",
"oauthConnect": "AMA 연동하기",
"oauthConnecting": "연동 중...",
"oauthSuccess": "AMA 연동 완료",
"oauthError": "AMA 연동 실패"
```

---

## 3. 변경 파일 목록

| 구분 | 파일 | 변경유형 |
|------|------|---------|
| BE | `backend/src/domain/ama/service/ama.service.ts` | **전면 재작성** |
| BE | `backend/src/domain/ama/controller/ama.controller.ts` | 수정 (OAuth 엔드포인트 추가) |
| BE | `.env.staging.example` | 수정 (OAuth 환경변수) |
| FE | `frontend/src/pages/OAuthCallbackPage.tsx` | **신규** |
| FE | `frontend/src/App.tsx` | 수정 (콜백 라우트) |
| FE | `frontend/src/services/api.ts` | 수정 (OAuth API) |
| FE | `frontend/src/hooks/useAmaMembers.ts` | 수정 (OAuth 상태 확인) |
| FE | `frontend/src/components/driver/DriverFormModal.tsx` | 수정 (OAuth 연동 UI) |
| i18n | `locales/{ko,en,vi}/car.json` | 수정 (OAuth 키) |

---

## 4. 사이드 임팩트 분석

| 범위 | 위험도 | 설명 |
|------|--------|------|
| AMA Partner App 등록 | **사전 작업** | AMA 관리자가 client_id/secret 발급 필수 |
| 기존 Driver 등록 | 낮음 | POST /drivers DTO 변경 없음, ama_user_id UUID 동일 |
| DriverFormModal | 중간 | OAuth 미연동 시 검색 불가 → UUID fallback 유지 |
| 보안 | 중간 | client_secret은 BE에서만 관리, FE 노출 금지 |
| AMA 서버 의존성 | 중간 | OAuth 서버 불가 시 → UUID fallback으로 등록 가능 |

---

## 5. DB 마이그레이션

**불필요** — OAuth 토큰은 서버 메모리 캐시 사용 (entity별).
향후 영속 저장 필요 시 `car_oauth_tokens` 테이블 추가 검토.

---

## 6. 사전 작업 (AMA 관리자 요청)

AMA 관리자에게 아래 요청 필요:

| 항목 | 값 |
|------|---|
| App Name | car-manager |
| Redirect URI | `https://stg-apps.amoeba.site/app-car-manager/oauth/callback` |
| Scopes | `users:read` |
| 발급 필요 | `client_id`, `client_secret` |

발급 완료 후 스테이징 `.env`에 설정하면 연동 가능.
