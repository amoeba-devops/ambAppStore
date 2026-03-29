---
name: amb-spec-generator
description: >
  ambAppStore SDLC documentation generator for partner app platform.
  Generates bilingual (EN/KR) documents across analysis, design, implementation, and test phases.
  Integrates with GitHub Projects for WBS task management and issue tracking.
  Triggers: "기획서", "스펙 문서", "API 설계", "DB 스키마", "PRD", "기능 명세",
  "요구사항 분석", "시퀀스다이어그램", "ERD", "WBS", "개발계획서", "테스트케이스",
  "화면기획서", "작업계획서", "작업리포트", "테스트리포트", "GitHub issue",
  "버그 리포트", "기능 개선", "형상관리", "요구사항분석", "작업계획",
  "완료보고서", "ANALYSIS", "TASK-PLAN", "TEST-CASE", "REPORT".
  Also triggers on: "spec document", "create issue", "development plan", "test report".
---

# ambAppStore Spec Generator

A **conversational SDLC documentation skill** for ambAppStore partner app platform.
ambAppStore 파트너 앱 플랫폼의 개발 전체 라이프사이클(SDLC)을 지원하는 **대화형 문서 생성 스킬**이다.

Core principles:
1. **Bilingual documentation** — English-first with Korean annotations (영어 우선, 한국어 병기)
2. **Traceability** — Each artifact feeds into the next stage via consistent ID references (FR → FN → T → TC)
3. **GitHub-native workflow** — WBS tasks map to GitHub Issues/Projects, changes tracked via Git (형상관리는 Git/GitHub 기반)
4. **Conversational creation** — Structured interviews extract requirements progressively (대화형 인터뷰로 점진적 문서 작성)

---

## Mandatory Standards / 필수 준수 표준

모든 문서 생성 시 아래 2개 표준 문서를 **반드시** 참조·준수해야 한다.

### Amoeba Code Convention v2 (코드 컨벤션) — MUST

**파일**: `reference/amoeba_code_convention_v2.md`

DB 스키마, Entity, DTO, API 설계, 컴포넌트 구조 등 모든 코드 관련 문서에 이 컨벤션을 반영한다.
- ERD/스키마 문서 → §4 DB Naming Rules 준수
- API 설계 문서 → §8 API Design 준수
- 시퀀스 다이어그램 → §3 Architecture Standards 기반 레이어 반영
- 기능 정의서 → §5 Backend Rules + §6~7 Frontend Rules 준수
- 화면 기획서 → §6~7 Frontend Rules + §14 i18n Rules 준수

### Amoeba Web Style Guide v2 (웹 스타일 가이드) — MUST

**파일**: `reference/amoeba_web_style_guide_v2.md`

UI 관련 문서(화면기획서, UI Spec, 사용자 가이드) 작성 시 이 스타일 가이드를 반영한다.
- 화면 기획서 → §1~3 Layout System, §5 Color System, §6 Typography, §7 Component Styles 준수
- UI Spec → §10 Responsive Breakpoints, §11 Spacing System 준수
- 사용자 가이드 → §12 Notifications and Toasts 패턴 반영

---

## Technical Context / 기술 컨텍스트

ambAppStore technology stack — reflect this context in all generated documents:

| Layer | Technology |
|-------|-----------|
| Frontend | React 18 + TypeScript 5 + TailwindCSS 3 + Vite 5 |
| Backend | NestJS 10 + TypeScript 5 + TypeORM 0.3.x |
| Database | **MySQL 8.0** (앱별 독립 DB) |
| State | Zustand (global) + React Query 5 (server) + React Hook Form + Zod |
| Auth | JWT (AMA SSO Passthrough) |
| Icons | lucide-react |
| Container | Docker + docker-compose (앱별 BFF 격리) |
| Proxy | Nginx (SSL + Reverse Proxy) |
| CI/CD | GitHub Actions |
| Monorepo | Turborepo + npm workspaces |
| Version Control | Git / GitHub |

### App Portfolio (앱 목록)

