#!/usr/bin/env bash
# ============================================================
#  db.sh — Drizzle / Neon database helpers (macOS / Linux / WSL)
# ============================================================
#  Cách chạy:
#    $ ./scripts/db.sh generate         # sinh SQL migration từ schema TS
#    $ ./scripts/db.sh migrate          # apply migration vào DATABASE_URL
#    $ ./scripts/db.sh push             # sync nhanh (CẢNH BÁO: destructive)
#    $ ./scripts/db.sh studio           # mở Drizzle Studio (web UI)
#
#  DATABASE_URL được đọc từ file .env ở root v2.
# ============================================================

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

if [ ! -f .env ]; then
    echo "LỖI: .env chưa tồn tại. Chạy ./scripts/setup.sh trước." >&2
    exit 1
fi

COMMAND="${1:-}"

echo ""
case "$COMMAND" in
    generate)
        echo "Sinh migration SQL từ Drizzle schema..."
        echo "  Output: packages/db/migrations/NNNN_<name>.sql"
        echo ""
        npm run db:generate
        ;;
    migrate)
        echo "Apply migration vào DATABASE_URL (trong .env)..."
        echo ""
        npm run db:migrate
        ;;
    push)
        echo "[CẢNH BÁO] db:push có thể DROP cột/table không khớp schema."
        echo "           Chỉ dùng trên dev branch Neon, KHÔNG dùng production."
        read -r -p "Tiếp tục? (yes/N) " confirm
        if [ "$confirm" != "yes" ]; then
            echo "Đã hủy."
            exit 0
        fi
        npm run db:push
        ;;
    studio)
        echo "Mở Drizzle Studio..."
        echo "  URL: https://local.drizzle.studio (mở trong browser)"
        echo ""
        npm run db:studio -w '@v2/db'
        ;;
    *)
        echo "LỖI: thiếu command hoặc command không hợp lệ: '$COMMAND'" >&2
        echo "Usage: $0 [generate|migrate|push|studio]" >&2
        exit 1
        ;;
esac
