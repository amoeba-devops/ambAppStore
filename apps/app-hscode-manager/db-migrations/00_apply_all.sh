#!/usr/bin/env bash
# ============================================================
# HS Code Manager — Apply All Migrations
# ============================================================
# Usage:
#   DB_HOST=localhost DB_USER=root DB_PASS=secret bash 00_apply_all.sh
#   DB_HOST=db-app-hscode DB_USER=hscode_app DB_PASS=... bash 00_apply_all.sh
#
# Applies in order: init-db → phase1 → phase1-seed → phase2 → phase3 → phase3-seed → phase4
# Each migration is idempotent (CREATE TABLE IF NOT EXISTS / INSERT IGNORE / ALTER guarded).
# ============================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-3306}"
DB_USER="${DB_USER:-root}"
DB_PASS="${DB_PASS:-}"
DB_NAME="${DB_DATABASE:-db_app_hscode}"

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

log()  { echo -e "${GREEN}[migrate]${NC} $1"; }
warn() { echo -e "${YELLOW}[warn]${NC} $1"; }
err()  { echo -e "${RED}[error]${NC} $1" >&2; }

mysql_exec() {
  local file=$1
  log "Applying: $file"
  if [ -n "$DB_PASS" ]; then
    mysql -h "$DB_HOST" -P "$DB_PORT" -u "$DB_USER" -p"$DB_PASS" < "$file"
  else
    mysql -h "$DB_HOST" -P "$DB_PORT" -u "$DB_USER" < "$file"
  fi
}

mysql_alter_safe() {
  # ALTER TABLE 가 이미 적용되어 있어도 실패하지 않도록 information_schema 확인 우회 처리.
  # Phase 4의 ALTER 는 ADD COLUMN 두 개 — 컬럼 존재 여부 확인 후 적용.
  local table=$1
  local column=$2
  local ddl=$3
  local exists
  exists=$(mysql -h "$DB_HOST" -P "$DB_PORT" -u "$DB_USER" ${DB_PASS:+-p"$DB_PASS"} \
    -N -e "SELECT COUNT(*) FROM information_schema.columns WHERE table_schema='$DB_NAME' AND table_name='$table' AND column_name='$column';" 2>/dev/null || echo "0")
  if [ "$exists" = "0" ]; then
    log "  + ADD COLUMN $table.$column"
    mysql -h "$DB_HOST" -P "$DB_PORT" -u "$DB_USER" ${DB_PASS:+-p"$DB_PASS"} \
      -e "USE $DB_NAME; $ddl;"
  else
    warn "  - $table.$column already exists, skipping"
  fi
}

# Phase 0 — DB 생성 + 사용자
log "=== Phase 0: init-db ==="
mysql_exec "$APP_DIR/backend/scripts/init-db.sql"

# Phase 1 — 마스터
log "=== Phase 1: master tables ==="
mysql_exec "$SCRIPT_DIR/2026-05-13_phase1_master.sql"
log "=== Phase 1: seed (idempotent INSERT IGNORE) ==="
mysql_exec "$SCRIPT_DIR/seed-phase1.sql"

if [ "${SEED_DEMO_DATA:-false}" = "true" ]; then
  log "=== Phase 1: demo exporters + FTA (SEED_DEMO_DATA=true) ==="
  mysql_exec "$SCRIPT_DIR/seed-phase1-demo-exporters-fta.sql"
fi

# Phase 2 — Intake
log "=== Phase 2: intake tables ==="
mysql_exec "$SCRIPT_DIR/2026-05-13_phase2_intake.sql"

# Phase 3 — Matching/AI + Authority 시드
log "=== Phase 3: matching tables ==="
mysql_exec "$SCRIPT_DIR/2026-05-13_phase3_matching.sql"
log "=== Phase 3: authority seed (demo subset) ==="
mysql_exec "$SCRIPT_DIR/seed-phase3-authority.sql"

if [ "${SEED_DEMO_DATA:-false}" = "true" ]; then
  log "=== Phase 3: authority extended (50건 데모) ==="
  mysql_exec "$SCRIPT_DIR/seed-phase3-authority-extended.sql"
fi

# Phase 4a — Base entity tables (classifications / verification_events / expert_reviews)
# These are declared by TypeORM entities but were missing from migrations (only
# created via synchronize in dev). Must exist before the Phase 4/5 ALTERs.
log "=== Phase 4a: base entity tables ==="
mysql_exec "$SCRIPT_DIR/2026-05-13_phase4a_base-entity-tables.sql"

