# 작업계획서 — HS Code Manager Feature A·C AI(RAG) 연동 + Feature C 참조 저장

- **문서 ID**: PLAN-20260709-HSCode-FeatureAC-AI연동-RAG참조
- **작성일**: 2026-07-09
- **선행 문서**: [`REQ-20260709-HSCode-FeatureAC-AI연동-RAG참조`](../analysis/REQ-20260709-HSCode-FeatureAC-AI연동-RAG참조.md)
- **브랜치**: `feature/hscode-manager`
- **핵심**: A·C에 **RAG→Claude 추론 계층**을 신설하고, C에 **확정→reference 저장(자기개선 루프)**를 추가한다. **임베딩 공급자가 스텁**이라 시맨틱 RAG가 미동작하므로 이를 Phase 0에서 먼저 결정·활성화한다. **Feature B는 목업 유지(무변경).**

---

## 1. 시스템 개발 현황 분석

### 1.1 디렉토리/스택
- BE: NestJS + TypeORM + **PostgreSQL15(pgvector)** + Redis(BullMQ). AI SDK `@anthropic-ai/sdk`(기존 의존성, `ai-connection.service`에서만 사용).
- FE: React18 + Vite + React Query. 3개 화면(QaSearch/AttributeExcel/BarcodeLookup) 모두 **실제 배선**(목업 아님).

### 1.2 기존 코드 상황(검증)
| 영역 | 현재 |
|------|------|
| A(`qa.service`) | RAG 검색 + 규칙 clarify. **Claude 없음** |
| C(`attribute.service`,`excel/*`) | A의 `SemanticRetrievalService` 재사용. **Claude 없음, 저장 없음** |
| 검색 코어 | `semantic-retrieval`: vector+keyword. **임베딩 스텁(`embedding.service.ts:37-41` return null) → 실제 키워드 ILIKE만** |
| AI | `ai-connection.service`(ping만). `app-config.getSecret('AI',...)`로 키/모델 조회 존재 |
| reference 쓰기 | import 경로(`dedupe-embed.service`)만. 되먹임 저장 부재 |
| B(`gtin-pipeline`) | L1+국가확장 동작, L2/L3/L4 `unused` 스텁 |

### 1.3 제약
- 스테이징/prod `synchronize` 비활성 → 스키마 변경 시 수동 SQL(본 건은 **스키마 변경 없음**).
- `VITE_*` 인라인 → FE 변경 시 이미지 재빌드.
- 로컬 빌드는 `npm install` 필요(복구 시 node_modules 제외). 배포 `deploy-staging.sh` 경유.
- 커밋은 `git add apps/app-hscode-manager` 범위 한정.
- AI 기본 모델 `claude-opus-4-8`(설정 `model_version` 오버라이드). 구조화 출력은 `output_config.format`(json_schema) + `messages.parse()`.

---

## 2. 단계별 구현 계획

### Phase 0 — 임베딩 공급자 결정 & 시맨틱 RAG 활성화 (전제)

- **Step 0-1**: 임베딩 공급자 확정 — 후보: (a) Claude 미제공 → 별도 임베딩(예: multilingual-e5-large 셀프호스트 / OpenAI text-embedding-3 / Voyage) (b) 키워드 유지(시맨틱 보류). `EMBEDDING_PROVIDER`/`EMBEDDING_DIMENSIONS`(=pgvector 컬럼 차원) 정합.
  - └─ 사이드 임팩트: 차원 변경 시 `hsr_embedding vector(N)` 스키마 영향 → 초기 확정 필요. **결정 게이트.**
- **Step 0-2**: `EmbeddingService.embed()` 실제 구현(공급자 호출) + `isEnabled` 조건 충족. 실패 시 `null`(키워드 폴백 유지).
  - └─ 사이드 임팩트: 없음(비활성 시 현행과 동일).
- **Step 0-3**: 기존 `hsm_hs_references` 임베딩 **백필**(배치). `hsr_embedding` 채움 → `vectorSearch` 활성.
  - └─ 사이드 임팩트: 대량 임베딩 비용/시간 → BullMQ 배치·재실행 안전(멱등: PK 기준 UPDATE).

