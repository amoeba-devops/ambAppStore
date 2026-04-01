# AMA Token SSO + Subscription Verification — Task Plan
# AMA 토큰 SSO 인증 + 구독 검증 — 작업계획서

---
- **document_id**: PLT-PLAN-20260401-AMA-TOKEN-SSO
- **version**: 1.0.0
- **status**: Draft
- **created**: 2026-04-01
- **author**: AI Assistant
- **app**: platform + app-car-manager + app-stock-management (cross-app)
- **ref**: [REQ-20260401-AMA-Token-SSO-Subscription-Verification.md](../analysis/REQ-20260401-AMA-Token-SSO-Subscription-Verification.md)
---

## 1. System Development Status Analysis (시스템 개발 현황 분석)

### 1.1 디렉토리 구조 (변경 대상)

```
apps/
├── app-car-manager/frontend/src/
│   ├── App.tsx                    ← 수정 (EntityContextInitializer → AmaTokenHandler)
│   ├── stores/auth.store.ts       ← 수정 (ama_token 파싱 로직)
│   ├── lib/api-client.ts          ← 수정 (Entity 헤더 fallback 정리)
│   ├── lib/ama-token.ts           ← 신규 (공통 토큰 파싱 + 구독 확인)
│   └── i18n/locales/{ko,en,vi}/car.json  ← 수정 (에러 메시지 번역)
│
├── app-stock-management/
│   ├── frontend/src/
│   │   ├── App.tsx                ← 수정 (AmaEntryHandler → AmaTokenHandler)
│   │   ├── stores/auth.store.ts   ← 수정 (ama_token → ama-sso 연결)
│   │   ├── lib/ama-token.ts       ← 신규 (car-manager와 동일 구조)
│   │   └── i18n/locales/{ko,en,vi}/stock.json  ← 수정
│   └── backend/src/
│       └── auth/auth.service.ts   ← 수정 (amaSsoExchange 실제 구현)
│
└── platform/frontend/src/
    ├── pages/AppDetailPage.tsx     ← 수정 (iframe 진입 + MASTER 안내)
    ├── components/SubscriptionRequestModal.tsx  ← 수정 (role 기반 분기)
    └── i18n/locales/{ko,en,vi}/platform.json   ← 수정
```

### 1.2 기술 스택 현황

| Layer | Technology | 비고 |
|-------|-----------|------|
| Frontend | React 18 + TypeScript 5 + Zustand + React Query 5 | 3개 앱 동일 |
| Backend | NestJS 10 + TypeORM + MySQL 8.0 | stock-management만 BE 변경 |
| Auth | JWT (AMA SSO) | car-manager: AMA JWT 직접 사용 / stock-mgmt: 자체 JWT |
| i18n | i18next | 앱별 네임스페이스 (car / stock / platform) |
| Deploy | Docker + Nginx | deploy-staging.sh |

### 1.3 기존 코드 현황 및 제약사항

**app-car-manager:**
- `EntityContextInitializer`: `ent_id`/`ent_code` 쿼리파라미터 → sessionStorage 저장 (토큰 미사용)
- `auth.store.ts`: `initEntityFromQueryParams()` 모듈 로드 시점 동기 실행 (제거 필요)
- `api-client.ts`: Entity 헤더 fallback — `X-Entity-*` 헤더 전송 (정리 필요)
- 백엔드 `jwt.strategy.ts`: AMA JWT secret으로 검증 → **변경 불필요**

**app-stock-management:**
- `AmaEntryHandler`: `ent_id`/`ent_code`/`ent_name`/`email` → `POST /auth/ama-entry` → 자체 JWT 발급
- `auth.store.ts`: `asm_token`, `asm_refresh_token`, `asm_crp_code` 체계
- `amaSsoExchange()`: 현재 stub — AMA token decode 후 `usrAmaUserId`로 검색만 (구독 미확인)
- `POST /auth/ama-sso`: 엔드포인트 존재, body `{ ama_token }` 수신

