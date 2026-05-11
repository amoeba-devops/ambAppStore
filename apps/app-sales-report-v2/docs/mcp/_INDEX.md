---
title: MCP Index
description: Model Context Protocol setup — Neon DB integration for Claude to query schema/data during dev.
load-when: Setting up Claude tooling / debugging "why can't Claude see DB schema" / before granting DB access to Claude.
---

# MCP (Model Context Protocol)

> Allow Claude to query Neon DB schema + sample data during development. **Dev-only**, never grant prod access.

## Files

| File | When to read | Status |
|---|---|---|
| [neon-setup.md](neon-setup.md) | First-time setup of `mcp-server-neon` on dev machine | ready |
| [safety-rules.md](safety-rules.md) | Before connecting Claude to ANY production DB | ready |

## TL;DR

- **What**: MCP servers expose tools to Claude (run_sql, list_branches, etc.)
- **Why for v2**: Claude can inspect schema, run analytical queries during dev → faster iteration than copy-pasting DDL
- **Setup**: Neon official `mcp-server-neon` (Node.js)
- **Safety**: dev branch only, read-only mode for prod (or no connection at all)

## See also

- [docs/_NAV.md](../\_NAV.md)
- [architecture/DEPLOYMENT.md](../architecture/DEPLOYMENT.md) — Neon branching strategy
- [.claude/skills/drizzle-neon/SKILL.md](../../.claude/skills/drizzle-neon/SKILL.md) — Drizzle conventions
- Neon docs: https://neon.tech/docs/ai/neon-mcp-server
