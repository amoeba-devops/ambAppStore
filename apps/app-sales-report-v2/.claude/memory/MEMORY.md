# Memory Index — app-sales-report-v2

> Project-scoped memory. Mỗi entry là 1 pointer tới file `.md` cùng folder. Lưu các quyết định kỹ thuật, ràng buộc, "tại sao" — tránh code patterns (đã trong CLAUDE.md).

## Client & business
- [Client context — FIRGI / Socialbean Vietnam](client-context.md) — khách + SRD author + scope

## Tech decisions
- [Tech stack v2](tech-stack.md) — Turbo standalone + Next.js 15 + Neon + Drizzle + S3
- [Workspace mode](workspace-mode.md) — standalone Turborepo, không integrate vào ambAppStore root
- [ORM choice](orm-choice.md) — Drizzle thay vì Prisma cho Neon serverless
- [Formula Configuration approach](formula-config-approach.md) — 48 params DB-driven, snapshot per report

## Active plan
- ⭐ [PLAN-20260512 UI MVP](../../docs/plan/PLAN-20260512-ui-mvp.md) — 11 screens, 9 foundation tasks + 6 features (~64-94h), Sprint 1: foundation → Sprint 2: F-1/2/3 → Sprint 3: F-4/5/6

## Business rules (resolved)
- [Final decisions — 6 questions resolved](final-decisions.md) ⭐ — design Q-A đến Q-F: chọn simple/effective
- [FX rate — VND/KRW](open-fx-rate.md) — default 17,543 VND/KRW, configurable
- [OI-001 + OI-002 resolutions](oi-resolutions.md) — Overwrite + Hybrid finalize (auto + Admin unfinalize)
- [Allocation hierarchy](allocation-hierarchy.md) — Cross-platform theo GMV, intra-platform theo NMV
- [File structure reality](file-structure-reality.md) — 2 consolidated CSV (Shopee 6 sections, TikTok 5)

## Open questions (chỉ còn 1 — không block MVP)
- [Open: data migration from v1](open-data-migration.md) — fresh start hay import? (Phase 2 quyết)
- ~~[Hosting]~~ ✅ resolved — Render.com (xem [open-hosting.md](open-hosting.md))
