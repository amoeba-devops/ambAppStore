# Company Car Management v2 (CCMS)

> Hệ thống Quản lý Xe Công ty — Điều xe + Kiểm soát chi phí.
> Standalone Turborepo · Next.js 15 fullstack · Neon Postgres · S3 · Render.com.

**Documentation entry**: [CLAUDE.md](CLAUDE.md) (project context, ⭐ đọc trước) · [PRD.md](PRD.md) (business spec MVP) · [User Guide HTML (vi + ko)](apps/web/public/docs/user-guide/index.html) (33 trang × 2 ngôn ngữ, 80 screenshot — phục vụ end-user, không phải dev).

> 🇰🇷 한국어 버전: [README.ko.md](README.ko.md)

---

## 0. TL;DR (đã setup từ trước rồi, chỉ run)

```bash
cd apps/app-car-manager-v2
npm install               # 1. install (lần đầu, ~1 phút, 415 packages)
cp .env.example .env      # 2. copy template
# → Edit .env: paste DATABASE_URL từ Neon Console + đặt JWT_SECRET + DEMO_AUTO_LOGIN=true (dev)
npm run dev:web           # 3. start dev server → http://localhost:3001
# → Mở browser: http://localhost:3001/dev-login?role=OWNER
# → Tự set cookie + redirect /, thấy DashboardA
```

Toàn bộ 14 routes có sẵn (xem §9 dưới).

---

## 1. First-time setup

### 1.1 Cài đặt

```bash
cd apps/app-car-manager-v2
npm install               # standalone workspace, KHÔNG dùng root ambAppStore workspaces
```

Yêu cầu: Node ≥ 20 · npm ≥ 10.

### 1.2 Cấu hình `.env`

```bash
cp .env.example .env
```

Các biến BẮT BUỘC để run dev:

| Biến | Giá trị dev | Giá trị prod |
|---|---|---|
| `JWT_SECRET` | bất kỳ chuỗi non-empty (vd: `dev-only-secret-12345`) | shared secret thật từ ambManagement |
| `DEMO_AUTO_LOGIN` | `true` (cho phép `/dev-login` mint JWT giả) | **`false`** (phải tắt ở prod!) |
| `DATABASE_URL` | Neon connection string (xem §1.3) | Neon staging/main branch |

Các biến KHÁC (có default sẵn, optional):

| Biến | Default | Khi nào set |
|---|---|---|
| `NEXT_PUBLIC_APP_CODE` | `car-manager-v2` | metadata, không cần đổi |
| `NEXT_PUBLIC_AMA_ORIGIN` | `https://ama.amoeba.site` | đổi nếu AMA chạy domain khác |
| `NEXT_PUBLIC_DEFAULT_LOCALE` | `vi` | `en` hoặc `ko` nếu muốn locale khác |
| `SESSION_COOKIE_NAME` | `amb_session` | shared với mọi app trên AMA |
| `AWS_*` | trống | P2 khi wire S3 upload chứng từ |

### 1.3 Neon Postgres setup

1. Sign up free tier: https://neon.tech
2. Create project (region `ap-southeast-1` Singapore)
3. Physical DB name = `neondb` (default Neon, không cần đổi — xem [CLAUDE.md §4.3](CLAUDE.md))
4. Copy connection string **dạng pooler** (Connection details → Pooled connection):
   ```
   postgresql://neondb_owner:<pwd>@ep-xxx-pooler.<region>.aws.neon.tech/neondb?sslmode=require&channel_binding=require
   ```
5. Paste vào `.env` → `DATABASE_URL=...`

### 1.4 Apply DB migrations

```bash
npm run db:migrate        # apply tất cả migrations trong packages/db/migrations/ lên Neon
```

Hiện tại có 1 migration: `0000_new_earthquake.sql` (tạo `car_users` table + enum `car_user_local_role`). Idempotent — chạy nhiều lần OK.

