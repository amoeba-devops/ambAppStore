# REQ-20260330 — Entity 구독앱 "서비스 사용" 버튼 노출
# Entity Subscribed App "Use Service" Button Display

| Item | Detail |
|------|--------|
| **Date** | 2026-03-30 |
| **Author** | AI Assistant |
| **Status** | Draft |
| **App** | Platform (apps.amoeba.site) |

---

## 1. 요구사항 요약 / Requirements Summary

| # | 요구사항 | 유형 |
|---|---------|------|
| R1 | Entity 정보(ent_id)가 있는 사용자가 앱 상세 페이지 방문 시, 해당 Entity가 구독(ACTIVE) 중인 앱이면 **"Apply for this App"** 대신 **"Use Service / 서비스 사용"** 버튼 노출 | UI/UX 변경 |
| R2 | "Use Service" 버튼 클릭 시 해당 앱 페이지(`/app-car-manager`, `/app-stock-management` 등)로 이동 | 네비게이션 |
| R3 | Entity 구독 상태를 **인증 없이(Public)** 확인 가능해야 함 (AMA iframe으로 접근하는 비인증 사용자 대응) | API/기능 |
| R4 | 랜딩 페이지 AppCard에서도 Entity 구독 상태 표시 | UI/UX 변경 |

---

## 2. AS-IS 현황 분석 / Current State Analysis

### 2.1 Frontend — AppDetailPage

**파일**: `apps/platform/frontend/src/pages/AppDetailPage.tsx`

```typescript
const { isAuthenticated } = useAuthStore();
const { data: subStatus } = useSubscriptionCheck(slug, isAuthenticated);
```

- `useSubscriptionCheck()`는 **인증된 사용자**만 호출됨 (`enabled: isAuthenticated`)
- 호출 API: `GET /v1/platform/subscriptions/check/{appSlug}` — **`@Auth()` 데코레이터 필수**
- **비인증 Entity 사용자**: `isAuthenticated = false` → 구독 체크 안됨 → 항상 "Apply for this App" 표시

**버튼 렌더링 로직**:
| 조건 | 버튼 | i18n Key |
|------|------|----------|
| `currentStatus === 'ACTIVE'` | "사용중 — 앱 바로가기" (파란색) | `detail.inUse` |
| `currentStatus === 'PENDING'` | "심사중" (비활성) | `detail.underReview` |
| `currentStatus === 'EXPIRED'` | "재신청" (주황색) | `detail.reapply` |
| `app.status === 'COMING_SOON'` | "출시예정" (비활성) | `landing.statusComingSoon` |
| Default | "앱 사용 신청" (보라색) | `detail.applyButton` |

### 2.2 Frontend — Entity Context Store

**파일**: `apps/platform/frontend/src/stores/entity-context.store.ts`

- AMA iframe 호출 시 쿼리 파라미터(`ent_id`, `ent_code`, `ent_name`, `email`)를 Zustand에 저장
- `EntityContextInitializer` (App.tsx)에서 URL 파라미터 추출 후 스토어에 저장
- **현재 문제**: Entity 정보가 있어도 구독 체크에 사용되지 않음

### 2.3 Frontend — LandingPage / AppCard

**파일**: `apps/platform/frontend/src/pages/LandingPage.tsx`

```typescript
const { data: subscriptions } = useMySubscriptions(isAuthenticated);
const subStatusMap = new Map(subscriptions?.map((s) => [s.appSlug, s.status]) ?? []);
```

- `useMySubscriptions()` 도 인증 필수 → Entity 비인증 사용자는 구독 상태 안 보임
- AppCard에서 구독 상태 배지 미표시

### 2.4 Frontend — Auth Store

**파일**: `apps/platform/frontend/src/stores/auth.store.ts`

- JWT 토큰(`ama_token`)이 localStorage에 있으면 `isAuthenticated = true`
- JWT에서 `ent_id` / `entityId` 추출하여 `user.entityId`에 저장
- **AMA iframe 사용자**: JWT 없이 쿼리 파라미터만으로 접근 → `isAuthenticated = false`

