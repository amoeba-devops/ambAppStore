# App Sales Report — Local Dev Setup Guide

Hướng dẫn chi tiết để chạy app **app-sales-report** ở local với auto-login (không cần nhập credentials thủ công).

---

## 1. Prerequisites

| Tool | Version | Ghi chú |
|------|---------|---------|
| Node.js | `>= 20` | Đã test với v22.21.1 |
| npm | `>= 10` | npm workspaces |
| MySQL | `8.0+` | Có thể local hoặc Docker container |
| Git | any | |

Verify:

```powershell
node --version    # v22.x
npm --version     # 10.x
mysql --version   # 8.0.x
docker --version  # nếu dùng MySQL trong Docker
```

---

## 2. Database Setup

### 2.1 Tạo database

App này dùng MySQL với credentials `root/root` ở port `3306` (mặc định khi chạy MySQL trong Docker Desktop).

Mở MySQL CLI hoặc Workbench và chạy:

```sql
CREATE DATABASE IF NOT EXISTS db_app_sales
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;
```

CLI command (1 dòng):

```powershell
mysql -u root -proot -P 3306 -h 127.0.0.1 -e "CREATE DATABASE IF NOT EXISTS db_app_sales CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
```

### 2.2 Kiểm tra MySQL đang chạy ở port nào

Windows có thể có nhiều instance MySQL (Windows service trên 3307, Docker trên 3306):

```powershell
Get-NetTCPConnection -State Listen | Where-Object { $_.LocalPort -in 3306,3307,33060 } | Format-Table LocalAddress, LocalPort, OwningProcess
```

Test connect:

```powershell
mysql -u root -proot -P 3306 -h 127.0.0.1 -e "SELECT VERSION(), DATABASE();" db_app_sales
```

Nếu MySQL của bạn chạy ở port khác `3306`, sửa `DB_PORT` trong [.env](backend/.env) tương ứng.

### 2.3 Schema

Backend dùng TypeORM với `synchronize: true` ở dev. Khi BE start lần đầu, tất cả các table `drd_*` sẽ được auto-create:

- `drd_spu_masters`
- `drd_sku_masters`
- `drd_channel_masters`
- `drd_channel_product_mappings`
- `drd_sku_cost_histories`
- `drd_raw_orders`
- `drd_upload_histories`
- `drd_external_integrations`
- ...

**Không cần chạy migration thủ công.**

---

## 3. Environment Variables

### 3.1 Backend `.env`

Tạo file `apps/app-sales-report/backend/.env`:

```ini
# Server
PORT=3103
NODE_ENV=development

# Database
DB_HOST=127.0.0.1
DB_PORT=3306
DB_USERNAME=root
DB_PASSWORD=root
DB_DATABASE=db_app_sales
DB_SYNC=true

# JWT
JWT_SECRET=drd-jwt-secret-key-local-dev

# Dev auto-login defaults — chỉ active khi NODE_ENV !== production
# Endpoint /v1/auth/dev-login đọc từ đây để issue JWT mà không cần AMA SSO
DEV_DEFAULT_ENT_ID=acce6566-8a00-4071-b52b-082b69832510
DEV_DEFAULT_ENT_CODE=SOCIALBEAN
DEV_DEFAULT_ENT_NAME=Social Bean VN
DEV_DEFAULT_EMAIL=dev@amoeba.group
```

> **Lưu ý quan trọng**: `JWT_SECRET` phải tồn tại. Nếu thiếu, BE fallback về `'drd-default-secret'` nhưng do timing bug ([main.ts](backend/src/main.ts) đã thêm `import 'dotenv/config'` ở dòng đầu để fix), đảm bảo secret được load đúng trước khi `JwtModule` khởi tạo.

### 3.2 Frontend `.env.local`

Tạo file `apps/app-sales-report/frontend/.env.local`:

```ini
# Vite proxy /api → backend (xem vite.config.ts)
VITE_API_BASE_URL=/api
VITE_AMA_LOGIN_URL=https://ama.amoeba.site/login
```

> `VITE_*` là build-time inline. Đổi xong phải restart `npm run dev`.

---

## 4. Install & Run

### 4.1 Install dependencies (1 lần)