Verify:
```bash
node --env-file=.env -e "import('@neondatabase/serverless').then(async({neon})=>{const r=await neon(process.env.DATABASE_URL)\`SELECT table_name FROM information_schema.tables WHERE table_schema='public'\`;console.log(r)})"
# → expect [{ table_name: 'car_users' }, ...]
```

---

## 2. Run dev (local)

### 2.1 Start web server

```bash
npm run dev:web                # → http://localhost:3001 (Next.js dev), KHÔNG có cron tự fire
npm run dev:full               # → web + cron loop song song, 1 terminal (xem §2.5)
```

Cổng **3001** (cố ý — port 3000 đã bị `app-sales-report-v2` chiếm). `.env` được load qua `dotenv-cli` để Edge middleware thấy `JWT_SECRET`.

### 2.2 Login local (không cần ambManagement real)

Bật `DEMO_AUTO_LOGIN=true` trong `.env`, sau đó có 2 cách:

**Cách A — CLI mint URL** (recommended):
```bash
npm run dev:token              # role OWNER (= ADMIN local), valid 8 giờ
npm run dev:token -- MANAGER   # role MANAGER (= MANAGER local)
npm run dev:token -- MEMBER    # role MEMBER (= DRIVER local)
```
Output dạng:
```
Dev login URL (open in browser, valid 8h):
  http://localhost:3001/?ama_token=eyJhbGc...
```
→ Paste vào browser → middleware verify JWT → set HttpOnly cookie → redirect `/` → thấy DashboardA.

**Cách B — Direct route**:
```
http://localhost:3001/dev-login?role=OWNER
```
Tự set cookie + redirect `/`. Param `?next=/trips` để landing path khác.

### 2.3 Verify đang chạy

```bash
curl http://localhost:3001/api/v1/health
# → {"success":true,"data":{"status":"ok","service":"car-manager-staging",...}}
```

### 2.4 Đổi language UI

URL sẽ tự dùng `NEXT_PUBLIC_DEFAULT_LOCALE` (mặc định `vi`). Để đổi, sửa `.env` → restart server. Roadmap: P1+ sẽ thêm language switcher trong UI.

### 2.5 Run dev kèm maintenance-alert cron loop

Module 2 (Expense + Maintenance) có endpoint `POST /api/v1/cron/maintenance-alert` evaluate hàng ngày trên staging/prod. Khi dev local, có 3 mode:

| Command | Cron auto-fire? | Khi nào dùng |
|---|---|---|
| `npm run dev:web` | ❌ | **Default** — iter UI nhanh, không gọi cron |
| `npm run dev:full` | ✅ mỗi `CRON_INTERVAL_SECONDS` (default 60s) | Khi cần test luồng cron + notification end-to-end |
| `npm run cron:maintenance` | One-shot | Manual trigger cron 1 lần (cần dev server chạy ở terminal khác) |

`dev:full` dùng `concurrently` chạy `dev:web` + `dev:cron` song song trong 1 terminal (output prefix `[web]` cyan và `[cron]` magenta). Yêu cầu `CRON_SECRET` trong `.env`:

```bash
echo 'CRON_SECRET=local-dev-cron-secret-change-me' >> .env

# Default 60s
npm run dev:full

# Test nhanh 15s (Bash / WSL / macOS)
CRON_INTERVAL_SECONDS=15 npm run dev:full

# Windows PowerShell
$env:CRON_INTERVAL_SECONDS="15"; npm run dev:full
```

`dev-cron-loop.mjs` poll `/api/v1/health` đến khi 200 trước fire đầu (tránh 404 lúc Next.js compile). Ctrl+C dừng cả 2 process.

Idempotency 24h vẫn áp dụng → mỗi xe chỉ tạo 1 alert/loại trong cửa sổ 24h. Reset alert để test lại:

```sql
UPDATE car_maintenance_alerts SET mal_resolved_at = NOW() WHERE mal_resolved_at IS NULL;
```

---

## 3. Database migrations

### 3.1 Multi-branch setup (DEV + STAGING)

