---
document_id: HSCODE-MGR-TC-AIRAG-1.0.0
version: 1.0.0
status: Draft
created: 2026-07-09
author: Gray Kim
based_on:
  - docs/analysis/REQ-20260709-HSCode-FeatureAC-AI연동-RAG참조.md (R1~R5)
  - docs/plan/PLAN-20260709-HSCode-FeatureAC-AI연동-RAG참조.md (Phase 0~6)
  - docs/analysis/hscode-manager-requirements.md (FR-002/003/005/006/033/040/044, NFR-001/003/005)
scope: Feature A·C의 RAG→Claude 추론 계층 신설 + Feature C 확정→reference 저장. Feature B는 목업 유지(무변경, 회귀만 확인).
change_log:
  - version: 1.0.0
    date: 2026-07-09
    author: Gray Kim
    description: A·C AI(RAG)연동 + C 참조저장 + 임베딩 활성화 + 폴백/예산/멀티테넌시 인수조건
---

# HS Code Manager — 테스트케이스 (Feature A·C AI(RAG) 연동 + C 참조 저장)

## 0. 테스트 개요

| 항목 | 내용 |
|------|------|
| 대상 | Feature A(Q&A)·C(속성/엑셀) AI 추론화 + C reference 저장, 임베딩 시맨틱 RAG |
| 범위 | Phase 0(임베딩)·1(AI 서비스)·2(A)·3(C+저장)·4(FE/i18n). Feature B=회귀만 |
| 환경 | 개발(localhost:5202/3102, PostgreSQL15+pgvector, Redis) / 스테이징(stg-apps.amoeba.site) |
| 우선순위 | P0(필수) / P1(중요) / P2(선택) |
| 판정 | Pass / Fail / Blocked / N/A |
| 전제 | AMA JWT SSO 로그인 완료(유효 ama_token), ent_id(UUID) 컨텍스트, 참조 코퍼스 시드 적재 |

### 0.1 추적성 매트릭스
| 그룹 | TC | 요구/FR | Phase |
|------|-----|---------|-------|
| 임베딩·시맨틱 RAG | TC-E01~E05 | R1 전제, FR-002 | 0 |
| AI 분류 서비스 | TC-AI01~AI07 | R1·R4, FR-002/003/006 | 1 |
| Feature A 배선 | TC-A01~A05 | R1, FR-002~006 | 2 |
| Feature C 배선 | TC-C01~C05 | R2, FR-030/033 | 3 |
| Feature C 참조 저장 | TC-CS01~CS05 | R3, FR-005/040/044 | 3 |
| 폴백/graceful | TC-F01~F04 | R4 | 1~3 |
| 예산/비기능 | TC-N01~N05 | NFR-001/003, 예산 | 1·3 |
| 멀티테넌시/감사 | TC-X01~X04 | 격리·audit | 2·3 |
| Feature B 회귀 | TC-B01~B02 | R5 | 5 |

---

## 1. Phase 0 — 임베딩 & 시맨틱 RAG (TC-E)

### TC-E01 — 임베딩 공급자 활성화 (R1 전제) · P0
- **전제**: `EMBEDDING_PROVIDER`·`EMBEDDING_API_KEY` 설정, 차원=`EMBEDDING_DIMENSIONS`(pgvector 컬럼과 일치)
- **절차**: 참조 1건 import → `EmbeddingService.embed()` 호출
- **기대결과**: `isEnabled=true`, `embed()`가 **non-null 벡터(길이=차원)** 반환, `hsm_hs_references.hsr_embedding` NOT NULL 저장

### TC-E02 — 기존 코퍼스 백필 (R1 전제) · P0
- **전제**: 임베딩 미적용 기존 행 존재
- **절차**: 백필 배치 실행
- **기대결과**: 대상 행 `hsr_embedding` 채워짐, 재실행 시 멱등(중복 처리·오류 없음), 진행/완료 로그

### TC-E03 — 벡터 검색 경로 활성 (FR-002) · P0
- **전제**: 임베딩 적재 완료
- **입력**: 의미 유사하나 표현 다른 쿼리(예: "고무 밀봉재" vs 코퍼스 "oil seal, NBR")
- **기대결과**: `vectorSearch` 경로 실행(키워드 미매칭에도 후보 반환), `ent_id` 스코핑 유지

### TC-E04 — 임베딩 비활성 시 키워드 폴백 (R4) · P0
- **전제**: `EMBEDDING_PROVIDER` 미설정
- **기대결과**: `embed()` null → `keywordSearch` 폴백 동작, **에러 없이** 후보 반환(현행 동작 유지)

