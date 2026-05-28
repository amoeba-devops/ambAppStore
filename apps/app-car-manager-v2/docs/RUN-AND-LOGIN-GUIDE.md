# Car Manager v2 — Run & Login Guide

> Hướng dẫn chạy full stack (AMA + car-v2), đăng nhập theo role, và xử lý lỗi login.
> Cập nhật: 2026-05-28. Dựa trên kiểm chứng thực tế (gọi API trực tiếp).

---

## 1. Tổng quan apps + domain

| App | Môi trường | Web | API |
|-----|-----------|-----|-----|
| **AMA** (ambManagement) | Local | http://localhost:5179 | http://localhost:3019/api/v1 |
| | Staging | https://stg-ama.amoeba.site | https://stg-ama.amoeba.site/api/v1 |
| | Prod | https://ama.amoeba.site | https://ama.amoeba.site/api/v1 |
| **car-v2** | Local | http://localhost:3001 | (cùng origin) |
| | Staging (Render, root) | https://car-manager-staging.onrender.com | (cùng origin) |
| | Staging (Docker, embed) | https://stg-apps.amoeba.site/app-car-manager-v2 | (embed trong AMA) |
| | Prod | https://apps.amoeba.site/app-car-manager-v2 | (embed trong AMA) |

> **Topology**: Render serve ở ROOT (`BASE_PATH` rỗng). Docker staging serve dưới prefix `/app-car-manager-v2` (`.env` set `BASE_PATH=/app-car-manager-v2`). AMA iframe vào bản Docker.

---

## 2. Chạy local

### 2.1 AMA (ambManagement)

```bash
cd ambManagement
npm run db:up        # PostgreSQL Docker (amb-postgres, port 5432, db_amb)
npm run dev          # API :3019 + Web :5179 (Turborepo)
```
Yêu cầu: Docker chạy + `env/backend/.env.development` (có `CLAUDE_API_KEY`).
Local `NODE_ENV=development` → **passwordless email-login tự bật** (xem §4).

### 2.2 car-v2

```bash
cd apps/app-car-manager-v2/apps/web
npm run dev          # Next.js :3001 (dotenv -e ../../.env)
```
Seed tài khoản dev (nếu cần):
```bash
cd apps/app-car-manager-v2
node --env-file=.env scripts/seed-dev-accounts.mjs
```

---

## 3. Đăng nhập car-v2 theo role

### 3.1 dev-login (passwordless, mint JWT giả — chỉ khi `DEMO_AUTO_LOGIN=true`)

| Role app | URL |
|---|---|
| ADMIN | http://localhost:3001/dev-login?role=OWNER |
| MANAGER | http://localhost:3001/dev-login?role=MANAGER |
| DRIVER | http://localhost:3001/dev-login?role=MEMBER |

> Render staging đặt `DEMO_AUTO_LOGIN=false` → dev-login TẮT. Dùng email-login (§3.2).

### 3.2 Email-login (form `/login`: mã DN + email)

| Role | Mã DN | Email (local seed) |
|---|---|---|
| ADMIN | `DEV01` | `dev-owner@local.dev` |
| MANAGER | `DEV01` | `dev-manager@local.dev` |
| DRIVER | `DEV01` | `dev-driver@local.dev` |

Luồng (xem `apps/web/src/app/api/auth/login/route.ts`):
1. POST `/api/auth/login` → AMA `POST /auth/email-login {entity_code, email}` → tokens
2. AMA `GET /entity-settings/custom-apps/my` → tìm `app-car-manager-v2` (entity phải đã install app)
3. AMA `POST /entity-settings/custom-apps/:id/token` → mint app token 1h
4. Set cookie `amb_session` + redirect

> **Yêu cầu env car-v2**: `AMA_API_BASE_URL` phải trỏ đúng AMA API (vd staging: `https://stg-ama.amoeba.site/api/v1`). Thiếu → proxy gọi `localhost:3009` → fail.

---

## 4. ⚠️ Cờ bắt buộc cho email-login: `CAR_V2_EMAIL_LOGIN_PASSWORDLESS`

Email-login passwordless bị **gate** ở AMA (`auth.service.emailLogin`):
```
enabled = CAR_V2_EMAIL_LOGIN_PASSWORDLESS === 'true' || NODE_ENV === 'development'
```
- **Local** (`NODE_ENV=development`) → tự bật.
- **Staging/Prod** (`NODE_ENV=production|staging`) → **PHẢI set cờ = true**, nếu không AMA trả **HTTP 501 `E1099`** và mọi email-login fail.