> 공급자 미확정 시 A·C는 **키워드 RAG + Claude 추론**으로도 동작(품질 절충). Phase 0 없이 Phase 1 진행 가능하나, 시맨틱 품질은 Phase 0 완료 후 확보.

### Phase 1 — AI 분류(추론) 서비스 (A·C 공용)

- **Step 1-1**: `AiClassificationService` 신규(`search-core/service/ai-classification.service.ts`). 입력=(쿼리/속성 + RAG 후보), 출력=구조화 `{candidates:[{hsCode,hs6,confidence,rationale,citations[]}],needQuestion,attributeKey}`.
  - 키/모델: `appConfig.getSecret(entId,'AI','api_key'|'model_version')` → env → 기본 `claude-opus-4-8`. `ai-connection.service`의 키 우선순위 로직 재사용/공유.
  - 구조화 출력 `output_config.format`(json_schema), 프롬프트 캐싱(시스템+후보 블록), 교차언어(KR/EN→VI) 지시.
  - **일일예산 가드**(`AI_DAILY_BUDGET_USD`): 초과 시 폴백.
  - └─ 사이드 임팩트: 신규 외부호출·비용 발생. 미설정/오류 시 폴백 경로 필수.
- **Step 1-2**: 키/모델 해석 공용화 — `ai-connection.service`의 우선순위 로직을 `AppConfigService` 헬퍼 또는 공용 유틸로 추출(중복 제거).
  - └─ 사이드 임팩트: 연결 테스트 경로 회귀 확인.

### Phase 2 — Feature A 배선

- **Step 2-1**: `qa.service.search`가 RAG 후보를 `AiClassificationService`로 통과(있으면). 결과의 신뢰도/근거/명확화 반영. 미설정 시 기존 검색 순위.
  - └─ 사이드 임팩트: A 응답 형태 확장(신뢰도·rationale·citations). FE 계약 변경 → Step 4 동반.
- **Step 2-2**: `qa.confirm` 신뢰도는 AI 산출값 사용(현재 FE 전달 score → AI confidence). audit `source`를 AI/REFERENCE 구분.
  - └─ 사이드 임팩트: query_log confidence 의미 변경(문서화).

### Phase 3 — Feature C 배선 + reference 저장

- **Step 3-1**: `attribute.service.classify` + 엑셀 배치(`batch-classifier.processor`)가 `AiClassificationService` 경유(A와 동일 엔진).
  - └─ 사이드 임팩트: 엑셀 대량은 행당 AI 호출 비용↑ → BullMQ 유지 + 배치 프롬프트/캐싱·예산 가드.
- **Step 3-2**: **참조 저장 서비스/엔드포인트 신규** — 확정 결과 → `HsReference` 생성 + 임베딩. `POST /reference/entries`(또는 `/result/confirm-to-reference`). 기존 `DedupeEmbedService.persist`/`EmbeddingService` 재사용, `ent_id` 스코핑 + audit + dedupe(FR-044).
  - └─ 사이드 임팩트: RAG 코퍼스 증가 → 이후 검색 결과 변화(의도된 자기개선). 저품질 확정 유입 방지 위해 **관리자/확정 게이트** 검토.

### Phase 4 — Frontend & i18n

- **Step 4-1**: `QaSearchPage`·`AttributeExcelPage`에 AI 신뢰도·근거(citations)·명확화 표시, C에 **"reference에 저장"** 액션.
  - └─ 사이드 임팩트: 결과 컴포넌트 변경 → 정상/폴백(비AI) 렌더 동시 지원.
- **Step 4-2**: i18n(ko/en/vi) 문구 추가, 필요 시 `i18n.ts` 네임스페이스 등록.
  - └─ 사이드 임팩트: 3언어 누락 시 키 노출.

### Phase 5 — Feature B (변경 없음)
- 목업/현행 유지. L2(GS1)/L3/L4(AI)는 본 건 범위 외.
  - └─ 사이드 임팩트: 없음.

