# AppStore Subscription Query API for AMA Integration
# 앱스토어 구독 조회 API — AMA 연동 가이드

> **Version**: 1.0  
> **Date**: 2026-03-30  
> **Base URL**: `https://stg-apps.amoeba.site` (Staging) / `https://apps.amoeba.site` (Production)

---

## Overview / 개요

AMA의 `entity-settings/custom-apps` 페이지에서 Entity별 앱 구독 현황을 조회하기 위한 API.  
인증 불필요 (Public API).

---

## API Endpoint

### `GET /api/v1/platform/subscriptions/entity/{ent_id}`

Entity(법인)의 전체 앱 목록과 구독 상태를 조회한다.

| Item | Value |
|------|-------|
| **Method** | `GET` |
| **URL** | `/api/v1/platform/subscriptions/entity/{ent_id}` |
| **Authentication** | ❌ 불필요 (Public) |
| **Rate Limit** | 없음 (추후 적용 가능) |

### Path Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `ent_id` | `string` (UUID) | ✅ | AMA Entity ID (예: `acce6566-8a00-4071-b52b-082b69832510`) |

### Response

**Status**: `200 OK`

```json
{
  "success": true,
  "data": {
    "entId": "acce6566-8a00-4071-b52b-082b69832510",
    "apps": [
      {
        "appSlug": "app-car-manager",
        "appName": "법인차량관리",
        "appNameEn": "Corporate Vehicle Manager",
        "appStatus": "ACTIVE",
        "appIconUrl": null,
        "subscription": {
          "subId": "c896358d-b43c-4139-b318-11f938f34287",
          "status": "ACTIVE",
          "requestedAt": "2026-03-30T08:08:00.000Z",
          "approvedAt": "2026-03-30T08:10:00.000Z",
          "expiresAt": null
        }
      },
      {
        "appSlug": "app-hscode",
        "appName": "HS Code Tool",
        "appNameEn": "HS Code Tool",
        "appStatus": "ACTIVE",
        "appIconUrl": null,
        "subscription": null
      }
    ]
  },
  "timestamp": "2026-03-30T15:04:52.369Z"
}
```

### Response Fields

#### `data`

| Field | Type | Description |
|-------|------|-------------|
| `entId` | `string` | 요청한 Entity ID |
| `apps` | `array` | 앱 목록 (ACTIVE + COMING_SOON 앱 전체) |

#### `data.apps[]`

| Field | Type | Description |
|-------|------|-------------|
| `appSlug` | `string` | 앱 식별자 (예: `app-car-manager`) |
| `appName` | `string` | 앱 이름 (한국어) |
| `appNameEn` | `string \| null` | 앱 이름 (영어) |
| `appStatus` | `string` | 앱 상태: `ACTIVE`, `COMING_SOON` |
| `appIconUrl` | `string \| null` | 앱 아이콘 URL |
| `subscription` | `object \| null` | 구독 정보 (`null` = 미구독) |

#### `data.apps[].subscription` (구독 중인 경우)

| Field | Type | Description |
|-------|------|-------------|
| `subId` | `string` (UUID) | 구독 ID |
| `status` | `string` | 구독 상태 (아래 표 참고) |
| `requestedAt` | `string` (ISO 8601) | 신청 일시 |
| `approvedAt` | `string \| null` | 승인 일시 |
| `expiresAt` | `string \| null` | 만료 일시 (`null` = 무기한) |

### Subscription Status Values / 구독 상태값

| Status | Description | 의미 |
|--------|-------------|------|
| `PENDING` | 승인 대기 | 신청 완료, 관리자 승인 대기 중 |
| `ACTIVE` | 활성 | 사용 가능 |
| `SUSPENDED` | 일시정지 | 관리자에 의해 일시정지됨 |

> **Note**: `REJECTED`, `CANCELLED`, `EXPIRED` 상태의 구독은 응답에 포함되지 않음. `subscription: null`로 표시됨.

---

## Usage Examples / 사용 예시

### cURL

```bash
# Staging
curl -s https://stg-apps.amoeba.site/api/v1/platform/subscriptions/entity/acce6566-8a00-4071-b52b-082b69832510

# Production
curl -s https://apps.amoeba.site/api/v1/platform/subscriptions/entity/{ent_id}
```

### JavaScript (AMA Frontend)

```javascript
const entId = currentEntity.ent_id; // AMA에서 관리하는 Entity ID

const response = await fetch(
  `https://stg-apps.amoeba.site/api/v1/platform/subscriptions/entity/${entId}`
);
const { data } = await response.json();

// 구독 중인 앱만 필터
const subscribedApps = data.apps.filter(app => app.subscription !== null);

// ACTIVE 구독만 필터
const activeApps = data.apps.filter(
  app => app.subscription?.status === 'ACTIVE'
);
```

### TypeScript Interface

```typescript
interface AppSubscriptionResponse {
  success: boolean;
  data: {
    entId: string;
    apps: Array<{
      appSlug: string;
      appName: string;
      appNameEn: string | null;
      appStatus: 'ACTIVE' | 'COMING_SOON';
      appIconUrl: string | null;
      subscription: {
        subId: string;
        status: 'PENDING' | 'ACTIVE' | 'SUSPENDED';
        requestedAt: string;
        approvedAt: string | null;
        expiresAt: string | null;
      } | null;
    }>;
  };
  timestamp: string;
}
```

---

## App List / 현재 등록된 앱

| appSlug | appName | appNameEn | URL |
|---------|---------|-----------|-----|
| `app-car-manager` | 법인차량관리 | Corporate Vehicle Manager | `/app-car-manager/` |
| `app-hscode` | HS Code Tool | HS Code Tool | `/app-hscode/` |
| `app-sales-report` | 매출리포트 | Sales Report | `/app-sales-report/` |
| `app-stock-management` | 재고관리 | Stock Forecast | `/app-stock-management/` |

---

## Error Cases / 에러 케이스

| Case | HTTP Status | Response |
|------|-------------|----------|
| `ent_id` 누락 | `404` | Not Found (NestJS 기본) |
| 존재하지 않는 `ent_id` | `200` | 정상 응답. 모든 앱의 `subscription: null` |
| 서버 에러 | `500` | `{ "success": false, "error": { ... } }` |

---

## Notes / 참고사항

1. **인증 불필요**: `ent_id`는 UUID이므로 추측 불가. 민감 데이터 미포함.
2. **앱 목록**: INACTIVE 앱은 응답에서 제외됨. ACTIVE + COMING_SOON만 반환.
3. **구독 우선순위**: Entity에 동일 앱 구독이 여러 건이면 최신 유효 구독 1건만 반환 (ACTIVE > PENDING > SUSPENDED).
4. **만료**: `expiresAt`가 `null`이면 무기한 구독. 날짜가 있으면 해당 시점에 자동 만료.
5. **CORS**: `stg-ama.amoeba.site`, `ama.amoeba.site`에서의 브라우저 호출 허용됨.
