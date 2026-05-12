#!/usr/bin/env bash
# ============================================================
#  setup.sh — Cài đặt môi trường local (macOS / Linux / WSL)
# ============================================================
#  Cách chạy:
#    $ chmod +x scripts/setup.sh        # lần đầu
#    $ ./scripts/setup.sh
#
#  Script này thực hiện 3 bước:
#    1. Kiểm tra Node.js >= 20
#    2. Chạy `npm install` (workspaces: web / worker / cron / db / shared / ui)
#    3. Tạo .env từ .env.example nếu chưa có
# ============================================================

set -euo pipefail

# Di chuyển về thư mục gốc của app v2 (parent của scripts/)
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

echo ""
echo "===== Setup app-sales-report-v2 (local) ====="
echo ""

# -------- Bước 1: Kiểm tra Node --------
echo "[1/3] Kiểm tra Node.js..."
if ! command -v node >/dev/null 2>&1; then
    echo "  LỖI: Node.js chưa được cài đặt." >&2
    echo "       Tải Node 20.x từ https://nodejs.org/ và chạy lại script này." >&2
    exit 1
fi
NODE_VERSION="$(node --version | sed 's/^v//')"
NODE_MAJOR="${NODE_VERSION%%.*}"
if [ "$NODE_MAJOR" -lt 20 ]; then
    echo "  LỖI: Cần Node >= 20.x (đang có v$NODE_VERSION)." >&2
    exit 1
fi
echo "  OK: Node v$NODE_VERSION"

# -------- Bước 2: npm install --------
echo ""
echo "[2/3] npm install (có thể mất 1–3 phút lần đầu)..."
npm install
echo "  OK: dependencies đã cài đặt"

# -------- Bước 3: tạo .env --------
echo ""
echo "[3/3] Kiểm tra file .env..."
if [ -f .env ]; then
    echo "  .env đã tồn tại - bỏ qua."
else
    if [ ! -f .env.example ]; then
        echo "  LỖI: không tìm thấy .env.example." >&2
        exit 1
    fi
    cp .env.example .env
    echo "  Đã tạo .env từ .env.example."
    echo "  -> Mở .env và điền: DATABASE_URL, JWT_SECRET, AWS_*"
fi

# -------- Tổng kết --------
echo ""
echo "===== Setup hoàn tất ====="
echo ""
echo "Bước tiếp theo:"
echo "  1. Mở .env, điền DATABASE_URL (Neon) và JWT_SECRET"
echo "  2. ./scripts/db.sh migrate       (lần đầu - apply schema vào DB)"
echo "  3. ./scripts/dev.sh              (khởi động dev server)"
echo "  4. ./scripts/token.sh OWNER      (mint JWT để login)"
echo ""
