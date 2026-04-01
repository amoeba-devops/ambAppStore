# AMA Token SSO + Subscription Verification — Requirements Analysis
# AMA 토큰 SSO 인증 + 구독 검증 — 요구사항 분석서

---
- **document_id**: PLT-REQ-20260401-AMA-TOKEN-SSO
- **version**: 2.0.0
- **status**: Draft
- **created**: 2026-04-01
- **updated**: 2026-04-01
- **author**: AI Assistant
- **app**: platform + app-car-manager + app-stock-management (cross-app)
---

## 1. Requirements Summary (요구사항 요약)

### 1.1 환경 매핑

| Environment | AMA (호출 측) | AppStore (피호출 측) |
|-------------|--------------|---------------------|
| Staging | `stg-ama.amoeba.site` | `stg-apps.amoeba.site` |
| Production | `ama.amoeba.site` | `apps.amoeba.site` |

### 1.2 요구사항 목록

| # | Requirement (요구사항) | Type (유형) |
|---|----------------------|-------------|
| FR-001 | AMA `custom-apps` 메뉴에서 iframe(`src` 직접 할당)으로 앱 호출 시 `ama_token` 쿼리스트링으로 JWT 전달 | Functional |
| FR-002 | `ama_token` JWT에서 `appCode`, `entityId`, `email`, `role`, `sub` 등 디코딩 → 사용자 컨텍스트 구성 | Functional |
| FR-003 | Platform `plt_subscriptions`에서 `entityId` + `appCode` 기준 `ACTIVE` 구독 여부 검증 | Functional |
| FR-004 | 구독 ACTIVE → 해당 앱 자동 로그인 + 페이지 정상 제공 | Functional |
| **FR-005** | **구독 미존재 / 비ACTIVE → 앱 신청 페이지(`/apps/{appSlug}`)로 리다이렉트** | **Functional** |
| FR-006 | 2개 앱(app-car-manager, app-stock-management) 모두 동일 패턴 적용 | Functional |
| FR-007 | 인증은 `ama_token` JWT 정보만 사용 — `ent_id`/`ent_code`/`ent_name`/`email` 등 개별 쿼리스트링 불사용 | Constraint |
| **FR-008** | **앱 신청 페이지에서 MASTER 권한만 앱 사용 신청 가능하다고 안내** | **Functional** |
| **FR-009** | **referer가 `stg-ama.amoeba.site` 또는 `ama.amoeba.site`가 아닌 경우 → `apps.amoeba.site` 메인 페이지로 리다이렉트** | **Security** |
| NFR-001 | `ama_token`은 JWT 서명 검증 후 사용 (위변조 방지) | Security |
| NFR-002 | cross-origin iframe 환경에서 안정적 동작 | Compatibility |

---

## 2. AS-IS Status Analysis (현황 분석)

### 2.1 AMA → AppStore iframe 호출 흐름 (현재)

```
AMA (stg-ama.amoeba.site / ama.amoeba.site)
  └─ /menu/custom-apps → iframe.src 직접 할당 (GET)
       URL: https://{apps-domain}/{appCode}?ama_token=<JWT>&locale=en
```

**ama_token JWT Payload 구조** (실제 디코딩):
```json
{
  "sub": "c1c682bc-8dec-4406-9fb7-5b75ab55efae",
  "email": "gray.kim@amoeba.group",
  "role": "MASTER",
  "entityId": "acce6566-8a00-4071-b52b-082b69832510",
  "appId": "6d03254b-ae35-4615-9d68-2e40c653f02b",
  "appCode": "app-car-manager",
  "scope": "custom_app:context",
  "iat": 1775006776,
  "exp": 1775010376
}
```

