---
document_id: HSCODE-MGR-PROC-1.0.0
version: 1.0.0
status: Draft
created: 2026-06-23
updated: 2026-06-23
author: 김익용
reviewers: []
change_log:
  - version: 1.0.0
    date: 2026-06-23
    author: 김익용
    description: Initial draft — process definition (business view)
---

# HS Code Manager — Process Definition (HS코드 매니저 프로세스 정의서)

Business-view processes (sequence diagrams cover the technical flow). (비즈니스 관점의 흐름; 기술 흐름은 시퀀스 다이어그램 참조.)

---

## PRC-001: GTIN 4-Layer Resolution (바코드 4계층 결정)
- **Purpose**: Determine the destination-country HS code from a GTIN with the most accurate, lowest-cost path first.
- **Start**: User submits a valid GTIN + destination country.
- **End**: HS_full returned, or routed to manual review.

### Steps
| Step | Owner | Action | Input | Output | Branch |
|------|-------|--------|-------|--------|--------|
| 1 | System | Normalize + check-digit validate | raw GTIN | gtin14 | invalid → reject |
| 2 | System | Layer 1: direct `hsm_gtin_hs_maps` | gtin14 | hs6 | hit → step 6 |
| 3 | System | Layer 2: product info (master→GS1) | gtin14 | GPC/desc | miss → fallback to attribute/Q&A |
| 4 | System | Layer 3: `hsm_gpc_hs_maps` | GPC brick | hs6 / candidates | 1:many → re-classify; none → step 5 |
| 5 | System | Layer 4: AI classifier | description | hs6 + confidence | conf < threshold → PRC-005 |
| 6 | System | Country expansion `hsm_hs_country_extensions` | hs6 + country | hs_full + duty | no ext row → HS6 only |
| 7 | System | Learn + audit | result | hsm_gtin_hs_maps upsert + audit | |

### Exceptions
| Exception | Step | Handling |
|-----------|------|----------|
| Invalid GTIN | 1 | Reject; no lookup |
| GS1 unavailable | 3 | Fallback path; flag degraded |
| Low confidence | 5 | Route to PRC-005 |

---

## PRC-002: Q&A Iterative Narrowing (질문응답 점진적 좁히기)
- **Purpose**: Reach a confident HS code via semantic search + clarifying questions.
- **Start**: User free-text description. **End**: Confirmed HS or fallback.

| Step | Owner | Action | Branch |
|------|-------|--------|--------|
| 1 | System | Semantic retrieve top-N | empty → suggest attribute form |
| 2 | System | Evaluate ambiguity (score gap) | confident → 4 |
| 3 | User | Answer clarifying question | re-rank → loop to 2 (max 5) |
| 4 | User | Confirm final HS | log + audit |

---

## PRC-003: Excel Batch Classification (엑셀 일괄 분류)
- **Start**: User uploads template. **End**: Result workbook downloaded.

| Step | Owner | Action | Branch |
|------|-------|--------|--------|
| 1 | System | Validate template | invalid → error report + template download |
| 2 | System | Enqueue valid rows | large → async |
| 3 | System | Classify each row | low-confidence → flag for review |
| 4 | User | Review + download results | |

---

## PRC-004: Reference Data Import (참조 데이터 가져오기)
- **Start**: Admin uploads 면장리스트 file. **End**: Rows normalized + embedded.

| Step | Owner | Action | Branch |
|------|-------|--------|--------|
| 1 | System | Detect format | unknown → manual mapping |
| 2 | System | Parse via adapter (BaoCaoHangChiTiet/ToKhai/VMSG) | parse error → fail row |
| 3 | System | Dedupe (HS+desc+origin+unit) | duplicate → skip |
| 4 | System | Upsert + embed | report batch summary |

---

## PRC-005: Manual Review Handling (수동 검토 처리)
- **Start**: Low-confidence resolution enqueued. **End**: Verified mapping or rejection.

| Step | Owner | Action | Branch |
|------|-------|--------|--------|
| 1 | System | Enqueue with product + candidates | |
| 2 | Reviewer | Inspect & choose/confirm HS | reject → close |
| 3 | System | Persist as learned (source=manual) | update hsm_gtin_hs_maps + audit |
