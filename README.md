# ambAppStore

> **AMA Partner App Platform** — AMA(AI Management Assistant) 생태계 위에서 동작하는 커스텀 앱 모음
>
> Host: `apps.amoeba.site` | Staging → Production 단일 서버 운영

---

## Overview (개요)

ambAppStore는 아메바컴퍼니가 운영하는 **파트너 앱 플랫폼**입니다.
단일 도메인(`apps.amoeba.site`) 하에서 여러 커스텀 앱을 독립적으로 개발·배포하며,
각 앱은 React(프론트엔드) + NestJS(백엔드) + MySQL(데이터베이스) 기반으로 구축됩니다.

```
apps.amoeba.site/
├── /app-car-manager    → 법인차량관리 (Corporate Vehicle Manager)
├── /app-hscode         → HS Code 검색·분류 도구
├── /app-sales-report   → 매출리포트
└── /app-stock-management → 재고관리예측시스템
```

---

## Apps (등록 앱 목록)

| # | App Name | Slug | Target | DB | Status |
|---|----------|------|--------|----|--------|
| 1 | 법인차량관리 Corporate Vehicle Manager | `/app-car-manager` | Amoeba 내부 | `db_app_car` | 🔨 In Dev |
| 2 | HS Code Tool | `/app-hscode` | 수출입 업무 담당자 | `db_app_hscode` | 🔨 In Dev |
| 3 | 매출리포트 | `/app-sales-report` | 경영진 | `db_app_sales` | 📋 Planned |
| 4 | 재고관리예측시스템 | `/app-stock-management` | 운영팀 | `db_app_stock` | 📋 Planned |

---

## Tech Stack (기술 스택)

| Layer | Technology |
|-------|-----------|
| Frontend | React 18 + TypeScript 5 + TailwindCSS 3 + Vite 5 |
| Backend | NestJS 10 + TypeScript 5 + TypeORM |
| Database | MySQL 8.0 (앱별 독립 DB) |
| Auth | JWT (AMA SSO Passthrough) |
| Container | Docker + docker-compose (BFF 앱별 독립 컨테이너) |
| Proxy | Nginx (SSL + Reverse Proxy) |
| CI/CD | GitHub Actions |
| Architecture | Clean Architecture + Microservices Architecture |

---

## Project Structure (프로젝트 구조)

```
ambAppStore/                          # 저장소 루트 (GitHub: ambAppStore)
├── apps/
│   ├── app-car-manager/               # 법인차량관리
│   │   ├── frontend/                 # React SPA
│   │   │   ├── src/
│   │   │   ├── vite.config.ts        # base: '/app-car-manager'
│   │   │   └── package.json
│   │   ├── backend/                  # NestJS BFF
│   │   │   ├── src/
│   │   │   └── package.json
│   │   └── docker-compose.app-car-manager.yml
│   ├── app-hscode/
│   │   ├── frontend/
│   │   ├── backend/
│   │   └── docker-compose.app-hscode.yml
│   ├── app-sales-report/
│   │   ├── frontend/
│   │   ├── backend/
│   │   └── docker-compose.app-sales-report.yml
│   └── app-stock-management/
│       ├── frontend/
│       ├── backend/
│       └── docker-compose.app-stock-management.yml
├── packages/
│   ├── eslint-config/                # 공유 ESLint 설정 (Amoeba 표준)
│   ├── tsconfig/                     # 공유 TypeScript 설정
│   └── ui-kit/                       # 공통 UI 컴포넌트 (선택 사용)
├── platform/
│   ├── nginx/
│   │   └── apps.amoeba.site.conf     # Nginx 라우팅 설정
│   └── scripts/
│       ├── deploy.sh                 # 배포 스크립트
│       └── rollback.sh               # 롤백 스크립트
├── docs/
│   ├── README.md                     # 본 문서
│   ├── project-plan.md               # 프로젝트수행계획서
│   ├── requirements.md               # 요구사항정의서
│   ├── func-definition.md            # 기능명세서
│   └── ui-spec.md                    # 화면정의서
├── .github/
│   ├── CODEOWNERS
│   └── workflows/
│       ├── ci.yml
│       └── deploy.yml
├── turbo.json
└── package.json
```

