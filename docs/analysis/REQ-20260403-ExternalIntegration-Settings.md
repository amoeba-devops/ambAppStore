# REQ-20260403 — External Integration Settings (외부 연동 설정 관리)

---
- **document_id**: AMA-SAL-REQ-20260403-ExtIntegration
- **version**: 1.0.0
- **status**: Draft
- **created**: 2026-04-03
- **app**: app-sales-report
---

## 1. Requirements Summary (요구사항 요약)

| # | Requirement | Type | Priority |
|---|-------------|------|----------|
| R1 | Create `drd_external_integrations` table for managing all external API connection info per entity (외부 연동 API 정보를 Entity별로 관리하는 테이블 신규 생성) | Backend / DB | HIGH |
| R2 | Build card-view Settings page with integration management cards (카드뷰 형태의 설정 페이지에 외부 연동 관리 UI 구성) | Frontend | HIGH |
| R3 | Support integration categories: AI, Email, Storage, Marketplace, ERP, Platform (AI/이메일/스토리지/마켓플레이스/ERP/플랫폼 등 카테고리별 연동 관리) | Backend / Frontend | HIGH |
| R4 | Form for adding/editing integrations: service type, name, endpoint, key name, key value (서비스 종류/이름/주소/키이름/키 값 입력 폼) | Frontend | HIGH |
| R5 | Encrypt sensitive fields (API keys) at rest (API 키 등 민감 데이터 암호화 저장) | Backend | HIGH |
| R6 | CRUD API for external integrations (외부 연동 CRUD API) | Backend | HIGH |
| R7 | Predefined service catalog with icons per category (카테고리별 사전 정의된 서비스 카탈로그 + 아이콘) | Frontend | MEDIUM |

---

## 2. AS-IS Analysis (현황 분석)

### 2.1 Frontend — Settings Page

**File**: `apps/app-sales-report/frontend/src/pages/SettingsPage.tsx`

| Item | Current Status |
|------|----------------|
| Settings Page | **Placeholder only** — "Coming Soon" 메시지 표시, 기능 없음 |
| Route | `/settings` — `App.tsx` 내 ProtectedRoute 하위에 등록됨 |
| i18n Keys | `nav.settings`, `placeholder.comingSoon`, `placeholder.comingSoonDesc` — 3개 뿐 |

```tsx
// 현재 SettingsPage.tsx — 빈 플레이스홀더
export function SettingsPage() {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-12 text-center">
      <p>{t('placeholder.comingSoon')}</p>
    </div>
  );
}
```

### 2.2 Backend — No Integration Domain

| Item | Current Status |
|------|----------------|
| External Integration Entity | **없음** — 외부 연동 정보를 저장하는 테이블/엔티티가 전혀 없음 |
| External Integration Module | **없음** — 관련 모듈/컨트롤러/서비스 미존재 |
| API Key Encryption | **없음** — 암호화 유틸리티 미존재 |
| Registered Modules | 10개: Auth, SpuMaster, SkuMaster, ChannelMaster, ChannelProductMapping, SkuCostHistory, RawOrder, UploadHistory, ProductMasterExcel, ReportUpload |

### 2.3 Database — `db_app_sales`

| Item | Current Status |
|------|----------------|
| Existing Tables | `drd_spu_masters`, `drd_sku_masters`, `drd_channel_masters`, `drd_channel_product_mappings`, `drd_sku_cost_histories`, `drd_raw_orders`, `drd_raw_order_items`, `drd_upload_histories`, + traffic/ad report tables |
| Integration Table | **없음** |
| Column Prefix Standard | `drd_` prefix for all tables, `{3char}_` prefix for columns |
| Encryption at Rest | **없음** — 현재 어떤 테이블도 암호화 컬럼 없음 |

### 2.4 Current Problems (문제점)

1. **No centralized integration management**: 마켓플레이스 API 키, AI 키 등을 관리할 수 있는 곳이 없음
2. **Settings page is empty**: 사용자가 접근하면 "Coming Soon"만 표시
3. **No API key storage**: 추후 Shopee/TikTok API 자동 연동, AI 리포트 생성 등에 필요한 API 키를 저장할 수 없음
4. **Hardcoded integrations**: 향후 마켓플레이스 API 연동 시 환경변수나 하드코딩에 의존할 수밖에 없는 구조

