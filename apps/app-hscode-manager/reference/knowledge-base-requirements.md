---
document_id: CGR-KB-REQ-001
version: 1.0.0
status: Draft
created: 2026-07-10
updated: 2026-07-10
author: Amoeba AX Team (아메바컴퍼니 AX팀)
reviewers: []
project_code: CGR (Cargorush)
table_prefix: cgr_kb_ (domain: kb = Knowledge Base)
convention_ref: amoeba-code-convention-v2.md
related_docs:
  - hscode-classification-agent-requirements.md (HS Agent — RAG corpus / cgr_hs_documents linkage)
  - knowledge-base-dev-plan.md (Development Plan & WBS)
change_log:
  - version: 1.0.0
    date: 2026-07-10
    author: Amoeba AX Team
    description: Initial requirements analysis for the [Knowledge Base] project menu (board-type reference library + admin-editable dashboard)
---

# Cargorush Knowledge Base — Requirements Analysis (카고러쉬 지식창고 요구사항 분석서)

This document specifies the **[Knowledge Base] (지식창고)** menu added to the Cargorush HS Code Agent
project — a board-type reference library where customs/logistics staff accumulate, search, and share
static reference material (주요국 HS Code 기준표, HS Code 상식, 수출입 통관 기초 정보), operated with an
**admin-editable dashboard**. It is organized along two axes per project directive: **Concept (what /
why)** and **Design (data & flow structure)**.

Scope note: this is a **new, self-contained project menu**, not a change to the HS Agent's existing
requirements. The one deliberate linkage point is the RAG promotion path (FR-KB-014), which registers a
Knowledge Base post into the HS Agent's `cgr_hs_documents` corpus.

---

# Part A. Concept (개념)

## A1. What This Menu Is (메뉴 정의)

A **human-curated reference library** operated as a searchable board, sitting alongside the HS Agent's
dynamic outputs (품목 분류 / 추천 이력). Where the agent produces *judgment results*, the Knowledge Base
holds *reference knowledge* that people read: national HS code tables, HS classification common
knowledge, and import/export clearance basics.

**Distinction from the HS Agent RAG corpus (경계 명확화):**

| | Knowledge Base (this doc) | RAG Corpus (`cgr_hs_documents`/`cgr_hs_chunks`) |
|---|---|---|
| Reader | Human staff (게시판 열람) | The agent (embedding retrieval) |
| Form | Board posts + attachments | Chunked, embedded documents |
| Curation | Manual, admin-authored | Ingested + chunked |

The two stores stay **separated** (per HS Agent requirements §B7 storage-separation principle), with a
one-way **promotion bridge** (A-post → RAG document) exposed to admins (FR-KB-014).

## A2. Content Categories (콘텐츠 카테고리)

| Category (카테고리) | Content example (내용 예시) |
|---|---|
| National HS Code tables (주요국 HS Code 기준표) | Vietnam 8-digit / Korea 10-digit / China 10–13-digit / WCO 6-digit cross-reference tables |
| HS Code common knowledge (HS Code 상식) | Essential character, content-ratio thresholds, degree-of-processing, heading/subheading concepts |
| Import/export clearance basics (수출입 통관 기초) | FTA/origin, pre-ruling (사전심사) procedure, customs-broker / customs review flow |
| Notice (공지) | Regulation changes, HS version updates, system updates |
| Key tips (주요 팁) | Practical know-how, frequently-misclassified cases |

## A3. User Roles and Permissions (사용자 권한)

Roles follow Amoeba Code Convention v2 §5.7 (authentication decorator stack) and §12.3 (user levels).

| Level | Permissions |
|---|---|
| General user (USER_LEVEL) | Read, search, download attachments, request on-demand translation |
| Admin (ADMIN_LEVEL) | All of the above + post CRUD, **dashboard (notice/tip) editing**, category management, file upload, RAG promotion |

Confirmed decision: dashboard editing is **allowed for all ADMIN_LEVEL users** (no per-Cell
sub-scoping). Read APIs use `@Auth()`; edit APIs use `@AdminOnly()`.

## A4. Confirmed Design Decisions (확정된 설계 결정)

The following were open items in the initial proposal and are now **confirmed**:

| Item | Confirmed decision | Requirement impact |
|---|---|---|
| RAG corpus linkage (RAG 연동 범위) | **Post→RAG promotion included in MVP** | FR-KB-014 (P1) |
| National-table data source (기준표 출처) | **Admin file upload** (Vietnam 8-digit, KR/CN extended tables uploaded as files) | FR-KB-011 |
| Multilingual support (다국어) | **Single-language authoring + on-demand translation** across ko / en / vi / **id (Indonesian)** | FR-KB-008, FR-KB-009 |
| Dashboard edit permission (편집 권한) | **All ADMIN_LEVEL** (no Cell-level split) | FR-KB-005 |
| Attachment policy (첨부 정책) | PDF / Excel etc. allowed, **max 50MB** | FR-KB-012, NFR-KB-004 |

## A5. Multilingual Principle — Single-Author, On-Demand Translation (다국어 원칙)

Confirmed authoring model: **the author writes in ONE language; readers translate on demand.**

- The author writes a post in a single source language (`pst_source_lang` ∈ {ko, en, vi, id}).
- The post detail screen exposes a **translation box**; a reader selects a target language and the
  system returns a translation.
- **Indonesian (id)** is added on top of the convention's standard ko/en/vi (§14). This is a
  **Cargorush project-local extension**, not an edit to Convention v2's standard — recorded here and
  in the project directive, not by amending the shared convention document.
- This model deliberately avoids parallel multilingual authoring columns (`*_ko/_en/_vi/_id`), removing
  authoring burden and simplifying the schema (see B2).

## A6. Output / Interaction Principles (출력·상호작용 원칙)

- **Notice** and **Key tips** on the dashboard are **admin-editable in place** (inline edit toggle),
  not through a separate admin page — reduces edit friction.
- Search covers **title, body, HS code, and tags**, and must remain useful across the 4 languages
  (index-level multilingual support, distinct from per-post translation in A5).
- "Confirmed reference" vs. "internal tip/heuristic" distinction from the HS Agent policy carries over:
  a Key tip is operational know-how, never presented as an official rule.

## A7. Functional Requirements (기능 요구사항, FR)

