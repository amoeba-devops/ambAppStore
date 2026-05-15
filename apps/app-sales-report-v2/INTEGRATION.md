# Integration — `app-sales-report-v2` ↔ ambAppStore + ambManagement

> Single source of truth for how this Next.js 15 app embeds into the **ambAppStore** catalog and authenticates through **ambManagement (AMA)**. Local dev + staging + production share the same `/app-sales-report-v2/*` routing convention.
>
> Pattern mirrors [`app-car-manager-v2`'s INTEGRATION.md](../app-car-manager-v2/INTEGRATION.md) — both apps are Next.js 15 fullstack with the same dual-target (Render + staging Docker) topology.

---

## 1. Topology

```
   ┌──────────────────────────────────────┐
   │   AMA (ambManagement) — Postgres     │  issues JWT (HS256, JWT_SECRET) ──┐
   │                                       │                                    │
   │   amb_entity_custom_apps  (PRIMARY)  │                                    │
   │     eca_code='app-sales-report-v2'   │                                    │
   │     eca_auth_mode='jwt'              │                                    │
   │     eca_open_mode='iframe'           │                                    │
   │     eca_url=https://stg-apps..../v2  │                                    │
   └──────────────┬───────────────────────┘                                    │
                  │ user clicks "매출리포트 v2" in AMA sidebar                 │
                  ▼                                                             │
   ┌──────────────────────────────────────┐                                    │
   │   nginx (host on staging server)     │                                    │
   │   proxy_pass → next-sales-report-v2  │                                    │
   │   /app-sales-report-v2/* preserved   │                                    │
   └──────────────┬───────────────────────┘                                    │
                  │ HTTPS (X-Forwarded-Host: stg-apps.amoeba.site)             │
                  ▼                                                             │
   ┌──────────────────────────────────────┐                                    │
   │   app-sales-report-v2 (Staging Docker)│ ◄──────────────────────────────────┘
   │   Next.js (RSC + Server Actions)      │   middleware verifies JWT (jose)
   │   BASE_PATH=/app-sales-report-v2      │   → sets HttpOnly cookie amb_session_sales
   │   APP_URL=https://stg-apps.amoeba.site│     on stg-apps.amoeba.site
   └──────────────────────────────────────┘
                  ▲
                  │ alternative entry: ambAppStore catalog
                  │ user clicks "Use Service" → same /app-sales-report-v2/
   ┌──────────────────────────────────────┐
   │   ambAppStore Platform (MySQL)        │
   │   plt_apps.app_slug=                  │
   │     'app-sales-report-v2'             │
   │   catalog UI (AppCard 📊)             │
   └──────────────────────────────────────┘

   ┌──────────────────────────────────────────────────────────────────┐
   │   Render (separate deploy, same Neon DB, same JWT_SECRET)         │
   │   • sales-report-v2-web        → direct access / QA               │
   │   • sales-report-v2-worker     → poll sal_upload_sessions queue   │
   │   • sales-report-v2-daily-user-sync   (cron 04:00 VN)             │
   │   • sales-report-v2-retry-failed      (cron */15min)              │
   └──────────────────────────────────────────────────────────────────┘
```

Three independent runtimes, **one shared `JWT_SECRET`**. The platform is the catalog only — it never proxies auth. AMA mints, v2 verifies. Cookie lives on the user-facing origin (`stg-apps.amoeba.site` / `apps.amoeba.site` / `localhost:5200`), not on the Render origin (this is what `X-Forwarded-Host` accomplishes — see §6.3).

**Deploy topology (D1 — dual target, one BASE_PATH):**

v2 is deployed to **two runtime hosts in parallel**, both built with the same `BASE_PATH=/app-sales-report-v2`:

| Target | URL | Purpose | Wiring |
|---|---|---|---|
| **Staging Docker** | `https://stg-apps.amoeba.site/app-sales-report-v2/` | Embedded flow via AMA + ambAppStore catalog (primary user traffic) | nginx → `next-sales-report-v2:3001` container on `amb-apps-network` |
| **Render — web** | `https://sales-report-v2-web.onrender.com/app-sales-report-v2/` | Direct access (QA, external API consumers, fallback if staging Docker is down) | Render service `sales-report-v2-web` (independent deploy from `render.yaml`) |
| **Render — worker** | (no public URL) | Background job processor — polls `sal_upload_sessions` for Shopee/TikTok parse jobs | Render service `sales-report-v2-worker` |
| **Render — cron** | (scheduled) | Daily AMA user sync + every-15min retry-failed sweep | Render services `sales-report-v2-daily-user-sync` + `sales-report-v2-retry-failed` |

Both web deploys share **the same Neon Postgres** (`DATABASE_URL` identical) and **the same `JWT_SECRET`**. Worker + cron run **only on Render** — they poll Neon directly via the `@neondatabase/serverless` HTTP driver, no nginx dependency, no double-processing risk (queue uses `FOR UPDATE SKIP LOCKED`).

---

## 2. Files touched by this integration

| File | Purpose |
|---|---|
| [scripts/seed-ambappstore-app.sql](scripts/seed-ambappstore-app.sql) | MySQL: add `app-sales-report-v2` row to `plt_apps` (catalog UI) |
| [scripts/seed-ama-entity-custom-app.sql](scripts/seed-ama-entity-custom-app.sql) | **(PRIMARY)** Postgres: register per-entity in `amb_entity_custom_apps` so AMA mints JWT + shows v2 in sidebar |
| [Dockerfile](Dockerfile) | Multi-stage Node 20 alpine — used by staging server compose |
| [docker-compose.app-sales-report-v2.yml](docker-compose.app-sales-report-v2.yml) | Single-service compose for staging |
| [.dockerignore](.dockerignore) | Excludes node_modules / .next / .env / resources from build context |
| [render.yaml](render.yaml) | Render deploy spec — web + worker + 2 cron (parallel target, independent of Docker) |
| [../../platform/nginx/apps.amoeba.site.conf](../../platform/nginx/apps.amoeba.site.conf) | nginx `location /app-sales-report-v2/` → `next-sales-report-v2:3001` container |
| [../../platform/scripts/deploy-staging.sh](../../platform/scripts/deploy-staging.sh) | Registered as `sales-report-v2` target (single-service + custom health path) |
| [apps/web/next.config.ts](apps/web/next.config.ts) | `basePath = process.env.BASE_PATH \|\| undefined` |
| [apps/web/src/middleware.ts](apps/web/src/middleware.ts) | JWT verify + cookie + request-header propagation (see §6) |
| [.env](.env) (gitignored) | `BASE_PATH=/app-sales-report-v2`, `JWT_SECRET` shared, `NEXT_PUBLIC_AMA_ORIGIN` allow-list |
| [.env.example](.env.example) | template with `BASE_PATH` documented |

---

## 3. Local dev — from a fresh checkout

```bash
# A) ambAppStore platform — MySQL :3306, FE :5200, BE :3100
cd <repo-root>
npm install
mysql -h localhost -P 3306 -u root -proot \
  < apps/app-sales-report-v2/scripts/seed-ambappstore-app.sql
npm run dev                  # turbo: FE :5200 + BE :3100 + (other apps)

# B) sales-report-v2 — standalone Turborepo
cd apps/app-sales-report-v2
npm install                  # first time only
npm run db:migrate           # apply Drizzle schema to Neon (uses DATABASE_URL from .env)
npm run dev:web              # Next.js :3000 — standalone (no basePath)
```

### 3.1 Why `BASE_PATH` is env-driven

Setting `basePath` in Next.js makes the app **only** reachable under that prefix. Keeping it driven by `process.env.BASE_PATH`:

- Standalone development: omit `BASE_PATH` → reachable at `http://localhost:3000/`.
- Integrated dev: `BASE_PATH=/app-sales-report-v2` → reachable at `http://localhost:5200/app-sales-report-v2/` via Vite proxy, mirroring the production nginx layout.

---

## 4. Subscription approval flow

The platform gates app usage by `plt_subscriptions.sub_status`. From an entity's first visit:

```
Entity user (no subscription yet)
   ↓ click v2 card
AppDetailPage → button "Apply"
   ↓ submit SubscriptionRequestModal
POST /api/v1/platform/subscriptions/public
   → INSERT plt_subscriptions (status=PENDING)
   ↓
Admin approves (UI or SQL):
   UPDATE plt_subscriptions SET sub_status='ACTIVE'
   ↓ user refreshes detail page
Button becomes "Use Service" (green)
   ↓ click
Navigates /app-sales-report-v2/
```

To approve without admin UI:
```sql
UPDATE plt_subscriptions
SET sub_status='ACTIVE', sub_approved_at=NOW()
WHERE ent_id='<entity-uuid>'
  AND app_id=(SELECT app_id FROM plt_apps WHERE app_slug='app-sales-report-v2');
```

---

## 5. Production / staging deploy

### 5.0 Dual deploy at a glance

v2 web ships to **two runtime hosts in parallel**, same code / same DB / same JWT:

| | Staging Docker (LAN) | Render (cloud) |
|---|---|---|
| **Build** | `bash platform/scripts/deploy-staging.sh build sales-report-v2` (on staging server) | git push → Render auto-build |
| **Image / Process** | Container `next-sales-report-v2:3001` on `amb-apps-network` | `sales-report-v2-web` service |
| **External URL** | `https://stg-apps.amoeba.site/app-sales-report-v2/` (via nginx) | `https://sales-report-v2-web.onrender.com/app-sales-report-v2/` |
| **Used by** | All end-user flows through AMA sidebar + ambAppStore catalog | Direct access — QA, API consumers, fallback |
| **BASE_PATH** | `/app-sales-report-v2` (compose build args) | `/app-sales-report-v2` (render.yaml env) |
| **DATABASE_URL** | Neon staging (same as Render) | Neon staging (same as Docker) |
| **JWT_SECRET** | Same as AMA + platform | Same as AMA + platform |
| **SESSION_COOKIE_NAME** | `amb_session_sales` | `amb_session_sales` |
| **Worker/Cron** | — (not deployed here) | All 3 background services |
| **DEMO_AUTO_LOGIN** | `false` | `false` |

Both must keep these env vars in sync — `JWT_SECRET` divergence is the most common failure mode.

### 5.1 Layer A — Render (web + worker + cron)

[render.yaml](render.yaml) defines 4 services:

| Service | Type | Schedule | Purpose |
|---|---|---|---|
| `sales-report-v2-web` | web | continuous | Next.js fullstack — `BASE_PATH=/app-sales-report-v2` |
| `sales-report-v2-worker` | worker | continuous | Poll `sal_upload_sessions` queue, parse Shopee/TikTok Excel |
| `sales-report-v2-daily-user-sync` | cron | `0 19 * * *` (04:00 VN) | Sync AMA users → `sal_users` |
| `sales-report-v2-retry-failed` | cron | `*/15 * * * *` | Requeue failed jobs whose retry window elapsed |

First-time setup — Render Dashboard → each service → **Environment**:

| Key | Value | Service(s) |
|---|---|---|
| `BASE_PATH` | `/app-sales-report-v2` | web |
| `APP_URL` | `https://stg-apps.amoeba.site` | web |
| `SESSION_COOKIE_NAME` | `amb_session_sales` | web |
| `JWT_SECRET` | **shared** with AMA + platform (HS256, byte-for-byte) | web |
| `DEMO_AUTO_LOGIN` | **`false`** ⚠️ | web |
| `NEXT_PUBLIC_AMA_ORIGIN` | `https://ama.amoeba.site https://apps.amoeba.site https://stg-apps.amoeba.site` | web |
| `DATABASE_URL` | Neon staging pooler URL | web + worker + 2 cron |
| `AWS_*` | S3 credentials for raw upload archive | web + worker |
| `WORKER_POLL_INTERVAL_MS` | `2000` | worker |

Manual deploy → verify `https://sales-report-v2-web.onrender.com/app-sales-report-v2/api/v1/health` returns `{"success":true}`.

Apply migrations (already done for current schema 0000–0004 — see [packages/db/migrations/](packages/db/migrations/)):
```bash
npm run db:migrate  # uses DATABASE_URL from local .env (point at staging Neon)
```

### 5.2 Layer B — ambAppStore catalog

Idempotent on `app_slug`. Run once per environment:

```bash
# Staging
ssh ambAppStore@stg-apps.amoeba.site \
  "cd ~/ambAppStore && git pull && docker exec -i mysql-apps mysql -uroot -p<PWD> db_app_platform \
   < apps/app-sales-report-v2/scripts/seed-ambappstore-app.sql"

# Production (only after staging is green)
ssh amoeba-shop \
  "cd /var/www/apps_amoeba && git pull && docker exec -i mysql-apps mysql -uroot -p<PWD> db_app_platform \
   < apps/app-sales-report-v2/scripts/seed-ambappstore-app.sql"
```

### 5.3 Layer C — Staging Docker + Nginx route

**Build & start the container** (run on staging server):

```bash
ssh ambAppStore@stg-apps.amoeba.site "cd ~/ambAppStore && git pull && \
  bash platform/scripts/deploy-staging.sh full sales-report-v2"
```

`deploy-staging.sh` knows sales-report-v2 is single-service (BFF_NAME == WEB_NAME) and uses a custom health path (`/app-sales-report-v2/api/v1/health` because of the basePath). Verify step skips the redundant frontend probe.

Required on the staging server before first build: `apps/app-sales-report-v2/.env` with at minimum:
- `JWT_SECRET` (same as AMA)
- `DATABASE_URL` (Neon staging URL)
- `BASE_PATH=/app-sales-report-v2`
- `APP_URL=https://stg-apps.amoeba.site`
- `SESSION_COOKIE_NAME=amb_session_sales`
- `NEXT_PUBLIC_AMA_ORIGIN=https://ama.amoeba.site https://apps.amoeba.site https://stg-apps.amoeba.site`

Same shape as Render's env vars in §5.1.

**Nginx route** is committed in [../../platform/nginx/apps.amoeba.site.conf](../../platform/nginx/apps.amoeba.site.conf). On any update:

```bash
ssh ambAppStore@stg-apps.amoeba.site "sudo nginx -t && sudo systemctl reload nginx"
```

The proxy_pass targets the local container (`http://next-sales-report-v2:3001`), NOT Render. This keeps all embedded-flow traffic on the staging LAN (low latency, same network as MySQL + AMA). Render is reached only when the user explicitly browses its `*.onrender.com` URL.

Pitfall: `X-Forwarded-Host` must be forwarded so v2's `getRequestOrigin()` returns `stg-apps.amoeba.site` (not the container hostname). See §6.3.

### 5.4 Layer D — AMA registration (enables AMA sidebar entry)

**Use [scripts/seed-ama-entity-custom-app.sql](scripts/seed-ama-entity-custom-app.sql)** — the primary path. AMA's `amb_partner_apps` lifecycle is only partly implemented (no JWT mint endpoint for `pap_auth_mode='SSO_JWT'`); every embedded app on staging today uses `amb_entity_custom_apps`.

```bash
# Edit the file first to replace <ENT_UUID> + <ADMIN_USER_UUID> placeholders
psql -h 192.168.1.150 -U amb_user -d db_amb \
  -f apps/app-sales-report-v2/scripts/seed-ama-entity-custom-app.sql
```

One row per entity that should see the app. The seed is idempotent on `(ent_id, eca_code)` so re-running per entity is safe. URL contract AMA constructs on click: `{eca_url}?ama_token={jwt}&locale={lang}`.

For an entity to "see" the app:
1. AMA admin (or entity owner) runs the INSERT once for that `ent_id`
2. AMA sidebar / custom-apps section now shows "매출리포트 v2"
3. Click → AMA mints JWT → redirects to `https://stg-apps.amoeba.site/app-sales-report-v2/?ama_token=...` → nginx → Docker container → v2 middleware sets cookie → dashboard

### 5.5 Pre-flight checklist

- [ ] `JWT_SECRET` is **identical** across AMA, platform-backend `.env`, Render `sales-report-v2-*` envs, and staging container `.env`
- [ ] `DEMO_AUTO_LOGIN=false` on Render + staging
- [ ] `BASE_PATH=/app-sales-report-v2` on Render web service
- [ ] `APP_URL=https://stg-apps.amoeba.site` so `getRequestOrigin()` returns the user-facing domain
- [ ] `SESSION_COOKIE_NAME=amb_session_sales` to avoid collision with car-manager-v2's `amb_session`
- [ ] Seed `plt_apps` ran at least once on target MySQL (verify: `SELECT app_slug FROM plt_apps WHERE app_slug='app-sales-report-v2'`)
- [ ] Nginx config validates: `nginx -t`
- [ ] Health endpoint reachable via the public domain: `curl https://stg-apps.amoeba.site/app-sales-report-v2/api/v1/health`
- [ ] Render web service health endpoint returns 200: `curl https://sales-report-v2-web.onrender.com/app-sales-report-v2/api/v1/health`
- [ ] Worker logs on Render show "[worker] starting workerId=..." after deploy
- [ ] Staging tested end-to-end (catalog → subscribe → approve → dashboard) before `main → production` PR

---

## 6. Why these 3 things are non-obvious (learned the hard way)

> These bugs cost a debugging session — keep them in mind before changing anything.

### 6.1 Middleware must propagate request headers via `request:` option

In [middleware.ts](apps/web/src/middleware.ts), the auth context is passed to RSC via headers:

```ts
const requestHeaders = new Headers(req.headers);
requestHeaders.set('x-ent-id', claims.ent_id);
requestHeaders.set('x-user-id', claims.sub);
requestHeaders.set('x-user-role', claims.role);
return NextResponse.next({ request: { headers: requestHeaders } });
```

Do **not** use `res.headers.set('x-ent-id', ...)` — that sets **response** headers (sent to the browser), but RSC `headers()` in `getCurrentUser()` reads **request** headers. With `res.headers.set`, middleware verify succeeds, the page renders 200, but `getCurrentUser` throws because the headers it needs don't exist on the request. Symptom: "Something went wrong" error page on every dashboard load.

### 6.2 Middleware matcher must include `/` explicitly

```ts
export const config = {
  matcher: ['/', '/((?!_next/static|_next/image|favicon.ico).+)'],
};
```

The single-pattern form `'/((?!_next/static|_next/image|favicon.ico).*)'` empirically **does not match the root path `/`** in Next.js 15 with `basePath` enabled. Symptom: middleware never runs for the dashboard, headers never propagate, identical error to §6.1.

Diagnose: add `console.log('[mw]', pathname)` at the top of `middleware()` — if you don't see it for `/`, the matcher is wrong.

### 6.3 nginx + `getRequestOrigin` need `X-Forwarded-Host`

Staging nginx must send `X-Forwarded-Host $host` so v2's `getRequestOrigin(req)` returns `stg-apps.amoeba.site` instead of the upstream container hostname. Without it:

- AMA mints cookie on `stg-apps.amoeba.site` (correct — the browser-facing origin)
- v2 then redirects to `absoluteUrl(req, '/')` → resolves to internal container origin (cross-origin!)
- Browser jumps to the internal hostname, doesn't send the cookie → middleware redirects to `/session-expired` → infinite loop

---

## 7. JWT contract (frozen — change in lockstep across AMA + platform + v2)

`HS256`, secret = `JWT_SECRET`. Payload AMA issues:

```json
{
  "sub": "<uuid-user>",
  "ent_id": "<uuid-entity>",
  "role": "OWNER | MASTER | MANAGER | MEMBER",
  "email": "...",
  "name": "...",
  "app_code": "sales-report-v2",
  "iss": "amb-management",
  "aud": "sales-report-v2",
  "exp": <unix-seconds>
}
```

- `app_code` mismatch → middleware verify throws → cookie cleared → `/session-expired`.
- `iss` / `aud` are enforced in [verify-jwt.ts](apps/web/src/lib/auth/verify-jwt.ts).
- AMA role → app local role mapping (CLAUDE.md §4.6): `OWNER|MASTER → ADMIN`, `MANAGER → MANAGER`, `MEMBER → OPERATOR`.

---

## 8. Runtime flow (production iframe scenario)

```
1. User opens AMA → clicks "매출리포트 v2" in custom-apps sidebar
2. AMA iframe https://apps.amoeba.site/?ent_id=...&ent_code=...&from=iframe
3. ambAppStore platform catalog renders; entity context saved into Zustand
4. User clicks card → /apps/app-sales-report-v2
5. AppDetailPage: subscription ACTIVE → "Use Service" button shows
6. Click → href="/app-sales-report-v2/" → nginx routes to Docker container
7. v2 middleware:
   a. no cookie → 307 /session-expired
   b. user → AMA → re-issues JWT → redirects /app-sales-report-v2/?ama_token=<jwt>
   c. middleware verifies, sets cookie amb_session_sales (HttpOnly, SameSite=None in prod), redirects to clean URL
8. Dashboard loads — getCurrentUser reads x-ent-id from middleware-injected request headers
9. Every subsequent request: cookie is sent → middleware verify → headers → RSC
```

---

## 9. Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| Card not on catalog | seed not applied to that env | re-run `scripts/seed-ambappstore-app.sql` against target `db_app_platform` |
| `/app-sales-report-v2/` 404 via staging | container not running | `docker ps \| grep next-sales-report-v2`; re-run deploy script |
| `_next/static/...` 404 | `BASE_PATH` not set or doesn't match nginx prefix | restart container after `.env` change (env loads once at boot) |
| `Something went wrong` error page after login | §6.1 or §6.2 regressed | check middleware matcher + request-header propagation |
| Loops between `/session-expired` and dashboard | cross-origin redirect, cookie not sticking | §6.3 — confirm `X-Forwarded-Host` arrives at v2 |
| `401` after pasting `?ama_token=` | `JWT_SECRET` mismatch | grep all envs (AMA + platform + Render + staging container), must match byte-for-byte |
| CSP blocks iframe | `NEXT_PUBLIC_AMA_ORIGIN` missing parent origin | add origin space-separated to env, rebuild |
| Card icon shows 📱 | icon map not updated in platform FE | check AppCard / AppDetailPage / SubscriptionCard |
| Subscription stuck at PENDING | no admin to approve in dev | run UPDATE SQL in §4 |
| Worker doesn't pick up uploads | Render worker crashed or DATABASE_URL wrong | check Render logs for `sales-report-v2-worker` |
| Upload stuck at FAILED forever | retry-failed cron not running, or `ups_retry_count >= ups_max_retries` | check Render cron logs; bump `ups_max_retries` if intentional |

---

## 10. See also

- [README.md](README.md) — first-time setup + dev quickstart
- [CLAUDE.md](CLAUDE.md) — architecture rules + DDD layers + role mapping
- [PRD.md](PRD.md) — initial business spec (superseded by SRD in `docs/analysis/`)
- [docs/analysis/SRD-20260506-FIRGI-SalesReport-v2.md](docs/analysis/SRD-20260506-FIRGI-SalesReport-v2.md) — client SRS v2.0, source of truth
- Root [CLAUDE.md](../../CLAUDE.md) — ambAppStore monorepo conventions
- Sibling reference: [apps/app-car-manager-v2/INTEGRATION.md](../app-car-manager-v2/INTEGRATION.md) — same dual-target pattern
- v1 reference: [apps/app-sales-report/](../app-sales-report/) — older NestJS/Vite stack, same `/app-sales-report/*` routing pattern
