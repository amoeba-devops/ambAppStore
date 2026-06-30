---
document_id: HSCODE-MGR-REQDEF-1.0.0
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
    description: Initial draft — detailed requirements definition
---

# HS Code Manager — Requirements Definition (HS코드 매니저 요구사항 정의서)

Details each requirement from the analysis stage with input/output, business rules, and acceptance criteria. (분석 단계 요구사항을 입력/출력·비즈니스 룰·인수 조건으로 상세화한다.)

---

## Feature A — Conversational Q&A Search

### FR-001: Natural-language product input
- **Description**: User describes a product in free text (KR/EN/VI) in a chat input.
- **Input**: Text string (1–500 chars).
- **Output**: Accepted query forwarded to semantic search.
- **Business rules**: Reject empty or < 2-char input; preserve original language for cross-language embedding.
- **Acceptance**: Given a valid description, the system initiates a search and shows a typing indicator within 300ms.
- **Priority**: P0 / **Related**: FR-002, NFR-005.

### FR-002: AI semantic search over reference table
- **Description**: Embed the query and retrieve top-N candidate HS codes from the 면장리스트-seeded reference table by vector similarity.
- **Input**: Query embedding; optional accumulated constraints.
- **Output**: Ranked list of candidates with similarity scores and source reference rows.
- **Business rules**: N default = 5; cross-language match (KR/EN query ↔ VI `Tên hàng`); exclude rows below a minimum similarity floor.
- **Acceptance**: Top-3 contains the correct HS code ≥ 90% on the validated set (NFR-003); P95 ≤ 2s (NFR-001).
- **Priority**: P0 / **Related**: FR-003, FR-006, NFR-001, NFR-003.

### FR-003: Sequential clarifying questions
- **Description**: When candidates are ambiguous, ask one targeted question at a time to disambiguate.
- **Input**: Current candidate set + score distribution.
- **Output**: A single clarifying question (material / usage / processing state / composition).
- **Business rules**: Trigger when top-1 and top-2 score gap < threshold (POL-001); max 5 question rounds, then present best candidates.
- **Acceptance**: Each answer measurably re-ranks candidates; loop terminates within max rounds.
- **Priority**: P0 / **Related**: FR-002, POL-001.

### FR-004: Candidate result display
- **Description**: Show each candidate's HS code, matched description, origin, unit, and confidence.
- **Output**: Candidate cards.
- **Business rules**: Sort by confidence desc; confidence shown as % band.
- **Acceptance**: All listed fields render for each candidate.
- **Priority**: P0 / **Related**: FR-041.

### FR-005: Confirm & log
- **Description**: User confirms a final HS code; the query+result is stored for reuse.
- **Output**: `hsm_query_logs` record; optional new `hsm_hs_references`/learned entry.
- **Business rules**: Store input, chosen HS, confidence, session, timestamp.
- **Acceptance**: Confirmed result is retrievable in history.
- **Priority**: P1 / **Related**: FR-007.

### FR-006: Source citation
- **Description**: Show the reference row(s) that justified each suggestion.
- **Acceptance**: Each candidate links to ≥ 1 source row (company/file/line).
- **Priority**: P1.

### FR-007: Session history
- **Description**: Retain conversation turns within a session.
- **Priority**: P2.

---

## Feature B — Barcode (GTIN) Lookup

### FR-010: GTIN input & 14-digit normalization
- **Description**: Accept GTIN-8/12/13/14 and left-pad to 14 digits.
- **Input**: Raw barcode string.
- **Output**: Normalized 14-digit GTIN.
- **Business rules**: Strip non-digits; `padStart(14,'0')` (design doc §5.2).
- **Acceptance**: All four GTIN formats normalize to a 14-digit value.
- **Priority**: P0 / **Related**: FR-011.

### FR-011: Check-digit validation
- **Description**: Validate modulo-10 check digit; reject malformed barcodes before any lookup.
- **Output**: valid / invalid.
- **Business rules**: Right-weighted 3,1,3,1…; `calc = (10 - (sum % 10)) % 10` must equal last digit.
- **Acceptance**: Known-good GTINs pass; corrupted digits fail.
- **Priority**: P0.

### FR-012: Destination country selection
- **Description**: Require destination country to expand HS6 to the national 8–10 digit code.
- **Business rules**: ISO 3166 alpha-2; default from user profile if set.
- **Acceptance**: Lookup is blocked until a country is chosen.
- **Priority**: P0 / **Related**: FR-017.

### FR-013: Layer 1 — internal direct mapping
- **Description**: Resolve GTIN→HS6 from `hsm_gtin_hs_maps` when present (fastest path).
- **Output**: HS6 + source + confidence, or miss.
- **Business rules**: On hit, skip external calls; proceed to country expansion.
- **Acceptance**: A mapped GTIN returns without any external API call.
- **Priority**: P0 / **Related**: FR-017, FR-018.

### FR-014: Layer 2 — product info resolution
- **Description**: On L1 miss, fetch product info (GPC Brick, description, brand) from internal master then GS1 API.
- **Input**: 14-digit GTIN.
- **Output**: Product info object.
- **Business rules**: Internal `hsm_product_masters` first; GS1 only on miss; cache results.
- **Acceptance**: Returns GPC/description for a known GTIN; graceful miss otherwise.
- **Priority**: P0 / **Related**: FR-021, POL-004.

### FR-015: Layer 3 — GPC→HS mapping (1:many)
- **Description**: Map GPC Brick → HS6 via `hsm_gpc_hs_maps`; handle one-to-many.
- **Output**: Single HS6, or priority-ranked candidate list.
- **Business rules**: One Brick may map to multiple HS6 (GPC finer than HS); order by `priority`.
- **Acceptance**: Single mapping auto-resolves; multiple returns a ranked list.
- **Priority**: P0 / **Related**: FR-016.