| App | Slug | DB | BE Port | FE Port | Prefix |
|-----|------|----|---------|---------|--------|
| 플랫폼 (구독관리) | `/` | `db_app_platform` | :3100 | :5200 | `plt_` |
| 법인차량관리 | `/app-car-manager` | `db_app_car` | :3101 | :5201 | `car_` |
| HS Code Tool | `/app-hscode` | `db_app_hscode` | :3102 | :5202 | `hsc_` |
| 매출리포트 | `/app-sales-report` | `db_app_sales` | :3103 | :5203 | `sal_` |
| 재고예측 | `/app-stock-management` | `db_app_stock` | :3104 | :5204 | `stk_` |

### Architecture Overview

```
┌──────────────────────────┐        ┌──────────────────────────────────┐
│  AMA (ama.amoeba.site)   │        │  AppStore (apps.amoeba.site)     │
│                          │        │                                  │
│  ┌────────────────────┐  │  JWT   │  Nginx                           │
│  │ Entity 사용자       │──┼───────▶│  ├── /{slug}/*   → React SPA     │
│  │ (법인별 사용자)     │  │  SSO   │  └── /{slug}/api/* → NestJS BFF  │
│  └────────────────────┘  │        │                                  │
└──────────────────────────┘        └──────────────────────────────────┘
```

- 모든 앱 데이터는 `ent_id` (AMA Entity/법인 코드) 기준으로 **멀티테넌시 격리**
- 인증: AMA JWT SSO Passthrough (앱별 자체 회원가입 없음)
- 각 앱은 **완전 격리**: 독립 DB, 독립 Docker 컨테이너, 독립 빌드

---

## Bilingual Writing Convention / 이중 언어 작성 규칙

All documents are written **English-first with Korean annotations**.
모든 문서는 **영어 우선, 한국어 병기** 방식으로 작성한다.

### Rules

1. **Section headers**: English primary, Korean in parentheses
   - `## 1. Overview (개요)` — not `## 1. 개요`
2. **Table headers**: English only
   - `| ID | Requirement | Priority | Note |`
3. **Table content**: English preferred; Korean when inherently Korean (예: 법인명)
4. **Descriptions and body text**: English primary. Add Korean in parentheses `(한국어)` when clarifying
5. **Code, API, SQL**: Always English — variable names, comments, column names all in English
6. **Filenames**: Always English
7. **Commit messages & issue titles**: English

---

## Configuration Management / 형상관리

### Document Repository Structure

```
ambAppStore/
├── reference/
│   ├── req/                          # 앱별 상세 요구사항 문서
│   │   ├── AMA-VEH-REQ-1.1.0.md
│   │   └── AMA-VEH-ANALYSIS-1.1.0.md
│   ├── plan/                         # 작업계획서
│   │   └── AMA-VEH-TASK-PLAN-1.0.0.md
│   ├── test/                         # 테스트케이스
│   │   └── AMA-VEH-TEST-CASE-1.0.0.md
│   ├── report/                       # 작업완료보고서
│   │   └── AMA-VEH-REPORT-1.0.0.md
│   ├── requirements.md               # 플랫폼 전체 요구사항정의서
│   ├── func-definition.md            # 플랫폼 전체 기능명세서
│   ├── ui-spec.md                    # 플랫폼 전체 화면정의서
│   ├── project-plan.md               # 프로젝트수행계획서
│   ├── amoeba_code_convention_v2.md  # ⭐ 코드 컨벤션 (MUST)
│   └── amoeba_web_style_guide_v2.md  # ⭐ 웹 스타일 가이드 (MUST)
├── docs/
│   ├── analysis/                     # 요구사항 분석서 (Stage 1)
│   ├── design/                       # 설계 문서 (Stage 2)
│   ├── implementation/               # 구현 문서 (Stage 3)
│   └── test/                         # 테스트 문서 (Stage 4-5)
└── sql/
    └── {feature}-schema.sql
```

### Document Versioning

Every document includes a version header block:

```markdown
---
document_id: {APP_PREFIX}-{DOC_TYPE}-{VERSION}
version: 1.0.0
status: Draft | Review | Approved | Final
created: YYYY-MM-DD
updated: YYYY-MM-DD
author: {author}
based_on: {입력물 document_id}
app: {app-slug}
---
```

### Document ID System

```
{APP_PREFIX}-{DOC_TYPE}-{MAJOR}.{MINOR}.{PATCH}
```

| Element | Rule | Example |
|---------|------|---------|
| APP_PREFIX | App-specific code | `AMA-VEH`, `AMA-HSC`, `AMA-SAL`, `AMA-STK` |
| DOC_TYPE | Document type code | `REQ`, `ANALYSIS`, `TASK-PLAN`, `TEST-CASE`, `REPORT` |
| Version | SemVer | `1.0.0`, `1.1.0` |

### Git Workflow for Documents

```
main (production docs)
  └── docs/{feature} (document development branch)
        ├── commit: "docs(analysis): add requirements FR-001~FR-010"
        └── PR → main (review required)
```

---

## SDLC Overview / 개발 라이프사이클 개요

This skill follows a 5-stage development process.

```
┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐
│ 1.Analy- │ →  │ 2.Design │ →  │ 3.Imple- │ →  │ 4.Unit   │ →  │ 5.Final  │
│   sis    │    │          │    │ mentation│    │   Test   │    │   Test   │
└──────────┘    └──────────┘    └──────────┘    └──────────┘    └──────────┘
 Requirements    Design docs     Dev plan/exec   Per-task verify  Integration
```

### Artifacts by Stage (단계별 산출물)

| Stage | Artifact | File Pattern |
|-------|----------|-------------|
| **1. Analysis** | Requirements Analysis (요구사항 분석서) | `{feature}-requirements.md` |
| **2. Design** | Event Scenario (이벤트 시나리오) | `{feature}-event-scenario.md` |
|  | Requirements Definition (요구사항 정의서) | `{feature}-req-definition.md` |
|  | Functional Specification (기능 정의서) | `{feature}-func-definition.md` |
|  | UI Specification (화면 기획서) | `{feature}-ui-spec.md` |
|  | Sequence Diagram (시퀀스 다이어그램) | `{feature}-sequence.md` |
|  | ERD | `{feature}-erd.md` + `{feature}-schema.sql` |
|  | Process Definition (프로세스 정의서) | `{feature}-process.md` |
|  | Policy Definition (정책 정의서) | `{feature}-policy.md` |
|  | User Guide (사용자 가이드) | `{feature}-user-guide.md` |
| **3. Implementation** | Development Plan (개발계획서) | `{feature}-dev-plan.md` |
|  | WBS | `{feature}-wbs.md` |
|  | Task Plan (태스크 작업계획서) | `{feature}-task-{n}-plan.md` |
|  | Task Report (태스크 작업리포트) | `{feature}-task-{n}-report.md` |
| **4. Unit Test** | Test Cases (테스트 케이스) | `{feature}-testcase.md` |
|  | Unit Test Report (단위 테스트 리포트) | `{feature}-test-report.md` |
| **5. Final Test** | Integration Test Plan (통합 테스트 계획서) | `{feature}-integration-test-plan.md` |
|  | Final Test Report (최종 테스트 리포트) | `{feature}-final-test-report.md` |
| **Cross-stage** | GitHub Issues (bugs, features, enhancements) | `.github/ISSUE_TEMPLATE/` |

### Stage Detection (단계 진입 판별)

| User says… | Stage |
|---|---|
| "requirements analysis", "요구사항 분석", "feature planning" | 1. Analysis |
| "design document", "ERD", "sequence", "UI spec", "화면기획", "기능정의", "정책정의" | 2. Design |
| "dev plan", "WBS", "task plan", "개발계획", "작업계획서", "start development" | 3. Implementation |
| "test case", "unit test", "테스트케이스", "테스트리포트" | 4. Unit Test |
| "integration test", "final test", "QA", "통합테스트" | 5. Final Test |
| "bug report", "버그", "create issue" | GitHub Issue (Bug) |
| "feature request", "추가 기능", "new feature" | GitHub Issue (Feature) |
| "full spec", "처음부터", "전체 문서" | 1→2→3→4→5 sequential |

