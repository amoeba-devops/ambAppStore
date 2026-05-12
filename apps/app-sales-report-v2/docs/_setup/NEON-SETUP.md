---
title: Neon Postgres — First-time Setup
description: Provision Neon project + branches, get DATABASE_URL, run drizzle-kit push to apply schema.
load-when: First-time setup of DB / new dev machine onboarding / setting up new environment.
status: ready
---

# Neon Setup — Step by step

## 1. Tạo Neon project (1 lần duy nhất)

1. https://console.neon.tech/signup (login Google/GitHub OK)
2. **Create Project**:
   - Name: `sales-report-v2`
   - Postgres version: **17** (default)
   - Region: **Singapore (ap-southeast-1)** — sát Vietnam + S3 bucket
   - Database name: `db_app_sales_v2` (mặc định auto-create db `neondb`, có thể đổi sau)
3. Click **Create project**
4. Neon auto-tạo:
   - 1 project
   - 1 default branch tên `main` (production-like)
   - 1 default database `neondb` (rename / tạo mới sau)

## 2. Tạo 2 branches thêm (dev + staging)

Trong Neon Console → Project → **Branches** tab → **New branch**:

| Branch name | Parent | Compute | Use |
|---|---|---|---|
| `main` | (auto) | Default | Production |
| `staging` | main | Default | Staging deploy |
| `dev` | main | Default | Local dev — Claude inspects qua MCP |

Free tier: tối đa 10 branches OK.

## 3. Lấy DATABASE_URL cho `dev` branch

1. Branches tab → click `dev` branch
2. **Connection details** section → **Connection string**
3. Toggle "**Pooled connection**" (recommend cho serverless HTTP driver)
4. Copy URL — dạng:
   ```
   postgresql://user:password@ep-xxxx-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require
   ```

## 4. Tạo `.env` ở root v2

```bash
cd apps/app-sales-report-v2
cp .env.example .env
```

Mở `.env` → paste DATABASE_URL từ step 3 vào dòng `DATABASE_URL=...`.

→ `.env` đã trong `.gitignore`, KHÔNG commit.

## 5. Run drizzle-kit push (sync schema)

```bash
cd apps/app-sales-report-v2
npm run db:push -w @v2/db
```

Output dự kiến:
```
✓ Pulled schema from database
[+] Creating table sal_users
[+] Creating table sal_upload_sessions
[+] Creating enum sal_user_local_role
[+] Creating enum sal_upload_session_status
[+] Creating enum sal_upload_granularity
[+] Creating index uniq_sal_users_ent_ama
[+] Creating index uniq_sal_ups_ent_period
[+] Creating index idx_sal_ups_status_created
```

## 6. Verify schema applied

Option A — Drizzle Studio (web UI):
```bash
npm run db:studio -w @v2/db
# Mở https://local.drizzle.studio
# Browse 2 tables: sal_users, sal_upload_sessions
```

Option B — psql via Neon console:
```sql
\dt sal_*
-- expect: sal_users, sal_upload_sessions

\d sal_users
-- expect: 10 columns with sal_user_local_role enum
```

## 7. Production / Staging URLs (later)

Khi deploy lên Render:
- Set `DATABASE_URL` env var trong Render service → trỏ tới `staging` hoặc `main` branch
- Run `drizzle-kit migrate` (KHÔNG `push`) qua CI cho production

## 8. API key cho MCP (optional, dev only)

Nếu muốn Claude inspect DB qua MCP (xem [docs/mcp/neon-setup.md](../mcp/neon-setup.md)):

1. Account Settings → API Keys → **Create**
2. Scope: **Project** = `sales-report-v2` (KHÔNG account-wide)
3. Copy `napi_...` key
4. Config trong `~/.claude/mcp.json` hoặc project `.claude/mcp.json`

→ Pure dev usage, KHÔNG share key.

## 9. Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| `DATABASE_URL is required for drizzle-kit` | `.env` thiếu hoặc sai path | Check `.env` ở root v2, dotenv-cli load via `-e ../../.env` |
| `ECONNREFUSED` | Sai region / firewall | Confirm Neon endpoint URL, ping host |
| `password authentication failed` | URL copy thiếu password | Re-copy "Connection string" có password embedded |
| `database "neondb" does not exist` | Default db tên khác | Update URL path component |
| `relation already exists` | Schema đã push trước | OK — drizzle skip existing |

## 10. Branch reset (clean slate dev)

Nếu cần reset dev branch về sạch:
1. Console → Branches → `dev` → **Delete branch**
2. Create new `dev` branch từ `main`
3. Re-run `npm run db:push`

## See also

- [DEPLOYMENT.md](../architecture/DEPLOYMENT.md) — full deploy pipeline
- [DATA-MODEL.md](../architecture/DATA-MODEL.md) — schema reference
- [.claude/skills/drizzle-neon/SKILL.md](../../.claude/skills/drizzle-neon/SKILL.md) — Drizzle conventions
- [mcp/neon-setup.md](../mcp/neon-setup.md) — Claude MCP config (optional)