`.env` chứa 3 URL keys:
- `DATABASE_URL` — branch hiện đang dùng cho local app (dev server đọc)
- `DATABASE_URL_DEV` — fixed pointer đến dev branch
- `DATABASE_URL_STAGING` — fixed pointer đến staging branch

3 commands target từng branch tương ứng:

```bash
npm run db:migrate              # uses DATABASE_URL (active branch — usually dev)
npm run db:migrate:dev          # forces DATABASE_URL_DEV
npm run db:migrate:staging      # forces DATABASE_URL_STAGING
```

`db:migrate:dev|staging` override `DATABASE_URL` trong child process (in-memory),
KHÔNG sửa `.env` trên đĩa. Password được mask trong log.

### 3.2 Workflow khi thêm bảng / cột mới

```bash
# 1. Edit/add schema file
#    packages/db/src/schema/<table>.schema.ts
#    Export trong packages/db/src/schema/index.ts

# 2. Generate migration SQL
npm run db:generate
# → tạo packages/db/migrations/NNNN_<name>.sql (drizzle tự đặt tên)

# 3. Review SQL trước khi apply
cat packages/db/migrations/NNNN_*.sql

# 4. Apply lên dev branch (test local)
npm run db:migrate:dev

# 5. Khi PR pass review → apply staging trước khi merge
npm run db:migrate:staging

# 6. Commit migration files + push → Render auto-deploys với staging schema đã đúng
git add packages/db/migrations/ packages/db/src/schema/
git commit -m "feat: add car_vehicles schema"
git push origin main
```

### 3.2 Drizzle Studio (web UI inspect DB)

```bash
npm run db:studio              # → https://local.drizzle.studio (proxy)
```

### 3.3 ⚠️ `db:push` (destructive — chỉ dev branch)

```bash
npm run db:push                # interactive — push schema trực tiếp, KHÔNG sinh migration file
```
Nên dùng `db:generate + db:migrate` thay thế để có migration history.

### 3.4 Reset Neon dev branch

Neon Console → Branches → `dev` → Reset from parent. Sau đó:
```bash
npm run db:migrate             # re-apply tất cả migrations từ đầu
```

---

## 4. Build · typecheck · lint · test

```bash
npm run typecheck              # tsc --noEmit cho 4 workspaces (turbo cache)
npm run build                  # next build (production output)
npm run lint                   # ESLint (next/core-web-vitals)
npm run format                 # Prettier write
npm run test                   # Vitest (P6 — chưa có test files)
```

---

## 5. Deployment to Render.com

### 5.1 First-time provisioning

1. Tạo Render account → connect GitHub repo
2. Dashboard → **New** → **Blueprint** → chọn repo + branch (`main` cho staging)
3. Render auto-detect `apps/app-car-manager-v2/render.yaml` → provision:
   - `car-manager-staging` (Web Service, **Starter** plan $7/mo)
4. **Vào service** → tab **Environment** → set các `sync: false` vars:

| Var | Giá trị |
|---|---|
| `JWT_SECRET` | secret thật từ ambManagement (match byte-for-byte) |
| `DATABASE_URL` | Neon `staging` branch connection string |
| `NEXT_PUBLIC_AMA_ORIGIN` | `https://ama.amoeba.site` |
| `DEMO_AUTO_LOGIN` | ⚠️ **`false`** (TUYỆT ĐỐI KHÔNG `true` ở prod) |
| `AWS_REGION` | `ap-southeast-1` (P2+) |
| `AWS_S3_BUCKET` | tên bucket (P2+) |
| `AWS_ACCESS_KEY_ID` | IAM key (P2+) |
| `AWS_SECRET_ACCESS_KEY` | IAM secret (P2+) |

5. Click **Manual Deploy** → wait ~3-5 phút build
6. Verify: `curl https://car-manager-staging.onrender.com/api/v1/health`

### 5.2 Tiếp tục deploy (sau khi setup xong)

```bash
git push origin main           # → Render auto-build + deploy ~3 phút
```

