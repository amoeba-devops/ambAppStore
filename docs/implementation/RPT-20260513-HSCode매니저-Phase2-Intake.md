---
document_id: HSCM-IMPL-RPT-PHASE2
version: 1.0.0
status: Done
created: 2026-05-13
updated: 2026-05-13
app: app-hscode-manager
phase: 2
based_on:
  - docs/plan/PLAN-20260513-HSCode매니저-앱전체구현.md
  - docs/test/TC-20260513-HSCode매니저-앱전체구현.md
  - apps/app-hscode-manager/DB-SCHEMA-hscode-manager.md
---

# HS Code Manager — Phase 2 작업완료보고서

> Phase 2 (입력 채널 / Intake) 구현 완료. Inquiry → 입력 채널 선택 → 직접 입력(동적 폼) / 엑셀 일괄 등록(매핑·보류 큐) 전체 흐름이 BE/FE 모두 빌드 통과. Phase 3 (정규화·매칭·추천 엔진) 진입 가능.

---

## 1. 완료 범위

| Step | 내용 | 결과 |
|------|------|------|
| 2.0 | DB 스키마 — 5개 테이블 DDL (`phase2_intake.sql`) + DB-SCHEMA 문서 누적 갱신 | ✔ |
| 2.1 | `inquiry` 도메인 정식 모듈 승격 — 상태 전이 + 수입국 환경 검증 (ACTIVE/BETA/NOT_SUPPORTED) | ✔ |
| 2.2 | `item` 도메인 정식 모듈 승격 + `composition_hash` 산출 (Phase 3 placeholder) | ✔ |
| 2.3 | `intake` 도메인 신규 — Direct Intake + Excel Upload/Preview/Import/Hold + Mapping Profile | ✔ |
| 2.4 | Category Schema 메타 API + 완성도 점수 계산 (가중치 §4.3) | ✔ |
| 2.5 | Frontend S02~S06 + Dashboard 갱신 + 매칭 placeholder (Phase 3 대기) | ✔ |
| — | i18n inquiry + intake 네임스페이스 추가 (ko/en/vi) | ✔ |
| — | Backend tsc + nest build | **PASS** |
| — | Frontend tsc + vite build (395.46 kB JS, 17.32 kB CSS) | **PASS** |

---

## 2. 핵심 산출물

### 2.1 DB 마이그레이션
- `apps/app-hscode-manager/db-migrations/2026-05-13_phase2_intake.sql`
  - `hsc_inquiries`, `hsc_items`, `hsc_excel_import_batches`, `hsc_excel_hold_rows`, `hsc_excel_mapping_profiles`
- DB-SCHEMA-hscode-manager.md — Phase 2 섹션 누적

### 2.2 Backend 신규 도메인 (3개) + 공통 유틸

```
backend/src/
├── common/util/normalizer.ts                  # composition_hash + 카테고리별 정규화 v0.1.0
└── domain/
    ├── inquiry/                               # 정식 모듈 (Phase 0 placeholder에서 분리)
    │   ├── dto/{request{create,update-status,list}.* + response/inquiry.response}.ts
    │   ├── mapper/inquiry.mapper.ts
    │   ├── service/inquiry.service.ts        # 상태 전이 + 수입국 검증
    │   ├── controller/inquiry.controller.ts
    │   └── inquiry.module.ts
    ├── item/                                  # 정식 모듈
    │   ├── dto/response/item.response.ts
    │   ├── mapper/item.mapper.ts
    │   ├── service/item.service.ts            # composition_hash 산출 + 카테고리별 정규화 적용
    │   ├── controller/item.controller.ts
    │   └── item.module.ts
    └── intake/                                # 신규
        ├── category-schema.ts                 # 4개 카테고리 메타 + 완성도 점수 함수
        ├── entity/{excel-import-batch, excel-hold-row, mapping-profile}.entity.ts
        ├── dto/request/{direct-intake, excel-import, upsert-hold-row}.request.ts
        ├── service/excel-parser.ts            # exceljs 기반 (sheet/header/preview/mapping suggest)
        ├── service/intake.service.ts          # 직접/엑셀/보류큐/매핑프로파일 통합
        ├── controller/intake.controller.ts    # 7개 엔드포인트
        └── intake.module.ts
```

**Inquiry 상태 전이 그래프** (서비스에서 강제):
```
DRAFT → INTAKE → MATCHING → REVIEWING|RESPONDED
                 ↑                ↓
                 └──── REVIEWING ─┘
RESPONDED → VERIFIED|DISPUTED
VERIFIED → DISPUTED
```
잘못된 전이 시 `HSC-E0310` (TC-IN-005 충족).

