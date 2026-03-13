#!/usr/bin/env bash
# =============================================================
# backup-db.sh — Hourly SQLite backup to S3
# Runs via cron:  0 * * * * /opt/concordium-app/scripts/backup-db.sh
# =============================================================

set -euo pipefail

APP_DIR="/opt/concordium-app"
DB_FILE="$APP_DIR/data/console.db"
S3_BUCKET="concordium-va-backups-324037278470-eu-west-1-an"
TIMESTAMP=$(date -u +"%Y-%m-%dT%H-%M-%SZ")
BACKUP_KEY="console-db/$TIMESTAMP.db"
LATEST_KEY="console-db/latest.db"
LOG_FILE="/var/log/concordium-backup.log"

log() {
  echo "[$(date -u +"%Y-%m-%d %H:%M:%S UTC")] $*" | tee -a "$LOG_FILE"
}

# Verify DB file exists
if [ ! -f "$DB_FILE" ]; then
  log "ERROR: DB file not found at $DB_FILE"
  exit 1
fi

# Copy DB safely using SQLite's backup API via sqlite3 (avoids partial reads mid-write)
TMPFILE=$(mktemp /tmp/console-backup-XXXXXX.db)
trap 'rm -f "$TMPFILE"' EXIT

sqlite3 "$DB_FILE" ".backup '$TMPFILE'"

# Upload timestamped backup
aws s3 cp "$TMPFILE" "s3://$S3_BUCKET/$BACKUP_KEY" --storage-class STANDARD_IA
log "Uploaded backup: s3://$S3_BUCKET/$BACKUP_KEY"

# Also update the 'latest' pointer for easy restore
aws s3 cp "$TMPFILE" "s3://$S3_BUCKET/$LATEST_KEY"
log "Updated latest: s3://$S3_BUCKET/$LATEST_KEY"

# Prune backups older than 30 days to keep costs minimal
aws s3 ls "s3://$S3_BUCKET/console-db/" | awk '{print $4}' | while read -r key; do
  # Extract timestamp from filename (YYYY-MM-DDT...)
  file_date=$(echo "$key" | grep -oP '^\d{4}-\d{2}-\d{2}' || true)
  if [ -n "$file_date" ] && [ "$file_date" != "latest" ]; then
    age_days=$(( ( $(date -u +%s) - $(date -u -d "$file_date" +%s) ) / 86400 ))
    if [ "$age_days" -gt 30 ]; then
      aws s3 rm "s3://$S3_BUCKET/console-db/$key"
      log "Pruned old backup: $key (${age_days}d old)"
    fi
  fi
done

log "Backup complete."
