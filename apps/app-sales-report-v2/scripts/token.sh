#!/usr/bin/env bash
# ============================================================
#  token.sh — Mint dev JWT token để login (macOS / Linux / WSL)
# ============================================================
#  Cách chạy:
#    $ ./scripts/token.sh                # default role OWNER (→ ADMIN local)
#    $ ./scripts/token.sh OWNER          # ADMIN
#    $ ./scripts/token.sh MASTER         # ADMIN
#    $ ./scripts/token.sh MANAGER        # MANAGER
#    $ ./scripts/token.sh MEMBER         # OPERATOR
#
#  Script sẽ in ra URL dạng:
#    http://localhost:3000/?ama_token=eyJhbGc...
#  Mở URL trong browser -> cookie được set -> redirect tới /dashboard.
#  Token có hạn 8h.
# ============================================================

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

ROLE="${1:-OWNER}"

case "$ROLE" in
    OWNER|MASTER|MANAGER|MEMBER) ;;
    *)
        echo "LỖI: role không hợp lệ: $ROLE" >&2
        echo "Usage: $0 [OWNER|MASTER|MANAGER|MEMBER]" >&2
        exit 1
        ;;
esac

if [ ! -f .env ]; then
    echo "LỖI: .env chưa tồn tại. Chạy ./scripts/setup.sh trước." >&2
    exit 1
fi

echo ""
echo "Mint dev JWT cho role: $ROLE"
echo ""
npm run dev:token -- "$ROLE"