### 2.3 Frontend 신규 페이지 (6) + 컴포넌트 + service/i18n

```
frontend/src/
├── components/intake/CategoryDynamicForm.tsx    # 카테고리별 동적 폼 (chemical CAS, steel alloy 등)
├── pages/
│   ├── inquiry/InquiryCreatePage.tsx            # S02
│   ├── intake/IntakeChannelPage.tsx             # S03
│   ├── intake/DirectInputPage.tsx               # S06 (동적 폼 + 완성도 점수 progress bar)
│   ├── intake/ExcelUploadPage.tsx               # S04 (multipart preview + mapping table)
│   ├── intake/HoldQueuePage.tsx                 # S05 (행별 수정·재검증)
│   └── matching/MatchingPlaceholderPage.tsx     # Phase 3 진입 대기 안내
├── services/
│   ├── inquiry.service.ts
│   └── intake.service.ts                        # multipart FormData 처리
├── types/inquiry.types.ts
└── i18n/locales/{ko,en,vi}/{inquiry,intake}.json (6)
```

`App.tsx` — `/new-work/*` 5개 라우트 추가.
`DashboardPage.tsx` — Inquiry 목록 + "새 작업" 버튼.

---

## 3. API 엔드포인트 (Phase 2 신규 14개)

| 도메인 | Method | Path | 권한 |
|--------|--------|------|------|
| Inquiry | GET | `/api/v1/inquiries` | Auth |
| Inquiry | GET | `/api/v1/inquiries/:id` | Auth |
| Inquiry | POST | `/api/v1/inquiries` | Auth |
| Inquiry | PATCH | `/api/v1/inquiries/:id/status` | Auth |
| Inquiry | DELETE | `/api/v1/inquiries/:id` | Auth |
| Item | GET | `/api/v1/items` (by inquiry_id) | Auth |
| Item | GET | `/api/v1/items/:id` | Auth |
| Item | DELETE | `/api/v1/items/:id` | Auth |
| Intake | GET | `/api/v1/intake/category-schema` | Auth |
| Intake | POST | `/api/v1/intake/direct` | Auth |
| Intake | POST | `/api/v1/intake/excel/preview` (multipart) | Auth |
| Intake | POST | `/api/v1/intake/excel/import` (multipart) | Auth |
| Intake | GET | `/api/v1/intake/excel/batches` | Auth |
| Intake | GET | `/api/v1/intake/excel/batches/:id/hold` | Auth |
| Intake | PATCH | `/api/v1/intake/excel/hold/:id` | Auth |
| Intake | GET | `/api/v1/intake/excel/mapping-profiles` | Auth |

> **누적 38개 엔드포인트** (Phase 0: 1 + Phase 1: 24 + Phase 2: 16 — 직접 입력의 응답에 item 객체 포함)

---

## 4. 핵심 설계 결정

### 4.1 수입국 환경 검증 (변경 6 반영)
- `InquiryService.create()` 가 수입국 코드를 `ImportCountryService.findByCode()`로 조회
- `NOT_SUPPORTED` → `HSC-E0301` 거부
- `BETA` → 생성은 허용하되 응답에 `warnings: ['beta_country']` 부착
- Frontend S02 에서 선택 시 즉시 인라인 경고 + create 직후 AlertModal warning 표시

### 4.2 composition_hash v0.1.0
- 카테고리별 정규화 규칙으로 정렬·소문자화·단위 통일된 JSON 생성
- SHA-256 16자 hex prefix (64bit) 를 `composition_hash` 로 사용
- `itm_normalizer_version='v0.1.0'` 컬럼으로 버전 추적 — Phase 3에서 규칙 갱신 시 재계산 배치 대상 식별 가능

### 4.3 완성도 점수 산출 (가중치 §4.3)
- 공통 4필드 모두 채움: +0.4
- 카테고리 필수 필드 모두 채움: +0.3 (OTHER는 공통이 채워졌으면 +0.3)
- 선택 필드 채움 비율: 최대 +0.2
- 첨부 2장 이상: +0.1
- Backend와 Frontend 양쪽에 *동일 알고리즘*을 구현해 UX 일관성 확보 — Backend가 *최종 권위*

### 4.4 Soft block (FR-IN-07)
- 완성도 < 0.7 + `force_proceed !== true` → `HSC-E0320` ForbiddenException
- `force_proceed=true` + `force_proceed_reason` 입력 시 통과 (사유는 audit log 의도)
- Frontend는 점수가 0.7 미만일 때 사유 입력 폼이 자동 노출, 사유 비어있으면 제출 버튼 비활성