### TC-E05 — 차원 불일치 방어 · P1
- **전제**: `EMBEDDING_DIMENSIONS` ≠ pgvector 컬럼 차원
- **기대결과**: 삽입/검색 시 명확한 오류·로그(무음 실패 아님), 배포 전 감지 가능

---

## 2. Phase 1 — AI 분류(추론) 서비스 (TC-AI)

### TC-AI01 — 설정 키/모델로 Claude 호출 (R1·R4) · P0
- **전제**: 어드민(설정) AI `api_key`(유효)·`model_version` 저장
- **절차**: `AiClassificationService`에 (쿼리 + RAG 후보) 전달
- **기대결과**: 설정 키/모델로 `messages` 호출(우선순위 요청>저장>env>기본 `claude-opus-4-8`), 구조화 출력 반환

### TC-AI02 — 구조화 출력 스키마 준수 (FR-002/006) · P0
- **기대결과**: 응답이 `{candidates:[{hsCode,hs6,confidence,rationale,citations[]}],needQuestion,attributeKey}` 스키마 검증 통과(`output_config.format`), **문자열 파싱 없이** 객체 수신

### TC-AI03 — 근거 인용 포함 (FR-006) · P1
- **기대결과**: 각 후보 `citations`가 실제 참조 행(sourceRefId/company) 근거를 담음(환각 아님, RAG 후보 범위 내)

### TC-AI04 — 명확화 질문 생성 (FR-003) · P1
- **입력**: 모호 쿼리(속성 부족)
- **기대결과**: `needQuestion=true` + `attributeKey`(material/usage/processing 등) — AI 판단 기반

### TC-AI05 — 교차언어 매칭 (NFR-005) · P1
- **입력**: KR/EN 쿼리 vs VI 코퍼스(`Tên hàng`)
- **기대결과**: 언어 불일치에도 관련 HS 후보 추론

### TC-AI06 — 키 미설정 시 폴백 (R4) · P0
- **전제**: AI api_key 미설정
- **기대결과**: AI 미호출 → **순수 RAG 검색 순위** 반환(무중단, 500 아님)

### TC-AI07 — AI 오류 시 폴백 (R4) · P0
- **전제**: 무효 키/네트워크 오류/429
- **기대결과**: 예외 catch → 검색 폴백 + 진단 로그, 사용자 화면 무중단

---

## 3. Phase 2 — Feature A 배선 (TC-A)

### TC-A01 — Q&A가 AI 추론 경유 (R1) · P0
- **절차**: `POST /api/v1/qa/search` 자연어 입력
- **기대결과**: RAG 후보가 AI 추론을 통과한 결과(신뢰도·rationale·citations 포함) 응답

### TC-A02 — 순차 명확화 라운드 (FR-003) · P1
- **절차**: needQuestion→속성 응답→재검색 반복
- **기대결과**: 라운드마다 후보 좁혀짐, `MAX_CLARIFY_ROUNDS` 초과 시 종료

### TC-A03 — 확정 신뢰도 = AI 산출값 (FR-005) · P1
- **절차**: 후보 확정 `POST /qa/confirm`
- **기대결과**: `hsm_query_logs.confidence`=AI confidence(FE 전달 score 아님), audit `source` AI 구분

### TC-A04 — AI 미설정 시 A 무중단 (R4) · P0
- **기대결과**: 검색 순위 그대로, 신뢰도=검색 score, 화면 정상

### TC-A05 — 응답 시간 (NFR-001) · P1
- **기대결과**: 단건 후보 응답 P95 < 2s(AI 포함), 초과 시 측정·기록

---

## 4. Phase 3 — Feature C 배선 (TC-C)

### TC-C01 — 속성 폼 AI 분류 (R2) · P0
- **절차**: `POST /api/v1/attributes/classify` 속성 입력
- **기대결과**: A와 동일 AI+RAG 엔진 결과(신뢰도 포함)

### TC-C02 — 엑셀 일괄 AI 분류 (R2) · P0
- **절차**: 템플릿 검증 통과 파일 업로드 → BullMQ 배치
- **기대결과**: 행별 AI 분류, `THRESHOLD_FLAG` 미만 REVIEW 플래그, 비동기 완료

### TC-C03 — 엑셀 대량 비동기 (NFR-004) · P1
- **입력**: 수백~1000행
- **기대결과**: 큐 처리·진행률 폴링·완료, 타임아웃 없음

### TC-C04 — C 미설정 시 폴백 (R4) · P0
- **기대결과**: AI 없이 검색 분류(현행), 무중단

