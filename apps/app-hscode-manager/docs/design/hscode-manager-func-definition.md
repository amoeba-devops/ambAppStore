---
document_id: HSCODE-MGR-FUNCDEF-1.0.0
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
    description: Initial draft — functional specification (FN)
---

# HS Code Manager — Functional Specification (HS코드 매니저 기능 정의서)

System functions at the module/component level. Each FN traces back to FR requirements. (모듈 단위 기능 정의. 각 FN은 FR로 추적된다.)

Backend resolution logic follows `GTIN_HSCode_설계문서.md`, implemented on NestJS. Stack: React / NestJS / PostgreSQL / Redis (BullMQ queue) / SSE for streaming.

---

## Module: Search Core (검색 코어)

### FN-001: Semantic Candidate Retrieval
- **Function ID**: FN-001
- **Description**: Embed a query/attribute object and retrieve top-N HS candidates by vector similarity from `hsm_hs_references`.
- **Precondition**: Reference embeddings indexed.
- **Postcondition**: Candidate list with scores produced.
- **Processing logic**: normalize text → embed → ANN search → score → attach source rows → filter < floor.
- **Input params**: `queryText:string`, `constraints?:object`, `topN:int=5`, `lang:enum`.
- **Output**: `Candidate[] {hs_code, hs6, description, origin, unit, score, sourceRef}`.
- **Error handling**: index down → keyword fallback on `Tên hàng`; empty result → return [].
- **Related**: FR-002, FR-033.

### FN-002: Clarifying-Question Generator
- **Function ID**: FN-002
- **Description**: Decide whether disambiguation is needed and produce the next single question.
- **Precondition**: Candidate set exists.
- **Processing logic**: if `score[0]-score[1] < gapThreshold` and rounds < max → pick the discriminating attribute (material/usage/processing) → emit one question.
- **Input**: `Candidate[]`, `roundCount:int`.
- **Output**: `{needQuestion:bool, question?:string, attributeKey?:string}`.
- **Error handling**: max rounds reached → `needQuestion=false`.
- **Related**: FR-003, POL-001.

### FN-003: Result Assembler
- **Function ID**: FN-003
- **Description**: Build the normalized result object shared by all three modes.
- **Output**: `{hs_code, hs6, description, confidence, source, country?}` (FR-041).
- **Related**: FR-004, FR-041.

---

## Module: GTIN Resolution Pipeline (GTIN 조회 파이프라인)

### FN-010: GTIN Normalizer & Validator
- **Function ID**: FN-010
- **Description**: Normalize GTIN-8/12/13/14 to 14 digits and validate modulo-10 check digit.
- **Processing logic**: `digits = raw.replace(/\D/g,'')`; `padStart(14,'0')`; weighted (3,1…) sum; `calc=(10-sum%10)%10`.
- **Input**: `rawGtin:string`. **Output**: `{gtin14:string, valid:bool}`.
- **Error handling**: invalid → `InvalidGtinError` (no lookup).
- **Related**: FR-010, FR-011.

### FN-011: Layer 1 — Direct Mapping Lookup
- **Function ID**: FN-011
- **Description**: Find GTIN in `hsm_gtin_hs_maps`; return HS6 + source + confidence on hit.
- **Output**: `{hit:bool, hs6?, source?, confidence?}`.
- **Related**: FR-013.

### FN-012: Layer 2 — Product Info Resolver
- **Function ID**: FN-012
- **Description**: Resolve product info (GPC Brick, description, brand) from `hsm_product_masters`, else GS1 API.
- **Processing logic**: internal master → on miss call GS1 → cache to `hsm_product_masters`.
- **Error handling**: GS1 timeout/unauthorized → return `{found:false}` → triggers FR-013 fallback.
- **Related**: FR-014, FR-021, POL-004.

### FN-013: Layer 3 — GPC→HS Mapper
- **Function ID**: FN-013
- **Description**: Map GPC Brick → HS6 via `hsm_gpc_hs_maps`; resolve 1:many.
- **Output**: `{count, hs6?, candidates?:[{hs6,priority}]}`.
- **Processing logic**: 1 → resolve; >1 → ranked candidates / re-classify by description; 0 → escalate to FN-014.
- **Related**: FR-015.

### FN-014: Layer 4 — AI Classifier Adapter
- **Function ID**: FN-014
- **Description**: Call external classifier (Zonos/Pitney Bowes) with description + dest country; return HS + confidence.
- **Output**: `{hs6, hs_full?, confidence, candidates}`.
- **Processing logic**: confidence ≥ threshold → accept; else → FN-017.
- **Error handling**: API error → review queue.
- **Related**: FR-016, POL-001.

### FN-015: Country HS Expander
- **Function ID**: FN-015
- **Description**: Expand HS6 → national `hs_full` + duty via `hsm_hs_country_extensions`.
- **Input**: `hs6`, `country`. **Output**: `{hs_full, duty_rate, description}`.
- **Error handling**: no extension row → return HS6 + flag "national digits unavailable".
- **Related**: FR-017, FR-043.

### FN-016: Learned-Mapping Writer
- **Function ID**: FN-016
- **Description**: Upsert resolved GTIN→HS6 into `hsm_gtin_hs_maps` with source/confidence/verifier.
- **Related**: FR-018.

### FN-017: Manual-Review Enqueuer
- **Function ID**: FN-017
- **Description**: Insert low-confidence resolution into `hsm_review_queues` with product + candidates; return `pending_review`.
- **Related**: FR-019.

### FN-018: Resolution Audit Logger
- **Function ID**: FN-018
- **Description**: Append immutable audit record (input, resolved HS, source, confidence, country, verifier, ts).
- **Related**: FR-020, POL-003.

---

## Module: Attribute / Excel (속성/엑셀)

### FN-030: Attribute Form Handler
- **Function ID**: FN-030
- **Description**: Validate the structured attribute form and route to FN-001.
- **Related**: FR-030.

### FN-031: Excel Template Validator
- **Function ID**: FN-031
- **Description**: Parse upload, validate against template schema, emit per-row error report.
- **Input**: file. **Output**: `{validRows:[], errors:[{row,col,reason}]}`.
- **Related**: FR-031, FR-032, FR-035.

### FN-032: Batch Classifier & Exporter
- **Function ID**: FN-032
- **Description**: Enqueue valid rows (Redis Queue (BullMQ)), classify each via FN-001, flag low-confidence, build export workbook.
- **Processing logic**: async worker per row; aggregate; append HS/confidence/source columns.
- **Error handling**: row timeout → mark `error`, continue.
- **Related**: FR-033, FR-034, FR-036.

---

## Module: Reference Data (참조 데이터)

### FN-040: Import Adapter Dispatcher
- **Function ID**: FN-040
- **Description**: Detect file format and dispatch to the matching parser (`BaoCaoHangChiTiet` / `BaoCaoToKhai` / `VMSG`); normalize to `hsm_hs_references`.
- **Output**: `hsm_import_batches {rows_total, rows_imported, rows_failed}`.
- **Related**: FR-040.

### FN-041: Deduplicator & Embedder
- **Function ID**: FN-041
- **Description**: Dedupe by (HS + normalized description + origin + unit); generate embeddings for new rows.
- **Related**: FR-044, FR-002.
