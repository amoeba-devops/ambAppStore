---
document_id: HSCODE-MGR-POL-1.0.0
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
    description: Initial draft — policy definition
---

# HS Code Manager — Policy Definition (HS코드 매니저 정책 정의서)

## POL-001: Confidence Threshold & Routing (신뢰도 임계·라우팅)
- **Purpose**: Decide when to auto-return vs. ask a question vs. route to manual review.
- **Scope**: Q&A (FR-003), AI classify (FR-016), Excel flagging (FR-036).
- **Rules**:
  - Q&A: top1−top2 score gap `< gap_threshold` → ask clarifying question (max 5 rounds).
  - Barcode L4: `confidence < review_threshold` → manual-review queue (FR-019).
  - Excel: row `confidence < flag_threshold` → flag for review (FR-036).
- **Defaults [TBD]**: gap_threshold = 0.08, review_threshold = 0.70, flag_threshold = 0.70.
- **Exception**: Direct mapping (Layer 1) bypasses thresholds.

## POL-002: Classification Responsibility & Legal Notice (분류 책임·법적 고지)
- **Purpose**: Auto-classification is a recommendation, not a legal determination.
- **Rules**: Every barcode/Q&A/Excel result displays a notice that the final HS code confirmation responsibility rests with the importer/exporter (화주). (Design doc §6.2)
- **Scope**: All result views (FR-022, SCR-004).

## POL-003: Audit & Data Retention (감사·데이터 보존)
- **Purpose**: Preserve justification for customs inquiries.
- **Rules**:
  - Every resolution writes an immutable `hsm_resolution_audits` row (source, confidence, country, verifier) (FR-020).
  - Retention period: [TBD] (suggest ≥ 5 years for customs records).
  - Audit rows are append-only; no hard delete.

## POL-004: External API Usage, Caching & Rate Limiting (외부 API·캐싱·레이트리밋)
- **Purpose**: Control cost/latency of GS1 and AI-classifier calls.
- **Rules**:
  - Internal master / `hsm_gtin_hs_maps` checked before any external call.
  - Cache key = GTIN(+country); TTL [TBD]; learned write-back shortcuts future calls (FR-018/021).
  - Per-provider rate limits respected; on quota/timeout → graceful fallback (NFR-006).

## POL-005: Access Control & Multi-tenancy (접근 제어·멀티테넌시)
- **Purpose**: Protect reference and declaration data.
- **Rules**:
  - Admin import/mapping editing and review queue are role-restricted (NFR-007).
  - Reference corpus is multi-company; tenant scoping (shared vs. isolated) = [TBD].
  - Audit log access limited to authorized roles.

## Common Policies (공통 정책)
- **HS digit policy**: matching at HS6 base; national 8–10 digits via `hsm_hs_country_extensions` (FR-043).
- **GPC→HS source**: internally maintained `hsm_gpc_hs_maps` until GS1-WCO official dataset commercialized (design doc §8).
- **Dedupe policy**: import key = HS + normalized description + origin + unit (FR-044).
