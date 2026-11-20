import type { Prisma, PrismaClient } from '@prisma/client';
import { BaseRepository } from './base.repository';

/**
 * Background jobs kept in Postgres (outbox pattern).
 *
 * - `enqueue` can run inside the same transaction as the business change, so
 *   an order and its "send confirmation" job are saved together or not at all.
 * - `claim` uses FOR UPDATE SKIP LOCKED, so two workers never take one job.
 * - A job may still run twice (a worker can stop after the work but before
 *   `complete`). Handlers must be safe to repeat.
 *
 * All time maths uses the database clock in UTC, so app servers with slightly
 * different clocks agree.
 */

export type JobStatus = 'PENDING' | 'RUNNING' | 'DONE' | 'FAILED';

export interface EnqueueInput {
  type: string;
  payload?: Prisma.InputJsonValue;
  /** Same key twice = the second call does nothing. */
  uniqueKey?: string;
  maxAttempts?: number;
  runAt?: Date;
}

export interface ClaimedJob {
  id: string;
  type: string;
  payload: Prisma.JsonValue;
  attempts: number;
  maxAttempts: number;
  uniqueKey: string | null;
}

export interface JobStats {
  counts: Record<JobStatus, number>;
  /** Seconds the oldest due PENDING job has waited, or null if none. */
  oldestPendingSeconds: number | null;
  recentFailures: {
    id: string;
    type: string;
    attempts: number;
    lastError: string | null;
    updatedAt: Date;
  }[];
}

type Db = PrismaClient | Prisma.TransactionClient;

const MAX_ERROR_LENGTH = 1000;

/**
 * Wait before the next try: 30 s, 1 min, 2 min, 4 min ... capped at 1 hour,
 * with up to 20% random spread so many failed jobs do not retry at once.
 */
export function retryDelayMs(attempts: number, random: () => number = Math.random): number {
  const base = Math.min(60 * 60_000, 30_000 * 2 ** Math.max(0, attempts - 1));
  const spread = 1 + (random() * 0.4 - 0.2);
  return Math.round(base * spread);
}

/** Queue a job. Pass a transaction client to save it with other changes. Returns false for a duplicate key. */
export async function enqueueJob(db: Db, input: EnqueueInput): Promise<boolean> {
  const result = await db.job.createMany({
    data: [
      {
        type: input.type,
        payload: input.payload ?? {},
        uniqueKey: input.uniqueKey ?? null,
        maxAttempts: input.maxAttempts ?? 5,
        runAt: input.runAt ?? new Date(),
      },
    ],
    // ON CONFLICT DO NOTHING: a repeated uniqueKey is not an error, and it
    // does not abort a surrounding transaction.
    skipDuplicates: true,
  });
  return result.count === 1;
}

/** Queue several jobs in one statement. Duplicate keys are skipped. Returns how many were added. */
export async function enqueueJobs(db: Db, inputs: EnqueueInput[]): Promise<number> {
  if (inputs.length === 0) return 0;
  const now = new Date();
  const result = await db.job.createMany({
    data: inputs.map((input) => ({
      type: input.type,
      payload: input.payload ?? {},
      uniqueKey: input.uniqueKey ?? null,
      maxAttempts: input.maxAttempts ?? 5,
      runAt: input.runAt ?? now,
    })),
    skipDuplicates: true,
  });
  return result.count;
}

function trimError(error: unknown): string {
  const text = error instanceof Error ? error.message : String(error);
  return text.length > MAX_ERROR_LENGTH ? `${text.slice(0, MAX_ERROR_LENGTH)}...` : text;
}

export class JobRepository extends BaseRepository {
  enqueue(input: EnqueueInput, tx?: Prisma.TransactionClient): Promise<boolean> {
    return enqueueJob(tx ?? this.db, input);
  }

  /** Take up to `limit` due jobs for this worker. Each claim counts as an attempt. */
  async claim(workerId: string, limit = 5): Promise<ClaimedJob[]> {
    const rows = await this.db.$queryRaw<
      { id: string; type: string; payload: Prisma.JsonValue; attempts: number; max_attempts: number; unique_key: string | null }[]
    >`
      WITH next AS (
        SELECT "id" FROM "jobs"
        WHERE "status" = 'PENDING' AND "run_at" <= timezone('UTC', now())
        ORDER BY "run_at"
        LIMIT ${limit}
        FOR UPDATE SKIP LOCKED
      )
      UPDATE "jobs" AS j
      SET "status" = 'RUNNING',
          "attempts" = j."attempts" + 1,
          "locked_at" = timezone('UTC', now()),
          "locked_by" = ${workerId},
          "updated_at" = timezone('UTC', now())
      FROM next
      WHERE j."id" = next."id"
      RETURNING j."id", j."type", j."payload", j."attempts", j."max_attempts", j."unique_key"
    `;
    return rows.map((r) => ({
      id: r.id,
      type: r.type,
      payload: r.payload,
      attempts: r.attempts,
      maxAttempts: r.max_attempts,
      uniqueKey: r.unique_key,
    }));
  }