**핵심 필드:**
| Field | Description | 용도 |
|-------|-------------|------|
| `sub` | AMA userId (UUID) | 사용자 식별 |
| `email` | 사용자 이메일 | 표시용 |
| `role` | Entity 내 권한 (`MASTER`, `MEMBER` 등) | 앱 신청 권한 판단 (FR-008) |
| `entityId` | AMA Entity ID (UUID) | 구독 확인 + 데이터 격리 |
| `appCode` | 앱 slug (`app-car-manager` 등) | 현재 앱 일치 검증 |
| `appId` | 앱 ID (UUID) | 구독 매칭 |
| `scope` | 토큰 범위 (`custom_app:context`) | 토큰 용도 확인 |
| `exp` | 만료 시간 (1시간) | 유효성 검사 |

### 2.2 app-car-manager 인증 현황

**프론트엔드** ([App.tsx](apps/app-car-manager/frontend/src/App.tsx)):
- `EntityContextInitializer` 컴포넌트에서 `ent_id`, `ent_code`, `ent_name`, `email` 쿼리파라미터만 처리
- **`ama_token` 쿼리파라미터를 전혀 처리하지 않음**

**auth.store.ts** ([auth.store.ts](apps/app-car-manager/frontend/src/stores/auth.store.ts)):
- `initEntityFromQueryParams()`: `ent_id`, `ent_code`만 파싱
- `setEntityAuth()`: sessionStorage에 entity_context 저장 (토큰 없이)
- `setAuth()`: localStorage에 `ama_token` 저장

**api-client.ts** ([api-client.ts](apps/app-car-manager/frontend/src/lib/api-client.ts)):
- `ama_token` 있으면 `Bearer` 헤더, 없으면 `X-Entity-*` 헤더 fallback
- 401: iframe 감지 시 `postMessage({ type: 'AUTH_REQUIRED' })`

**백엔드** ([jwt.strategy.ts](apps/app-car-manager/backend/src/auth/jwt.strategy.ts)):
- `passport-jwt` JWT 검증 (Bearer 토큰)
- `ALLOW_ENTITY_HEADER_AUTH=true`일 때 `X-Entity-*` 헤더 fallback (스테이징 전용)
- **구독(subscription) 검증 없음**

### 2.3 app-stock-management 인증 현황

**프론트엔드** ([App.tsx](apps/app-stock-management/frontend/src/App.tsx)):
- `AmaEntryHandler`: `ent_id`, `ent_code`, `ent_name`, `email` 처리
- `/v1/auth/ama-entry` API → 자체 JWT(`asm_token`) 발급
- **`ama_token` 쿼리파라미터를 전혀 처리하지 않음**

**백엔드** ([auth.service.ts](apps/app-stock-management/backend/src/auth/auth.service.ts)):
- `amaEntryLogin()`: Corporation/User 자동 생성 + 자체 JWT 발급
- `amaSsoExchange()`: stub (미구현)
- **구독(subscription) 검증 없음**

### 2.4 Platform 구독 관리 현황

**DB** (`db_app_platform.plt_subscriptions`):
| Column | Type | Description |
|--------|------|-------------|
| `sub_id` | CHAR(36) PK | 구독 ID |
| `ent_id` | CHAR(36) | AMA Entity ID |
| `ent_code` | VARCHAR(20) | Entity Code |
| `app_id` | CHAR(36) FK | → plt_apps.app_id |
| `sub_status` | ENUM | PENDING, ACTIVE, SUSPENDED, REJECTED, CANCELLED, EXPIRED |

**현재 구독 데이터** (스테이징):
| ent_id | ent_code | app_slug | sub_status |
|--------|----------|----------|------------|
| acce6566-... | VN01 | app-car-manager | **ACTIVE** |
| acce6566-... | VN01 | app-stock-management | **ACTIVE** |

**API:**
| Endpoint | Auth | 설명 |
|----------|------|------|
| `GET /api/v1/platform/subscriptions/entity/:entId` | **Public** | entityId 기준 전체 앱 구독 현황 |
| `POST /api/v1/platform/subscriptions/public` | **Public** | 비인증 구독 신청 |
| `GET /api/v1/platform/subscriptions/check/:appSlug` | JWT | appSlug 기준 구독 상태 |

