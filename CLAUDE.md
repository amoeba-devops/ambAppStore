# ambAppStore - Claude Code 지침

## 프로젝트 개요
AMA(AI Management Assistant) 생태계 위에서 동작하는 파트너 앱 플랫폼.
단일 도메인(`apps.amoeba.site`) 아래 4개 독립 앱을 개발·배포한다.

### 앱 목록
| App | Slug | DB | BE Port | FE Port |
|-----|------|----|---------|---------|
| 플랫폼 (구독관리) | `/` | `db_app_platform` | :3100 | :5200 |
| 법인차량관리 | `/app-car-manager` | `db_app_car` | :3101 | :5201 |
| HS Code Tool | `/app-hscode` | `db_app_hscode` | :3102 | :5202 |
| 매출리포트 | `/app-sales-report` | `db_app_sales` | :3103 | :5203 |
| 재고관리 | `/app-stock-management` | `db_app_stock` | :3104 | :5204 |

## 기술 스택
- **Frontend**: React 18 + TypeScript 5 + TailwindCSS 3 + Vite 5
- **Backend**: NestJS 10 + TypeORM 0.3.x + MySQL 8.0
- **State**: Zustand (global) + React Query 5 (server) + React Hook Form + Zod
- **Auth**: JWT (AMA SSO Passthrough)
- **Container**: Docker + docker-compose (앱별 BFF 격리)
- **Proxy**: Nginx (SSL + Reverse Proxy)
- **모노레포**: npm workspaces + Turborepo
- **Icons**: lucide-react

## 프로젝트 구조
```
ambAppStore/
├── apps/
│   └── platform/                     # 플랫폼 (구독관리, 앱 카탈로그)
│       ├── backend/                  # NestJS BFF (포트 3100)
│       │   └── src/
│       │       ├── platform-app/     # 앱 등록 관리
│       │       ├── platform-subscription/ # 구독 관리
│       │       ├── admin/            # 관리자 API
│       │       ├── auth/             # JWT 인증 (AMA SSO)
│       │       └── common/           # DTO, 필터, 예외
│       ├── frontend/                 # React SPA (포트 5200)
│       │   └── src/
│       │       ├── components/       # UI 컴포넌트
│       │       ├── hooks/            # React Query 훅
│       │       ├── pages/            # 페이지
│       │       ├── stores/           # Zustand 스토어
│       │       ├── i18n/             # i18n 설정 + locales/
│       │       └── lib/              # api-client, utils
│       └── docker-compose.platform.yml
├── packages/
│   └── tsconfig/                     # 공유 TypeScript 설정
├── platform/
│   ├── nginx/apps.amoeba.site.conf   # Nginx 리버스 프록시
│   └── scripts/deploy-staging.sh     # 배포 스크립트
├── reference/                        # 참고 문서 (스펙, 컨벤션, 요구사항)
├── docs/                             # 분석서, 계획서
├── turbo.json
└── package.json
```

각 앱(`apps/{app-slug}/`)은 **완전 격리**: 독립 DB, 독립 Docker 컨테이너, 독립 빌드.

## AMA 연동
- 모든 앱은 `ama.amoeba.site` Entity 사용자가 앱 서비스 안내 페이지에서 신청
- AMA Entity Code(`ent_id`) 별로 앱 사용 → 멀티테넌시 격리
- 인증: AMA JWT SSO Passthrough (앱별 자체 회원가입 없음)
- 모든 주요 데이터 테이블에 `ent_id` 컬럼 필수 포함

## 코드 컨벤션

### DB 네이밍 (MySQL 8.0)
- DB: `db_app_{slug}` (예: `db_app_car`, `db_app_platform`)
- 테이블: `{prefix}_{name_plural}` (예: `car_vehicles`, `plt_apps`)
- 컬럼: `{colPrefix}_{name}` snake_case (예: `car_plate_no`, `sub_status`)
- PK: `{colPrefix}_id` (UUID, CHAR(36))
- Entity ID: `ent_id` CHAR(36) NOT NULL — 모든 주요 테이블 필수
- Soft Delete: `{colPrefix}_deleted_at` DATETIME NULL
- ENUM: 대문자 snake_case (`AVAILABLE`, `IN_USE`)

