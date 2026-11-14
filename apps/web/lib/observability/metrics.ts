import { monitorEventLoopDelay } from 'node:perf_hooks';
import { prisma } from '@repo/database';

/**
 * Light process and database metrics, written as one JSON line every
 * `METRICS_INTERVAL_SECONDS` (default 30). No personal data, no query text.
 *
 * Request timing per route is not done here. Next.js has no hook that sees
 * the finished response time. Use the reverse proxy log for that (see
 * docs/performance-baseline.md, nginx `$request_time`).
 */
const globalForMetrics = globalThis as unknown as { metricsTimer?: NodeJS.Timeout };

interface DbRow {
  state: string | null;
  waiting: boolean;
  n: number;
}

export function startMetrics(): void {
  if (globalForMetrics.metricsTimer) return;
  if (process.env.METRICS_LOG === 'false') return;

  const intervalMs = Math.max(5, Number(process.env.METRICS_INTERVAL_SECONDS ?? 30)) * 1000;
  // The sampler itself ticks every RESOLUTION_MS, so that amount is taken off
  // to show only the extra delay caused by busy work.
  const RESOLUTION_MS = 10;
  const loop = monitorEventLoopDelay({ resolution: RESOLUTION_MS });
  const extra = (ns: number) => Math.max(0, Math.round(ns / 1e6 - RESOLUTION_MS));
  loop.enable();
  let lastCpu = process.cpuUsage();
  let lastAt = Date.now();

  globalForMetrics.metricsTimer = setInterval(async () => {
    const now = Date.now();
    const cpu = process.cpuUsage(lastCpu);
    const cpuPercent = Math.round(((cpu.user + cpu.system) / 1000 / (now - lastAt)) * 100);
    lastCpu = process.cpuUsage();
    lastAt = now;

    const line: Record<string, unknown> = {
      type: 'metrics',
      at: new Date(now).toISOString(),
      cpuPercent,
      rssMb: Math.round(process.memoryUsage().rss / 1048576),
      heapUsedMb: Math.round(process.memoryUsage().heapUsed / 1048576),
      eventLoopDelayMs: { p50: extra(loop.percentile(50)), p99: extra(loop.percentile(99)), max: extra(loop.max) },
    };
    loop.reset();

    try {
      const rows = await prisma.$queryRaw<DbRow[]>`
        SELECT state, (wait_event_type = 'Lock') AS waiting, count(*)::int AS n
        FROM pg_stat_activity
        WHERE datname = current_database() AND pid <> pg_backend_pid()
        GROUP BY 1, 2`;
      const by = (s: string) => rows.filter((r) => r.state === s).reduce((a, r) => a + r.n, 0);
      line.db = {
        active: by('active'),
        idle: by('idle'),
        idleInTransaction: by('idle in transaction'),
        total: rows.reduce((a, r) => a + r.n, 0),
        lockWaits: rows.filter((r) => r.waiting).reduce((a, r) => a + r.n, 0),
      };
    } catch {
      line.db = 'unavailable';
    }

    console.log(JSON.stringify(line));
  }, intervalMs);
  globalForMetrics.metricsTimer.unref();
}
