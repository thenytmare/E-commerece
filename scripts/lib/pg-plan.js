/**
 * Pure planning helpers for backup and restore.
 *
 * These build the exact command, arguments and environment for each step but
 * run nothing. That keeps the risky decisions (which database is touched, is
 * the password kept out of the command line) in one place that tests can check.
 */
const path = require('path');

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1', '[::1]']);

function isLocalHost(host) {
  return LOCAL_HOSTS.has(String(host).toLowerCase());
}

/** Human text for the target. Never includes the password. */
function describeTarget(conn) {
  return `database "${conn.database}" on ${conn.host}:${conn.port} as user "${conn.user}"`;
}

/**
 * The docker fallback talks to the compose Postgres, which is published on the
 * local machine. It is only a correct stand-in when the target IS that local
 * database. For any other host it would silently act on the wrong database.
 */
function canUseCompose(conn, composePort = process.env.COMPOSE_PG_PORT || '5432') {
  return isLocalHost(conn.host) && String(conn.port) === String(composePort);
}

const REFUSE_REMOTE =
  'pg_restore/pg_dump is not installed here, and the target is not the local Docker database. ' +
  'Install the PostgreSQL client tools (pg_dump and pg_restore) and run again. ' +
  'The Docker fallback is refused for remote targets so it cannot act on the wrong database.';

function planRestore(conn, file, opts = {}) {
  const common = ['--clean', '--if-exists', '--no-owner'];
  if (opts.hasPgRestore) {
    return {
      mode: 'local',
      command: 'pg_restore',
      // Host, port, user and database are explicit. The password goes in the
      // environment, so it never shows up in a process list.
      args: [...common, '-h', conn.host, '-p', String(conn.port), '-U', conn.user, '-d', conn.database, file],
      env: { PGPASSWORD: conn.password },
    };
  }
  if (canUseCompose(conn, opts.composePort)) {
    return {
      mode: 'docker',
      command: 'docker',
      args: ['compose', 'exec', '-T', '-e', 'PGPASSWORD', 'postgres', 'pg_restore', ...common, '-U', conn.user, '-d', conn.database],
      env: { PGPASSWORD: conn.password },
      stdinFile: file,
    };
  }
  return { mode: 'refuse', reason: REFUSE_REMOTE };
}

function planDump(conn, outFile, opts = {}) {
  const common = ['--format=custom', '--no-owner'];
  if (opts.hasPgDump) {
    return {
      mode: 'local',
      command: 'pg_dump',
      args: [...common, '-h', conn.host, '-p', String(conn.port), '-U', conn.user, '--file', outFile, conn.database],
      env: { PGPASSWORD: conn.password },
    };
  }
  if (canUseCompose(conn, opts.composePort)) {
    return {
      mode: 'docker',
      command: 'docker',
      args: ['compose', 'exec', '-T', '-e', 'PGPASSWORD', 'postgres', 'pg_dump', ...common, '-U', conn.user, conn.database],
      env: { PGPASSWORD: conn.password },
      stdoutFile: outFile,
    };
  }
  return { mode: 'refuse', reason: REFUSE_REMOTE };
}

/** Where uploaded media lives. Matches apps/web/lib/media/storage.ts. */
function resolveUploadDir(repoRoot, env = process.env) {
  const configured = (env.UPLOAD_DIR || '').trim();
  return configured ? path.resolve(configured) : path.join(repoRoot, 'apps', 'web', 'public', 'uploads');
}

function uploadsArchiveFor(dumpFile) {
  return dumpFile.replace(/\.dump$/, '') + '-uploads.tar.gz';
}

function planUploadsBackup(uploadDir, archive) {
  return { command: 'tar', args: ['-czf', archive, '-C', uploadDir, '.'] };
}

function planUploadsRestore(uploadDir, archive) {
  return { command: 'tar', args: ['-xzf', archive, '-C', uploadDir] };
}

module.exports = {
  isLocalHost,
  describeTarget,
  canUseCompose,
  planRestore,
  planDump,
  resolveUploadDir,
  uploadsArchiveFor,
  planUploadsBackup,
  planUploadsRestore,
};
