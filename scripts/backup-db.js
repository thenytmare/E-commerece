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
 * NOTE: this backs up the Postgres database only. Uploaded media files under
 * apps/web/public/uploads are stored on local disk and are NOT covered by
 * this script — see docs/backups.md.
 */
const { spawn, spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const { loadEnv } = require('./lib/env');
const { parseDatabaseUrl } = require('./lib/db-connection');

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

async function dumpWithLocalPgDump(databaseUrl, outFile) {
  return new Promise((resolve, reject) => {
    const proc = spawn('pg_dump', ['--format=custom', '--no-owner', '--file', outFile, databaseUrl], {
      stdio: 'inherit',
    });
    proc.on('error', reject);
    proc.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(`pg_dump exited with code ${code}`))));
  });
}

async function dumpWithDockerCompose(conn, outFile) {
  return new Promise((resolve, reject) => {
    const out = fs.createWriteStream(outFile);
    const proc = spawn(
      'docker',
      ['compose', 'exec', '-T', '-e', `PGPASSWORD=${conn.password}`, 'postgres', 'pg_dump', '--format=custom', '--no-owner', '-U', conn.user, conn.database],
      { cwd: path.join(__dirname, '..'), stdio: ['ignore', 'pipe', 'inherit'] }
    );
    proc.stdout.pipe(out);
    proc.on('error', reject);
    proc.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(`docker compose pg_dump exited with code ${code}`))));
  });
}

function pruneOldBackups() {
  if (!fs.existsSync(BACKUP_DIR)) return;
  const cutoff = Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000;
  for (const file of fs.readdirSync(BACKUP_DIR)) {
    if (!file.endsWith('.dump')) continue;
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

  try {
    if (commandExists('pg_dump')) {
      await dumpWithLocalPgDump(databaseUrl, outFile);
    } else {
      console.log('pg_dump not found on PATH, falling back to `docker compose exec postgres pg_dump`...');
      await dumpWithDockerCompose(conn, outFile);
    }
  } catch (error) {
    if (fs.existsSync(outFile)) fs.unlinkSync(outFile);
    console.error('Backup failed:', error.message);
    process.exit(1);
  }

  const sizeKb = (fs.statSync(outFile).size / 1024).toFixed(1);
  console.log(`Backup complete: ${outFile} (${sizeKb} KB)`);

  pruneOldBackups();
}

main();
