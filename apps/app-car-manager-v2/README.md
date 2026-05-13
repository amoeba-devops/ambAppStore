# Company Car Management v2 (CCMS)

> Hệ thống Quản lý Xe Công ty — Điều xe + Kiểm soát chi phí.
> Standalone Turborepo · Next.js 15 fullstack · Neon Postgres · S3 · Render.com.

**Documentation entry**: [CLAUDE.md](CLAUDE.md) (project context, ⭐ đọc trước) · [PRD.md](PRD.md) (business spec MVP).

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
npm run dev:web                # → http://localhost:3001 (Next.js dev)
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
# → {"success":true,"data":{"status":"ok","service":"car-manager-v2-web",...}}
```

### 2.4 Đổi language UI

URL sẽ tự dùng `NEXT_PUBLIC_DEFAULT_LOCALE` (mặc định `vi`). Để đổi, sửa `.env` → restart server. Roadmap: P1+ sẽ thêm language switcher trong UI.

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
   - `car-manager-v2-web` (Web Service, **Starter** plan $7/mo)
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
6. Verify: `curl https://car-manager-v2-web.onrender.com/api/v1/health`

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
# Dashboard → car-manager-v2-web → Shell → npm run db:migrate
```

### 5.4 Rollback

Dashboard → service → tab **Deploys** → click **Rollback** trên build trước.

### 5.5 Logs

Dashboard → service → tab **Logs** (live tail).

### 5.6 Custom domain

Dashboard → service → tab **Settings** → **Custom Domains** → add domain → cập nhật DNS CNAME tới `car-manager-v2-web.onrender.com`. Update `NEXT_PUBLIC_AMA_ORIGIN` nếu cần khớp domain mới.

---

## 6. Integration với ambManagement

### 6.1 Đăng ký app trên AMA

ambManagement → Admin → Custom Apps → insert record (hoặc SQL):
```sql
INSERT INTO amb_entity_custom_apps (eca_code, eca_url, eca_auth_mode, eca_open_mode, eca_name)
VALUES ('car-manager-v2', 'https://<render-domain>', 'jwt', 'iframe', 'Company Car Management');
```

### 6.2 Cấu hình shared JWT_SECRET

Cả ambManagement (issuer) và car-manager-v2 (verifier) phải dùng **cùng 1 `JWT_SECRET`** (HS256, byte-for-byte). Thay `JWT_SECRET` trong cả 2 hệ thống đồng thời.

### 6.3 JWT payload AMA phải issue

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

### 6.4 AMA redirect / iframe URL

```
https://<car-manager-v2-domain>/?ama_token=<JWT>
```
Hoặc `<iframe src="...">`. Middleware tự verify → set HttpOnly cookie `amb_session` → redirect tới clean URL → app dùng cookie cho mọi request sau.

Chi tiết: [CLAUDE.md §5](CLAUDE.md).

---

## 7. Repository layout

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

## 8. Available routes (P0 scaffold)

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

## 9. Troubleshooting

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

## 10. Quick reference — npm scripts

```bash
# Dev workflow
npm run dev:web              # start Next.js dev → http://localhost:3001
npm run dev:token            # mint dev JWT URL
npm run dev:token -- MANAGER # role variant

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

## 11. See also

- [CLAUDE.md](CLAUDE.md) — ⭐ project context for Claude Code (read first)
- [PRD.md](PRD.md) — MVP source of truth (business spec)
- [docs/analysis/REQ-20260512-prd-srs-audit.md](docs/analysis/REQ-20260512-prd-srs-audit.md) — divergence audit PRD ↔ SRS ↔ Prototype
- [resources/claude-design/](resources/claude-design/) — design reference (gitignored, 48 MB)
- Root [CLAUDE.md](../../CLAUDE.md) — `ambAppStore` monorepo conventions
- Sibling [apps/app-sales-report-v2/](../app-sales-report-v2/) — template stack reference
