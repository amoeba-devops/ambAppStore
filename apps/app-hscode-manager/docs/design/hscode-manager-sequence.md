---
document_id: HSCODE-MGR-SEQ-1.0.0
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
    description: Initial draft — sequence diagrams (Q&A, 4-layer GTIN, Excel batch)
---

# HS Code Manager — Sequence Diagrams (HS코드 매니저 시퀀스 다이어그램)

Participants use the actual AmoebaTalk stack: React frontend, NestJS backend, PostgreSQL, Redis Queue (BullMQ), plus external GS1 / AI classifier. (실제 기술스택 컴포넌트명을 participant로 사용한다.)

---

## Scenario 1: Conversational Q&A Search (질문응답형 검색) — FN-001/002/003

```mermaid
sequenceDiagram
    actor User
    participant FE as Frontend (React)
    participant BE as NestJS Backend (apps/api)
    participant VEC as Vector Index
    participant DB as PostgreSQL (hsm_hs_references)

    User->>FE: Enter product description (FR-001)
    FE->>BE: POST /api/v1/qa/search {query, lang}
    BE->>VEC: embed(query) + ANN search (FN-001)
    VEC-->>BE: top-N candidate refs + scores
    BE->>DB: fetch source rows for candidates
    DB-->>BE: hs_code, Tên hàng, origin, unit
    alt score gap < threshold (ambiguous)
        BE-->>FE: clarifying question (FN-002)
        FE-->>User: ask one question
        User->>FE: answer
        FE->>BE: POST /api/v1/qa/refine {answer}
        BE->>VEC: re-rank with constraint
        VEC-->>BE: refined candidates
    end
    BE-->>FE: ranked candidates + sources (FR-004/006)
    FE-->>User: candidate cards
    User->>FE: confirm final HS
    FE->>BE: POST /api/v1/qa/confirm
    BE->>DB: write hsm_query_logs (FR-005)
    BE-->>FE: result detail
```

---

## Scenario 2: Barcode (GTIN) 4-Layer Resolution (바코드 4계층 조회) — FN-010~018

```mermaid
sequenceDiagram
    actor User
    participant FE as Frontend (React)
    participant BE as NestJS Backend (apps/api)
    participant MAP as PostgreSQL (hsm_gtin_hs_maps / hsm_gpc_hs_maps / hsm_hs_country_extensions)
    participant GS1 as GS1 API
    participant AI as AI Classifier
    participant RQ as Review Queue

    User->>FE: Enter GTIN + destination country
    FE->>BE: POST /api/v1/gtin/resolve {gtin, country}
    BE->>BE: normalize 14-digit + check digit (FN-010)
    alt invalid check digit
        BE-->>FE: InvalidGtinError (FR-011)
    else valid
        BE->>MAP: Layer1 find hsm_gtin_hs_maps[gtin] (FN-011)
        alt L1 hit
            MAP-->>BE: hs6 + source
        else L1 miss
            BE->>GS1: Layer2 fetch product info (FN-012)
            GS1-->>BE: GPC brick + description
            BE->>MAP: Layer3 hsm_gpc_hs_maps[brick] (FN-013)
            alt single HS6
                MAP-->>BE: hs6
            else 1:many or none
                BE->>AI: Layer4 classify(description, country) (FN-014)
                AI-->>BE: hs6 + confidence + candidates
                alt confidence < threshold
                    BE->>RQ: enqueue review (FN-017)
                    BE-->>FE: pending_review
                end
            end
            BE->>MAP: write learned mapping (FN-016)
        end
        BE->>MAP: Layer expand hs6 -> hs_full + duty (FN-015)
        MAP-->>BE: hs_full, duty_rate
        BE->>MAP: append hsm_resolution_audits (FN-018)
        BE-->>FE: result + legal notice (FR-017/020/022)
        FE-->>User: HS code + duty + disclaimer
    end
```

---

## Scenario 3: Attribute / Excel Batch Search (속성/엑셀 일괄 조회) — FN-031/032

```mermaid
sequenceDiagram
    actor User
    participant FE as Frontend (React)
    participant BE as NestJS Backend (apps/api)
    participant MQ as Redis Queue (BullMQ)
    participant WK as Classify Worker
    participant VEC as Vector Index

    User->>FE: Upload Excel template
    FE->>BE: POST /api/v1/excel/upload (file)
    BE->>BE: validate template (FN-031)
    alt template invalid
        BE-->>FE: per-row error report (FR-032)
        FE-->>User: show errors + template download
    else valid
        BE->>MQ: enqueue valid rows
        loop each row
            MQ->>WK: row attributes
            WK->>VEC: embed + retrieve (FN-001)
            VEC-->>WK: HS candidate + score
            WK-->>BE: row result (flag low-confidence) (FR-036)
        end
        BE-->>FE: results table + progress
        User->>FE: download result Excel (FR-034)
        FE->>BE: GET /api/v1/excel/export
        BE-->>FE: workbook (HS + confidence + source)
    end
```

---

## Scenario 4: Reference Import (참조 데이터 import) — FN-040/041

```mermaid
sequenceDiagram
    actor Admin
    participant FE as Admin UI (React)
    participant BE as NestJS Backend (apps/api)
    participant AD as Import Adapter
    participant DB as PostgreSQL (hsm_hs_references)
    participant VEC as Vector Index

    Admin->>FE: Upload 면장리스트 file
    FE->>BE: POST /api/v1/admin/import
    BE->>AD: detect format + parse (FN-040)
    AD-->>BE: normalized rows
    BE->>DB: dedupe + upsert (FN-041 / FR-044)
    BE->>VEC: embed new rows
    BE-->>FE: hsm_import_batches summary (total/imported/failed)
```
