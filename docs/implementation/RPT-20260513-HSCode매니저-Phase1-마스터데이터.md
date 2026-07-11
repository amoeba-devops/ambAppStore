---
document_id: HSCM-IMPL-RPT-PHASE1
version: 1.0.0
status: Done
created: 2026-05-13
updated: 2026-05-13
app: app-hscode-manager
phase: 1
based_on:
  - docs/plan/PLAN-20260513-HSCode매니저-앱전체구현.md
  - docs/test/TC-20260513-HSCode매니저-앱전체구현.md
  - apps/app-hscode-manager/DB-SCHEMA-hscode-manager.md
---

# HS Code Manager — Phase 1 작업완료보고서

> Phase 1 (마스터 데이터 & 권한) 구현 완료. 5개 마스터 도메인 (수입국·수출국·Exporter·외부 데이터 소스·FTA 매트릭스)과 사용자 프로필 엔드포인트(`/me`), 그리고 S17 마스터 관리 화면(5개 탭)이 BE/FE 모두 빌드 통과. Phase 2 (Intake) 진입 가능.

---

## 1. 완료 범위

| Step | 내용 | 결과 |
|------|------|------|
| 1.0 | DB 스키마 문서 (`DB-SCHEMA-hscode-manager.md`) + 마이그레이션 SQL 2개 (`phase1_master.sql`, `seed-phase1.sql`) | ✔ |
| 1.1 | `master-country` 도메인 — ImportCountry / ExportCountry 풀세트 (entity·DTO·mapper·service·controller·module) | ✔ |
| 1.2 | `master-exporter` 도메인 — Exporter CRUD + 검색·페이징 (alias JSON_SEARCH 포함) | ✔ |
| 1.3 | `master-data-source` + `master-fta` 도메인 — 외부 어댑터 등록 + FTA 매트릭스 + lookup API | ✔ |
| 1.4 | `user/me` 엔드포인트 — JWT 기반 사용자 정보 (User 테이블 캐싱은 Phase 5/6으로 이연) | ✔ |
| 1.5 | Frontend — S17 마스터 관리 6탭 (수입국·수출국·Exporter·외부소스·FTA·내정보) | ✔ |
| — | Backend tsc + nest build | **PASS** |
| — | Frontend tsc + vite build | **PASS** (355.59 kB JS, 14.84 kB CSS) |

---

## 2. 생성·수정 파일 요약

### 2.1 DB 스키마 / 마이그레이션 (신규 3)
- `apps/app-hscode-manager/DB-SCHEMA-hscode-manager.md` — 누적 DDL 정의서
- `apps/app-hscode-manager/db-migrations/2026-05-13_phase1_master.sql` — 5개 테이블 DDL
- `apps/app-hscode-manager/db-migrations/seed-phase1.sql` — 수입국 6 / 수출국 8 / 외부소스 2 시드

### 2.2 Backend 도메인 (신규 30 + app.module 수정 1)

```
backend/src/domain/
├── master-country/
│   ├── entity/{import-country,export-country}.entity.ts  (2)
│   ├── dto/request/{create-import,update-import,update-import-status,
│   │   create-export,update-export}.request.ts           (5)
│   ├── dto/response/{import-country,export-country}.response.ts  (2)
│   ├── mapper/{import-country,export-country}.mapper.ts  (2)
│   ├── service/{import-country,export-country}.service.ts (2)
│   ├── controller/{import-country,export-country}.controller.ts (2)
│   └── master-country.module.ts                          (1)
├── master-exporter/
│   ├── entity/exporter.entity.ts
│   ├── dto/request/{create-exporter,update-exporter,list-exporters}.{request,query}.ts (3)
│   ├── dto/response/exporter.response.ts
│   ├── mapper/exporter.mapper.ts
│   ├── service/exporter.service.ts
│   ├── controller/exporter.controller.ts
│   └── master-exporter.module.ts                          (8)
├── master-data-source/
│   ├── entity/external-data-source.entity.ts
│   ├── dto/request/upsert-data-source.request.ts (Create + Update)
│   ├── dto/response/external-data-source.response.ts
│   ├── mapper/external-data-source.mapper.ts
│   ├── service/external-data-source.service.ts
│   ├── controller/external-data-source.controller.ts
│   └── master-data-source.module.ts                       (7)
├── master-fta/
│   ├── entity/fta-matrix.entity.ts
│   ├── dto/request/{upsert-fta,list-fta}.{request,query}.ts (2)
│   ├── dto/response/fta-matrix.response.ts
│   ├── mapper/fta-matrix.mapper.ts
│   ├── service/fta-matrix.service.ts
│   ├── controller/fta-matrix.controller.ts
│   └── master-fta.module.ts                               (8)
└── user/
    ├── controller/me.controller.ts
    └── user.module.ts                                     (2)
```

