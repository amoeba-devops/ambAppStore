---
document_id: APPSTORE-PLT-LANDING-WP-1.0.0
version: 1.0.0
status: Draft
created: 2026-03-27
updated: 2026-03-27
author: Kim Igyong
reviewers: []
related:
  - APPSTORE-PLT-LANDING-REQ-1.0.0 (요구사항분석서)
change_log:
  - version: 1.0.0
    date: 2026-03-27
    author: Kim Igyong
    description: Initial draft — Platform Landing & App Subscription Work Plan
---

# ambAppStore — Platform Landing & App Subscription
# Work Plan (작업계획서)

---

## 1. Overview (개요)

### 1.1 Project Scope (프로젝트 범위)

ambAppStore 플랫폼의 **서비스 안내 페이지**, **앱 구독 관리**, **어드민 관리** 기능을 구현한다.
모노레포 스캐폴딩부터 Platform BFF(NestJS :3100) + Landing SPA(React) 배포까지의 전체 구현 계획.

### 1.2 Deployment Target (배포 대상)

| Environment | Branch | Host |
|-------------|--------|------|
| **Staging** | `main` | `apps.amoeba.site` |
| Production | `production` | *향후 구성* |

### 1.3 Key Assumptions (전제 조건)

- AMA JWT SSO는 이미 ama.amoeba.site에서 발급 가능 (기존 인프라)
- MySQL 8.0 서버 구동 중 (스테이징 서버: `amb-staging`)
- Docker + Nginx 기본 설정 완료
- GitHub 리포지토리 생성 완료 (`KimIgyong/ambAppStore`)

---

## 2. Milestone Plan (마일스톤 계획)

| # | Milestone | Scope | Duration | Dependencies |
|---|-----------|-------|----------|-------------|
| M1 | **Project Scaffolding** | 모노레포 구조, 공유 설정, 빈 앱 구조 | 1 단위 | — |
| M2 | **Platform Backend Core** | DB 스키마, Entity, App CRUD API, Auth Guard | 2 단위 | M1 |
| M3 | **Platform Frontend — Landing** | 앱 카드뷰, 앱 상세 페이지, 구독 신청 | 2 단위 | M2 |
| M4 | **Admin Backend + Frontend** | 구독 관리, 앱 마스터 관리, 통계 | 2 단위 | M2 |
| M5 | **Integration & Deployment** | AMA JWT 연동 테스트, Docker, Nginx, Staging 배포 | 1 단위 | M3, M4 |

---

## 3. WBS — Work Breakdown Structure (작업 분해 구조)

### Phase 1: Project Scaffolding (M1)

| WBS | Task | Output | FR/NFR |
|-----|------|--------|--------|
| 1.1 | Turborepo + npm workspaces 초기화 | `turbo.json`, root `package.json` | — |
| 1.2 | 공유 설정 패키지 생성 | `packages/eslint-config/`, `packages/tsconfig/` | — |
| 1.3 | Platform Frontend 프로젝트 생성 (Vite + React + TS + Tailwind) | `apps/platform/frontend/` | — |
| 1.4 | Platform Backend 프로젝트 생성 (NestJS + TypeORM) | `apps/platform/backend/` | — |
| 1.5 | 환경변수 템플릿 생성 | `.env.example` (FE/BE 각각) | — |
| 1.6 | Docker Compose 작성 (Platform BFF + MySQL) | `docker-compose.platform.yml` | — |
| 1.7 | Nginx 기본 라우팅 설정 | `platform/nginx/apps.amoeba.site.conf` | — |
| 1.8 | Git 초기 커밋 + main 브랜치 보호 규칙 설정 | GitHub settings | — |

### Phase 2: Platform Backend Core (M2)

#### 2A. Database & Entity (DB 및 엔티티)

| WBS | Task | Output | FR/NFR |
|-----|------|--------|--------|
| 2A.1 | `db_app_platform` DB 생성 + 초기 마이그레이션 스크립트 | `scripts/init-db.sql` | — |
| 2A.2 | `plt_apps` 테이블 생성 및 TypeORM Entity 작성 | `app.entity.ts` | FR-PLT-501 |
| 2A.3 | `plt_subscriptions` 테이블 생성 및 TypeORM Entity 작성 | `subscription.entity.ts` | FR-PLT-301 |
| 2A.4 | 인덱스 및 FK 생성 스크립트 | `scripts/init-db.sql` (추가) | NFR-PLT-001 |
| 2A.5 | 초기 앱 마스터 Seed 데이터 (4개 앱) | `scripts/seed-apps.sql` | — |