---

## Architecture (아키텍처)

### Clean Architecture (클린 아키텍처) — 백엔드 레이어

```
apps/{app}/backend/src/
├── domain/              # 엔티티, 도메인 서비스, 레포지토리 인터페이스
│   ├── entities/
│   ├── repositories/    # interface only
│   └── services/
├── application/         # 유스케이스 (비즈니스 로직)
│   └── use-cases/
├── infrastructure/      # DB 구현체, 외부 서비스 어댑터
│   ├── database/
│   │   ├── entities/    # TypeORM 엔티티
│   │   └── repositories/
│   └── external/
└── presentation/        # Controller, DTO
    ├── controllers/
    └── dto/
```

### MSA Isolation (마이크로서비스 격리)

```
Nginx (apps.amoeba.site)
│
├── /app-car-manager/*    → React SPA (dist/app-car-manager/)
│   └── /app-car-manager/api/* → NestJS BFF (Docker :3101)
│
├── /app-hscode/*        → React SPA (dist/app-hscode/)
│   └── /app-hscode/api/* → NestJS BFF (Docker :3102)
│
├── /app-sales-report/*  → React SPA (dist/app-sales-report/)
│   └── /app-sales-report/api/* → NestJS BFF (Docker :3103)
│
└── /app-stock-management/* → React SPA (dist/app-stock-management/)
    └── /app-stock-management/api/* → NestJS BFF (Docker :3104)
```

---

## DB Naming Convention (DB 네이밍 규칙)

| App | DB Name | Table Prefix | Column Prefix 예시 |
|-----|---------|-------------|-------------------|
| app-car-manager | `db_app_car` | `car_` | `car_id`, `car_plate_no` |
| app-hscode | `db_app_hscode` | `hsc_` | `hsc_id`, `hsc_code` |
| app-sales-report | `db_app_sales` | `sal_` | `sal_id`, `sal_amount` |
| app-stock-management | `db_app_stock` | `stk_` | `stk_id`, `stk_sku` |

- PK: `{prefix}_id` (UUID v4)
- Soft Delete: `{prefix}_deleted_at`
- 생성/수정: `{prefix}_created_at`, `{prefix}_updated_at`

---

## Port Allocation (포트 할당 등록부)

### App Ports (앱별 포트)

| App | Frontend (Dev) | Backend (BFF) | Container |
|-----|---------------|----------------|----------|
| app-car-manager | :5201 | :3101 | bff-app-car-manager |
| app-hscode | :5202 | :3102 | bff-app-hscode |
| app-sales-report | :5203 | :3103 | bff-app-sales-report |
| app-stock-management | :5204 | :3104 | bff-app-stock-management |

### Infrastructure Ports (인프라 포트)

| Service | Port | Container | Note |
|---------|------|-----------|------|
| Nginx (Reverse Proxy) | :80 / :443 | nginx-apps | SSL 종단, 앱 라우팅 |
| MySQL (공통) | :3306 | mysql-apps | 앱별 독립 DB (`db_app_*`) |
| Platform API | :3100 | bff-platform | 구독 관리, 앱 목록 API |

### Port Range Convention (포트 범위 규칙)

| Range | 용도 |
|-------|------|
| 3100 | Platform API (공통) |
| 3101 ~ 3199 | Backend BFF (앱별, 순차 할당) |
| 5200 | *(예약)* |
| 5201 ~ 5299 | Frontend Dev Server (앱별, 순차 할당) |

> 새 앱 추가 시 다음 가용 포트를 순차적으로 할당한다.
> 예: 5번째 앱 → FE :5205, BE :3105