---

## Common: Conversational Interview Principles / 공통: 대화형 인터뷰 원칙

**Question strategy**: Never dump all questions at once. Ask 2-3 at a time, naturally.
**Handling unknowns**: Propose reasonable defaults and mark with `[TBD]`.
**Confirmation loop**: Show TOC before generating. Collect feedback after generation.

---

## Stage 1: Analysis (분석 단계)

### Interview Flow

Round 1 — Big picture:
- What feature/service is this? (한 줄 요약)
- Why is it needed? (배경/문제)
- Who uses it? (사용자 유형)
- Which app? (대상 앱: car-manager, hscode, sales-report, stock-forecast)

Round 2 — Scope and constraints:
- What is the main user flow? (해피 패스)
- How does it integrate with AMA? (AMA 연동 범위)
- Any technical/business constraints?
- Competing products or references?

Round 3 — Prioritization:
- MVP scope?
- Feature priority (P0/P1/P2)?
- Target timeline?

### Artifact: Requirements Analysis (요구사항 분석서)

```markdown
# {Feature Name} — Requirements Analysis ({기능명} 요구사항 분석서)

## 1. Project Overview (프로젝트 개요)
- **App**: {app-slug} — {app-name}
- **Background and Purpose (배경 및 목적)**: ...
- **Expected Benefits (기대 효과)**: ...

## 2. Stakeholders (이해관계자)
| Role | Person/Team | Responsibility |

## 3. Requirements (요구사항 목록)
### Functional Requirements (기능 요구사항)
| ID | Requirement | Priority | Note |
| FR-{DOMAIN}-001 | ... | P0 | |

### Non-Functional Requirements (비기능 요구사항)
| ID | Requirement | Criteria |
| NFR-001 | Response time | < 200ms |
| NFR-002 | Multi-tenancy | ent_id isolation |

## 4. Scope Definition (범위 정의)
## 5. Constraints and Assumptions (제약사항 및 가정)
## 6. Related Systems (연관 시스템)
## 7. Success Metrics (성공 지표)
```

---

## Stage 2: Design (설계 단계)

Present the menu to users:

```
"Analysis is complete. The following design documents can be generated:
1. Event Scenario (이벤트 시나리오)
2. Requirements Definition (요구사항 정의서)
3. Functional Specification (기능 정의서)
4. UI Specification (화면 기획서) — ⭐ Web Style Guide 준수
5. Sequence Diagram (시퀀스 다이어그램)
6. ERD — ⭐ Code Convention §4 DB Naming 준수
7. Process Definition (프로세스 정의서)
8. Policy Definition (정책 정의서)
9. User Guide (사용자 가이드)
All of them, or specific ones?"
```

### 2-4. UI Specification (화면 기획서) — Web Style Guide MUST

```markdown
# {기능명} 화면 기획서

## 화면 목록
| Screen ID | Screen Name | Route | Layout Type |
|-----------|-------------|-------|-------------|
| SCR-001 | {화면명} | /{slug}/path | Basic-A-1 |

## SCR-001: {화면명}

### Layout (Web Style Guide §1~3 준수)
- **Layout Type**: Basic-A-1 / Basic-A-2-R / Basic-A-2-L
- **Content Padding**: 24px (p-6)
(ASCII 와이어프레임)

### Components (Web Style Guide §7 준수)
| Element | Type | Style Ref | Description | Action |
|---------|------|-----------|-------------|--------|
| 검색바 | Input | WSG §7.2 | 키워드 입력 | 엔터 시 검색 |
| 목록 | DataTable | WSG §7.3 | 데이터 테이블 | 행 클릭 시 상세 |

### Color & Typography (Web Style Guide §5~6 준수)
- Primary action: `blue-600` (Primary color)
- Text: `gray-900` (base), `gray-500` (secondary)
- Font: system default, size hierarchy per WSG §6

### Responsive Design (Web Style Guide §10 준수)
- Desktop (≥1024px): Full layout
- Tablet (768~1023px): Sidebar collapsed
- Mobile (<768px): Sidebar hidden

### Frontend Implementation
- **Framework**: React 18
- **State management**: Zustand (global) + React Query (server)
- **Routing**: React Router
- **Form**: React Hook Form + Zod validation
- **i18n**: react-i18next (ko/en/vi)
```

