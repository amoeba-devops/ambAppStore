---
title: MCP Safety Rules
description: When NOT to connect Claude to a DB. Rules for prod, multi-tenant data, API key handling.
load-when: Before granting Claude access to ANY production database / shared DB.
status: ready
---

# MCP Safety Rules

> Mức độ rủi ro khi Claude có quyền chạy SQL trên DB thật. KHÔNG được skip rules này.

## 1. Three rules — luôn luôn áp dụng

### Rule 1: Production = NO Claude MCP access

| Branch | Claude MCP allowed | Mode |
|---|---|---|
| `main` (prod) | ❌ NEVER | — |
| `staging` | ⚠️ Read-only only | with `--read-only` flag |
| `dev` | ✅ OK | read-write OK |
| `preview/*` | ✅ OK | per-PR ephemeral, OK |

**Why**: 1 bug trong prompt → Claude có thể chạy `DELETE FROM sal_skus` trước khi bạn kịp confirm. Damage không thể rollback nếu không có backup.

### Rule 2: `--read-only` flag default cho mọi branch không phải dev

```jsonc
"args": ["-y", "@neondatabase/mcp-server-neon", "start", "--read-only"]
```

Bỏ flag CHỈ khi cần test migration trên dev branch riêng (không phải staging/prod).

### Rule 3: API key project-scoped, không account-scoped

Trong Neon Console:
- Account Settings → API Keys → Create → scope = "Project: app-sales-report-v2" (không phải account-wide)

→ Compromised key chỉ access 1 project, không touch project khác của org.

## 2. Multi-tenant (ent_id) caution

App v2 dùng `ent_id` isolation (mỗi entity 1 tenant). Khi Claude chạy SQL qua MCP:

❌ **DON'T**:
```sql
SELECT * FROM sal_skus;  -- leaks across all tenants
```

✅ **DO**:
```sql
SELECT * FROM sal_skus WHERE ent_id = 'specific-uuid';  -- scoped
```

Nếu Claude generate query thiếu `ent_id`, bạn phải nhắc + reject.

## 3. PII / customer data caution

Real production DB có thể chứa:
- Customer phone, address (`sal_raw_*_reports.rss_raw_data` JSONB)
- User email (`sal_users.usr_email`)
- Financial data (revenue, cost, margin)

→ Claude reading qua MCP = sending these to Anthropic API. Compliance implications:
- GDPR? — kiểm tra với legal
- Internal policy — kiểm tra với CSO

**Mitigation**: dùng anonymized branch cho Claude. Create branch from prod → script anonymize → grant Claude access to anonymized branch only.

## 4. Audit log cho MCP usage

Mọi tool call Claude tới MCP server đều log lại trong Claude Code:
- `View → Output → Claude Code` tab
- `~/.claude/logs/` directory

→ Periodically review để phát hiện queries lạ (vd Claude tự chạy `DROP TABLE` do prompt injection).

## 5. Prompt injection risk

Nếu Claude đọc raw user content (CSV row chứa SQL-like string), có thể bị inject. Ví dụ:
- User upload CSV với cell text: `"; DROP TABLE sal_skus; --`
- Claude đọc → có thể "diễn giải" → gọi `run_sql` với câu đó

**Mitigation**:
- `--read-only` flag chặn DROP/DELETE/UPDATE
- KHÔNG để Claude tự execute SQL từ user content — luôn human-in-loop confirm
- Parameterized query > string concat (apply this trong code, không phải qua MCP)

## 6. Checklist trước khi commit Claude MCP config

- [ ] `mcp.json` KHÔNG chứa raw API key (dùng `${ENV_VAR}`)
- [ ] `.gitignore` exclude `.claude/mcp.json`
- [ ] API key là project-scoped, không account-wide
- [ ] Branch target là dev hoặc staging (KHÔNG main)
- [ ] `--read-only` flag enabled cho staging
- [ ] Audit team đã được notify về MCP setup (nếu prod hoặc sensitive)
- [ ] Backup latest exists cho branch Claude có quyền

## 7. Emergency: revoke MCP access

Nếu nghi ngờ key leak / Claude làm sai:

1. Neon Console → API Keys → **Revoke** key đang dùng (immediate)
2. Branch nghi ngờ → Console → **Restore from backup** (point-in-time)
3. Remove MCP config: delete `mcp.json` block, reload Claude
4. Investigate logs `~/.claude/logs/`

## 8. Recommended setup matrix

| Use case | Setup |
|---|---|
| Dev local | dev branch + read-write + no anonymize |
| Bug repro on staging | staging branch + read-only + anonymized samples ok |
| Migration test | create ephemeral branch from staging + temporary read-write + delete after |
| Prod debug | DO NOT use MCP. Use Neon Console SQL editor manually. |

## See also

- [neon-setup.md](neon-setup.md) — install + config
- [architecture/DEPLOYMENT.md](../architecture/DEPLOYMENT.md) — branch strategy
- [.claude/skills/amb-integration/SKILL.md](../../.claude/skills/amb-integration/SKILL.md) — `ent_id` isolation
