#!/usr/bin/env node
/**
 * Creates a full Postgres backup (custom format, pg_restore-compatible) into
 * the local backups/ directory, then prunes dumps older than the retention
 * window.
 *
 * Usage:
 *   node scripts/backup-db.js
 *
 * Requires DATABASE_URL (from .env). Uses `pg_dump` directly if it's on
 * PATH; otherwise falls back to running it inside the `postgres` service
 * from docker-compose.yml.
 *
 * Uploaded media (UPLOAD_DIR, default apps/web/public/uploads) is archived next
 * to each dump as <dump name>-uploads.tar.gz.
 */
const { spawn, spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const { loadEnv } = require('./lib/env');
const { parseDatabaseUrl } = require('./lib/db-connection');
const { planDump, resolveUploadDir, uploadsArchiveFor, planUploadsBackup } = require('./lib/pg-plan');

loadEnv();

const BACKUP_DIR = path.join(__dirname, '..', 'backups');
const RETENTION_DAYS = Number(process.env.BACKUP_RETENTION_DAYS ?? 14);

function commandExists(cmd) {
  const result = spawnSync(cmd, ['--version'], { stdio: 'ignore' });
  return result.error === undefined || result.error.code !== 'ENOENT';
}

function timestamp() {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

/** Run a planned command. Passwords travel in the environment, never in arguments. */
function run(planned, { stdoutFile } = {}) {
  return new Promise((resolve, reject) => {
    const proc = spawn(planned.command, planned.args, {
      cwd: path.join(__dirname, '..'),
      env: { ...process.env, ...(planned.env || {}) },
      stdio: ['ignore', stdoutFile ? 'pipe' : 'inherit', 'inherit'],
    });
    if (stdoutFile) proc.stdout.pipe(fs.createWriteStream(stdoutFile));
    proc.on('error', reject);
    proc.on('exit', (code) =>
      code === 0 ? resolve() : reject(new Error(`${planned.command} exited with code ${code}`))
    );
  });
}

function pruneOldBackups() {
  if (!fs.existsSync(BACKUP_DIR)) return;
  const cutoff = Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000;
  for (const file of fs.readdirSync(BACKUP_DIR)) {
    if (!file.endsWith('.dump') && !file.endsWith('-uploads.tar.gz')) continue;
    const fullPath = path.join(BACKUP_DIR, file);
    const stat = fs.statSync(fullPath);
    if (stat.mtimeMs < cutoff) {
      fs.unlinkSync(fullPath);
      console.log(`Pruned old backup: ${file}`);
    }
  }
}

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error('DATABASE_URL is not set (checked process.env and .env files).');
    process.exit(1);
  }

  fs.mkdirSync(BACKUP_DIR, { recursive: true });

  const conn = parseDatabaseUrl(databaseUrl);
  const outFile = path.join(BACKUP_DIR, `${conn.database}-${timestamp()}.dump`);

  console.log(`Backing up database "${conn.database}" to ${outFile}...`);

  const planned = planDump(conn, outFile, { hasPgDump: commandExists('pg_dump') });
  if (planned.mode === 'refuse') {
    console.error(planned.reason);
    process.exit(1);
  }
  if (planned.mode === 'docker') {
    console.log('pg_dump not found on PATH, using the local Docker Postgres...');
  }

  try {
    await run(planned, { stdoutFile: planned.stdoutFile });
  } catch (error) {
    if (fs.existsSync(outFile)) fs.unlinkSync(outFile);
    console.error('Backup failed:', error.message);
    process.exit(1);
  }

  const sizeKb = (fs.statSync(outFile).size / 1024).toFixed(1);
  console.log(`Backup complete: ${outFile} (${sizeKb} KB)`);

  // Uploaded media is not in the database, so it is archived next to the dump.
  const uploadDir = resolveUploadDir(path.join(__dirname, '..'));
  if (fs.existsSync(uploadDir) && commandExists('tar')) {
    const archive = uploadsArchiveFor(outFile);
    try {
      await run(planUploadsBackup(uploadDir, archive));
      console.log(`Uploads archived: ${archive}`);
    } catch (error) {
      console.error('Uploads backup failed:', error.message);
      process.exit(1);
    }
  } else {
    console.warn(`Uploads folder not archived (not found, or tar missing): ${uploadDir}`);
  }

  pruneOldBackups();
}

main();
