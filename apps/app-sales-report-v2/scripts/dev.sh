#!/usr/bin/env bash
# ============================================================
#  dev.sh — Khởi động dev server (macOS / Linux / WSL)
# ============================================================
#  Cách chạy:
#    $ ./scripts/dev.sh                 # chạy tất cả (web + worker + cron)
#    $ ./scripts/dev.sh web             # chỉ web (http://localhost:3000)
#    $ ./scripts/dev.sh worker          # chỉ background worker
#    $ ./scripts/dev.sh cron            # chạy cron job daily-user-sync 1 lần
#
#  Nếu port 3000 đang bị chiếm:
#    $ lsof -ti:3000 | xargs kill -9
# ============================================================

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

SERVICE="${1:-all}"

if [ ! -f .env ]; then
    echo "LỖI: .env chưa tồn tại. Chạy ./scripts/setup.sh trước." >&2
    exit 1
fi

echo ""
case "$SERVICE" in
    all)
        echo "Khởi động TẤT CẢ services (web + worker + cron) qua turbo..."
        echo "  Web:    http://localhost:3000"
        echo "  Worker: poll sal_upload_sessions PENDING mỗi 2s"
        echo "  Cron:   chạy daily-user-sync 1 lần"
        echo "  Nhấn Ctrl+C để dừng tất cả."
        echo ""
        npm run dev
        ;;
    web)
        echo "Khởi động WEB (Next.js)..."
        echo "  URL: http://localhost:3000"
        echo ""
        npm run dev:web
        ;;
    worker)
        echo "Khởi động WORKER (tsx watch)..."
        echo ""
        npm run dev -w '@v2/worker'
        ;;
    cron)
        echo "Chạy CRON one-shot (daily-user-sync)..."
        echo ""
        npm run dev -w '@v2/cron'
        ;;
    *)
        echo "LỖI: tham số không hợp lệ: $SERVICE" >&2
        echo "Usage: $0 [all|web|worker|cron]" >&2
        exit 1
        ;;
esac