---

## 3. TO-BE Requirements (요구사항 정의)

### 3.1 AS-IS → TO-BE Mapping

| Area | AS-IS | TO-BE |
|------|-------|-------|
| Settings Page | Placeholder "Coming Soon" | Card-view 설정 페이지: 외부 연동 관리 카드 |
| DB | Integration 테이블 없음 | `drd_external_integrations` 테이블 신규 |
| Backend | Integration 도메인 없음 | `external-integration` 모듈 (Controller/Service/Entity/DTO/Mapper) |
| API | 없음 | `GET/POST/PATCH/DELETE /api/v1/external-integrations` |
| Encryption | 없음 | AES-256-GCM으로 API 키 암호화 저장 |
| Service Catalog | 없음 | 사전 정의된 서비스 유형 카탈로그 (AI, Marketplace 등) |

### 3.2 New Database Table

```sql
CREATE TABLE drd_external_integrations (
  eit_id              CHAR(36)      NOT NULL PRIMARY KEY,    -- UUID PK
  ent_id              CHAR(36)      NOT NULL,                -- Entity (멀티테넌시)

  eit_category        VARCHAR(30)   NOT NULL,                -- 'AI', 'EMAIL', 'STORAGE', 'MARKETPLACE', 'ERP', 'PLATFORM'
  eit_service_code    VARCHAR(50)   NOT NULL,                -- 'openai', 'gemini', 'gmail', 'google_drive', 'shopee', 'tiktok', 'shopify', 'odoo', 'amoeba', 'cafe24', 'amazon'
  eit_service_name    VARCHAR(100)  NOT NULL,                -- Display name (e.g. "OpenAI GPT-4o")
  eit_endpoint        VARCHAR(500)  NULL,                    -- API base URL (optional, some services have fixed endpoints)
  eit_key_name        VARCHAR(100)  NULL,                    -- Key identifier (e.g. "API Key", "Client ID", "App Key")
  eit_key_value       TEXT          NULL,                    -- Encrypted API key / secret (AES-256-GCM)
  eit_extra_config    JSON          NULL,                    -- Additional config as JSON ({model, region, shop_id, etc.})

  eit_is_active       BOOLEAN       NOT NULL DEFAULT TRUE,   -- Active/Inactive toggle
  eit_last_verified_at DATETIME     NULL,                    -- Last connection test timestamp

  eit_created_at      DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  eit_updated_at      DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  eit_deleted_at      DATETIME      NULL,                    -- Soft delete

  INDEX idx_eit_ent_id (ent_id),
  INDEX idx_eit_category (ent_id, eit_category),
  UNIQUE KEY uq_eit_ent_service (ent_id, eit_service_code, eit_deleted_at)
);
```

### 3.3 Service Categories & Predefined Catalog

| Category | Service Code | Service Name | Endpoint (Default) | Key Name |
|----------|-------------|--------------|---------------------|----------|
| **AI** | `openai` | OpenAI | `https://api.openai.com/v1` | API Key |
| **AI** | `gemini` | Google Gemini | `https://generativelanguage.googleapis.com/v1` | API Key |
| **AI** | `claude` | Anthropic Claude | `https://api.anthropic.com/v1` | API Key |
| **EMAIL** | `gmail` | Gmail SMTP | `smtp.gmail.com:587` | App Password |
| **STORAGE** | `google_drive` | Google Drive | `https://www.googleapis.com/drive/v3` | Service Account Key |
| **MARKETPLACE** | `shopee` | Shopee | `https://partner.shopeemobile.com` | Partner Key |
| **MARKETPLACE** | `tiktok` | TikTok Shop | `https://open-api.tiktokglobalshop.com` | App Key |
| **MARKETPLACE** | `shopify` | Shopify | (per-store URL) | API Access Token |
| **MARKETPLACE** | `amazon` | Amazon SP-API | `https://sellingpartnerapi.amazon.com` | Access Key |
| **MARKETPLACE** | `cafe24` | Cafe24 | `https://{mall_id}.cafe24api.com` | Client ID |
| **ERP** | `odoo` | Odoo | (per-instance URL) | API Key |
| **PLATFORM** | `amoeba` | Amoeba AMA | `https://ama.amoeba.site/api/v1` | JWT Token |