### API 규칙
- Base Path: `/api/v1`
- Request DTO: `snake_case`
- Response DTO: `camelCase`
- 표준 응답: `{ success, data, error?, timestamp }`
- Auth: `@Auth()` 데코레이터 (JWT 인증 + 구독 확인 + ent_id 추출)

### 파일 네이밍
- 컴포넌트: PascalCase (`AppCard.tsx`)
- 서비스: kebab-case (`.service.ts`)
- 스토어: kebab-case (`.store.ts`)
- 훅: `use` + PascalCase (`useApps.ts`)
- DTO: kebab-case (`.dto.ts`)
- 엔티티: kebab-case (`.entity.ts`)
- 컨트롤러: kebab-case (`.controller.ts`)
- 모듈: kebab-case (`.module.ts`)

### 에러 코드 체계
- 앱별 prefix: `CAR-E{4자리}`, `HSC-E{4자리}`, `SAL-E{4자리}`, `STK-E{4자리}`
- 플랫폼: `PLT-E{4자리}`

## 주요 명령어
```bash
npm run dev          # Turborepo — 전체 앱 동시 실행
npm run build        # 전체 빌드
npm run lint         # 린트 검사
npm run format       # Prettier 포맷팅
```

### 앱별 개발 서버 (apps/platform/ 기준)
```bash
cd apps/platform/backend && npm run dev     # 백엔드 (포트 3100)
cd apps/platform/frontend && npm run dev    # 프론트엔드 (포트 5200)
```

### Docker
```bash
cd apps/platform && docker compose -f docker-compose.platform.yml up -d   # MySQL + 앱 컨테이너
```

## 환경 변수
- 환경변수 템플릿: `apps/platform/.env.staging.example`
- Staging: `.env` 파일 (git 미포함, 서버에 직접 관리)
- 주요 변수:
  - `PORT=3100` (백엔드)
  - `DB_HOST`, `DB_PORT`, `DB_USERNAME`, `DB_PASSWORD`, `DB_DATABASE`
  - `JWT_SECRET` (AMA JWT 검증용)
  - `VITE_API_BASE_URL=/api` (프론트엔드 빌드 시점 인라인)
  - `VITE_AMA_LOGIN_URL` (AMA 로그인 페이지)

## Git 브랜치 전략

### 브랜치 구조
| 브랜치 | 용도 | 배포 환경 | 보호 |
|--------|------|-----------|------|
| `production` | 프로덕션 릴리즈 | 프로덕션 서버 (AWS 싱가포르) | PR 필수, 1명 승인 |
| `main` | 개발 통합 (기본 브랜치) | 스테이징 서버 (베트남) | PR 필수, 1명 승인 |
| `feature/*` | 기능 개발 | 로컬 | - |
| `hotfix/*` | 긴급 버그 수정 | - | - |

### 개발 플로우
1. `main`에서 `feature/{이름}` 브랜치 생성
2. 작업 완료 후 `main`으로 PR → Squash Merge
3. 스테이징 테스트 후 `main` → `production` PR → Merge Commit
4. Hotfix: `production`에서 분기 → `production` + `main` 둘 다 머지

### 배포 원칙 (반드시 준수)
- **스테이징 먼저**: 모든 배포는 반드시 스테이징(stg-apps.amoeba.site)에 먼저 배포
- **프로덕션 직접 배포 금지**: 스테이징에서 테스트 완료된 사항만 프로덕션(apps.amoeba.site)에 배포
- **플로우**: `git push main` → 스테이징 배포 → 테스트 → `main→production PR` → 프로덕션 배포

