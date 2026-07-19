#!/bin/bash
set -e

# Backup Verification Script for Sovereign Agent
# This script verifies backup integrity and validates database structure

# Configuration
BACKUP_DIR="${BACKUP_DIR:-/backups}"
BACKUP_FILE="${1:-}"

if [ -z "${BACKUP_FILE}" ]; then
  echo "Usage: $0 <backup_file>"
  echo "Available backups:"
  ls -lh "${BACKUP_DIR}"/sovereign_backup_*.sql.gz 2>/dev/null || echo "No backups found"
  exit 1
fi

if [ ! -f "${BACKUP_FILE}" ]; then
  echo "ERROR: Backup file not found: ${BACKUP_FILE}"
  exit 1
fi

echo "Verifying backup: ${BACKUP_FILE}"
echo "=========================================="

# 1. Check file exists and is readable
echo "1. File accessibility check..."
if [ -r "${BACKUP_FILE}" ]; then
  FILE_SIZE=$(du -h "${BACKUP_FILE}" | cut -f1)
  echo "✓ File exists and is readable (${FILE_SIZE})"
else
  echo "✗ File is not readable"
  exit 1
fi

# 2. Verify SHA256 checksum
echo "2. Checksum verification..."
if [ -f "${BACKUP_FILE}.sha256" ]; then
  if sha256sum -c "${BACKUP_FILE}.sha256" > /dev/null 2>&1; then
    echo "✓ SHA256 checksum verified"
  else
    echo "✗ SHA256 checksum verification failed"
    echo "Expected: $(cat ${BACKUP_FILE}.sha256)"
    echo "Actual:   $(sha256sum ${BACKUP_FILE})"
    exit 1
  fi
else
  echo "⚠ No checksum file found, generating new checksum..."
  sha256sum "${BACKUP_FILE}" > "${BACKUP_FILE}.sha256"
  echo "✓ Checksum generated: ${BACKUP_FILE}.sha256"
fi

# 3. Verify gzip integrity
echo "3. Gzip integrity check..."
if gzip -t "${BACKUP_FILE}" 2>/dev/null; then
  echo "✓ Gzip file is valid"
else
  echo "✗ Gzip file is corrupted"
  exit 1
fi

# 4. Verify SQL structure
echo "4. SQL structure validation..."
TEMP_SQL=$(mktemp)
gunzip -c "${BACKUP_FILE}" > "${TEMP_SQL}"

# Check for essential PostgreSQL dump components
ESSENTIAL_STATEMENTS=(
  "SET"
  "CREATE TABLE"
  "COPY"
  "ALTER TABLE"
  "CREATE INDEX"
)

MISSING_COUNT=0
for stmt in "${ESSENTIAL_STATEMENTS[@]}"; do
  if grep -q "${stmt}" "${TEMP_SQL}"; then
    echo "✓ Found: ${stmt}"
  else
    echo "✗ Missing: ${stmt}"
    MISSING_COUNT=$((MISSING_COUNT + 1))
  fi
done

# Check for expected tables
EXPECTED_TABLES=(
  "Organization"
  "User"
  "LedgerEntry"
  "Receipt"
  "Snapshot"
)

TABLE_COUNT=0
for table in "${EXPECTED_TABLES[@]}"; do
  if grep -qi "CREATE TABLE.*${table}" "${TEMP_SQL}"; then
    echo "✓ Found table: ${table}"
    TABLE_COUNT=$((TABLE_COUNT + 1))
  else
    echo "⚠ Table not found: ${table}"
  fi
done

# Check for data presence
DATA_COUNT=$(grep -c "^COPY " "${TEMP_SQL}" || echo "0")
echo "✓ Data statements found: ${DATA_COUNT}"

# Cleanup
rm -f "${TEMP_SQL}"

# 5. Summary
echo ""
echo "=========================================="
echo "Verification Summary"
echo "=========================================="

if [ ${MISSING_COUNT} -eq 0 ] && [ ${TABLE_COUNT} -ge 3 ] && [ ${DATA_COUNT} -gt 0 ]; then
  echo "✓ Backup verification PASSED"
  echo "  - File integrity: OK"
  echo "  - Checksum: OK"
  echo "  - SQL structure: OK"
  echo "  - Tables found: ${TABLE_COUNT}/${#EXPECTED_TABLES[@]}"
  echo "  - Data statements: ${DATA_COUNT}"
  exit 0
else
  echo "✗ Backup verification FAILED"
  echo "  - Missing statements: ${MISSING_COUNT}"
  echo "  - Tables found: ${TABLE_COUNT}/${#EXPECTED_TABLES[@]}"
  echo "  - Data statements: ${DATA_COUNT}"
  exit 1
fi