  /**
   * Mark a job done. Only the worker that holds it can do this, so a worker
   * whose lock was released as stale cannot overwrite a newer run. The
   * payload is cleared, because some payloads (a reset link) are secrets.
   */
  async complete(id: string, workerId: string): Promise<boolean> {
    const changed = await this.db.$executeRaw`
      UPDATE "jobs"
      SET "status" = 'DONE', "payload" = '{}'::jsonb, "locked_at" = NULL, "locked_by" = NULL,
          "last_error" = NULL, "updated_at" = timezone('UTC', now())
      WHERE "id" = ${id} AND "status" = 'RUNNING' AND "locked_by" = ${workerId}
    `;
    return changed === 1;
  }

  /**
   * Record a failure. Retries later with backoff, or marks FAILED after the
   * last attempt. `scrubPayload` clears secret payloads on final failure.
   */
  async fail(
    job: Pick<ClaimedJob, 'id' | 'attempts' | 'maxAttempts'>,
    workerId: string,
    error: unknown,
    options: { scrubPayload?: boolean; random?: () => number } = {}
  ): Promise<'retry' | 'failed' | 'lost'> {
    const message = trimError(error);
    const final = job.attempts >= job.maxAttempts;
    const delayMs = retryDelayMs(job.attempts, options.random);
    const scrub = final && options.scrubPayload === true;

    const changed = await this.db.$executeRaw`
      UPDATE "jobs"
      SET "status" = ${final ? 'FAILED' : 'PENDING'},
          "run_at" = CASE WHEN ${final} THEN "run_at"
                          ELSE timezone('UTC', now()) + (${delayMs} * interval '1 millisecond') END,
          "payload" = CASE WHEN ${scrub} THEN '{}'::jsonb ELSE "payload" END,
          "last_error" = ${message},
          "locked_at" = NULL, "locked_by" = NULL,
          "updated_at" = timezone('UTC', now())
      WHERE "id" = ${job.id} AND "status" = 'RUNNING' AND "locked_by" = ${workerId}
    `;
    if (changed !== 1) return 'lost';
    return final ? 'failed' : 'retry';
  }

  /**
   * Put back jobs whose worker stopped (crash, deploy) while holding them.
   * Out of attempts = FAILED. `scrubTypes` lists job types whose payload is a
   * secret, cleared when they fail for good.
   */
  async releaseStale(olderThanMs = 5 * 60_000, scrubTypes: string[] = []): Promise<number> {
    return this.db.$executeRaw`
      UPDATE "jobs"
      SET "status" = CASE WHEN "attempts" >= "max_attempts" THEN 'FAILED' ELSE 'PENDING' END,
          "payload" = CASE WHEN "attempts" >= "max_attempts" AND "type" = ANY(${scrubTypes}::text[])
                           THEN '{}'::jsonb ELSE "payload" END,
          "last_error" = 'The worker stopped before this job finished.',
          "run_at" = timezone('UTC', now()),
          "locked_at" = NULL, "locked_by" = NULL,
          "updated_at" = timezone('UTC', now())
      WHERE "status" = 'RUNNING'
        AND "locked_at" < timezone('UTC', now()) - (${olderThanMs} * interval '1 millisecond')
    `;
  }

  /** Try a FAILED job again from the start. Only for job types that are safe to retry by hand. */
  async retry(id: string, allowedTypes: string[]): Promise<boolean> {
    const changed = await this.db.$executeRaw`
      UPDATE "jobs"
      SET "status" = 'PENDING', "attempts" = 0, "last_error" = NULL,
          "run_at" = timezone('UTC', now()), "updated_at" = timezone('UTC', now())
      WHERE "id" = ${id} AND "status" = 'FAILED' AND "type" = ANY(${allowedTypes}::text[])
    `;
    return changed === 1;
  }

  /** Delete finished jobs older than `days`. Failed jobs are kept for review. */
  async purgeDone(days = 14): Promise<number> {
    return this.db.$executeRaw`
      DELETE FROM "jobs"
      WHERE "status" = 'DONE' AND "updated_at" < timezone('UTC', now()) - (${days} * interval '1 day')
    `;
  }

  async stats(): Promise<JobStats> {
    const [grouped, oldest, recentFailures] = await Promise.all([
      this.db.job.groupBy({ by: ['status'], _count: { _all: true } }),
      this.db.$queryRaw<{ seconds: number | null }[]>`
        SELECT EXTRACT(EPOCH FROM (timezone('UTC', now()) - MIN("run_at")))::float8 AS seconds
        FROM "jobs"
        WHERE "status" = 'PENDING' AND "run_at" <= timezone('UTC', now())
      `,
      this.db.job.findMany({
        where: { status: 'FAILED' },
        orderBy: { updatedAt: 'desc' },
        take: 20,
        // Never the payload: it may hold an email address or a reset link.
        select: { id: true, type: true, attempts: true, lastError: true, updatedAt: true },
      }),
    ]);

    const counts: Record<JobStatus, number> = { PENDING: 0, RUNNING: 0, DONE: 0, FAILED: 0 };
    for (const row of grouped) {
      if (row.status in counts) counts[row.status as JobStatus] = row._count._all;
    }
    const seconds = oldest[0]?.seconds;
    return {
      counts,
      oldestPendingSeconds: seconds === null || seconds === undefined ? null : Math.max(0, Math.round(seconds)),
      recentFailures,
    };
  }
}
