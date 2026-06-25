# FIRGI Sales Report v2

> Sales Performance & Prime Cost Management System cho Socialbean Vietnam.
> Standalone Turborepo · Next.js 15 fullstack · Neon Postgres · S3 · Render.com.

**Documentation entry**: [CLAUDE.md](CLAUDE.md) (project context) · [docs/_NAV.md](docs/_NAV.md) (navigation hub).

---

## 1. First-time setup

```bash
# 1. Install dependencies
cd apps/app-sales-report-v2
npm install

# 2. Create .env from template
cp .env.example .env
# → Edit .env: set DATABASE_URL (Neon), JWT_SECRET, AWS keys

# 3. Apply DB schema to Neon (first time only)
npm run db:generate   # generate migration SQL from Drizzle schema
npm run db:migrate    # apply to DB referenced by DATABASE_URL
```

Detail Neon provisioning: [docs/_setup/NEON-SETUP.md](docs/_setup/NEON-SETUP.md).

---

## 2. Run dev (local)

### 2.1 Start web app

Terminal 1 — Next.js dev server (port 3000):

```bash
npm run dev:web
# → http://localhost:3000
```

Server reads `.env` qua `dotenv-cli` (Edge middleware sees JWT_SECRET).

### 2.2 Login URL (mint dev JWT)

Terminal 2 — generate magic login link:

```bash
npm run dev:token             # role OWNER (→ local ADMIN), valid 8h
npm run dev:token -- MASTER   # → ADMIN
npm run dev:token -- MANAGER  # → MANAGER
npm run dev:token -- MEMBER   # → OPERATOR
```

Output dạng:
```
Dev login URL (open in browser, valid 8h):
  http://localhost:3000/?ama_token=eyJhbGc...
```

Paste vào browser → cookie set → redirect tới `/dashboard`.

### 2.3 Start worker (Excel parse + CM calc)

Terminal 3 — background worker (polls `sal_upload_sessions` PENDING):

```bash
npm run dev -w @v2/worker     # tsx watch, auto-restart on changes
```

### 2.4 Run cron one-shot (test scheduled task)

```bash
npm run dev -w @v2/cron                              # daily-user-sync
npm run start:retry-failed -w @v2/cron               # retry FAILED jobs
```

### 2.5 All services together

```bash
npm run dev          # turbo runs all workspaces in parallel (web + worker + cron)
```

---

## 3. Database migrations

### 3.1 After changing Drizzle schema (`packages/db/src/schema/*.ts`)

```bash
# Generate SQL migration
npm run db:generate          # → packages/db/migrations/NNNN_<name>.sql

# Review the generated SQL (cat the file)
cat packages/db/migrations/NNNN_*.sql

# Apply to DB
npm run db:migrate           # applies any pending migrations
```

### 3.2 Quick sync without migration history (dev only)

```bash
npm run db:push              # ⚠️ destructive, only on dev branch
```

### 3.3 Drizzle Studio (web UI)

```bash
npm run db:studio
# → https://local.drizzle.studio
```

### 3.4 Reset dev branch

Neon Console → Branches → `dev` → Reset from parent. Hoặc delete + recreate. Sau đó:

```bash
npm run db:migrate           # re-apply all migrations to fresh branch
```

---

## 4. Build + typecheck + test

```bash
npm run typecheck            # all workspaces (turbo cache)
npm run build                # all workspaces (Next build + worker tsc)
npm run lint                 # ESLint
npm run test                 # Vitest (when added)
npm run format               # Prettier write
```

---

## 5. Run deployment (Render.com)

### 5.1 First-time setup

1. Create Render account → connect GitHub repo
2. **Blueprint deploy**: Render dashboard → New → Blueprint → select repo + branch
3. Render auto-detects `apps/app-sales-report-v2/render.yaml` and provisions:
   - `sales-report-v2-web` (Web Service)
   - `sales-report-v2-worker` (Background Worker)
   - `sales-report-v2-daily-user-sync` (Cron Job, 2am ICT daily)
   - `sales-report-v2-retry-failed` (Cron Job, every 15min)

4. Set env vars in Render dashboard (per service, marked `sync: false` in render.yaml):
   - `DATABASE_URL` — Neon `staging` (or `main` for production)
   - `JWT_SECRET` — must match ambManagement
   - `AWS_*` — S3 credentials
   - `NEXT_PUBLIC_AMA_ORIGIN` — `https://ama.amoeba.site`

### 5.2 Subsequent deploys

