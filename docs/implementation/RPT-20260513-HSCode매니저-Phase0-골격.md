---
document_id: HSCM-IMPL-RPT-PHASE0
version: 1.0.0
status: Done
created: 2026-05-13
updated: 2026-05-13
app: app-hscode-manager
phase: 0
based_on:
  - docs/plan/PLAN-20260513-HSCode매니저-앱전체구현.md
  - docs/test/TC-20260513-HSCode매니저-앱전체구현.md
---

# HS Code Manager — Phase 0 작업완료보고서

> Phase 0 (Foundation) 구현이 완료되었다. BE/FE 골격이 컴파일·빌드 통과, 헬스체크·Swagger·i18n·AMA JWT 인증 스텁·DB 마이그레이션 초기 스크립트까지 갖춰졌다. Phase 1 마스터 데이터·권한으로 진입할 수 있다.

---

## 1. 완료 범위

| Step | 내용 | 결과 |
|------|------|------|
| 0.1 | Backend 골격 (NestJS 11 + TypeORM + Auth + Swagger) | ✔ |
| 0.2 | Frontend 골격 (Vite + React + Tailwind + i18n 3개 언어 + S01) | ✔ |
| 0.3 | 인프라 (BE/FE Dockerfile, docker-compose, nginx.conf, .env.example) | ✔ |
| 0.4 | DB 초기화 SQL + 5개 placeholder 엔티티 (Inquiry/Item/Classification/ExpertReview/VerificationEvent) | ✔ |
| 0.5 | TypeScript 빌드 검증 (BE/FE tsc + nest build + vite build) | ✔ |

---

## 2. 생성 파일 (56개)

### 2.1 Backend (29개)

```
apps/app-hscode-manager/backend/
├── .gitignore
├── Dockerfile
├── nest-cli.json
├── package.json
├── tsconfig.json
├── scripts/init-db.sql
└── src/
    ├── main.ts
    ├── app.module.ts
    ├── health.controller.ts
    ├── auth/
    │   ├── auth.module.ts
    │   ├── jwt.strategy.ts
    │   ├── decorators/{auth,current-user,public,roles}.decorator.ts (4)
    │   ├── guards/{jwt-auth,role,entity-scope}.guard.ts (3)
    │   └── interfaces/ama-jwt-payload.interface.ts
    ├── common/
    │   ├── error-codes.ts
    │   ├── dto/{api-response,pagination}.dto.ts (2)
    │   └── filter/global-exception.filter.ts
    └── domain/
        ├── placeholder.module.ts
        ├── inquiry/entity/inquiry.entity.ts
        ├── item/entity/item.entity.ts
        ├── classification/entity/classification.entity.ts
        ├── expert-review/entity/expert-review.entity.ts
        └── verification/entity/verification-event.entity.ts
```

### 2.2 Frontend (15개)

```
apps/app-hscode-manager/frontend/
├── .gitignore
├── Dockerfile
├── index.html
├── nginx.conf
├── package.json
├── postcss.config.js
├── tailwind.config.ts
├── tsconfig.json
├── vite.config.ts
└── src/
    ├── App.tsx
    ├── main.tsx
    ├── index.css
    ├── vite-env.d.ts
    ├── lib/{api-client,query-client}.ts (2)
    ├── stores/auth.store.ts
    ├── i18n/i18n.ts
    ├── i18n/locales/{ko,en,vi}/common.json (3)
    └── pages/dashboard/DashboardPage.tsx
```

### 2.3 인프라 (2개)
- `apps/app-hscode-manager/docker-compose.app-hscode-manager.yml`
- `apps/app-hscode-manager/.env.example`

---

## 3. TC 결과

| TC ID | 시나리오 | 결과 |
|-------|---------|------|
| TC-F0-001 | BE TypeScript compile | **PASS** (`tsc --noEmit` exit 0) |
| TC-F0-002 | FE TypeScript compile | **PASS** (`tsc -b` exit 0) |
| TC-F0-020 | `init-db.sql` 작성 | **PASS** (파일 존재, DB+사용자+권한 정의) |
| TC-F0-021 | TypeORM 빈 엔티티 5개 매핑 | **PASS** (autoLoadEntities + PlaceholderModule로 등록) |
| — | `nest build` | **PASS** (dist/ 생성) |
| — | `vite build` | **PASS** (dist/ 243.96 kB JS, 6.72 kB CSS) |

> 런타임 검증 (TC-F0-003 헬스체크, TC-F0-005 FE 렌더, TC-F0-010~013 JWT)은 *로컬 DB 기동 후* 수행 가능. Phase 1 통합 단계에서 함께 검증.

---

## 4. 핵심 설계 결정

### 4.1 AMA JWT SSO Passthrough
- car-manager 패턴을 그대로 채택 (`jwt.strategy.ts`, `JwtAuthGuard`)
- `ALLOW_ENTITY_HEADER_AUTH=true` 환경변수로 스테이징 디버깅용 헤더 인증 fallback 유지
- 자체 회원가입 없음 (CLAUDE.md 정책 준수)

