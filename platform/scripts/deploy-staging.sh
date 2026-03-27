#!/usr/bin/env bash
# ============================================================
# ambAppStore Platform — Staging Deploy Script
# ============================================================
# Usage:
#   bash platform/scripts/deploy-staging.sh          # full deploy (build + restart)
#   bash platform/scripts/deploy-staging.sh build     # build only
#   bash platform/scripts/deploy-staging.sh restart    # restart only (no rebuild)
# ============================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
PLATFORM_DIR="$PROJECT_ROOT/apps/platform"
COMPOSE_FILE="$PLATFORM_DIR/docker-compose.platform.yml"
ENV_FILE="$PLATFORM_DIR/.env"

# Color helpers
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log()   { echo -e "${GREEN}[deploy]${NC} $1"; }
warn()  { echo -e "${YELLOW}[warn]${NC} $1"; }
error() { echo -e "${RED}[error]${NC} $1" >&2; }

# ---- Pre-checks ----
if [ ! -f "$COMPOSE_FILE" ]; then
  error "docker-compose.platform.yml not found at $COMPOSE_FILE"
  exit 1
fi

if [ ! -f "$ENV_FILE" ]; then
  error ".env not found at $ENV_FILE"
  error "Copy from .env.staging.example: cp $PLATFORM_DIR/.env.staging.example $ENV_FILE"
  exit 1
fi

MODE="${1:-full}"

cd "$PLATFORM_DIR"

case "$MODE" in
  build)
    log "Building containers..."
    docker compose --env-file .env -f docker-compose.platform.yml build --no-cache
    log "Build complete."
    ;;

  restart)
    log "Restarting containers (no rebuild)..."
    docker compose --env-file .env -f docker-compose.platform.yml down
    docker compose --env-file .env -f docker-compose.platform.yml up -d
    log "Restart complete."
    ;;

  full|"")
    log "Pulling latest code..."
    cd "$PROJECT_ROOT"
    git pull origin main

    cd "$PLATFORM_DIR"

    log "Building containers..."
    docker compose --env-file .env -f docker-compose.platform.yml build --no-cache

    log "Starting containers..."
    docker compose --env-file .env -f docker-compose.platform.yml down
    docker compose --env-file .env -f docker-compose.platform.yml up -d

    log "Waiting for services to be healthy..."
    sleep 10

    # Health check
    if curl -sf http://localhost:3100/api/v1/health > /dev/null 2>&1; then
      log "Backend health check: ${GREEN}OK${NC}"
    else
      warn "Backend health check failed — may still be starting"
    fi

    if curl -sf http://localhost:5200/ > /dev/null 2>&1; then
      log "Frontend health check: ${GREEN}OK${NC}"
    else
      warn "Frontend health check failed — may still be starting"
    fi

    log "Deploy complete."
    ;;

  verify)
    log "Running post-deploy verification..."
    # 1. Health checks
    echo -n "  Backend API: "
    curl -sf http://localhost:3100/api/v1/health && echo "" || echo "FAIL"

    echo -n "  Frontend:    "
    curl -sf -o /dev/null -w "%{http_code}" http://localhost:5200/ && echo "" || echo "FAIL"

    # 2. Check for wrong domains in built JS
    log "Checking for wrong domain references in built JS..."
    docker exec web-platform sh -c 'grep -rl "mng.amoeba.site" /usr/share/nginx/html/ 2>/dev/null || echo "  No wrong domains found — OK"'

    # 3. Container status
    log "Container status:"
    docker compose --env-file .env -f docker-compose.platform.yml ps
    ;;

  *)
    echo "Usage: $0 {full|build|restart|verify}"
    exit 1
    ;;
esac
