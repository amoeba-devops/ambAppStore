# PLAN-20260330 — Entity 구독앱 "서비스 사용" 버튼 노출
# Entity Subscribed App "Use Service" Button Implementation Plan

| Item | Detail |
|------|--------|
| **Date** | 2026-03-30 |
| **Author** | AI Assistant |
| **Status** | Draft |
| **Ref** | REQ-20260330-Entity-구독앱-서비스사용-버튼.md |

---

## 1. 시스템 개발 현황 분석 / Current System Analysis

### 1.1 디렉토리 구조 (관련 파일)

```
apps/platform/frontend/src/
├── pages/
│   ├── AppDetailPage.tsx          ← 수정 대상 (구독 버튼 로직)
│   └── LandingPage.tsx            ← 수정 대상 (Entity 구독 상태)
├── hooks/
│   └── useSubscription.ts         ← 수정 대상 (Entity hook 추가)
├── stores/
│   ├── auth.store.ts              ← 참조 (isAuthenticated, user.entityId)
│   └── entity-context.store.ts    ← 참조 (entity.entId)
├── components/
│   └── AppCard.tsx                ← 참조 (구독 상태 배지)
└── i18n/locales/
    ├── ko/platform.json           ← 수정 대상
    ├── en/platform.json           ← 수정 대상
    └── vi/platform.json           ← 수정 대상
```

### 1.2 기존 구독 확인 흐름

```
인증 사용자 (JWT):
  AppDetailPage → useSubscriptionCheck(slug, isAuthenticated=true)
    → GET /v1/platform/subscriptions/check/{slug} [Auth]
    → { status: 'ACTIVE' | 'PENDING' | null }

Entity 비인증 사용자 (AMA iframe):
  AppDetailPage → useSubscriptionCheck(slug, isAuthenticated=false)
    → enabled=false → 호출 안됨
    → currentStatus = undefined → "Apply for this App" 표시   ← 문제!
```

### 1.3 기존 Public Entity API

```
GET /v1/platform/subscriptions/entity/{entId}  [Public]
→ {
    entId: "acce6566-...",
    apps: [
      { appSlug: "app-car-manager", subscription: { status: "ACTIVE", ... } },
      { appSlug: "app-stock-management", subscription: { status: "ACTIVE", ... } },
      { appSlug: "app-hscode", subscription: null },
      { appSlug: "app-sales-report", subscription: null }
    ]
  }
```

### 1.4 제약사항

- 백엔드 변경 없음 (기존 Public API 활용)
- 인증 사용자 기존 로직 유지 (side effect 최소화)
- AMA iframe + 직접 접속 두 경우 모두 동작해야 함

---

## 2. 단계별 구현 계획 / Step-by-Step Implementation Plan

### Phase 1: Hook 추가 + i18n 번역 키 추가

#### Step 1.1 — `useEntitySubscriptions()` Hook 추가

**파일**: `apps/platform/frontend/src/hooks/useSubscription.ts`

Entity의 전체 앱 구독 현황을 Public API로 조회하는 hook 추가.

```typescript
export interface EntityAppSubscription {
  appSlug: string;
  appName: string;
  appNameEn: string | null;
  appStatus: string;
  appIconUrl: string | null;
  subscription: {
    subId: string;
    status: string;
    requestedAt: string;
    approvedAt: string | null;
    expiresAt: string | null;
  } | null;
}

export function useEntitySubscriptions(entId: string | null) {
  return useQuery<EntityAppSubscription[]>({
    queryKey: ['platform', 'subscriptions', 'entity', entId],
    queryFn: async () => {
      const res = await apiClient.get(`/v1/platform/subscriptions/entity/${entId}`);
      return res.data.data.apps;
    },
    enabled: !!entId,
  });
}
```

└─ 사이드 임팩트: 없음. 기존 hooks 변경 없음. 새 hook만 추가.

#### Step 1.2 — i18n 번역 키 추가

**파일**: `ko/platform.json`, `en/platform.json`, `vi/platform.json`

```json
"detail": {
  "useService": "서비스 사용"     // ko
  "useService": "Use Service"     // en
  "useService": "Sử dụng dịch vụ" // vi
}
```

└─ 사이드 임팩트: 없음. 기존 키 변경 없음.

---

### Phase 2: AppDetailPage 구독 버튼 로직 변경

#### Step 2.1 — Entity 구독 상태 통합 판단

**파일**: `apps/platform/frontend/src/pages/AppDetailPage.tsx`