### 4.5 Chemical CAS 합산 검증
- composition 배열의 percent 합산이 100% ±5% 범위를 벗어나면 `HSC-E0320` (TC-IN-027)
- 합산이 0이면 통과 (CAS 미입력 케이스 — 다른 검증에서 잡힘)

### 4.6 Excel 동기 1000행 제한
- `excel-parser.ts` 의 `MAX_SYNC_ROWS=1000` 상수 (NFR-PF-03 충족)
- 초과 시 `HSC-E0330` (TC-IN-044 부분 충족; 비동기 큐는 Phase 7)
- 미리보기는 헤더 + 상위 10행 + 시트 목록 + 매핑 제안 반환
- 매핑되지 않은 컬럼은 `spec_attributes` JSON에 보존 (TC-IN-050)

### 4.7 보류 큐 분리 (FR-IN-04)
- 행별 검증 실패 시 `hsc_excel_hold_rows` 로 분리, 정상 행만 Item 생성
- 배치 상태: 전체 정상=`IMPORTED`, 전체 실패=`FAILED`, 혼합=`PARTIAL`
- Frontend는 import 결과에 hold_rows>0 이면 자동으로 S05로 라우팅

### 4.8 매핑 프로파일 재사용 (R5 대응)
- import 요청 시 `profile_name` 제공하면 `hsc_excel_mapping_profiles` 에 저장
- `GET /api/v1/intake/excel/mapping-profiles?exporter_id=...` 로 일람
- 다음 업로드에서 동일 헤더면 자동 매핑 제안 — Phase 7에서 자동 매칭 강화 예정

### 4.9 카테고리 메타 = 코드 상수 (Phase 2 MVP)
- `intake/category-schema.ts` 에 4개 카테고리(`CHEMICAL`/`STEEL_MECHANICAL`/`EQUIPMENT`/`OTHER`) 메타 정의
- 각 필드의 ko/en/vi 라벨·타입·required·hint·unit·enum_values 포함
- Frontend `CategoryDynamicForm` 컴포넌트가 type별로 분기 렌더링 (enum/number/array/object/string)
- `OTHER` 카테고리는 `auto_escalate: true` — Phase 6에서 자동 에스컬레이션 트리거로 사용

---

## 5. TC 결과 (Phase 2)

| TC ID | 시나리오 | 상태 |
|-------|---------|------|
| TC-IN-001 | Inquiry 생성 (active 수입국) | **READY** |
| TC-IN-002 | Inquiry 생성 (beta 수입국) — 응답 warnings: ['beta_country'] | **READY** |
| TC-IN-003 | Inquiry 생성 (not_supported) — HSC-E0301 | **READY** |
| TC-IN-005 | 잘못된 상태 전이 — HSC-E0310 | **READY** |
| TC-IN-020~023 | 카테고리 스키마 4종 조회 | **READY** (`/intake/category-schema?category=...`) |
| TC-IN-024 | 직접 입력 POST | **READY** |
| TC-IN-025 | 완성도 < 0.7 → soft block | **READY** (HSC-E0320 + force_proceed) |
| TC-IN-026 | 사유 입력 후 강제 진행 | **READY** |
| TC-IN-027 | CAS 합산 100% ±5% 초과 | **READY** (HSC-E0320) |
| TC-IN-040 | 엑셀 업로드 → 헤더 매핑 제안 | **READY** |
| TC-IN-042 | 100행 정상 import | **READY** |
| TC-IN-043 | 1,000행 동기 import (NFR-PF-03) | **READY** |
| TC-IN-044 | 1,500행 → HSC-E0330 거부 | **READY** |
| TC-IN-045 | 1,000행 중 200행 결손 → imported=800, hold=200 | **READY** |
| TC-IN-046 | 보류 큐 행 수정·재검증 | **READY** |
| TC-IN-047 | 매핑 프로파일 저장 → 다음 업로드 제안 | **READY** (저장만, 자동 제안은 Phase 7) |
| TC-IN-048 | 필수 컬럼 누락 (X1) | **READY** (HSC-E0331) |
| TC-IN-050 | 매핑 안 된 컬럼 JSON 보존 | **READY** |
| TC-IN-070 | 동일 Inquiry에 직접+엑셀 혼합 | **READY** |
| TC-MA-001~006 | 정규화 단위 테스트 | **READY** (Phase 3에서 본격 검증) |