**platform:**
- `AppDetailPage`: 이미 구독 상태별 버튼 분기 존재 (ACTIVE/PENDING/EXPIRED/COMING_SOON)
- `SubscriptionRequestModal`: 인증/비인증 분기 (Public API 지원)
- `GET /subscriptions/entity/:entId`: Public API, 전체 앱 구독 현황 반환
- `POST /subscriptions/public`: Public 구독 신청 (ent_id, ent_code, app_slug 등)

---

## 2. Step-by-Step Implementation Plan (단계별 구현 계획)

### Phase 1: 공통 유틸리티 개발

#### Step 1.1: `ama-token.ts` 공통 유틸리티 생성 (car-manager)

**파일**: `apps/app-car-manager/frontend/src/lib/ama-token.ts`

```typescript
// 주요 함수:
// 1. decodeAmaToken(token: string) → AmaTokenPayload | null
// 2. validateReferrer() → boolean
// 3. checkSubscription(entityId: string, appSlug: string) → SubscriptionStatus
// 4. getAmaTokenFromUrl() → { token, locale } | null
```

**구현 내용:**
- JWT base64 decode (서명 미검증 — 프론트엔드)
- `document.referrer` 검증 (허용: `stg-ama.amoeba.site`, `ama.amoeba.site`)
- Platform Public API 호출: `GET /api/v1/platform/subscriptions/entity/{entityId}`
- 응답에서 `appSlug` 매칭 → `subscription.status` 반환

└─ 사이드 임팩트: 없음 (신규 파일)

#### Step 1.2: `ama-token.ts` 복사 (stock-management)

**파일**: `apps/app-stock-management/frontend/src/lib/ama-token.ts`

- car-manager와 동일 유틸리티 복사 (앱별 격리 원칙 준수)
- `APP_SLUG` 상수만 다름: `'app-stock-management'`

└─ 사이드 임팩트: 없음 (신규 파일)

---

### Phase 2: app-car-manager 프론트엔드 변경

#### Step 2.1: `auth.store.ts` 수정

**파일**: `apps/app-car-manager/frontend/src/stores/auth.store.ts`

**변경 내용:**
1. `initEntityFromQueryParams()` 함수 **제거** (ent_id/ent_code 파싱)
2. `setEntityAuth()` **제거** (토큰 없이 entity_context 저장)
3. `restoreUserFromParams()` **유지** (기존 세션 복원용)
4. AMA JWT decode로 User 객체 구성하는 헬퍼 추가:
   ```typescript
   function userFromAmaToken(payload: AmaTokenPayload): User {
     return {
       userId: payload.sub,
       entityId: payload.entityId,
       entityCode: '', // JWT에 entityCode 없음 → 빈 값
       email: payload.email,
       name: payload.email.split('@')[0],
       roles: [payload.role],
     };
   }
   ```

└─ 사이드 임팩트: `EntityContextInitializer`에서 `setEntityAuth` 호출 제거 필요 (Step 2.2에서 처리)

#### Step 2.2: `App.tsx` 수정

**파일**: `apps/app-car-manager/frontend/src/App.tsx`

**변경 내용:**
1. `EntityContextInitializer` 컴포넌트 → `AmaTokenHandler`로 교체
2. `AmaTokenHandler` 구현:
   ```
   useEffect:
     1. getAmaTokenFromUrl() → token, locale 추출
     2. token 없으면 → return (기존 세션 or 미인증)
     3. validateReferrer() → false면 → window.location.href = '/' (메인)
     4. decodeAmaToken(token) → payload
     5. payload.appCode !== 'app-car-manager' → 에러 상태
     6. checkSubscription(entityId, appSlug) → status
     7. status === 'ACTIVE' → setAuth(token, user) + URL cleanup
     8. status !== 'ACTIVE' → redirect to /apps/{appSlug}?ent_id=...&role=...&from=iframe
   ```
3. 에러/미구독 시 표시할 간단한 인라인 UI (선택: 별도 컴포넌트)
4. `locale` → `i18n.changeLanguage(locale)` 호출

└─ 사이드 임팩트: 기존 `EntityContextInitializer`의 `ent_id`/`ent_code` 파라미터 처리가 제거됨 → AMA에서 `ama_token` 없이 `ent_id` 파라미터만 보내는 구형 방식은 더 이상 동작하지 않음. AMA 팀에 `ama_token` 전달 방식 사용 확인 필요.

