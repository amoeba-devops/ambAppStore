---
document_id: HSCM-PLAN-1.0.0
version: 1.0.0
status: Draft
created: 2026-05-13
updated: 2026-05-13
app: app-hscode-manager
based_on:
  - apps/app-hscode-manager/docs/HSCODE_설계문서.md
  - apps/app-hscode-manager/docs/HSCODE_요구사항명세서.md
  - apps/app-hscode-manager/docs/HSCODE_이벤트시나리오.md
  - apps/app-hscode-manager/docs/HSCODE_작업계획서.md
---

# HS Code Manager — 앱 전체 구현 작업계획서

> 본 문서는 [HSCODE_작업계획서.md](../../apps/app-hscode-manager/docs/HSCODE_작업계획서.md) (개념/정책 수준)를 분석해 **실제 코드 구현을 위한 단계별 실행 계획**으로 풀어낸 산출물이다. 컨셉 문서가 정의한 8개 Phase 골격을 유지하되, Amoeba 코드 컨벤션·디렉토리 구조·DB 네이밍·API 패턴에 맞춰 *파일 경로·테이블 스키마·API 엔드포인트*까지 결정한다.
> 우선순위 원칙: **MVP는 Phase 0~4까지** (M1 마일스톤). 검증 루프와 에스컬레이션은 누적이 쌓인 뒤 의미가 있으므로 Phase 5~7로 분리한다. 다중 국가 어댑터 구조는 *Phase 1부터* 박는다 — 나중에 끼워 넣으면 어댑터 인터페이스가 깨진다.

---

## 목차