#### 2B. Auth Module (인증 모듈)

| WBS | Task | Output | FR/NFR |
|-----|------|--------|--------|
| 2B.1 | JWT Strategy + AmaJwtPayload 인터페이스 | `auth/jwt.strategy.ts` | — |
| 2B.2 | `@Auth()`, `@Public()`, `@AdminOnly()` 데코레이터 구현 | `auth/decorators/` | NFR-PLT-005 |
| 2B.3 | `@CurrentUser()` 파라미터 데코레이터 | `auth/decorators/current-user.decorator.ts` | — |
| 2B.4 | JwtAuthGuard + RoleGuard 구현 | `auth/guards/` | NFR-PLT-005 |
| 2B.5 | SubscriptionGuard (앱 구독 검증) | `auth/guards/subscription.guard.ts` | — |

#### 2C. Platform App Module (앱 마스터 API)

| WBS | Task | Output | FR/NFR |
|-----|------|--------|--------|
| 2C.1 | AppService — `findAll()`, `findBySlug()` | `app.service.ts` | FR-PLT-101, 201 |
| 2C.2 | AppController — `GET /platform/apps`, `GET /platform/apps/:slug` | `app.controller.ts` | FR-PLT-101, 201 |
| 2C.3 | AppCardResponse, AppDetailResponse DTO | `dto/response/` | FR-PLT-102, 201 |
| 2C.4 | AppMapper (Entity → Response 변환) | `app.mapper.ts` | — |
| 2C.5 | AppModule 등록 | `app.module.ts` | — |

#### 2D. Platform Subscription Module (구독 API)

| WBS | Task | Output | FR/NFR |
|-----|------|--------|--------|
| 2D.1 | CreateSubscriptionRequest DTO + Zod validation | `dto/request/create-subscription.dto.ts` | FR-PLT-301, 304 |
| 2D.2 | SubscriptionService — `create()`, `findMySubscriptions()`, `checkStatus()` | `subscription.service.ts` | FR-PLT-301~306 |
| 2D.3 | 중복 신청 방지 로직 (ent_id + app_id + status 검증) | `subscription.service.ts` | FR-PLT-303 |
| 2D.4 | SubscriptionController — Public 사용자 API 3개 | `subscription.controller.ts` | FR-PLT-301~306 |
| 2D.5 | SubscriptionResponse, SubscriptionStatusResponse DTO | `dto/response/` | — |
| 2D.6 | SubscriptionMapper | `subscription.mapper.ts` | — |
| 2D.7 | SubscriptionModule 등록 | `subscription.module.ts` | — |

#### 2E. Common & Infra

| WBS | Task | Output | FR/NFR |
|-----|------|--------|--------|
| 2E.1 | BaseResponse, BaseListResponse, BaseSingleResponse 타입 정의 | `common/dto/` | — |
| 2E.2 | BusinessException + errorCode 패턴 | `common/exceptions/` | — |
| 2E.3 | GlobalExceptionFilter | `common/filters/` | — |
| 2E.4 | Health check endpoint (`/health`) | `app.controller.ts` | — |
| 2E.5 | CORS 설정 (ama.amoeba.site, apps.amoeba.site) | `main.ts` | NFR-PLT-008 |
| 2E.6 | Input validation pipe (class-validator + class-transformer) | `main.ts` | NFR-PLT-003, 007 |

### Phase 3: Platform Frontend — Landing (M3)

#### 3A. Project Setup

| WBS | Task | Output | FR/NFR |
|-----|------|--------|--------|
| 3A.1 | Vite config (`base: '/'`), TailwindCSS, React Router | `vite.config.ts` etc | — |
| 3A.2 | API Client (axios) + interceptor (JWT 자동 첨부) | `lib/api-client.ts` | — |
| 3A.3 | React Query 설정 (QueryClient, staleTime 30s) | `lib/query-client.ts` | — |
| 3A.4 | i18n 설정 (ko/en, platform 네임스페이스) | `i18n/`, `locales/` | NFR-PLT-006 |
| 3A.5 | Auth context/store (JWT 상태, 사용자 정보) | `stores/auth.store.ts` | — |
| 3A.6 | 공통 Layout 컴포넌트 (Header, Footer) | `components/layout/` | — |