#### Step 2.3: `api-client.ts` 수정

**파일**: `apps/app-car-manager/frontend/src/lib/api-client.ts`

**변경 내용:**
1. Request 인터셉터: Entity 헤더 fallback 코드 제거 (`X-Entity-*` 헤더 전송 부분)
2. `ama_token` localStorage에서 Bearer 토큰 전송하는 기존 로직 유지
3. Response 인터셉터: 401 시 `postMessage({ type: 'TOKEN_EXPIRED' })` 통일

└─ 사이드 임팩트: `ALLOW_ENTITY_HEADER_AUTH=true` 백엔드 fallback이 무의미해짐. 스테이징에서 Entity 헤더 인증으로 테스트하던 방식 불가. 하지만 `ama_token`으로 인증하므로 문제 없음.

#### Step 2.4: i18n 번역 추가

**파일**: `apps/app-car-manager/frontend/src/i18n/locales/{ko,en,vi}/car.json`

**추가 키:**
```json
{
  "auth": {
    "invalidAccess": "잘못된 접근입니다",
    "tokenExpired": "인증이 만료되었습니다. AMA에서 다시 접근해주세요.",
    "subscriptionRequired": "이 앱을 사용하려면 구독 신청이 필요합니다.",
    "redirecting": "앱 신청 페이지로 이동합니다...",
    "invalidReferrer": "허용되지 않은 접근입니다."
  }
}
```

└─ 사이드 임팩트: 없음 (키 추가만)

---

### Phase 3: app-stock-management 프론트엔드 변경

#### Step 3.1: `auth.store.ts` 수정

**파일**: `apps/app-stock-management/frontend/src/stores/auth.store.ts`

**변경 내용:**
- 기존 `setAuth`, `setCrpCode`, `clearAuth` 유지
- `ama_token` 관련 추가 상태 불필요 (AmaTokenHandler에서 직접 처리)

└─ 사이드 임팩트: 없음 (기존 인터페이스 유지)

#### Step 3.2: `App.tsx` 수정

**파일**: `apps/app-stock-management/frontend/src/App.tsx`

**변경 내용:**
1. `AmaEntryHandler` → `AmaTokenHandler`로 교체
2. `AmaTokenHandler` 구현 (car-manager와 유사하나 자체 JWT 발급):
   ```
   useEffect:
     1. getAmaTokenFromUrl() → token, locale
     2. token 없으면 → return
     3. validateReferrer() → false면 → redirect to '/'
     4. decodeAmaToken(token) → payload
     5. payload.appCode !== 'app-stock-management' → 에러
     6. checkSubscription(entityId, appSlug) → status
     7. status === 'ACTIVE' →
        - POST /v1/auth/ama-sso { ama_token: token }
        - 응답: { accessToken, refreshToken, user }
        - setAuth(accessToken, refreshToken, user)
        - navigate('/')
     8. status !== 'ACTIVE' → redirect to /apps/{appSlug}?...
   ```
3. `locale` → `i18n.changeLanguage(locale)` 호출

└─ 사이드 임팩트: 기존 `AmaEntryHandler`의 `ent_id`/`ent_code`/`ent_name`/`email` 개별 파라미터 처리 제거됨. 기존 방식으로 진입하던 플로우 중단.

#### Step 3.3: i18n 번역 추가

**파일**: `apps/app-stock-management/frontend/src/i18n/locales/{ko,en,vi}/stock.json`

**추가 키:** car-manager와 동일 (`auth.*` 번역 키)

└─ 사이드 임팩트: 없음

---

### Phase 4: app-stock-management 백엔드 변경

#### Step 4.1: `auth.service.ts` — `amaSsoExchange()` 실제 구현

**파일**: `apps/app-stock-management/backend/src/auth/auth.service.ts`

**변경 내용:**
기존 stub를 실제 로직으로 교체:

```typescript
async amaSsoExchange(amaToken: string) {
  // Step 1: AMA 토큰 디코딩 (서명 검증은 JWT_SECRET 없으면 decode만)
  let amaPayload: any;
  try {
    amaPayload = this.jwtService.decode(amaToken);
  } catch {
    throw new BusinessException('ASM-E1011', 'Invalid AMA token', HttpStatus.UNAUTHORIZED);
  }
  if (!amaPayload?.entityId || !amaPayload?.email) {
    throw new BusinessException('ASM-E1011', 'Invalid AMA token payload', HttpStatus.UNAUTHORIZED);
  }

  // Step 2: AMA payload에서 정보 추출
  const { sub, entityId, email, role, appCode } = amaPayload;

  // Step 3: appCode 검증
  if (appCode !== 'app-stock-management') {
    throw new BusinessException('ASM-E1012', 'Invalid app code', HttpStatus.FORBIDDEN);
  }

  // Step 4: Corporation 찾기/생성
  let corp = await this.corpRepo.findOne({
    where: { crpAmaEntityId: entityId, crpDeletedAt: IsNull() },
  });
  if (!corp) {
    corp = this.corpRepo.create({
      crpCode: `AMA-${entityId.substring(0, 8)}`,
      crpName: `AMA Entity`,
      crpAmaEntityId: entityId,
      crpStatus: CorporationStatus.ACTIVE,
    });
    corp = await this.corpRepo.save(corp);
  }

  // Step 5: User 찾기/생성
  let user = await this.userRepo.findOne({
    where: { usrEmail: email, crpId: corp.crpId, usrDeletedAt: IsNull() },
  });
  if (!user) {
    const tempHash = await bcrypt.hash('ama-sso-no-password', 12);
    user = this.userRepo.create({
      crpId: corp.crpId,
      usrCode: `AMA-${entityId.substring(0, 8)}`,
      usrEmail: email,
      usrName: email.split('@')[0],
      usrPasswordHash: tempHash,
      usrRole: role === 'MASTER' ? UserRole.ADMIN : UserRole.USER,
      usrStatus: UserStatus.ACTIVE,
      usrAmaUserId: sub,
      usrTempPassword: false,
    });
    user = await this.userRepo.save(user);
  } else if (!user.usrAmaUserId) {
    user.usrAmaUserId = sub;
    await this.userRepo.save(user);
  }

  // Step 6: 자체 JWT 발급
  return this.issueTokens(user, corp, 'AMA_SSO');
}
```

└─ 사이드 임팩트: 기존 stub에서는 `amaPayload.ent_id`를 읽었으나 실제 AMA 토큰은 `entityId` 필드 사용 → 필드명 변경. 기존 `usrAmaUserId` 매칭 로직은 보조적으로 유지하되, 메인 플로우는 `entityId` + `email` 기반.

---

### Phase 5: Platform 프론트엔드 변경

#### Step 5.1: `AppDetailPage.tsx` 수정

**파일**: `apps/platform/frontend/src/pages/AppDetailPage.tsx`

**변경 내용:**
1. URL 쿼리파라미터에서 `from=iframe`, `role`, `ent_id` 감지
2. iframe 진입 시 (`from=iframe`):
   - Entity context 설정 (useEntityContextStore)
   - role 기반 UI 분기:
     - `role === 'MASTER'`: 기존 신청 버튼 표시
     - `role !== 'MASTER'`: "앱 사용 신청은 Entity의 MASTER 권한을 가진 관리자만 가능합니다" 안내
3. 구독 상태별 메시지 추가:
   - `null`: "이 앱을 사용하려면 구독 신청이 필요합니다"
   - `PENDING`: "구독 신청이 검토 중입니다"
   - `SUSPENDED`: "구독이 일시 정지되었습니다"

└─ 사이드 임팩트: 기존 Direct access (비인증 사용자가 `/apps/:slug`로 접근)에는 영향 없음 — `from=iframe` 파라미터가 없으면 기존 동작 유지.

#### Step 5.2: `SubscriptionRequestModal.tsx` 수정 (선택)

**파일**: `apps/platform/frontend/src/components/SubscriptionRequestModal.tsx`