---

## Branch Strategy (브랜치 전략)

### Branches

| Branch | Environment | Deploy | Protection |
|--------|-------------|--------|------------|
| `main` | Staging (`apps.amoeba.site`) | Push/Merge → 자동 배포 | PR 필수, 1인 이상 Review |
| `production` | Production | *향후 구성* — main에서 cherry-pick 또는 merge | PR 필수, PM 승인 |

> **현재 Phase**: Staging Only — `main` 브랜치만 운영. Production 서버 구성 시 `production` 브랜치 추가.

### Branch Naming Convention

```
{type}/{app-slug}/{description}
```

| Type | Pattern | 사용 시점 |
|------|---------|-----------|
| `feature` | `feature/{app-slug}/{description}` | 신규 기능 개발 |
| `fix` | `fix/{app-slug}/{description}` | 버그 수정 |
| `hotfix` | `hotfix/{app-slug}/{description}` | 긴급 수정 (main에서 분기) |
| `platform` | `platform/{description}` | 플랫폼 공통 (인프라, 공유 패키지) |
| `docs` | `docs/{description}` | 문서 작업 |

**예시**:
```
feature/app-car-manager/vehicle-crud
fix/app-hscode/search-encoding-error
hotfix/app-car-manager/jwt-expired-handling
platform/subscription-guard
docs/api-spec-update
```

### Workflow

```
일반 개발:
  main에서 분기 → feature/{app-slug}/{desc} → PR → Code Review → main 머지 → Staging 자동 배포

긴급 수정:
  main에서 분기 → hotfix/{app-slug}/{desc} → PR (간소화 리뷰) → main 머지 → Staging 자동 배포

향후 Production 추가 시:
  main (Staging 검증 완료) → PR → production 머지 → Production 배포
```

### Merge Rules

- **Squash Merge** 기본 (feature → main): 커밋 히스토리 정리
- **Merge Commit** 허용 (main → production): 이력 보존
- 머지 후 원격 feature 브랜치 **자동 삭제**
- `main` 직접 push 금지 — 반드시 PR 경유

### Commit Convention

```
{type}: {설명}

type: feat | fix | docs | style | refactor | test | chore | hotfix
```

**예시**:
```
feat: 차량 등록 API 구현
fix: 배차 충돌 검사 로직 수정
hotfix: JWT 만료 시 리다이렉트 오류 수정
docs: 요구사항분석서 v1.0 작성
chore: Docker compose 포트 정리
```

---

## Quick Start (로컬 개발 시작)

```bash
# 1. 저장소 클론
git clone git@github.com:KimIgyong/ambAppStore.git
cd ambAppStore

# 2. 의존성 설치 (루트 — Turborepo)
npm install

# 3. 특정 앱 개발 서버 실행 (예: app-car-manager)
cd apps/app-car-manager/frontend && cp .env.example .env.local
npm run dev           # Vite :5201, base: /app-car-manager

cd apps/app-car-manager/backend && cp .env.example .env
npm run start:dev     # NestJS :3101

# 4. 전체 빌드 (Turborepo)
npm run build         # affected 앱만 빌드
```

---

## Related Documents (관련 문서)

| Document | Path | Description |
|----------|------|-------------|
| 프로젝트수행계획서 | `docs/project-plan.md` | WBS, 일정, 마일스톤 |
| 요구사항정의서 | `docs/requirements.md` | 기능/비기능 요구사항 |
| 기능명세서 | `docs/func-definition.md` | API, DB 스키마, 상세 기능 |
| 화면정의서 | `docs/ui-spec.md` | 화면 흐름, 와이어프레임 |
| Partner App Requirements | `PARTNER-APP-REQ-1.2.0` | 플랫폼 요구사항 (별도) |

---

*Project: ambAppStore | Host: apps.amoeba.site | Author: Kim Igyong | Created: 2026-03-27*
