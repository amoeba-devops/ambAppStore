---
document_id: HSCODE-AGENT-TC-1.0.0
version: 1.0.0
status: Draft
created: 2026-07-09
author: Gray Kim
based_on:
  - docs/analysis/REQ-20260709-HSCode-통관세관AI에이전트-페르소나설정.md (v1.2, R1~R9)
  - docs/plan/PLAN-20260709-HSCode-통관세관AI에이전트.md (Phase 0~8)
  - 업로드: hscode-classification-agent-requirements.md (FR-001~009, NFR-001~005), ERD
scope: 통관 HS 분류 에이전트 — 규칙엔진×다중관점 RAG×LLM, 4계층 데이터, 에스컬레이션 출력, 자기개선. app-hscode-manager 확장.
---

# HS Code 통관 에이전트 — 테스트케이스

## 0. 개요
| 항목 | 내용 |
|------|------|
| 대상 | 원부자재 성분·비율 기반 VN HS 추천 에이전트 |
| 환경 | 개발/스테이징/프로덕션(app-hscode-manager, PostgreSQL+pgvector, TEI BGE-M3, Claude) |
| 우선순위 | P0/P1/P2 · 판정 Pass/Fail/Blocked/N/A |
| 전제 | AMA SSO, ent_id(UUID), 유효 Claude 키, 지식/코퍼스 시드(품목군 표본) |

### 0.1 추적성
| 그룹 | TC | FR/NFR | Phase |
|------|-----|--------|-------|
| 스키마 | TC-D01~D04 | ERD | 0 |
| 입력(Item/BOM) | TC-I01~I06 | FR-001, A4, NFR-005 | 1 |
| 규칙엔진 | TC-R01~R06 | FR-004, A3 | 2 |
| 지식/다중관점 RAG | TC-K01~K07 | FR-005, B4/B5 | 3 |
| LLM/출력 | TC-O01~O08 | FR-002/003/005/006, A5 | 4 |
| 판정/자기개선 | TC-C01~C05 | FR-008/009 | 5 |
| 어드민 | TC-A01~A04 | 페르소나·지식 | 6 |
| 프론트/화면 | TC-U01~U06 | SCR-1~5 | 7 |
| 비기능/멀티테넌시 | TC-N01~N06 | NFR-001~005 | 전반 |

---

## 1. 스키마 (TC-D)
- **TC-D01**(P0): 마이그레이션 적용 → 신규 테이블(hsm_items·compositions·documents·doc_chunks·class_cases·recommendations + 마스터사전) 생성, 기존 `hsm_*` 무변경.
- **TC-D02**(P0): `hsm_doc_chunks.chk_embedding vector(1024)` + hnsw 코사인 인덱스 존재.
- **TC-D03**(P0): 지식문서 `hsm_documents.ent_id` **NULL 허용**(전역/슈퍼관리자), 트랜잭션 테이블 `ent_id` NOT NULL.
- **TC-D04**(P1): FK(compositions→items, chunks→documents, recommendations→items) ON DELETE CASCADE, 인덱스(ent_id·status·risk·escalation) 존재.

## 2. 입력 Item/BOM (TC-I)
- **TC-I01**(P0/FR-001): Item 생성 시 품명(ko/en/trade)·수입국(기본 VN)·수출국·용도·가공단계·제조방식 저장.
- **TC-I02**(P0/FR-001): Composition 다건(성분명·재질군·기능·함량%) 저장, **합계 100% 검증**(초과/미달 경고).
- **TC-I03**(P0): 성분비를 **배열/행 구조**로 저장(텍스트 아님) — 규칙엔진 입력 가능.
- **TC-I04**(P1): 기존 KR/CN·공급사 코드 저장. 증빙(MSDS/COA/BOM) 첨부·메타.
- **TC-I05**(P0/NFR-005): **동일 품명·다른 성분비/용도 → 다른 추천** 유도(품명 단독 판단 금지).
- **TC-I06**(P0): 모든 Item/Composition `ent_id` 스코핑(타 테넌트 조회 불가).

## 3. 규칙엔진 (TC-R)
- **TC-R01**(P0/FR-004): Composition에서 **주성분(최대함량)·주성분비율** 산출 → Item 파생컬럼 갱신.
- **TC-R02**(P0): **본질적 특성 유형·혼합/적층/코팅 플래그** 계산.
- **TC-R03**(P0): **용도 우선 분류 가능성** 판정(용도별 분기).
- **TC-R04**(P0/FR-006): **위험점수** 계산(함량 근소차·복합소재·해석상이) → 임계 초과 시 `is_pre_ruling_required`/`customs_risk_level=HIGH`.
- **TC-R05**(P0): 단순혼합 vs 화학변성(process_type) 구분이 결과에 반영.
- **TC-R06**(P1): 규칙 결과가 RAG 질의·LLM 컨텍스트에 결정론적 힌트로 전달.