### AMA repo `main` ĐÃ cover đầy đủ — KHÔNG cần sửa code/compose/PR

Verify trên `origin/main` (2026-05-28):
- Logic `emailLogin` + gate + route `@Post('email-login')` — **PR #155** ✅
- Compose khai báo env (cả staging + production, dòng 44) — **PR #167** ✅
  ```yaml
  CAR_V2_EMAIL_LOGIN_PASSWORDLESS: ${CAR_V2_EMAIL_LOGIN_PASSWORDLESS:-false}
  ```

Compose default `:-false` → staging chạy đúng code nhưng giá trị = false → 501. **Việc DUY NHẤT** là set GIÁ TRỊ env trên server + redeploy (cấu hình vận hành, không phải code change):

```bash
ssh amb-staging
cd ~/ambManagement
# thêm/sửa trong docker/staging/.env.staging:
CAR_V2_EMAIL_LOGIN_PASSWORDLESS=true
# redeploy (deploy từ main — đã có sẵn logic + compose)
bash docker/staging/deploy-staging.sh
```
Production tương tự: set trong `docker/production/.env.production` + `deploy-production.sh`.

> **Bảo mật**: passwordless = biết mã DN + email là login được (không cần mật khẩu). OK cho staging/demo; **cân nhắc kỹ trước khi bật prod**.

---

## 5. Troubleshooting login

Đọc query `?error=` trên URL khi bị đá về `/login`:

| `?error=` | Tầng fail | Nguyên nhân & xử lý |
|---|---|---|
| `server` | exception/fetch | AMA unreachable → thiếu/sai `AMA_API_BASE_URL`, hoặc cold-start timeout (retry khi service warm) |
| `not_implemented` | AMA 404 **hoặc 501** | Endpoint chưa có (404) **hoặc passwordless bị tắt (501)** → bật cờ §4 |
| `invalid` | AMA 401 | Mã DN sai / entity không ACTIVE / email không thuộc `usr_company_id` của entity / status WITHDRAWN-SUSPENDED-INACTIVE |
| `not_installed` | custom-apps/my | Entity chưa install `app-car-manager-v2` trên AMA |
| `rate_limit` | AMA 429 | Thử quá nhiều — đợi |

### Test nhanh AMA email-login (không qua car-v2)
```bash
curl -s -w "\nHTTP %{http_code}\n" -X POST "<AMA_API>/auth/email-login" \
  -H "Content-Type: application/json" \
  -d '{"entity_code":"VN01","email":"someone@example.com"}'
```
- `501 E1099` → passwordless tắt (§4)
- `401 EMAIL_NOT_FOUND` → email chưa gắn đúng entity (add qua AMA email-add, không chỉ sync sang car-v2)
- `201 + tokens` → OK

### Đã kiểm chứng (2026-05-28)
Full chain MEMBER/driver chạy hết khi cờ bật (test local VN01 + member ACTIVE + app installed): email-login `201` → custom-apps/my `200` (MEMBER không bị 403) → mint token `201`. Tức nếu driver login fail thì **không phải** do role driver, mà do 1 trong: cờ tắt / email chưa đúng entity / app chưa install.

---

## 6. Deploy notes

- **`NEXT_PUBLIC_*` + `BASE_PATH`**: build-time inlined → đổi phải **rebuild image** (`deploy-staging.sh build`), `restart` không đủ.
- **`AMA_API_BASE_URL`**: runtime env server-side → đổi chỉ cần restart (không cần rebuild).
- **User-guide tree** (`apps/web/public/docs/user-guide/`): static HTML/CSS/JS → không cần Next rebuild, chỉ cần deploy assets.
- **DB migration**: car-v2 dùng Neon, `synchronize` tắt ở staging/prod → migration thủ công khi schema đổi.

---

## 7. Tài khoản AMA web (localhost:5179)

Repo **không** chứa account AMA có password. Login AMA web cần account thật (signup / có sẵn trên DB). 3 user `dev-*@local.dev` được seed vào AMA DB là SSO-only cho luồng token passthrough sang car-v2, không nhằm login AMA web trực tiếp.
