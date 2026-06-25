---
title: Render Deploy — First-time Guide
description: Step-by-step deploy v2 lên Render.com via Blueprint + view production demo qua dev token.
load-when: First-time Render deploy / setting up new env / debugging deploy issues.
status: ready
---

# Render Deploy — Step by step

> Current state: ✅ build verified production-ready locally. All 11 routes render. Theme tokens applied. Auth flow tested. Cần bạn setup Render account + env vars.

## 1. Pre-flight check (đã verify locally)

| Item | Status |
|---|---|
| `npm install --include=dev` works | ✅ |
| `next build` works với NODE_ENV=production | ✅ 13 routes generated |
| FIRGI brand colors compiled vào CSS | ✅ `rgb(246 244 239)` etc. |
| Health endpoint `/api/v1/health` returns 200 JSON | ✅ |
| Auth middleware verifies JWT, sets cookie | ✅ |
| Dashboard renders với mock KPI cards | ✅ |
| Sidebar role-aware filter | ✅ 3 roles tested |
| `render.yaml` 4 services manifest | ✅ at `apps/app-sales-report-v2/render.yaml` |

## 2. Render setup (5-10 phút bạn cần làm)

### 2.1 Create Render account
- https://render.com/register (login GitHub OK)
- Free tier đủ cho deploy đầu

### 2.2 Connect GitHub repo
- Dashboard → **Connect GitHub** → install Render app
- Select repo `amoeba-devops/ambAppStore` → grant access

### 2.3 Create Blueprint
- Dashboard → **New** → **Blueprint**
- Connect repo `ambAppStore`
- Branch: `huy/setup-sale-report-v2`
- **Blueprint file path**: `apps/app-sales-report-v2/render.yaml` ⭐ (default tìm ở root, phải đổi)
- Click **Apply**

Render sẽ phát hiện 4 services từ `render.yaml`:
- `sales-report-v2-web` (Web Service)
- `sales-report-v2-worker` (Background Worker)
- `sales-report-v2-daily-user-sync` (Cron 19:00 UTC daily = 02:00 ICT)
- `sales-report-v2-retry-failed` (Cron */15min)

### 2.4 Set env vars (cho mỗi service)

Per render.yaml, env vars `sync: false` cần set manual qua dashboard. Click vào từng service → **Environment** tab:

#### Web service (`sales-report-v2-web`)
| Key | Value | Note |
|---|---|---|
| `JWT_SECRET` | `dev-local-secret-replace-when-integrating-with-ama` | Phải match value trong local `.env` (để mint token validate được) |
| `DATABASE_URL` | `postgresql://neondb_owner:npg_xxx@ep-falling-sun-aorafvdk-pooler.c-2.ap-southeast-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require` | Neon dev branch URL từ local `.env` |
| `NEXT_PUBLIC_AMA_ORIGIN` | `https://ama.amoeba.site` | Hoặc bất kỳ — không impact MVP demo |
| `AWS_REGION` | `ap-southeast-1` | Optional cho demo (chưa dùng S3) |
| `AWS_S3_BUCKET` | `(empty)` | |
| `AWS_ACCESS_KEY_ID` | `(empty)` | |
| `AWS_SECRET_ACCESS_KEY` | `(empty)` | |

#### Worker (`sales-report-v2-worker`)
| Key | Value |
|---|---|
| `DATABASE_URL` | same as web |
| `AWS_*` | empty (chưa dùng) |

#### Cron jobs (cả 2)
| Key | Value |
|---|---|
| `DATABASE_URL` | same as web |

### 2.5 Deploy
- Click **Apply blueprint** → Render auto-build + deploy
- First build ~3-5 phút
- Web service: `https://sales-report-v2-web.onrender.com` (default URL)
- Worker: runs polling loop (idle vì chưa có job in queue)
- Cron: scheduled nhưng chưa fire lần đầu

### 2.6 Verify deployment

Health check (no auth):
```bash
curl https://sales-report-v2-web.onrender.com/api/v1/health
# → {"success":true,"data":{"status":"ok","service":"sales-report-v2-web","timestamp":"..."}}
```

If 200 OK → deploy thành công.

## 3. ⭐ Quick demo view (no CLI needed) — DEMO_AUTO_LOGIN

Bật env var `DEMO_AUTO_LOGIN=true` trên Render service (Environment tab) → page `/session-expired` sẽ hiển thị **3 nút demo login** (Admin / Manager / Operator). Click → cookie set tự động → vào dashboard.

```
1. Render dashboard → sales-report-v2-web → Environment
2. Add: DEMO_AUTO_LOGIN = true
3. Save → service auto-restart ~30s
4. Mở https://<your-app>.onrender.com/
   → /session-expired hiển thị 3 nút "Login as Admin/Manager/Operator"
5. Click bất kỳ nút → /dev-login route mint token → cookie set → /dashboard
```

⚠️ **CHỈ enable cho demo/staging.** Set `DEMO_AUTO_LOGIN=false` (hoặc remove) khi go-live prod thật.

---

## 4. Alternative: mint JWT từ local CLI (no DEMO_AUTO_LOGIN needed)

