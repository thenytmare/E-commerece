import { hostname } from 'node:os';
import { randomBytes } from 'node:crypto';
import { createRepositories, type ClaimedJob } from '@repo/database';
import { RECONCILE_PAYMENTS_JOB, SENSITIVE_JOB_TYPES, jobHandlers, type JobHandler } from './handlers';

/**
 * Background worker. Runs inside the app process, started from
 * instrumentation.ts, so there is nothing extra to deploy.
 *
 * Every instance runs one. That is safe: jobs are claimed with
 * FOR UPDATE SKIP LOCKED, so two workers never take the same job. To run the
 * worker on only some instances, set JOBS_WORKER=false on the others.
 *
 * Settings (all optional):
 *   JOBS_WORKER=false                 do not start the worker here
 *   JOBS_POLL_SECONDS=3               how often to look for work
 *   JOBS_BATCH=5                      jobs taken per look, run together
 *   JOBS_RECONCILE_EVERY_MINUTES=15   queue a payment check this often (0 = off)
 */

const STALE_AFTER_MS = 5 * 60_000;
const DELAY_WARNING_SECONDS = 10 * 60;
const HOUSEKEEPING_EVERY_MS = 60_000;
const PURGE_EVERY_MS = 60 * 60_000;

interface WorkerState {
  started: boolean;
  stopping: boolean;
  running: number;
  timer?: NodeJS.Timeout;
  lastHousekeeping: number;
  lastPurge: number;
}

const globalForWorker = globalThis as unknown as { jobWorker?: WorkerState };

export const workerId = `${hostname()}:${process.pid}:${randomBytes(3).toString('hex')}`;

function log(event: string, data: Record<string, unknown> = {}): void {
  console.log(JSON.stringify({ type: `jobs.${event}`, at: new Date().toISOString(), worker: workerId, ...data }));
}

function withTimeout<T>(work: Promise<T>, ms: number): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`Timed out after ${Math.round(ms / 1000)} seconds.`)), ms);
  });
  return Promise.race([work, timeout]).finally(() => clearTimeout(timer));
}

type Repos = Pick<ReturnType<typeof createRepositories>, 'job' | 'rateLimit'>;

/** Run one claimed job and record the outcome. Never throws. */
export async function runJob(
  repos: Repos,
  job: ClaimedJob,
  handlers: Record<string, JobHandler> = jobHandlers,
  id: string = workerId
): Promise<'done' | 'retry' | 'failed' | 'lost'> {
  const handler = handlers[job.type];
  try {
    if (!handler) throw new Error(`No handler for job type "${job.type}".`);
    await withTimeout(handler.run(job.payload), handler.timeoutMs);
    const recorded = await repos.job.complete(job.id, id);
    return recorded ? 'done' : 'lost';
  } catch (error) {
    const outcome = await repos.job
      .fail(job, id, error, { scrubPayload: handler?.sensitive === true })
      .catch(() => 'lost' as const);
    // Never log the payload: it may hold an email address or a reset link.
    log(outcome === 'failed' ? 'failed' : 'error', {
      job: job.id,
      jobType: job.type,
      attempt: job.attempts,
      of: job.maxAttempts,
      error: error instanceof Error ? error.message : String(error),
    });
    return outcome;
  }
}

/** Slot number for a repeating job, so every instance agrees on one key per period. */
export function scheduleSlot(now: number, everyMinutes: number): number {
  return Math.floor(now / (everyMinutes * 60_000));
}

async function housekeeping(repos: Repos, state: WorkerState): Promise<void> {
  const now = Date.now();
  if (now - state.lastHousekeeping < HOUSEKEEPING_EVERY_MS) return;
  state.lastHousekeeping = now;

  const released = await repos.job.releaseStale(STALE_AFTER_MS, SENSITIVE_JOB_TYPES);
  if (released > 0) log('released-stale', { count: released });

  const stats = await repos.job.stats();
  if (stats.oldestPendingSeconds !== null && stats.oldestPendingSeconds > DELAY_WARNING_SECONDS) {
    console.warn(
      JSON.stringify({
        type: 'jobs.delayed',
        at: new Date().toISOString(),
        oldestPendingSeconds: stats.oldestPendingSeconds,
        pending: stats.counts.PENDING,
        message: 'Background jobs are waiting longer than 10 minutes. Is a worker running?',
      })
    );
  }

  const every = Number(process.env.JOBS_RECONCILE_EVERY_MINUTES ?? 0);
  if (every > 0) {
    // One job per period across all instances: the key is the same everywhere.
    await repos.job.enqueue({
      type: RECONCILE_PAYMENTS_JOB,
      uniqueKey: `reconcile:${every}:${scheduleSlot(now, every)}`,
      maxAttempts: 1,
    });
  }

  if (now - state.lastPurge >= PURGE_EVERY_MS) {
    state.lastPurge = now;
    const purged = await repos.job.purgeDone(14);
    const pruned = await repos.rateLimit.pruneExpired();
    if (purged > 0 || pruned > 0) log('purged', { jobs: purged, rateLimitRows: pruned });
  }
}

async function tick(repos: Repos, state: WorkerState, batch: number): Promise<void> {
  if (state.stopping) return;
  try {
    await housekeeping(repos, state);
    const jobs = await repos.job.claim(workerId, batch);
    if (jobs.length === 0) return;
    state.running += jobs.length;
    await Promise.all(jobs.map((job) => runJob(repos, job).finally(() => (state.running -= 1))));
  } catch (error) {
    // A database blip must not stop the loop.
    log('loop-error', { error: error instanceof Error ? error.message : String(error) });
  }
}

export function startJobWorker(): void {
  if (process.env.JOBS_WORKER === 'false') return;
  if (process.env.NEXT_PHASE === 'phase-production-build') return;
  if (globalForWorker.jobWorker?.started) return;

  const pollMs = Math.max(1, Number(process.env.JOBS_POLL_SECONDS ?? 3)) * 1000;
  const batch = Math.min(20, Math.max(1, Number(process.env.JOBS_BATCH ?? 5)));
  const repos = createRepositories();
  const state: WorkerState = { started: true, stopping: false, running: 0, lastHousekeeping: 0, lastPurge: 0 };
  globalForWorker.jobWorker = state;

  let busy = false;
  const loop = async () => {
    if (busy) return; // The last tick is still working. Do not overlap.
    busy = true;
    await tick(repos, state, batch);
    busy = false;
  };
  state.timer = setInterval(loop, pollMs);
  state.timer.unref();

  // On shutdown, stop taking new jobs. Jobs already running get a few seconds.
  // Anything cut off is put back by releaseStale on another worker after five
  // minutes, so nothing is lost.
  process.once('SIGTERM', () => {
    state.stopping = true;
    if (state.timer) clearInterval(state.timer);
    log('stopping', { running: state.running });
  });

  log('started', { pollSeconds: pollMs / 1000, batch });
}