### 3.4 API Design

#### 3.4.1 List Integrations
```
GET /api/v1/external-integrations
Query: ?category={AI|MARKETPLACE|...}
Response: { success, data: ExternalIntegrationResponse[], timestamp }
```

#### 3.4.2 Create Integration
```
POST /api/v1/external-integrations
Body (snake_case): {
  category: string,
  service_code: string,
  service_name: string,
  endpoint?: string,
  key_name?: string,
  key_value?: string,       // Plain text → encrypted before storage
  extra_config?: object,
  is_active?: boolean
}
Response: { success, data: ExternalIntegrationResponse, timestamp }
```

#### 3.4.3 Update Integration
```
PATCH /api/v1/external-integrations/:eit_id
Body: partial of create body
Response: { success, data: ExternalIntegrationResponse, timestamp }
```

#### 3.4.4 Delete Integration (Soft)
```
DELETE /api/v1/external-integrations/:eit_id
Response: { success, data: null, timestamp }
```

#### 3.4.5 Response DTO (camelCase)
```typescript
interface ExternalIntegrationResponse {
  eitId: string;
  category: string;
  serviceCode: string;
  serviceName: string;
  endpoint: string | null;
  keyName: string | null;
  hasKeyValue: boolean;       // true if key_value is stored (절대 원문 반환하지 않음)
  extraConfig: object | null;
  isActive: boolean;
  lastVerifiedAt: string | null;
  createdAt: string;
  updatedAt: string;
}
```
> **Security**: `key_value` 원문은 절대 API 응답에 포함하지 않음. `hasKeyValue` boolean으로만 존재 여부 표시.

### 3.5 UI Design (Settings Page — Card View)

```
┌──────────────────────────────────────────────────────────────┐
│  ⚙ Settings (설정)                                          │
│                                                              │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │  🔗 External Integrations (외부 연동 설정)              │ │
│  │      Manage API keys and service connections            │ │
│  │                                                [+ 추가] │ │
│  │                                                         │ │
│  │  ┌──── AI ───────────────────────────────────────────┐  │ │
│  │  │ 🤖 OpenAI     api.openai.com      🔑 ●●●     ✅  │  │ │
│  │  │ 🤖 Gemini     generativelanguage.. 🔑 ●●●     ✅  │  │ │
│  │  └───────────────────────────────────────────────────┘  │ │
│  │                                                         │ │
│  │  ┌──── MARKETPLACE ──────────────────────────────────┐  │ │
│  │  │ 🛒 Shopee     partner.shopee..     🔑 ●●●     ✅  │  │ │
│  │  │ 🛒 TikTok     open-api.tiktok..   🔑 ●●●     ✅  │  │ │
│  │  │ 🛒 Shopify    mystore.myshopify..  🔑 ●●●     ⬜  │  │ │
│  │  └───────────────────────────────────────────────────┘  │ │
│  │                                                         │ │
│  │  ┌──── ERP ──────────────────────────────────────────┐  │ │
│  │  │ 📦 Odoo       erp.company.com     🔑 ●●●     ✅  │  │ │
│  │  └───────────────────────────────────────────────────┘  │ │
│  └─────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────┘
```

**Add/Edit Modal**:
```
┌──────────────────────────────────────┐
│  🔗 Add Integration (연동 추가)      │
│                                      │
│  Category *     [ AI          ▼ ]    │
│  Service *      [ OpenAI      ▼ ]    │
│  Service Name   [ OpenAI GPT-4o   ]  │
│  Endpoint       [ https://api.o... ] │
│  Key Name       [ API Key         ]  │
│  Key Value      [ sk-proj-...     ]  │
│  Extra Config   [ {"model":"g..."}]  │
│                                      │
│  ☐ Active                            │
│                                      │
│           [ Cancel ]  [ Save ]       │
└──────────────────────────────────────┘
```

---

## 4. Gap Analysis (갭 분석)