#### 3B. Landing Page (서비스 안내 페이지)

| WBS | Task | Output | FR/NFR |
|-----|------|--------|--------|
| 3B.1 | `AppCard` 컴포넌트 (아이콘, 이름, 설명, 상태 뱃지) | `components/AppCard.tsx` | FR-PLT-102, 103, 105 |
| 3B.2 | `LandingPage` — 카드 그리드 레이아웃 (반응형 3/2/1열) | `pages/LandingPage.tsx` | FR-PLT-101, NFR-PLT-002 |
| 3B.3 | `useApps()` React Query 훅 — `GET /platform/apps` | `hooks/useApps.ts` | FR-PLT-101 |
| 3B.4 | 구독 상태 뱃지 조건부 렌더링 (Available / Coming Soon / In Use) | `AppCard.tsx` | FR-PLT-103, 105 |
| 3B.5 | Hero 섹션 (타이틀 + 설명 텍스트) | `LandingPage.tsx` | — |

#### 3C. App Detail Page (앱 기능 설명 페이지)

| WBS | Task | Output | FR/NFR |
|-----|------|--------|--------|
| 3C.1 | `AppDetailPage` — 앱 상세 레이아웃 | `pages/AppDetailPage.tsx` | FR-PLT-201, 203 |
| 3C.2 | `useAppDetail()` React Query 훅 — `GET /platform/apps/:slug` | `hooks/useAppDetail.ts` | FR-PLT-201 |
| 3C.3 | `ScreenshotCarousel` 컴포넌트 (이미지 캐러셀) | `components/ScreenshotCarousel.tsx` | FR-PLT-202 |
| 3C.4 | `FeatureList` 컴포넌트 (주요 기능 아이콘 리스트) | `components/FeatureList.tsx` | FR-PLT-203 |
| 3C.5 | 구독 상태별 액션 버튼 분기 (신청/사용중/심사중/로그인) | `AppDetailPage.tsx` | FR-PLT-204~208 |
| 3C.6 | `useSubscriptionCheck()` 훅 — `GET /subscriptions/check/:slug` | `hooks/useSubscriptionCheck.ts` | FR-PLT-205, 206 |

#### 3D. Subscription Request (앱 사용 신청)

| WBS | Task | Output | FR/NFR |
|-----|------|--------|--------|
| 3D.1 | `SubscriptionRequestModal` — Entity Code/Name + 신청 사유 폼 | `components/SubscriptionRequestModal.tsx` | FR-PLT-301, 302 |
| 3D.2 | React Hook Form + Zod validation (Entity Code 형식 검증) | `SubscriptionRequestModal.tsx` | FR-PLT-304 |
| 3D.3 | `useCreateSubscription()` mutation 훅 — `POST /subscriptions` | `hooks/useSubscription.ts` | FR-PLT-301, 305 |
| 3D.4 | 신청 완료 확인 다이얼로그 | `SubscriptionRequestModal.tsx` | FR-PLT-305 |
| 3D.5 | 중복 신청 시 에러 메시지 처리 | `SubscriptionRequestModal.tsx` | FR-PLT-303 |

### Phase 4: Admin Backend + Frontend (M4)

#### 4A. Admin Backend

| WBS | Task | Output | FR/NFR |
|-----|------|--------|--------|
| 4A.1 | AdminSubscriptionController — 7개 엔드포인트 (목록, 상세, 승인, 반려, 정지, 해제, 재활성화) | `admin-subscription.controller.ts` | FR-PLT-401~410 |
| 4A.2 | AdminSubscriptionService — 상태 전이 로직 (State Machine) | `admin-subscription.service.ts` | FR-PLT-404~408 |
| 4A.3 | 상태 전이 검증 (허용되지 않은 전이 차단) | `admin-subscription.service.ts` | FR-PLT-404~408 |
| 4A.4 | AdminAppController — 4개 엔드포인트 (목록, 등록, 수정, 삭제) | `admin-app.controller.ts` | FR-PLT-501~505 |
| 4A.5 | AdminAppService — App CRUD + soft delete | `admin-app.service.ts` | FR-PLT-501~505 |
| 4A.6 | 구독 통계 API (`GET /admin/stats/subscriptions`) | `admin-stats.controller.ts` | FR-PLT-506 |
| 4A.7 | Admin Request/Response DTO 일체 | `admin/dto/` | — |
| 4A.8 | AdminModule 등록 | `admin.module.ts` | — |

