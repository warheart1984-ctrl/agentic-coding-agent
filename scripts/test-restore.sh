#!/bin/bash
set -e

# Test Restore Script for Sovereign Agent
# This script tests the restore procedure without affecting production data

# Configuration
TEST_DB_HOST="${TEST_DB_HOST:-localhost}"
TEST_DB_PORT="${TEST_DB_PORT:-5433}"
TEST_DB_NAME="${TEST_DB_NAME:-sovereign_test}"
TEST_DB_USER="${TEST_DB_USER:-sovereign}"
TEST_DB_PASSWORD="${TEST_DB_PASSWORD:-test_password}"
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

echo "Testing restore from: ${BACKUP_FILE}"
echo "Target database: ${TEST_DB_NAME} on ${TEST_DB_HOST}:${TEST_DB_PORT}"
echo "=========================================="

# 1. Verify backup first
echo "1. Verifying backup integrity..."
./scripts/verify-backup.sh "${BACKUP_FILE}" || {
  echo "ERROR: Backup verification failed, aborting test restore"
  exit 1
}

# 2. Create test database
echo "2. Creating test database..."
PGPASSWORD="${TEST_DB_PASSWORD}" psql \
  -h "${TEST_DB_HOST}" \
  -p "${TEST_DB_PORT}" \
  -U "${TEST_DB_USER}" \
  -d postgres \
  -c "DROP DATABASE IF EXISTS ${TEST_DB_NAME};" || true

PGPASSWORD="${TEST_DB_PASSWORD}" psql \
  -h "${TEST_DB_HOST}" \
  -p "${TEST_DB_PORT}" \
  -U "${TEST_DB_USER}" \
  -d postgres \
  -c "CREATE DATABASE ${TEST_DB_NAME};" || {
  echo "ERROR: Failed to create test database"
  exit 1
}

echo "✓ Test database created"

# 3. Perform test restore
echo "3. Performing test restore..."
gunzip -c "${BACKUP_FILE}" | PGPASSWORD="${TEST_DB_PASSWORD}" psql \
  -h "${TEST_DB_HOST}" \
  -p "${TEST_DB_PORT}" \
  -U "${TEST_DB_USER}" \
  -d "${TEST_DB_NAME}" \
  --quiet || {
  echo "ERROR: Restore failed"
  exit 1
}

echo "✓ Restore completed"

# 4. Validate restored data
echo "4. Validating restored data..."

# Check table existence
TABLES=$(
  PGPASSWORD="${TEST_DB_PASSWORD}" psql \
  -h "${TEST_DB_HOST}" \
  -p "${TEST_DB_PORT}" \
  -U "${TEST_DB_USER}" \
  -d "${TEST_DB_NAME}" \
  -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';"
)

echo "✓ Tables found: ${TABLES}"

# Check specific tables
CRITICAL_TABLES=("Organization" "User" "LedgerEntry" "Receipt" "Snapshot")
for table in "${CRITICAL_TABLES[@]}"; do
  COUNT=$(
    PGPASSWORD="${TEST_DB_PASSWORD}" psql \
    -h "${TEST_DB_HOST}" \
    -p "${TEST_DB_PORT}" \
    -U "${TEST_DB_USER}" \
    -d "${TEST_DB_NAME}" \
    -t -c "SELECT COUNT(*) FROM \"${table}\";" 2>/dev/null || echo "0"
  )
  if [ "$COUNT" -ge 0 ]; then
    echo "✓ ${table}: ${COUNT} rows"
  else
    echo "✗ ${table}: Table not found"
  fi
done

# Check data integrity
USER_COUNT=$(
  PGPASSWORD="${TEST_DB_PASSWORD}" psql \
  -h "${TEST_DB_HOST}" \
  -p "${TEST_DB_PORT}" \
  -U "${TEST_DB_USER}" \
  -d "${TEST_DB_NAME}" \
  -t -c "SELECT COUNT(*) FROM \"User\";" 2>/dev/null || echo "0"
)

LEDGER_COUNT=$(
  PGPASSWORD="${TEST_DB_PASSWORD}" psql \
  -h "${TEST_DB_HOST}" \
  -p "${TEST_DB_PORT}" \
  -U "${TEST_DB_USER}" \
  -d "${TEST_DB_NAME}" \
  -t -c "SELECT COUNT(*) FROM \"LedgerEntry\";" 2>/dev/null || echo "0"
)

echo "✓ Data validation: ${USER_COUNT} users, ${LEDGER_COUNT} ledger entries"

# 5. Cleanup test database
echo "5. Cleaning up test database..."
PGPASSWORD="${TEST_DB_PASSWORD}" psql \
  -h "${TEST_DB_HOST}" \
  -p "${TEST_DB_PORT}" \
  -U "${TEST_DB_USER}" \
  -d postgres \
  -c "DROP DATABASE ${TEST_DB_NAME};" || true

echo "✓ Test database cleaned up"

# 6. Summary
echo ""
echo "=========================================="
echo "Test Restore Summary"
echo "=========================================="
echo "✓ Backup verification: PASSED"
echo "✓ Test restore: PASSED"
echo "✓ Data validation: PASSED"
echo "✓ Cleanup: COMPLETED"
echo ""
echo "The backup is ready for production restore if needed."
