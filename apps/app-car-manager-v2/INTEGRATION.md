# Integration — `app-car-manager-v2` ↔ ambAppStore + ambManagement

> Single source of truth for how this Next.js 15 app embeds into the **ambAppStore** catalog and authenticates through **ambManagement (AMA)**. Local dev + staging + production share the same `/app-car-manager-v2/*` routing convention.
>
> If you change anything in this doc, also update [CLAUDE.md §5](CLAUDE.md).

---

## 1. Topology

```
   ┌──────────────────────────────────────┐
   │   AMA (ambManagement) — Postgres     │  issues JWT (HS256, JWT_SECRET) ──┐
   │                                       │                                    │
   │   amb_entity_custom_apps  (PRIMARY)  │                                    │
   │     eca_code='app-car-manager-v2'    │                                    │
   │     eca_auth_mode='jwt'              │                                    │
   │     eca_open_mode='iframe'           │                                    │
   │     eca_url=https://stg-apps..../v2  │                                    │
   │                                       │                                    │
   │   amb_partner_apps  (NOT USED — see  │                                    │
   │   §5.4 note about missing JWT mint)  │                                    │
   └──────────────┬───────────────────────┘                                    │
                  │ user clicks "Quản lý điều xe v2" in AMA sidebar           │
                  ▼                                                             │
   ┌──────────────────────────────────────┐                                    │
   │   nginx (host on staging server)     │                                    │
   │   proxy_pass → Render (Option A)     │                                    │
   │   /app-car-manager-v2/* preserved    │                                    │
   └──────────────┬───────────────────────┘                                    │
                  │ HTTPS (X-Forwarded-Host: stg-apps.amoeba.site)             │
                  ▼                                                             │
   ┌──────────────────────────────────────┐                                    │
   │   app-car-manager-v2 on Render        │ ◄───────────────────────────────────┘
   │   Next.js (RSC + Server Actions)      │   middleware verifies JWT (jose)
   │   BASE_PATH=/app-car-manager-v2       │   → sets HttpOnly cookie amb_session
   │   APP_URL=https://stg-apps.amoeba.site│     on stg-apps.amoeba.site (not onrender)
   └──────────────────────────────────────┘
                  ▲
                  │ alternative entry: ambAppStore catalog
                  │ user clicks "Use Service" → same /app-car-manager-v2/
   ┌──────────────────────────────────────┐
   │   ambAppStore Platform (MySQL)        │
   │   plt_apps.app_slug=                  │
   │     'app-car-manager-v2'              │
   │   catalog UI (AppCard 🚙)             │
   └──────────────────────────────────────┘
```

Three independent runtimes, **one shared `JWT_SECRET`**. The platform is the catalog only — it never proxies auth. AMA mints, v2 verifies. Cookie lives on the user-facing origin (`stg-apps.amoeba.site` / `apps.amoeba.site` / `localhost:5200`), not on the Render origin (this is what `X-Forwarded-Host` accomplishes — see §6.3).

**Deploy topology (D2 — dual target, different BASE_PATH per host):**

v2 is deployed to **two runtime hosts in parallel** with different build configs so each URL is natural for its host:

| Target | URL | `BASE_PATH` | `APP_URL` | Purpose |
|---|---|---|---|---|
| **Staging Docker** | `https://stg-apps.amoeba.site/app-car-manager-v2/` | `/app-car-manager-v2` | `https://stg-apps.amoeba.site` | Embedded flow via AMA + ambAppStore catalog (primary user traffic) |
| **Render** | `https://car-manager-staging.onrender.com/` (clean, no prefix) | (unset) | `https://car-manager-staging.onrender.com` | Direct access (QA, external API consumers, fallback if staging Docker is down) |

Both deploys share **the same Neon Postgres** (`DATABASE_URL` identical) and **the same `JWT_SECRET`** — no data divergence. The two diverge only in `BASE_PATH` (build-time, baked into bundle) and `APP_URL` (runtime, cookie/redirect domain). This means **two separate builds** — accept the duplication so each URL surface is natural for its host.

Health endpoint per target:
- Staging Docker: `https://stg-apps.amoeba.site/app-car-manager-v2/api/v1/health`
- Render:        `https://car-manager-staging.onrender.com/api/v1/health` (no prefix)

---

## 2. Files touched by this integration

