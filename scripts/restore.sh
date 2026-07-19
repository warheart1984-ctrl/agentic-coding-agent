#!/bin/bash
set -e

# PostgreSQL Restore Script for Sovereign Agent
# This script restores a PostgreSQL database from a backup file

# Configuration
DB_HOST="${DB_HOST:-postgres}"
DB_PORT="${DB_PORT:-5432}"
DB_NAME="${DB_NAME:-sovereign}"
DB_USER="${DB_USER:-sovereign}"
DB_PASSWORD="${DB_PASSWORD:-sovereign_password}"
BACKUP_DIR="${BACKUP_DIR:-/backups}"

# Check if backup file is provided
if [ -z "$1" ]; then
  echo "Usage: $0 <backup_file>"
  echo "Available backups:"
  ls -lh "${BACKUP_DIR}"/sovereign_backup_*.sql.gz 2>/dev/null || echo "No backups found"
  exit 1
fi

BACKUP_FILE="$1"

# Check if backup file exists
if [ ! -f "${BACKUP_FILE}" ]; then
  echo "ERROR: Backup file not found: ${BACKUP_FILE}"
  exit 1
fi

# Verify checksum if available
if [ -f "${BACKUP_FILE}.sha256" ]; then
  echo "Verifying backup integrity..."
  if sha256sum -c "${BACKUP_FILE}.sha256"; then
    echo "Checksum verification passed"
  else
    echo "ERROR: Checksum verification failed"
    exit 1
  fi
else
  echo "Warning: No checksum file found, skipping verification"
fi

# Confirm restore
echo "WARNING: This will overwrite the current database '${DB_NAME}'"
echo "Backup file: ${BACKUP_FILE}"
read -p "Are you sure you want to continue? (yes/no): " confirm

if [ "$confirm" != "yes" ]; then
  echo "Restore cancelled"
  exit 0
fi

echo "Starting restore from ${BACKUP_FILE}"

# Perform the restore using psql
gunzip -c "${BACKUP_FILE}" | PGPASSWORD="${DB_PASSWORD}" psql \
  -h "${DB_HOST}" \
  -p "${DB_PORT}" \
  -U "${DB_USER}" \
  -d "${DB_NAME}" \
  --verbose

echo "Restore completed successfully"
