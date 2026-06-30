---
document_id: HSCODE-MGR-UISPEC-1.0.0
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
    description: Initial draft — UI specification (screens)
---

# HS Code Manager — UI Specification (HS코드 매니저 화면 기획서)

## Screen List (화면 목록)

| Screen ID | Name | Route | Note |
|-----------|------|-------|------|
| SCR-001 | Q&A Search (질문응답 검색) | /search/qa | Chat-style |
| SCR-002 | Barcode Lookup (바코드 조회) | /search/barcode | GTIN + country |
| SCR-003 | Attribute / Excel (속성/엑셀) | /search/attribute | Form + upload |
| SCR-004 | Result Detail (결과 상세) | /result/:id | Shared by all modes |
| SCR-005 | Admin: Import & Review (관리: 가져오기/검토) | /admin | Reference import + review queue |

---

## SCR-001: Q&A Search (질문응답 검색)

### Layout
```
+--------------------------------------------------+
|  HS Code Manager      [Q&A] [Barcode] [Attribute]|
+--------------------------------------------------+
|  chat transcript (user / system bubbles)         |
|   - system clarifying questions                  |
|   - candidate cards (HS | desc | conf | source)  |
|                                                  |
+--------------------------------------------------+
|  [ describe your product...        ] [ Send ]    |
+--------------------------------------------------+
```

### Components
| Element | Type | Description | Behavior |
|---------|------|-------------|----------|
| Chat input | Input | Free-text product description | Enter/Send → POST /api/v1/qa/search (FR-001) |
| Typing indicator | Status | Shown during search | Appears < 300ms |
| Clarifying question | Bubble | One question at a time | Inline answer → refine (FR-003) |
| Candidate card | Card | HS code, description, origin, unit, confidence %, source link | Click → SCR-004 (FR-004/006) |
| Confirm button | Button | Lock the final HS | Writes hsm_query_logs (FR-005) |

### Interactions
- Loading: skeleton bubbles. Error: retry button. Empty: "no confident match → try Attribute form" CTA.

### Responsive
- Desktop: two-pane (chat + candidate detail). Mobile: single column, candidates stacked.

### Frontend Framework
- **React** + NestJS. State: Zustand (session/turns) + React Query. Routing: React Router. Streaming via SSE for clarifying turns.

---

## SCR-002: Barcode Lookup (바코드 조회)

### Layout
```
+--------------------------------------------------+
|  GTIN [______________]  Country [VN v]  [Resolve] |
+--------------------------------------------------+
|  Result panel                                    |
|   HS6  ->  HS_full (national)   Duty: x%         |
|   Source: direct / gpc / api    Confidence: yy%  |
|   [ Legal notice: recommendation only ]          |
+--------------------------------------------------+
```

### Components
| Element | Type | Description | Behavior |
|---------|------|-------------|----------|
| GTIN field | Input | 8/12/13/14-digit | Normalize + check digit (FR-010/011); inline invalid state |
| Country select | Dropdown | ISO 3166 | Required before resolve (FR-012) |
| Resolve button | Button | Trigger pipeline | POST /api/v1/gtin/resolve |
| Result panel | Panel | HS_full, duty, source, confidence | From 4-layer pipeline (FR-013~017) |
| Legal notice | Banner | Final responsibility on importer | Always visible (FR-022) |
| Pending-review note | Alert | Shown when low-confidence | "routed to review" (FR-019) |

### Interactions
- Invalid check digit → field error, no API call. GS1/unknown → fallback CTA to Attribute/Q&A (FR-013 fallback).

### Responsive / Framework
- React. Scanner input out of scope v1 (manual entry). Cache hits render instantly (FR-021).

---

## SCR-003: Attribute / Excel (속성/엑셀)

### Layout
```
+-------------------+   +----------------------------+
|  Attribute form   |   |  OR  Excel upload          |
|  name, material,  |   |  [ Drop .xlsx ] [Template] |
|  usage, origin,   |   |  validation report area    |
|  unit ...         |   |  results table             |
|  [Classify]       |   |  [Download results]        |
+-------------------+   +----------------------------+
```

### Components
| Element | Type | Description | Behavior |
|---------|------|-------------|----------|
| Attribute form | Form | Structured fields | Submit → matching engine (FR-030/033) |
| Upload dropzone | Upload | .xls/.xlsx fixed template | Validate (FR-031/032) |
| Template download | Link | Blank schema | (FR-035) |
| Validation report | Table | Row/col/reason errors | On invalid file |
| Results table | Table | Row + HS + confidence + source; low-confidence flagged | (FR-033/036) |
| Download results | Button | Export workbook | (FR-034) |
| Progress bar | Status | Async batch progress | Large files via queue |

### Responsive / Framework
- React; large uploads processed async (Redis Queue (BullMQ)). Mobile: form first, upload below.

---

## SCR-004: Result Detail (결과 상세)

| Element | Type | Description |
|---------|------|-------------|
| HS header | Header | HS_full + HS6 + country |
| Attributes | List | description, origin, unit, duty/VAT (FR-042) |
| Source citations | List | reference rows / resolution source (FR-006/020) |
| Confidence | Badge | % with band color |
| Legal notice | Banner | recommendation only (FR-022) |

---

## SCR-005: Admin — Import & Review (관리)

| Element | Type | Description | Behavior |
|---------|------|-------------|----------|
| File import | Upload | 면장리스트 files | Adapter dispatch (FR-040); shows batch summary |
| Batch list | Table | total/imported/failed per file | From hsm_import_batches |
| Review queue | Table | pending GTINs + candidates | Approve/assign → learned mapping (FR-018/019) |
| Mapping editor | Form | hsm_gtin_hs_maps / hsm_gpc_hs_maps / hsm_hs_country_extensions entries | Manual verify (source=manual) |

### Framework
- React admin; role-restricted (NFR-007).