## 4. 지식 & 다중관점 RAG (TC-K)
- **TC-K01**(P0): 지식문서 업로드 → 유형별 **청킹**(법령=조문, 사례=1사례1청크, 기술=성분/물성 분리, HS해설=chapter-heading-subheading) + 메타(chunk_type/rule_type/applies_to_mix/applies_to_ratio/citation_text).
- **TC-K02**(P0): 청크 BGE-M3 임베딩(1024) 생성, `chk_embedding` 채움.
- **TC-K03**(P0/FR-005): **5관점 병렬 검색**(품명·재질/함량·용도/기능·가공·국가차이/사전심사) 실행.
- **TC-K04**(P0): 신고이력(hsm_hs_references) + 지식청크 융합, **VN 가중** 우선.
- **TC-K05**(P0): 전역 지식(ent_id NULL) + 엔티티 LEARNED 결합 검색(`ent_id=현재 OR NULL`).
- **TC-K06**(P1): 근거로 반환된 청크가 실제 문서 근거(citation_text) — 환각 아님.
- **TC-K07**(P2): 관점별 topN 상한·캐싱으로 지연·비용 관리.

## 5. LLM/출력 (TC-O)
- **TC-O01**(P0/FR-002): **VN HS(8/10자리)를 최우선 추천값**으로 산출, KR/CN은 매핑 참고.
- **TC-O02**(P0/FR-003): **복수 후보(우선순위)** 출력, 단일 단정 금지.
- **TC-O03**(P0/A5): 각 후보에 **추천사유·분류근거(근거청크 인용)·확인쟁점·VN 최종확인 여부** 표시.
- **TC-O04**(P0/A5): **"분류확정" vs "검토필요"** 상태 구분.
- **TC-O05**(P0/FR-006): 위험↑ 시 **사전심사 필요/에스컬레이션 플래그** 자동 표시.
- **TC-O06**(P0): 규칙결과+검색결과 결합해 LLM 설명 생성(그라운딩=후보/근거 범위 내).
- **TC-O07**(P0): 출력 구조화 JSON 계약을 설정 프롬프트가 못 깨게 서비스가 강제 + 파싱실패/키없음 폴백.
- **TC-O08**(P1): Recommendation 저장(후보·근거청크·rule_signals·미해결질문·에스컬레이션).

## 6. 판정/자기개선 (TC-C)
- **TC-C01**(P0/FR-008): 확정 시 Classification Case 축적(recommended/final HS·본질특성·주성분·reviewer).
- **TC-C02**(P0/R5): 확정분 → 신고이력 + **지식(LEARNED)** 재저장·임베딩 → 재활용.
- **TC-C03**(P0): 저장분이 이후 다중관점 검색에 노출(자기개선 확인).
- **TC-C04**(P1/FR-009): 반려/확정 결과 → 품질지표(확정일치율·반려율) 수집.
- **TC-C05**(P1): 에스컬레이션 → 관세사 채널 전달(채널 확정 후).

## 7. 어드민 (TC-A)
- **TC-A01**(P0): 에이전트 페르소나(system_prompt)·통관규칙·모델·위험임계 엔티티별 저장/조회, api_key 마스킹.
- **TC-A02**(P0): 미설정 시 **강화 기본 통관 페르소나** 사용.
- **TC-A03**(P0): 지식문서 CRUD/업로드/청킹 **@SuperAdminOnly**(테넌트 관리자 차단).
- **TC-A04**(P1): 전역 지식(ent_id NULL) 관리 = 슈퍼관리자, LEARNED = 엔티티.

## 8. 프론트/화면 (TC-U)
- **TC-U01**(P0/SCR-1): 원부자재 입력 — Item + BOM 성분 반복 입력, 합계 검증, 증빙 첨부.
- **TC-U02**(P0/SCR-2): 추천 결과 — 복수후보·신뢰도·추천사유·근거·확인쟁점·확정/검토 배지·사전심사 경고·KR/CN 매핑·확정/보류/반려.
- **TC-U03**(P0/SCR-3): 지식문서 관리(슈퍼관리자) — 유형/국가/신뢰도 필터·업로드·태그.
- **TC-U04**(P0/SCR-4): 에이전트 설정 — 페르소나 textarea·규칙·위험임계·후보수.
- **TC-U05**(P1/SCR-5): 추천/사례 이력 — 확정 사례·재사용 표시.
- **TC-U06**(P1): i18n ko/en/vi, 하드코딩 없음.

## 9. 비기능/멀티테넌시 (TC-N)
- **TC-N01**(P0/NFR-001): 추천 기준국 항상 VN 고정.
- **TC-N02**(P0/NFR-002): 모든 추천에 근거 문장·확인 포인트 동반.
- **TC-N03**(P0/NFR-003): 고위험/해석차이 품목 자동 사전심사·관세사 라우팅.
- **TC-N04**(P0/NFR-004): 원산지검토용 vs 수입통관용 데이터 맥락 분리.
- **TC-N05**(P0/NFR-005): 품명 단독 판단 금지(성분/용도 필수).
- **TC-N06**(P0): 지식(전역=슈퍼관리자)/LEARNED/Item/Case `ent_id` 스코핑, 인증 가드.

> 판정 결과는 **TR-20260709-...** 에 기록. 대상 품목군·위험임계·에스컬레이션 채널·MVP 범위(Part C) 확정 후 시드·검증.