### 2.5 Backend — 구독 확인 API

| Endpoint | Auth | 용도 |
|----------|------|------|
| `GET /check/:appSlug` | `@Auth()` 필수 | JWT 사용자의 앱별 구독 상태 확인 |
| `GET /entity/:entId` | Public | Entity 전체 앱 구독 현황 (AMA 연동용) |

- **`GET /entity/:entId`** 는 이미 Public으로 구현됨 (이전 세션에서 구현)
- Entity의 전체 앱 목록 + 구독 상태를 반환
- 하지만 프론트엔드에서 사용하지 않고 있음

### 2.6 DB 현황

**스테이징 DB** (`db_app_platform.plt_subscriptions`):

| app_slug | ent_code | ent_name | sub_status |
|----------|----------|----------|------------|
| app-car-manager | VN01 | AMOEBA CO., LTD | ACTIVE |
| app-stock-management | VN01 | AMOEBA CO., LTD | ACTIVE |

→ Entity VN01 (ent_id: `acce6566-8a00-4071-b52b-082b69832510`)은 2개 앱 구독 중

### 2.7 문제점 요약

1. **Entity 비인증 사용자 구독 체크 불가**: AMA iframe으로 접근 시 JWT 없이 entity 정보만 보유 → 구독 상태 확인 API 호출 불가
2. **항상 "Apply for this App" 표시**: 이미 ACTIVE 구독인데 다시 신청 버튼만 보임
3. **앱 사용 불가능한 UX**: 구독 등록된 Entity 사용자가 해당 앱으로 이동할 수 없음

---

## 3. TO-BE 요구사항 / Target State

### 3.1 AS-IS → TO-BE 매핑표

| 영역 | AS-IS | TO-BE |
|------|-------|-------|
| 구독 체크 | JWT 인증 필수 (`useSubscriptionCheck`) | Entity 정보 있으면 Public API로 체크 추가 |
| 앱 상세 버튼 | ACTIVE → "사용중 — 앱 바로가기" (인증만) | ACTIVE → **"서비스 사용 / Use Service"** (Entity OR 인증) |
| 랜딩 카드 | 인증 사용자만 구독 상태 배지 | Entity 사용자도 구독 상태 배지 표시 |
| 네비게이션 | "In Use" → `/{app.slug}` | "Use Service" → `/{app.slug}` (동일) |

### 3.2 버튼 표시 로직 (TO-BE)

**Entity 정보 판단 우선순위**:
1. `isAuthenticated` = true → `user.entityId` 사용 (기존 로직)
2. `entityContext.entId` 존재 → Entity Public API로 체크
3. 둘 다 없음 → 구독 체크 안함 (기본 "Apply" 버튼)

**AppDetailPage 버튼 렌더링 (TO-BE)**:

| 조건 | 버튼 | 동작 |
|------|------|------|
| `status === 'ACTIVE'` (인증) | "사용중 — 앱 바로가기" | `<a href="/{slug}">` |
| `status === 'ACTIVE'` (Entity/비인증) | **"서비스 사용 / Use Service"** | `<a href="/{slug}">` |
| `status === 'PENDING'` | "심사중" | 비활성 |
| `status === 'EXPIRED'` | "재신청" | 모달 열기 |
| `app.status === 'COMING_SOON'` | "출시예정" | 비활성 |
| Default | "앱 사용 신청" | 모달 열기 |

### 3.3 신규 Hook

**`useEntitySubscriptionCheck(appSlug, entId)`**
- `GET /v1/platform/subscriptions/entity/{entId}` 호출
- 응답에서 `apps.find(a => a.appSlug === appSlug)?.subscription?.status` 추출
- `enabled`: `entId`가 있고, `isAuthenticated`가 false일 때만

### 3.4 i18n 신규 키