Đẩy lên main branch (đã chốt CI/CD pattern). Render tự rebuild khi push.

### 5.3 Apply migration lên prod DB

```bash
# Cách 1 (khuyến nghị): dùng named script — local với .env đã có DATABASE_URL_STAGING
npm run db:migrate:staging

# Cách 2: One-off với prod main branch URL
DATABASE_URL=postgresql://...@main-branch... npm run db:migrate

# Cách 3: Render service shell (env đã set sẵn DATABASE_URL → staging)
# Dashboard → car-manager-staging → Shell → npm run db:migrate
```

### 5.4 Rollback

Dashboard → service → tab **Deploys** → click **Rollback** trên build trước.

### 5.5 Logs

Dashboard → service → tab **Logs** (live tail).

### 5.6 Custom domain

Dashboard → service → tab **Settings** → **Custom Domains** → add domain → cập nhật DNS CNAME tới `car-manager-staging.onrender.com`. Update `NEXT_PUBLIC_AMA_ORIGIN` nếu cần khớp domain mới.

---

## 6. Maintenance-alert cron — 3 môi trường

`POST /api/v1/cron/maintenance-alert` quét toàn bộ xe theo từng tenant, tạo alert OIL/INSPECTION + fan-out notification cho Admin/Manager. Auth bằng `Authorization: Bearer $CRON_SECRET`. Idempotency 24h (1 xe + 1 type → 1 alert / 24h).

### 6.1 Bảng tổng hợp

| Môi trường | Cách trigger | Schedule | Trạng thái |
|---|---|---|---|
| **Local dev (manual)** | `npm run cron:maintenance` | On-demand | ✅ Ready |
| **Local dev (auto-loop)** | `npm run dev:full` (xem §2.5) | `CRON_INTERVAL_SECONDS` (default 60s) | ✅ Ready |
| **Staging Docker** (Vietnam server) | Sidecar `cron-maintenance-v2` trong [docker-compose](docker-compose.app-car-manager-v2.yml) | `0 6 * * *` ICT (06:00 hàng ngày) | ✅ Ready, auto-deploy via `deploy-staging.sh` |
| **Render.com (optional)** | Stub trong [render.yaml](render.yaml) (đang comment) | `0 23 * * *` UTC = 06:00 ICT | ⏸️ Defer per REQ-20260519 D9 |

### 6.2 Docker sidecar (staging Vietnam server)

Service `cron-maintenance-v2` trong [docker-compose.app-car-manager-v2.yml](docker-compose.app-car-manager-v2.yml) dùng `alpine:3.20` + `crond`. Gọi container chính qua Docker DNS nội bộ (không qua nginx).

**Deploy lần đầu**:

```bash
# 1. SSH vào staging, set CRON_SECRET trong .env
ssh ambAppStore@stg-apps.amoeba.site
cd ~/ambAppStore/apps/app-car-manager-v2
openssl rand -hex 32                                                # → copy output
echo "CRON_SECRET=<paste-secret>" >> .env
echo "EXPENSE_LOCK_DAYS=7" >> .env
exit

# 2. Deploy (script tự pickup cron-maintenance-v2 service)
ssh ambAppStore@stg-apps.amoeba.site \
  "cd ~/ambAppStore && git pull origin main && bash platform/scripts/deploy-staging.sh full car-manager-v2"
```

**Verify trên staging**:

```bash
ssh ambAppStore@stg-apps.amoeba.site << 'EOF'
cd ~/ambAppStore/apps/app-car-manager-v2
docker compose -f docker-compose.app-car-manager-v2.yml ps cron-maintenance-v2
docker logs cron-maintenance-v2 --tail 20            # boot log: "ready · schedule: 06:00 daily"
docker exec cron-maintenance-v2 cat /etc/crontabs/root
# Manual fire (không cần đợi 06:00)
docker exec cron-maintenance-v2 /usr/local/bin/run-cron
EOF
```

**Operational**:

```bash
docker logs -f cron-maintenance-v2                                                       # tail log
docker exec cron-maintenance-v2 /usr/local/bin/run-cron                                  # manual fire
docker compose -f docker-compose.app-car-manager-v2.yml restart cron-maintenance-v2      # restart riêng sidecar
docker compose -f docker-compose.app-car-manager-v2.yml stop cron-maintenance-v2         # tạm dừng (giữ app)
```

### 6.3 Render.com cron (defer)

Block `type: cron` trong [render.yaml](render.yaml) hiện đang comment per REQ-20260519 decision D9 — chỉ enable sau khi verify staging stable. Khi sẵn sàng:

1. Uncomment block trong `render.yaml`
2. Render dashboard → cron service → set env `CRON_SECRET` (cùng giá trị với web service)
3. Push → Render deploy cron job

---

## 7. Integration với ambManagement

### 7.1 Đăng ký app trên AMA

ambManagement → Admin → Custom Apps → insert record (hoặc SQL):
```sql
INSERT INTO amb_entity_custom_apps (eca_code, eca_url, eca_auth_mode, eca_open_mode, eca_name)
VALUES ('car-manager-v2', 'https://<render-domain>', 'jwt', 'iframe', 'Company Car Management');
```

### 7.2 Cấu hình shared JWT_SECRET

Cả ambManagement (issuer) và car-manager-v2 (verifier) phải dùng **cùng 1 `JWT_SECRET`** (HS256, byte-for-byte). Thay `JWT_SECRET` trong cả 2 hệ thống đồng thời.

### 7.3 JWT payload AMA phải issue

```json
{
  "sub": "<uuid-user>",
  "ent_id": "<uuid-entity>",
  "role": "OWNER | MASTER | MANAGER | MEMBER",
  "email": "...",
  "name": "...",
  "app_code": "car-manager-v2",
  "iss": "amb-management",
  "aud": "car-manager-v2"
}
```

### 7.4 AMA redirect / iframe URL

```
https://<car-manager-v2-domain>/?ama_token=<JWT>
```
Hoặc `<iframe src="...">`. Middleware tự verify → set HttpOnly cookie `amb_session` → redirect tới clean URL → app dùng cookie cho mọi request sau.

Chi tiết: [CLAUDE.md §5](CLAUDE.md).

---

## 8. Repository layout

```
apps/app-car-manager-v2/
├── CLAUDE.md, README.md, PRD.md         # entry docs (đọc CLAUDE trước)
├── package.json, turbo.json             # workspace config
├── tsconfig.base.json
├── .env, .env.example                   # env (gitignored), template
├── render.yaml                          # Render Blueprint (1 web service)
│
├── apps/
│   └── web/                             # Next.js 15 fullstack
│       ├── src/
│       │   ├── app/                     # 14 routes (xem §9)
│       │   ├── components/              # primitives + layout shells
│       │   ├── i18n/                    # next-intl config
│       │   ├── lib/                     # auth + request helpers
│       │   └── middleware.ts            # JWT passthrough
│       └── messages/                    # en/vi/ko.json
│
├── packages/
│   ├── db/                              # Drizzle schema + migrations
│   │   ├── src/schema/                  # car_users.schema.ts + future tables
│   │   └── migrations/                  # 0000_new_earthquake.sql ...
│   ├── shared/                          # Zod + AmaJwtClaims + CarError
│   └── ui/                              # cn() Tailwind util
│
├── scripts/
│   └── dev-token.mjs                    # CLI mint dev JWT
│
├── resources/                           # gitignored — design reference
│   └── claude-design/                   # Claude Design export bundle
│
└── docs/                                # workflow docs
    ├── analysis/                        # REQ-YYYYMMDD-* (prd-srs audit, etc.)
    ├── plan/                            # PLAN-YYYYMMDD-*
    ├── test/                            # TC-*, TR-*
    ├── implementation/                  # RPT-*
    └── log/                             # daily log (gitignored)
```

---

## 9. Available routes (P0 scaffold)

