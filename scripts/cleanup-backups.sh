#!/bin/bash
set -e

# Backup Cleanup Script for Sovereign Agent
# This script implements advanced backup retention policies

# Configuration
BACKUP_DIR="${BACKUP_DIR:-/backups}"
DAILY_RETENTION="${DAILY_RETENTION:-7}"
WEEKLY_RETENTION="${WEEKLY_RETENTION:-4}"
MONTHLY_RETENTION="${MONTHLY_RETENTION:-6}"
MIN_DISK_PERCENT="${MIN_DISK_PERCENT:-20}"

echo "Starting backup cleanup at $(date)"
echo "Backup directory: ${BACKUP_DIR}"
echo "=========================================="

# Check disk space
echo "1. Checking disk space..."
DISK_USAGE=$(df -h "${BACKUP_DIR}" | tail -n 1 | awk '{print $5}' | sed 's/%//')
echo "Current disk usage: ${DISK_USAGE}%"

if [ "${DISK_USAGE}" -gt $((100 - MIN_DISK_PERCENT)) ]; then
  echo "⚠ WARNING: Disk usage above ${MIN_DISK_PERCENT}% threshold (${DISK_USAGE}%)"
  echo "Aggressive cleanup will be performed"
  AGGRESSIVE_CLEANUP=true
else
  echo "✓ Disk usage within acceptable range"
  AGGRESSIVE_CLEANUP=false
fi

# Count current backups
TOTAL_BACKUPS=$(find "${BACKUP_DIR}" -name "sovereign_backup_*.sql.gz" | wc -l)
echo "Total backups: ${TOTAL_BACKUPS}"

# Apply retention policies
echo "2. Applying retention policies..."

# Keep daily backups for N days
echo "   - Keeping ${DAILY_RETENTION} daily backups"
find "${BACKUP_DIR}" -name "sovereign_backup_*.sql.gz" -mtime +${DAILY_RETENTION} -type f | while read -r file; do
  # Check if this is a weekly or monthly backup (keep those longer)
  TIMESTAMP=$(basename "$file" | grep -oP '\d{8}_\d{6}')
  if [ -n "$TIMESTAMP" ]; then
    DAY_OF_WEEK=$(date -d "${TIMESTAMP:0:4}-${TIMESTAMP:4:2}-${TIMESTAMP:6:2}" +%u 2>/dev/null || echo "0")
    DAY_OF_MONTH=$(date -d "${TIMESTAMP:0:4}-${TIMESTAMP:4:2}-${TIMESTAMP:6:2}" +%d 2>/dev/null || echo "0")
    
    # Keep weekly backups (Sundays)
    if [ "$DAY_OF_WEEK" = "7" ]; then
      WEEKLY_AGE=$(( ($(date +%s) - $(date -d "${TIMESTAMP:0:4}-${TIMESTAMP:4:2}-${TIMESTAMP:6:2}" +%s 2>/dev/null || echo "0")) / 86400 ))
      if [ "$WEEKLY_AGE" -le "$((WEEKLY_RETENTION * 7))" ]; then
        echo "      Keeping weekly backup: $(basename "$file")"
        continue
      fi
    fi
    
    # Keep monthly backups (1st of month)
    if [ "$DAY_OF_MONTH" = "1" ]; then
      MONTHLY_AGE=$(( ($(date +%s) - $(date -d "${TIMESTAMP:0:4}-${TIMESTAMP:4:2}-${TIMESTAMP:6:2}" +%s 2>/dev/null || echo "0")) / 86400 ))
      if [ "$MONTHLY_AGE" -le "$((MONTHLY_RETENTION * 30))" ]; then
        echo "      Keeping monthly backup: $(basename "$file")"
        continue
      fi
    fi
  fi
  
  # Delete old backup
  echo "      Deleting: $(basename "$file")"
  rm -f "$file"
  rm -f "${file}.sha256"
done

# Aggressive cleanup if disk space is critical
if [ "$AGGRESSIVE_CLEANUP" = true ]; then
  echo "3. Performing aggressive cleanup..."
  
  # Keep only the most recent 3 backups
  find "${BACKUP_DIR}" -name "sovereign_backup_*.sql.gz" -type f | sort -r | tail -n +4 | while read -r file; do
    echo "   Force deleting: $(basename "$file")"
    rm -f "$file"
    rm -f "${file}.sha256"
  done
fi

# Clean up orphaned checksum files
echo "4. Cleaning up orphaned checksum files..."
find "${BACKUP_DIR}" -name "*.sha256" -type f | while read -r checksum_file; do
  backup_file="${checksum_file%.sha256}"
  if [ ! -f "$backup_file" ]; then
    echo "   Removing orphaned checksum: $(basename "$checksum_file")"
    rm -f "$checksum_file"
  fi
done

# Summary
FINAL_COUNT=$(find "${BACKUP_DIR}" -name "sovereign_backup_*.sql.gz" | wc -l)
FINAL_DISK_USAGE=$(df -h "${BACKUP_DIR}" | tail -n 1 | awk '{print $5}' | sed 's/%//')
TOTAL_SIZE=$(du -sh "${BACKUP_DIR}" | cut -f1)

echo ""
echo "=========================================="
echo "Cleanup Summary"
echo "=========================================="
echo "Backups before: ${TOTAL_BACKUPS}"
echo "Backups after:  ${FINAL_COUNT}"
echo "Backups removed: $((TOTAL_BACKUPS - FINAL_COUNT))"
echo "Total backup size: ${TOTAL_SIZE}"
echo "Disk usage: ${FINAL_DISK_USAGE}%"
echo "✓ Cleanup completed"