### 커밋 메시지 규칙
```
{type}: {설명}

type: feat | fix | docs | style | refactor | test | chore | hotfix
예: feat: 법인차량 등록 API 구현
```

## 인프라 및 배포

### 서버 정보
| 환경 | 도메인 | IP | SSH | 프로젝트 경로 |
|------|--------|-----|-----|------------|
| **스테이징** | `stg-apps.amoeba.site` | `14.161.40.143` | `ssh amb-staging` | `/home/ambAppStore` |
| **프로덕션** | `apps.amoeba.site` | `18.138.206.18` (AWS) | `ssh amoeba-shop` | `/var/www/apps_amoeba` |

### 환경별 접속 정보
| 환경 | Web | API | DB |
|------|-----|-----|----|
| **개발** | http://localhost:5200 | http://localhost:3100 | localhost:3306 (MySQL) |
| **스테이징** | https://stg-apps.amoeba.site | https://stg-apps.amoeba.site/api/v1 | Docker 내부 |
| **프로덕션** | https://apps.amoeba.site | https://apps.amoeba.site/api/v1 | Docker 내부 |

### Nginx 라우팅 (`apps.amoeba.site`)
| 경로 | 대상 | 용도 |
|------|------|------|
| `/` | web-platform:80 | 플랫폼 랜딩 + SPA |
| `/api/` | bff-platform:3100 | 플랫폼 API |
| `/app-car-manager/*` | 별도 BFF (3101) | 차량관리 앱 |
| `/app-hscode/*` | 별도 BFF (3102) | HS 코드 앱 |
| `/app-sales-report/*` | 별도 BFF (3103) | 매출리포트 앱 |
| `/app-stock-management/*` | 별도 BFF (3104) | 재고관리 앱 |

### 배포
```bash
# 스테이징 배포 (SSH → 서버에서 실행)
ssh amb-staging "cd /home/ambAppStore && git pull origin main && bash platform/scripts/deploy-staging.sh"

# build만
ssh amb-staging "cd /home/ambAppStore && bash platform/scripts/deploy-staging.sh build"

# restart만 (빌드 없이)
ssh amb-staging "cd /home/ambAppStore && bash platform/scripts/deploy-staging.sh restart"

# 배포 후 검증
ssh amb-staging "cd /home/ambAppStore && bash platform/scripts/deploy-staging.sh verify"
```
- **금지**: `docker compose build` 직접 실행 금지 → 반드시 `deploy-staging.sh` 스크립트를 통해 빌드 (`.env` 누락 방지)
- **금지**: 프로덕션 서버에 직접 배포 금지 → 반드시 스테이징 먼저
- **VITE 변수**: `VITE_*` 환경변수는 빌드 시점 인라인이므로 변경 시 이미지 재빌드 필수

## 요구사항 작업 워크플로우
`[요구사항]` 타이틀로 요청된 건은 반드시 아래 순서로 진행한다:

### 문서 파일명 규칙
| 문서 유형 | 파일명 패턴 | 저장 경로 |
|-----------|------------|----------|
| 요구사항분석서 | `REQ-{YYYYMMDD}-{제목}.md` | `docs/analysis/` |
| 작업계획서 | `PLAN-{YYYYMMDD}-{제목}.md` | `docs/plan/` |
| 테스트케이스 | `TC-{YYYYMMDD}-{제목}.md` | `docs/test/` |
| 작업완료보고서 | `RPT-{YYYYMMDD}-{제목}.md` | `docs/implementation/` |

### 워크플로우 순서
1. **요구사항분석서** → `docs/analysis/REQ-{YYYYMMDD}-{제목}.md`
2. **작업계획서** → `docs/plan/PLAN-{YYYYMMDD}-{제목}.md`
3. **구현** → 작업 계획서에 따른 코드 구현
4. **테스트케이스** → `docs/test/TC-{YYYYMMDD}-{제목}.md`
5. **작업완료보고서** → `docs/implementation/RPT-{YYYYMMDD}-{제목}.md`