**`GET /entity/:entId` 응답 구조:**
```json
{
  "success": true,
  "data": {
    "entId": "acce6566-...",
    "apps": [
      {
        "appSlug": "app-car-manager",
        "appName": "법인차량관리",
        "appStatus": "ACTIVE",
        "subscription": {
          "subId": "...",
          "status": "ACTIVE",
          "requestedAt": "2026-03-28T...",
          "approvedAt": "2026-03-28T..."
        }
      },
      {
        "appSlug": "app-stock-management",
        "subscription": null
      }
    ]
  }
}
```

**Platform 앱 신청 페이지:**
- 경로: `/apps/:slug` (Public, `AppDetailPage`)
- 앱 상세 + `SubscriptionRequestModal` (구독 신청 모달)
- Public API(`POST /platform/subscriptions/public`)로 비인증 신청 가능

### 2.5 문제점 요약

| # | 문제 | 영향 | 심각도 |
|---|------|------|--------|
| P-001 | `ama_token` 쿼리파라미터를 어느 앱 FE도 처리하지 않음 | AMA iframe 진입 시 인증 불가 | **Critical** |
| P-002 | 구독(ACTIVE) 검증이 어느 앱에도 없음 | 미구독 entity도 앱 사용 가능 | **High** |
| P-003 | car-manager가 `ent_id`/`ent_code` 평문 파라미터 의존 | 쿼리파라미터 변조로 타 entity 접근 가능 | **High** |
| P-004 | stock-management가 자체 JWT 발급 (AMA JWT 미사용) | 이중 인증, 구독 검증 우회 | **Medium** |
| P-005 | AMA JWT `appCode` 검증 없음 | 다른 앱 토큰으로 잘못된 앱 접근 가능 | **High** |
| P-006 | 구독 미존재 시 리다이렉트/에러 처리 없음 | 미구독 사용자가 빈 화면만 봄 | **Medium** |
| P-007 | 앱 신청 시 MASTER 권한 안내 없음 | 일반 사용자 신청 시도 → 혼란 | **Low** |
| P-008 | referer 도메인 검증 없음 | AMA 외 출처에서 앱 직접 로드 가능 (비인가 접근) | **High** |

---

## 3. TO-BE Requirements (TO-BE 요구사항)

### 3.1 AS-IS → TO-BE Mapping

| # | AS-IS | TO-BE | Change Type |
|---|-------|-------|-------------|
| 1 | `ent_id`/`ent_code` 개별 쿼리파라미터로 인증 | **`ama_token` JWT만 사용** — 개별 파라미터 제거 | **Replace** |
| 2 | 구독 검증 없이 앱 사용 가능 | Platform API로 구독 ACTIVE 검증 후 사용 | **New** |
| 3 | car-manager: Entity 헤더 fallback 인증 | `ama_token` JWT → Bearer 토큰 인증 | **Replace** |
| 4 | stock-management: `ama-entry` API (평문 파라미터) | `ama_token` → `ama-sso` API → 자체 JWT 발급 | **Replace** |
| 5 | `appCode` 미검증 | JWT `appCode` ↔ 현재 앱 slug 일치 확인 | **New** |
| 6 | 구독 없으면 처리 없음 | **앱 신청 페이지(`/apps/{appSlug}`)로 리다이렉트** | **New** |
| 7 | 앱 신청 MASTER 안내 없음 | **MASTER 권한만 신청 가능 안내 표시** | **New** |
| 8 | referer 검증 없음 | **referer가 AMA 도메인이 아니면 `apps.amoeba.site` 메인으로 리다이렉트** | **New** |

### 3.2 AMA Token SSO 전체 플로우 (TO-BE)