변경 내용:
1. `useEntityContextStore`에서 entity 정보 가져오기
2. `useEntitySubscriptions(entId)` 호출 (비인증 Entity 사용자)
3. 통합 구독 상태 계산:
   - 인증 사용자: 기존 `useSubscriptionCheck` 결과 사용
   - Entity 비인증 사용자: `useEntitySubscriptions` 결과에서 해당 앱 구독 상태 추출
4. 버튼 렌더링 로직에 "Use Service" 추가

**구현 로직**:
```typescript
const { isAuthenticated } = useAuthStore();
const entity = useEntityContextStore((s) => s.entity);
const entId = entity?.entId || null;

// 인증 사용자: 기존 API
const { data: subStatus } = useSubscriptionCheck(slug, isAuthenticated);

// Entity 비인증 사용자: Public API
const { data: entityApps } = useEntitySubscriptions(
  !isAuthenticated ? entId : null
);

// 통합 구독 상태 계산
const currentStatus = isAuthenticated
  ? subStatus?.status
  : entityApps?.find(a => a.appSlug === slug)?.subscription?.status ?? null;

const isEntityUser = !isAuthenticated && !!entId;
```

**버튼 렌더링 (TO-BE)**:
```
if (currentStatus === 'ACTIVE' && isAuthenticated) → "사용중 — 앱 바로가기" (파란색)
if (currentStatus === 'ACTIVE' && isEntityUser) → "서비스 사용" (녹색, 새 버튼)
if (currentStatus === 'PENDING') → "심사중" (비활성)
if (currentStatus === 'EXPIRED') → "재신청" (주황색)
if (app.status === 'COMING_SOON') → "출시예정" (비활성)
default → "앱 사용 신청" (보라색)
```

└─ 사이드 임팩트: 인증 사용자 로직 변경 없음. Entity 비인증 사용자만 추가 로직.

---

### Phase 3: LandingPage Entity 구독 상태 표시

#### Step 3.1 — LandingPage에서 Entity 구독 상태 조회

**파일**: `apps/platform/frontend/src/pages/LandingPage.tsx`

변경 내용:
1. Entity 비인증 사용자일 때 `useEntitySubscriptions(entId)` 호출
2. Entity API 결과에서 `subStatusMap` 생성
3. AppCard에 구독 상태 전달

**구현 로직**:
```typescript
const entity = useEntityContextStore((s) => s.entity);
const entId = entity?.entId || null;

// 인증 사용자: 기존 로직
const { data: subscriptions } = useMySubscriptions(isAuthenticated);

// Entity 비인증 사용자: Public API
const { data: entityApps } = useEntitySubscriptions(
  !isAuthenticated ? entId : null
);

// 통합 구독 상태 맵
const subStatusMap = isAuthenticated
  ? new Map(subscriptions?.map((s) => [s.appSlug, s.status]) ?? [])
  : new Map(entityApps?.map((a) => [a.appSlug, a.subscription?.status ?? null]) ?? []);
```

└─ 사이드 임팩트: 인증 사용자 로직 변경 없음. Entity 사용자 추가 표시만.

---

## 3. 변경 파일 목록 / Changed Files Summary

| 구분 | 파일 | 변경 유형 | 설명 |
|------|------|----------|------|
| Frontend | `src/hooks/useSubscription.ts` | **수정** | `useEntitySubscriptions()` hook + interface 추가 |
| Frontend | `src/pages/AppDetailPage.tsx` | **수정** | Entity 구독 체크 + "서비스 사용" 버튼 추가 |
| Frontend | `src/pages/LandingPage.tsx` | **수정** | Entity 구독 상태 표시 |
| i18n | `src/i18n/locales/ko/platform.json` | **수정** | `detail.useService` 추가 |
| i18n | `src/i18n/locales/en/platform.json` | **수정** | `detail.useService` 추가 |
| i18n | `src/i18n/locales/vi/platform.json` | **수정** | `detail.useService` 추가 |

**총 6개 파일 수정, 신규 파일 없음**

---

## 4. 사이드 임팩트 분석 / Side Impact Analysis

| 범위 | 위험도 | 설명 |
|------|--------|------|
| 인증 사용자 플로우 | **None** | 기존 `useSubscriptionCheck` + `useMySubscriptions` 로직 변경 없음 |
| Entity 비인증 플로우 | **Low** | 새 hook 추가만, 기존 기능 의존 없음 |
| Public API 호출 증가 | **Low** | Entity API 추가 호출되나, React Query 캐싱(30s)으로 중복 방지 |
| i18n | **None** | 신규 키만 추가, 기존 키 변경 없음 |
| 백엔드 | **None** | 변경 없음, 기존 Public API 사용 |

---

## 5. DB 마이그레이션 / Database Migration

없음 — 백엔드/DB 변경 없이 프론트엔드만 수정
