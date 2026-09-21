#!/bin/bash
# Weekly Docker/disk maintenance for the staging box.
#
# Why this exists: 2026-09-21 a car-manager-v2 build failed with ENOSPC —
# 20.6GB of buildkit cache + 6.8GB of dangling images had filled / to 99%.
# Docker never reclaims build cache on its own, so it grows without bound
# across deploys until a build dies.
#
# Safe by design: only removes build cache and dangling (untagged) images.
# Never touches running containers, named volumes, or tagged images in use.
#
# Install (run once, as root):
#   sudo install -m 755 platform/scripts/docker-maint.sh /usr/local/bin/docker-maint.sh
#   sudo tee /etc/cron.d/docker-maint <<'CRON'
#   0 3 * * 0 root /usr/local/bin/docker-maint.sh
#   CRON
#
# Manual run:  sudo bash platform/scripts/docker-maint.sh
set -u
LOG=/var/log/docker-maint.log

echo "=== $(date -Iseconds) docker maintenance ===" >> "$LOG"
echo "--- before ---" >> "$LOG"
df -h / | tail -1 >> "$LOG"

# Build cache older than 7 days. Keeping recent cache means normal rebuilds
# stay fast; only genuinely stale layers get dropped.
docker builder prune -af --filter 'until=168h' >> "$LOG" 2>&1

# Dangling images — untagged leftovers each rebuild creates (~1.5GB each
# for the Next.js apps).
docker image prune -f >> "$LOG" 2>&1

# systemd journal had grown to 2.9GB with no cap.
journalctl --vacuum-size=300M >> "$LOG" 2>&1

echo "--- after ---" >> "$LOG"
df -h / | tail -1 >> "$LOG"
