---
document_id: HSCODE-MGR-REQ-1.1.0
version: 1.1.0
status: Draft
created: 2026-06-23
updated: 2026-07-08
author: 김익용
reviewers: []
change_log:
  - version: 1.0.0
    date: 2026-06-23
    author: 김익용
    description: Initial draft — requirements analysis for HS Code Manager (3 search modes)
  - version: 1.1.0
    date: 2026-07-08
    author: 김익용
    description: Add FR-023 (third-party barcode fallback → semantic search, PoC-gated); clarify MVP boundary as L1-only for Feature B; add PoC open question (Appendix B #10)
---

# HS Code Manager — Requirements Analysis (HS코드 매니저 요구사항 분석서)

## 1. Project Overview (프로젝트 개요)

- **Project**: HS Code Manager (HS코드 매니저)
- **Version**: 1.1.0 / **Date**: 2026-07-08
- **Service type**: New standalone service (신규 독립 서비스) — React + NestJS + PostgreSQL + Redis
- **Background and Purpose (배경 및 목적)**: Determining the correct HS code (Harmonized System code) for import/export goods is a repetitive, expertise-dependent task. Mis-classification causes customs delays, incorrect duty/VAT calculation, and compliance risk. The HS Code Manager lets users find the correct HS code through three complementary entry points — natural-language Q&A, barcode (GTIN) lookup, and structured attribute input — reducing reliance on manual expert judgment. (HS코드 분류는 반복적이고 전문성 의존도가 높은 작업이며, 오분류 시 통관 지연·관세/부가세 오류·컴플라이언스 리스크가 발생한다. 본 서비스는 자연어 질문응답, 바코드(GTIN) 조회, 속성 입력의 3가지 경로로 정확한 HS코드를 찾도록 지원한다.)
- **Expected Benefits (기대 효과)**:
  - Faster classification — reduce per-item lookup time vs. manual reference search (분류 시간 단축)
  - Higher consistency — same product → same HS code across users (분류 일관성 향상)
  - Lower compliance risk — fewer mis-declarations to customs (오신고 리스크 감소)
  - Reusable knowledge base — accumulate historical declarations as searchable reference data (과거 신고 이력의 재사용 가능한 지식화)

### Reference Data Context (참조 데이터 컨텍스트)

The reference corpus is the connected **면장리스트 (customs declaration list)** folder — a multi-company set of Vietnam customs `BaoCaoHangChiTiet` (goods-detail) reports. This corpus seeds the HS reference table used by Feature A (Q&A) and Feature C (attribute/Excel). Profiling summary:

| Attribute | Value | Note |
|-----------|-------|------|
| Source | 면장리스트 folder — Vietnam customs detailed import/export reports (베트남 통관 수출입 상세 보고서) | ~20+ companies (SARAH/HANS, BOSUNG VINA, DAEREE, DONGBO CHAIN, DONGSUNG CHEMICAL, JC VINA, KSM, Kyungbang, SEWANG, PSB, Sunrise, Tectyl, OKIA, suhil, etc.) |
| Files (standard schema) | 26 of 27 with `Mã HS` column | 1 variant (`BaoCaoToKhai- OKIA`) + 1 custom list (`VMSG`) use different layouts |
| Total data rows | ~94,700 line items | One row per declared goods line |
| Global unique HS codes | 808 | Mix of **8-digit and 10-digit** Vietnam HS codes |
| Per-file scale | 4 – 28,765 rows | Largest: SEWANG VINA (~28.7k rows) |
| Origins (sample) | CHINA, R.KOREA, VIETNAM, … | Field `Xuất xứ` |
| Units (sample) | SETS, PIECES, METRES, ROLL, … | Field `Đơn vị tính` |
| Trade type | Import (A12 …) / Export (B11/B13 …) | Field `Mã loại hình` |
| Domains | Auto parts, chemicals, textiles/yarn, chain, precision parts, lubricants, etc. (다업종) | Field `Tên hàng` |

Key source columns relevant to classification: `Mã HS` (HS code), `Tên hàng` (goods description), `Xuất xứ` (origin), `Đơn vị tính` (unit), `Đơn giá` (unit price), `Mã loại hình` (trade type), tax-rate columns (XNK/VAT/etc.).

> **Schema-variant note (스키마 변형 주의)**: Most files share the `BaoCaoHangChiTiet` layout (header row contains `Mã HS`), but `BaoCaoToKhai` (declaration-level) and `VMSG` (custom import list) differ. The data-import process (FR-040) needs a per-format adapter to normalize all variants into the common reference schema.

> **Important gap (중요 공백)**: The reference corpus contains **no barcode/GTIN column**. The GTIN→HS resolution for Feature B is therefore handled by the **2-stage pipeline** defined in the companion design doc `GTIN_HSCode_설계문서.md` (internal mapping table first → GS1 product info → GPC→HS → AI classify fallback), **not** a single direct GTIN→HS API call. See FR-010~023 and Section 6.

## 2. Stakeholders (이해관계자)

| Role | Person/Team | Responsibility |
|------|-------------|----------------|
| Product Owner | 김익용 | Requirements, scope, prioritization |
| Trade/Customs ops (통관 담당) | SARAH / HANS VN ops team | Primary end users; validate classification accuracy |
| Backend dev | [TBD] | NestJS API, search engine, GS1 integration |
| Frontend dev | [TBD] | React UI for 3 search modes |
| Data/ML | [TBD] | Embedding pipeline, semantic search tuning |
| QA | [TBD] | Test cases, classification accuracy verification |

## 3. Requirements (요구사항 목록)

### Functional Requirements (기능 요구사항)

#### Feature A — Conversational Q&A Search (질문응답형 검색)

| ID | Requirement | Priority | Note |
|----|-------------|----------|------|
| FR-001 | User enters a free-text product description in a chat input (자연어 제품 설명 입력) | P0 | Multi-language input (KR/EN/VI) |
| FR-002 | System runs AI semantic search over the HS code reference table and returns ranked candidate HS codes (AI 의미검색으로 후보 HS코드 순위 제시) | P0 | Embedding-based retrieval |
| FR-003 | When candidates are ambiguous, system asks sequential clarifying questions to narrow down (모호 시 순차적 추가 질문으로 좁혀감) | P0 | e.g., material, usage, processing state |
| FR-004 | Each candidate shows HS code, matched product description, origin, unit, and a confidence score (후보별 HS코드·품명·원산지·단위·신뢰도 표시) | P0 | |
| FR-005 | User can confirm a final HS code; the confirmed query+result is logged for reuse (확정 시 질의-결과 이력 저장) | P1 | Feeds back into reference data |
| FR-006 | System cites the source reference row(s) that justified the suggestion (근거가 된 참조 행 출처 표시) | P1 | Explainability |
| FR-007 | Conversation history is retained within a session (세션 내 대화 이력 유지) | P2 | |

#### Feature B — Barcode (GTIN) Lookup (바코드 입력 검색)

Design reference: `GTIN_HSCode_설계문서.md` (2-stage resolution pipeline). The single biggest constraint is that **no single API maps GTIN→HS directly**; GTIN yields product info (GPC/description) and HS must be inferred from it via internal-mapping-first fallback.

> **MVP implementation note (MVP 구현 범위 확인)**: The current implementation (`GtinPipelineService`) ships **Layer 1 (FR-013) + country expansion (FR-017)** only; Layer 2/3/4 (FR-014~016) are wired as `status: 'unused'` stubs pending the GS1/AI-classifier access described in Appendix B #1. This matches the MVP boundary in Section 4 — Feature B's external layers are Full-scope, not MVP.

| ID | Requirement | Priority | Note |
|----|-------------|----------|------|
| FR-010 | User enters a GTIN; system normalizes GTIN-8/12/13/14 to a 14-digit form (GTIN 입력·14자리 정규화) | P0 | Manual entry; scanner = [TBD] |
| FR-011 | System validates the GTIN check digit (modulo-10) before lookup, rejecting malformed barcodes (체크디지트 검증) | P0 | Per design doc §5.2 |
| FR-012 | User specifies the **destination country** so HS can be expanded to the country-specific 8–10 digit code (도착국 지정 → 국가별 HS 확장) | P0 | HS6 global, 8–10 digit national |
| FR-013 | **Layer 1 — internal direct mapping**: resolve GTIN→HS6 from `hsm_gtin_hs_maps` when present (즉시 직접 매핑) | P0 | Fastest, most accurate |
| FR-014 | **Layer 2 — product info**: if no direct mapping, retrieve product info (GPC Brick, description, brand) via internal master DB then external GS1 API (제품정보 조회) | P0 | GS1 dependency; key/quota required |
| FR-015 | **Layer 3 — GPC→HS mapping**: map GPC Brick to HS6 via `hsm_gpc_hs_maps`; on 1:many, return ranked candidate list (GPC→HS, 1:다 후보 처리) | P0 | priority-ordered candidates |
| FR-016 | **Layer 4 — AI classify fallback**: if GPC mapping is empty/ambiguous, infer HS via external AI classifier (e.g. Zonos/Pitney Bowes) using description, with confidence score (AI 분류 폴백) | P1 | Confidence-gated |
| FR-017 | **Country expansion**: expand resolved HS6 to the destination country's full code with duty rate via `hsm_hs_country_extensions` (HS6→국가별 8~10자리 확장) | P0 | |
| FR-018 | **Learned mapping**: persist API/AI/manual results back into `hsm_gtin_hs_maps` (source = api/learned/manual) to shortcut future lookups (학습 매핑 저장) | P1 | Self-improving cache |
| FR-019 | **Manual-review queue**: when confidence is below threshold, route to a review queue instead of auto-returning (저신뢰 → 수동검토 큐) | P1 | |
| FR-020 | **Audit trail**: persist the resolution source, confidence, and verifier for each result for customs justification (소명용 audit 로그) | P0 | source ∈ {manual, api, learned} |
| FR-021 | Cache resolved GTIN lookups to reduce external API cost/latency (조회 캐시) | P1 | |
| FR-022 | Display a legal notice that auto-classification is a recommendation; final HS responsibility rests with the importer/exporter (자동분류는 추천값, 확정책임은 화주) | P0 | Design doc §6.2 |
| FR-023 | **Third-party barcode fallback (optional path)**: on Layer 1 miss, optionally query a non-GS1 third-party barcode DB (e.g. UPCitemdb) for `category`/`description` text only — these services do not return an official GS1 GPC Brick code — and route that text into the Feature A semantic-search engine instead of the Layer 3 GPC→HS path (L1 미스 시 서드파티 바코드 DB에서 category/description만 확보 → GPC 매핑 대신 Feature A 시맨틱 검색으로 연결) | P2 | **Full scope, not MVP.** Gated by the coverage PoC (Appendix B #10) before production adoption. GPC-mapping path (FR-014/015) remains the primary Layer 2/3 when GS1 access is provisioned |

#### Feature C — Attribute / Excel-Upload Search (속성 입력 검색)

| ID | Requirement | Priority | Note |
|----|-------------|----------|------|
| FR-030 | User inputs product attributes through an on-site structured form (사이트 내 정형 양식 입력) | P0 | Fields per defined template |
| FR-031 | User can upload an Excel file following a fixed template for batch lookup (정해진 엑셀 양식 업로드로 일괄 조회) | P0 | `.xls/.xlsx` |
| FR-032 | System validates uploaded file against the template (columns, types, required fields) and reports errors per row (양식 검증 및 행별 오류 리포트) | P0 | |
| FR-033 | System analyzes each row's attributes and returns the corresponding HS code with confidence (행별 속성 분석→HS코드·신뢰도 제시) | P0 | Reuses the Feature A matching engine |
| FR-034 | User can download the result as an Excel file with HS code, confidence, and source columns appended (결과 엑셀 다운로드) | P1 | |
| FR-035 | Provide a downloadable blank template matching the required input schema (입력 양식 템플릿 다운로드 제공) | P1 | |
| FR-036 | Flag low-confidence rows for manual review (저신뢰 행 수동검토 플래그) | P2 | |

#### Common (공통)

| ID | Requirement | Priority | Note |
|----|-------------|----------|------|
| FR-040 | Maintain the HS reference table; admin imports/appends records from 면장리스트 customs report files via per-format adapters (참조표 관리·다형식 import 어댑터) | P0 | `BaoCaoHangChiTiet` + `BaoCaoToKhai`/`VMSG` variants |
| FR-041 | All three modes return a normalized result object: HS code, description, confidence, source (3모드 공통 결과 객체 정규화) | P0 | Shared result schema |
| FR-042 | Result detail view links to applicable duty/VAT rates from the reference data when available (결과 상세에 관세/부가세율 연계) | P2 | Source columns exist in corpus |
| FR-043 | Support both 8-digit and 10-digit HS codes; manage matching at the HS6 base with country extension for national digits (8/10자리 HS 지원, HS6 기준 + 국가확장) | P0 | Corpus has 8 & 10-digit codes |
| FR-044 | Deduplicate identical/near-duplicate reference rows across companies during import (회사 간 중복 행 제거) | P1 | Same HS+품명 across files |

### Non-Functional Requirements (비기능 요구사항)

| ID | Requirement | Criteria |
|----|-------------|----------|
| NFR-001 | Q&A / attribute search response time | < 2s for candidate list (P95) |
| NFR-002 | GTIN lookup response time | < 3s incl. external API (P95) |
| NFR-003 | Classification top-3 accuracy | ≥ 90% on validated reference set (target) |
| NFR-004 | Excel batch size | Up to 1,000 rows per upload [TBD] |
| NFR-005 | Multi-language input support | Korean, English, Vietnamese |
| NFR-006 | External API resilience | Graceful fallback (FR-013) when GS1 API unavailable |
| NFR-007 | Data security | HS reference & declaration data access-controlled; audit log on import/edit |
| NFR-008 | Availability | 99.5% during business hours [TBD] |

## 4. Scope Definition (범위 정의)

- **In-Scope**:
  - Three search modes (Q&A AI semantic search, GTIN lookup, attribute/Excel-upload)
  - HS reference table seeded from the 면장리스트 multi-company corpus (~94.7k rows, 808 HS codes), with per-format import adapters
  - GTIN 2-stage resolution pipeline (internal mapping → GS1 product info → GPC→HS → AI classify), incl. `hsm_gtin_hs_maps` / `hsm_gpc_hs_maps` / `hsm_hs_country_extensions` tables
  - Country-specific HS expansion (HS6 → 8–10 digit) with duty rate
  - Excel template download, validation, and result export
- **Out-of-Scope**:
  - Direct filing/submission to customs systems (통관 시스템 직접 신고) — out of scope
  - Automated duty/tax payment (관세 자동 납부)
  - Physical barcode scanner hardware integration (스캐너 하드웨어 연동) — manual entry only in v1; scanner = [TBD]
  - Official GS1-WCO GPC-HS dataset (not yet commercialized) — `hsm_gpc_hs_maps` is internally maintained until then (design doc §8)
- **MVP vs Full**:
  - **MVP (P0)**: Feature A (Q&A semantic search) + Feature C (attribute/Excel) over the seed reference table, plus reference-table import/management (FR-040/041/043). Feature B is P0 functionally but its external layers (GS1, AI classifier) depend on API access being provisioned — Layer 1 (internal direct mapping) and check-digit validation can ship independently.
  - **Full**: AI-classify fallback (FR-016), learned-mapping self-improvement (FR-018), manual-review queue (FR-019), feedback-loop learning (FR-005), explainability citations (FR-006), duty/VAT linkage (FR-042), third-party barcode fallback → semantic search (FR-023, PoC-gated).

## 5. Constraints and Assumptions (제약사항 및 가정)

- **Constraint**: Reference HS codes are **8-digit and 10-digit Vietnam codes**; matching is managed at the HS6 base with national digits handled via the country-extension table (FR-017/043). (참조 코드는 8/10자리, HS6 기준 + 국가확장 관리)
- **Constraint**: Product descriptions in the corpus are primarily Vietnamese (`Tên hàng`); semantic search must handle cross-language matching (KR/EN query → VI reference). The corpus spans many industries (auto parts, chemicals, textiles, etc.), so matching cannot assume a single product domain.
- **Constraint**: No single API returns HS directly from a GTIN; HS must be inferred via the 2-stage pipeline (design doc §1.2). GPC↔HS is **1:many**, so candidate lists and priority ordering are required.
- **Assumption**: External dependencies — **GS1 (Verified by GS1 / GS1 US/UK)** for product info and an **AI classifier (Zonos / Pitney Bowes)** for HS fallback — must be provisioned. Licensing, endpoints, rate limits, and GTIN coverage are currently **[TBD]** (design doc §7). Cost survey (2026-07-08): GS1 US Data Hub View/Use subscription $500–2,500/yr + API Add-On $6,500/yr (≈$7,000–9,000/yr all-in); GS1 Korea/Vietnam publish no online pricing and require direct inquiry.
- **Assumption**: A non-GS1 third-party barcode DB (FR-023) is a cheaper but lower-fidelity fallback for Layer 2 — no official GPC Brick, uncertain coverage for industrial/B2B goods and Vietnamese local brands (the corpus's actual product mix). Treat as **Full-scope, PoC-gated**, not a substitute for FR-014 until validated (Appendix B #10).
- **Assumption**: Import adapters are needed for the non-standard files (`BaoCaoToKhai`, `VMSG`) alongside the standard `BaoCaoHangChiTiet` parser.
- **Assumption**: A single organization's reference data is sufficient for MVP; multi-tenant isolation is [TBD]. (Corpus is already multi-company — tenant scoping policy to be decided.)
- **Assumption**: Frontend is React; state management, routing, and component library choices are deferred to the design stage. Backend resolution logic follows the Node.js design in `GTIN_HSCode_설계문서.md`.

## 6. Related Systems (연관 시스템)

| System | Role | Integration |
|--------|------|-------------|
| Verified by GS1 / GS1 US/UK API | GTIN → product info (GPC Brick, description, brand) — Layer 2 (FR-014) | External REST API (key + quota); enterprise subscription |
| AI classifier (Zonos Classify / Pitney Bowes) | HS6–HS10 inference from description — Layer 4 fallback (FR-016) | External API; confidence score |
| PostgreSQL — `hsm_gtin_hs_maps` | Layer 1 direct GTIN→HS6 mapping + learned results (FR-013/018) | Primary datastore |
| PostgreSQL — `hsm_gpc_hs_maps` | Layer 3 GPC Brick→HS6 (1:many) mapping (FR-015) | Internally maintained until GS1-WCO official set |
| PostgreSQL — `hsm_hs_country_extensions` | HS6 → national 8–10 digit + duty rate (FR-017) | Per-country extension table |
| Embedding / vector index | Semantic search backend for FR-002 | [TBD: pgvector / external vector DB] |
| 면장리스트 customs report files | Seed & periodic import of reference data (FR-040) | Admin import with per-format adapters |
| Manual-review queue + audit log | Low-confidence routing (FR-019) and customs-justification trail (FR-020) | Internal |
| Third-party barcode DB (e.g. UPCitemdb) | GTIN → category/description only, no GPC Brick — optional Layer 2 fallback into Feature A semantic search (FR-023) | External REST API; free tier for PoC (100 req/day, no signup), paid tiers ~$99–699/mo for production volume |

## 7. Success Metrics (성공 지표)

| KPI | Measurement | Target |
|-----|-------------|--------|
| Top-3 classification accuracy | Validated against known-correct HS codes in reference set | ≥ 90% |
| Avg. lookup time per item | Compare vs. manual baseline | ≥ 50% reduction |
| GTIN resolution success rate | Resolved / total GTIN queries | ≥ 80% (subject to GS1 coverage) |
| Excel batch auto-classification rate | Rows auto-classified without manual review | ≥ 70% |
| User confirmation rate | Suggestions accepted as final | ≥ 75% |

---

## Appendix A — Feature Summary (기능 요약)

| Feature | Entry point | Core flow | Primary FRs | Key dependency |
|---------|-------------|-----------|-------------|----------------|
| A. Q&A Search | Natural-language chat | AI semantic search → sequential clarifying questions → ranked HS codes | FR-001~007 | Embedding index over 면장리스트 corpus |
| B. Barcode Lookup | GTIN + destination country | Normalize/validate → L1 internal map → L2 GS1 product info (or FR-023 third-party fallback → semantic search) → L3 GPC→HS → L4 AI classify → country expand → learn/audit | FR-010~023 | **GS1 + AI classifier APIs [TBD]**; design doc pipeline; MVP ships L1+country-expand only |
| C. Attribute / Excel | Form or Excel upload | Validate template → per-row attribute analysis → HS code + export | FR-030~036 | Shared matching engine (Feature A) |

## Appendix B — Open Questions ([TBD] 목록)

1. GS1 API access — licensing, endpoint, rate limits, GTIN coverage for these product domains (design doc §7). Partial answer (2026-07-08 cost survey): GS1 US route ≈ $7,000–9,000/yr all-in (Data Hub View/Use + API Add-On); GS1 Korea/Vietnam require direct inquiry, no published rate. FR-023 (third-party fallback) is a candidate cheaper mitigation pending PoC (#10) — it is not a drop-in replacement since it skips the GPC-Brick path.
2. AI classifier choice and contract (Zonos Classify vs. Pitney Bowes) and confidence threshold for the manual-review cutoff.
3. Initial population of `hsm_gpc_hs_maps` (1:many GPC→HS) before the GS1-WCO official dataset exists.
4. Excel upload max batch size (NFR-004) and async processing threshold (corpus files reach ~28k rows).
5. Vector/embedding infrastructure choice (pgvector vs. managed vector DB) for cross-language (KR/EN→VI) semantic search.
6. Multi-tenant scoping — corpus is already multi-company; whether reference data is shared or isolated per importer.
7. Import adapters for non-standard files (`BaoCaoToKhai`, `VMSG`) and de-duplication policy across companies (FR-044).
8. Barcode scanner hardware integration timeline (manual entry only in v1).
9. Destination-country coverage for `hsm_hs_country_extensions` (which countries beyond VN/KR at launch).
10. **FR-023 coverage PoC**: before any production integration, validate GTIN hit-rate (coverage) of a candidate third-party barcode DB — start with UPCitemdb's free tier (100 req/day, no signup) against a few dozen of our own real GTIN samples (auto parts, chemicals, textiles — matching the 면장리스트 corpus's industrial/B2B mix, not just US consumer goods). No hit-rate target is set yet; define acceptance threshold once initial PoC numbers are in, then decide go/no-go for FR-023 and which paid tier (if any) to adopt.

---

*Traceability: This document's FR/NFR IDs feed Stage 2 (Requirements Definition FR-xxx → Functional Spec FN-xxx → Sequence/ERD → WBS T-xxx → Test Cases TC-xxx). Next stage: design documents (event scenario, functional spec, UI spec, sequence diagram, ERD).*