### 4.1 Change Scope Summary

| Area | Current | Change | Impact |
|------|---------|--------|--------|
| DB Table | 없음 | `drd_external_integrations` 신규 생성 | LOW — 기존 테이블 영향 없음 |
| Backend Entity | 없음 | `ExternalIntegrationEntity` 신규 | LOW |
| Backend Module | 없음 | `ExternalIntegrationModule` (Controller/Service/DTO/Mapper) 신규 | LOW |
| Backend Encryption | 없음 | `CryptoUtil` AES-256-GCM 유틸리티 신규 | LOW |
| App Module | 10 modules | + `ExternalIntegrationModule` 등록 | LOW |
| Frontend Page | Placeholder | SettingsPage 전면 교체 (Card view + CRUD modal) | MEDIUM |
| Frontend Service | 없음 | `integration.service.ts` 신규 | LOW |
| Frontend Hook | 없음 | `useIntegrations.ts` 신규 | LOW |
| i18n | 3 keys (settings 관련) | 50+ keys 추가 (settings.* namespace) | LOW |
| Route | `/settings` 기존 유지 | 변경 없음 | NONE |

### 4.2 File Change List

| Type | File | Change |
|------|------|--------|
| **Backend** | `src/domain/external-integration/entity/external-integration.entity.ts` | NEW |
| **Backend** | `src/domain/external-integration/dto/request/create-external-integration.request.ts` | NEW |
| **Backend** | `src/domain/external-integration/dto/request/update-external-integration.request.ts` | NEW |
| **Backend** | `src/domain/external-integration/dto/response/external-integration.response.ts` | NEW |
| **Backend** | `src/domain/external-integration/mapper/external-integration.mapper.ts` | NEW |
| **Backend** | `src/domain/external-integration/external-integration.service.ts` | NEW |
| **Backend** | `src/domain/external-integration/external-integration.controller.ts` | NEW |
| **Backend** | `src/domain/external-integration/external-integration.module.ts` | NEW |
| **Backend** | `src/domain/external-integration/constant/service-catalog.constant.ts` | NEW |
| **Backend** | `src/common/utils/crypto.util.ts` | NEW |
| **Backend** | `src/app.module.ts` | MODIFY — add ExternalIntegrationModule |
| **Frontend** | `src/pages/SettingsPage.tsx` | MODIFY — replace placeholder with card view |
| **Frontend** | `src/services/integration.service.ts` | NEW |
| **Frontend** | `src/hooks/useIntegrations.ts` | NEW |
| **Frontend** | `src/i18n/locales/ko/sales.json` | MODIFY — add `settings.*` keys |
| **Frontend** | `src/i18n/locales/en/sales.json` | MODIFY — add `settings.*` keys |
| **Frontend** | `src/i18n/locales/vi/sales.json` | MODIFY — add `settings.*` keys |

### 4.3 DB Migration Strategy

- **Staging**: `DB_SYNC=true` → TypeORM synchronize가 자동 생성. 단, 이전 세션에서 sync가 실패(sku_description)한 사례 있으므로 수동 SQL도 준비.
- **Production**: `DB_SYNC=false` → 수동 ALTER/CREATE 필수. 아래 SQL 사용.

```sql
-- Production migration SQL
CREATE TABLE IF NOT EXISTS drd_external_integrations (
  eit_id              CHAR(36)      NOT NULL,
  ent_id              CHAR(36)      NOT NULL,
  eit_category        VARCHAR(30)   NOT NULL,
  eit_service_code    VARCHAR(50)   NOT NULL,
  eit_service_name    VARCHAR(100)  NOT NULL,
  eit_endpoint        VARCHAR(500)  NULL,
  eit_key_name        VARCHAR(100)  NULL,
  eit_key_value       TEXT          NULL,
  eit_extra_config    JSON          NULL,
  eit_is_active       TINYINT(1)    NOT NULL DEFAULT 1,
  eit_last_verified_at DATETIME     NULL,
  eit_created_at      DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  eit_updated_at      DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  eit_deleted_at      DATETIME      NULL,
  PRIMARY KEY (eit_id),
  INDEX idx_eit_ent_id (ent_id),
  INDEX idx_eit_category (ent_id, eit_category),
  UNIQUE KEY uq_eit_ent_service (ent_id, eit_service_code, eit_deleted_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

---

## 5. User Flow (사용자 흐름)

### 5.1 View Integrations (연동 목록 조회)

```
User → /settings 접근
  → SettingsPage 로드
  → GET /api/v1/external-integrations 호출
  → 카테고리별 그룹핑된 카드 목록 표시
    ├── AI 섹션: OpenAI, Gemini, Claude 등
    ├── MARKETPLACE 섹션: Shopee, TikTok, Shopify 등
    ├── EMAIL 섹션: Gmail
    ├── STORAGE 섹션: Google Drive
    ├── ERP 섹션: Odoo
    └── PLATFORM 섹션: Amoeba
  → 각 카드에 서비스명, endpoint 축약, 키 존재 여부(●●●), 활성 상태 표시
