'use strict';
/*
 * Starts the shop, on one core or on several.
 *
 *   WEB_CONCURRENCY unset or 1  -> one copy, exactly as before.
 *   WEB_CONCURRENCY=3           -> three copies sharing port 3000.
 *
 * Why: one Node process can only use one CPU core. With several copies, a busy
 * shop can use several cores at once. The copies share the same database,
 * rate limit counts (stored in Postgres) and uploads folder.
 *
 * If a copy crashes, a new one starts in its place. If copies keep crashing
 * (10 times within a minute), this program exits so the container's health
 * check fails and Coolify keeps the previous version running.
 */
const cluster = require('node:cluster');
const path = require('node:path');

const SERVER = path.join(__dirname, 'apps', 'web', 'server.js');
const MAX_COPIES = 8;
const MAX_CRASHES = 10;
const CRASH_WINDOW_MS = 60_000;
const RESTART_DELAY_MS = 1_000;
const SHUTDOWN_GRACE_MS = 10_000;

function requestedCopies() {
  const value = Number.parseInt(process.env.WEB_CONCURRENCY || '1', 10);
  if (!Number.isFinite(value) || value < 1) return 1;
  return Math.min(value, MAX_COPIES);
}

if (!cluster.isPrimary) {
  // A copy: run the shop. Node shares the port with the other copies.
  require(SERVER);
} else if (requestedCopies() === 1) {
  // One copy: run the shop in this process, like `node apps/web/server.js`.
  require(SERVER);
} else {
  const copies = requestedCopies();
  const crashes = [];
  let shuttingDown = false;

  console.log(`[cluster] Starting ${copies} copies of the shop.`);
  for (let i = 0; i < copies; i += 1) cluster.fork();

  cluster.on('online', (worker) => {
    console.log(`[cluster] Copy ${worker.id} is running (process ${worker.process.pid}).`);
  });

  cluster.on('exit', (worker, code, signal) => {
    if (shuttingDown) return;
    const now = Date.now();
    crashes.push(now);
    while (crashes.length > 0 && now - crashes[0] > CRASH_WINDOW_MS) crashes.shift();
    console.error(
      `[cluster] Copy ${worker.id} stopped (code ${code ?? 'none'}, signal ${signal ?? 'none'}). Starting a new one.`
    );
    if (crashes.length >= MAX_CRASHES) {
      console.error(`[cluster] ${MAX_CRASHES} crashes within a minute. Giving up so the previous version stays live.`);
      shuttingDown = true;
      process.exitCode = 1;
      for (const id in cluster.workers) cluster.workers[id]?.kill('SIGTERM');
      setTimeout(() => process.exit(1), 2_000);
      return;
    }
    setTimeout(() => {
      if (!shuttingDown) cluster.fork();
    }, RESTART_DELAY_MS);
  });

  const shutdown = (signal) => {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log(`[cluster] Received ${signal}. Stopping all copies.`);
    for (const id in cluster.workers) cluster.workers[id]?.kill(signal);
    const check = setInterval(() => {
      if (Object.keys(cluster.workers).length === 0) {
        clearInterval(check);
        process.exit(0);
      }
    }, 200);
    setTimeout(() => process.exit(0), SHUTDOWN_GRACE_MS).unref();
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}