```
AMA (stg-ama / ama)
  │
  ▼ iframe.src = "https://{apps-domain}/{appCode}?ama_token=<JWT>&locale=en"
  │
  ▼ (앱 Frontend 로드)
  │
  ├─ Step 0: document.referrer 확인
  │   → stg-ama.amoeba.site / ama.amoeba.site 아니면
  │   → apps.amoeba.site (또는 stg-apps.amoeba.site) 메인으로 리다이렉트
  ├─ Step 1: URL에서 ama_token 쿼리파라미터 추출
  ├─ Step 2: JWT 클라이언트사이드 디코딩 → appCode, entityId, role, email 추출
  ├─ Step 3: appCode === 현재 앱 slug 검증
  │   └─ 불일치 → 에러: "잘못된 접근입니다"
  ├─ Step 4: Platform 구독 확인 API 호출
  │   GET /api/v1/platform/subscriptions/entity/{entityId}
  │   → appCode 매칭 → subscription.status 확인
  │
  ├─ [ACTIVE] ─────────────────────────────────────────────┐
  │   ├─ Step 5a: ama_token 저장 + 인증 상태 설정           │
  │   ├─ Step 6a: locale → i18n 설정                       │
  │   ├─ Step 7a: URL clean-up (ama_token 제거)            │
  │   └─ Step 8a: 앱 대시보드 진입 ✓                       │
  │                                                        │
  ├─ [NOT ACTIVE / 미존재] ────────────────────────────────┐
  │   ├─ Step 5b: /apps/{appSlug} 페이지로 리다이렉트       │
  │   │   (Platform AppDetailPage — 앱 상세 + 구독 신청)   │
  │   ├─ Step 6b: ama_token 정보(entityId, role 등) 전달   │
  │   └─ Step 7b: MASTER 권한만 앱 신청 가능 안내 표시      │
  │                                                        │
  └─ [토큰 만료/invalid] ─────────────────────────────────┐
      └─ 에러: "인증이 만료되었습니다. AMA에서 다시 접근해주세요."
```

### 3.3 앱별 구현 방식

#### app-car-manager (AMA JWT 직접 사용)
- **프론트엔드**: `ama_token` → `localStorage('ama_token')` → 기존 Bearer 인터셉터 재사용
- **백엔드**: 기존 `jwt.strategy.ts` 유지 (AMA JWT secret 검증)
- **구독 검증**: 프론트엔드에서 Platform Public API 호출
- **미구독**: `/apps/app-car-manager`로 리다이렉트

#### app-stock-management (자체 JWT 발급 유지)
- **프론트엔드**: `ama_token` 디코딩 → `/v1/auth/ama-sso` 호출
- **백엔드**: `amaSsoExchange()`에서 ama_token 검증 + 구독 확인 + 자체 JWT 발급
- **미구독**: `/apps/app-stock-management`로 리다이렉트

### 3.4 비즈니스 로직

| Rule | Description |
|------|-------------|
| BL-001 | `ama_token` JWT 유효성 검증 (서명: 백엔드, 만료: 프론트+백엔드) |
| BL-002 | `ama_token.appCode` === 현재 앱 slug → 불일치 시 즉시 차단 |
| BL-003 | Platform `plt_subscriptions`에서 `entityId` + `appCode` → `sub_status = ACTIVE` 확인 |
| BL-004 | 구독 미존재 / PENDING / SUSPENDED / CANCELLED / EXPIRED → **앱 신청 페이지(`/apps/{appSlug}`)로 리다이렉트** |
| BL-005 | `locale` 쿼리파라미터 → i18n 언어 설정 (유일하게 허용되는 추가 쿼리파라미터) |
| BL-006 | 인증 성공 후 URL clean-up (`history.replaceState`로 ama_token, locale 제거) |
| BL-007 | `ent_id`/`ent_code`/`ent_name`/`email` 등 개별 쿼리파라미터 → 무시 |
| BL-008 | 앱 신청 페이지에서 `role === 'MASTER'` → 구독 신청 버튼 활성화 |
| BL-009 | `role !== 'MASTER'` → **"앱 사용 신청은 Entity의 MASTER 권한을 가진 관리자만 가능합니다"** 안내 |
| **BL-010** | **`document.referrer` 검증: 허용 도메인 = `stg-ama.amoeba.site`, `ama.amoeba.site` → 그 외 출처면 `apps.amoeba.site` 메인으로 리다이렉트** |
| BL-011 | referrer 검증은 `ama_token` 파라미터가 있을 때만 적용 (직접 URL 접근 + 기존 세션은 허용) |

