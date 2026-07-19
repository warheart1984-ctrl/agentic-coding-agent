# Backup and Restore Procedures

## Overview

The Sovereign Agent includes automated PostgreSQL backup and restore functionality to ensure data safety and disaster recovery capabilities.

## Automated Backups

### Configuration

Backups are automatically scheduled via the `backup` service in docker-compose.yml:

- **Schedule**: Daily (every 24 hours)
- **Retention**: 7 days (configurable via `BACKUP_RETENTION_DAYS`)
- **Location**: Docker volume `backup_data` mounted at `/backups`
- **Format**: Compressed SQL dumps (`.sql.gz`)
- **Integrity**: SHA256 checksums for each backup

### Environment Variables

```bash
POSTGRES_PASSWORD=your_secure_password
BACKUP_RETENTION_DAYS=7
```

### Manual Backup

To trigger a manual backup:

```bash
# Run the backup script directly
docker-compose exec backup /scripts/backup.sh

# Or run it in a one-off container
docker-compose run --rm backup /scripts/backup.sh
```

### Backup File Format

Backups are named with timestamps: `sovereign_backup_YYYYMMDD_HHMMSS.sql.gz`

Each backup includes:
- Complete database schema and data
- SHA256 checksum file (`.sha256`)
- Compression for efficient storage

## Restore Procedures

### Automated Restore from Docker

```bash
# List available backups
docker-compose exec backup ls -lh /backups/

# Restore from a specific backup
docker-compose run --rm backup /scripts/restore.sh /backups/sovereign_backup_20240101_120000.sql.gz
```

### Manual Restore

```bash
# Make the restore script executable
chmod +x scripts/restore.sh

# Set environment variables
export DB_HOST=localhost
export DB_PORT=5432
export DB_NAME=sovereign
export DB_USER=sovereign
export DB_PASSWORD=your_password

# Run restore
./scripts/restore.sh /path/to/backup.sql.gz
```

### Restore Verification

After restoring, verify the database:

```bash
# Check database connectivity
docker-compose exec postgres pg_isready -U sovereign

# Verify table counts
docker-compose exec postgres psql -U sovereign -d sovereign -c "\dt"

# Check recent ledger entries
docker-compose exec postgres psql -U sovereign -d sovereign -c "SELECT COUNT(*) FROM \"LedgerEntry\";"
```

## Backup Integrity Checks

### Checksum Verification

Each backup includes a SHA256 checksum file:

```bash
# Verify a backup's integrity
sha256sum -c sovereign_backup_20240101_120000.sql.gz.sha256
```

### Manual Backup Verification

```bash
# Extract and validate SQL structure
gunzip -c sovereign_backup_20240101_120000.sql.gz | head -n 50

# Check for complete dump
gunzip -c sovereign_backup_20240101_120000.sql.gz | tail -n 20
```

## Disaster Recovery Procedures

### Complete System Recovery

1. **Stop all services**
   ```bash
   docker-compose down
   ```

2. **Restore PostgreSQL data volume** (if corrupted)
   ```bash
   # Remove corrupted volume
   docker volume rm agentic-coding-agent_postgres_data
   
   # Recreate and restore
   docker-compose up -d postgres
   docker-compose run --rm backup /scripts/restore.sh /backups/latest_backup.sql.gz
   ```

3. **Restart all services**
   ```bash
   docker-compose up -d
   ```

### Point-in-Time Recovery

For more granular recovery, you can:

1. Identify the specific backup needed based on timestamp
2. Restore that specific backup
3. Apply any necessary data migrations

### Offsite Backup Storage

For production environments, implement offsite backup storage:

```bash
# Copy backups to external storage
docker cp agentic-coding-agent_backup_1:/backups ./local_backups/

# Or use rsync for remote backup
rsync -avz ./local_backups/ user@remote-server:/backups/sovereign/
```

## Monitoring and Alerts

### Backup Monitoring

Monitor backup success via logs:

```bash
# View backup service logs
docker-compose logs -f backup

# Check last backup time
docker-compose exec backup ls -lt /backups/ | head -n 5
```

### Health Checks

The backup service includes basic health checks. Monitor for:

- Regular backup execution (every 24 hours)
- Backup file creation
- Sufficient disk space
- Checksum verification

### Failure Alerts

Implement monitoring for:
- Backup script failures
- Disk space warnings (< 20% free)
- Missing backup files
- Checksum verification failures

## Best Practices

1. **Regular Testing**: Test restore procedures monthly
2. **Offsite Storage**: Store backups in multiple locations
3. **Encryption**: Encrypt backups for sensitive data
4. **Documentation**: Keep this document updated with any changes
5. **Monitoring**: Set up alerts for backup failures
6. **Retention**: Adjust retention policy based on compliance requirements
7. **Performance**: Schedule backups during low-traffic periods

## Troubleshooting

### Backup Fails

1. Check PostgreSQL connectivity: `docker-compose exec postgres pg_isready -U sovereign`
2. Verify disk space: `docker system df`
3. Check backup service logs: `docker-compose logs backup`
4. Verify environment variables

### Restore Fails

1. Verify backup file integrity with checksum
2. Ensure PostgreSQL is running and accessible
3. Check database permissions
4. Verify sufficient disk space for restore

### Missing Backups

1. Check backup service is running: `docker-compose ps backup`
2. Verify backup volume is mounted: `docker volume ls`
3. Check retention policy hasn't deleted recent backups
4. Review backup service logs for errors

## Security Considerations

- Backup files contain sensitive data - protect appropriately
- Use strong database passwords
- Restrict access to backup volumes
- Consider encryption for backups at rest
- Implement secure offsite backup transfer
- Regularly rotate backup access credentials