#### 4B. Admin Frontend

| WBS | Task | Output | FR/NFR |
|-----|------|--------|--------|
| 4B.1 | Admin Layout (사이드바: 앱 관리, 구독 관리, 통계) | `components/admin/AdminLayout.tsx` | — |
| 4B.2 | Admin Route Guard (ADMIN role 검증) | `components/admin/AdminGuard.tsx` | NFR-PLT-005 |
| 4B.3 | `AdminSubscriptionListPage` — 필터, 검색, 페이지네이션 | `pages/admin/AdminSubscriptionListPage.tsx` | FR-PLT-401~403 |
| 4B.4 | 승인/반려 액션 모달 (반려 시 사유 입력) | `components/admin/ApproveRejectModal.tsx` | FR-PLT-404, 405 |
| 4B.5 | 구독 상세 모달/페이지 (Entity 정보, 상태 이력) | `components/admin/SubscriptionDetailModal.tsx` | FR-PLT-410 |
| 4B.6 | `AdminAppListPage` — 앱 목록, 상태 변경 | `pages/admin/AdminAppListPage.tsx` | FR-PLT-501, 504 |
| 4B.7 | `AppFormModal` — 앱 등록/수정 폼 | `components/admin/AppFormModal.tsx` | FR-PLT-502, 503 |
| 4B.8 | Admin React Query 훅 일체 | `hooks/admin/` | — |
| 4B.9 | Admin i18n JSON (ko/en) | `locales/ko/admin.json`, `en/admin.json` | NFR-PLT-006 |

### Phase 5: Integration & Deployment (M5)

| WBS | Task | Output | FR/NFR |
|-----|------|--------|--------|
| 5.1 | AMA JWT 토큰 연동 테스트 (ama.amoeba.site ↔ apps.amoeba.site) | 테스트 결과 | — |
| 5.2 | SubscriptionGuard E2E 검증 (구독 없는 Entity 접근 차단 확인) | 테스트 결과 | — |
| 5.3 | Docker Compose 최종 구성 (platform BFF + MySQL + Nginx) | `docker-compose.platform.yml` | — |
| 5.4 | Nginx 라우팅 최종 설정 (`/`, `/api/*`, `/admin/*`) | `apps.amoeba.site.conf` | — |
| 5.5 | 환경변수 스테이징 설정 (`docker/staging/.env.staging`) | `.env.staging` | — |
| 5.6 | 배포 스크립트 작성/갱신 (`deploy-staging.sh`) | `platform/scripts/deploy.sh` | — |
| 5.7 | Staging 서버 배포 + 스모크 테스트 | 배포 완료 | — |
| 5.8 | 빌드된 JS에 잘못된 도메인 없는지 검증 | 검증 결과 | — |

---

## 4. Task Dependency Graph (작업 의존 관계)

```
Phase 1 (Scaffolding)
  │
  ├── 1.1~1.3 ─┐
  └── 1.4~1.8 ─┤
               │
Phase 2 (Backend Core)
  │
  ├── 2E (Common) ──────┐
  ├── 2B (Auth) ─────────┤
  ├── 2A (DB/Entity) ────┤
  │                      │
  ├── 2C (App API) ◀─────┤ depends on 2A, 2E
  └── 2D (Sub API) ◀─────┘ depends on 2A, 2B, 2E
               │
    ┌──────────┼──────────┐
    ▼                     ▼
Phase 3 (Frontend)    Phase 4 (Admin)
    │                     │   ← 병렬 진행 가능
    └──────────┬──────────┘
               ▼
Phase 5 (Integration & Deploy)
```

**핵심 경로**: Phase 1 → Phase 2 (2A→2C/2D) → Phase 3 + Phase 4 (병렬) → Phase 5

---

## 5. File Structure Plan (생성 파일 구조 계획)

