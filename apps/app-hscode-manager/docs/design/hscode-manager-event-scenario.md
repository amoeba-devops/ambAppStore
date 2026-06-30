---
document_id: HSCODE-MGR-EVTSCN-1.0.0
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
    description: Initial draft — event scenarios for 3 search modes
---

# HS Code Manager — Event Scenario (HS코드 매니저 이벤트 시나리오)

Defines user actions and system responses at the event level for the three search modes. Input for the sequence diagram and functional spec. (3가지 검색 모드의 사용자 행동·시스템 반응을 이벤트 단위로 정의한다.)

Related: requirements `FR-001~044`. Tech stack: React (frontend), NestJS (backend), PostgreSQL, Redis Queue (BullMQ), Redis.

---

## Scenario 1: Conversational Q&A Search (질문응답형 검색)

**Actors**: User, Frontend (React), Backend (NestJS), Vector Index, Reference DB.
**Precondition**: HS reference table is populated from the 면장리스트 corpus and embeddings are indexed.

| Seq | Actor | Event | System Response | Note |
|-----|-------|-------|-----------------|------|
| 1 | User | Enters free-text product description in chat (자연어 입력) | Frontend shows the message and a typing indicator | FR-001 |
| 2 | System | Backend embeds the query and runs semantic search over the reference table | Returns top-N candidate HS codes with scores | FR-002 |
| 3 | System | Evaluates score gap / ambiguity | If confident → go to 6; if ambiguous → go to 4 | POL-001 |
| 4 | System | Generates a clarifying question (e.g., material, usage, processing state) | Shows the question as the next chat turn | FR-003 |
| 5 | User | Answers the clarifying question | Backend re-ranks candidates with the added constraint; loop to 3 | FR-003 |
| 6 | System | Presents ranked candidates: HS code, matched description, origin, unit, confidence, source row | Renders candidate cards | FR-004, FR-006 |
| 7 | User | Selects and confirms a final HS code | Logs the query+result for reuse; shows result detail | FR-005, FR-007 |

### Exception Scenarios (예외 시나리오)

| Condition | System Response |
|-----------|-----------------|
| No candidate above the minimum score | Show "no confident match" + offer attribute-form (Feature C) entry | FR-013-like fallback |
| Empty / too-short input | Inline validation: prompt for a fuller description |
| Vector index unavailable | Fall back to keyword search over `Tên hàng`; flag degraded mode |

---

## Scenario 2: Barcode (GTIN) Lookup — 4-Layer Resolution (바코드 4계층 조회)

**Actors**: User, Frontend, Backend (Node.js resolution pipeline), PostgreSQL (`hsm_gtin_hs_maps`, `hsm_gpc_hs_maps`, `hsm_hs_country_extensions`, `hsm_product_masters`), GS1 API, AI Classifier, Review Queue.
**Precondition**: Destination country selected; external API keys provisioned (or graceful degradation).

| Seq | Actor | Event | System Response | Note |
|-----|-------|-------|-----------------|------|
| 1 | User | Enters GTIN + selects destination country | Frontend validates non-empty input | FR-010, FR-012 |
| 2 | System | Normalize GTIN to 14 digits + verify modulo-10 check digit | If invalid → exception; else continue | FR-010, FR-011 |
| 3 | System | **Layer 1**: look up `hsm_gtin_hs_maps` by GTIN | If hit → expand by country (step 8) | FR-013 |
| 4 | System | **Layer 2**: fetch product info (internal master → GS1 API) | Obtain GPC Brick, description, brand | FR-014 |
| 5 | System | **Layer 3**: map GPC Brick → HS6 via `hsm_gpc_hs_maps` | 1 result → step 7; many → ambiguous candidates; none → step 6 | FR-015 |
| 6 | System | **Layer 4**: AI classifier infers HS from description + confidence | If conf ≥ threshold → step 7; else → review queue | FR-016, POL-001 |
| 7 | System | Persist learned mapping into `hsm_gtin_hs_maps` (source=api/learned) | Write-back for future shortcut | FR-018 |
| 8 | System | Expand HS6 → destination-country full code + duty via `hsm_hs_country_extensions` | Build result object | FR-017 |
| 9 | System | Write audit record (source, confidence, country, verifier) | Append to `hsm_resolution_audits` | FR-020 |
| 10 | System | Return result with legal notice | Render result + disclaimer | FR-022 |

### Exception Scenarios (예외 시나리오)

| Condition | System Response |
|-----------|-----------------|
| Invalid check digit | Reject with "invalid GTIN" message; no lookup performed (FR-011) |
| GS1 API unavailable / GTIN unknown | Fall back to attribute/Q&A search with any retrieved data (FR-013 fallback) |
| GPC→HS is 1:many | Return ranked candidate list (priority) or re-classify by description (FR-015) |
| AI confidence < threshold | Route to manual-review queue; return `pending_review` (FR-019) |
| Destination country not provided | Block lookup; HS6-only preview with prompt to select country |

---

## Scenario 3: Attribute / Excel-Upload Search (속성/엑셀 업로드 검색)

**Actors**: User, Frontend, Backend, Redis Queue (BullMQ) (async batch), Reference DB, Matching Engine (shared with Feature A).
**Precondition**: Fixed Excel template published; matching engine available.

| Seq | Actor | Event | System Response | Note |
|-----|-------|-------|-----------------|------|
| 1 | User | Chooses on-site form OR uploads Excel template | Frontend renders form / accepts file | FR-030, FR-031 |
| 2 | System | Validate file against template (columns, types, required) | Per-row error report if invalid | FR-032 |
| 3 | System | Enqueue rows for batch analysis (Redis Queue (BullMQ)) | Show progress; async for large files | NFR-004 |
| 4 | System | For each row, run attribute analysis via matching engine | Assign HS code + confidence per row | FR-033 |
| 5 | System | Flag low-confidence rows for manual review | Mark rows needing review | FR-036, POL-001 |
| 6 | User | Reviews results table; downloads Excel with HS+confidence+source appended | Generate export file | FR-034 |

### Exception Scenarios (예외 시나리오)

| Condition | System Response |
|-----------|-----------------|
| Template mismatch (wrong/missing columns) | Reject upload; show expected schema + downloadable template (FR-035) |
| Some rows invalid | Process valid rows; list invalid rows with reasons |
| Batch exceeds max size | Reject or split per NFR-004 [TBD] |
| Matching engine timeout on a row | Mark row as `error`, continue batch |

---

## Common Events (공통 이벤트)

| Event | Response | Note |
|-------|----------|------|
| Admin imports a 면장리스트 file | Detect format, run matching adapter, normalize → reference table, dedupe | FR-040, FR-044 |
| Any mode returns a result | Emit normalized result object {hs_code, description, confidence, source} | FR-041 |
| Result viewed | Link to duty/VAT from reference data when available | FR-042 |