`backend/src/app.module.ts` — UserModule + MasterCountry + MasterExporter + MasterDataSource + MasterFta 모듈 5개 등록.

### 2.3 Frontend (신규 18)

```
frontend/src/
├── components/
│   ├── layout/AppLayout.tsx                    (전체 레이아웃: 헤더+사이드바+컨텐츠)
│   └── ui/
│       ├── AlertModal.tsx                      (CLAUDE.md UX 규칙: 모든 버튼 동작 후 결과 안내)
│       └── StatusBadge.tsx                     (active/beta/inactive/info 등 색상 배지)
├── lib/api-response.ts                         (envelope unwrap 헬퍼)
├── types/master.types.ts                       (도메인 타입)
├── services/
│   ├── master-country.service.ts
│   ├── exporter.service.ts
│   ├── data-source.service.ts
│   ├── fta.service.ts
│   └── me.service.ts                           (5)
├── pages/admin/
│   ├── AdminLayoutPage.tsx                     (탭 레이아웃)
│   ├── MasterImportCountryPage.tsx             (S17 수입국)
│   ├── MasterExportCountryPage.tsx             (S17 수출국)
│   ├── MasterExporterPage.tsx                  (S17 Exporter + 검색)
│   ├── MasterDataSourcePage.tsx                (S17 외부 소스)
│   ├── MasterFtaPage.tsx                       (S17 FTA + lookup)
│   └── UserProfilePage.tsx                     (S19 내 정보)
└── i18n/locales/{ko,en,vi}/admin.json          (3)
```

`frontend/src/App.tsx` — Admin 중첩 라우팅 + MeBootstrap 추가.
`frontend/src/i18n/i18n.ts` — admin 네임스페이스 추가.

---

## 3. API 엔드포인트 매트릭스

| 도메인 | Method | Path | 권한 | 상태 |
|--------|--------|------|------|------|
| 수입국 | GET | `/api/v1/import-countries` | Auth | ✔ |
| 수입국 | GET | `/api/v1/import-countries/:id` | Auth | ✔ |
| 수입국 | POST | `/api/v1/import-countries` | Auth + ADMIN | ✔ |
| 수입국 | PATCH | `/api/v1/import-countries/:id` | Auth + ADMIN | ✔ |
| 수입국 | PATCH | `/api/v1/import-countries/:id/status` | Auth + ADMIN | ✔ |
| 수입국 | DELETE | `/api/v1/import-countries/:id` | Auth + ADMIN | ✔ |
| 수출국 | GET·POST·PATCH·DELETE | `/api/v1/export-countries[/:id]` | Auth (+ADMIN for mutations) | ✔ |
| 수출업체 | GET·POST·PATCH·DELETE | `/api/v1/exporters[/:id]` | Auth (`entId` 격리) | ✔ |
| FTA 매트릭스 | GET (목록·lookup), POST·PATCH·DELETE | `/api/v1/fta-matrix[/:id|/lookup]` | Auth (+ADMIN) | ✔ |
| 외부 소스 | GET·POST·PATCH·DELETE | `/api/v1/external-data-sources[/:id]` | Auth (+ADMIN) | ✔ |
| 사용자 | GET | `/api/v1/me` | Auth | ✔ |

**총 24개 엔드포인트** (헬스체크 제외).