### 3.5 앱 신청 페이지 리다이렉트 상세

**리다이렉트 대상**: Platform `AppDetailPage` (`/apps/{appSlug}`)

```
/apps/app-car-manager?ent_id={entityId}&ent_code={entCode}&role={role}&from=iframe
```

**Platform AppDetailPage 상태별 동작:**

| 구독 상태 | role | UI 표시 |
|-----------|------|---------|
| `null` (미신청) | MASTER | "이 앱을 사용하려면 구독 신청이 필요합니다" + **[앱 사용 신청] 버튼** |
| `null` (미신청) | MEMBER 등 | "이 앱을 사용하려면 구독 신청이 필요합니다" + "앱 사용 신청은 Entity의 MASTER 권한을 가진 관리자만 가능합니다" |
| PENDING | 모든 role | "구독 신청이 검토 중입니다. 관리자 승인을 기다려 주세요" |
| SUSPENDED | 모든 role | "구독이 일시 정지되었습니다. 관리자에게 문의하세요" |
| CANCELLED / EXPIRED | MASTER | "구독이 만료/취소되었습니다" + **[재신청] 버튼** |
| CANCELLED / EXPIRED | MEMBER 등 | "구독이 만료/취소되었습니다. MASTER 관리자에게 재신청을 요청하세요" |

---

## 4. Gap Analysis (갭 분석)

### 4.1 변경 범위 요약

| 영역 | 현재 | 변경 | 영향도 |
|------|------|------|--------|
| car-manager FE | `ent_id`/`ent_code` 파라미터 처리 | `ama_token` 파싱 + 구독 확인 + 미구독 리다이렉트 | **High** |
| car-manager BE | JWT 검증만 | (변경 없음 — AMA JWT 직접 사용) | **None** |
| stock-mgmt FE | `ent_id` → ama-entry API | `ama_token` → ama-sso API + 미구독 리다이렉트 | **High** |
| stock-mgmt BE | `amaSsoExchange` stub | ama_token 검증 + 자체 JWT 발급 구현 | **Medium** |
| Platform FE | AppDetailPage (기존) | iframe 진입 시 role 기반 MASTER 안내 추가 | **Medium** |
| Platform BE | 구독 API (기존) | (변경 없음 — 기존 Public API 재사용) | **None** |

### 4.2 파일 변경 목록

| # | App | Layer | File | Change Type |
|---|-----|-------|------|-------------|
| 1 | car-manager | FE | `src/App.tsx` | 수정 — `EntityContextInitializer` → `AmaTokenHandler` 교체 |
| 2 | car-manager | FE | `src/stores/auth.store.ts` | 수정 — `ama_token` 파싱 + localStorage 저장 |
| 3 | car-manager | FE | `src/lib/api-client.ts` | 수정 — Entity 헤더 fallback 제거 |
| 4 | stock-mgmt | FE | `src/App.tsx` | 수정 — `AmaEntryHandler` → `ama_token` 기반 변경 |
| 5 | stock-mgmt | FE | `src/stores/auth.store.ts` | 수정 — `ama_token` → ama-sso 연결 |
| 6 | stock-mgmt | BE | `src/auth/auth.service.ts` | 수정 — `amaSsoExchange()` 구현 |
| 7 | 공통 | FE | `src/lib/ama-token.ts` (신규) | 신규 — ama_token 파싱 + 구독 확인 공통 유틸 |
| 8 | 공통 | FE | 에러/리다이렉트 컴포넌트 (신규) | 신규 — 미구독 시 앱 신청 페이지 리다이렉트 UI |
| 9 | platform | FE | `src/pages/AppDetailPage.tsx` | 수정 — iframe 진입 + role 기반 MASTER 안내 |
| 10 | platform | FE | `src/components/SubscriptionRequestModal.tsx` | 수정 — MASTER 안내 메시지 추가 |
| 11 | 공통 | FE | i18n 번역 (ko/en/vi) | 수정 — 에러 + MASTER 안내 번역 키 추가 |

