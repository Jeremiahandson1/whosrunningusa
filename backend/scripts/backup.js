#!/usr/bin/env node

/**
 * Database Backup Script
 *
 * Creates a pg_dump backup of the database and optionally uploads to S3.
 * Retains the last N backups (local and/or S3).
 *
 * Environment variables:
 *   DATABASE_URL         — PostgreSQL connection string (required)
 *   BACKUP_DIR           — Local backup directory (default: backend/backups)
 *   BACKUP_RETAIN_COUNT  — Number of backups to keep (default: 7)
 *   BACKUP_S3_ENABLED    — Set to "true" to upload to S3
 *   S3_BUCKET            — S3 bucket name (required if S3 enabled)
 *   S3_BACKUP_PREFIX     — S3 key prefix (default: "backups/")
 *   AWS_REGION           — AWS region (default: us-east-1)
 *   AWS_ACCESS_KEY_ID    — AWS credentials
 *   AWS_SECRET_ACCESS_KEY — AWS credentials
 *
 * Usage:
 *   node scripts/backup.js              # Backup to local file (+ S3 if configured)
 *   node scripts/backup.js --s3-only    # Skip local retention, upload to S3 only
 *   node scripts/backup.js --local-only # Skip S3 upload even if configured
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const db = require('../db');

const args = process.argv.slice(2);
const s3Only = args.includes('--s3-only');
const localOnly = args.includes('--local-only');

const BACKUP_DIR = process.env.BACKUP_DIR || path.join(__dirname, '..', 'backups');
const RETAIN_COUNT = parseInt(process.env.BACKUP_RETAIN_COUNT) || 7;
const S3_ENABLED = !localOnly && (process.env.BACKUP_S3_ENABLED === 'true');
const S3_BUCKET = process.env.S3_BUCKET;
const S3_PREFIX = process.env.S3_BACKUP_PREFIX || 'backups/';

function getTimestamp() {
  return new Date().toISOString().replace(/[:.]/g, '-').replace('T', '_').slice(0, 19);
}

function parseDatabaseUrl(url) {
  const parsed = new URL(url);
  return {
    host: parsed.hostname,
    port: parsed.port || '5432',
    database: parsed.pathname.slice(1),
    user: parsed.username,
    password: parsed.password,
  };
}

function runPgDump(outputPath) {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    throw new Error('DATABASE_URL environment variable is required');
  }

  // Use pg_dump with connection string
  // Set PGPASSWORD to avoid password prompt
  const dbInfo = parseDatabaseUrl(dbUrl);
  const env = {
    ...process.env,
    PGPASSWORD: dbInfo.password,
  };

  const cmd = [
    'pg_dump',
    `-h ${dbInfo.host}`,
    `-p ${dbInfo.port}`,
    `-U ${dbInfo.user}`,
    `-d ${dbInfo.database}`,
    '--format=custom',
    '--no-owner',
    '--no-privileges',
    `--file=${outputPath}`,
  ].join(' ');

  console.log(`  Running pg_dump for database "${dbInfo.database}"...`);
  execSync(cmd, { env, stdio: 'pipe', timeout: 300000 }); // 5 min timeout
}

async function uploadToS3(filePath, s3Key) {
  const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');

  const client = new S3Client({
    region: process.env.AWS_REGION || 'us-east-1',
  });

  const fileStream = fs.createReadStream(filePath);
  const fileSize = fs.statSync(filePath).size;

  console.log(`  Uploading to s3://${S3_BUCKET}/${s3Key} (${(fileSize / 1024 / 1024).toFixed(1)} MB)...`);

  await client.send(new PutObjectCommand({
    Bucket: S3_BUCKET,
    Key: s3Key,
    Body: fileStream,
    ContentType: 'application/octet-stream',
    Metadata: {
      'backup-timestamp': new Date().toISOString(),
      'source': 'whosrunningusa-backup',
    },
  }));

  console.log(`  S3 upload complete.`);
}

async function pruneS3Backups() {
  const { S3Client, ListObjectsV2Command, DeleteObjectCommand } = require('@aws-sdk/client-s3');

  const client = new S3Client({
    region: process.env.AWS_REGION || 'us-east-1',
  });

  const listResult = await client.send(new ListObjectsV2Command({
    Bucket: S3_BUCKET,
    Prefix: S3_PREFIX,
  }));

  const objects = (listResult.Contents || [])
    .filter(obj => obj.Key.endsWith('.dump'))
    .sort((a, b) => b.LastModified - a.LastModified);

  if (objects.length > RETAIN_COUNT) {
    const toDelete = objects.slice(RETAIN_COUNT);
    console.log(`  Pruning ${toDelete.length} old S3 backup(s)...`);
    for (const obj of toDelete) {
      await client.send(new DeleteObjectCommand({
        Bucket: S3_BUCKET,
        Key: obj.Key,
      }));
      console.log(`    Deleted: ${obj.Key}`);
    }
  }
}

function pruneLocalBackups() {
  if (!fs.existsSync(BACKUP_DIR)) return;

  const files = fs.readdirSync(BACKUP_DIR)
    .filter(f => f.startsWith('whosrunningusa_') && f.endsWith('.dump'))
    .sort()
    .reverse();

  if (files.length > RETAIN_COUNT) {
    const toDelete = files.slice(RETAIN_COUNT);
    console.log(`  Pruning ${toDelete.length} old local backup(s)...`);
    for (const file of toDelete) {
      const filePath = path.join(BACKUP_DIR, file);
      fs.unlinkSync(filePath);
      console.log(`    Deleted: ${file}`);
    }
  }
}

async function logBackupStatus(status, details) {
  try {
    // Ensure sync_logs table exists
    await db.query(`
      CREATE TABLE IF NOT EXISTS sync_logs (
        id SERIAL PRIMARY KEY,
        job_type VARCHAR(50) NOT NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'running',
        started_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        finished_at TIMESTAMP,
        duration_ms INTEGER,
        steps_total INTEGER DEFAULT 0,
        steps_completed INTEGER DEFAULT 0,
        steps_failed INTEGER DEFAULT 0,
        steps_skipped INTEGER DEFAULT 0,
        details JSONB DEFAULT '{}',
        error_message TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await db.query(
      `INSERT INTO sync_logs (job_type, status, started_at, finished_at, duration_ms, steps_total, steps_completed, details, error_message)
       VALUES ('backup', $1, $2, NOW(), $3, 1, $4, $5, $6)`,
      [
        status,
        details.startedAt,
        details.durationMs,
        status === 'completed' ? 1 : 0,
        JSON.stringify(details),
        details.error || null,
      ]
    );
  } catch (err) {
    console.error(`  Warning: Failed to log backup status to database: ${err.message}`);
  }
}

async function main() {
  const startedAt = new Date();
  const timestamp = getTimestamp();
  const filename = `whosrunningusa_${timestamp}.dump`;
  const localPath = path.join(BACKUP_DIR, filename);

  console.log(`=== Database Backup ===`);
  console.log(`  Time:      ${startedAt.toISOString()}`);
  console.log(`  Filename:  ${filename}`);
  console.log(`  Local dir: ${s3Only ? '(skipped)' : BACKUP_DIR}`);
  console.log(`  S3:        ${S3_ENABLED ? `s3://${S3_BUCKET}/${S3_PREFIX}` : 'disabled'}`);
  console.log(`  Retain:    ${RETAIN_COUNT} backups`);
  console.log('');

  try {
    // Ensure backup directory exists
    if (!s3Only) {
      fs.mkdirSync(BACKUP_DIR, { recursive: true });
    }

    // Create a temp path if s3-only (we still need a local file to upload)
    const dumpPath = s3Only ? path.join(BACKUP_DIR, `.tmp_${filename}`) : localPath;
    if (s3Only) {
      fs.mkdirSync(BACKUP_DIR, { recursive: true });
    }

    // Step 1: pg_dump
    console.log(`[1] Creating database dump...`);
    runPgDump(dumpPath);

    const fileSize = fs.statSync(dumpPath).size;
    console.log(`  Dump created: ${(fileSize / 1024 / 1024).toFixed(1)} MB\n`);

    // Step 2: Upload to S3 (if enabled)
    if (S3_ENABLED) {
      if (!S3_BUCKET) {
        console.log(`  Warning: S3_BUCKET not set, skipping S3 upload.`);
      } else {
        console.log(`[2] Uploading to S3...`);
        const s3Key = `${S3_PREFIX}${filename}`;
        await uploadToS3(dumpPath, s3Key);

        // Prune old S3 backups
        await pruneS3Backups();
        console.log('');
      }
    }

    // Clean up temp file if s3-only
    if (s3Only && fs.existsSync(dumpPath)) {
      fs.unlinkSync(dumpPath);
    }

    // Step 3: Prune old local backups
    if (!s3Only) {
      console.log(`[${S3_ENABLED ? '3' : '2'}] Pruning old local backups...`);
      pruneLocalBackups();
      console.log('');
    }

    const durationMs = Date.now() - startedAt.getTime();

    // Log to database
    await logBackupStatus('completed', {
      startedAt,
      durationMs,
      filename,
      fileSize,
      s3Uploaded: S3_ENABLED && !!S3_BUCKET,
      localPath: s3Only ? null : localPath,
    });

    console.log(`=== Backup Complete ===`);
    console.log(`  Duration: ${(durationMs / 1000).toFixed(1)}s`);
    console.log(`  Size:     ${(fileSize / 1024 / 1024).toFixed(1)} MB`);
    if (!s3Only) {
      console.log(`  Path:     ${localPath}`);
    }

    await db.pool.end();
    process.exit(0);
  } catch (err) {
    const durationMs = Date.now() - startedAt.getTime();

    console.error(`\nBackup failed: ${err.message}`);

    await logBackupStatus('failed', {
      startedAt,
      durationMs,
      error: err.message,
    });

    await db.pool.end();
    process.exit(1);
  }
}

main();