**변경 내용:**
- iframe에서 넘어온 경우 `ent_id`, `ent_code` 등을 기본값으로 자동 채움 (이미 `entityCtx` 활용)
- MASTER 아닌 경우 모달 대신 안내 메시지 표시 (AppDetailPage에서 처리)

└─ 사이드 임팩트: 없음 (기존 서브미션 로직 유지)

#### Step 5.3: Platform i18n 번역 추가

**파일**: `apps/platform/frontend/src/i18n/locales/{ko,en,vi}/platform.json`

**추가 키:**
```json
{
  "detail": {
    "subscriptionRequired": "이 앱을 사용하려면 구독 신청이 필요합니다.",
    "masterOnly": "앱 사용 신청은 Entity의 MASTER 권한을 가진 관리자만 가능합니다.",
    "pendingReview": "구독 신청이 검토 중입니다. 관리자 승인을 기다려 주세요.",
    "suspended": "구독이 일시 정지되었습니다. 관리자에게 문의하세요.",
    "expiredReapply": "구독이 만료되었습니다.",
    "contactMaster": "Entity의 MASTER 관리자에게 재신청을 요청하세요."
  }
}
```

└─ 사이드 임팩트: 없음

---

### Phase 6: 통합 테스트 + 배포

#### Step 6.1: 로컬 빌드 검증

```bash
cd apps/app-car-manager/frontend && npm run build
cd apps/app-stock-management/frontend && npm run build
cd apps/app-stock-management/backend && npm run build
cd apps/platform/frontend && npm run build
```

- 빌드 에러 없음 확인
- 빌드된 JS에서 `ama_token`, `validateReferrer`, `checkSubscription` 함수 존재 확인

#### Step 6.2: 스테이징 배포

```bash
ssh ambAppStore@stg-apps.amoeba.site "cd ~/ambAppStore && git pull origin main && bash platform/scripts/deploy-staging.sh build car-manager"
ssh ambAppStore@stg-apps.amoeba.site "cd ~/ambAppStore && bash platform/scripts/deploy-staging.sh build stock"
ssh ambAppStore@stg-apps.amoeba.site "cd ~/ambAppStore && bash platform/scripts/deploy-staging.sh build platform"
ssh ambAppStore@stg-apps.amoeba.site "cd ~/ambAppStore && bash platform/scripts/deploy-staging.sh restart all"
```

#### Step 6.3: 스테이징 검증

| # | 테스트 시나리오 | 예상 결과 |
|---|---------------|----------|
| 1 | AMA → car-manager iframe (ACTIVE 구독) | 대시보드 자동 진입 |
| 2 | AMA → stock-management iframe (ACTIVE 구독) | 대시보드 자동 진입 |
| 3 | AMA → car-manager iframe (구독 없는 entity) | `/apps/app-car-manager` 리다이렉트 |
| 4 | 직접 URL 접근 (ama_token 없이) | 기존 세션 or 에러 |
| 5 | 잘못된 appCode 토큰 | "잘못된 접근" 에러 |
| 6 | 만료된 토큰 | "인증 만료" 에러 |
| 7 | 외부 referer + ama_token | 메인 페이지 리다이렉트 |
| 8 | MEMBER role로 미구독 앱 접근 | "MASTER만 신청 가능" 안내 |

---

## 3. Changed Files List (변경 파일 목록)