### TC-C05 — 결과 export (FR-034) · P2
- **기대결과**: HS·신뢰도·source 컬럼 포함 엑셀 다운로드

---

## 5. Phase 3 — Feature C 참조 저장 (TC-CS)

### TC-CS01 — 확정 결과 reference 저장 (R3/FR-005) · P0
- **전제**: C 분류 결과 확정
- **절차**: "reference에 저장" (`POST /reference/entries` 등)
- **기대결과**: `hsm_hs_references`에 신규 행 생성(`ent_id` 스코핑), 임베딩 생성, audit 기록

### TC-CS02 — 저장분이 RAG에 반영 (R3) · P0
- **절차**: 저장 후 동일/유사 쿼리 재검색
- **기대결과**: 방금 저장한 참조가 후보/근거로 등장(자기개선 루프 확인)

### TC-CS03 — 중복 저장 dedupe (FR-044) · P1
- **입력**: 동일 HS+품명+원산지+단위 재저장
- **기대결과**: dedupe 키로 중복 방지(중복 행 미생성 또는 병합)

### TC-CS04 — 저장 권한 게이트 · P1
- **전제**: 권한별(MEMBER/관리자/확정)
- **기대결과**: 저품질/무권한 저장 차단(정책에 따른 게이트), 무권한 403

### TC-CS05 — 저장 실패 원자성 · P1
- **전제**: 임베딩 실패
- **기대결과**: 행 저장/임베딩 정합 처리(부분 저장 시 재시도 가능·오염 없음)

---

## 6. 폴백/Graceful (TC-F)

### TC-F01 — 키 미설정 전 기능 동작 (R4) · P0
- **기대결과**: A·C 모두 검색 기반으로 무중단 동작

### TC-F02 — AI 타임아웃 폴백 · P1
- **기대결과**: 지연 초과 시 검색 폴백, 사용자 대기 무한정 아님

### TC-F03 — 구조화 출력 파싱 실패 · P1
- **기대결과**: 스키마 미준수 응답 시 재시도 또는 검색 폴백(500 노출 아님)

### TC-F04 — 임베딩+AI 모두 비활성 · P0
- **기대결과**: 키워드 검색만으로 A·C 정상(최소기능 보장)

---

## 7. 예산/비기능 (TC-N)

### TC-N01 — 일일 예산 가드 · P0
- **전제**: `AI_DAILY_BUDGET_USD` 근접/초과
- **기대결과**: 초과 시 AI 호출 중단→검색 폴백 + 경고 로그, 예산 리셋 후 재개

### TC-N02 — 프롬프트 캐싱 효과 · P2
- **기대결과**: 반복 요청 시 `cache_read_input_tokens>0`(시스템/후보 프리픽스 캐시)

### TC-N03 — 3언어 i18n · P1
- **기대결과**: 신뢰도·근거·명확화·"저장" 문구 ko/en/vi 노출, 키 미노출

### TC-N04 — top-3 정확도(표본) (NFR-003) · P2
- **기대결과**: 검증 표본에서 top-3 정확도 측정(목표 ≥90% 추적)

### TC-N05 — 기본 모델 정합 · P1
- **기대결과**: `.env`/`.env.example` 기본 모델=`claude-opus-4-8`, 설정 오버라이드 동작

---

## 8. 멀티테넌시/감사 (TC-X)

### TC-X01 — reference 저장 ent_id 스코핑 · P0
- **기대결과**: 저장 행 `ent_id`=현재 엔티티, 타 테넌트 조회 불가

### TC-X02 — 저장분 크로스테넌트 미노출 · P0
- **절차**: 테넌트 A 저장 → 테넌트 B 검색
- **기대결과**: B는 A의 저장 참조를 보지 못함

### TC-X03 — AI 분류 감사 기록 · P1
- **기대결과**: 분류/확정/저장에 audit(who/when/source) 기록

### TC-X04 — 인증 가드 · P0
- **기대결과**: 무토큰 401, 저장 엔드포인트 `@Auth`/권한 적용

---

## 9. Feature B 회귀 (TC-B)

### TC-B01 — 바코드 목업/현행 유지 (R5) · P0
- **기대결과**: L1 직접매핑+국가확장 동작, L2/L3/L4 `unused` 표시(변경 없음)

### TC-B02 — B 무회귀 · P1
- **기대결과**: 본 작업(A·C AI화)이 gtin 파이프라인/화면에 영향 없음

---

> 판정 결과는 테스트 수행 후 **테스트완료보고서 `docs/test/TR-20260709-...`** 에 기록한다.