### Phase 6 — 검증 & 배포
- **Step 6-1**: 설정에 실제 Claude 키 입력 → A/C가 근거 기반 추론 확인, 미설정 시 폴백 확인, C 저장→재검색 반영 확인. `.env`/`.env.example` 기본 모델 `claude-opus-4-8` 정렬.
- **Step 6-2**: `deploy-staging.sh` 스테이징 배포(FE 재빌드) → 검증 → `main`/`production` 절차.
  - └─ 사이드 임팩트: 프론트 재빌드, 스테이징 우선.

---

## 3. 변경 파일 목록

| 구분 | 파일 | 변경유형 | Phase |
|------|------|---------|-------|
| Backend | `search-core/service/embedding.service.ts` | 수정(공급자 구현) | 0 |
| Backend | 임베딩 백필 스크립트/배치 | 신규 | 0 |
| Backend | `search-core/service/ai-classification.service.ts` | 신규 | 1 |
| Backend | `admin-settings/service/app-config.service.ts`(키 해석 헬퍼) | 수정 | 1 |
| Backend | `search-qa/service/qa.service.ts` | 수정 | 2 |
| Backend | `attribute/service/attribute.service.ts`, `excel/processor/batch-classifier.processor.ts` | 수정 | 3 |
| Backend | 참조 저장 서비스+컨트롤러(`reference` 또는 `result` 도메인) | 신규 | 3 |
| Backend | `.env`, `.env.example` (기본 모델·EMBEDDING_*) | 수정 | 0·6 |
| Frontend | `pages/QaSearchPage.tsx`, `pages/AttributeExcelPage.tsx`, `services/*` | 수정 | 4 |
| Frontend | `i18n/locales/{ko,en,vi}/*`, `i18n.ts` | 수정 | 4 |
| DB | — (스키마 변경 없음; 임베딩 차원 변경 시에만 검토) | — | — |

---

## 4. 사이드 임팩트 분석

| 범위 | 위험도 | 설명 |
|------|--------|------|
| AI 외부호출·비용 | 높음 | A·C 전면 AI화 → 호출량·비용↑. 예산 가드·프롬프트 캐싱·엑셀 배치 필수. 초과/오류 시 폴백 |
| 임베딩 공급자/차원 | 높음 | 차원=pgvector 컬럼과 정합 필수. 변경 시 스키마·백필 재실행 |
| A/C 응답 계약 변경 | 중 | 신뢰도·근거·명확화 추가 → FE 동반 변경, 폴백 렌더 병행 |
| reference 저장 품질 | 중 | 저품질 확정 유입 시 RAG 오염 → 확정/관리자 게이트·dedupe |
| 멀티테넌시 | 중 | 저장·조회 모두 `ent_id` 스코핑 유지(누락 시 크로스테넌트) |
| 응답시간(NFR-001) | 중 | AI 추론 지연 → 단건 <2s 목표, 대량은 비동기 |
| Feature B | 없음 | 무변경 |

---

## 5. DB 마이그레이션
- **원칙적으로 불필요** — `hsm_hs_references`(임베딩 컬럼 포함)·`hsm_query_logs` 기존 사용, 저장은 기존 엔티티 재사용.
- **예외**: Phase 0에서 임베딩 **차원(`EMBEDDING_DIMENSIONS`)**을 현재 pgvector 컬럼과 다르게 확정하면 `hsr_embedding vector(N)` 재정의 수동 SQL + 백필 필요. → Phase 0 결정 시 차원 고정 권장(스키마 변경 회피).

---

## 부록 — 실행 순서 요약
```
Phase 0 (임베딩 공급자 결정→활성화→백필)   ← 시맨틱 RAG 전제(생략 시 키워드 RAG로 진행 가능)
   ↓
Phase 1 (AiClassificationService 신규, 설정 키 소비)
   ↓
Phase 2 (A 배선)  +  Phase 3 (C 배선 + reference 저장)
   ↓
Phase 4 (FE/i18n)   Phase 5 (B 목업 유지)
   ↓
Phase 6 (검증→스테이징 배포)
```
> 다음 단계: 본 계획 승인 → **테스트케이스(`docs/test/TC-...`)** 작성 → 구현.
