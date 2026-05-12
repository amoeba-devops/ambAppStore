# Chạy app-sales-report-v2 ở local

Hướng dẫn ngắn gọn để chạy FIRGI Sales Report v2 trên máy local cho cả 3 hệ điều hành (Windows / macOS / Linux).

> Tài liệu chi tiết (deploy, architecture, DB design...): xem [README.md](README.md) và [docs/_NAV.md](docs/_NAV.md).

---

## 1. Yêu cầu hệ thống

| Thành phần | Phiên bản | Ghi chú |
|---|---|---|
| **Node.js** | >= 20.0.0 | Tải từ https://nodejs.org/ |
| **npm** | >= 10.x | Đi kèm Node 20+ |
| **Git** | bất kỳ | Để clone repo |
| **PostgreSQL** | (không cần local) | Dùng Neon cloud DB qua `DATABASE_URL` |

**Windows**: chạy PowerShell (mặc định trong Windows Terminal). Lần đầu có thể cần bật execution policy:
```powershell
Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned
```

**macOS / Linux**: cấp quyền thực thi cho scripts lần đầu:
```bash
chmod +x scripts/*.sh
```

---

## 2. Cài đặt lần đầu (3 bước)

### Bước 1: Vào thư mục v2

```bash
cd apps/app-sales-report-v2
```

### Bước 2: Chạy script setup

| OS | Lệnh |
|---|---|
| Windows | `.\scripts\setup.ps1` |
| macOS / Linux / WSL | `./scripts/setup.sh` |

Script sẽ:
- Kiểm tra Node >= 20
- Chạy `npm install` (cài cho tất cả workspaces: web, worker, cron, db, shared, ui)
- Copy `.env.example` → `.env` (nếu chưa có)

### Bước 3: Điền `.env`

Mở file `.env` và điền các giá trị thật:

```dotenv
# Bắt buộc:
DATABASE_URL=postgresql://user:password@your-host.neon.tech/db?sslmode=require
JWT_SECRET=<lấy từ ambManagement>           # bí mật chung với AMA

# Tùy chọn (chỉ cần nếu test upload S3):
AWS_ACCESS_KEY_ID=<your-key>
AWS_SECRET_ACCESS_KEY=<your-secret>
AWS_REGION=ap-southeast-1
AWS_S3_BUCKET=amb-sales-report-v2-dev

# Đã có sẵn trong .env.example, không cần đổi:
NEXT_PUBLIC_APP_CODE=sales-report-v2
NEXT_PUBLIC_AMA_ORIGIN=https://ama.amoeba.site
NEXT_PUBLIC_DEFAULT_LOCALE=ko
SESSION_COOKIE_NAME=amb_session
DEMO_AUTO_LOGIN=true                         # true = bật /dev-login
```

**Cách lấy `DATABASE_URL`**: đăng nhập Neon Console → chọn project → branch `dev` → Connection string. Tham khảo [docs/_setup/NEON-SETUP.md](docs/_setup/NEON-SETUP.md).

### Bước 4: Apply DB schema (lần đầu)

| OS | Lệnh |
|---|---|
| Windows | `.\scripts\db.ps1 migrate` |
| macOS / Linux | `./scripts/db.sh migrate` |

Lệnh này đọc `DATABASE_URL` từ `.env` và tạo các bảng cần thiết.

---

## 3. Chạy hằng ngày

### Khởi động dev server

| OS | Lệnh | Tác dụng |
|---|---|---|
| Windows | `.\scripts\dev.ps1` | Chạy tất cả (web + worker + cron) song song |
| macOS / Linux | `./scripts/dev.sh` | Tương tự |

Tham số tùy chọn để chỉ chạy 1 service:

```bash
./scripts/dev.sh web       # chỉ Next.js (port 3000)
./scripts/dev.sh worker    # chỉ background worker
./scripts/dev.sh cron      # chạy daily-user-sync 1 lần
```

Trên Windows: thay `./scripts/dev.sh` bằng `.\scripts\dev.ps1`.

Sau khi web khởi động: truy cập http://localhost:3000.

### Login dev (mint JWT token)

Mở **terminal thứ 2** (terminal 1 vẫn chạy dev server):

| OS | Lệnh | Role |
|---|---|---|
| Windows | `.\scripts\token.ps1` | OWNER (= ADMIN local) |
| Windows | `.\scripts\token.ps1 MANAGER` | MANAGER |
| macOS / Linux | `./scripts/token.sh` | OWNER |
| macOS / Linux | `./scripts/token.sh MEMBER` | OPERATOR |

Output ví dụ:
```
Dev login URL (open in browser, valid 8h):
  http://localhost:3000/?ama_token=eyJhbGc...
```

Copy URL → paste vào browser → cookie tự set → redirect tới `/dashboard`.

---

## 4. Các tác vụ DB

