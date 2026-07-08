# 요구사항분석서 — HS Code Manager Feature A·C AI(RAG) 연동 + Feature C 참조 저장

- **문서 ID**: REQ-20260709-HSCode-FeatureAC-AI연동-RAG참조
- **작성일**: 2026-07-09
- **대상 앱**: HS Code Manager (`/app-hscode`)
- **유형**: 기능 (AI 분류 엔진 + RAG 피드백 루프)
- **참조 스펙**: [`HSCODE-MGR-REQ-1.1.0`](hscode-manager-requirements.md) — FR-002/003/033/005/040/044
- **핵심**: A·C의 "AI"가 현재 **임베딩 유사도 검색뿐**이고, **설정에서 연결한 Claude가 실제로 참조(reference) 코퍼스를 근거로 추론하는 계층이 미구현**이다. C는 확정 결과를 reference로 **되먹임 저장**하는 기능도 없다. B는 이번 단계 목업 유지.

---

## 1. 요구사항 요약

| # | 요구사항 | 유형 | 대상 |
|---|----------|------|------|
| R1 | Feature A(질문응답): 설정 연결 AI(Claude)가 RAG-reference(엑셀 적재 코퍼스)를 근거로 후보 HS를 추론·순위화한다 | 필수 | A |
| R2 | Feature C(속성/엑셀): 동일 AI+RAG 엔진으로 행별 속성을 분류한다 | 필수 | C |
| R3 | Feature C: 확정한 분류 결과를 reference(hsm_hs_references)에 **저장**하여 이후 RAG가 참조한다(자기개선 루프) | 필수 | C |
| R4 | AI 키·모델은 어드민(설정)에 저장된 값을 런타임 사용하며, 미설정 시 순수 검색으로 **graceful fallback** | 필수 | A·C |
| R5 | Feature B(바코드): 이번 단계는 **목업만** 유지(L2 GS1/L3/L4 AI 미구현) | 범위한정 | B |

> **핵심 격차**: "설정 연결 AI가 reference를 참조"의 실체인 **RAG→LLM 추론 계층이 없다.** 현재 A·C는 pgvector 유사도 상위 후보를 그대로 반환할 뿐, Claude가 후보를 근거로 판단·질문·인용하지 않는다.

---

## 2. AS-IS 현황 분석

### 2.1 Feature A — 질문응답 (search-qa)

| 항목 | 파일 | 현재 |
|------|------|------|
| Q&A 서비스 | `backend/src/domain/search-qa/service/qa.service.ts` | `retrieval.retrieve()`(RAG) + `clarify.decide()`(규칙기반) 후 후보 그대로 반환. **Claude 호출 없음** |
| RAG 검색 | `backend/src/domain/search-core/service/semantic-retrieval.service.ts` | pgvector 코사인(`vectorSearch`) + 키워드 ILIKE 폴백(`keywordSearch`), 모두 `ent_id` 스코핑 ✅. **단, 임베딩 공급자가 스텁이라 벡터 경로 미동작 → 실제로는 키워드 ILIKE만 실행** |
| 임베딩 | `search-core/service/embedding.service.ts:37-41` | `embed()`가 `TODO(Phase 2)` — **무조건 `null` 반환**. `EMBEDDING_PROVIDER` 기본 공백 → `isEnabled=false`. `hsr_embedding` 항상 NULL → `vectorSearch` 결과 0 |
| 명확화 | `search-core/service/clarifying-question.service.ts` | 규칙기반 판단(AI 아님) |
| 확정 | `qa.service.confirm` | `hsm_query_logs` + audit 저장(FR-005). reference 되먹임 아님 |

→ **RAG 검색은 있으나 AI 추론(FR-002 "AI 의미검색"의 LLM 부분)·순차 명확화(FR-003)·근거 인용(FR-006)의 AI화 미구현.**

### 2.2 Feature C — 속성/엑셀 (attribute, excel)

| 항목 | 파일 | 현재 |
|------|------|------|
| 속성 분류 | `backend/src/domain/attribute/service/attribute.service.ts` | `SemanticRetrievalService.retrieve()` 재사용(RAG). **Claude 없음** |
| 엑셀 일괄 | `backend/src/domain/excel/**` | 검증(`excel-validator`)·템플릿·export·BullMQ 배치(`batch-classifier.processor`). 분류도 검색 기반 |
| **reference 저장** | — | **없음.** `hsm_hs_references` 쓰기는 import 경로(`reference/service/dedupe-embed.service.ts:56,70`)뿐. 확정 결과 되먹임 API·서비스 부재 |