### 4.2 EntityScopeGuard (Phase 1.4 선행 일부 반영)
- JWT에 `ent_id` 존재 여부만 검증하는 가드를 Phase 0에서 정의
- 실제 행 수준 필터링은 Phase 1 Service 레이어 도입 시 함께 적용
- `@Auth()` 데코레이터에 자동 포함 — Phase 1 진입 시 누락 없음

### 4.3 에러 코드 체계
- `HSC-E{4자리}` 대역 사전 정의 (`backend/src/common/error-codes.ts`)
- 인증 E01XX / 마스터 E02XX / Intake E03XX / Classification E04XX / Verification E05XX / Expert E06XX / Admin E07XX / External E08XX / System E99XX

### 4.4 표준 응답 포맷
- `{ success, data, error?, timestamp }` 헬퍼 `ok()` / `fail()` 미리 작성 (Phase 1 이후 활용)

### 4.5 빈 엔티티 5개 사전 정의
- Phase 1~6에서 컬럼이 추가되더라도 *테이블명·prefix는 확정*
- TypeORM `synchronize=true` (개발 모드)로 즉시 테이블 생성 가능
- Amoeba 컨벤션: `hsc_inquiries` 테이블 / `inq_` 컬럼 prefix / `ent_id` 멀티테넌시 컬럼 포함 / 타임스탬프 (created/updated/deleted) 표준화

### 4.6 i18n 3개 언어 초기화
- 한국어 기본, 영어·베트남어 토글 가능 (App.tsx 상단)
- `common` 네임스페이스 하나로 시작 — Phase 1 이후 도메인별 추가 (`inquiry.json`, `matching.json` 등)

### 4.7 라우팅 base path
- Vite `base: '/app-hscode'` + BrowserRouter `basename="/app-hscode"`
- Nginx `apps.amoeba.site.conf`에 이미 `/app-hscode/` → `web-hscode-manager:80` 매핑 존재 (변경 없음)

---

## 5. 사이드 임팩트 (실제 발생)

| 범위 | 영향 | 상태 |
|------|------|------|
| 다른 앱 (car-manager 등) | 없음 | ✔ 격리 |
| 플랫폼 BFF/DB | 없음 | ✔ 별도 컨테이너·DB |
| Nginx | 변경 없음 (이미 매핑) | ✔ |
| Turborepo | 자동 인식 (apps/* glob) | ✔ |
| npm workspaces | 자동 인식 (apps/*/backend, apps/*/frontend) | ✔ |
| deploy-staging.sh | **미수정** — Phase 1 진입 전 hscode 빌드/기동 단계 추가 필요 | ⚠ 후속 작업 |

> **후속 작업**: `platform/scripts/deploy-staging.sh`에 hscode 분기 추가 (Phase 1 첫 스테이징 배포 전 필수).

---

## 6. 검증 명령

```bash
# Backend tsc + build
cd apps/app-hscode-manager/backend
npx tsc --noEmit         # → exit 0
npm run build            # → dist/ 생성

# Frontend tsc + build
cd apps/app-hscode-manager/frontend
npm run typecheck        # → exit 0
npm run build            # → dist/ 생성

# 로컬 기동 (DB 필요)
# 1) MySQL에서 init-db.sql 실행
mysql -uroot -p < apps/app-hscode-manager/backend/scripts/init-db.sql
# 2) .env 파일 작성 (.env.example 참조)
# 3) BE 기동
cd apps/app-hscode-manager/backend && npm run dev
# 4) FE 기동
cd apps/app-hscode-manager/frontend && npm run dev
# 5) 헬스체크
curl http://localhost:3102/api/v1/health
# → { "status": "ok", "service": "hscode-manager-api", ... }
# 6) Swagger UI
open http://localhost:3102/api/docs
# 7) FE 대시보드
open http://localhost:5202/app-hscode/
```

---

## 7. 다음 단계 (Phase 1 진입)

Phase 1 — 마스터 데이터 & 권한 (2~3주 추정):
1. **Step 1.1** ImportCountry / ExportCountry CRUD + 어댑터 매핑
2. **Step 1.2** Exporter 마스터 + 시드
3. **Step 1.3** ExternalDataSource + FTA Matrix
4. **Step 1.4** User / Role / UserRole — *EntityScopeGuard 실제 행 수준 필터링 적용*
5. **Step 1.5** S17 (마스터 관리) + S19 (사용자·권한) UI

진입 전 선행 작업:
- [ ] `platform/scripts/deploy-staging.sh`에 hscode 빌드/기동 분기 추가
- [ ] `apps/app-hscode-manager/DB-SCHEMA-hscode-manager.md` 작성 (Phase 1 테이블 DDL 누적)
- [ ] 사용자 진행 지시 ("Phase 1 시작")

---

## 8. 회고

- **잘 된 점**: car-manager 패턴을 일관성 있게 복제해 Phase 0이 1세션 내에 마무리됨. 빌드 검증까지 통과.
- **개선 여지**: deploy-staging.sh 자동 갱신은 별도 작업으로 분리됨 — Phase 1 시작 전 반드시 완료 필요.
- **위험**: Phase 1에서 멀티테넌시 행 수준 격리 누락 시 NFR-SE-01 위반 (TC-M1-042~044 P0 필수).