| Route | Phase | Description |
|---|---|---|
| `/` | ✅ P0 | DashboardA (Operations overview, full UI) |
| `/trips` | 🚧 P1 | Trip list (placeholder) |
| `/trips/new` | 🚧 P1 | New trip form (placeholder) |
| `/trips/[id]` | 🚧 P1 | Trip detail (placeholder) |
| `/costs` | 🚧 P2 | Expense list + approval queue (placeholder) |
| `/vehicles` | 🚧 P1 | Vehicle list (placeholder) |
| `/vehicles/[id]` | 🚧 P1 | Vehicle detail (placeholder) |
| `/drivers` | 🚧 P1 | Driver list (placeholder) |
| `/drivers/[id]` | 🚧 P1 | Driver detail (placeholder) |
| `/users` | 🚧 P1 | User & roles (placeholder) |
| `/reports` | 🚧 P3 | Reports + export (placeholder) |
| `/settings` | 🚧 P1 | Approval rules + policies (placeholder) |
| `/audit` | 🚧 P1 | Audit log (placeholder) |
| `/api/v1/health` | ✅ P0 | Health check (public, returns service name) |
| `/session-expired` | ✅ P0 | Public fallback khi cookie hết hạn |
| `/dev-login` | ✅ P0 | Local-only dev JWT minter (gated bởi `DEMO_AUTO_LOGIN=true`) |

Sidebar nav active state tự derive từ `usePathname()` — click qua lại các route, active highlight di chuyển đúng.

---

## 10. Troubleshooting

| Triệu chứng | Nguyên nhân | Fix |
|---|---|---|
| `EADDRINUSE :::3001` | Server cũ chưa kill | Windows: `Get-NetTCPConnection -LocalPort 3001 -State Listen \| ForEach-Object { Stop-Process -Id $_.OwningProcess -Force }` · Mac/Linux: `lsof -ti:3001 \| xargs kill -9` |
| `/dev-login` trả 404 | `DEMO_AUTO_LOGIN ≠ 'true'` | Edit `.env` → `DEMO_AUTO_LOGIN=true` → **kill + restart dev server** (env chỉ load 1 lần lúc boot) |
| `401 Unauthorized` khi paste `?ama_token=` | JWT verify fail (sai secret / hết hạn / app_code mismatch) | Regen via `npm run dev:token`; confirm `JWT_SECRET` cùng giá trị giữa minter + verifier |
| `307 → /session-expired` ngay sau login | Cookie không stick (sameSite/secure mismatch trong iframe / cross-domain) | Local: middleware tự dùng `sameSite=lax`; prod cần HTTPS + `sameSite=none` |
| **Click sidebar redirect liên tục về `/session-expired`** | Cookie `amb_session` từ sibling v2 app (vd sales-report-v2 port 3000) lẫn vào → `app_code` mismatch khi Zod parse | Middleware tự delete bad cookie (đã fix). Vào `/session-expired` → click "Sign in as ADMIN" để mint fresh cookie. Hoặc manual: DevTools → Application → Cookies → xoá `amb_session` cho `localhost` |
| `JWT_SECRET is required` | `.env` không load | Confirm `dotenv -e ../../.env --` prefix trong `apps/web/package.json` dev script |
| `DATABASE_URL is required for drizzle-kit` | `.env` không load khi chạy `db:*` | Chạy từ root `app-car-manager-v2/` (scripts dùng `dotenv -e ../../.env --`) |
| `cannot find module @car-v2/db` | Workspace symlink chưa tạo | `npm install` lại (lần đầu sau clone) |
| `Pretendard font không hiển thị` | CDN bị chặn | Check Network tab → jsdelivr.net 200 OK · alternative: bundle local font |
| Active sidebar không update khi navigate | `<Link>` không re-render Client Component | Refresh page; nếu vẫn lỗi, check `usePathname()` trong `nav-list.tsx` |

---

## 11. Quick reference — npm scripts