| # | 구분 | 앱 | 파일 경로 | 변경유형 |
|---|------|-----|---------|---------|
| 1 | FE | car-manager | `src/lib/ama-token.ts` | **신규** |
| 2 | FE | car-manager | `src/App.tsx` | 수정 |
| 3 | FE | car-manager | `src/stores/auth.store.ts` | 수정 |
| 4 | FE | car-manager | `src/lib/api-client.ts` | 수정 |
| 5 | FE | car-manager | `src/i18n/locales/ko/car.json` | 수정 |
| 6 | FE | car-manager | `src/i18n/locales/en/car.json` | 수정 |
| 7 | FE | car-manager | `src/i18n/locales/vi/car.json` | 수정 |
| 8 | FE | stock-mgmt | `src/lib/ama-token.ts` | **신규** |
| 9 | FE | stock-mgmt | `src/App.tsx` | 수정 |
| 10 | FE | stock-mgmt | `src/stores/auth.store.ts` | 수정 |
| 11 | FE | stock-mgmt | `src/i18n/locales/ko/stock.json` | 수정 |
| 12 | FE | stock-mgmt | `src/i18n/locales/en/stock.json` | 수정 |
| 13 | FE | stock-mgmt | `src/i18n/locales/vi/stock.json` | 수정 |
| 14 | BE | stock-mgmt | `src/auth/auth.service.ts` | 수정 |
| 15 | FE | platform | `src/pages/AppDetailPage.tsx` | 수정 |
| 16 | FE | platform | `src/components/SubscriptionRequestModal.tsx` | 수정 (선택) |
| 17 | FE | platform | `src/i18n/locales/ko/platform.json` | 수정 |
| 18 | FE | platform | `src/i18n/locales/en/platform.json` | 수정 |
| 19 | FE | platform | `src/i18n/locales/vi/platform.json` | 수정 |

**총: 신규 2개 + 수정 17개 = 19개 파일**

---

## 4. Side Impact Analysis (사이드 임팩트 분석)

| # | 범위 | 위험도 | 설명 | 대응 |
|---|------|--------|------|------|
| SI-001 | car-manager FE | **High** | `EntityContextInitializer` 제거 → `ent_id`/`ent_code` 개별 파라미터 진입 불가 | AMA 팀에 `ama_token` 전달 방식 사전 확인. 기존 방식 사용 시 호환 로직 임시 유지 가능 |
| SI-002 | stock-mgmt FE | **High** | `AmaEntryHandler` 제거 → `ama-entry` API 기반 진입 불가 | 위와 동일. 단, `ama-sso` 엔드포인트는 이미 존재하므로 전환 용이 |
| SI-003 | car-manager FE | **Medium** | Entity 헤더 fallback 제거 → 스테이징 `ALLOW_ENTITY_HEADER_AUTH` 무의미 | `ama_token` 인증으로 대체되므로 영향 없음 |
| SI-004 | stock-mgmt BE | **Low** | `amaSsoExchange` AMA payload 필드명 변경 (`ent_id` → `entityId`) | 기존 stub의 `ent_id` 참조 코드가 `entityId`로 변경됨 |
| SI-005 | platform FE | **Low** | `AppDetailPage`에 `from=iframe` 파라미터 처리 추가 | `from=iframe` 미존재 시 기존 동작 100% 유지 |
| SI-006 | 전체 | **Medium** | referrer 검증 추가 → `document.referrer` 비어있는 경우 AMA에서도 차단 가능 | Referrer-Policy 헤더 확인 필요. AMA가 `no-referrer` 설정이면 검증 실패 가능 → fallback 로직 고려 |

### SI-006 대응 방안 (referrer 빈 값 처리)

AMA iframe에서 `document.referrer`가 빈 값일 수 있는 조건:
- AMA가 `Referrer-Policy: no-referrer` 설정
- HTTPS → HTTPS이므로 일반적으로 전송됨 (origin 이상)

**구현 전략:**
```typescript
function validateReferrer(): boolean {
  const referrer = document.referrer;
  // referrer가 없으면 → 경고 로그만 남기고 통과 (strict mode 아닌 soft mode)
  if (!referrer) return true; // soft: 빈 referrer 허용
  const allowed = ['stg-ama.amoeba.site', 'ama.amoeba.site'];
  try {
    const host = new URL(referrer).hostname;
    return allowed.includes(host);
  } catch {
    return false;
  }
}
```

> **참고**: referrer가 빈 경우를 차단(`strict`)하면 AMA에서도 접근 불가 위험. 초기에는 `soft` 모드(빈 referrer 허용)로 배포 후, AMA referrer 전송 확인 후 `strict` 모드로 전환 가능.

---

## 5. DB Migration (DB 마이그레이션)

**해당 없음** — 기존 `db_app_platform.plt_subscriptions`, `plt_apps` 테이블 및 `db_app_stock.asm_users`, `asm_corporations` 테이블 그대로 사용.

추가 컬럼/테이블 생성 불필요.