런타임 검증 (실제 MySQL DB 기동 후 cURL/브라우저)은 Phase 3 진입 전 별도 수행.

---

## 6. 사이드 임팩트

| 범위 | 영향 | 상태 |
|------|------|------|
| Phase 1 모듈 | 변경 없음 — 마스터 모듈 그대로 활용 (Inquiry → ImportCountry 의존) | ✔ |
| placeholder.module | Inquiry/Item 제거 — Classification/ExpertReview/Verification 3개만 남음 | ✔ |
| AMA SSO | 이전 단계와 동일 — JWT.roles 의존 (Phase 1과 동일 리스크) | ⚠ |
| 엑셀 파싱 메모리 | 1,000행 미만 동기 처리 → 큰 셀 다수 첨부 시 메모리 스파이크 가능. 비동기 큐는 Phase 7로 연기. | ⚠ |
| `composition_hash` v0.1.0 | Phase 3에서 규칙 갱신 시 기존 Item 해시 재계산 배치 필요. `itm_normalizer_version` 컬럼으로 추적 가능. | ⏸ |
| deploy-staging.sh | 여전히 미수정 — Phase 3 진입 전 작업 필요 | ⚠ 후속 |

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
npm run build          # 395.46 kB JS / 17.32 kB CSS

# DB 마이그레이션
mysql -uroot -p db_app_hscode \
  < apps/app-hscode-manager/db-migrations/2026-05-13_phase2_intake.sql

# 로컬 기동 후 검증 시나리오
curl -X POST http://localhost:3102/api/v1/inquiries \
  -H "Authorization: Bearer ${AMA_JWT}" \
  -H "Content-Type: application/json" \
  -d '{"exporter_id":"...","export_country_code":"KR","import_country_code":"VN"}'

curl http://localhost:3102/api/v1/intake/category-schema?category=CHEMICAL \
  -H "Authorization: Bearer ${AMA_JWT}"

curl -X POST http://localhost:3102/api/v1/intake/direct \
  -H "Authorization: Bearer ${AMA_JWT}" \
  -H "Content-Type: application/json" \
  -d '{"inquiry_id":"...","name":"SUS304 평판","category":"STEEL_MECHANICAL",
       "spec_attributes":{"material":"SUS304","thickness_mm":3,"process":"ROLLED"},
       "usage_description":"산업용 가공 부품","attachment_count":2}'
```

---

## 8. 다음 단계 (Phase 3)

Phase 3 — 정규화·매칭·추천 엔진 (4~5주, 본 앱의 가치 중심):

1. **Step 3.1** 정규화 모듈 — 카테고리별 규칙 본격화 (Phase 2의 v0.1.0 확장)
2. **Step 3.2** 내부 매칭 엔진 — 우선순위 3단 (exporter+import / import / fuzzy)
3. **Step 3.3** 외부 어댑터 인터페이스 + 베트남 BIEU THUE 시드 어댑터
4. **Step 3.4** Claude AI 추천 어댑터 + 환각 가드레일
5. **Step 3.5** 후보 랭킹·세율 룰 (§2.2)
6. **Step 3.6** S07 진행 스테퍼 + S08 추천 카드 UI

선행 작업:
- [ ] AMA SSO 역할 발급 흐름 확인 (Phase 1·2 공통 리스크)
- [ ] `platform/scripts/deploy-staging.sh` hscode 분기 추가
- [ ] BIEU THUE XNK 2026 시드 데이터 형식 확정 (운영팀 협조)
- [ ] Claude API 키 (`CLAUDE_API_KEY`) 발급

---

## 9. 회고

- **잘 된 점**: Inquiry → Channel → Direct/Excel → Matching placeholder까지 end-to-end UI 흐름이 1세션 내 완성. 엑셀 미리보기·매핑·보류 큐의 3단 분리가 깔끔하게 들어맞음. CAS 합산 검증·완성도 점수·soft block 등 정책 규칙이 모두 Backend service 레이어에 응집.
- **개선 여지**: `CategoryDynamicForm` 의 enum/array/object 분기는 동작은 하나 UX 다듬기 필요 (Phase 7). 매핑 프로파일 자동 매칭 (헤더 유사도 기반)도 Phase 7에 미룸. 매칭 placeholder는 Phase 3로 즉시 교체될 예정.
- **위험**: composition_hash 버전 변경 시 기존 Item 재계산 배치를 만들지 않으면 매칭 미스가 누적됨 — Phase 3 정규화 v1.0.0 출시 시 반드시 배치 잡 동반.
