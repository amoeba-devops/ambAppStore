---
title: Docs Navigation Hub
description: Master navigation for all technical docs. Read this first when looking for any docs/.
load-when: User mentions any technical concept and you don't know which file covers it.
---

# Docs Navigation

> **Pattern**: Hub-and-spoke. CLAUDE.md → this NAV → folder `_INDEX.md` → individual file.
> **Goal**: Claude reads minimum tokens to find right context. Each file is single-concern, < 300 lines.

## Folder map

| Folder | What's inside | Read INDEX when |
|---|---|---|
| [analysis/](analysis/) | Requirements, SRD, audits, findings | Need WHAT to build / WHY decisions |
| [architecture/](architecture/_INDEX.md) | System design, layers, request flow, data model | Need HOW system fits together |
| [component-style/](component-style/_INDEX.md) | UI patterns: tokens, forms, tables, charts, states | Building UI components |
| [system-design/](system-design/_INDEX.md) | Cross-cutting: Server Actions, API routes, jobs, storage | Implementing backend feature |
| [mcp/](mcp/_INDEX.md) | Model Context Protocol — Neon DB integration for Claude | Setting up dev tooling / querying DB during dev |
| [plan/](plan/) | Work breakdown PLAN-* | Reviewing roadmap / sprints |
| [test/](test/) | TC-* test cases, TR-* test reports | Writing or running tests |
| [implementation/](implementation/) | RPT-* completion reports | After feature done |
| [log/](log/) | Daily session logs (gitignored) | Cross-session continuity |

## Convention rules (for writers)

1. **No big-bang single doc** — split by single concern, target <300 lines per file
2. **Frontmatter required**:
   ```yaml
   ---
   title: Short title
   description: 1-line for Claude relevance judgment (≤120 chars)
   load-when: Specific trigger ("when implementing X", "before adding Y")
   status: skeleton | draft | ready
   ---
   ```
3. **Cross-link aggressively** — every "See also" section at bottom
4. **Examples > prose** — show code with ✅ ❌ markers
5. **Anti-patterns** explicit at end
6. **No restating** — link to source-of-truth, don't duplicate

## Reading order for new Claude sessions

1. Read [CLAUDE.md](../CLAUDE.md) (auto-loaded)
2. Read this `_NAV.md` if unsure where to look
3. Read folder `_INDEX.md` for the relevant domain
4. Read 1-2 specific files for the task

**Avoid**: reading all files upfront. Lazy-load.

## Status legend (in frontmatter)

- `skeleton` — outline + frontmatter only, fill content when implementing
- `draft` — partial content, has examples but may be incomplete
- `ready` — fully usable reference

## See also

- [CLAUDE.md](../CLAUDE.md) — project entry
- [.claude/skills/](../.claude/skills/) — auto-loaded skills (different from docs)
- [.claude/memory/](../.claude/memory/) — persistent decisions (different from docs)