1. [시스템 개발 현황 분석](#1-시스템-개발-현황-분석)
2. [단계별 구현 계획 (Phase 0~8)](#2-단계별-구현-계획)
3. [변경 파일 목록](#3-변경-파일-목록)
4. [사이드 임팩트 분석](#4-사이드-임팩트-분석)
5. [DB 마이그레이션](#5-db-마이그레이션)
6. [환경 변수·인프라](#6-환경-변수·인프라)
7. [완료 기준 (마일스톤별 DoD)](#7-완료-기준)

---

## 1. 시스템 개발 현황 분석

### 1.1 현재 상태

| 항목 | 상태 | 비고 |
|------|------|------|
| `apps/app-hscode-manager/` | ✔ 디렉토리만 존재 | `docs/`만 채워진 상태 (설계 4종) |
| `apps/app-hscode-manager/backend/` | ✗ 미존재 | 전체 신규 생성 |
| `apps/app-hscode-manager/frontend/` | ✗ 미존재 | 전체 신규 생성 |
| `db_app_hscode` | ✗ 미존재 | 13개 테이블 신규 생성 |
| Docker 컴포즈 (`docker-compose.app-hscode-manager.yml`) | ✗ 미존재 | 신규 |
| Nginx 라우팅 (`/app-hscode/`, `/app-hscode/api/`) | ✔ 설정됨 | `platform/nginx/apps.amoeba.site.conf` 이미 매핑 (포트 3102) |
| Turborepo 인식 | ✔ 자동 | `apps/*` glob |
| 설계 문서 4종 | ✔ 작성 완료 | 본 계획서의 입력 |

### 1.2 기술 스택 (확정)

| 레이어 | 기술 | 버전 |
|--------|------|------|
| Backend | NestJS + Passport JWT + class-validator | 10.x (또는 11.x — car-manager와 동일) |
| ORM | TypeORM + mysql2 | 0.3.x |
| Database | MySQL | 8.0 |
| Frontend | React + react-router-dom v6 | 18.x |
| Build | Vite | 5.x |
| CSS | TailwindCSS | 3.x |
| State | Zustand (전역) + React Query (서버) | 5.x |
| Form | React Hook Form + Zod | — |
| i18n | react-i18next | — |
| Icons | lucide-react | — |
| HTTP | Axios | 1.x |
| Excel | exceljs (BE), xlsx (FE) | — |
| 비동기 큐 (Phase 2+) | @nestjs/bull + Redis (선택) 또는 in-process | — |
| AI 추론 | Anthropic SDK (Claude) | latest |
| Container | Docker + docker-compose | — |
| Port | BE 3102 / FE 5202 | CLAUDE.md 확정 |

> **결정**: car-manager가 NestJS 11을 쓰고 있으므로 hscode도 11을 채택. 신규 앱이므로 다운그레이드 비용 없음.

### 1.3 목표 디렉토리 구조

```
apps/app-hscode-manager/
├── DB-SCHEMA-hscode-manager.md            # DB 스키마 정의 문서 (Phase 0 산출)
├── docker-compose.app-hscode-manager.yml  # MySQL + BFF 컨테이너
├── .env.example
├── backend/                                # NestJS BFF (포트 3102)
│   ├── Dockerfile
│   ├── nest-cli.json
│   ├── package.json
│   ├── tsconfig.json
│   ├── scripts/
│   │   └── init-db.sql                    # 신규 환경 DB 초기화용
│   └── src/
│       ├── main.ts
│       ├── app.module.ts
│       ├── health.controller.ts
│       ├── auth/                          # AMA JWT SSO Passthrough
│       │   ├── auth.module.ts
│       │   ├── jwt.strategy.ts
│       │   ├── guards/{jwt-auth,entity-scope,role}.guard.ts
│       │   └── decorators/{auth,current-user,roles}.decorator.ts
│       ├── common/
│       │   ├── filter/http-exception.filter.ts
│       │   ├── dto/pagination.dto.ts
│       │   └── util/{normalizer,hash}.ts
│       └── domain/
│           ├── master-country/            # ImportCountry / ExportCountry
│           ├── master-exporter/           # Exporter 마스터
│           ├── master-data-source/        # ExternalDataSource 마스터
│           ├── master-fta/                # FTA 매트릭스
│           ├── inquiry/                   # Inquiry 생성/관리
│           ├── item/                      # Item 마스터·정규화
│           ├── intake/                    # 입력 채널 (직접/엑셀/바코드)
│           ├── classification/            # Classification·Candidate·컨펌
│           ├── matching/                  # 내부 매칭 + 외부 어댑터 + AI 추천
│           ├── verification/              # VerificationEvent
│           ├── expert-review/             # 전문가 크로스체크
│           ├── policy/                    # 정책 임계값 (국가별)
│           ├── admin/                     # 관리자 / KPI
│           └── external/                  # 외부 어댑터 구현 (VN/KR/...)
│               ├── interface/             # 어댑터 인터페이스
│               ├── adapter-vn-bieu-thue/  # 베트남 어댑터
│               ├── adapter-kr-customs/    # 한국 어댑터
│               └── ai-claude/             # AI 추론 어댑터
└── frontend/                              # React SPA (포트 5202)
    ├── Dockerfile
    ├── nginx.conf
    ├── package.json
    ├── tsconfig.json
    ├── vite.config.ts
    ├── tailwind.config.js
    ├── postcss.config.js
    ├── index.html
    └── src/
        ├── main.tsx
        ├── App.tsx
        ├── index.css
        ├── pages/                         # S01~S20 (와이어프레임 매핑)
        │   ├── dashboard/DashboardPage.tsx              # S01
        │   ├── inquiry/InquiryCreatePage.tsx            # S02
        │   ├── intake/IntakeChannelPage.tsx             # S03
        │   ├── intake/ExcelUploadPage.tsx               # S04
        │   ├── intake/HoldQueuePage.tsx                 # S05
        │   ├── intake/DirectInputPage.tsx               # S06
        │   ├── matching/MatchingProgressPage.tsx        # S07
        │   ├── matching/RecommendationConfirmPage.tsx   # S08
        │   ├── matching/ResponseFormPage.tsx            # S09
        │   ├── classification/ClassificationListPage.tsx# S10
        │   ├── classification/ClassificationDetailPage.tsx # S11
        │   ├── verification/VerificationRegisterPage.tsx# S12
        │   ├── verification/ReviewQueuePage.tsx         # S13
        │   ├── expert/EscalationQueuePage.tsx           # S14
        │   ├── expert/ExpertReplyPage.tsx               # S15
        │   └── admin/                                   # S16~S20
        │       ├── AdminLayoutPage.tsx
        │       ├── MasterCountryPage.tsx
        │       ├── MasterExporterPage.tsx
        │       ├── MasterDataSourcePage.tsx
        │       ├── PolicyThresholdPage.tsx
        │       ├── UserRolePage.tsx
        │       └── KpiDashboardPage.tsx
        ├── components/
        │   ├── ui/{Button,Card,Modal,AlertModal,Table,Form,...}.tsx
        │   ├── layout/{AppHeader,AppSidebar,AppLayout}.tsx
        │   ├── inquiry/InquiryCreateForm.tsx
        │   ├── intake/{CategoryDynamicForm,ExcelHeaderMapper,HoldRowEditor}.tsx
        │   ├── matching/{ProgressStepper,CandidateCard,SourceBadge,AIReasoningBox}.tsx
        │   └── verification/VerificationEventForm.tsx
        ├── hooks/                         # React Query 훅 (도메인별)
        ├── services/                      # API 클라이언트 (도메인별)
        ├── stores/                        # Zustand (auth, inquiry-draft 등)
        ├── lib/{api-client,error-codes,utils}.ts
        ├── types/                         # 도메인 타입
        └── i18n/
            ├── i18n.ts
            └── locales/{ko,en,vi}/{common,inquiry,intake,matching,admin,...}.json
```

### 1.4 제약사항 / 의존성 / 가정

- **인증**: 자체 회원가입 없음. AMA JWT SSO Passthrough만 사용 (CLAUDE.md 규정).
- **멀티테넌시**: 모든 비즈니스 테이블에 `ent_id CHAR(36) NOT NULL` 강제. Service 레이어에서 `@CurrentUser().entId`로 필터링.
- **외부 의존**:
  - 베트남 BIEU THUE XNK 2026: 데이터 라이선스/공급 형식 미확정 → Phase 1 초기 *데이터 시드 수동 로딩* 가능한 형태로 어댑터 설계.
  - Claude API: `CLAUDE_API_KEY` 환경 변수, 모델 버전은 운영에서 변경 가능하도록 `policy.ai_model_version` 필드로 보관.
- **synchronize 금지**: 스테이징/프로덕션은 TypeORM `synchronize=false`. 모든 스키마 변경은 수동 SQL 마이그레이션.
- **에러 코드**: `HSC-E{4자리}` (예: `HSC-E0001` = Inquiry not found).
- **i18n**: ko/en/vi 3개 언어, 우선순위 한>베>영. 텍스트 하드코딩 금지 (코드 리뷰 룰).

---

## 2. 단계별 구현 계획

> Phase 간 의존성은 대체로 순차적이지만, **Phase 1 마스터·권한**이 끝나면 Phase 2(Intake)와 Phase 3(Matching 엔진)의 *어댑터 인터페이스 정의*는 병렬로 시작할 수 있다. 각 Phase 끝의 DoD는 코드 머지 가능 기준이다.

### Phase 0 — 기반(Foundation) — 1~2주

> **목표**: 빈 골격이 로컬·스테이징에서 기동, DB 마이그레이션 통과, S01 빈 대시보드 라우팅, AMA JWT 검증 스텁까지.

#### Step 0.1 백엔드 골격
- NestJS 11 프로젝트 생성 (`apps/app-hscode-manager/backend/`)
- `main.ts` + `app.module.ts` + `health.controller.ts` + `auth/jwt.strategy.ts` (AMA JWT 검증) + `common/filter/http-exception.filter.ts`
- TypeORM 설정 (`db_app_hscode`, synchronize=false), MySQL 연결
- Swagger `/api/docs` 활성화
- `@Auth()` / `@CurrentUser()` 데코레이터 정의
- `└─ 사이드 임팩트`: 없음 (신규 앱). `.env.example`만 platform 패턴과 일관성 유지.

#### Step 0.2 프론트엔드 골격
- Vite + React + TS + Tailwind 프로젝트 생성 (`apps/app-hscode-manager/frontend/`)
- `App.tsx` + `react-router-dom v6` 기본 라우터
- `lib/api-client.ts` (axios 인스턴스 + AMA 토큰 인터셉터 — car-manager 패턴 복제)
- i18n 초기화 (ko/en/vi), `common.json` 네임스페이스만
- `stores/auth.store.ts` (Zustand)
- S01 빈 대시보드 페이지 (라우팅만)
- `└─ 사이드 임팩트`: vite dev 포트 5202 점유. car-manager(5201)와 충돌 없음.

#### Step 0.3 인프라 골격
- `docker-compose.app-hscode-manager.yml` 작성 — MySQL 8 + BFF 컨테이너 + Frontend(nginx 정적)
- `backend/Dockerfile`, `frontend/Dockerfile`, `frontend/nginx.conf` 작성
- `platform/scripts/deploy-staging.sh` 에 hscode 빌드/기동 단계 추가 (또는 별도 deploy 스크립트로 격리)
- `└─ 사이드 임팩트`: deploy-staging.sh 수정 — *기존 platform·car-manager 배포 흐름과 격리되어야 함*. 별도 함수로 추가하고 호출 위치 추가.

#### Step 0.4 빈 DB 스키마
- `backend/scripts/init-db.sql` 작성 (db_app_hscode 생성 + 기본 권한)
- TypeORM 엔티티 *비어 있는 5개*만 정의 (Inquiry / Item / Classification / ExpertReview / VerificationEvent) — Phase 1에서 채움
- `└─ 사이드 임팩트`: 신규 DB. 기존 DB에 영향 없음.

#### Phase 0 DoD
- [ ] 로컬에서 `npm run dev`로 BE/FE 동시 기동
- [ ] `http://localhost:3102/health` 200 OK
- [ ] `http://localhost:5202/` 빈 대시보드 렌더링
- [ ] Swagger `/api/docs` 접근 가능
- [ ] 스테이징 첫 배포 성공 (헬스체크만 검증)

---

### Phase 1 — 마스터 데이터 & 권한 — 2~3주

> **목표**: 멀티 국가 확장의 골격을 박는다. ImportCountry / ExportCountry / Exporter / ExternalDataSource / FTA Matrix 마스터, 행 수준 멀티테넌시 격리.

#### Step 1.1 도메인 모듈 `master-country`
- 엔티티 2개: `ImportCountry`, `ExportCountry`
  - `imc_id` (UUID PK), `imc_code` (ISO 3166-1 alpha-2, UNIQUE), `imc_name_ko/en/vi`, `imc_support_status` (`ACTIVE`/`BETA`/`NOT_SUPPORTED`), `imc_adapter_id` FK, `imc_created_at/updated_at/deleted_at`
  - ExportCountry는 동일 구조에 prefix `exc_`
- Controller / Service / DTO / Mapper 풀세트 (Amoeba 컨벤션)
- 관리자 권한(`role=ADMIN`)만 mutation 허용 — `@Roles('ADMIN')` 가드
- `└─ 사이드 임팩트`: 사용자 권한 체계가 *Phase 1.4에서 정의*되어야 가드가 동작 — Step 1.4 선행 의존.

#### Step 1.2 도메인 모듈 `master-exporter`
- 엔티티: `Exporter` — `exp_id`, `exp_ent_id`, `exp_name`, `exp_country_code`, `exp_aliases` (JSON), `exp_risk_flags` (JSON), 타임스탬프
- CRUD API + 검색 (수출업체명 LIKE)
- `└─ 사이드 임팩트`: 추후 Inquiry 생성에서 FK 참조. 시드 데이터로 카고러시 자주 거래 업체 ~30곳 로딩 가능하게 시드 스크립트 제공.

#### Step 1.3 도메인 모듈 `master-data-source` + `master-fta`
- `ExternalDataSource` — `eds_id`, `eds_import_country_code` FK, `eds_adapter_key` (예: `bieu_thue_xnk_2026`), `eds_endpoint_url`, `eds_cache_ttl_sec`, `eds_is_active`
- `FtaMatrix` — `fta_id`, `fta_import_country_code`, `fta_export_country_code`, `fta_agreement_code` (예: `VKFTA`, `ATIGA`, `RCEP`), `fta_hs_code`, `fta_rate` (decimal), `fta_effective_from`, `fta_effective_to`
  - 복합 UNIQUE: `(import_country, export_country, agreement, hs_code, effective_from)`
- 조회 API: `GET /api/v1/fta-matrix?import_country=VN&export_country=KR&hs_code=7220.20.10`
- `└─ 사이드 임팩트`: FTA 데이터의 시드 양이 클 수 있음 (1만~5만 행 추정). 인덱스 설계 중요.

#### Step 1.4 사용자·권한 모델 (자체 모델 + AMA 동기화)
- 엔티티: `User` (AMA에서 SSO로 들어온 사용자 캐시), `Role` (역할 정의), `UserRole` (매핑)
  - `usr_id` (= AMA user_id 그대로 사용 권장), `usr_ent_id`, `usr_name`, `usr_email`
  - 역할: `ADMIN` / `MANAGER`(담당자) / `EXPERT_LOCAL`(Mr. Nguyen 류) / `EXPERT_INTERNAL`(Ms. Hau 류) / `VIEWER`
- `EntityScopeGuard`: 모든 요청을 `ent_id`로 필터링하는 행 수준 격리 가드
- `@Roles()` 데코레이터 + `RoleGuard`
- `└─ 사이드 임팩트`: 이후 모든 도메인 Service가 `ent_id` 기반으로 동작 — 1.4 누락 시 NFR-SE-01 위반. **반드시 1.4 완료 후 Phase 2 시작**.

#### Step 1.5 프론트엔드 화면 S17 (마스터 관리), S19 (사용자·권한)
- `pages/admin/MasterCountryPage.tsx` — 수입국·수출국 탭, 지원 상태 토글, 어댑터 매핑
- `pages/admin/MasterExporterPage.tsx` — Exporter CRUD
- `pages/admin/MasterDataSourcePage.tsx` — 외부 소스 + FTA 매트릭스 (서브탭)
- `pages/admin/UserRolePage.tsx` — AMA 동기화 사용자 일람 + 역할 할당
- 메뉴/레이아웃 골격 (`AppLayout`, `AppHeader`, `AppSidebar`)
- `└─ 사이드 임팩트`: 메뉴 구조 확정 — 이후 Phase 모든 화면이 이 레이아웃에 적재됨.

#### Phase 1 DoD
- [ ] 관리자가 새 수입국을 *데이터만으로* 등록 가능 (어댑터 미연결 시 `NOT_SUPPORTED` 상태 유지)
- [ ] 수출업체 단위 권한 격리가 DB 차원에서 작동 (EntityScopeGuard 적용 + 통합 테스트)
- [ ] FTA 매트릭스 조회가 (import, export, hs_code) 3항 키로 응답 < 100ms
- [ ] S17/S19 화면 i18n 3개 언어 완성

#### Phase 1 요구사항 매핑
FR-IN-01 (부분, 수출업체·국가 마스터), DR-01, DR-03, NFR-SE-01, IR-03 (FTA 매트릭스).

---

### Phase 2 — 입력 채널(Intake) — 3~4주

> **목표**: S02→S06 입력 흐름 완성. 정규화·매칭은 다음 Phase로 미루고, 입력 결과는 *정규화 큐 테이블*에만 적재된다.

#### Step 2.1 도메인 모듈 `inquiry`
- 엔티티: `Inquiry` — `inq_id`, `inq_ent_id`, `inq_exporter_id` FK, `inq_export_country_code` FK, `inq_import_country_code` FK, `inq_title`, `inq_memo`, `inq_submitted_at`, `inq_status` (`DRAFT`/`INTAKE`/`MATCHING`/`REVIEWING`/`RESPONDED`/`VERIFIED`/`DISPUTED`), `inq_completeness_score` decimal, `inq_created_by`, 타임스탬프
- API: `POST /api/v1/inquiries`, `GET /api/v1/inquiries/:id`, `PATCH /api/v1/inquiries/:id/status`, `GET /api/v1/inquiries?...`
- S02 화면 `InquiryCreatePage.tsx` 구현 — 수입국 지원 상태에 따른 분기 (active/beta/not_supported 다이얼로그)
- `└─ 사이드 임팩트`: 수입국 `NOT_SUPPORTED` 선택 시 *추가 요청 폼* 분기 필요 — 변경 6 반영. Phase 7 관리 화면에서 그 요청을 수거하는 큐가 필요하지만, Phase 2에서는 *요청 폼 제출만* 구현하고 큐 화면은 Phase 7로 미룸.

#### Step 2.2 도메인 모듈 `item`
- 엔티티: `Item` — `itm_id`, `itm_ent_id`, `itm_name_raw`, `itm_name_normalized`, `itm_category` (`CHEMICAL`/`STEEL_MECHANICAL`/`EQUIPMENT`/`OTHER`), `itm_usage_description`, `itm_composition_hash`, `itm_spec_attributes` (JSON), `itm_gtin` nullable, 타임스탬프
- 이 단계에서는 *정규화·해시 산출은 placeholder* (Phase 3에서 본격 구현). composition_hash = SHA-256(JSON.stringify(normalized_attrs)) 임시 구현.
- API: `POST /api/v1/items`, `GET /api/v1/items/:id`, `GET /api/v1/items?...`
- `└─ 사이드 임팩트`: Phase 3에서 정규화 규칙이 바뀌면 *기존 해시 재계산 배치*가 필요해질 수 있음. 미리 `itm_normalizer_version` 컬럼을 두어 재계산 대상 식별 가능하게.

#### Step 2.3 도메인 모듈 `intake` (3개 채널)

**Step 2.3.a 직접 입력 (S06)**
- 카테고리별 동적 폼 — Frontend 컴포넌트 `CategoryDynamicForm.tsx`
- 카테고리별 스키마는 *백엔드 메타데이터*로 제공 (NFR-EM-01: 코드 변경 없이 카테고리 추가 가능)
  - `GET /api/v1/intake/category-schema?category=chemical&import_country=VN`
  - 반환: 필수/선택 필드, 검증 규칙, 베트남 수입제한 CAS 자동 조회 옵션
- 완성도 점수 산출 (FR-IN-07): 클라이언트 계산 + 서버 재계산
- API: `POST /api/v1/intake/direct` — 1건 입력
- `└─ 사이드 임팩트`: 카테고리 스키마 변경이 *런타임* 가능해야 함 — 정적 enum이 아니라 DB 메타 테이블(`hsc_category_schemas`) 권장. Phase 2에서는 *enum + DB hybrid* — 코어 4개는 enum, 신규 카테고리는 DB에서 부착.

**Step 2.3.b 엑셀 일괄 등록 (S04, S05)**
- 엔티티: `ExcelImportBatch` — `eib_id`, `eib_ent_id`, `eib_inquiry_id` FK, `eib_total_rows`, `eib_imported_rows`, `eib_hold_rows`, `eib_mapping_snapshot` (JSON), `eib_status`, 타임스탬프
- 엔티티: `HoldQueueRow` — `hqr_id`, `hqr_batch_id` FK, `hqr_row_index`, `hqr_raw_data` (JSON), `hqr_validation_errors` (JSON), `hqr_resolved_at` nullable
- API:
  - `POST /api/v1/intake/excel/upload` (multipart) — 파일 파싱·미리보기·매핑 제안 반환
  - `POST /api/v1/intake/excel/import` — 매핑 확정 후 행별 검증·적재
  - `GET /api/v1/intake/excel/batches/:id/hold` — 보류 큐 조회
  - `PATCH /api/v1/intake/excel/hold/:hqr_id` — 보류 행 수정·재검증
- exceljs로 파싱, 1,000행 미만은 동기 (NFR-PF-03), 초과는 비동기 잡 큐
- 표준 템플릿 다운로드 `GET /api/v1/intake/excel/template?category=chemical`
- `└─ 사이드 임팩트`: 비동기 잡은 *redis 기반 bull queue* 도입 시 인프라 영향. Phase 2 MVP는 *동기 1000행 제한*으로 운영, 비동기는 Phase 7 운영 단계에서 도입.

**Step 2.3.c 바코드 보조 (S03 옵션, 우선순위 낮음)**
- GTIN 스캔 → `GET /api/v1/items?gtin=...` 매칭 시도
- 매칭되면 직접 입력 폼에 프리필
- Frontend 모바일 브라우저 카메라 API 활용 (제약 많음 — Phase 2에서는 *수동 입력*만 지원, 스캔은 Phase 7에서)

**Step 2.4 고객사별 매핑 프로파일 (리스크 R5 대응)**
- 엔티티: `ExcelMappingProfile` — `emp_id`, `emp_ent_id`, `emp_exporter_id` FK, `emp_profile_name`, `emp_mapping_json`, `emp_last_used_at`
- 두 번째 업로드 시 자동 제안

#### Phase 2 DoD
- [ ] 1,000행 엑셀 업로드 시 정상/보류 분리 정확 (테스트: 20% 의도적 결손 행 포함)
- [ ] 동일 Inquiry에 직접 입력 + 엑셀 혼합 시 모든 행이 Item 큐에 정합성 유지
- [ ] 완성도 점수 0.7 미만 시 분류 단계로 진행 차단 (사유 입력 시 강제 진행 가능)
- [ ] 매핑 프로파일 저장 → 다음 업로드 시 자동 매핑 제안
- [ ] S02~S06 화면 i18n 3개 언어 완성

#### Phase 2 요구사항 매핑
FR-IN-01~08, DR-04, NFR-PF-03, FR-MA-01 (인터페이스만), NFR-EM-01 (카테고리 메타).

---

### Phase 3 — 정규화·매칭·추천 엔진 — 4~5주

> **본 앱의 가치 중심**. 3개 서브 Phase로 점진 개발.

#### Step 3.1 정규화 모듈 (`matching/normalizer`)
- 카테고리별 정규화 규칙 (백엔드 코드 기반 + 일부 DB 룰)
  - **chemical**: CAS 정규식 검증/정규화, 함량 합산 100% ±5% 검증, MSDS 파일 메타 추출 placeholder
  - **steel_mechanical**: 재질 표준명 매핑 ("스뎅" → "SUS304" 후보), 두께·치수 단위 통일 (mm)
  - **equipment**: 명판 OCR placeholder, 정격 단위 통일 (kW/V/A)
  - **other**: 정규화 생략, 자동 에스컬레이션 플래그 부착
- `composition_hash` 산출식 확정:
  - 카테고리별 정규화된 핵심 속성 → 정렬된 JSON → SHA-256 hex 16자리 prefix
- 수입국 오버레이 (변경 4): `normalizer.lookup(category, attrs, importCountry)` — 인터페이스만 두고 기본값으로 시작. 베트남 오버레이는 *키워드 사전* 1차 적용.
- API: `POST /api/v1/matching/normalize` (테스트용, 정규화 결과 미리보기)
- `└─ 사이드 임팩트`: 정규화 룰 변경 시 기존 Item의 해시가 변함 — `itm_normalizer_version` 컬럼으로 버전 추적. 재계산 배치 잡 미리 골격 마련.

#### Step 3.2 내부 매칭 엔진 (`matching/internal`)
- 우선순위 3단:
  1. `(exporter_id, import_country, composition_hash)` 정확 매칭 → 신뢰도 0.95
  2. `(import_country, composition_hash)` 정확 매칭 → 신뢰도 0.85
  3. `name_normalized` trigram + spec_attributes JSON fuzzy → 신뢰도 0.5~0.8
- 인덱스 (DR-06, DR-07 + 자체):
  - `idx_items_ent_hash` (ent_id, composition_hash)
  - `idx_items_ent_category_name` (ent_id, category, name_normalized) — FULLTEXT or trigram
  - `idx_classifications_ent_hs_code` (ent_id, hs_code)
  - `idx_classifications_exporter_import_country` (exporter_id, import_country_code, adopted_at desc)
- 신선도/위험도 게이트 (FR-MA-03):
  - 마지막 채택일 > 12개월 → 게이트 통과 안 함
  - `disputed` 코드 존재 → 게이트 통과 안 함
- API: `POST /api/v1/matching/internal` { itemId | attrs } → 후보 N개
- 성능 목표: 90p < 1.5s (NFR-PF-01)
- `└─ 사이드 임팩트`: 내부 데이터가 적은 초기엔 거의 hit 없음 → 외부 호출 비용 증가. R3 대응으로 *수동 시드 사례 적재 트랙*을 Phase 1.2 Exporter 시드와 함께 운영. Phase 7 KPI에 내부 hit율 추세 1급 지표.

#### Step 3.3 외부 어댑터 인터페이스 + 베트남 구현 (`external/`)
- 인터페이스 정의 (변경 2 — 멀티국가 어댑터 추상화):
  ```ts
  interface ExternalCustomsAdapter {
    readonly adapterKey: string;
    readonly importCountryCode: string;
    lookupByAttributes(
      attrs: NormalizedAttributes,
      options: { limit?: number; ftaContext?: FtaContext },
    ): Promise<CandidateList>;
    healthCheck(): Promise<{ ok: boolean; latencyMs: number }>;
  }
  ```
- 첫 구현: `AdapterVnBieuThue` (베트남 BIEU THUE XNK 2026)
  - 초기 단계는 *로컬 시드 DB 기반* (BIEU THUE 데이터를 `hsc_authority_hs_codes` 테이블에 적재)
  - 향후 외부 API 연동으로 교체 가능한 형태로 분리
- 두 번째: `AdapterKrCustoms` (한국 관세청 — 보조)
- 캐시: Redis 또는 in-memory LRU (24시간 TTL — IR-01)
- Fallback: 외부 미응답 시 캐시 → 캐시 없으면 빈 결과 + 신뢰도 페널티 -0.2 (X2)
- API: `GET /api/v1/matching/external?import_country=VN&...` (디버깅용)
- `└─ 사이드 임팩트`: BIEU THUE 데이터 적재 자체가 *별도 작업*. 적재 형식·라이선스 확인 필요. 초기 운영팀이 *수동으로 ~200~500개 핵심 코드*만 시드해도 MVP는 동작.

#### Step 3.4 AI 추천 어댑터 (`external/ai-claude`)
- Claude Sonnet 4.6 (또는 운영 시점 최신) 사용
- 프롬프트 구성:
  - 시스템: "당신은 베트남 수입 HS코드 분류 전문 보조자입니다. 제공된 후보 범위 내에서만 추천해야 합니다."
  - 컨텍스트: 정규화 속성 + 내부 후보 + 외부 후보 + (선택) FTA 매트릭스
  - 출력 강제: JSON 스키마 `{ candidates: [{ hsCode, confidence, reasoning, sourceCitations }] }`
- 가드레일 (FR-AI-01~03):
  - 모델 출력의 hsCode가 *컨텍스트에 없는 코드*면 폐기 + AI 결과 미반영 마커
  - JSON 파싱 실패 → 외부 검색만으로 진행 + 미반영 마커
- 로깅: `AIRecommendationLog` — `arl_id`, `arl_classification_id` nullable, `arl_prompt_hash`, `arl_model_version`, `arl_latency_ms`, `arl_cost_usd`, `arl_request_blob`, `arl_response_blob`
- 마스킹 (NFR-SE-03): 고객사명 토큰 치환 (예: `EXPORTER_${hash8}`)
- API: 내부 호출만, 외부 노출 없음
- `└─ 사이드 임팩트`: API 비용 → 운영 비용. 호출 빈도 모니터링 + 일별 한도 알람.

#### Step 3.5 후보 랭킹·세율 룰 (`matching/ranker`)
- 보수적 세율 룰 (설계문서 §2.2):
  - 격차 ≥3%p → 높은 세율 채택
  - 1~3%p → 높은 세율 + 샘플 분석 권고 플래그
  - <1%p → 신뢰도 ≥0.8일 때만 낮은 세율 채택 허용
- 가산점:
  - 동일 수출업체·수입국 과거 채택 → +0.15
  - FTA 매트릭스에 협정세율 존재 → +0.05
  - 외부 권위와 AI 추천이 *동일 코드* → +0.10
- 최종 결과: 1~5개 후보 리스트 + 각 후보의 신뢰도·세율·근거·출처
- API: `POST /api/v1/matching/run` (전체 파이프라인 통합 호출)
- `└─ 사이드 임팩트`: 임계값은 *국가별 설정 가능*해야 함 — `PolicyThreshold` 테이블 (Phase 7과 일부 선반영). Phase 3에서는 *코드 상수 + 베트남 기본값*만 두고, 관리 UI는 Phase 7.

#### Step 3.6 S07·S08 화면
- `MatchingProgressPage.tsx` — 5단계 스테퍼 (NFR-PF-02 점진 노출)
  - SSE 또는 폴링 (POST → 작업 ID → GET /status 폴링)
- `RecommendationConfirmPage.tsx` — 후보 카드 리스트, AI 근거, 외부 출처 링크, 과거 채택 강조

#### Phase 3 DoD
- [ ] 직접 입력 1건이 정규화→내부→외부→AI→랭킹 통과해 추천 리스트 표시
- [ ] 외부 API 다운 상태에서도 내부+캐시로 동작 (degraded mode)
- [ ] AI 환각률 자동 측정 메트릭 (`AIRecommendationLog`에서 `hsCode ∉ context` 비율) 대시보드 노출
- [ ] 1순위 히트율 측정 가능 (컨펌 시점 기록 — Phase 4와 동기 필요)
- [ ] 내부 매칭 90p < 1.5s, 전체 추천 90p < 8s

#### Phase 3 요구사항 매핑
FR-MA-01~05, FR-AI-01~04, IR-01·02·04, NFR-PF-01·02, NFR-AV-01, NFR-SE-03, DR-05.

---

### Phase 4 — 컨펌·영속화·응대 — 2주

#### Step 4.1 Classification 영속화
- 엔티티: `Classification` — `cls_id`, `cls_ent_id`, `cls_inquiry_id` FK, `cls_item_id` FK, `cls_hs_code`, `cls_basic_tariff_rate` decimal, `cls_fta_tariff_rate` decimal nullable, `cls_import_requirements` JSON, `cls_confidence_score` decimal, `cls_status` (`PROPOSED`/`ADOPTED`/`SEALED`/`SUPERSEDED`/`DISPUTED`), `cls_recommendation_source` (`INTERNAL`/`EXTERNAL`/`AI`/`MIXED`), `cls_ai_reasoning` text, `cls_ai_model_version` nullable, `cls_external_sources` JSON, `cls_selection_rationale` text, `cls_adopted_at`, `cls_superseded_at`, `cls_superseded_by_id` self FK nullable
- 엔티티: `ClassificationCandidate` — `cnd_id`, `cnd_classification_id` FK, `cnd_hs_code`, `cnd_tariff_rate`, `cnd_source`, `cnd_ranking`, `cnd_reasoning` text
- API:
  - `POST /api/v1/classifications` (컨펌)
  - `GET /api/v1/classifications/:id`
  - `GET /api/v1/classifications?...` (S10 누적 조회)
- 컨펌 시 트랜잭션:
  1. 중복 감지 — `(exporter, import_country, composition_hash, submitted_at)`
  2. 중복 시 사용자 선택 (`replace` vs `new`)
  3. `replace` → 기존 `SUPERSEDED` + 신규 `ADOPTED`
  4. 후보 N개 영속화
  5. Inquiry 상태 → `RESPONDED`
- 불변성 (FR-CO-05): Service 레이어에서 ADOPTED 이상 상태 변경을 차단하는 가드 + DB 트리거 보조
- `└─ 사이드 임팩트`: superseded 체인이 길어지면 조회 시 깊이 추적 비용 증가 — depth ≤ 5 가정. 그 이상 발생 시 알람.

#### Step 4.2 사유 입력 강제 (FR-CO-02)
- 동일 수출업체·수입국의 최근 채택 코드와 *다른* 후보 선택 시 `selection_rationale` 필수
- Frontend에서 강제 + Backend에서 재검증

#### Step 4.3 감사 로그 (NFR-SE-02)
- 엔티티: `AuditLog` — `aud_id`, `aud_ent_id`, `aud_user_id`, `aud_action`, `aud_target_table`, `aud_target_id`, `aud_diff_json`, `aud_ip`, `aud_created_at`
- NestJS Interceptor로 컨펌·정정·삭제 액션 자동 기록

#### Step 4.4 응대 양식 출력 (S09)
- 채널별 템플릿 — 이메일 / 카카오톡 / 사내 메신저 / PDF
- 템플릿 엔진: Handlebars 권장
- API: `GET /api/v1/classifications/:id/response-form?channel=email&lang=ko`
- 출력만 — *발송은 별도 시스템*. 클립보드 복사 또는 다운로드.
- `└─ 사이드 임팩트`: 템플릿 수정이 잦을 것 — Phase 7에서 관리자가 수정 가능하도록 DB 저장 형태로 발전 가능. Phase 4는 *코드 인-라인 템플릿*으로 시작.

#### Step 4.5 누적 조회 (S10·S11)
- `ClassificationListPage.tsx` — 필터 (수출업체/국가/기간/카테고리/HS코드/키워드), KPI 요약 (1순위 히트율·정정률)
- `ClassificationDetailPage.tsx` — 이력·근거·후보 리스트·VerificationEvent (Phase 5 후 활성)
- 1순위 히트율 = `cls_recommendation_source.ranking=1 컨펌 / 전체 컨펌`

#### Phase 4 DoD
- [ ] 컨펌 직후 S10 조회 결과에 즉시 반영
- [ ] 동일 입력이 다음 매칭에서 1순위로 회수
- [ ] 중복 감지·supersede 정상 동작
- [ ] 응대 양식 4개 채널 모두 i18n 3언어로 렌더링
- [ ] 감사 로그가 모든 mutation 액션을 기록 (테스트로 검증)

#### Phase 4 요구사항 매핑
FR-CO-01~05, FR-QU-01·02·03, DR-02, NFR-DI-01, NFR-SE-02, IR-05.

> **M1 마일스톤**: Phase 0~4 완료 = MVP 운영 가능. 누적이 시작되면 본 앱의 가치 사이클이 돌기 시작한다.

---

### Phase 5 — 검증·피드백 루프 — 2주

#### Step 5.1 VerificationEvent
- 엔티티: `VerificationEvent` — `vrf_id`, `vrf_ent_id`, `vrf_classification_id` FK, `vrf_event_type` (`SAMPLE_ANALYSIS`/`CUSTOMS_SEIZURE`/`CUSTOMS_DOUBLE_CHECK`), `vrf_event_date`, `vrf_result` (`MATCH`/`MISMATCH`/`CONFIRMED`), `vrf_confidence_delta`, `vrf_follow_up_actions` JSON, `vrf_notes`, `vrf_created_by`, 타임스탬프
- API: `POST /api/v1/verifications`, `GET /api/v1/verifications?...`
- S12 화면 `VerificationRegisterPage.tsx`

#### Step 5.2 자동 후속 작업
- `SAMPLE_ANALYSIS` + `MATCH` → 신뢰도 +0.2
- `SAMPLE_ANALYSIS` + `MISMATCH` → 정정 분류 생성 트리거 + 원본 SUPERSEDED + 동일 Item 과거 모든 분류 재검토 큐 적재
- `CUSTOMS_SEIZURE` → DISPUTED 전환 + 에스컬레이션 자동 발동 (Phase 6 의존) + 동일 HS 코드 사용 다른 Item *모두* 재검토 큐 적재
- `CUSTOMS_DOUBLE_CHECK` → SEALED 잠금 + 신뢰도 +0.3
- 엔티티: `ReviewQueue` — `rvq_id`, `rvq_ent_id`, `rvq_target_type` (`ITEM`/`CLASSIFICATION`), `rvq_target_id`, `rvq_reason`, `rvq_priority`, `rvq_resolved_at`
- S13 화면 `ReviewQueuePage.tsx`

#### Step 5.3 KPI 1차 집계
- 월간 추징률 = 추징 이벤트 / 총 컨펌
- 정정률 = SUPERSEDED 비율
- 세관확인률 = SEALED 비율
- 1순위 히트율 (Phase 4에서 측정)
- 일일 배치 잡 또는 view 기반 집계

#### Phase 5 DoD
- [ ] 추징 이벤트 등록 시 동일 HS 코드 Item이 자동으로 재검토 큐 적재
- [ ] supersede 자동 처리 검증
- [ ] 월간 KPI 집계 view 동작

#### Phase 5 요구사항 매핑
FR-VR-01~03.

---

### Phase 6 — 에스컬레이션·전문가 검토 — 2주

#### Step 6.1 에스컬레이션 트리거 엔진
- 6개 트리거 (설계문서 §2.4):
  - (a) 신뢰도 < 0.6
  - (b) 후보 ≥3개로 분기
  - (c) 수입금지·제한 키워드 매칭 (수입국별 키워드 사전)
  - (d) 동일 품목 과거 추징 이력
  - (e) 고객사 명시 요청 (Inquiry 메모에 플래그)
  - (f) 거래 금액 > 임계 (수입국별 — 베트남 50,000 USD 기본)
- 컨펌 직전 (Phase 4와 통합 지점) 또는 추천 결과 직후에 검사
- 발동 시 Inquiry 상태 → `REVIEWING`, M4 응대 차단

#### Step 6.2 라우팅
- 규제 플래그 → 라우팅 (설계문서 §2.1):
  - 베트남 현지 통관/세관/라이선스 → `EXPERT_LOCAL`
  - 사내 분류 정책/FTA 원산지 → `EXPERT_INTERNAL`
  - 둘 다 → 병렬
- 엔티티: `ExpertReview` — `rev_id`, `rev_ent_id`, `rev_classification_id` FK, `rev_expert_role`, `rev_assigned_user_id`, `rev_trigger_reason` enum, `rev_requested_at`, `rev_responded_at`, `rev_verdict` (`APPROVE`/`REVISE`/`REJECT`), `rev_notes`

#### Step 6.3 S14·S15 화면
- `EscalationQueuePage.tsx` — 전문가 본인에게 할당된 큐
- `ExpertReplyPage.tsx` — 검토 컨텍스트(원본 속성, 후보, 외부 출처, 과거 동일 코드 사례) + 회신 양식
- 회신 후 차단 자동 해제 → M4 응대 진행 재개

#### Phase 6 DoD
- [ ] 트리거 발동 시 응대 차단 + 전문가 큐 적재
- [ ] 회신 후 자동 차단 해제
- [ ] 6개 트리거 모두 통합 테스트 통과

#### Phase 6 요구사항 매핑
FR-ES-01~03.

---

### Phase 7 — 관리·KPI·운영 — 2~3주

#### Step 7.1 정책 임계값 관리 (S18)
- 엔티티: `PolicyThreshold` — `plt_id`, `plt_import_country_code` FK nullable (NULL = 글로벌 기본값), `plt_key`, `plt_value`, `plt_updated_by`, `plt_updated_at`
- 키 목록: `confidence_cutoff`, `tariff_gap_threshold_pct`, `escalation_amount_usd`, `freshness_months`
- 변경 5 (수입국별 분리) 완전 반영
- `PolicyThresholdPage.tsx`

#### Step 7.2 KPI 대시보드 (S20)
- 추징·정정·세관확인·1순위 히트율·외부 호출 비율·내부 hit 추세
- recharts 활용 — 월별/주별 선택

#### Step 7.3 외부 API 운영 지표 (NFR-AD-03)
- AIRecommendationLog + 외부 어댑터 호출 로그 집계
- 성공률·지연·비용

#### Step 7.4 미지원 국가 요청 큐
- Phase 2.1에서 수집한 *추가 요청 폼* 데이터를 관리 화면에 노출

#### Step 7.5 비동기 엑셀 처리 (1,000행 초과)
- bull + redis 도입 또는 NestJS 자체 task scheduler
- Phase 2에서 보류했던 비동기 처리 완성

#### Phase 7 DoD
- [ ] 임계값을 코드 배포 없이 관리 화면에서 수정 가능
- [ ] KPI 대시보드 6개월 데이터 표시
- [ ] 외부 호출 비용/지연 실시간 가시화

#### Phase 7 요구사항 매핑
FR-AD-01~03, FR-QU-03.

---

### Phase 8 — 신규 국가 확장 절차 (상시)

> Phase 1 이후 상시 가능한 메타 트랙. 본 작업은 *문서화 + 자동화 SDK*.

#### Step 8.1 어댑터 SDK 문서화
- 신규 어댑터 추가 가이드 (`docs/adapter-guide/`)
- 인터페이스 명세, 테스트 회귀 스위트, 시드 데이터 형식

#### Step 8.2 베타 → ACTIVE 승격 체크리스트
- 최소 시드 데이터량
- FTA 매트릭스 보강
- 정책 임계값 설정
- 키워드 사전 (수입금지 등)
- 통합 테스트 통과

#### Step 8.3 두 번째 수입국 시범 (예: 한국 수입 KCS)
- SDK 검증 목적

#### Phase 8 DoD
- [ ] 신규 수입국 1개를 *문서 따라 5일 안에* beta 단계까지 등록 가능

---

## 3. 변경 파일 목록

### 3.1 Backend (신규)

| 영역 | 파일 | Phase | 변경 유형 |
|------|------|-------|----------|
| 골격 | `backend/package.json`, `tsconfig.json`, `nest-cli.json`, `Dockerfile` | 0 | 신규 |
| 골격 | `backend/src/{main,app.module,health.controller}.ts` | 0 | 신규 |
| 인증 | `backend/src/auth/**/*` (6~10개 파일) | 0 | 신규 |
| 공통 | `backend/src/common/{filter,dto,util,interceptor}/**/*` | 0~4 | 신규 |
| 마스터 | `backend/src/domain/master-country/**/*` (controller/service/entity/dto/mapper/module) | 1 | 신규 |
| 마스터 | `backend/src/domain/master-exporter/**/*` | 1 | 신규 |
| 마스터 | `backend/src/domain/master-data-source/**/*` | 1 | 신규 |
| 마스터 | `backend/src/domain/master-fta/**/*` | 1 | 신규 |
| 사용자 | `backend/src/domain/user/**/*` (User, Role, UserRole) | 1 | 신규 |
| 비즈니스 | `backend/src/domain/inquiry/**/*` | 2 | 신규 |
| 비즈니스 | `backend/src/domain/item/**/*` | 2 | 신규 |
| 비즈니스 | `backend/src/domain/intake/**/*` (direct/excel/barcode) | 2 | 신규 |
| 매칭 | `backend/src/domain/matching/**/*` (normalizer/internal/ranker) | 3 | 신규 |
| 외부 | `backend/src/domain/external/interface/external-customs-adapter.interface.ts` | 3 | 신규 |
| 외부 | `backend/src/domain/external/adapter-vn-bieu-thue/**/*` | 3 | 신규 |
| 외부 | `backend/src/domain/external/adapter-kr-customs/**/*` | 3 | 신규 |
| 외부 | `backend/src/domain/external/ai-claude/**/*` | 3 | 신규 |
| 비즈니스 | `backend/src/domain/classification/**/*` | 4 | 신규 |
| 비즈니스 | `backend/src/domain/audit-log/**/*` | 4 | 신규 |
| 비즈니스 | `backend/src/domain/verification/**/*` | 5 | 신규 |
| 비즈니스 | `backend/src/domain/review-queue/**/*` | 5 | 신규 |
| 비즈니스 | `backend/src/domain/expert-review/**/*` | 6 | 신규 |
| 비즈니스 | `backend/src/domain/policy/**/*` | 7 | 신규 |
| 비즈니스 | `backend/src/domain/admin/**/*` (KPI·운영지표) | 7 | 신규 |
| DB 스크립트 | `backend/scripts/init-db.sql` | 0 | 신규 |
| DB 스크립트 | `backend/scripts/seed-vn-bieu-thue.sql` | 3 | 신규 |

### 3.2 Frontend (신규)

| 영역 | 파일 | Phase | 변경 유형 |
|------|------|-------|----------|
| 골격 | `frontend/{package.json,vite.config.ts,tsconfig.json,tailwind.config.js,postcss.config.js,index.html,Dockerfile,nginx.conf}` | 0 | 신규 |
| 골격 | `frontend/src/{main,App,index.css}.tsx` | 0 | 신규 |
| 골격 | `frontend/src/lib/{api-client,error-codes,utils}.ts` | 0 | 신규 |
| 골격 | `frontend/src/stores/auth.store.ts` | 0 | 신규 |
| i18n | `frontend/src/i18n/i18n.ts` + `locales/{ko,en,vi}/common.json` | 0 | 신규 |
| 레이아웃 | `frontend/src/components/layout/{AppLayout,AppHeader,AppSidebar}.tsx` | 1 | 신규 |
| UI | `frontend/src/components/ui/{Button,Card,Modal,AlertModal,Table,Form,Stepper,Toast}.tsx` | 0~3 | 신규 |
| 페이지 S01 | `frontend/src/pages/dashboard/DashboardPage.tsx` | 0(빈), 7(채움) | 신규 |
| 페이지 S02~S06 | `pages/inquiry/InquiryCreatePage.tsx`, `pages/intake/{Channel,ExcelUpload,HoldQueue,DirectInput}Page.tsx` | 2 | 신규 |
| 페이지 S07~S09 | `pages/matching/{MatchingProgress,RecommendationConfirm,ResponseForm}Page.tsx` | 3·4 | 신규 |
| 페이지 S10~S11 | `pages/classification/{ClassificationList,ClassificationDetail}Page.tsx` | 4 | 신규 |
| 페이지 S12~S13 | `pages/verification/{VerificationRegister,ReviewQueue}Page.tsx` | 5 | 신규 |
| 페이지 S14~S15 | `pages/expert/{EscalationQueue,ExpertReply}Page.tsx` | 6 | 신규 |
| 페이지 S16~S20 | `pages/admin/{AdminLayout,MasterCountry,MasterExporter,MasterDataSource,PolicyThreshold,UserRole,KpiDashboard}Page.tsx` | 1·7 | 신규 |
| 도메인 컴포넌트 | `components/intake/{CategoryDynamicForm,ExcelHeaderMapper,HoldRowEditor}.tsx` | 2 | 신규 |
| 도메인 컴포넌트 | `components/matching/{ProgressStepper,CandidateCard,SourceBadge,AIReasoningBox}.tsx` | 3 | 신규 |
| 서비스 | `frontend/src/services/{inquiry,item,intake,matching,classification,verification,expert,admin}.service.ts` | 도메인별 | 신규 |
| 훅 | `frontend/src/hooks/use{Inquiries,Items,Matching,Classifications,Verifications,Experts,Admin}.ts` | 도메인별 | 신규 |
| 타입 | `frontend/src/types/{inquiry,item,classification,verification,...}.types.ts` | 도메인별 | 신규 |
| i18n 번역 | `locales/{ko,en,vi}/{common,inquiry,intake,matching,classification,verification,expert,admin,modal,error}.json` | 단계별 | 신규 |

### 3.3 DB (신규 — 모두 `db_app_hscode`)

| 테이블 | 목적 | Phase | 컬럼 prefix |
|--------|------|-------|------------|
| `hsc_import_countries` | 수입국 마스터 | 1 | `imc_` |
| `hsc_export_countries` | 수출국 마스터 | 1 | `exc_` |
| `hsc_exporters` | 수출업체 마스터 | 1 | `exp_` |
| `hsc_external_data_sources` | 외부 데이터 어댑터 등록 | 1 | `eds_` |
| `hsc_fta_matrix` | FTA 협정세율 매트릭스 | 1 | `fta_` |
| `hsc_users` | AMA 사용자 캐시 | 1 | `usr_` |
| `hsc_roles` | 역할 정의 | 1 | `rol_` |
| `hsc_user_roles` | 사용자-역할 매핑 | 1 | `urr_` |
| `hsc_inquiries` | 문의 1건 | 2 | `inq_` |
| `hsc_items` | 물품 마스터 (정규화·해시 포함) | 2 | `itm_` |
| `hsc_excel_import_batches` | 엑셀 일괄 등록 추적 | 2 | `eib_` |
| `hsc_excel_hold_rows` | 보류 큐 행 | 2 | `hqr_` |
| `hsc_excel_mapping_profiles` | 매핑 프로파일 (재사용) | 2 | `emp_` |
| `hsc_category_schemas` | 카테고리 메타 (런타임 확장) | 2 | `csm_` |
| `hsc_authority_hs_codes` | 외부 권위 데이터 시드 (BIEU THUE 등) | 3 | `auh_` |
| `hsc_ai_recommendation_logs` | AI 호출 로그 | 3 | `arl_` |
| `hsc_classifications` | 분류 (확정·후보채택) | 4 | `cls_` |
| `hsc_classification_candidates` | 후보 N개 | 4 | `cnd_` |
| `hsc_audit_logs` | 감사 로그 | 4 | `aud_` |
| `hsc_verification_events` | 사후 검증 이벤트 | 5 | `vrf_` |
| `hsc_review_queue` | 재검토 큐 | 5 | `rvq_` |
| `hsc_expert_reviews` | 전문가 검토 기록 | 6 | `rev_` |
| `hsc_policy_thresholds` | 정책 임계값 (국가별) | 7 | `plt_` |
| `hsc_unsupported_country_requests` | 미지원 국가 추가 요청 | 7 | `ucr_` |

### 3.4 인프라

| 파일 | Phase | 변경 유형 |
|------|-------|----------|
| `apps/app-hscode-manager/docker-compose.app-hscode-manager.yml` | 0 | 신규 |
| `apps/app-hscode-manager/.env.example` | 0 | 신규 |
| `apps/app-hscode-manager/DB-SCHEMA-hscode-manager.md` | 0(초안), 단계별 갱신 | 신규 |
| `platform/scripts/deploy-staging.sh` | 0 | 수정 (hscode 빌드/기동 분기 추가) |
| `platform/nginx/apps.amoeba.site.conf` | — | 수정 없음 (이미 매핑됨) |

---

## 4. 사이드 임팩트 분석

| 범위 | 위험도 | 설명 | 완화 |
|------|--------|------|------|
| 다른 앱 영향 | 낮음 | 격리된 BFF·DB·도커 컨테이너. 공통 라이브러리 변경 없음. | — |
| 플랫폼 통합 | 중간 | AMA JWT 검증 — JWT_SECRET 공유 필요. 토큰 형식 변경 시 hscode 영향. | car-manager 패턴과 동일하게 유지 + 통합 테스트로 SSO 동작 검증 |
| Nginx | 낮음 | `/app-hscode/*` 이미 매핑됨. 추가 변경 없음. | — |
| Deploy 스크립트 | 중간 | `deploy-staging.sh`에 hscode 빌드 단계 추가 — 다른 앱 빌드를 깨면 안 됨. | 별도 함수로 격리 + dry-run 옵션 검증 |
| DB 부하 | 중간 | FTA 매트릭스 5만 행, BIEU THUE 시드 수천 행. 인덱스 미흡 시 조회 지연. | Phase 1·3 인덱스 사전 설계 (3.3 표 참조) |
| AI 비용 | 높음 | Claude API 호출이 호출량에 비례. 환각 가드레일 미흡 시 재호출 비용. | 일일 한도 + 호출 캐싱 + 운영 지표 모니터링 (Phase 7) |
| 외부 권위 데이터 | 높음 | BIEU THUE XNK 2026 데이터 공급 형식 미확정. 라이선스 이슈. | 시드 기반 어댑터로 시작 — 향후 API 연동 교체 가능한 구조 |
| 정책 임계값 | 중간 | 코드 상수로 시작했다가 Phase 7에서 DB 이전 — 마이그레이션 필요. | Phase 3에서 *환경변수 또는 단일 테이블*로 초기 운영하면 7에서 부드러운 이전 가능 |
| 멀티테넌시 누락 | 매우 높음 | `ent_id` 가드 누락 시 정보 유출. | EntityScopeGuard 강제 + 통합 테스트 + 코드 리뷰 룰 + RLS 보조 |
| 카테고리 enum 확장 | 낮음 | 신규 카테고리(예: cosmetic) 추가 시 코드 변경. | `hsc_category_schemas` 메타 테이블로 일부 런타임 확장 가능 |
| supersede 체인 | 낮음 | 정정이 반복되면 체인이 깊어짐. | depth ≤ 5 가정 + 6 이상 시 알람 |
| i18n 번역 부담 | 중간 | 화면 20개 × 3개 언어 = 번역 작업량 큼. | Phase별 화면 i18n DoD에 명시. 번역은 ko 우선 작업 후 en/vi 보강. |
| Phase 5 의존 | 중간 | Phase 6 에스컬레이션이 검증 이벤트 자동 트리거에 의존 — Phase 5 선행 권장. | Phase 5 → 6 순서 엄수. 병렬 시 mock event로 6 개발 가능. |

---

## 5. DB 마이그레이션

### 5.1 마이그레이션 전략

- **로컬/개발**: TypeORM `synchronize=true` (Phase 0~2 초기에만 허용)
- **스테이징**: `synchronize=false`. 수동 SQL 스크립트로 적용. 스크립트는 `apps/app-hscode-manager/db-migrations/{YYYY-MM-DD}_{description}.sql` 형식.
- **프로덕션**: 동일. 스테이징 검증 후 적용.

### 5.2 Phase 0 — 초기 DB 생성

```sql
CREATE DATABASE IF NOT EXISTS db_app_hscode
  DEFAULT CHARACTER SET utf8mb4
  DEFAULT COLLATE utf8mb4_unicode_ci;

CREATE USER IF NOT EXISTS 'hscode_app'@'%' IDENTIFIED BY '<set-in-env>';
GRANT ALL PRIVILEGES ON db_app_hscode.* TO 'hscode_app'@'%';
FLUSH PRIVILEGES;
```

### 5.3 Phase 1 — 마스터 테이블 (대표 DDL)

```sql
-- hsc_import_countries
CREATE TABLE hsc_import_countries (
  imc_id              CHAR(36)     NOT NULL,
  imc_code            VARCHAR(2)   NOT NULL,
  imc_name_ko         VARCHAR(100) NOT NULL,
  imc_name_en         VARCHAR(100) NOT NULL,
  imc_name_vi         VARCHAR(100) NOT NULL,
  imc_support_status  ENUM('ACTIVE','BETA','NOT_SUPPORTED') NOT NULL DEFAULT 'NOT_SUPPORTED',
  imc_adapter_key     VARCHAR(64)  NULL,
  imc_created_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  imc_updated_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  imc_deleted_at      DATETIME     NULL,
  PRIMARY KEY (imc_id),
  UNIQUE KEY uq_imc_code (imc_code)
) ENGINE=InnoDB;

-- hsc_exporters
CREATE TABLE hsc_exporters (
  exp_id              CHAR(36)     NOT NULL,
  exp_ent_id          CHAR(36)     NOT NULL,
  exp_name            VARCHAR(255) NOT NULL,
  exp_country_code    VARCHAR(2)   NOT NULL,
  exp_aliases         JSON         NULL,
  exp_risk_flags      JSON         NULL,
  exp_created_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  exp_updated_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  exp_deleted_at      DATETIME     NULL,
  PRIMARY KEY (exp_id),
  KEY idx_exporters_ent_name (exp_ent_id, exp_name),
  KEY idx_exporters_ent_country (exp_ent_id, exp_country_code)
) ENGINE=InnoDB;

-- hsc_fta_matrix
CREATE TABLE hsc_fta_matrix (
  fta_id                   CHAR(36)      NOT NULL,
  fta_import_country_code  VARCHAR(2)    NOT NULL,
  fta_export_country_code  VARCHAR(2)    NOT NULL,
  fta_agreement_code       VARCHAR(16)   NOT NULL,
  fta_hs_code              VARCHAR(16)   NOT NULL,
  fta_rate                 DECIMAL(6,3)  NOT NULL,
  fta_effective_from       DATE          NOT NULL,
  fta_effective_to         DATE          NULL,
  fta_created_at           DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (fta_id),
  UNIQUE KEY uq_fta_lookup
    (fta_import_country_code, fta_export_country_code, fta_agreement_code,
     fta_hs_code, fta_effective_from),
  KEY idx_fta_lookup (fta_import_country_code, fta_export_country_code, fta_hs_code)
) ENGINE=InnoDB;
```

> 나머지 Phase 1 테이블 (`hsc_export_countries`, `hsc_external_data_sources`, `hsc_users`, `hsc_roles`, `hsc_user_roles`)은 동일 패턴. 전체 DDL은 `apps/app-hscode-manager/DB-SCHEMA-hscode-manager.md`에 누적 작성.

### 5.4 Phase 2~7 마이그레이션 파일 (예정)

| 파일명 | 목적 |
|--------|------|
| `2026-06-XX_phase1_master.sql` | 마스터 테이블 (1.3 표 8개) |
| `2026-06-XX_phase2_inquiry_item.sql` | Inquiry, Item, Excel batch/hold/profile, Category schema |
| `2026-07-XX_phase3_matching.sql` | Authority HS codes, AI logs |
| `2026-07-XX_phase4_classification.sql` | Classification, Candidate, Audit log |
| `2026-08-XX_phase5_verification.sql` | VerificationEvent, ReviewQueue |
| `2026-08-XX_phase6_expert.sql` | ExpertReview |
| `2026-09-XX_phase7_policy.sql` | PolicyThreshold, UnsupportedCountryRequest |

### 5.5 인덱스 사후 보강

- Phase 3 정규화·매칭 완성 후 *실제 쿼리 패턴 분석*하여 EXPLAIN 기반 인덱스 추가
- 특히 `hsc_classifications`의 (ent_id, exp_id, imc_code, adopted_at desc) 복합 인덱스

### 5.6 시드 데이터

| 시드 | Phase | 분량 추정 |
|------|-------|----------|
| 수입국 마스터 (VN active, KR active, TH beta, ID none, ...) | 1 | ~10건 |
| 수출국 마스터 | 1 | ~50건 (주요국) |
| 수출업체 마스터 (카고러시 자주 거래) | 1 | ~30~50건 |
| FTA 매트릭스 (VKFTA, AKFTA, ATIGA, RCEP × HS 6단위 일부) | 1 | ~1만~5만 행 |
| BIEU THUE XNK 2026 시드 | 3 | 운영팀 협조 — 초기 ~500건 |
| 카테고리 메타 (chemical/steel/equipment/other) | 2 | 4건 |
| 정책 임계값 (VN 기본) | 3·7 | ~5건 |
| 역할 (ADMIN/MANAGER/EXPERT_LOCAL/EXPERT_INTERNAL/VIEWER) | 1 | 5건 |

---

## 6. 환경 변수·인프라

### 6.1 `.env.example` (apps/app-hscode-manager/)

```bash
# App
NODE_ENV=development
PORT=3102

# DB
DB_HOST=localhost
DB_PORT=3306
DB_USERNAME=hscode_app
DB_PASSWORD=
DB_DATABASE=db_app_hscode

# Auth (AMA SSO)
JWT_SECRET=
JWT_ISSUER=ama.amoeba.site

# AI
CLAUDE_API_KEY=
CLAUDE_MODEL_VERSION=claude-sonnet-4-6
AI_DAILY_BUDGET_USD=50

# External adapters
ADAPTER_VN_BIEU_THUE_ENABLED=true
ADAPTER_KR_CUSTOMS_ENABLED=true
EXTERNAL_CACHE_TTL_SEC=86400

# Frontend (build-time)
VITE_API_BASE_URL=/app-hscode/api
VITE_AMA_LOGIN_URL=https://ama.amoeba.site/login
```

### 6.2 docker-compose 골격 (요지)

```yaml
services:
  db-app-hscode:
    image: mysql:8.0
    environment:
      MYSQL_DATABASE: db_app_hscode
      MYSQL_USER: hscode_app
      MYSQL_PASSWORD: ${DB_PASSWORD}
      MYSQL_ROOT_PASSWORD: ${DB_ROOT_PASSWORD}
    volumes:
      - hscode_mysql_data:/var/lib/mysql

  bff-app-hscode:
    build: ./backend
    environment:
      DB_HOST: db-app-hscode
      ...
    ports:
      - "3102:3102"
    depends_on: [db-app-hscode]

  web-app-hscode:
    build:
      context: ./frontend
      args:
        VITE_API_BASE_URL: /app-hscode/api
    # nginx 정적 호스팅, 상위 nginx에서 /app-hscode/ 라우팅
```

### 6.3 Nginx (이미 매핑됨, 변경 불필요)
```
location /app-hscode/        → /usr/share/nginx/html/app-hscode/
location /app-hscode/api/    → http://bff-app-hscode:3102/api/
```

---

## 7. 완료 기준

### 7.1 마일스톤별 DoD

**M1 — MVP 운영 가능 (Phase 0~4 완료, ≈10~12주)**
- [ ] 직접 입력 1건 → 매칭 → 추천 → 컨펌 → 응대 양식 출력까지 end-to-end 동작
- [ ] 엑셀 1,000행 일괄 등록 + 보류 큐 처리
- [ ] 누적 조회에서 컨펌 즉시 검색 가능
- [ ] 동일 패턴 재입력 시 1순위 회수
- [ ] 외부 API 다운에도 내부+캐시로 degraded mode 동작
- [ ] AI 환각률·1순위 히트율 측정 가능
- [ ] i18n 3개 언어 완성 (S01~S11)
- [ ] 스테이징 배포 + 통합 테스트 통과
- [ ] 멀티테넌시 격리 검증 (보안 리뷰)

**M2 — 누적·재사용 + 검증 루프 (Phase 5 완료, ≈14주)**
- [ ] 추징 이벤트 등록 시 동일 코드 Item 자동 재검토 큐 적재
- [ ] 신뢰도 자동 갱신
- [ ] 월간 KPI 집계 view 동작

**M3 — 운영 가능 (Phase 6~7 완료, ≈18~21주)**
- [ ] 에스컬레이션 6개 트리거 작동 + blocking 동작
- [ ] 전문가 큐·회신 양식 i18n 완성
- [ ] 정책 임계값 관리 화면에서 무코드 수정
- [ ] KPI 대시보드 6개월 데이터
- [ ] 외부 API 비용/지연 가시화

**M∞ — 신규 국가 확장 (Phase 8, 상시)**
- [ ] 두 번째 수입국 어댑터 시범 등록 (예: KR 수입 KCS)
- [ ] 신규 국가 추가 절차 문서 검증

### 7.2 비기능 검증

| NFR | 검증 방법 |
|-----|----------|
| NFR-PF-01 (내부 매칭 90p < 1.5s) | k6 부하 테스트, 1만 행 시드 후 |
| NFR-PF-02 (전체 90p < 8s) | 동일 |
| NFR-PF-03 (엑셀 1000행 동기) | 통합 테스트 |
| NFR-AV-01 (degraded mode) | 외부 API mock 미응답 시 시나리오 테스트 |
| NFR-SE-01 (수출업체 격리) | 보안 테스트 — 타 ent_id 데이터 조회 시도 |
| NFR-SE-02 (감사 로그) | 통합 테스트 |
| NFR-SE-03 (AI 마스킹) | 단위 테스트 — 마스킹 출력 검증 |
| NFR-DI-01 (Classification 불변성) | 통합 테스트 — ADOPTED 변경 시도 차단 |
| NFR-LO-01 (다국어) | 화면별 i18n 완성도 체크리스트 |

---

## 8. 사용자 승인 게이트

본 작업계획서는 [HSCODE_요구사항명세서.md](../../apps/app-hscode-manager/docs/HSCODE_요구사항명세서.md)와 [HSCODE_작업계획서.md](../../apps/app-hscode-manager/docs/HSCODE_작업계획서.md)를 기반으로 실제 구현을 위해 풀어낸 산출물이다. 다음 단계는 **테스트케이스 작성**(`docs/test/TC-260513-HSCode매니저-앱전체구현.md`)이며, 그 뒤 사용자 진행 지시 후 Phase 0부터 구현에 들어간다.

다음 권장 후속 산출물:
1. **TC-260513-HSCode매니저-앱전체구현.md** — Phase별 테스트케이스
2. **DB-SCHEMA-hscode-manager.md** — 전체 13개 테이블 DDL + 인덱스 (앱 디렉토리에)
3. **어댑터 인터페이스 명세** — `ExternalCustomsAdapter`, `AIRecommendationAdapter` 상세 시그니처·에러 모델
4. **속성 정규화 규칙 v0** — 카테고리별 정규화 알고리즘 (chemical CAS 정리 / steel 재질 매핑 등)
5. **AI 프롬프트 v0** — 가드레일 포함 (후보 범위 제약·출처 인용 강제·JSON 강제)

본 계획서에 대한 사용자 확인 완료 후 위 1~5번 산출물 작성을 이어간다.