```
ambAppStore/
├── apps/
│   └── platform/                              # Phase 1
│       ├── frontend/                          # Phase 3
│       │   ├── src/
│       │   │   ├── components/
│       │   │   │   ├── layout/
│       │   │   │   │   ├── Header.tsx
│       │   │   │   │   └── Footer.tsx
│       │   │   │   ├── admin/
│       │   │   │   │   ├── AdminLayout.tsx        # 4B.1
│       │   │   │   │   ├── AdminGuard.tsx         # 4B.2
│       │   │   │   │   ├── ApproveRejectModal.tsx # 4B.4
│       │   │   │   │   ├── SubscriptionDetailModal.tsx  # 4B.5
│       │   │   │   │   └── AppFormModal.tsx       # 4B.7
│       │   │   │   ├── AppCard.tsx                # 3B.1
│       │   │   │   ├── ScreenshotCarousel.tsx     # 3C.3
│       │   │   │   ├── FeatureList.tsx            # 3C.4
│       │   │   │   └── SubscriptionRequestModal.tsx # 3D.1
│       │   │   ├── pages/
│       │   │   │   ├── LandingPage.tsx            # 3B.2
│       │   │   │   ├── AppDetailPage.tsx          # 3C.1
│       │   │   │   └── admin/
│       │   │   │       ├── AdminSubscriptionListPage.tsx  # 4B.3
│       │   │   │       └── AdminAppListPage.tsx   # 4B.6
│       │   │   ├── hooks/
│       │   │   │   ├── useApps.ts                 # 3B.3
│       │   │   │   ├── useAppDetail.ts            # 3C.2
│       │   │   │   ├── useSubscription.ts         # 3D.3
│       │   │   │   ├── useSubscriptionCheck.ts    # 3C.6
│       │   │   │   └── admin/                     # 4B.8
│       │   │   ├── stores/
│       │   │   │   └── auth.store.ts              # 3A.5
│       │   │   ├── lib/
│       │   │   │   ├── api-client.ts              # 3A.2
│       │   │   │   └── query-client.ts            # 3A.3
│       │   │   ├── i18n/
│       │   │   │   ├── i18n.ts                    # 3A.4
│       │   │   │   └── locales/
│       │   │   │       ├── ko/
│       │   │   │       │   ├── platform.json
│       │   │   │       │   └── admin.json         # 4B.9
│       │   │   │       └── en/
│       │   │   │           ├── platform.json
│       │   │   │           └── admin.json         # 4B.9
│       │   │   ├── App.tsx
│       │   │   └── main.tsx
│       │   ├── vite.config.ts
│       │   ├── tailwind.config.ts
│       │   ├── tsconfig.json
│       │   ├── .env.example
│       │   └── package.json
│       ├── backend/                               # Phase 2
│       │   ├── src/
│       │   │   ├── common/
│       │   │   │   ├── dto/
│       │   │   │   │   └── base-response.dto.ts   # 2E.1
│       │   │   │   ├── exceptions/
│       │   │   │   │   └── business.exception.ts  # 2E.2
│       │   │   │   └── filters/
│       │   │   │       └── global-exception.filter.ts  # 2E.3
│       │   │   ├── auth/
│       │   │   │   ├── jwt.strategy.ts            # 2B.1
│       │   │   │   ├── decorators/
│       │   │   │   │   ├── auth.decorator.ts      # 2B.2
│       │   │   │   │   └── current-user.decorator.ts  # 2B.3
│       │   │   │   ├── guards/
│       │   │   │   │   ├── jwt-auth.guard.ts      # 2B.4
│       │   │   │   │   ├── role.guard.ts          # 2B.4
│       │   │   │   │   └── subscription.guard.ts  # 2B.5
│       │   │   │   └── auth.module.ts
│       │   │   ├── platform-app/
│       │   │   │   ├── entities/
│       │   │   │   │   └── app.entity.ts          # 2A.2
│       │   │   │   ├── dto/
│       │   │   │   │   └── response/
│       │   │   │   │       ├── app-card.response.ts   # 2C.3
│       │   │   │   │       └── app-detail.response.ts # 2C.3
│       │   │   │   ├── app.mapper.ts              # 2C.4
│       │   │   │   ├── app.service.ts             # 2C.1
│       │   │   │   ├── app.controller.ts          # 2C.2
│       │   │   │   └── app.module.ts              # 2C.5
│       │   │   ├── platform-subscription/
│       │   │   │   ├── entities/
│       │   │   │   │   └── subscription.entity.ts # 2A.3
│       │   │   │   ├── dto/
│       │   │   │   │   ├── request/
│       │   │   │   │   │   └── create-subscription.dto.ts  # 2D.1
│       │   │   │   │   └── response/
│       │   │   │   │       ├── subscription.response.ts     # 2D.5
│       │   │   │   │       └── subscription-status.response.ts  # 2D.5
│       │   │   │   ├── subscription.mapper.ts     # 2D.6
│       │   │   │   ├── subscription.service.ts    # 2D.2
│       │   │   │   ├── subscription.controller.ts # 2D.4
│       │   │   │   └── subscription.module.ts     # 2D.7
│       │   │   ├── admin/
│       │   │   │   ├── dto/                       # 4A.7
│       │   │   │   ├── admin-subscription.controller.ts  # 4A.1
│       │   │   │   ├── admin-subscription.service.ts     # 4A.2
│       │   │   │   ├── admin-app.controller.ts    # 4A.4
│       │   │   │   ├── admin-app.service.ts       # 4A.5
│       │   │   │   ├── admin-stats.controller.ts  # 4A.6
│       │   │   │   └── admin.module.ts            # 4A.8
│       │   │   ├── app.module.ts
│       │   │   └── main.ts
│       │   ├── scripts/
│       │   │   ├── init-db.sql                    # 2A.1
│       │   │   └── seed-apps.sql                  # 2A.5
│       │   ├── .env.example
│       │   └── package.json
│       └── docker-compose.platform.yml            # 1.6
├── packages/
│   ├── eslint-config/                             # 1.2
│   └── tsconfig/                                  # 1.2
├── platform/
│   ├── nginx/
│   │   └── apps.amoeba.site.conf                  # 1.7
│   └── scripts/
│       └── deploy.sh                              # 5.6
├── turbo.json                                     # 1.1
└── package.json                                   # 1.1
```

