#!/usr/bin/env node
/**
 * Restores a Postgres backup created by scripts/backup-db.js.
 *
 * DESTRUCTIVE: this drops and recreates existing objects in the target
 * database (via pg_restore --clean --if-exists) before restoring. Requires
 * an explicit --yes flag so it can never run by accident.
 *
 * Usage:
 *   node scripts/restore-db.js backups/<file>.dump --yes
 *   node scripts/restore-db.js backups/<file>.dump --yes --target=<DATABASE_URL>
 *
 * By default restores into DATABASE_URL from .env. Pass --target to restore
 * into a different database (e.g. a scratch DB for verifying a backup).
 */
const { spawn, spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const { loadEnv } = require('./lib/env');
const { parseDatabaseUrl } = require('./lib/db-connection');

loadEnv();

function commandExists(cmd) {
  const result = spawnSync(cmd, ['--version'], { stdio: 'ignore' });
  return result.error === undefined || result.error.code !== 'ENOENT';
}

async function restoreWithLocalPgRestore(databaseUrl, file) {
  return new Promise((resolve, reject) => {
    const proc = spawn(
      'pg_restore',
      ['--clean', '--if-exists', '--no-owner', '--dbname', databaseUrl, file],
      { stdio: 'inherit' }
    );
    proc.on('error', reject);
    proc.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(`pg_restore exited with code ${code}`))));
  });
}

async function restoreWithDockerCompose(conn, file) {
  return new Promise((resolve, reject) => {
    const input = fs.createReadStream(file);
    const proc = spawn(
      'docker',
      [
        'compose', 'exec', '-T', '-e', `PGPASSWORD=${conn.password}`,
        'postgres', 'pg_restore', '--clean', '--if-exists', '--no-owner',
        '-U', conn.user, '-d', conn.database,
      ],
      { cwd: path.join(__dirname, '..'), stdio: ['pipe', 'inherit', 'inherit'] }
    );
    input.pipe(proc.stdin);
    proc.on('error', reject);
    proc.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(`docker compose pg_restore exited with code ${code}`))));
  });
}

async function main() {
  const args = process.argv.slice(2);
  const file = args.find((a) => !a.startsWith('--'));
  const confirmed = args.includes('--yes');
  const targetArg = args.find((a) => a.startsWith('--target='));
  const targetUrl = targetArg ? targetArg.slice('--target='.length) : process.env.DATABASE_URL;

  if (!file) {
    console.error('Usage: node scripts/restore-db.js <backup-file> --yes [--target=<DATABASE_URL>]');
    process.exit(1);
  }
  if (!fs.existsSync(file)) {
    console.error(`Backup file not found: ${file}`);
    process.exit(1);
  }
  if (!targetUrl) {
    console.error('DATABASE_URL is not set (checked process.env and .env files) and no --target was given.');
    process.exit(1);
  }
  if (!confirmed) {
    const conn = parseDatabaseUrl(targetUrl);
    console.error(
      `Refusing to restore without --yes.\n` +
        `This will DROP and REPLACE existing data in database "${conn.database}" at ${conn.host}:${conn.port}.\n` +
        `Re-run with --yes to proceed.`
    );
    process.exit(1);
  }

  const conn = parseDatabaseUrl(targetUrl);
  console.log(`Restoring ${file} into "${conn.database}" at ${conn.host}:${conn.port}...`);

  try {
    if (commandExists('pg_restore')) {
      await restoreWithLocalPgRestore(targetUrl, file);
    } else {
      console.log('pg_restore not found on PATH, falling back to `docker compose exec postgres pg_restore`...');
      await restoreWithDockerCompose(conn, file);
    }
  } catch (error) {
    console.error('Restore failed:', error.message);
    process.exit(1);
  }

  console.log('Restore complete.');
}

main();