### 4.3 DB 마이그레이션

**해당 없음** — 기존 `plt_subscriptions`, `plt_apps` 테이블 그대로 사용.

---

## 5. User Flow (사용자 플로우)

### 5.1 정상 플로우 — 구독 ACTIVE

```
Step 1:  AMA 사용자 → /menu/custom-apps 에서 앱 클릭
Step 2:  AMA → iframe.src 할당
          URL: /{appCode}?ama_token=<JWT>&locale=en
Step 3:  앱 프론트엔드(SPA) 로드
Step 4:  ama_token 쿼리파라미터 감지
Step 4a: document.referrer 확인
          → stg-ama.amoeba.site / ama.amoeba.site ✓
Step 5:  ama_token 추출 + JWT 디코딩
          → appCode: "app-car-manager"
          → entityId: "acce6566-..."
          → role: "MASTER"
Step 6:  appCode === 현재 앱 slug ✓
Step 7:  Platform 구독 확인 API 호출
          GET /api/v1/platform/subscriptions/entity/{entityId}
          → subscription.status === "ACTIVE" ✓
Step 8:  [car-manager] ama_token → localStorage('ama_token')
          [stock-mgmt] ama_token → POST /v1/auth/ama-sso → 자체 JWT
Step 9:  locale → i18n 언어 설정
Step 10: URL clean-up (history.replaceState)
Step 11: 대시보드 진입 ✓
```

### 5.2 미구독 + MASTER — 앱 신청 가능

```
Step 1~6: (정상과 동일)
Step 7:   구독 확인 → subscription === null (미신청)
Step 8:   리다이렉트 → /apps/{appSlug}?ent_id={entityId}&role=MASTER&from=iframe
Step 9:   Platform AppDetailPage 표시
           → "이 앱을 사용하려면 구독 신청이 필요합니다"
           → [앱 사용 신청] 버튼 활성화 (MASTER)
Step 10:  MASTER가 신청 클릭 → SubscriptionRequestModal
           → POST /platform/subscriptions/public
           → "신청이 완료되었습니다. 관리자 승인 후 사용 가능합니다"
```

### 5.3 미구독 + MEMBER — 신청 불가 안내

```
Step 1~6: (정상과 동일)
Step 7:   구독 확인 → subscription === null
Step 8:   리다이렉트 → /apps/{appSlug}?ent_id={entityId}&role=MEMBER&from=iframe
Step 9:   Platform AppDetailPage 표시
           → "이 앱을 사용하려면 구독 신청이 필요합니다"
           → "앱 사용 신청은 Entity의 MASTER 권한을 가진 관리자만 가능합니다"
           → 신청 버튼 비활성화/숨김
```

### 5.4 구독 PENDING — 승인 대기

```
Step 1~6: (정상과 동일)
Step 7:   구독 확인 → subscription.status === "PENDING"
Step 8:   리다이렉트 → /apps/{appSlug}?ent_id={entityId}&from=iframe
Step 9:   "구독 신청이 검토 중입니다. 관리자 승인을 기다려 주세요"
```

### 5.5 appCode 불일치

```
Step 1~5: (정상과 동일)
Step 6:   appCode !== 현재 앱 slug
Step 7:   에러 UI → "잘못된 접근입니다 (Invalid access)"
```

### 5.6 ama_token 만료/무효