→ **C는 A 엔진을 재사용(RAG)하나 AI 미연동, 확정→reference 저장(R3) 전무.**

### 2.3 Feature B — 바코드 (gtin)

| 항목 | 파일 | 현재 |
|------|------|------|
| 파이프라인 | `backend/src/domain/gtin/service/gtin-pipeline.service.ts` | 정규화+체크디지트+L1 직접매핑(`hsm_gtin_hs_maps`)+국가확장. **L2(GS1)/L3/L4(AI)='unused' 스텁** |
| 프론트 | `frontend/src/pages/BarcodeLookupPage.tsx` | 입력 UI 존재 |

→ 스펙(§4 MVP)과 일치. **이번 단계 목업 유지 대상.**

### 2.4 AI(Claude) 연동 현황 — 핵심 공백

| 항목 | 파일 | 현재 |
|------|------|------|
| Anthropic SDK 사용처 | `backend/src/domain/admin-settings/service/ai-connection.service.ts` | **연결 테스트(ping, max_tokens:1)뿐.** 실제 분류/답변 서비스 **없음** |
| 런타임 키/모델 | `admin-settings/service/app-config.service.ts:getSecret('AI','api_key'/'model_version')` | 설정 저장·조회 존재. 소비처는 ai-connection뿐 |
| 환경 기본값 | `backend/.env` | `CLAUDE_MODEL_VERSION=claude-sonnet-4-6`(구버전), `AI_DAILY_BUDGET_USD=50` |

**증거 체인**: 전 백엔드에서 `messages.create` 호출은 ai-connection 1곳 → **RAG 후보를 Claude에 넣어 추론하는 코드가 존재하지 않음** → A·C의 "AI"는 임베딩 유사도에 국한.

### 2.5 문제점 요약

| # | 문제 |
|---|------|
| P1 | A·C가 설정 Claude로 reference를 **추론**하지 않음(RAG-검색만) → NFR-003 top-3 정확도·FR-003 명확화·FR-006 인용 목표 미달 |
| P2 | C 확정 결과가 reference에 **저장되지 않음** → 지식 축적/자기개선 루프(FR-005 "feeds back") 부재 |
| P3 | 설정 AI 키/모델이 분류에 **미사용**(연결 테스트만) |
| P4 | `.env` 기본 모델이 구버전(`claude-sonnet-4-6`) |
| P5 | **임베딩 공급자 스텁 → 시맨틱(벡터) RAG 미동작.** 현재 "RAG"는 키워드 ILIKE 매칭에 불과. 교차언어(KR/EN→VI)·의미 매칭 한계 → "AI가 reference를 참조"의 검색 품질 근간이 부실 |

---

## 3. TO-BE 요구사항

### 3.1 AS-IS → TO-BE

| 영역 | AS-IS | TO-BE |
|------|-------|-------|
| A 추론 | RAG 후보 그대로 반환 | RAG 후보 + 쿼리 → **설정 Claude**가 근거 기반 순위·신뢰도·인용·명확화 질문 생성 |
| C 분류 | 검색만 | 동일 AI+RAG 엔진(A 재사용) |
| C 저장 | 없음 | 확정 결과 → `hsm_hs_references` 저장 + 임베딩(RAG 코퍼스 편입) |
| AI 키 사용 | 연결 테스트만 | 분류 런타임에 설정 키/모델 사용 + 일일예산 가드 |
| 미설정 시 | — | 순수 검색으로 graceful fallback |
| B | 목업 | **목업 유지(변경 없음)** |

### 3.2 신규 컴포넌트

1. **AI 분류(추론) 서비스** — RAG 후보 + 입력(쿼리/속성)을 Claude에 전달, **구조화 출력**(`output_config.format` json_schema)으로 `{ candidates:[{hsCode,hs6,confidence,rationale,citations[]}], needQuestion, attributeKey }` 반환.
   - 키/모델: `app-config.getSecret(entId,'AI',...)` → 미설정 시 env → 없으면 fallback.
   - 모델 기본값 **`claude-opus-4-8`**(설정으로 오버라이드 가능). `.env` 기본값도 정렬.
   - 프롬프트 캐싱(시스템+후보 블록), 일일예산(`AI_DAILY_BUDGET_USD`) 가드.
