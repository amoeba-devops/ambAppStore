# DEPLOYMENT — Sales Report v2 (Render.com)

> Render.com deployment. KHÔNG dùng Vercel.

## 1. Render services (3 services per env)

| Service | Type | Purpose |
|---|---|---|
| `sales-report-v2-web` | Web Service | Next.js app (RSC + Server Actions + API routes) |
| `sales-report-v2-worker` | Background Worker | Async parse Excel + CM calc (DB-based queue) |
| `sales-report-v2-cron` | Cron Job | Daily AMA user sync, weekly aggregations |

## 2. Environments

| Env | Web URL | Neon branch | S3 prefix |
|---|---|---|---|
| Local | `http://localhost:3000` | `dev` | `local/` |
| Staging | `https://sales-v2-stg.onrender.com` (custom: `sales-v2-stg.apps.amoeba.site`) | `staging` | `staging/` |
| Production | `https://sales-v2.apps.amoeba.site` | `main` | `prod/` |

→ Preview env per PR: **không có** (Render không auto-spawn). Test trên staging branch.

## 3. Environment variables

### 3.1 Public (NEXT_PUBLIC_*)
```
NEXT_PUBLIC_APP_CODE=sales-report-v2
NEXT_PUBLIC_AMA_ORIGIN=https://ama.amoeba.site
NEXT_PUBLIC_DEFAULT_LOCALE=ko
```

### 3.2 Server-only
```
# Auth
JWT_SECRET=<must match ambManagement>
SESSION_COOKIE_NAME=amb_session

# Neon
DATABASE_URL=postgresql://...neon.tech/db_app_sales_v2?sslmode=require

# S3
AWS_REGION=ap-southeast-1
AWS_S3_BUCKET=amb-sales-report-v2
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...

# Worker
WORKER_POLL_INTERVAL_MS=2000
WORKER_BATCH_SIZE=1

# App Store proxy (optional)
APP_STORE_API_URL=https://apps.amoeba.site/api/v1
```

→ `.env.example` checked vào git, `.env.local` / Render dashboard env vars KHÔNG commit.

## 4. Neon branching workflow

```
main (prod)
  ├── staging (long-lived)
  └── dev (long-lived, local pull migrations)
```

KHÔNG có PR-branch auto (Render không integrate sâu như Vercel-Neon). Test trên staging.

CI step (GitHub Actions):
1. PR mở → run `drizzle-kit generate` → review SQL
2. PR merge → CI deploy Render web/worker → run `drizzle-kit migrate` lên Neon `staging`
3. Staging xanh → manual promote to `main` Render service

## 5. Render service config

### 5.1 Web Service (`sales-report-v2-web`)

```yaml
# render.yaml
services:
  - type: web
    name: sales-report-v2-web
    runtime: node
    rootDir: apps/web
    buildCommand: npm install && npm run build
    startCommand: npm start
    plan: starter  # $7/mo
    envVars:
      - key: NODE_ENV
        value: production
      - key: DATABASE_URL
        sync: false  # set in dashboard
      # ... etc
    healthCheckPath: /api/v1/health
```

### 5.2 Background Worker (`sales-report-v2-worker`)

```yaml
  - type: worker
    name: sales-report-v2-worker
    runtime: node
    rootDir: apps/worker
    buildCommand: npm install && npm run build
    startCommand: node dist/index.js
    plan: starter  # $7/mo
    envVars:
      - key: DATABASE_URL
        sync: false
      # ... same S3, etc.
```

Worker code = simple polling loop (xem [system-design/background-jobs.md](../system-design/background-jobs.md)).

### 5.3 Cron Jobs

```yaml
  - type: cron
    name: sales-report-v2-daily-sync
    runtime: node
    rootDir: apps/cron
    buildCommand: npm install && npm run build
    schedule: "0 2 * * *"  # 2am ICT daily
    startCommand: node dist/daily-sync.js
    plan: starter
```

## 6. Migration deploy

| Bước | Lệnh | Khi nào |
|---|---|---|
| Generate | `drizzle-kit generate` | Sau khi sửa schema |
| Review | đọc SQL trong `packages/db/migrations/` | Trước commit |
| Apply dev | `drizzle-kit push` | Local dev (fast iter) |
| Apply staging | `drizzle-kit migrate` qua CI lên Neon `staging` branch | PR merge to `main` |
| Apply prod | `drizzle-kit migrate` qua CI lên Neon `main` branch | Manual approval |

**Cấm**: `drizzle-kit push` trên branch staging/prod (mất history).

## 7. Iframe hosting setup

1. Domain Render: `sales-v2.onrender.com` (auto-provisioned)
2. Custom domain: `sales-v2.apps.amoeba.site` (Render → Settings → Custom Domain → add)
3. SSL: Render auto Let's Encrypt
4. Đăng ký AMA: xem [INTEGRATION-amb.md §2](INTEGRATION-amb.md)

## 8. Rollback

- Render: Deploys tab → click "Rollback" trên previous deploy (1-click)
- DB migration: prepare `down` SQL trong cùng folder migration, run thủ công nếu cần. KHÔNG auto-rollback DB.
- S3: versioning bật cho bucket → revert file nếu cần

## 9. Monitoring

| Metric | Tool |
|---|---|
| App errors | **Render logs** (built-in) + log alerts |
| HTTP latency | Render Metrics tab |
| Worker job status | DB query `sal_upload_sessions` status counts |
| DB query slow | Neon Console dashboard |
| Uptime | Render auto restart on crash |
| Health probe | Render auto-pings `/api/v1/health` |

→ KHÔNG dùng external (Sentry, Axiom, UptimeRobot) ở MVP.

## 10. Cost ballpark (MVP)

| Item | Plan | Est. |
|---|---|---|
| Render Web Service | Starter | $7/mo |
| Render Background Worker | Starter | $7/mo |
| Render Cron Job | Starter | $1/mo |
| Neon Postgres | Launch (3 branches) | $19/mo |
| S3 | <100GB | <$5/mo |
| **Tổng** | | **~$40/mo** |

→ Có thể dùng Render Free tier cho dev/staging ($0), nhưng cold start chậm.

## 11. Build flow

```
GitHub push → main branch
       ↓
Render auto-build (web + worker + cron)
       ↓
Health check pass → swap traffic
       ↓
Old deploy retained 24h for rollback
```

## 12. Local dev parity

```bash
# Web
cd apps/web && npm run dev   # http://localhost:3000

# Worker (separate terminal)
cd apps/worker && npm run dev

# DB migrations
cd packages/db && npm run db:push    # dev branch
cd packages/db && npm run db:migrate # staging+
```

Một-một mapping với 3 Render services → behavior production = behavior dev.
