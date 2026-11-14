#!/usr/bin/env node
/**
 * Restores a Postgres backup created by scripts/backup-db.js.
 *
 * DESTRUCTIVE: this drops and recreates existing objects in the target
 * database (via pg_restore --clean --if-exists) before restoring. It prints
 * the exact target first, then asks you to type the database name. Pass --yes
 * to skip the question in automation.
 *
 * Usage:
 *   node scripts/restore-db.js backups/<file>.dump --yes
 *   node scripts/restore-db.js backups/<file>.dump --yes --target=<DATABASE_URL>
 *   node scripts/restore-db.js backups/<file>.dump --with-uploads
 *
 * By default restores into DATABASE_URL from .env. Pass --target to restore
 * into a different database (e.g. a scratch DB for verifying a backup).
 */
const { spawn, spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const { loadEnv } = require('./lib/env');
const readline = require('readline');
const { parseDatabaseUrl } = require('./lib/db-connection');
const {
  planRestore,
  describeTarget,
  resolveUploadDir,
  uploadsArchiveFor,
  planUploadsRestore,
} = require('./lib/pg-plan');

loadEnv();

function commandExists(cmd) {
  const result = spawnSync(cmd, ['--version'], { stdio: 'ignore' });
  return result.error === undefined || result.error.code !== 'ENOENT';
}

/** Run a planned command. Passwords travel in the environment, never in arguments. */
function run(planned) {
  return new Promise((resolve, reject) => {
    const proc = spawn(planned.command, planned.args, {
      cwd: path.join(__dirname, '..'),
      env: { ...process.env, ...(planned.env || {}) },
      stdio: [planned.stdinFile ? 'pipe' : 'inherit', 'inherit', 'inherit'],
    });
    if (planned.stdinFile) fs.createReadStream(planned.stdinFile).pipe(proc.stdin);
    proc.on('error', reject);
    proc.on('exit', (code) =>
      code === 0 ? resolve() : reject(new Error(`${planned.command} exited with code ${code}`))
    );
  });
}

/** Ask the person to type the database name. Returns true only on an exact match. */
function confirmByTyping(conn) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.question(`Type the database name "${conn.database}" to continue: `, (answer) => {
      rl.close();
      resolve(answer.trim() === conn.database);
    });
  });
}

async function main() {
  const args = process.argv.slice(2);
  const file = args.find((a) => !a.startsWith('--'));
  const confirmed = args.includes('--yes');
  const targetArg = args.find((a) => a.startsWith('--target='));
  const targetUrl = targetArg ? targetArg.slice('--target='.length) : process.env.DATABASE_URL;

  if (!file) {
    console.error('Usage: node scripts/restore-db.js <backup-file> [--yes] [--with-uploads] [--target=<DATABASE_URL>]');
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
  const conn = parseDatabaseUrl(targetUrl);
  const planned = planRestore(conn, file, { hasPgRestore: commandExists('pg_restore') });

  // Show what will really be touched BEFORE anything destructive happens.
  console.log(`Target: ${describeTarget(conn)}`);
  console.log(`Method: ${planned.mode === 'refuse' ? 'none (refused)' : planned.mode === 'docker' ? 'local Docker Postgres' : 'pg_restore'}`);
  console.log('This will DROP and REPLACE existing data in that database.');

  if (planned.mode === 'refuse') {
    console.error(planned.reason);
    process.exit(1);
  }

  if (!confirmed) {
    if (!process.stdin.isTTY) {
      console.error('Refusing to restore without --yes (no terminal to ask on).');
      process.exit(1);
    }
    if (!(await confirmByTyping(conn))) {
      console.error('Name did not match. Nothing was changed.');
      process.exit(1);
    }
  }

  try {
    await run(planned);
  } catch (error) {
    console.error('Restore failed:', error.message);
    process.exit(1);
  }

  // Uploaded media, if an archive sits next to the dump and --with-uploads was given.
  const archive = uploadsArchiveFor(file);
  if (args.includes('--with-uploads')) {
    if (!fs.existsSync(archive)) {
      console.error(`Uploads archive not found: ${archive}`);
      process.exit(1);
    }
    const uploadDir = resolveUploadDir(path.join(__dirname, '..'));
    fs.mkdirSync(uploadDir, { recursive: true });
    try {
      await run(planUploadsRestore(uploadDir, archive));
      console.log(`Uploads restored into ${uploadDir}`);
    } catch (error) {
      console.error('Uploads restore failed:', error.message);
      process.exit(1);
    }
  } else if (fs.existsSync(archive)) {
    console.log(`An uploads archive exists (${archive}). Add --with-uploads to restore it too.`);
  }

  console.log('Restore complete.');
}

main();