### 요구사항분석서 필수 섹션 (순서 엄수)
> **특징**: 관련 기존 코드·DB 스키마·API를 반드시 탐색한 후 **정확한 현황 기반**으로 작성

| # | 섹션 | 내용 |
|---|------|------|
| 1 | 요구사항 요약 | 핵심 요구사항 목록 테이블 (#, 요구사항, 유형) |
| 2 | AS-IS 현황 분석 | 현재 프론트/백엔드/DB/i18n 상태, **파일경로·필드명 명시**, 문제점 분석 |
| 3 | TO-BE 요구사항 | AS-IS→TO-BE 매핑표, 신규 필드/엔티티/페이지, 비즈니스 로직, UI 설계 |
| 4 | 갭 분석 | 변경 범위 요약표 (영역×현재×변경×영향도), 파일 변경 목록, DB 마이그레이션 전략 |
| 5 | 사용자 플로우 | Step-by-Step 시나리오, 조건별 분기 (ASCII 흐름도) |
| 6 | 기술 제약사항 | 호환성, 성능, 보안 (GDPR 등) |

### 작업계획서 필수 섹션 (순서 엄수)

| # | 섹션 | 내용 |
|---|------|------|
| 1 | 시스템 개발 현황 분석 | 디렉토리 구조, 기술 스택, 기존 코드 상황, 제약사항 |
| 2 | 단계별 구현 계획 | Phase/Step 구조, 각 Step에 `└─ 사이드 임팩트: {설명}` 명시 |
| 3 | 변경 파일 목록 | 테이블 (구분: Backend/Frontend/DB/i18n × 파일 × 변경유형: 신규/수정) |
| 4 | 사이드 임팩트 분석 | 영향 범위 테이블 (범위×위험도×설명) |
| 5 | DB 마이그레이션 | 필요 시 수동 SQL 명시 (스테이징/프로덕션은 synchronize 비활성) |

## 대화 기록 및 데일리 리포트

세션 간 작업 연속성을 위해 모든 대화 내용을 로컬에 기록한다.

### 대화 로그 기록
- **경로**: `docs/log/YYYY-MM-DD/`
- **파일명**: `{HH}_{순번}_{작업요약}.md` (예: `14_01_차량관리앱구현.md`)
- **기록 시점**: 세션 시작 시 자동으로 로그 파일을 생성하고, 주요 작업 단위마다 기록을 갱신한다
- **기록 내용**:
  - 사용자 요청 원문
  - 수행한 작업 내용 요약
  - 변경된 파일 목록
  - 발생한 이슈 및 해결 방법
  - 미완료 항목 (다음 세션에서 이어갈 내용)
- **git 제외**: `docs/log/` 폴더는 `.gitignore`에 등록되어 git에 동기화하지 않음

### 데일리 작업 리포트
- **경로**: `docs/log/YYYY-MM-DD/DAILY-REPORT.md`
- **생성 시점**: 해당 날짜의 마지막 세션 종료 시 또는 사용자 요청 시
- **내용**: 당일 모든 세션의 작업 내용을 통합 요약
  - 완료된 작업 목록
  - 변경된 파일 전체 목록
  - 배포 상태
  - 미해결 이슈 / 다음 작업 예정

## i18n 규칙
- 프론트엔드 UI 텍스트는 반드시 번역 파일(`locales/`)을 사용하고, 컴포넌트에 직접 하드코딩 금지
- 번역 키는 `useTranslation()` 훅의 `t()` 함수로 사용
- 새 네임스페이스 추가 시 `i18n.ts`에 등록 필요
- 번역 3개 언어: ko / en / vi
- 백엔드 에러 메시지는 영어 고정 (프론트에서 에러 코드 기반 번역)
