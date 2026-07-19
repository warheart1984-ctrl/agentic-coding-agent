#!/bin/bash
set -e

# PostgreSQL Backup Script for Sovereign Agent
# This script creates automated backups of the PostgreSQL database

# Configuration
DB_HOST="${DB_HOST:-postgres}"
DB_PORT="${DB_PORT:-5432}"
DB_NAME="${DB_NAME:-sovereign}"
DB_USER="${DB_USER:-sovereign}"
DB_PASSWORD="${DB_PASSWORD:-sovereign_password}"
BACKUP_DIR="${BACKUP_DIR:-/backups}"
RETENTION_DAYS="${RETENTION_DAYS:-7}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="${BACKUP_DIR}/sovereign_backup_${TIMESTAMP}.sql.gz"

# Create backup directory if it doesn't exist
mkdir -p "${BACKUP_DIR}"

echo "Starting backup at ${TIMESTAMP}"
echo "Backup file: ${BACKUP_FILE}"

# Perform the backup using pg_dump
PGPASSWORD="${DB_PASSWORD}" pg_dump \
  -h "${DB_HOST}" \
  -p "${DB_PORT}" \
  -U "${DB_USER}" \
  -d "${DB_NAME}" \
  --format=plain \
  --compress=9 \
  --verbose \
  --no-owner \
  --no-acl \
  > "${BACKUP_FILE}"

# Verify the backup was created
if [ -f "${BACKUP_FILE}" ]; then
  BACKUP_SIZE=$(du -h "${BACKUP_FILE}" | cut -f1)
  echo "Backup completed successfully: ${BACKUP_FILE} (${BACKUP_SIZE})"
  
  # Create a checksum for integrity verification
  sha256sum "${BACKUP_FILE}" > "${BACKUP_FILE}.sha256"
  echo "Checksum created: ${BACKUP_FILE}.sha256"
else
  echo "ERROR: Backup file was not created"
  exit 1
fi

# Clean up old backups beyond retention period
echo "Cleaning up backups older than ${RETENTION_DAYS} days"
find "${BACKUP_DIR}" -name "sovereign_backup_*.sql.gz" -mtime +${RETENTION_DAYS} -delete
find "${BACKUP_DIR}" -name "sovereign_backup_*.sql.gz.sha256" -mtime +${RETENTION_DAYS} -delete

echo "Backup process completed"