### FR-016: Layer 4 — AI classify fallback
- **Description**: Infer HS6–HS10 from description via external classifier with confidence when GPC mapping is empty/ambiguous.
- **Output**: HS + confidence + candidates.
- **Business rules**: Confidence-gated by POL-001 threshold; below → review queue.
- **Acceptance**: High-confidence returns auto-resolve; low-confidence routes to review.
- **Priority**: P1 / **Related**: FR-019, POL-001.

### FR-017: Country HS expansion
- **Description**: Expand resolved HS6 to destination-country full code + duty rate via `hsm_hs_country_extensions`.
- **Output**: `hs_full`, duty_rate, description.
- **Business rules**: HS6 base global; national digits per country table.
- **Acceptance**: Returns the correct national code for the selected country.
- **Priority**: P0.

### FR-018: Learned mapping write-back
- **Description**: Persist API/AI/manual results into `hsm_gtin_hs_maps` (source ∈ manual/api/learned).
- **Acceptance**: A re-query of the same GTIN now resolves at Layer 1.
- **Priority**: P1.

### FR-019: Manual-review queue
- **Description**: Route below-threshold results to a review queue instead of auto-returning.
- **Output**: `hsm_review_queues` entry; status `pending_review`.
- **Acceptance**: Low-confidence GTIN is not auto-confirmed; appears in the queue.
- **Priority**: P1.

### FR-020: Audit trail
- **Description**: Persist resolution source, confidence, country, and verifier per result.
- **Business rules**: Immutable append; retained per POL-003.
- **Acceptance**: Every resolved result has a matching audit row.
- **Priority**: P0.

### FR-021: Result caching
- **Description**: Cache resolved GTIN lookups to cut external cost/latency.
- **Business rules**: Cache key = GTIN+country; TTL per POL-004.
- **Priority**: P1.

### FR-022: Legal notice
- **Description**: Display that auto-classification is a recommendation; final responsibility rests with the importer/exporter.
- **Acceptance**: Notice visible on every barcode result.
- **Priority**: P0 / **Related**: POL-002.

---

## Feature C — Attribute / Excel-Upload Search

### FR-030: Structured attribute form
- **Description**: On-site form for product attributes (name, material, usage, composition, origin, unit, …).
- **Output**: Attribute object → matching engine.
- **Acceptance**: Submitting the form returns HS candidates like Feature A.
- **Priority**: P0 / **Related**: FR-033.

### FR-031: Excel template upload
- **Description**: Upload a fixed-template `.xls/.xlsx` for batch lookup.
- **Business rules**: Accept defined columns only; max size per NFR-004.
- **Acceptance**: A conforming file is accepted for processing.
- **Priority**: P0.

### FR-032: Template validation
- **Description**: Validate columns/types/required fields; report errors per row.
- **Output**: Validation report (row, column, reason).
- **Acceptance**: Invalid file yields a precise per-row error list.
- **Priority**: P0 / **Related**: FR-035.

### FR-033: Per-row attribute classification
- **Description**: Analyze each row's attributes and assign HS + confidence (reuses Feature A engine).
- **Acceptance**: Each valid row gets an HS code and confidence.
- **Priority**: P0 / **Related**: FR-002.

### FR-034: Result export
- **Description**: Download results as Excel with HS, confidence, and source columns appended.
- **Acceptance**: Export preserves input rows + appended columns.
- **Priority**: P1.

### FR-035: Template download
- **Description**: Provide a blank template matching the required schema.
- **Priority**: P1.

### FR-036: Low-confidence flagging
- **Description**: Flag rows below threshold for manual review.
- **Priority**: P2 / **Related**: POL-001.

---

## Common

### FR-040: Reference import with per-format adapters
- **Description**: Import/append 면장리스트 records via adapters for `BaoCaoHangChiTiet`, `BaoCaoToKhai`, `VMSG`.
- **Output**: Normalized rows into `hsm_hs_references`; `hsm_import_batches` record.
- **Acceptance**: Each supported format imports into the common schema.
- **Priority**: P0 / **Related**: FR-043, FR-044.

### FR-041: Normalized result object
- **Description**: All modes return {hs_code, hs6, description, confidence, source, country}.
- **Priority**: P0.

### FR-042: Duty/VAT linkage
- **Description**: Link results to duty/VAT from reference data when available.
- **Priority**: P2.

### FR-043: 8/10-digit HS support
- **Description**: Manage matching at HS6 base + country extension for 8–10 national digits.
- **Priority**: P0 / **Related**: FR-017.

### FR-044: Cross-company dedupe
- **Description**: Deduplicate identical/near-duplicate reference rows during import.
- **Business rules**: Key = HS + normalized description + origin + unit.
- **Priority**: P1.

---

## Non-Functional (요약)

| ID | Requirement | Criteria |
|----|-------------|----------|
| NFR-001 | Q&A/attribute response | P95 < 2s |
| NFR-002 | GTIN lookup response | P95 < 3s incl. external API |
| NFR-003 | Top-3 accuracy | ≥ 90% on validated set |
| NFR-004 | Excel batch size | Up to N rows [TBD]; async beyond threshold |
| NFR-005 | Multi-language | KR/EN/VI input |
| NFR-006 | External API resilience | Graceful fallback when GS1/AI unavailable |
| NFR-007 | Security | Access control + audit logging |
| NFR-008 | Availability | 99.5% business hours [TBD] |