| ID | Requirement | Priority | Note |
|---|---|---|---|
| FR-KB-001 | Board post list per category with pagination | P0 | A2 categories |
| FR-KB-002 | Post detail view with attachments and related posts | P0 | |
| FR-KB-003 | Post create/edit/delete (admin) with soft delete | P0 | `@AdminOnly()` |
| FR-KB-004 | Integrated search across title/body/HS code/tags with filters (country, category, tag) | P0 | FR to NFR-KB-002 |
| FR-KB-005 | Admin-editable dashboard — Notice block (add/delete/reorder inline) | P0 | All ADMIN_LEVEL (A3) |
| FR-KB-006 | Admin-editable dashboard — Key tips block (add/delete/**drag-reorder** cards) | P0 | `dsb_sort_order` |
| FR-KB-007 | Dashboard landing: category shortcuts + latest + popular lists | P0 | |
| FR-KB-008 | Single-language post authoring with `pst_source_lang` capture | P0 | A5 |
| FR-KB-009 | On-demand translation box (target lang ko/en/vi/id) with translation caching | P1 | A5, NFR-KB-003 |
| FR-KB-010 | Post pinning (상단 고정) and view-count tracking | P1 | `pst_is_pinned`, `pst_view_count` |
| FR-KB-011 | Admin file upload for national HS code reference tables | P0 | Confirmed source = upload |
| FR-KB-012 | Attachment upload/download (PDF/Excel etc.), max 50MB, format whitelist | P0 | NFR-KB-004 |
| FR-KB-013 | Tag management (country / HS chapter tags) and post-tag mapping | P1 | |
| FR-KB-014 | Promote a post to the HS Agent RAG corpus (`cgr_hs_documents`) | P1 | Admin; bridges to HS Agent §B7 |
| FR-KB-015 | Category management (create/rename/reorder, admin) | P2 | |

## A8. Non-Functional Requirements (비기능 요구사항, NFR)

| ID | Requirement | Criteria |
|---|---|---|
| NFR-KB-001 | Multi-tenant isolation (멀티테넌시 격리) | Every table carries `ent_id`; `@Auth()` + `OwnEntityGuard` enforce entity isolation (§2.3/§12) |
| NFR-KB-002 | Search index multilingual support (검색 다국어) | Search operates across ko/en/vi/id content; index tokenization handles all four |
| NFR-KB-003 | Translation cache (번역 캐시) | Same post+target-lang returns cached translation; miss triggers translation then caches |
| NFR-KB-004 | Attachment limit (첨부 제한) | Reject >50MB; enforce format whitelist (pdf, xlsx, xls, docx, csv); store in object storage, DB holds path only |
| NFR-KB-005 | Convention compliance (컨벤션 준수) | All tables/columns/files/APIs follow Amoeba Code Convention v2 (§4, §5, §8) — see Part E |
| NFR-KB-006 | Audit & soft delete (감사·소프트삭제) | `_created_at`/`_updated_at` on all tables; `pst_deleted_at` soft delete |

## A9. Out of Scope — Requires Confirmation (범위 밖, 확인 필요)

Not decided; do not implement without confirmation.

- Whether post authoring must eventually support parallel manual translations (vs. on-demand only)
- Whether Indonesian (id) should be promoted into Convention v2 standard vs. remaining project-local
- Post-level access control finer than entity isolation (e.g., Cell-scoped posts)
- Version history / revision diff on posts (currently soft-delete only, no revision log)
- Comment / discussion threads on posts

---

# Part B. Design (설계)

## B1. Screen Map (화면 구조)

Screen IDs per convention ID system (SCR).

| Screen ID | Name | Access | Note |
|---|---|---|---|
| SCR-KB-01 | Dashboard (landing) — notice / tips / categories / latest / popular | `@Auth()` (edit: `@AdminOnly()`) | Admin inline edit |
| SCR-KB-02 | Board list (per category) — search + filters | `@Auth()` | Pagination |
| SCR-KB-03 | Post detail — body + translation box + attachments | `@Auth()` | RAG promote button = admin |
| SCR-KB-04 | Post create/edit — single-language authoring + file upload | `@AdminOnly()` | |
| SCR-KB-05 | Category / tag management | `@AdminOnly()` | |

## B2. Core Entities (핵심 엔터티)

> Naming per Amoeba Code Convention v2 §4. Project code **CGR**, DB **`db_cgr`**, this menu's table
> prefix **`cgr_kb_`** (domain = kb / Knowledge Base). Every table carries `ent_id` (§2.3/§12), a
> `{colPrefix}_id` UUID PK, and `{colPrefix}_created_at` / `{colPrefix}_updated_at` (§4.3). Boolean
> columns use `{colPrefix}_is_{name}` (§4.3), never a bare `*_flag`.

| Entity (개념) | Table (§4.2) | colPrefix (§4.3) | Entity Class (§5.2) | Key columns |
|---|---|---|---|---|
| Post | `cgr_kb_posts` | `pst_` | `PostEntity` | `pst_title`, `pst_content`, `pst_source_lang`, `pst_category_id`(FK), `pst_is_pinned`, `pst_view_count`, `pst_is_promoted_to_rag`, `pst_promoted_doc_id`, `pst_deleted_at` |
| Post translation cache | `cgr_kb_post_translations` | `ptr_` | `PostTranslationEntity` | `pst_id`(FK), `ptr_target_lang`, `ptr_translated_title`, `ptr_translated_content`, `ptr_source`(AI/MANUAL), `ptr_translated_at` |
| Category | `cgr_kb_categories` | `cat_` | `CategoryEntity` | `cat_name`, `cat_sort_order`, `cat_dot_color` |
| Attachment | `cgr_kb_attachments` | `att_` | `AttachmentEntity` | `pst_id`(FK), `att_file_path`, `att_file_name`, `att_file_size`, `att_mime_type`, `att_file_ext` |
| Dashboard block | `cgr_kb_dashboard_blocks` | `dsb_` | `DashboardBlockEntity` | `dsb_block_type`(NOTICE/TIP), `dsb_title`, `dsb_body`, `dsb_flag_label`, `dsb_sort_order`, `dsb_is_active` |
| Tag | `cgr_kb_tags` | `tag_` | `TagEntity` | `tag_name`, `tag_type`(COUNTRY/HS_CHAPTER) |
| Post-tag map | `cgr_kb_post_tags` | `ptg_` | `PostTagEntity` | `pst_id`(FK), `tag_id`(FK) |

> **Why a translation cache table (별도 캐시 테이블 이유)**: A5's single-author + on-demand model means
> translations are generated at read time. Caching by (`pst_id`, `ptr_target_lang`) avoids re-calling the
> translation engine on every view. `ptr_source` distinguishes machine (AI) from human-corrected (MANUAL)
> translations so a corrected translation is never overwritten by a machine pass.

> **Nullable-column note (§2.4/§5.5)**: `pst_promoted_doc_id` (UUID, nullable — set only after RAG
> promotion) requires explicit TypeORM `type: 'uuid'` to avoid `DataTypeNotSupportedError`. Same applies
> to any nullable union-typed column; flagged in the companion schema.sql.

## B3. RAG Promotion Bridge (RAG 승격 연결) — FR-KB-014

The single intentional coupling to the HS Agent domain.

```
cgr_kb_posts (a curated post)
   │  admin clicks "Promote to RAG corpus" (SCR-KB-03, @AdminOnly)
   ▼
POST /api/v1/knowledge-base/posts/:postId/promote-to-rag
   │  Service creates a cgr_hs_documents row (doc_type, doc_title, doc_summary, doc_file_path…)
   ▼
cgr_hs_documents.doc_id  ──stored back──►  cgr_kb_posts.pst_promoted_doc_id
                                           cgr_kb_posts.pst_is_promoted_to_rag = true
```

Cross-domain access goes **through Service/API only** — the KB module never imports the HS Agent's
Repository/Entity directly (§2.2 domain isolation). Chunking/embedding of the promoted document is the
HS Agent's responsibility (its §B5), not the KB module's.

## B4. Search Design (검색 설계) — FR-KB-004

- Query targets: `pst_title`, `pst_content`, HS codes appearing in body/tags, and `cgr_kb_tags.tag_name`.
- Filters (combinable): country (VN/KR/CN/WCO via `tag_type=COUNTRY`), category (`cat_id`), tag.
- Multilingual: index tokenization must handle ko/en/vi/id (NFR-KB-002). Translation cache content
  (`cgr_kb_post_translations`) is **not** the primary search target in MVP — search runs on source
  content; translated-content search is a candidate follow-up (Part C).

## B5. Attachment Handling (첨부 처리) — FR-KB-012 / NFR-KB-004

| Rule | Value |
|---|---|
| Max size | 50 MB (reject above; error code in `E5xxx` domain range, §9.1 — e.g. `E5301` size exceeded) |
| Format whitelist | pdf, xlsx, xls, docx, csv (extend on confirmation) |
| Storage | Object storage; DB stores `att_file_path` only (consistent with `doc_file_path` in HS Agent §B7) |
| Metadata | `att_file_size` (BIGINT bytes), `att_mime_type`, `att_file_ext` |

## B6. Screen Interaction Notes (화면 상호작용) — mirrors the prototype

- **SCR-KB-01 Notice**: `[✎ 편집]` toggles inline edit → add via input row / delete via ×.
- **SCR-KB-01 Key tips**: edit mode enables card **drag-reorder** → persists `dsb_sort_order`.
- **SCR-KB-03 translation box**: shows `원문: {source_lang}`, target-lang selector (en/vi/id/ko);
  cache hit returns stored translation, miss calls translation engine then caches.
- Role toggle in the prototype visualizes the `@Auth()` vs `@AdminOnly()` boundary.

## B7. Frontend / Backend Stack (기술 스택)

Per Amoeba Code Convention v2 §1.2 (this project overrides the skill's AmoebaTalk default stack):

| Layer | Tech |
|---|---|
| Frontend | React 18 + TypeScript + TailwindCSS (Zustand + React Query; entityId in QueryKey per §6.1) |
| Backend | NestJS 10 + TypeScript (Clean Architecture + DDD) |
| DB | PostgreSQL 15 (`db_cgr`) |
| Translation engine | Anthropic Claude API (§1.2 standard AI stack) |
| Object storage | For attachments (§B7 HS Agent parity) |

---

# Part C. Open Items Requiring Confirmation (확인 필요 사항)

| Item | Why confirmation is needed |
|---|---|
| Indonesian (id) standardization | Amend Convention v2 to include id, or keep as Cargorush project-local? (doc-management divergence) |
| Translated-content search | MVP searches source content only; should translation cache be searchable too? |
| Post revision history | Currently soft-delete only; is edit-history/diff required? |
| Comments / threads on posts | Not in scope; confirm whether needed |
| RAG promotion re-sync | If a promoted post is later edited, should the linked `cgr_hs_documents` row auto-update? |

---

# Part D. Priority Roadmap (우선순위 로드맵)

| Priority | Item | Rationale |
|---|---|---|
| 1 | Schema (`cgr_kb_*`) + category/post CRUD + board list/detail (SCR-KB-02/03/04) | Data backbone + core board |
| 2 | Admin dashboard editing — notice + tips inline/drag (SCR-KB-01, FR-KB-005/006) | The headline admin capability |
| 3 | Integrated search + filters (FR-KB-004) | Core usability of a reference library |
| 4 | Attachment upload/download 50MB + national-table upload (FR-KB-011/012) | Confirmed data-source path |
| 5 | On-demand translation box + cache (FR-KB-008/009, ko/en/vi/id) | Multilingual reader support |
| 6 | RAG promotion bridge (FR-KB-014) | Links curated knowledge into the HS Agent corpus |

---

# Part E. Amoeba Code Convention Mapping (코드 컨벤션 적용 매핑)

Project code **CGR** · DB **`db_cgr`** (§4.1) · table prefix **`cgr_kb_`**.

| Entity | Table (§4.2) | colPrefix (§4.3) | Entity Class (§5.2) | File (§5.1) | API Resource (§8.1, kebab-case §8.4) |
|---|---|---|---|---|---|
| Post | `cgr_kb_posts` | `pst_` | `PostEntity` | `post.entity.ts` | `/api/v1/knowledge-base/posts` |
| Post translation | `cgr_kb_post_translations` | `ptr_` | `PostTranslationEntity` | `post-translation.entity.ts` | `/api/v1/knowledge-base/posts/:postId/translations` |
| Category | `cgr_kb_categories` | `cat_` | `CategoryEntity` | `category.entity.ts` | `/api/v1/knowledge-base/categories` |
| Attachment | `cgr_kb_attachments` | `att_` | `AttachmentEntity` | `attachment.entity.ts` | `/api/v1/knowledge-base/posts/:postId/attachments` |
| Dashboard block | `cgr_kb_dashboard_blocks` | `dsb_` | `DashboardBlockEntity` | `dashboard-block.entity.ts` | `/api/v1/knowledge-base/dashboard-blocks` |
| Tag | `cgr_kb_tags` | `tag_` | `TagEntity` | `tag.entity.ts` | `/api/v1/knowledge-base/tags` |
| Post-tag map | `cgr_kb_post_tags` | `ptg_` | `PostTagEntity` | `post-tag.entity.ts` | (internal join — not a standalone REST resource) |

**Carried-over convention rules that apply directly:**
- Every table gets `ent_id` (§2.3/§12); `@Auth()` + `OwnEntityGuard` at Controller layer (§5.3, §12.1).
- Request DTO `snake_case`, Response DTO `camelCase` (§5.4/§8.4).
- Nullable TypeORM columns (`pst_promoted_doc_id`, etc.) declare explicit `type:` (§2.4/§5.5).
- Backend module path: `apps/api/src/domains/knowledge-base/{post,category,attachment,dashboard-block,
  tag}/...` (§3.1). One NestJS domain module; cross-domain (→ HS Agent) via Service/API only (§2.2).
- All UI text via i18n; QueryKey includes entityId (§6.1). Frontend i18n languages: ko/en/vi/**id**.
- Full DDL (`pk_/fk_/idx_/uq_` per §4.4) to be delivered as `knowledge-base-erd.md` +
  `knowledge-base-schema.sql` (next design-stage artifacts).