| File | Purpose |
|---|---|
| [scripts/seed-ambappstore-app.sql](scripts/seed-ambappstore-app.sql) | MySQL: add `app-car-manager-v2` row to `plt_apps` (catalog UI) |
| [scripts/seed-ama-entity-custom-app.sql](scripts/seed-ama-entity-custom-app.sql) | **(PRIMARY)** Postgres: register per-entity in `amb_entity_custom_apps` so AMA mints JWT + shows v2 in sidebar |
| [scripts/seed-ama-partner-app.sql](scripts/seed-ama-partner-app.sql) | (alternative, NOT working end-to-end) Postgres: register in `amb_partner_apps` — kept for documentation only |
| [Dockerfile](Dockerfile) | Multi-stage Node 20 alpine — used by staging server compose |
| [docker-compose.app-car-manager-v2.yml](docker-compose.app-car-manager-v2.yml) | Single-service compose for staging (sibling of v1's compose) |
| [.dockerignore](.dockerignore) | Excludes node_modules / .next / .env / resources from build context |
| [render.yaml](render.yaml) | Render deploy spec (parallel target, independent of Docker) |
| [../../platform/nginx/apps.amoeba.site.conf](../../platform/nginx/apps.amoeba.site.conf) | nginx `location /app-car-manager-v2/` → `next-car-manager-v2:3001` container |
| [../../platform/scripts/deploy-staging.sh](../../platform/scripts/deploy-staging.sh) | Registered as `car-manager-v2` target (single-service + custom health path) |
| [apps/web/next.config.mjs](apps/web/next.config.mjs) | `basePath = process.env.BASE_PATH \|\| undefined` |
| [apps/web/src/middleware.ts](apps/web/src/middleware.ts) | JWT verify + cookie + request-header propagation (see §6) |
| [.env](.env) (gitignored) | `BASE_PATH=/app-car-manager-v2`, `JWT_SECRET` shared, `NEXT_PUBLIC_AMA_ORIGIN` allow-list |
| [.env.example](.env.example) | template with `BASE_PATH` documented |
| `../platform/frontend/vite.config.ts` | Dev proxy `/app-car-manager-v2/*` → `:3001` with `x-forwarded-host` (see §6) |
| `../platform/frontend/src/components/AppCard.tsx` | `APP_ICONS['app-car-manager-v2'] = '🚙'` |
| `../platform/frontend/src/pages/AppDetailPage.tsx` | same icon mapping |
| `../platform/frontend/src/components/SubscriptionCard.tsx` | same icon mapping |
| `../../.env.local` (gitignored) | dev identity profile — fixed UUIDs for `ent_id` / `user_id` |

---

## 3. Local dev — from a fresh checkout

```bash
# A) ambAppStore platform — MySQL :3306, FE :5200, BE :3100
cd <repo-root>
npm install
mysql -h localhost -P 3306 -u root -proot \
  < apps/app-car-manager-v2/scripts/seed-ambappstore-app.sql
npm run dev                  # turbo: FE :5200 + BE :3100 + (4 other apps)

# B) car-manager-v2 — standalone Turborepo
cd apps/app-car-manager-v2
npm install                  # first time only
npm run db:migrate           # apply Drizzle schema to Neon (uses DATABASE_URL from .env)
npm run dev:web              # Next.js :3001 with basePath=/app-car-manager-v2
```

### 3.1 Auto-fill access URLs (paste into address bar)

Identity is fixed in [.env.local](../../.env.local) — these URLs work without typing anything:

```
# 1. Open catalog + set entity context (auto-fills SubscriptionRequestModal)
http://localhost:5200/?ent_id=00000000-0000-0000-0000-000000000010&ent_code=DEMO&ent_name=Demo%20Company&email=dev-owner@dev.car-manager-v2.local

# 2. Mint cookie + jump straight to v2 dashboard
http://localhost:5200/app-car-manager-v2/dev-login?role=OWNER   # → DashboardA as ADMIN
http://localhost:5200/app-car-manager-v2/dev-login?role=MANAGER # → as MANAGER
http://localhost:5200/app-car-manager-v2/dev-login?role=MEMBER  # → as DRIVER
```

`dev-login` is gated by `DEMO_AUTO_LOGIN=true` — must be `false` in production.

### 3.2 Why `BASE_PATH` is env-driven

Setting `basePath` in Next.js makes the app **only** reachable under that prefix. Keeping it driven by `process.env.BASE_PATH`:

- Standalone development of v2 alone: omit `BASE_PATH` → reachable at `http://localhost:3001/`.
- Integrated dev (current setup): `BASE_PATH=/app-car-manager-v2` → reachable at `http://localhost:5200/app-car-manager-v2/` via Vite proxy, mirroring the production nginx layout.

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
Navigates /app-car-manager-v2/
```

To approve without admin UI:
```sql
UPDATE plt_subscriptions
SET sub_status='ACTIVE', sub_approved_at=NOW()
WHERE ent_id='<entity-uuid>'
  AND app_id=(SELECT app_id FROM plt_apps WHERE app_slug='app-car-manager-v2');
```

`ent_code` (in `plt_subscriptions`) is **scoped per app** — same entity can subscribe to multiple apps with the same `ent_code`.

---

## 5. Production / staging deploy

### 5.0 Dual deploy at a glance (D2 — clean Render URL)

v2 ships to **two runtime hosts in parallel**, same code / same DB / same JWT, but **different `BASE_PATH` per host** so each URL is natural:

| | Staging Docker (LAN) | Render (cloud) |
|---|---|---|
| **Build** | `bash platform/scripts/deploy-staging.sh build car-manager-v2` (on staging server) | git push → Render auto-build |
| **Image / Process** | Container `next-car-manager-v2:3001` on `amb-apps-network` | `car-manager-staging` service |
| **External URL** | `https://stg-apps.amoeba.site/app-car-manager-v2/` (via nginx) | `https://car-manager-staging.onrender.com/` (clean, no prefix) |
| **Used by** | All end-user flows through AMA sidebar + ambAppStore catalog | Direct access — QA, API consumers, fallback |
| **`BASE_PATH`** | `/app-car-manager-v2` (build arg in `docker-compose.app-car-manager-v2.yml`) | **(unset)** — render.yaml omits it on purpose |
| **`APP_URL`** | `https://stg-apps.amoeba.site` (set in container `.env`) | `https://car-manager-staging.onrender.com` (set in render.yaml) |
| **`DATABASE_URL`** | Neon staging (same as Render) | Neon staging (same as Docker) |
| **`JWT_SECRET`** | Same as AMA + platform | Same as AMA + platform |
| **`DEMO_AUTO_LOGIN`** | `false` | `false` (set `true` only when actively debugging) |

`BASE_PATH` and `APP_URL` are the two values that intentionally diverge between hosts — every other env var must match byte-for-byte. `JWT_SECRET` mismatch is the most common failure mode.

### 5.1 Layer A — v2 Web on Render

[render.yaml](render.yaml) is already provisioned. First deploy:

1. `git push origin main` — Render auto-builds.
2. Render Dashboard → service `car-manager-staging` → **Environment**:

| Key | Value | Note |
|---|---|---|
| `BASE_PATH` | **DO NOT SET** | D2: Render serves at root for clean URL |
| `JWT_SECRET` | **shared** with AMA + platform (HS256, byte-for-byte) | — |
| `DEMO_AUTO_LOGIN` | **`false`** in normal use, `true` only when debugging | — |
| `NEXT_PUBLIC_AMA_ORIGIN` | `https://ama.amoeba.site https://stg-ama.amoeba.site` | for CSP frame-ancestors |
| `DATABASE_URL` | Neon staging/main branch (pooler URL) | same as Docker container |
| `APP_URL` | `https://car-manager-staging.onrender.com` | Render-direct, NOT stg-apps |
| `AWS_*` | only when wiring S3 (P2+) | — |

⚠️ Render dashboard env vars take **priority over render.yaml**. If you previously set `APP_URL` or `BASE_PATH` in the dashboard, delete them so render.yaml values apply.

3. Manual deploy → verify `https://car-manager-staging.onrender.com/api/v1/health` returns `{"success":true}` (no `/app-car-manager-v2/` prefix on Render under D2).

4. Apply migrations:
   ```bash
   npm run db:migrate:staging  # uses DATABASE_URL_STAGING from local .env
   ```

### 5.2 Layer B — ambAppStore catalog

Idempotent on `app_slug`. Run once per environment:

```bash
# Staging
ssh ambAppStore@stg-apps.amoeba.site \
  "cd ~/ambAppStore && git pull && docker exec -i mysql-apps mysql -uroot -p<PWD> db_app_platform \
   < apps/app-car-manager-v2/scripts/seed-ambappstore-app.sql"

# Production (only after staging is green)
ssh amoeba-shop \
  "cd /var/www/apps_amoeba && git pull && docker exec -i mysql-apps mysql -uroot -p<PWD> db_app_platform \
   < apps/app-car-manager-v2/scripts/seed-ambappstore-app.sql"
```

### 5.3 Layer C — Staging Docker + Nginx route

**Build & start the container** (run on staging server):

```bash
ssh ambAppStore@stg-apps.amoeba.site "cd ~/ambAppStore && git pull && \
  bash platform/scripts/deploy-staging.sh full car-manager-v2"
```

`deploy-staging.sh` knows v2 is single-service (BFF_NAME == WEB_NAME) and uses a custom health path (`/app-car-manager-v2/api/v1/health` because of the basePath). Verify step skips the redundant frontend probe.

Required on the staging server before first build: `apps/app-car-manager-v2/.env` with at minimum `JWT_SECRET` and `DATABASE_URL` (Neon staging URL). Same shape as Render's env vars in §5.1.

**Nginx route** is already committed in [../../platform/nginx/apps.amoeba.site.conf](../../platform/nginx/apps.amoeba.site.conf). On any update:

```bash
ssh ambAppStore@stg-apps.amoeba.site "sudo nginx -t && sudo systemctl reload nginx"
```

The proxy_pass targets the local container (`http://next-car-manager-v2:3001`), NOT Render. This keeps all embedded-flow traffic on the staging LAN (low latency, same network as MySQL + AMA). Render is reached only when the user explicitly browses its `*.onrender.com` URL.

Pitfall: `X-Forwarded-Host` must be forwarded so v2's `getRequestOrigin()` returns `stg-apps.amoeba.site` (not the container hostname). See §6.3.

### 5.4 Layer D — AMA registration (enables AMA sidebar entry)

**Use [scripts/seed-ama-entity-custom-app.sql](scripts/seed-ama-entity-custom-app.sql)** — the primary path. AMA's `amb_partner_apps` lifecycle is only partly implemented (no JWT mint endpoint for `pap_auth_mode='SSO_JWT'`); every embedded app that actually launches on staging today uses `amb_entity_custom_apps`. This is the same pattern as `apps-stock`, `redmine`, etc.

```bash
# Edit the file first to replace <ENT_UUID> + <ADMIN_USER_UUID> placeholders
psql -h 192.168.1.150 -U amb_user -d db_amb \
  -f apps/app-car-manager-v2/scripts/seed-ama-entity-custom-app.sql
```

One row per entity that should see the app. The seed is idempotent on `(ent_id, eca_code)` so re-running per entity is safe. URL contract that AMA constructs on click: `{eca_url}?ama_token={jwt}&locale={lang}`.

For an entity to "see" the app:
1. AMA admin (or entity owner) runs the INSERT once for that `ent_id`
2. AMA sidebar / custom-apps section now shows "Quản lý điều xe v2"
3. Click → AMA mints JWT → redirects to `https://stg-apps.amoeba.site/app-car-manager-v2/?ama_token=...` → nginx → Render → v2 middleware sets cookie → dashboard

The legacy [scripts/seed-ama-partner-app.sql](scripts/seed-ama-partner-app.sql) is kept for documentation only — see its header for the gap details.

### 5.5 Pre-flight checklist

- [ ] `JWT_SECRET` is **identical** across AMA, platform-backend `.env`, and Render `car-manager-staging` env
- [ ] `DEMO_AUTO_LOGIN=false` on Render prod
- [ ] `BASE_PATH=/app-car-manager-v2` on Render
- [ ] `APP_URL` set on Render so `getRequestOrigin()` returns the user-facing domain
- [ ] Seed `plt_apps` ran at least once on target MySQL (verify: `SELECT app_slug FROM plt_apps WHERE app_slug='app-car-manager-v2'`)
- [ ] Nginx config validates: `nginx -t`
- [ ] Health endpoint reachable via the public domain: `curl https://stg-apps.amoeba.site/app-car-manager-v2/api/v1/health`
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

Do **not** use `res.headers.set('x-ent-id', ...)` — that sets **response** headers (sent to the browser), but RSC `headers()` in [get-current-user.ts](apps/web/src/lib/auth/get-current-user.ts) reads **request** headers. With `res.headers.set`, middleware verify succeeds, the page renders 200, but `getCurrentUser` throws `CAR-E0101` because the headers it needs don't exist on the request. Symptom: "Something went wrong" error page on every dashboard load.

### 6.2 Middleware matcher must include `/` explicitly

```ts
export const config = {
  matcher: ['/', '/((?!_next/static|_next/image|favicon.ico).+)'],
};
```

The single-pattern form `'/((?!_next/static|_next/image|favicon.ico).*)'` empirically **does not match the root path `/`** in Next.js 15 with `basePath` enabled. Symptom: middleware never runs for the dashboard, headers never propagate, identical error to §6.1.

Diagnose: add `console.log('[mw]', pathname)` at the top of `middleware()` — if you don't see it for `/`, the matcher is wrong.

### 6.3 Vite proxy + `getRequestOrigin` need `x-forwarded-host`

[vite.config.ts](../platform/frontend/vite.config.ts) forwards `x-forwarded-host` so v2's `getRequestOrigin(req)` returns `localhost:5200` instead of `localhost:3001`. Without it:

- `dev-login` mints a cookie on `localhost:5200` (correct — the browser-facing origin)
- v2 then redirects to `absoluteUrl(req, '/')` → resolves to `http://localhost:3001/` (cross-origin!)
- Browser jumps to `:3001`, doesn't send the cookie (different origin) → middleware redirects to `/session-expired` → infinite loop

Production analog: nginx must send `X-Forwarded-Host $host` (see §5.3) so v2 on Render constructs redirects that point back to `apps.amoeba.site`, not the internal `*.onrender.com` host.

---

## 7. JWT contract (frozen — change in lockstep across all three)

`HS256`, secret = `JWT_SECRET`. Payload AMA issues:

```json
{
  "sub": "<uuid-user>",
  "ent_id": "<uuid-entity>",
  "role": "OWNER | MASTER | MANAGER | MEMBER",
  "email": "...",
  "name": "...",
  "app_code": "car-manager-v2",
  "iss": "amb-management",
  "aud": "car-manager-v2",
  "exp": <unix-seconds>
}
```

- `app_code` mismatch → middleware verify throws → cookie cleared → `/session-expired`.
- `iss` / `aud` are enforced in [verify-jwt.ts](apps/web/src/lib/auth/verify-jwt.ts).
- AMA role → app local role mapping (PRD §4): `OWNER|MASTER → ADMIN`, `MANAGER → MANAGER`, `MEMBER → DRIVER`.

Local `dev-login` and [scripts/dev-token.mjs](scripts/dev-token.mjs) hard-code the same UUIDs as [.env.local](../../.env.local) — change in lockstep.

---

## 8. Runtime flow (production iframe scenario)

```
1. User opens AMA → clicks "Company Car Management v2" in custom-apps sidebar
2. AMA iframe https://apps.amoeba.site/?ent_id=...&ent_code=...&from=iframe
3. ambAppStore platform catalog renders; entity context saved into Zustand
4. User clicks card → /apps/app-car-manager-v2
5. AppDetailPage: subscription ACTIVE → "Use Service" button shows
6. Click → href="/app-car-manager-v2/" → nginx routes to Render
7. v2 middleware:
   a. no cookie → 307 /session-expired
   b. user → AMA → re-issues JWT → redirects /app-car-manager-v2/?ama_token=<jwt>
   c. middleware verifies, sets cookie amb_session (HttpOnly, SameSite=None in prod), redirects to clean URL
8. Dashboard loads — getCurrentUser reads x-ent-id from middleware-injected headers
9. Every subsequent request: cookie is sent → middleware verify → headers → RSC
```

---

## 9. Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| Card not on catalog | seed not applied to that env | re-run `scripts/seed-ambappstore-app.sql` against target `db_app_platform` |
| `/app-car-manager-v2/` 404 via :5200 | v2 not running on :3001 | `cd apps/app-car-manager-v2 && npm run dev:web` |
| `_next/static/...` 404 | `BASE_PATH` not set or doesn't match nginx prefix | restart v2 after `.env` change (env loads once at boot) |
| `Something went wrong` error page after dev-login | §6.1 or §6.2 regressed | check middleware matcher + request-header propagation |
| Loops between `/session-expired` and dashboard | cross-origin redirect, cookie not sticking | §6.3 — confirm `x-forwarded-host` arrives at v2 |
| `401` after pasting `?ama_token=` | `JWT_SECRET` mismatch | grep all three envs, must match byte-for-byte |
| CSP blocks iframe | `NEXT_PUBLIC_AMA_ORIGIN` missing parent origin | add origin space-separated to env, rebuild |
| Card icon shows 📱 | icon map not updated in platform FE | check the 3 files in §2 (AppCard / AppDetailPage / SubscriptionCard) |
| Subscription stuck at PENDING | no admin to approve in dev | run UPDATE SQL in §4 |
| Form fields empty | entity context not set | open via the auto-fill URL §3.1 first, then navigate |

---

## 10. See also

- [README.md](README.md) — first-time setup + dev quickstart
- [CLAUDE.md](CLAUDE.md) — architecture rules + DDD layers + role mapping
- [PRD.md](PRD.md) — MVP business spec
- Root [CLAUDE.md](../../CLAUDE.md) — ambAppStore monorepo conventions
- Root [.env.local](../../.env.local) — fixed dev identity (entity + user UUIDs)
- v1 reference: [apps/app-car-manager/](../app-car-manager/) — older NestJS/Vite stack, same `/app-car-manager/*` routing pattern