| Key | ko | en | vi |
|-----|----|----|-----|
| `detail.useService` | 서비스 사용 | Use Service | Sử dụng dịch vụ |

---

## 4. 갭 분석 / Gap Analysis

### 4.1 변경 범위 요약표

| 영역 | 현재 | 변경 | 영향도 |
|------|------|------|--------|
| `AppDetailPage.tsx` | 인증된 사용자만 구독 체크 | Entity 비인증 사용자도 구독 체크 + 버튼 변경 | **High** |
| `LandingPage.tsx` | 인증 사용자만 구독 상태 표시 | Entity 사용자도 구독 상태 표시 | **Medium** |
| `useSubscription.ts` | 인증 전용 hooks만 | `useEntitySubscriptionCheck()` 추가 | **Medium** |
| i18n (`ko/en/vi`) | `detail.useService` 키 없음 | 3개 언어 번역 추가 | **Low** |

### 4.2 파일 변경 목록

| 구분 | 파일 | 변경 유형 |
|------|------|----------|
| Frontend | `src/pages/AppDetailPage.tsx` | **수정** |
| Frontend | `src/pages/LandingPage.tsx` | **수정** |
| Frontend | `src/hooks/useSubscription.ts` | **수정** (hook 추가) |
| i18n | `src/i18n/locales/ko/platform.json` | **수정** |
| i18n | `src/i18n/locales/en/platform.json` | **수정** |
| i18n | `src/i18n/locales/vi/platform.json` | **수정** |

### 4.3 DB 마이그레이션

없음 — 기존 API 및 DB 구조 변경 없음

---

## 5. 사용자 플로우 / User Flow

### Flow 1: AMA iframe Entity 사용자 → 구독된 앱 사용

```
AMA Entity 사용자 (VN01)
  → AMA iframe: apps.amoeba.site/?ent_id=acce6566...&ent_code=VN01&ent_name=AMOEBA
  → EntityContextInitializer: ent_id 저장 (Zustand)
  → LandingPage: GET /entity/acce6566... → 구독 상태 확인
     → AppCard: app-car-manager [사용중], app-stock-management [사용중]
  → 클릭: /apps/app-car-manager (AppDetailPage)
     → useEntitySubscriptionCheck('app-car-manager', 'acce6566...')
     → status = 'ACTIVE'
     → 버튼: [서비스 사용] (녹색)
  → 클릭: → /app-car-manager (Nginx → 실제 앱)
```

### Flow 2: AMA iframe Entity 사용자 → 미구독 앱

```
AMA Entity 사용자 (VN01)
  → /apps/app-hscode (AppDetailPage)
     → useEntitySubscriptionCheck('app-hscode', 'acce6566...')
     → status = null (구독 없음)
     → 버튼: [앱 사용 신청] (보라색)
  → 클릭: → SubscriptionRequestModal 열림
```

### Flow 3: 인증 사용자 (JWT) — 기존 로직 유지

```
JWT 인증 사용자
  → /apps/app-car-manager (AppDetailPage)
     → useSubscriptionCheck('app-car-manager', true) ← 기존 인증 API
     → status = 'ACTIVE'
     → 버튼: [사용중 — 앱 바로가기] (파란색)
```

---

## 6. 기술 제약사항 / Technical Constraints

| 항목 | 설명 |
|------|------|
| **API 보안** | `GET /entity/:entId` 는 Public API — entId(UUID)를 알아야 접근 가능. 추후 API Key 인증 추가 고려 |
| **성능** | Entity API는 모든 앱 목록 + 구독을 반환 — 앱 수가 적으므로(<10) 성능 이슈 없음 |
| **캐싱** | React Query `staleTime: 30s` 기본값 적용 — Entity API도 동일하게 캐싱 |
| **호환성** | 기존 인증 사용자 플로우(`useSubscriptionCheck`)는 변경 없이 유지 |
| **iframe 제약** | AMA iframe에서 호출 시 CORS 이미 설정됨 (`stg-ama.amoeba.site` 허용) |