```

### 5.2 Add New Integration (연동 추가)

```
User → [+ 추가] 버튼 클릭
  → AddIntegrationModal 표시
  → Category 드롭다운 선택 (AI, MARKETPLACE, ...)
    → Service 드롭다운 자동 필터링 (해당 카테고리의 서비스만)
    → Service 선택 시 기본 endpoint/key_name 자동 채움
  → Key Value 입력 (password 타입, 토글로 보기 가능)
  → Extra Config (optional JSON editor)
  → [Save] 클릭
    → POST /api/v1/external-integrations
    → key_value AES-256-GCM 암호화 후 DB 저장
    → 성공 → 목록 갱신, toast 표시
```

### 5.3 Edit Integration (연동 수정)

```
User → 카드의 [편집] 아이콘 클릭
  → EditIntegrationModal 표시 (기존 값 pre-fill)
  → key_value 필드: "●●●●●●●●" 표시 (마스킹)
    → 변경 원하면 새 값 입력, 비우면 기존 값 유지
  → [Save] → PATCH /api/v1/external-integrations/:eit_id
  → 성공 → 목록 갱신
```

### 5.4 Delete Integration (연동 삭제)

```
User → 카드의 [삭제] 아이콘 클릭
  → 확인 다이얼로그 표시
  → [확인] → DELETE /api/v1/external-integrations/:eit_id
  → Soft delete (eit_deleted_at 설정)
  → 목록 갱신
```

### 5.5 Toggle Active/Inactive (활성/비활성 토글)

```
User → 카드의 활성 토글 스위치 클릭
  → PATCH /api/v1/external-integrations/:eit_id { is_active: !current }
  → 즉시 UI 반영
```

---

## 6. Technical Constraints (기술 제약사항)

### 6.1 Security

| Concern | Mitigation |
|---------|-----------|
| API Key Storage | AES-256-GCM 암호화. 환경변수 `ENCRYPTION_KEY` (32 byte hex) 사용 |
| API Response | `key_value` 원문 절대 응답에 포함하지 않음. `hasKeyValue: boolean`만 제공 |
| Key Update | 새 값 입력 시만 암호화 재저장, 빈 값이면 기존 유지 |
| XSS | `extra_config` JSON은 서버에서 `JSON.parse → JSON.stringify` 검증 후 저장 |
| CSRF | JWT Bearer 인증으로 보호됨 |

### 6.2 Compatibility

| Item | Constraint |
|------|-----------|
| MySQL 8.0 | JSON 컬럼 타입 네이티브 지원. `extra_config`에 활용 |
| TypeORM 0.3.x | `type: 'json'` 지원. `simple-json`이 아닌 네이티브 json 사용 |
| Unique Constraint | `(ent_id, service_code, deleted_at)` — soft delete 고려한 복합 유니크 |
| Encryption Key | `.env`에 `ENCRYPTION_KEY` 환경변수 추가 필요 (스테이징/프로덕션) |

### 6.3 Performance

- 테이블 크기: Entity당 10~30건 수준 (소규모). 인덱스만으로 충분
- 암호화/복호화: AES-256-GCM은 ms 단위 — 성능 영향 무시 가능
- 목록 조회 시 key_value 복호화 불필요 (hasKeyValue만 반환)
