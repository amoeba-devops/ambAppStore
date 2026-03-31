# Car-Manager iframe 401/404 Fix — Task Plan (작업계획서)

---
- **document_id**: CAR-PLAN-20260331-IFRAME-AUTH-FIX
- **version**: 1.0.0
- **status**: Draft
- **created**: 2026-03-31
- **author**: AI Assistant
- **app**: app-car-manager
---

## 1. System Development Status Analysis (시스템 개발 현황 분석)

### 1.1 Bug Reproduction Flow (버그 재현 흐름)

```
AMA iframe (stg-ama.amoeba.site/entity-settings/custom-apps)
  │
  └─ loads: https://stg-apps.amoeba.site/app-car-manager?ent_id=xxx&ent_code=VN01&...
       │
       ├─ [1] React mounts: App → AppLayout + EntityContextInitializer + DashboardPage
       │       ↓
       ├─ [2] AppLayout calls useDashboard(), useDispatches() → API calls fire IMMEDIATELY
       │       ↓
       ├─ [3] api-client request interceptor checks:
       │       - localStorage 'ama_token' → null (no JWT)
       │       - sessionStorage 'entity_context' → null (NOT SET YET!)
       │       → sends request WITHOUT auth headers
       │       ↓
       ├─ [4] Backend returns 401 Unauthorized
       │       ↓
       ├─ [5] api-client response interceptor:
       │       - hasEntityContext === false
       │       - window.location.href = 'https://ama.amoeba.site/login' ← WRONG URL
       │       ↓
       ├─ [6] iframe navigates to production login → 404 Not Found
       │
       └─ [7] AFTER all this: EntityContextInitializer useEffect fires (TOO LATE)
              → saves entity_context to sessionStorage
```

### 1.2 Root Cause Summary (근본 원인 3가지)

| # | Cause (원인) | File | Detail |
|---|-------------|------|--------|
| 1 | **Race Condition** | `App.tsx` + `auth.store.ts` | `AppLayout`의 React Query 훅이 mount 즉시 API 호출 → `EntityContextInitializer`의 `useEffect`보다 먼저 실행 → sessionStorage에 entity_context 없음 |
| 2 | **iframe 내 리다이렉트** | `api-client.ts` | 401 시 `window.location.href = loginUrl` → iframe 내부에서 외부 로그인 페이지로 이동 시도 |
| 3 | **잘못된 Login URL** | `.env` (staging) | `VITE_AMA_LOGIN_URL=https://ama.amoeba.site/login` (프로덕션 URL) → 스테이징 환경에서 404 |

### 1.3 Affected Files

| File | Current Role | Issue |
|------|-------------|-------|
| `stores/auth.store.ts` | 모듈 로드 시 `restoreUserFromParams()` → sessionStorage 확인 | 첫 방문 시 sessionStorage 비어있음 |
| `App.tsx` | `EntityContextInitializer`로 쿼리파라미터 → auth store | `useEffect` 비동기 → 첫 렌더보다 늦음 |
| `components/layout/AppLayout.tsx` | `useDashboard()`, `useDispatches()` 즉시 호출 | entity context 설정 전에 API 발화 |
| `lib/api-client.ts` | 401 시 login 리다이렉트 | iframe에서 전체 페이지 이동 |

---

## 2. Step-by-Step Implementation Plan (단계별 구현 계획)

### Phase 1: Synchronous Entity Context Initialization (동기 초기화)

#### Step 1.1: auth.store.ts — Parse query params synchronously at module load
- **핵심 수정**: Zustand 스토어 생성 **전에** `window.location.search`를 동기적으로 파싱
- URL에 `ent_id`+`ent_code`가 있으면 즉시 `sessionStorage.setItem('entity_context', ...)` 실행
- 이렇게 하면 `restoreUserFromParams()`가 첫 렌더 전에 entity를 복원 가능
- └─ 사이드 임팩트: 기존 `EntityContextInitializer`와 중복 저장되나, 멱등 (같은 값 덮어씀). URL 클리닝은 `EntityContextInitializer`가 담당.