### 2-5. Sequence Diagram (시퀀스 다이어그램)

```markdown
# {기능명} 시퀀스 다이어그램

## Scenario 1: {시나리오명}

​```mermaid
sequenceDiagram
    actor User
    participant Frontend as React SPA
    participant BFF as NestJS BFF
    participant DB as MySQL
    participant AMA as AMA SSO

    User->>Frontend: {action}
    Frontend->>BFF: API call (JWT in header)
    BFF->>AMA: JWT verification
    AMA-->>BFF: JWT payload (entityId, userId)
    BFF->>DB: Query (WHERE ent_id = :entityId)
    DB-->>BFF: Result
    BFF-->>Frontend: Standard response { success, data }
    Frontend-->>User: UI update
​```
```

### 2-6. ERD — Code Convention §4 MUST

```markdown
# {기능명} ERD

## ER Diagram

​```mermaid
erDiagram
    TABLE_A ||--o{ TABLE_B : "has many"
    TABLE_A {
        char(36) {prefix}_id PK
        char(36) ent_id FK "AMA Entity ID — MUST"
        varchar {prefix}_name
        datetime {prefix}_created_at
        datetime {prefix}_updated_at
        datetime {prefix}_deleted_at "Soft Delete"
    }
​```

## Table Definition

### {table_name} (Code Convention §4 준수)
| Column | Type | NULL | Default | Description |
|--------|------|------|---------|-------------|
| {prefix}_id | CHAR(36) | NO | UUID | PK |
| ent_id | CHAR(36) | NO | — | ★ AMA Entity ID (멀티테넌시) |
| {prefix}_created_at | DATETIME | NO | CURRENT_TIMESTAMP | |
| {prefix}_updated_at | DATETIME | NO | CURRENT_TIMESTAMP ON UPDATE | |
| {prefix}_deleted_at | DATETIME | YES | NULL | Soft Delete |
```

---

## Stage 3: Implementation (구현 단계)

### 3-1. Development Plan (개발계획서)

```markdown
# {Feature Name} — Development Plan ({기능명} 개발계획서)

## 1. Overview (개요)
- **App**: {app-slug}
- **Development period** / Team members
- **Scope**: References to design documents

## 2. Technical Architecture (기술 아키텍처)
- System architecture diagram
- Tech stack: React 18 + NestJS 10 + MySQL 8.0
- Clean Architecture layers
- **Code Convention**: `reference/amoeba_code_convention_v2.md` MUST
- **Web Style Guide**: `reference/amoeba_web_style_guide_v2.md` MUST

## 3. Development Environment (개발 환경)
- Dev / Staging configuration
- **Branch strategy**:
  - `main` — Staging
  - `feature/{slug}/{description}` — per-task branches
  - `production` — Production (향후)

## 4. Schedule Summary (개발 일정)
| Phase | Duration | Deliverable | Milestone |

## 5. Risk Management (리스크 관리)
| Risk | Impact | Mitigation |
```

### 3-2. WBS (Work Breakdown Structure)

```markdown
# {Feature Name} — WBS

## Task List (태스크 목록)

| ID | Task | Related FR | Effort | Depends On | Assignee | Status |
|----|------|-----------|--------|------------|----------|--------|
| T-101 | {task} | FR-VEH-001 | {n}d | — | {person} | TODO |
| T-102 | {task} | FR-VEH-002 | {n}d | T-101 | {person} | TODO |
```

**Task ID Rule**: `T-{Phase}{2-digit sequence}` (e.g., `T-101`, `T-201`)
**Task Status**: `TODO` → `IN_PROGRESS` → `DONE` → `VERIFIED`

### 3-3. Task Plan (태스크 작업계획서)

```markdown
# Task Plan: T-{n} {Task Name}

## Basic Information (기본 정보)
- **Task ID**: T-{n}
- **Branch**: `feature/{slug}/{description}`
- **Assignee**: {person}
- **Estimated effort**: {n} days

## Implementation Plan (구현 계획)
- **Code Convention 준수 항목**: DB Naming §4, Backend §5, Frontend §6~7
- **Web Style Guide 준수 항목**: Layout §1~3, Components §7

## Acceptance Criteria (완료 조건)
- [ ] Implementation per spec
- [ ] Code Convention compliance verified
- [ ] Web Style Guide compliance verified (UI tasks)
- [ ] Unit tests pass
- [ ] Code review approved
```

### 3-4. Task Report (태스크 작업리포트)

```markdown
# Task Report: T-{n} {Task Name}

## Basic Information (기본 정보)
- **Task ID**: T-{n}
- **PR**: #{pr-number}
- **Planned effort**: {n}d → **Actual effort**: {m}d

## Changes (변경 사항)
- Changed files list
- DB migration details
- **Convention Compliance**: Code Convention / Web Style Guide

## Issues Encountered (이슈 및 해결)
| Issue | Cause | Resolution |
```

---

## Stage 4: Unit Test (단위테스트 단계)

### 4-1. Test Cases (테스트 케이스)

```markdown
# {기능명} 테스트 케이스

## API Test Cases (Code Convention §8 API Design 기준)

| TC ID | Category | Related FR/BR | Scenario | Method | Endpoint | Input | Expected | Status |
|-------|----------|---------------|----------|--------|----------|-------|----------|--------|
| TC-VEH-001 | Normal | FR-VEH-001 | Vehicle registration success | POST | /api/v1/vehicles | Valid data | 201, { success: true, data: {...} } | TODO |
| TC-VEH-002 | Error | FR-VEH-001 | Duplicate plate | POST | /api/v1/vehicles | Existing plate | 409, { success: false, error: { code: 'CAR-E3001' } } | TODO |

## Multi-tenancy Test Cases (Code Convention §12 준수)

| TC ID | Scenario | Pre-condition | Action | Expected | Status |
|-------|----------|---------------|--------|----------|--------|
| TC-MT-001 | Cross-entity data isolation | Entity A data exists | Entity B queries | Empty result | TODO |
```

### 4-2. Unit Test Report (단위 테스트 리포트)

```markdown
# {기능명} 단위 테스트 리포트

## Summary
| Domain | Total | PASS | FAIL | SKIP | BLOCKED | Pass Rate |
|--------|:-----:|:----:|:----:|:----:|:-------:|:---------:|
```

---

## Stage 5: Final Test (최종테스트 단계)

### 5-1. Integration Test Plan

```markdown
# {기능명} 통합 테스트 계획서

## Integration Scenarios (이벤트 시나리오 기반 E2E)
### ITC-001: {End-to-End Scenario}
- **Based on**: Event Scenario 1
- **Verification points**: AMA JWT auth → Subscription check → Data CRUD → ent_id isolation
```

### 5-2. Final Test Report

```markdown
# {기능명} 최종 테스트 리포트

## Release Judgment (릴리즈 판정)
- [ ] All integration scenarios passed
- [ ] No critical/major bugs
- [ ] Performance criteria met
- [ ] Code Convention compliance verified
- [ ] Web Style Guide compliance verified
- [ ] Release approved → deploy
```

---

## GitHub Integration / GitHub 연동

### Issue Types

#### Bug Report
```markdown
---
title: "[BUG] {Short description}"
labels: ["bug", "severity:{critical|major|minor}", "{app-slug}"]
---
## Bug Description
## Steps to Reproduce
## Expected / Actual Behavior
## Related: #{issue}, FR-{n}
```

#### Feature Request
```markdown
---
title: "[FEAT] {Short description}"
labels: ["feature", "priority:{P0|P1|P2}", "{app-slug}"]
---
## Feature Description
## User Story
## Acceptance Criteria
```

#### Enhancement
```markdown
---
title: "[ENHANCE] {Short description}"
labels: ["enhancement", "{app-slug}"]
---
## Current Behavior
## Proposed Improvement
## Impact Assessment
```

### Issue Lifecycle & Branch Convention

```
Issue created → Branch created → Development → PR → Review → Merge → Issue closed

Branch naming:
  feature/{app-slug}/{description}
  fix/{app-slug}/{description}
  hotfix/{app-slug}/{description}
  docs/{description}
```

---

## Document Traceability / 문서 간 연결

```
Requirements Analysis FR-001
  → Functional Spec: FN-001
  → Sequence Diagram: FN-001 flow
  → ERD: tables for FN-001 (Code Convention §4 준수)
  → UI Spec: SCR-001 (Web Style Guide 준수)
  → WBS: T-001 task
    → Branch: feature/{slug}/{desc}
    → PR: #{pr-n} → Code Review → Merge
  → Test Case: TC-001
  → Integration Test: ITC-001
```

---

## Writing Guidelines / 작성 가이드라인

### Tone and Style
- Concise and clear
- Code examples should be **production-ready** and **Code Convention compliant**
- UI descriptions should reference **Web Style Guide** section numbers
- Consistent ID system: FR, FN, SCR, PRC, POL, T, TC, ITC

### ambAppStore-Specific Considerations
- Multi-tenancy via `ent_id` (AMA Entity ID)
- JWT SSO Passthrough (no app-level auth)
- Per-app isolation (DB, Docker, build)
- MySQL 8.0 (not PostgreSQL)
- React only (not Vue.js)
- Clean Architecture 4-layer pattern

### Convention Enforcement in Documents

모든 문서에 다음을 명시:
- **ERD/스키마**: "Code Convention §4 DB Naming Rules 준수"
- **API 설계**: "Code Convention §8 API Design 준수"
- **화면 기획**: "Web Style Guide §1~3 Layout + §5~7 Visual 준수"
- **기능 정의**: "Code Convention §3 Architecture + §5 Backend + §6~7 Frontend 준수"
- **개발 계획**: "Code Convention + Web Style Guide 전체 준수"

---

## Process Rules / 프로세스 적용 규칙

| Rule | Description |
|------|-------------|
| **순서 준수** | REQ → ANALYSIS → TASK-PLAN → 구현 → TEST-CASE → REPORT |
| **입력물 참조** | 각 문서의 `based_on` 필드에 입력물 document_id 기록 |
| **버전 동기화** | REQ 변경 시 ANALYSIS 이후 문서도 버전 bump |
| **Phase 단위** | 작업계획서/테스트케이스/완료보고서는 Phase 단위 |
| **간소화 허용** | 핫픽스/버그 수정은 REPORT만 작성 가능 |
| **컨벤션 필수** | 코드 관련 문서는 Code Convention + Web Style Guide 참조 표기 |

| Trigger | Required Documents |
|---------|-------------------|
| 새 앱 개발 시작 | REQ → ANALYSIS → TASK-PLAN |
| Phase 구현 착수 | TASK-PLAN (해당 Phase) |
| Phase 구현 완료 | TEST-CASE → REPORT |
| 기능 추가 (대규모) | REQ 갱신 → ANALYSIS 갱신 → TASK-PLAN |
| 기능 추가 (소규모) | TASK-PLAN (간소) → TEST-CASE → REPORT |
| 핫픽스/버그 수정 | REPORT (간소) |

---

## References

- **[코드 컨벤션](../../../reference/amoeba_code_convention_v2.md)** ⭐ MUST
- **[웹 스타일 가이드](../../../reference/amoeba_web_style_guide_v2.md)** ⭐ MUST
- [원본 SDLC 스킬](../../../reference/amoeba-spec-generator-SKILL-v3.1.md)
- [앱 개발 스킬](../amb-app-store/SKILL.md)
- [기능명세서](../../../reference/func-definition.md)
- [요구사항정의서](../../../reference/requirements.md)
- [화면정의서](../../../reference/ui-spec.md)
- [프로젝트수행계획서](../../../reference/project-plan.md)