---

## 4. 핵심 설계 결정

### 4.1 멀티테넌시 격리 — `EntityScopeGuard`
- `@Auth()` 데코레이터가 JwtAuthGuard + RoleGuard + EntityScopeGuard 3개를 묶어 적용
- `EntityScopeGuard` — JWT의 `ent_id` 존재 검증 (`HSC-E0105`)
- `ExporterService.findAll/findById/update/softDelete` 모두 `entId` 파라미터 강제 — Repository 쿼리에서 항상 `where: { entId, ... }`로 필터링
- 글로벌 마스터(수입국·수출국·FTA·외부소스)는 `ent_id` 컬럼이 없는 *시스템 마스터*로 분리해 정보 유출 위험 자체를 제거

### 4.2 ImportCountry 상태 전이 가드
- `ACTIVE` 또는 `BETA` 승격 시 `adapter_key`가 반드시 등록되어야 함 (`HSC-E0211`)
- 코드 측 어댑터 구현이 없어도 Phase 1에서는 키 등록만으로 통과 — Phase 3에서 실제 어댑터 인스턴스 매핑

### 4.3 FTA Matrix lookup
- `GET /api/v1/fta-matrix/lookup` — 현재 유효(`effective_from ≤ today ≤ effective_to or null`) 협정 중 *최저 세율* 반환
- 인덱스: `(import, export, hs_code)` + `(effective_from, effective_to)`
- TC-M1-031 (만료 행 미반환) 충족

### 4.4 Exporter alias 검색
- MySQL `JSON_SEARCH(aliases, 'one', :exact)` 사용
- TC-M1-022 alias 다중 검색 충족

### 4.5 표준 응답 envelope
- 모든 컨트롤러가 `ok(data)` 헬퍼 사용 → `{ success: true, data, timestamp }`
- 에러는 NestJS HttpException + `HscodeErrorCode` 코드 (E01XX~E08XX)
- Frontend `unwrap()` 헬퍼로 응답 처리 일원화

### 4.6 AlertModal — CLAUDE.md UX 규칙 준수
- 모든 mutation 페이지에 `AlertModal` 인스턴스 부착
- 성공: 자동 닫힘 3초, 에러: 수동 닫기, 텍스트는 i18n
- 삭제는 `window.confirm` (Phase 2에서 별도 `ConfirmModal`로 교체 예정)

### 4.7 i18n 3개 언어
- `common.json` + `admin.json` 네임스페이스 추가, 각 ko/en/vi 완성
- 누락 키 0 (S17 6탭 + S19 모든 라벨)

---

## 5. TC 결과 (Phase 1)

| TC ID | 시나리오 | 상태 |
|-------|---------|------|
| TC-F0-001/002 (Phase 0 회귀) | BE/FE tsc compile | **PASS** |
| TC-M1-001 | 수입국 목록 조회 | **READY** (런타임 검증 대기) |
| TC-M1-002 | 수입국 생성 (NOT_SUPPORTED) | **READY** |
| TC-M1-003 | 중복 ISO 코드 (HSC-E0201) | **READY** (Service 검증 구현됨) |
| TC-M1-005 | 어댑터 미연결 ACTIVE 승격 (HSC-E0211) | **READY** (Service 검증 구현됨) |
| TC-M1-006 | 비관리자 mutation (403) | **READY** (`@Roles(ADMIN)` 적용) |
| TC-M1-008 | 다국어 명칭 ko/en/vi | **READY** |
| TC-M1-020 | Exporter 생성 | **READY** |
| TC-M1-021 | Exporter LIKE 검색 | **READY** |
| TC-M1-022 | alias JSON_SEARCH | **READY** |
| TC-M1-030 | (VN, KR, hs_code) FTA 조회 | **READY** (`/fta-matrix/lookup`) |
| TC-M1-031 | 만료 행 미반환 | **READY** (effective range 조건) |
| TC-M1-042~044 | 멀티테넌시 격리 | **READY** (Service 강제 `entId` 필터) |
| TC-M1-060~064 | UI 화면 (S17, S19) | **READY** (i18n 3언어 완성) |