Render KHÔNG có UI để mint test JWT. Bạn phải mint từ local + paste URL vào browser.

### 3.1 Update local `.env` to match Render JWT_SECRET

Đảm bảo local `.env` có cùng `JWT_SECRET` với Render. Nếu Render dùng value mới, cập nhật local:
```
JWT_SECRET=<same as Render>
```

### 3.2 Mint token với prod URL

```bash
cd apps/app-sales-report-v2
DEV_WEB_URL=https://sales-report-v2-web.onrender.com npm run dev:token
```

Output:
```
Dev login URL (open in browser, valid 8h):
  https://sales-report-v2-web.onrender.com/?ama_token=eyJ...
```

### 3.3 Mở URL trong browser
- Token verify → cookie set → redirect tới `/dashboard`
- Bạn thấy:
  - Sidebar bên trái với 5 nav sections (Operations, Master Data, Reports, Audit + Dashboard)
  - Header top với role badge (ADMIN orange) + avatar
  - Dashboard có 4 KPI cards mock Apr 2026 data
  - Click vào /upload, /manual-input, ... → placeholder cards với FR + task ID

### 3.4 Test role-based view
```bash
DEV_WEB_URL=https://sales-report-v2-web.onrender.com npm run dev:token -- MANAGER
DEV_WEB_URL=https://sales-report-v2-web.onrender.com npm run dev:token -- MEMBER
```

Sidebar tự filter theo role.

## 4. What you'll see (MVP shell state)

| Route | Render | Note |
|---|---|---|
| `/dashboard` | ✅ KPI cards mock data | Real KPIs sau khi F-1 + F-4 done |
| `/upload` | ⚪ Placeholder | F-1 (Smart Drop Zone) chưa implement |
| `/manual-input` | ⚪ Placeholder | F-2 |
| `/cost-master/prime-cost` | ⚪ Placeholder | F-3 |
| `/reports/weekly` | ⚪ Placeholder | F-4 |
| `/activity-log/{login,action,download}` | ⚪ Placeholder | F-5 |
| `/session-expired` | ✅ Static message | Default redirect khi no auth |

All routes có sidebar + header role-aware.

## 5. Known limitations of demo deploy

| Issue | Workaround |
|---|---|
| Token mint phải qua local CLI | Render shell có thể chạy `npm run dev:token` nhưng phức tạp |
| JWT_SECRET dev = JWT_SECRET prod (cùng value) | Acceptable cho demo, KHÔNG cho real production |
| Worker idle (no upload pipeline yet) | Expected — implement Phase 2 F-1 |
| Cron jobs no-op | Expected — implement Phase 2 |
| KPI là mock April 2026 data | Real data sau khi user upload |
| Free tier cold start ~30s sau idle 15min | Upgrade Starter $7/mo nếu cần always-on |

## 6. Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| Build fail "Module not found" | DevDeps not installed | Verify `npm install --include=dev` trong render.yaml buildCommand |
| `JWT_SECRET is required` error | Env var không set | Render dashboard → service → Environment → add |
| All requests 401 | JWT_SECRET mismatch local vs Render | Sync values |
| Health 200 nhưng dashboard fail | DATABASE_URL invalid | Check Neon URL still valid + sslmode |
| 502 Bad Gateway | App crashed / port mismatch | Logs → check `PORT` env, `next start` reads `process.env.PORT` auto |
| FIRGI colors không show | Tailwind CSS missing | Verify `tailwindcss` in apps/web devDependencies + buildCommand has `--include=dev` |
| Cookie không set in browser | `secure: true` trên http | Render auto-HTTPS — should work. Local http://localhost không work với prod mode. |

## 7. Logs

Render dashboard → service → **Logs** tab (live tail).

Key things to monitor:
- Web: HTTP request logs, middleware verify failures
- Worker: `[worker] starting workerId=...` + poll log every 2s
- Cron: one-shot exec output

## 8. Cost estimate

| Service | Plan | $/mo |
|---|---|---|
| Web (Starter) | always-on | $7 |
| Worker (Starter) | always-on | $7 |
| Cron × 2 | run-on-schedule | $1 each |
| Neon dev branch | Launch | $19 |
| **Total** | | **~$35/mo** |

→ Có thể dùng Free tier cho web/worker để test ($0), nhưng cold-start chậm + sleep sau 15min idle.

## 9. Production hardening (Phase 2)

Sau khi MVP work:
- [ ] Generate fresh `JWT_SECRET` cho prod (KHÔNG share local)
- [ ] Separate Neon `main` branch cho prod + run migrations qua CI
- [ ] Custom domain `sales-v2.apps.amoeba.site` + SSL
- [ ] Register app trong AMA Custom Apps registry
- [ ] Add Sentry/observability nếu cần
- [ ] Rate limiting cho API routes
- [ ] AWS credentials cho real S3 upload
- [ ] Backup strategy cho Neon

## See also

- [render.yaml](../../render.yaml) — 4 services manifest
- [DEPLOYMENT.md](../architecture/DEPLOYMENT.md) — env strategy + Neon branching
- [NEON-SETUP.md](NEON-SETUP.md) — Neon provisioning
- Render docs: https://render.com/docs/infrastructure-as-code