```bash
# Dev workflow
npm run dev:web              # start Next.js dev → http://localhost:3001 (KHÔNG có cron auto)
npm run dev:cron             # cron loop only (cần dev:web ở terminal khác)
npm run dev:full             # web + cron song song, 1 terminal (xem §2.5)
npm run dev:token            # mint dev JWT URL
npm run dev:token -- MANAGER # role variant

# Cron (Module 2 maintenance-alert)
npm run cron:maintenance     # manual one-shot trigger (đọc CRON_SECRET + TARGET_URL từ env)
                             # → mặc định http://localhost:3001
                             # → override staging: TARGET_URL=https://... CRON_SECRET=... npm run cron:maintenance

# Build
npm run typecheck            # tsc --noEmit (turbo cached)
npm run build                # next build (production)
npm run lint                 # ESLint
npm run format               # Prettier write

# DB
npm run db:generate          # Drizzle: schema → migration SQL
npm run db:migrate           # apply to active DATABASE_URL
npm run db:migrate:dev       # apply to DATABASE_URL_DEV (explicit)
npm run db:migrate:staging   # apply to DATABASE_URL_STAGING (explicit)
npm run db:push              # ⚠️ destructive direct push (dev only)
npm run db:studio            # web UI inspect DB (uses active DATABASE_URL)

# Cleanup
npm run clean                # rm node_modules + .turbo
```

---

## 11.5 User Guide HTML (vi + ko)

End-user-facing HTML documentation lives at `apps/web/public/docs/user-guide/`
and is served by Next.js as static assets (URL: `/docs/user-guide/`).

```powershell
# from apps/app-car-manager-v2/
.\scripts\user-guide.ps1            # start dev + open browser (default: view)
.\scripts\user-guide.ps1 status     # show what's up
.\scripts\user-guide.ps1 shots      # re-run all Playwright shots (80 PNGs)
.\scripts\user-guide.ps1 shots vi   # only vi desktop+mobile
.\scripts\user-guide.ps1 shots ko   # only ko desktop+mobile
.\scripts\user-guide.ps1 build      # regenerate KO skeleton + heading translator + search index
.\scripts\user-guide.ps1 seed       # chain db-seed + seed-user-guide
.\scripts\user-guide.ps1 stop       # kill dev server
.\scripts\user-guide.ps1 help       # all subcommands
```

**Content**: 33 trang × 2 ngôn ngữ (66 trang) · 80 screenshot · search box client-side
(no server, ~25 KB JSON index per locale) · print-friendly CSS · 4 role landings.

**Updating** when UI changes:
1. `.\scripts\user-guide.ps1 seed` — ensure DB has demo data
2. `.\scripts\user-guide.ps1 shots` — re-shoot all 80 PNGs (~5 min)
3. Review diff in `apps/web/public/docs/user-guide/assets/img/screenshots/`
4. If page text changed, edit `vi/` HTML manually
5. `.\scripts\user-guide.ps1 build` — regenerate KO from VI + search index
6. Commit

See [docs/plan/PLAN-20260524-user-guide-html-vietnamese.md](docs/plan/PLAN-20260524-user-guide-html-vietnamese.md)
and [docs/implementation/RPT-20260524-user-guide-html-vietnamese.md](docs/implementation/RPT-20260524-user-guide-html-vietnamese.md) for full delivery context.

---

## 12. See also

- [CLAUDE.md](CLAUDE.md) — ⭐ project context for Claude Code (read first)
- [PRD.md](PRD.md) — MVP source of truth (business spec)
- [docs/analysis/REQ-20260512-prd-srs-audit.md](docs/analysis/REQ-20260512-prd-srs-audit.md) — divergence audit PRD ↔ SRS ↔ Prototype
- [resources/claude-design/](resources/claude-design/) — design reference (gitignored, 48 MB)
- Root [CLAUDE.md](../../CLAUDE.md) — `ambAppStore` monorepo conventions
- Sibling [apps/app-sales-report-v2/](../app-sales-report-v2/) — template stack reference