> 런타임 검증 (실제 MySQL DB 기동 후) 은 Phase 2 진입 전 별도 수행. Static check (build·tsc·로직 검토)는 모두 통과.

---

## 6. 사이드 임팩트

| 범위 | 영향 | 상태 |
|------|------|------|
| Phase 0 골격 | 변경 없음 (auth/common 그대로 재사용) | ✔ |
| Placeholder 엔티티 5개 | 그대로 유지 — Phase 2 진입 시 정식 도메인으로 분리 | ⏸ |
| DB 부하 | 시드 데이터 16건 (수입국+수출국+외부소스). FTA 매트릭스는 사용자가 추가. | ✔ |
| AMA SSO | JWT에 `roles` 필드가 있다고 가정 — ADMIN 권한이 비어 있으면 모든 mutation이 403. **운영 진입 전 AMA에서 역할 발급 흐름 확정 필요**. | ⚠ |
| `deploy-staging.sh` | 여전히 미수정 — Phase 1 첫 스테이징 배포 전 작업 필요 | ⚠ 후속 |

---

## 7. 검증 명령

```bash
# Backend
cd apps/app-hscode-manager/backend
npx tsc --noEmit       # exit 0
npm run build          # dist/ 생성

# Frontend
cd apps/app-hscode-manager/frontend
npm run typecheck      # exit 0
npm run build          # dist/ 생성

# DB 마이그레이션 (로컬)
mysql -uroot -p < apps/app-hscode-manager/db-migrations/2026-05-13_phase1_master.sql
mysql -uroot -p db_app_hscode < apps/app-hscode-manager/db-migrations/seed-phase1.sql

# 로컬 기동 후 검증
curl -H "Authorization: Bearer ${AMA_JWT}" http://localhost:3102/api/v1/import-countries
curl -H "Authorization: Bearer ${AMA_JWT}" http://localhost:3102/api/v1/me
curl "http://localhost:3102/api/v1/fta-matrix/lookup?import_country=VN&export_country=KR&hs_code=7220.20.10" \
  -H "Authorization: Bearer ${AMA_JWT}"
```

---

## 8. 다음 단계 (Phase 2 진입)

Phase 2 — 입력 채널(Intake), 3~4주:
1. **Step 2.1** `inquiry` 도메인 — Inquiry CRUD + 상태 전이 + S02 화면
2. **Step 2.2** `item` 도메인 — Item 마스터 + composition_hash placeholder
3. **Step 2.3a** 직접 입력 (S06) + 카테고리 동적 폼
4. **Step 2.3b** 엑셀 일괄 등록 (S04, S05) + 보류 큐 + 매핑 프로파일
5. **Step 2.3c** 바코드 보조 (S03 옵션, 우선순위 낮음)

선행 작업:
- [ ] AMA에서 hscode 앱의 사용자 역할(ADMIN/MANAGER 등) 발급 흐름 확정
- [ ] `platform/scripts/deploy-staging.sh`에 hscode 빌드/기동 분기 추가
- [ ] (선택) 통합 테스트 환경에서 TC-M1-* 런타임 검증 수행

---

## 9. 회고

- **잘 된 점**: 4개 마스터 도메인을 동일한 컨벤션(엔티티→DTO→Mapper→Service→Controller→Module)으로 일관성 있게 작성. AlertModal로 UX 규칙(CLAUDE.md)을 모든 mutation에 적용. tsc/build 1회에 통과.
- **개선 여지**: 화면에서 `window.confirm` 대신 별도 `ConfirmModal` 컴포넌트 필요 — Phase 2에서 추출. ExporterPage의 `update` 기능은 아직 없음(create + delete만) — Phase 2 진입 전 보강 검토.
- **위험**: ADMIN 역할이 JWT의 `roles` 클레임에서 매핑되는데, AMA SSO가 어떤 형식으로 발급하는지 *운영 환경에서* 확인되어야 함. 미확인 시 모든 mutation이 403으로 막힘.