```
Step 1~4: (정상과 동일)
Step 5:   JWT 디코딩 실패 or exp < now
Step 6:   에러 UI → "인증이 만료되었습니다. AMA에서 다시 접근해주세요."
           + parent.postMessage({ type: 'TOKEN_EXPIRED' })
```

### 5.7 ama_token 없이 직접 접근

```
Step 1: 사용자가 URL 직접 입력 (예: /app-car-manager)
Step 2: ama_token 파라미터 없음
Step 3: localStorage에 기존 유효 토큰 확인
         → 있으면: 기존 세션 유지 (앱 진입)
         → 없으면: 미인증 → "AMA에서 접근해주세요" 에러
```

### 5.8 referer 불일치 — AMA 외 출처에서 앱 호출

```
Step 1: 외부 사이트에서 iframe 생성 or 카카오톡 등에서 URL 공유
         URL: /app-car-manager?ama_token=<JWT>
Step 2: 앱 프론트엔드 로드
Step 3: ama_token 파라미터 감지
Step 4: document.referrer 확인
         → referrer가 비어있거나, stg-ama / ama 도메인이 아님
Step 5: 리다이렉트 → apps.amoeba.site (또는 stg-apps.amoeba.site) 메인 페이지
         (Platform Landing Page)
```

**주의:** `document.referrer`는 빈 문자열일 수 있음 (HTTPS → HTTP, 브라우저 정책, 직접 URL 입력 등).
`ama_token` 파라미터가 있는데 referrer가 없거나 AMA가 아닌 경우 → 비정상 접근으로 판단하여 메인 페이지로 리다이렉트.

---

## 6. Technical Constraints (기술 제약사항)

### 6.1 호환성
- **cross-origin iframe**: `stg-ama.amoeba.site` ↔ `stg-apps.amoeba.site` 도메인 분리
  - `localStorage`/`sessionStorage`: 앱 도메인 기준 동작
  - `postMessage`: origin 검증 필수
- **JWT Secret 공유**: AMA JWT 검증 → AMA와 동일 `JWT_SECRET` 참조
  - Platform/Car-Manager: 환경변수 `JWT_SECRET`
  - Stock-Management: `amaSsoExchange`에서 별도 처리
- **iframe 내 리다이렉트**: 앱 → Platform 앱 신청 페이지
  - 같은 도메인(`stg-apps.amoeba.site`) 내 path 변경 → cross-origin 문제 없음

### 6.2 보안
- **ama_token URL 노출**: 파싱 후 즉시 `history.replaceState`로 URL clean-up
- **JWT 서명 검증**: 프론트엔드는 payload 디코딩만, 백엔드에서 서명 최종 검증
- **개별 쿼리파라미터 차단**: `ent_id`/`ent_code` 등 평문 무시 → 변조 방지
- **appCode 위변조 방지**: JWT 서명으로 보장

### 6.3 성능
- **구독 확인 API**: 앱 진입 시 1회 (~100ms)
- **JWT 만료**: 1시간 → 401 시 `postMessage({ type: 'TOKEN_EXPIRED' })`

### 6.4 Platform Subscription API 활용

기존 Public API 재사용 (추가 백엔드 개발 최소화):
```
GET /api/v1/platform/subscriptions/entity/{entityId}
→ { success, data: { entId, apps: [{ appSlug, subscription: { status } | null }] } }
```
- **인증 불필요** (Public endpoint)
- 같은 도메인 내 호출 → CORS 없음

### 6.5 앱 신청 페이지 리다이렉트

```
앱 iframe: /app-car-manager?ama_token=<JWT>
  ↓ (구독 미존재)
리다이렉트: /apps/app-car-manager?ent_id={entityId}&ent_code={entCode}&role={role}&from=iframe
```
- 같은 도메인 내 path 변경 → iframe 내 정상 동작
- `from=iframe` → UI 최적화 (불필요 네비게이션 숨김 등)
- `role` → MASTER 신청 안내 / MEMBER 안내 분기
