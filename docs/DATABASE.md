# Database Operations Guide

## Automatic Backups (Render)

Render's Starter plan includes daily automatic backups with 7-day retention.

- Backups happen automatically every 24 hours
- Access backups from Render Dashboard > whosrunningusa-db > Backups tab
- Point-in-time recovery is available on paid plans

## Manual Backup

### Create a backup locally

```bash
# From your local machine (requires psql/pg_dump installed)
pg_dump $DATABASE_URL -Fc -f backup_$(date +%Y%m%d).dump
```

### Create a backup from Render

1. Go to Render Dashboard > whosrunningusa-db
2. Click "Backups" tab
3. Click "Create Backup" for an on-demand backup
4. Download the backup file

## Restore

### Restore to a fresh database

```bash
# Create a new database
createdb whosrunningusa_restore

# Restore from backup
pg_restore -d whosrunningusa_restore backup_20260308.dump
```

### Restore to Render

1. Create a new Render PostgreSQL instance
2. Use the external connection string to restore:
```bash
pg_restore --no-owner --no-acl -d $NEW_DATABASE_URL backup.dump
```
3. Update the backend service to point to the new database

## Schema Migrations

Migrations run automatically on deploy (`node scripts/migrate.js` in startCommand).

### Run migrations manually

```bash
cd backend
DATABASE_URL=postgresql://... node scripts/migrate.js
```

### Check migration status

```bash
cd backend
DATABASE_URL=postgresql://... npm run migrate:status
```

### Migration files

Located in `backend/migrations/`. Each migration runs once and is tracked in the `schema_migrations` table.

| File | Description |
|------|-------------|
| 002-verification-sources.sql | Data sources tracking, sync runs |
| 003-district-county-mapping.sql | Congressional district-to-county mappings |
| 005-open-states-source.sql | Open States data source |
| 007-comprehensive-transparency.sql | Campaign finance, committees, transparency scores |
| 008-rsvp-table-and-fixes.sql | Town hall RSVPs, answers unique constraint |

## Emergency Procedures

### Database is down

1. Check Render status page: https://status.render.com
2. Check database logs in Render Dashboard
3. If corrupted, restore from latest automatic backup

### Database is full

1. Check disk usage in Render Dashboard
2. Clean up old sync_runs: `DELETE FROM sync_runs WHERE started_at < NOW() - INTERVAL '90 days'`
3. Clean up old audit_log: `DELETE FROM audit_log WHERE created_at < NOW() - INTERVAL '180 days'`
4. Upgrade plan if needed

### Need to reset staging

```bash
# Drop and recreate staging database, then run schema + migrations
psql $STAGING_DATABASE_URL -f backend/schema.sql
cd backend && DATABASE_URL=$STAGING_DATABASE_URL node scripts/migrate.js
```