2. **A/C 배선** — `qa.service.search`·`attribute.service.classify`·엑셀 배치가 AI 서비스 경유(있으면), 없으면 기존 검색 순위.
3. **C 참조 저장** — 확정 결과 → `HsReference` 생성 + 임베딩(기존 `DedupeEmbedService`/`EmbeddingService` 재사용), `ent_id` 스코핑 + audit.
4. **임베딩 공급자 구현(시맨틱 RAG 활성화)** — `EmbeddingService.embed()`의 `TODO` 해소(공급자 연동) + 기존 `hsm_hs_references` 백필. **미구현 시 RAG는 키워드 매칭에 머문다** → 이 건은 A·C 품질의 전제. (공급자 선택은 PLAN Phase 0 결정.)

### 3.3 데이터/스키마
- 스키마 변경 **불필요**(hsm_hs_references·hsm_query_logs 기존 사용). 저장은 기존 엔티티 재사용.

---

## 4. 갭 분석

| 영역 | 현재 | 변경 | 영향도 |
|------|------|------|--------|
| Backend(AI) | 분류 AI 없음 | AI 분류 서비스 신규 + A/C 배선 | 높음 |
| Backend(C 저장) | 되먹임 없음 | 참조 저장 서비스/엔드포인트 신규 | 중 |
| Backend(설정) | 키 미사용 | 런타임 소비 + 예산 가드 | 중 |
| Frontend | A/C 결과 표시 | 신뢰도·근거·명확화·"reference 저장" UI(C) | 중 |
| i18n | — | 문구 추가(ko/en/vi) | 낮음 |
| DB | — | **변경 없음** | 없음 |
| Feature B | 목업 | **변경 없음** | 없음 |

### 4.1 변경 파일(예상)
- 신규 BE: `search-core/service/ai-classification.service.ts`(또는 `ai/` 도메인), C 저장 서비스/컨트롤러(`reference` 또는 `result` 도메인).
- 수정 BE: `search-qa/service/qa.service.ts`, `attribute/service/attribute.service.ts`, `excel/processor/batch-classifier.processor.ts`, `backend/.env(.example)`.
- 수정 FE: `QaSearchPage.tsx`, `AttributeExcelPage.tsx`, `services/*`, `i18n/locales/*`.

---

## 5. 사용자 플로우

### 5.1 Feature A (TO-BE)
```
[사용자] 자연어 입력
   → RAG 검색(pgvector, ent_id 스코핑) → 후보 N
   → 설정 Claude에 (쿼리 + 후보) 전달, 구조화 출력
   → 순위 HS + 신뢰도 + 근거 인용 (+모호 시 명확화 질문)
   → 확정 → query_log + audit
[AI 미설정] → 검색 순위 그대로(현행) — 무중단
```

### 5.2 Feature C (TO-BE)
```
[사용자] 속성 폼 / 엑셀 업로드(검증)
   → (행별) RAG + 설정 Claude 분류 → HS + 신뢰도
   → 결과 검토/확정
   → [reference 저장] 확정행 → hsm_hs_references 저장 + 임베딩 → 이후 RAG 반영
```

### 5.3 Feature B
```
[이번 단계] 목업 화면만 — L1/국가확장 동작, L2/L3/L4 미구현(변경 없음)
```

---

## 6. 기술 제약사항

- **AI 모델/SDK**: `@anthropic-ai/sdk`(기존 의존성). 기본 모델 `claude-opus-4-8`, 설정 `model_version`로 오버라이드. 분류 정확도 우선 시 상위 모델·`effort` 상향, 대량 배치 비용 시 설정에서 하향 — **모델 선택은 운영/설정 결정**.
- **구조화 출력**: `output_config.format`(json_schema)로 파싱 안정성 확보(문자열 파싱 금지).
- **비용/성능**: NFR-001(A/C < 2s P95) — 엑셀 대량은 BullMQ 비동기 유지, 프롬프트 캐싱·일일예산(`AI_DAILY_BUDGET_USD`) 가드.
- **멀티테넌시**: reference 저장·조회 모두 `ent_id` 스코핑([[feedback_hscode_commit_scope]] 무관, 격리는 REQ-전역참조매핑 참고).
- **언어**: 코퍼스 품명은 베트남어 위주 — 교차언어(KR/EN→VI) 매칭을 Claude 프롬프트에 명시.
- **Graceful degradation**: 키 미설정/AI 오류 시 순수 검색으로 폴백(무중단).
- **범위**: Feature B 외부 레이어(GS1/AI 분류)는 본 건 범위 외(목업 유지).