---

## 6. Branch Plan per Phase (Phase별 브랜치 계획)

| Phase | Branch | PR → | Commit Convention |
|-------|--------|------|-------------------|
| Phase 1 | `platform/project-scaffolding` | → main | `chore: Turborepo 모노레포 초기화` |
| Phase 2A-2E | `feature/platform/backend-core` | → main | `feat: Platform DB 스키마 및 Core API 구현` |
| Phase 3 | `feature/platform/landing-frontend` | → main | `feat: 서비스 안내 페이지 및 구독 신청 구현` |
| Phase 4 | `feature/platform/admin` | → main | `feat: 어드민 구독 관리 및 앱 마스터 관리 구현` |
| Phase 5 | `platform/staging-deployment` | → main | `chore: Docker + Nginx Staging 배포 구성` |

---

## 7. Risk & Mitigation (리스크 및 대응)

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|-----------|
| AMA JWT 규격 변경 | JWT 파싱 실패 → 전체 인증 불가 | 낮음 | JWT payload interface를 SKILL.md에 명시, 변경 시 Auth 모듈만 수정 |
| MySQL 커넥션 풀 부족 (다수 앱 동시 운영 시) | DB 타임아웃 | 중간 | 앱별 독립 DB + connection pool size 설정, DB 모니터링 추가 |
| Nginx 라우팅 충돌 (`/` vs `/{slug}`) | SPA 라우팅 깨짐 | 중간 | Location block 순서 정밀 테스트, `try_files` fallback 검증 |
| Docker 빌드 시 VITE_* 환경변수 누락 | 잘못된 API URL 인라인 | 높음 | 반드시 `deploy-staging.sh` 사용, 직접 `docker compose build` 금지 |

---

## 8. Execution Order (실행 순서)

아래 순서로 작업을 진행한다:

```
Step 1:  Phase 1 — 모노레포 스캐폴딩 (branch: platform/project-scaffolding)
Step 2:  Phase 2 — Platform Backend Core (branch: feature/platform/backend-core)
Step 3:  Phase 3 + Phase 4 병렬 (branch: feature/platform/landing-frontend, feature/platform/admin)
Step 4:  Phase 5 — 통합 테스트 + Staging 배포 (branch: platform/staging-deployment)
```

각 Phase 완료 시 PR → main 머지 → 다음 Phase 분기.

---

*Document: APPSTORE-PLT-LANDING-WP-1.0.0 | Project: ambAppStore | Author: Kim Igyong | Created: 2026-03-27*