```typescript
// Module-level synchronous initialization
function initEntityFromQueryParams(): User | null {
  const params = new URLSearchParams(window.location.search);
  const entId = params.get('ent_id');
  const entCode = params.get('ent_code');
  if (!entId || !entCode) return null;

  const user: User = {
    userId: entId,
    entityId: entId,
    entityCode: entCode,
    email: params.get('email') ?? '',
    name: params.get('ent_name') ?? '',
    roles: [],
  };
  sessionStorage.setItem('entity_context', JSON.stringify(user));
  return user;
}

// Execute BEFORE store creation
const entityFromParams = initEntityFromQueryParams();
const savedToken = localStorage.getItem('ama_token');
const restoredEntity = entityFromParams || (!savedToken ? restoreUserFromParams() : null);
```

### Phase 2: iframe-Safe Error Handling (iframe 안전 에러 처리)

#### Step 2.1: api-client.ts — Prevent redirect in iframe context
- `window.self !== window.top` 체크로 iframe 여부 감지
- iframe 내부에서 401 발생 시 `window.location.href` 리다이렉트 **하지 않음**
- 대신 `window.parent.postMessage({ type: 'AUTH_REQUIRED' }, '*')` 발송 (AMA 부모 창에 알림)
- └─ 사이드 임팩트: iframe이 아닌 직접 접속 시에는 기존 리다이렉트 유지

#### Step 2.2: .env (staging) — Fix VITE_AMA_LOGIN_URL
- `VITE_AMA_LOGIN_URL=https://stg-ama.amoeba.site/login` 으로 변경 (staging URL)
- └─ 사이드 임팩트: 재빌드 필요 (VITE_* 변수는 빌드 시점 인라인)

### Phase 3: React Query — Wait for Auth Ready (인증 준비 대기)

#### Step 3.1: AppLayout.tsx — Conditional API calls
- `useAuthStore((s) => s.isAuthenticated)` 확인 후 `enabled` 옵션으로 API 호출 제어
- `useDashboard()`, `useDispatches()`에 `enabled: isAuthenticated` 추가
- └─ 사이드 임팩트: Phase 1의 동기 초기화로 첫 렌더부터 `isAuthenticated=true`이므로 정상 동작. 미인증 상태에서는 API 호출 안 함.

---

## 3. File Change List (변경 파일 목록)

| # | Classification | File Path | Change Type |
|---|---------------|-----------|-------------|
| 1 | Car-Manager FE | `apps/app-car-manager/frontend/src/stores/auth.store.ts` | Modify |
| 2 | Car-Manager FE | `apps/app-car-manager/frontend/src/lib/api-client.ts` | Modify |
| 3 | Car-Manager FE | `apps/app-car-manager/frontend/src/components/layout/AppLayout.tsx` | Modify |
| 4 | Staging Env | `apps/app-car-manager/.env` (서버) | Modify (VITE_AMA_LOGIN_URL) |

**Total**: 3 코드 파일 수정 + 1 환경변수 변경 = **4건**

---

## 4. Side Impact Analysis (사이드 임팩트 분석)

| Scope (범위) | Risk (위험도) | Description (설명) |
|--------------|-------------|-------------------|
| auth.store.ts 동기 초기화 | **Low** | 기존 `EntityContextInitializer`와 동일 데이터를 더 일찍 저장. 멱등 동작. |
| api-client.ts iframe 분기 | **Low** | `window.self !== window.top` 표준 API. iframe 아닌 경우 기존 동작 유지. |
| AppLayout.tsx enabled 조건 | **Low** | Phase 1 동기 초기화로 `isAuthenticated`가 즉시 true. 실질적 지연 없음. |
| VITE_AMA_LOGIN_URL 변경 | **Medium** | 재빌드 필수. 프로덕션 배포 시 프로덕션 URL로 유지 필요 (.env 분리). |
| 기존 직접 접속 (비iframe) | **None** | JWT 인증 + entity context 동기 초기화 모두 기존과 동일하게 동작 |

---

## 5. DB Migration (DB 마이그레이션)

**해당 없음** — 순수 프론트엔드 + 환경변수 변경만.