Từ root project (`c:\Github\ambAppStore\`):

```powershell
npm install --workspace=@amb/sales-report-backend --workspace=@amb/sales-report-frontend --include-workspace-root
```

> `npm workspaces` sẽ hoist deps về `node_modules/` ở root. Có thể mất 30-60s.

### 4.2 Start Backend

Terminal 1:

```powershell
cd apps\app-sales-report\backend
npm run dev
```

BE log thành công sẽ có:

```
[Nest] LOG [InstanceLoader] TypeOrmCoreModule dependencies initialized
[Nest] LOG [RouterExplorer] Mapped {/api/v1/...} routes
[Nest] LOG [NestApplication] Nest application successfully started
[DRD] Sales Report Backend running on port 3103
```

### 4.3 Start Frontend

Terminal 2:

```powershell
cd apps\app-sales-report\frontend
npm run dev
```

FE log thành công:

```
VITE v5.4.21  ready in 1894 ms
➜  Local:   http://localhost:5203/app-sales-report
```

---

## 5. Access URLs

| Service | URL |
|---------|-----|
| **Frontend (auto-login)** | http://localhost:5203/app-sales-report |
| Backend health | http://localhost:3103/api/v1/health |
| Swagger UI | http://localhost:3103/api/docs |
| OpenAPI JSON | http://localhost:3103/api/docs-json |

---

## 6. Auto-login (Bypass Authentication)

### 6.1 Cơ chế

Production app yêu cầu **AMA SSO token** truyền qua URL query (`?ama_token=...`). Khi truy cập trực tiếp localhost không có token, app sẽ redirect tới `/entity-info` (yêu cầu Entity Code).

Để dev không phải login mỗi lần, đã thêm:

- **Backend endpoint** `POST /v1/auth/dev-login` — Public, từ chối khi `NODE_ENV=production`. Đọc `DEV_DEFAULT_*` từ `.env`, sign JWT.
- **Frontend `EntityInfoPage` + `LoginPage`** — `useEffect` tự call `/v1/auth/dev-login` khi `import.meta.env.DEV === true`.

### 6.2 Flow

```
Browser → http://localhost:5203/app-sales-report
   ↓
Vite serves SPA, BrowserRouter mount
   ↓
ProtectedRoute thấy không có token → Navigate to /entity-info
   ↓
EntityInfoPage useEffect → POST /v1/auth/dev-login
   ↓
BE đọc DEV_DEFAULT_* từ .env → signs JWT (HS256, JWT_SECRET)
   ↓
FE saves to localStorage:
  - drd_token        (access token, 4h)
  - drd_refresh_token (7d)
  - drd_crp_code     (entity code, e.g., SOCIALBEAN)
   ↓
navigate('/') → Dashboard render
```

### 6.3 Test endpoint thủ công

```powershell
# Issue JWT với defaults từ .env
curl.exe -s -X POST http://localhost:3103/api/v1/auth/dev-login

# Response:
# {
#   "success": true,
#   "data": {
#     "accessToken": "eyJhbGc...",
#     "refreshToken": "eyJhbGc...",
#     "user": {
#       "userId": "acce6566-...",
#       "entId":  "acce6566-...",
#       "crpCode": "SOCIALBEAN",
#       "role": "ADMIN",
#       "name": "dev",
#       "tempPassword": false
#     }
#   }
# }
```

Test gọi API có auth:

```powershell
$TOKEN = (curl.exe -s -X POST http://localhost:3103/api/v1/auth/dev-login | ConvertFrom-Json).data.accessToken
curl.exe -s -H "Authorization: Bearer $TOKEN" http://localhost:3103/api/v1/raw-orders/dashboard-summary
```

### 6.4 Đổi entity test

Sửa `.env` BE và restart:

```ini
DEV_DEFAULT_ENT_ID=<UUID khác>
DEV_DEFAULT_ENT_CODE=ANOTHERENTITY
DEV_DEFAULT_ENT_NAME=Another Entity Name
DEV_DEFAULT_EMAIL=another@example.com
```

Vì `nest start --watch` không tự reload `.env`, cần Ctrl+C và `npm run dev` lại. Sau đó refresh browser sẽ get JWT mới với entity mới.

### 6.5 Verify token trong browser

Sau khi auto-login, mở DevTools → Application → Local Storage:

```
drd_token        = eyJhbGc...
drd_refresh_token = eyJhbGc...
drd_crp_code     = SOCIALBEAN
```

Decode token tại https://jwt.io — sẽ thấy:

```json
{
  "sub": "acce6566-8a00-4071-b52b-082b69832510",
  "ent_id": "acce6566-8a00-4071-b52b-082b69832510",
  "crp_code": "SOCIALBEAN",
  "role": "ADMIN",
  "name": "dev",
  "temp_password": false,
  "source": "AMA_SSO",
  "iat": ...,
  "exp": ...
}
```

### 6.6 Force re-login

Trong DevTools Console:

```js
localStorage.clear();
location.href = '/app-sales-report/';
```

---

## 7. Troubleshooting

### 7.1 BE start fail: `ER_ACCESS_DENIED_ERROR`

Sai `DB_USERNAME` / `DB_PASSWORD`. Test bằng:

```powershell
mysql -u root -proot -P 3306 -h 127.0.0.1 -e "SELECT 1"
```

Nếu không pass → kiểm tra MySQL service và đổi `.env` cho khớp.

### 7.2 BE start fail: `ECONNREFUSED 127.0.0.1:3306`

MySQL không chạy ở port 3306. Check:

```powershell
Get-NetTCPConnection -State Listen | Where-Object { $_.LocalPort -in 3306,3307 }
```

Đổi `DB_PORT` trong `.env` cho đúng.

### 7.3 Dashboard / API trả 401 sau khi đã auto-login

Nguyên nhân thường gặp: **JWT secret mismatch** giữa lúc sign và verify.

Verify:

```powershell
$TOKEN = (curl.exe -s -X POST http://localhost:3103/api/v1/auth/dev-login | ConvertFrom-Json).data.accessToken
node -e "const jwt=require('jsonwebtoken'); try{console.log('OK:', JSON.stringify(jwt.verify(process.argv[1],'drd-jwt-secret-key-local-dev')))}catch(e){console.log('FAIL:',e.message)}" $TOKEN
```

Nếu `FAIL: invalid signature` → đảm bảo:
- `import 'dotenv/config';` ở dòng đầu [main.ts](backend/src/main.ts)
- `JWT_SECRET` trong `.env` không bị thiếu/typo
- Restart BE (`Ctrl+C` rồi `npm run dev`)

### 7.4 FE redirect loop giữa `/` và `/login`

API call từ Dashboard return 401 → axios interceptor [api-client.ts](frontend/src/lib/api-client.ts) clear token → redirect `/login` → LoginPage useEffect auto-login → redirect `/` → loop.

Fix: kiểm tra mục 7.3 (JWT secret).

Tạm thời dừng loop:
```js
localStorage.clear();
```

### 7.5 FE truy cập 127.0.0.1:5203 không được

Vite mặc định bind IPv6 (`::1`). Dùng `localhost` thay vì `127.0.0.1`. Hoặc thêm `--host 0.0.0.0` vào `vite` script.

### 7.6 Endpoint `/v1/auth/dev-login` trả 404

- Đảm bảo `NODE_ENV=development` (không phải `production`) trong `.env`
- Đảm bảo cả 4 biến `DEV_DEFAULT_*` đều có giá trị
- Restart BE để load env mới

### 7.7 BE không reload sau khi sửa `.env`

`nest start --watch` chỉ watch file `.ts`, không watch `.env`. Sau khi sửa `.env`:

```
Ctrl+C
npm run dev
```

---

## 8. File reference

```
apps/app-sales-report/
├── backend/
│   ├── .env                          # ← edit ở đây để đổi DB / dev defaults
│   ├── package.json
│   └── src/
│       ├── main.ts                   # `import 'dotenv/config'` ở dòng 1
│       ├── auth/
│       │   ├── auth.controller.ts    # endpoint /v1/auth/dev-login
│       │   ├── auth.service.ts       # amaEntryLogin() — sign JWT
│       │   └── jwt.strategy.ts       # verify JWT
│       └── ...
├── frontend/
│   ├── .env.local                    # VITE_API_BASE_URL
│   ├── package.json
│   ├── vite.config.ts                # proxy /api → :3103
│   └── src/
│       ├── App.tsx                   # router + auth handler
│       ├── pages/auth/
│       │   ├── EntityInfoPage.tsx    # auto-login khi DEV
│       │   └── LoginPage.tsx         # auto-login khi DEV
│       ├── stores/auth.store.ts      # Zustand auth state
│       └── lib/api-client.ts         # axios + 401 interceptor
└── DEV_SETUP.md                      # ← file này
```

---

## 9. Quick Start (TL;DR)

```powershell
# 1. Database
mysql -u root -proot -P 3306 -h 127.0.0.1 -e "CREATE DATABASE IF NOT EXISTS db_app_sales CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"

# 2. Backend .env (copy nội dung mục 3.1 vào file)
notepad apps\app-sales-report\backend\.env

# 3. Frontend .env.local (copy nội dung mục 3.2 vào file)
notepad apps\app-sales-report\frontend\.env.local

# 4. Install
npm install --workspace=@amb/sales-report-backend --workspace=@amb/sales-report-frontend --include-workspace-root

# 5. Run BE (terminal 1)
cd apps\app-sales-report\backend
npm run dev

# 6. Run FE (terminal 2 — mở terminal mới)
cd apps\app-sales-report\frontend
npm run dev

# 7. Mở browser → http://localhost:5203/app-sales-report
#    → tự động auto-login với entity từ .env BE
```

---

## 10. Production caveats

Patches dev-only này **không** ảnh hưởng production:

| Mục | Production behavior |
|-----|---------------------|
| `import 'dotenv/config'` ở `main.ts` | OK — production cũng cần load `.env` đúng thứ tự |
| Endpoint `/v1/auth/dev-login` | Throw 404 khi `NODE_ENV=production` |
| `EntityInfoPage`/`LoginPage` `useEffect` auto-login | Bị skip khi `import.meta.env.DEV === false` (vite production build) |
| `DEV_DEFAULT_*` env vars | Không cần ở production (hoặc nếu có, vẫn bị endpoint từ chối) |

Tuy nhiên **fix `import 'dotenv/config'`** là **bug fix kiến trúc** nên giữ trên prod (tránh secret mismatch).
