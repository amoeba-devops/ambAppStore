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
├── /car-manager        → 법인차량관리 (Corporate Vehicle Manager)
├── /app-hscode         → HS Code 검색·분류 도구
├── /app-sales-report   → 매출리포트 for SocialBean
└── /app-stock-forecast → 재고관리예측시스템 for SocialBean
```

---

## Apps (등록 앱 목록)

| # | App Name | Slug | Target | DB | Status |
|---|----------|------|--------|----|--------|
| 1 | 법인차량관리 Corporate Vehicle Manager | `/car-manager` | Amoeba 내부 | `db_app_car` | 🔨 In Dev |
| 2 | HS Code Tool | `/app-hscode` | 수출입 업무 담당자 | `db_app_hscode` | 🔨 In Dev |
| 3 | 매출리포트 for SocialBean | `/app-sales-report` | SocialBean 경영진 | `db_app_sales` | 📋 Planned |
| 4 | 재고관리예측시스템 for SocialBean | `/app-stock-forecast` | SocialBean 운영팀 | `db_app_stock` | 📋 Planned |

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
│   ├── car-manager/                  # 법인차량관리
│   │   ├── frontend/                 # React SPA
│   │   │   ├── src/
│   │   │   ├── vite.config.ts        # base: '/car-manager'
│   │   │   └── package.json
│   │   ├── backend/                  # NestJS BFF
│   │   │   ├── src/
│   │   │   └── package.json
│   │   └── docker-compose.car-manager.yml
│   ├── app-hscode/
│   │   ├── frontend/
│   │   ├── backend/
│   │   └── docker-compose.app-hscode.yml
│   ├── app-sales-report/
│   │   ├── frontend/
│   │   ├── backend/
│   │   └── docker-compose.app-sales-report.yml
│   └── app-stock-forecast/
│       ├── frontend/
│       ├── backend/
│       └── docker-compose.app-stock-forecast.yml
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
├── /car-manager/*      → React SPA (dist/car-manager/)
│   └── /car-manager/api/* → NestJS BFF (Docker :3101)
│
├── /app-hscode/*       → React SPA (dist/app-hscode/)
│   └── /app-hscode/api/* → NestJS BFF (Docker :3102)
│
├── /app-sales-report/* → React SPA (dist/app-sales-report/)
│   └── /app-sales-report/api/* → NestJS BFF (Docker :3103)
│
└── /app-stock-forecast/* → React SPA (dist/app-stock-forecast/)
    └── /app-stock-forecast/api/* → NestJS BFF (Docker :3104)
```

---

## DB Naming Convention (DB 네이밍 규칙)

| App | DB Name | Table Prefix | Column Prefix 예시 |
|-----|---------|-------------|-------------------|
| car-manager | `db_app_car` | `car_` | `car_id`, `car_plate_no` |
| app-hscode | `db_app_hscode` | `hsc_` | `hsc_id`, `hsc_code` |
| app-sales-report | `db_app_sales` | `sal_` | `sal_id`, `sal_amount` |
| app-stock-forecast | `db_app_stock` | `stk_` | `stk_id`, `stk_sku` |

- PK: `{prefix}_id` (UUID v4)
- Soft Delete: `{prefix}_deleted_at`
- 생성/수정: `{prefix}_created_at`, `{prefix}_updated_at`

---

## Port Allocation (포트 할당 등록부)

| App | Frontend (Dev) | Backend (BFF) | Container |
|-----|---------------|----------------|-----------|
| car-manager | :5201 | :3101 | bff-car-manager |
| app-hscode | :5202 | :3102 | bff-app-hscode |
| app-sales-report | :5203 | :3103 | bff-app-sales-report |
| app-stock-forecast | :5204 | :3104 | bff-app-stock-forecast |

---

## Branch Strategy (브랜치 전략)

```
main            → apps.amoeba.site (Production)
develop         → apps.amoeba.site (Staging — 자동 배포)

feature 브랜치:
  partner/{app-slug}/feature/{description}
  partner/{app-slug}/fix/{description}

PR 흐름:
  feature 브랜치 → develop (PR + Code Review) → main (릴리즈)
```

---

## Quick Start (로컬 개발 시작)

```bash
# 1. 저장소 클론
git clone git@github.com:KimIgyong/ambAppStore.git
cd ambAppStore

# 2. 의존성 설치 (루트 — Turborepo)
npm install

# 3. 특정 앱 개발 서버 실행 (예: car-manager)
cd apps/car-manager/frontend && cp .env.example .env.local
npm run dev           # Vite :5201, base: /car-manager

cd apps/car-manager/backend && cp .env.example .env
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