| Tác vụ | Windows | macOS / Linux |
|---|---|---|
| Sinh migration SQL từ schema TS | `.\scripts\db.ps1 generate` | `./scripts/db.sh generate` |
| Apply migration vào DB | `.\scripts\db.ps1 migrate` | `./scripts/db.sh migrate` |
| Sync nhanh (⚠️ destructive, chỉ dev) | `.\scripts\db.ps1 push` | `./scripts/db.sh push` |
| Mở Drizzle Studio (UI web) | `.\scripts\db.ps1 studio` | `./scripts/db.sh studio` |

Workflow điển hình khi đổi schema:

```
1. Sửa file packages/db/src/schema/*.ts
2. ./scripts/db.sh generate    -> tạo file SQL trong packages/db/migrations/
3. Mở file SQL kiểm tra
4. ./scripts/db.sh migrate     -> áp vào DB
```

---

## 5. Bảng lệnh nhanh (cheat sheet)

| Mục đích | Windows (PowerShell) | macOS / Linux (Bash) |
|---|---|---|
| Cài lần đầu | `.\scripts\setup.ps1` | `./scripts/setup.sh` |
| Chạy tất cả services | `.\scripts\dev.ps1` | `./scripts/dev.sh` |
| Chỉ web | `.\scripts\dev.ps1 web` | `./scripts/dev.sh web` |
| Chỉ worker | `.\scripts\dev.ps1 worker` | `./scripts/dev.sh worker` |
| Mint JWT OWNER | `.\scripts\token.ps1` | `./scripts/token.sh` |
| Mint JWT MANAGER | `.\scripts\token.ps1 MANAGER` | `./scripts/token.sh MANAGER` |
| Apply migration | `.\scripts\db.ps1 migrate` | `./scripts/db.sh migrate` |
| Drizzle Studio | `.\scripts\db.ps1 studio` | `./scripts/db.sh studio` |

---

## 6. Xử lý sự cố

### Port 3000 đang bị chiếm (`EADDRINUSE`)

**Windows (PowerShell):**
```powershell
Get-NetTCPConnection -LocalPort 3000 |
  Select-Object -ExpandProperty OwningProcess |
  ForEach-Object { Stop-Process -Id $_ -Force }
```

**macOS / Linux:**
```bash
lsof -ti:3000 | xargs kill -9
```

### Lỗi `JWT_SECRET is required` khi mở browser

→ File `.env` chưa được load hoặc thiếu `JWT_SECRET`. Kiểm tra:
1. File `.env` tồn tại ở `apps/app-sales-report-v2/.env` (không phải ở root repo).
2. Có dòng `JWT_SECRET=...` (giá trị bất kỳ cho dev, miễn ≥ 32 ký tự).
3. Restart dev server (Ctrl+C → chạy lại `dev.ps1` / `dev.sh`).

### Lỗi `DATABASE_URL is required` khi chạy db:migrate

→ Đảm bảo chạy từ root v2 (`apps/app-sales-report-v2/`), không phải từ root repo.

### 401 Unauthorized khi paste URL `?ama_token=...`

→ JWT đã hết hạn (8h) hoặc `JWT_SECRET` trong `.env` đã đổi. Mint lại token:
```
./scripts/token.sh OWNER       # macOS/Linux
.\scripts\token.ps1 OWNER       # Windows
```

### Lỗi PowerShell: "running scripts is disabled on this system"

→ Bật execution policy cho user hiện tại (chỉ cần làm 1 lần):
```powershell
Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned
```

### Cache Next.js bị hỏng (giao diện không update)

```bash
# macOS/Linux:
rm -rf apps/web/.next .turbo

# Windows PowerShell:
Remove-Item -Recurse -Force apps\web\.next, .turbo
```

Sau đó chạy lại `dev` script.

### Worker không xử lý job upload

→ Đảm bảo worker đang chạy (`./scripts/dev.sh worker`) và `DATABASE_URL` trỏ tới đúng DB mà web đang ghi.

---

## 7. Cấu trúc thư mục liên quan

```
apps/app-sales-report-v2/
├── .env                       # cấu hình local (gitignored)
├── .env.example               # template
├── README.LOCAL.md            # ← file này
├── README.md                  # docs đầy đủ (deploy, architecture...)
├── scripts/
│   ├── setup.ps1  / setup.sh        # cài đặt lần đầu
│   ├── dev.ps1    / dev.sh          # khởi động dev server
│   ├── db.ps1     / db.sh           # DB helpers (generate/migrate/push/studio)
│   ├── token.ps1  / token.sh        # mint dev JWT
│   └── dev-token.mjs                # implementation gốc (gọi từ npm)
├── apps/
│   ├── web/                   # Next.js 15 (port 3000)
│   ├── worker/                # background worker (tsx watch)
│   └── cron/                  # cron jobs (one-shot)
└── packages/
    ├── db/                    # Drizzle schema + migrations
    ├── shared/                # Zod + types
    └── ui/                    # Tailwind util
```