# Phase 4 — Classification + Audit
# ALTER 는 컬럼 존재 검증 후 적용 (idempotent 보장)
log "=== Phase 4: ALTER classifications ==="
mysql_alter_safe "hsc_classifications" "cls_fta_agreement_code" \
  "ALTER TABLE hsc_classifications ADD COLUMN cls_fta_agreement_code VARCHAR(16) NULL AFTER cls_fta_tariff_rate"
mysql_alter_safe "hsc_classifications" "cls_created_by" \
  "ALTER TABLE hsc_classifications ADD COLUMN cls_created_by CHAR(36) NULL AFTER cls_superseded_by_id"

log "=== Phase 4: candidates + audit tables ==="
# phase4 파일은 ALTER + CREATE 가 함께 있으므로 ALTER 부분만 별도 처리 후 CREATE 만 적용:
mysql -h "$DB_HOST" -P "$DB_PORT" -u "$DB_USER" ${DB_PASS:+-p"$DB_PASS"} \
  -e "USE $DB_NAME;
      CREATE TABLE IF NOT EXISTS hsc_classification_candidates (
        cnd_id                  CHAR(36)     NOT NULL,
        cnd_ent_id              CHAR(36)     NOT NULL,
        cnd_classification_id   CHAR(36)     NOT NULL,
        cnd_hs_code             VARCHAR(16)  NOT NULL,
        cnd_description         TEXT         NULL,
        cnd_basic_tariff_rate   DECIMAL(6,3) NULL,
        cnd_fta_tariff_rate     DECIMAL(6,3) NULL,
        cnd_fta_agreement_code  VARCHAR(16)  NULL,
        cnd_source              VARCHAR(16)  NOT NULL,
        cnd_ranking             INT          NOT NULL,
        cnd_confidence          DECIMAL(4,3) NULL,
        cnd_reasoning           TEXT         NULL,
        cnd_source_citations    JSON         NULL,
        cnd_external_adapter_keys JSON       NULL,
        cnd_flags               JSON         NULL,
        cnd_past_adoption_count INT          NOT NULL DEFAULT 0,
        cnd_created_at          DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (cnd_id),
        KEY idx_cnd_classification (cnd_classification_id),
        KEY idx_cnd_classification_rank (cnd_classification_id, cnd_ranking)
      ) ENGINE=InnoDB;
      CREATE TABLE IF NOT EXISTS hsc_audit_logs (
        aud_id          CHAR(36)     NOT NULL,
        aud_ent_id      CHAR(36)     NOT NULL,
        aud_user_id     CHAR(36)     NULL,
        aud_user_email  VARCHAR(255) NULL,
        aud_action      VARCHAR(32)  NOT NULL,
        aud_target_table VARCHAR(64) NOT NULL,
        aud_target_id   VARCHAR(64)  NULL,
        aud_diff_json   JSON         NULL,
        aud_ip          VARCHAR(45)  NULL,
        aud_user_agent  VARCHAR(500) NULL,
        aud_request_id  VARCHAR(64)  NULL,
        aud_created_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (aud_id),
        KEY idx_audit_ent_created (aud_ent_id, aud_created_at),
        KEY idx_audit_target (aud_target_table, aud_target_id)
      ) ENGINE=InnoDB;"

log "=== Phase 5: ALTER verification_events ==="
mysql_alter_safe "hsc_verification_events" "vrf_inquiry_id" \
  "ALTER TABLE hsc_verification_events ADD COLUMN vrf_inquiry_id CHAR(36) NULL AFTER vrf_classification_id"
mysql_alter_safe "hsc_verification_events" "vrf_amount_usd" \
  "ALTER TABLE hsc_verification_events ADD COLUMN vrf_amount_usd DECIMAL(15,2) NULL AFTER vrf_notes"

log "=== Phase 5: review_queue table ==="
mysql_exec "$SCRIPT_DIR/2026-05-13_phase5_verification.sql"

log "=== Phase 6: expert keyword dictionary ==="
mysql_exec "$SCRIPT_DIR/2026-05-13_phase6_expert-review.sql"

log "=== Phase 7: policy thresholds + unsupported country requests ==="
mysql_exec "$SCRIPT_DIR/2026-05-14_phase7_policy.sql"

log "=== Verifying schema ==="
mysql -h "$DB_HOST" -P "$DB_PORT" -u "$DB_USER" ${DB_PASS:+-p"$DB_PASS"} \
  -e "USE $DB_NAME; SHOW TABLES;" | grep -E '^hsc_' | wc -l | xargs -I{} echo "  table count: {}"

log "All migrations applied successfully."