```bash
git push origin huy/setup-sale-report-v2     # or main after merge
# → Render auto-builds + deploys all 4 services from render.yaml
```

### 5.3 Manual migration to production DB

Sau khi merge PR → trước khi promote staging → production:

```bash
# Local with production DATABASE_URL set in .env temporarily
DATABASE_URL=postgresql://...@main-branch... npm run db:migrate

# Or run via Render service shell:
# Render dashboard → sales-report-v2-web → Shell → npm run db:migrate
```

### 5.4 Rollback

Render dashboard → service → Deploys tab → click "Rollback" trên previous build.

### 5.5 Logs

Render dashboard → service → Logs tab (live tail). Tail 100 lines:

```bash
# Render CLI (optional)
render logs --service sales-report-v2-web --tail
```

---

## 6. Common workflows

### 6.1 Add a new DB table

```bash
# 1. Add schema file: packages/db/src/schema/<table>.schema.ts
# 2. Export in packages/db/src/schema/index.ts
npm run db:generate          # creates migration SQL
# 3. Review SQL, commit migration + schema
npm run db:migrate           # apply to local dev branch
```

### 6.2 Add a new env var

```bash
# 1. Update .env.example (template, committed)
# 2. Update local .env (not committed)
# 3. Update render.yaml envVars block (sync: false → set in dashboard)
# 4. Update turbo.json globalEnv list (so turbo invalidates cache on change)
# 5. Use process.env.MY_VAR in code
```

### 6.3 Test as different role

```bash
npm run dev:token -- MASTER   # ADMIN role badge
npm run dev:token -- MANAGER  # MANAGER role
npm run dev:token -- MEMBER   # OPERATOR role
```

### 6.4 Wipe Next.js cache (when weird issues)

```bash
rm -rf apps/web/.next .turbo
npm run dev:web
```

---

## 7. Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| `401 Unauthorized` on `?ama_token=...` | JWT validation fail (wrong secret, expired, missing claim) | Regen token via `npm run dev:token`, ensure JWT_SECRET in `.env` matches |
| Middleware error `JWT_SECRET is required` | `.env` not loaded by Next dev | Confirm `dotenv -e ../../.env --` prefix in `apps/web/package.json` dev script |
| `EADDRINUSE :::3000` | Old dev server still running | `taskkill //F //PID $(netstat -ano \| grep :3000 \| grep LISTENING \| awk '{print $5}')` (Windows) or `lsof -ti:3000 \| xargs kill` (Mac/Linux) |
| `DATABASE_URL is required` for drizzle-kit | `.env` not found | Run from v2 root; check `dotenv -e ../../.env --` prefix in `packages/db/package.json` |
| Schema changes not reflected in queries | Drizzle types stale | `npm run db:generate` to regen, then `npm run db:migrate` |
| Cookie not set in browser | `secure: true` over http | Middleware sets `secure: false` only in dev (NODE_ENV !== 'production') |

---

## 8. Repository layout

```
apps/app-sales-report-v2/
├── CLAUDE.md, README.md, PRD.md         # entry docs
├── package.json, turbo.json             # workspace config
├── tsconfig.base.json
├── .env, .env.example                   # env (gitignored), template
├── render.yaml                          # Render Blueprint
│
├── apps/
│   ├── web/                             # Next.js 15 (Render Web Service)
│   ├── worker/                          # Background Worker (Render Worker)
│   └── cron/                            # Cron Jobs (Render Cron × 2)
│
├── packages/
│   ├── db/                              # Drizzle schema + migrations
│   ├── shared/                          # Zod + types (AmaJwtClaims, SalError)
│   └── ui/                              # cn() Tailwind util
│
├── scripts/
│   └── dev-token.mjs                    # mint dev JWT
│
├── docs/                                # technical docs (see _NAV.md)
├── .claude/                             # Claude Code context (skills + memory)
└── resources/                           # client CSV samples (gitignored)
```

---

## 9. See also

- [CLAUDE.md](CLAUDE.md) — project context for Claude Code
- [docs/_NAV.md](docs/_NAV.md) — full docs navigation
- [docs/architecture/DEPLOYMENT.md](docs/architecture/DEPLOYMENT.md) — Render config detail
- [docs/_setup/NEON-SETUP.md](docs/_setup/NEON-SETUP.md) — Neon provisioning step-by-step
- [docs/analysis/SRD-20260506-FIRGI-SalesReport-v2.md](docs/analysis/SRD-20260506-FIRGI-SalesReport-v2.md) — client spec source of truth
