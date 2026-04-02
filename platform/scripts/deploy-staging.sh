#!/usr/bin/env bash
# ============================================================
# ambAppStore — Staging Deploy Script
# ============================================================
# Usage:
#   bash platform/scripts/deploy-staging.sh                    # full deploy ALL apps
#   bash platform/scripts/deploy-staging.sh build              # build ALL apps
#   bash platform/scripts/deploy-staging.sh restart            # restart ALL apps
#   bash platform/scripts/deploy-staging.sh verify             # verify ALL apps
#   bash platform/scripts/deploy-staging.sh build platform     # build platform only
#   bash platform/scripts/deploy-staging.sh build car-manager  # build car-manager only
#   bash platform/scripts/deploy-staging.sh build stock        # build stock-management only
#   bash platform/scripts/deploy-staging.sh build sales        # build sales-report only
# ============================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

# Color helpers
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log()   { echo -e "${GREEN}[deploy]${NC} $1"; }
warn()  { echo -e "${YELLOW}[warn]${NC} $1"; }
error() { echo -e "${RED}[error]${NC} $1" >&2; }

# ---- App definitions ----
declare -A APP_DIRS APP_COMPOSE APP_BFF_PORT APP_WEB_PORT APP_BFF_NAME APP_WEB_NAME

APP_DIRS[platform]="$PROJECT_ROOT/apps/platform"
APP_COMPOSE[platform]="docker-compose.platform.yml"
APP_BFF_PORT[platform]=3100
APP_WEB_PORT[platform]=5200
APP_BFF_NAME[platform]="bff-platform"
APP_WEB_NAME[platform]="web-platform"

APP_DIRS[car-manager]="$PROJECT_ROOT/apps/app-car-manager"
APP_COMPOSE[car-manager]="docker-compose.app-car-manager.yml"
APP_BFF_PORT[car-manager]=3101
APP_WEB_PORT[car-manager]=5201
APP_BFF_NAME[car-manager]="bff-car-manager"
APP_WEB_NAME[car-manager]="web-car-manager"

APP_DIRS[stock]="$PROJECT_ROOT/apps/app-stock-management"
APP_COMPOSE[stock]="docker-compose.app-stock-management.yml"
APP_BFF_PORT[stock]=3104
APP_WEB_PORT[stock]=5204
APP_BFF_NAME[stock]="bff-stock-management"
APP_WEB_NAME[stock]="web-stock-management"

APP_DIRS[sales]="$PROJECT_ROOT/apps/app-sales-report"
APP_COMPOSE[sales]="docker-compose.app-sales-report.yml"
APP_BFF_PORT[sales]=3103
APP_WEB_PORT[sales]=5203
APP_BFF_NAME[sales]="bff-sales-report"
APP_WEB_NAME[sales]="web-sales-report"

ALL_APPS=(platform car-manager stock sales)

MODE="${1:-full}"
TARGET_APP="${2:-all}"

# Resolve target apps
if [ "$TARGET_APP" = "all" ]; then
  APPS=("${ALL_APPS[@]}")
else
  if [ -z "${APP_DIRS[$TARGET_APP]+x}" ]; then
    error "Unknown app: $TARGET_APP. Available: ${ALL_APPS[*]}"
    exit 1
  fi
  APPS=("$TARGET_APP")
fi

# ---- Pre-checks ----
# Ensure external Docker network exists
if ! docker network inspect amb-apps-network >/dev/null 2>&1; then
  log "Creating external Docker network: amb-apps-network"
  docker network create amb-apps-network
fi

for app in "${APPS[@]}"; do
  dir="${APP_DIRS[$app]}"
  compose="${APP_COMPOSE[$app]}"
  if [ ! -f "$dir/$compose" ]; then
    error "$compose not found at $dir/$compose"
    exit 1
  fi
  if [ ! -f "$dir/.env" ]; then
    warn ".env not found for $app at $dir/.env — skipping env-file check"
  fi
done

# Ensure platform (with MySQL) is deployed first when deploying all apps
if [ "$TARGET_APP" = "all" ]; then
  APPS=(platform car-manager stock sales)
fi

build_app() {
  local app=$1
  local dir="${APP_DIRS[$app]}"
  local compose="${APP_COMPOSE[$app]}"
  log "Building [$app]..."
  cd "$dir"
  if [ -f "$dir/.env" ]; then
    docker compose --env-file .env -f "$compose" build --no-cache
  else
    docker compose -f "$compose" build --no-cache
  fi
  log "[$app] build complete."
}

restart_app() {
  local app=$1
  local dir="${APP_DIRS[$app]}"
  local compose="${APP_COMPOSE[$app]}"
  log "Restarting [$app]..."
  cd "$dir"
  if [ -f "$dir/.env" ]; then
    docker compose --env-file .env -f "$compose" down
    docker compose --env-file .env -f "$compose" up -d
  else
    docker compose -f "$compose" down
    docker compose -f "$compose" up -d
  fi
  log "[$app] restart complete."
}

verify_app() {
  local app=$1
  local bff_port="${APP_BFF_PORT[$app]}"
  local web_port="${APP_WEB_PORT[$app]}"
  local web_name="${APP_WEB_NAME[$app]}"
  local dir="${APP_DIRS[$app]}"
  local compose="${APP_COMPOSE[$app]}"

  log "Verifying [$app]..."
  echo -n "  Backend API (port $bff_port): "
  curl -sf "http://localhost:$bff_port/api/v1/health" && echo "" || echo "FAIL"

  echo -n "  Frontend (port $web_port):    "
  curl -sf -o /dev/null -w "%{http_code}" "http://localhost:$web_port/" && echo "" || echo "FAIL"

  log "Checking for wrong domain references in [$app]..."
  docker exec "$web_name" sh -c 'grep -rl "mng.amoeba.site" /usr/share/nginx/html/ 2>/dev/null || echo "  No wrong domains found — OK"' 2>/dev/null || true

  log "Container status [$app]:"
  cd "$dir"
  if [ -f "$dir/.env" ]; then
    docker compose --env-file .env -f "$compose" ps
  else
    docker compose -f "$compose" ps
  fi
}

case "$MODE" in
  build)
    for app in "${APPS[@]}"; do
      build_app "$app"
    done
    ;;

  restart)
    for app in "${APPS[@]}"; do
      restart_app "$app"
    done
    ;;

  full|"")
    log "Pulling latest code..."
    cd "$PROJECT_ROOT"
    git pull origin main

    for app in "${APPS[@]}"; do
      build_app "$app"
    done

    for app in "${APPS[@]}"; do
      restart_app "$app"
    done

    log "Waiting for services to be healthy..."
    sleep 10

    for app in "${APPS[@]}"; do
      verify_app "$app"
    done

    log "Deploy complete."
    ;;

  verify)
    log "Running post-deploy verification..."
    for app in "${APPS[@]}"; do
      verify_app "$app"
    done
    ;;

  *)
    echo "Usage: $0 {full|build|restart|verify} [platform|car-manager|stock|sales|all]"
    exit 1
    ;;
esac
