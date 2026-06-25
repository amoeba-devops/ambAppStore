---
title: Neon MCP Server Setup
description: Install + configure Neon Model Context Protocol server so Claude can introspect DB schema during dev.
load-when: First time setup / Claude reports "can't see Neon DB" / want Claude to run analytical queries.
status: ready
---

# Neon MCP Server Setup

> **Goal**: Claude gets read access to Neon dev branch để introspect schema, run query thử, generate Drizzle types. KHÔNG dùng cho production data.

## 1. What is MCP?

Model Context Protocol (MCP) — Anthropic-standard cho phép Claude gọi tool từ external server. Neon publish official MCP server (`@neondatabase/mcp-server-neon`) expose 8+ tools:

| Tool | What it does |
|---|---|
| `list_projects` | List Neon projects under your account |
| `list_branches` | List branches (main, dev, preview) |
| `describe_schema` | Get table/column DDL |
| `run_sql` | Execute SELECT query (read-only mode) |
| `create_branch` | Spin ephemeral branch (e.g., for test) |
| `delete_branch` | Cleanup |
| `get_connection_string` | Returns DATABASE_URL for a branch |
| `prepare_database_migration` | Stage a migration via temp branch |

→ Full list: https://neon.tech/docs/ai/neon-mcp-server

## 2. Prerequisites

| Need | How |
|---|---|
| Neon account + project | https://console.neon.tech, project `app-sales-report-v2` |
| Neon API key | Console → Account Settings → API Keys → Create (scope: project-level if possible) |
| Node.js 18+ | `node --version` |
| Claude Code (or Desktop) | Already installed |

**⚠️ API key scope**: Tạo key chỉ cho project v2, KHÔNG dùng account-wide key.

## 3. Install

Có 2 cách:

### Option A — `npx` (recommended, không cài global)

Add vào Claude config (xem §4), `npx` tự fetch latest mỗi lần.

### Option B — global install

```bash
npm install -g @neondatabase/mcp-server-neon
```

Sau đó reference path trong config.

## 4. Configure Claude

### Claude Code (VSCode extension)

File: `~/.claude/mcp.json` (Windows: `C:\Users\<you>\.claude\mcp.json`)

```json
{
  "mcpServers": {
    "neon": {
      "command": "npx",
      "args": ["-y", "@neondatabase/mcp-server-neon", "start"],
      "env": {
        "NEON_API_KEY": "napi_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
      }
    }
  }
}
```

Reload Claude Code → MCP server connect → tools available.

### Claude Desktop (Mac/Windows app)

`File → Settings → Developer → Edit Config` → same JSON format above.

### Project-scoped (recommended cho v2)

Tạo `apps/app-sales-report-v2/.claude/mcp.json` để config CHỈ áp dụng khi mở folder này:

```json
{
  "mcpServers": {
    "neon-v2": {
      "command": "npx",
      "args": ["-y", "@neondatabase/mcp-server-neon", "start"],
      "env": {
        "NEON_API_KEY": "${NEON_API_KEY_V2}"
      }
    }
  }
}
```

Set env var trong shell:
```bash
# Windows PowerShell
$env:NEON_API_KEY_V2 = "napi_..."

# Bash
export NEON_API_KEY_V2="napi_..."
```

→ KHÔNG commit `mcp.json` nếu chứa key. Add vào `.gitignore`:
```
.claude/mcp.json
```

## 5. Verify

Sau khi reload Claude:
1. Ask Claude: "List projects in Neon"
2. Claude should call `list_projects` tool → return JSON list
3. Ask: "Show schema of sal_skus table"
4. Claude calls `describe_schema` or `run_sql` → return DDL

Nếu lỗi: check `Claude logs` panel cho stderr từ MCP server.

## 6. Common workflows

### Workflow A — Inspect existing schema before changing

```
You: "Show me sal_raw_shopee_sales columns + indexes"
Claude: [calls describe_schema]
        Returns: column list, indexes, FK
```

### Workflow B — Run analytical query during dev

```
You: "How many rows in sal_raw_shopee_sales for April 2026?"
Claude: [calls run_sql with `SELECT COUNT(*) ...`]
        Returns: count
```

### Workflow C — Spin test branch for migration

```
You: "Create test branch from staging, run migration X, verify rowcount, then delete"
Claude: [calls create_branch → run_sql migration → run_sql verify → delete_branch]
```

## 7. Suggested config cho v2

```jsonc
{
  "mcpServers": {
    "neon-v2": {
      "command": "npx",
      "args": [
        "-y",
        "@neondatabase/mcp-server-neon",
        "start",
        "--project-id", "app-sales-report-v2",   // scope to 1 project
        "--read-only"                            // dev safety
      ],
      "env": {
        "NEON_API_KEY": "${NEON_API_KEY_V2}"
      }
    }
  }
}
```

`--read-only` flag: Claude chỉ có thể SELECT, không thể INSERT/UPDATE/DELETE/DDL. Dùng cho dev/staging branch.

Khi cần DDL (migration test): tạm bỏ flag, hoặc dùng dedicated branch.

## 8. Anti-patterns ❌

- ❌ Connect Claude tới production branch
- ❌ Account-wide API key (use project-scoped)
- ❌ Commit `mcp.json` chứa raw key — dùng env var
- ❌ Skip `--read-only` cho dev branch
- ❌ Run destructive query qua Claude khi không có backup
- ❌ Rely Claude SQL output cho production decision không verify thủ công

## 9. Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| "MCP server not connected" | Wrong JSON syntax / npx blocked | Validate JSON, check firewall |
| `401 Unauthorized` | API key invalid/revoked | Regenerate trong Neon console |
| Tools không hiện | Cache cũ | Reload Claude completely |
| `ENOENT npx` | Node not in PATH | Add Node to PATH, restart shell |
| Slow first call | npx download lần đầu | Use Option B (global install) |

## See also

- [safety-rules.md](safety-rules.md) — DON'Ts before connecting prod
- [Neon official docs](https://neon.tech/docs/ai/neon-mcp-server)
- [architecture/DEPLOYMENT.md](../architecture/DEPLOYMENT.md) — Neon branching strategy
- [Anthropic MCP intro](https://modelcontextprotocol.io)
