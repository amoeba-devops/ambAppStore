#!/usr/bin/env bash
# ============================================================
# ambAppStore — Production Deploy Script
# ============================================================
# 대상 서버: apps.amoeba.site (18.138.206.18, ec2-user) — `ssh amb-production`
#
# 스테이징(deploy-staging.sh)과 차이:
#   - 기본 배포 대상: platform 스택만 (랜딩 + 카탈로그 API + MySQL)
#     (car-manager/stock/sales 등은 본 스크립트 범위 외 — 후속 추가)
#
# 코드 소스 브랜치: 환경변수 PROD_BRANCH로 지정 (기본 main).
#   - 'production' 브랜치는 아직 미생성. 생성 후 `PROD_BRANCH=production` 로 운영.
#
# 전제: 스테이징에서 검증 완료된 사항만 프로덕션 배포 (CLAUDE.md 배포 원칙).
#
# Usage:
#   bash platform/scripts/deploy-production.sh                 # full deploy (git pull + build + restart + verify)
#   bash platform/scripts/deploy-production.sh build           # build only
#   bash platform/scripts/deploy-production.sh restart         # restart only (no build)
#   bash platform/scripts/deploy-production.sh verify          # verify only
# ============================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

PROD_BRANCH="${PROD_BRANCH:-main}"

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'
log()   { echo -e "${GREEN}[deploy-prod]${NC} $1"; }
warn()  { echo -e "${YELLOW}[warn]${NC} $1"; }
error() { echo -e "${RED}[error]${NC} $1" >&2; }

# ---- App definitions (production scope = platform only) ----
APP_DIR="$PROJECT_ROOT/apps/platform"
APP_COMPOSE="docker-compose.platform.yml"
APP_BFF_PORT=3100
APP_WEB_PORT=5200

MODE="${1:-full}"

# ---- Pre-checks ----
if ! docker network inspect amb-apps-network >/dev/null 2>&1; then
  log "Creating external Docker network: amb-apps-network"
  docker network create amb-apps-network
fi

if [ ! -f "$APP_DIR/$APP_COMPOSE" ]; then
  error "$APP_COMPOSE not found at $APP_DIR/$APP_COMPOSE"; exit 1
fi
if [ ! -f "$APP_DIR/.env" ]; then
  error ".env not found at $APP_DIR/.env — 프로덕션 환경변수 파일 필수 (JWT_SECRET 등)"; exit 1
fi

compose() { (cd "$APP_DIR" && docker compose --env-file .env -f "$APP_COMPOSE" "$@"); }

build_app() {
  log "Building [platform]..."
  compose build --no-cache
  log "[platform] build complete."
}

restart_app() {
  log "Restarting [platform]..."
  compose down
  compose up -d
  log "[platform] restart complete."
}

verify_app() {
  log "Verifying [platform]..."
  echo -n "  Backend  (port $APP_BFF_PORT/api/v1/health): "
  curl -sf "http://localhost:$APP_BFF_PORT/api/v1/health" && echo "" || echo "FAIL"
  echo -n "  Catalog  (port $APP_BFF_PORT/api/v1/apps):   "
  curl -sf "http://localhost:$APP_BFF_PORT/api/v1/apps" >/dev/null && echo "OK" || echo "FAIL"
  echo -n "  Frontend (port $APP_WEB_PORT):               "
  curl -sf -o /dev/null -w "%{http_code}" "http://localhost:$APP_WEB_PORT/" && echo "" || echo "FAIL"
  log "Container status:"
  compose ps
}

case "$MODE" in
  build)   build_app ;;
  restart) restart_app ;;
  verify)  verify_app ;;
  full|"")
    log "Pulling latest code (origin/$PROD_BRANCH)..."
    (cd "$PROJECT_ROOT" && git pull origin "$PROD_BRANCH")
    build_app
    restart_app
    log "Waiting for services to be healthy..."
    sleep 10
    verify_app
    log "Production deploy complete."
    ;;
  *)
    echo "Usage: $0 {full|build|restart|verify}"; exit 1 ;;
esac
